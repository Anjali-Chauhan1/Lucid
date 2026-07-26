"""
Generate labeled training data for the Lucid scorer.

Labels
------
good       — own words, covers nearly all concept nodes, accurate
partial    — own words, but 2-3 nodes missing
memorized  — near-verbatim textbook recitation (accurate but copied)
wrong      — contains one or more of the concept's known misconceptions

Two modes
---------
--online   Claude authors the explanations (richer, more natural variety).
           Requires ANTHROPIC_API_KEY.
--offline  Deterministic template synthesis from the concept JSONs. Requires
           no credentials and no network, so the whole pipeline is
           reproducible from a clean clone. This is the default fallback.

Usage
-----
    python generate_data.py                 # auto: online if key present
    python generate_data.py --offline       # force offline
    python generate_data.py --per-concept 60
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import random
import re
from pathlib import Path

from features import load_concepts

OUT_PATH = Path(__file__).resolve().parent / "samples.csv"

# Counts per concept (defaults from the build spec: 15/15/10/10)
DEFAULT_MIX = {"good": 15, "partial": 15, "memorized": 10, "wrong": 10}

# ---------------------------------------------------------------- offline mode

STARTERS = [
    "Basically, ", "So ", "The way I understand it, ", "Okay so ", "Right, so ",
    "From what I get, ", "I think ", "Pretty much ", "In simple terms, ",
]
CONNECTORS = [
    " Then ", " After that ", " Also ", " And ", " Plus ", " On top of that ",
    " What happens next is ", " The other thing is ",
]
HEDGES = ["kind of ", "basically ", "sort of ", "pretty much ", ""]

# Light lexical rewriting so "own words" samples don't sit on top of the
# node text verbatim — this is what separates `good` from `memorized`.
SYNONYMS = {
    "provides": "gives", "energy": "power", "absorbs": "soaks up",
    "converted": "turned", "released": "let out", "produces": "makes",
    "reaction": "process", "occurs": "happens", "takes place": "happens",
    "contains": "has", "requires": "needs", "surrounds": "wraps around",
    "controls": "decides", "carried": "moved", "absorbed": "taken in",
    "particle": "bit", "smallest": "tiniest", "combine": "join up",
    "resistance": "pushback", "constant": "steady", "opposite": "reverse",
    "perpendicular": "at a right angle", "imaginary": "made-up",
    "byproduct": "leftover", "chemical": "stored",
}


def _own_words(text: str, rng: random.Random) -> str:
    """Rewrite node text into looser, student-sounding phrasing."""
    out = text
    for formal, casual in SYNONYMS.items():
        if formal in out and rng.random() < 0.75:
            out = out.replace(formal, casual)
    out = re.sub(r"^(the|a|an)\s+", "", out)
    if rng.random() < 0.35:
        out = rng.choice(HEDGES) + out
    return out


def _compose(parts: list[str], rng: random.Random) -> str:
    """Stitch clause fragments into a paragraph."""
    if not parts:
        return ""
    text = rng.choice(STARTERS) + parts[0]
    for p in parts[1:]:
        text += rng.choice(CONNECTORS) + p
    text = re.sub(r"\s+", " ", text).strip()
    if not text.endswith("."):
        text += "."
    return text[0].upper() + text[1:]


def offline_samples(concept: dict, mix: dict[str, int], rng: random.Random) -> list[tuple[str, str]]:
    nodes = concept["nodes"]
    rows: list[tuple[str, str]] = []

    # good — nearly all nodes, own words
    for _ in range(mix["good"]):
        keep = nodes if len(nodes) <= 5 else rng.sample(nodes, max(4, len(nodes) - 1))
        keep = sorted(keep, key=lambda n: nodes.index(n))
        rows.append((_compose([_own_words(n["text"], rng) for n in keep], rng), "good"))

    # partial — drop 2-3 nodes, own words
    for _ in range(mix["partial"]):
        drop = rng.randint(2, min(3, max(2, len(nodes) - 2)))
        keep = rng.sample(nodes, max(1, len(nodes) - drop))
        keep = sorted(keep, key=lambda n: nodes.index(n))
        rows.append((_compose([_own_words(n["text"], rng) for n in keep], rng), "partial"))

    # memorized — near-verbatim textbook
    phrasings = concept["textbookPhrasings"]
    for i in range(mix["memorized"]):
        picks = rng.sample(phrasings, min(2, len(phrasings))) if len(phrasings) > 1 else phrasings
        text = " ".join(picks)
        if i % 3 == 1:
            # Light framing around still-verbatim textbook wording — real
            # recitation often gets topped and tailed like this.
            text = f"{text} That is the definition."
        rows.append((text, "memorized"))

    # wrong — a misconception plus some correct material
    for _ in range(mix["wrong"]):
        mis = rng.choice(concept["misconceptions"])
        filler = rng.sample(nodes, min(2, len(nodes)))
        parts = [_own_words(mis, rng)] + [_own_words(n["text"], rng) for n in filler]
        rng.shuffle(parts)
        rows.append((_compose(parts, rng), "wrong"))

    return rows


# ----------------------------------------------------------------- online mode

PROMPT = """You are producing TRAINING DATA for a classifier that grades how well a student understands a concept.

Concept: {concept} ({subject})

The key ideas a complete explanation should cover:
{nodes}

Textbook phrasings (the "official" wording):
{textbook}

Known student misconceptions (these are FALSE):
{misconceptions}

Write {n} explanations of this concept in the "{label}" category, where:
{definition}

Requirements:
- Vary length (1 to 6 sentences), vocabulary, and confidence level.
- Write the way real students aged 14-16 write, including informal phrasing.
- Vary the English register: include some non-native-English-speaker phrasing.
- Do NOT number them or add any commentary.

Return ONLY a JSON array of {n} strings. No markdown fence, no other text."""

DEFINITIONS = {
    "good": "the student uses their OWN words, covers nearly all the key ideas, and says nothing false. It must NOT copy the textbook phrasing.",
    "partial": "the student uses their OWN words and says nothing false, but MISSES 2-3 of the key ideas entirely.",
    "memorized": "the student recites the textbook phrasing almost word for word. Accurate, but clearly copied rather than understood.",
    "wrong": "the student's explanation contains one or more of the listed misconceptions, stated as if true.",
}

# ---- coverage-controlled generation (good / partial) ----
#
# `good` and `partial` differ ONLY in how many key ideas are covered, so the
# label is only as trustworthy as the generator's compliance. Asking for
# "misses 2-3 ideas" without saying WHICH produced samples whose true
# coverage drifted from their label — measured label noise that capped the
# classifier at ~79%. These prompts name the exact ideas to include and
# omit, so the label is correct BY CONSTRUCTION rather than by hope.
#
# This does not make the task circular: the classifier still has to infer
# coverage from raw text through embeddings, which is a genuinely noisy
# estimate of the ground truth we control here.
COVERAGE_PROMPT = """You are producing TRAINING DATA for a classifier that grades how well a student understands a concept.

Concept: {concept} ({subject})

Write {n} short explanations of this concept, as if written by real students aged 14-16.

You MUST cover ALL of these ideas in every explanation:
{include}
{omit_block}
Requirements:
- Use the student's OWN words. Do NOT copy this textbook phrasing:
{textbook}
- Everything stated must be TRUE. Do not include any of these false beliefs:
{misconceptions}
- Vary length, vocabulary, sentence structure and confidence between the {n} explanations.
- Vary the English register: include some non-native-English-speaker phrasing.
- Do NOT number them or add any commentary.

Return ONLY a JSON array of {n} strings. No markdown fence, no other text."""

OMIT_BLOCK = """
You MUST NOT mention, hint at, or allude to ANY of these ideas — leave them out completely:
{omit}
"""


def online_samples(concept: dict, mix: dict[str, int]) -> list[tuple[str, str]]:
    import anthropic

    client = anthropic.Anthropic()
    rows: list[tuple[str, str]] = []
    for label, n in mix.items():
        prompt = PROMPT.format(
            concept=concept["concept"],
            subject=concept["subject"],
            nodes="\n".join(f"- {x['text']}" for x in concept["nodes"]),
            textbook="\n".join(f"- {x}" for x in concept["textbookPhrasings"]),
            misconceptions="\n".join(f"- {x}" for x in concept["misconceptions"]),
            n=n,
            label=label,
            definition=DEFINITIONS[label],
        )
        msg = client.messages.create(
            model=os.environ.get("LUCID_PERSONA_MODEL", "claude-opus-4-8"),
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in msg.content if b.type == "text").strip()
        text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
        try:
            items = json.loads(text)
        except json.JSONDecodeError:
            print(f"  ! could not parse JSON for {concept['id']}/{label}; skipping")
            continue
        rows.extend((str(s).strip(), label) for s in items if str(s).strip())
        print(f"  {concept['id']}/{label}: {len(items)}")
    return rows


# --------------------------------------------------- online mode (Gemini, free)

# Free-tier daily cap is per-model, so fall through the chain on 429.
GEMINI_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
]


def _load_env_local() -> None:
    """Pull GEMINI_API_KEY out of ../.env.local so the trainer shares the app key."""
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def _gemini_call(key: str, prompt: str, max_tokens: int) -> str:
    """
    One Gemini completion, walking the model fallback chain on 429/404/400.

    Transient network failures (DNS, reset connections) are retried with
    backoff rather than abandoned — a long generation run WILL hit them, and
    losing a whole concept to one blip wastes quota.
    """
    import time
    import urllib.error
    import urllib.request

    last_err = None
    for model in GEMINI_MODELS:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{model}:generateContent"
        )
        body = json.dumps(
            {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": {"maxOutputTokens": max_tokens},
            }
        ).encode()

        for attempt in range(1, 4):  # 3 network attempts per model
            req = urllib.request.Request(
                url,
                data=body,
                headers={"content-type": "application/json", "x-goog-api-key": key},
            )
            try:
                with urllib.request.urlopen(req, timeout=180) as resp:
                    data = json.loads(resp.read().decode())
                parts = (
                    data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                )
                return "".join(p.get("text", "") for p in parts).strip()
            except urllib.error.HTTPError as e:
                if e.code in (429, 404, 400):
                    print(f"    (model {model} unavailable: {e.code}; trying next)")
                    last_err = e
                    time.sleep(2)
                    break  # move to the next model
                raise
            except (urllib.error.URLError, OSError, TimeoutError) as e:
                # DNS / reset / timeout — transient, so back off and retry.
                last_err = e
                wait = 5 * attempt
                print(f"    (network issue on {model}, attempt {attempt}/3; retry in {wait}s)")
                time.sleep(wait)

    raise RuntimeError(f"all Gemini models exhausted: {last_err}")


def _call_and_parse(key: str, prompt: str, tag: str) -> list[str]:
    """One generation call, returning parsed strings (empty list on failure)."""
    try:
        text = _gemini_call(key, prompt, max_tokens=6000)
    except Exception as e:  # partial data is better than none
        print(f"  ! {tag} failed ({e}); skipping")
        return []
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        items = json.loads(text)
    except json.JSONDecodeError:
        print(f"  ! could not parse JSON for {tag}; skipping")
        return []
    return [str(s).strip() for s in items if str(s).strip()]


def _coverage_samples(
    key: str, concept: dict, label: str, n: int, rng: random.Random
) -> list[tuple[str, str]]:
    """
    Generate `good` / `partial` with an explicitly controlled node set.

    `partial` is produced in small batches, each omitting a DIFFERENT random
    2-3 nodes, so the dataset covers many distinct "which ideas are missing"
    patterns rather than one.
    """
    import time

    nodes = concept["nodes"]
    textbook = "\n".join(f"  - {x}" for x in concept["textbookPhrasings"])
    misconceptions = "\n".join(f"  - {x}" for x in concept["misconceptions"])
    rows: list[tuple[str, str]] = []

    if label == "good":
        batches = [(list(nodes), [], n)]
    else:
        # ~5 per batch so each omission pattern is represented several times.
        batch_size = 5
        batches = []
        remaining = n
        while remaining > 0:
            take = min(batch_size, remaining)
            n_omit = rng.randint(2, min(3, max(2, len(nodes) - 2)))
            omit = rng.sample(nodes, n_omit)
            keep = [x for x in nodes if x not in omit]
            batches.append((keep, omit, take))
            remaining -= take

    for keep, omit, take in batches:
        omit_block = (
            OMIT_BLOCK.format(omit="\n".join(f"  - {x['text']}" for x in omit)) if omit else ""
        )
        prompt = COVERAGE_PROMPT.format(
            concept=concept["concept"],
            subject=concept["subject"],
            n=take,
            include="\n".join(f"  - {x['text']}" for x in keep),
            omit_block=omit_block,
            textbook=textbook,
            misconceptions=misconceptions,
        )
        items = _call_and_parse(key, prompt, f"{concept['id']}/{label}")
        rows.extend((s, label) for s in items)
        time.sleep(4)  # stay under the free-tier per-minute request cap

    print(f"  {concept['id']}/{label}: {len(rows)}")
    return rows


def gemini_online_samples(
    concept: dict, mix: dict[str, int], rng: random.Random
) -> list[tuple[str, str]]:
    import time

    key = os.environ["GEMINI_API_KEY"]
    rows: list[tuple[str, str]] = []
    for label, n in mix.items():
        # good/partial are coverage-defined, so generate them with the node
        # set pinned explicitly (see COVERAGE_PROMPT). memorized/wrong are
        # defined by phrasing/falsehood instead, so the original prompt fits.
        if label in ("good", "partial"):
            rows.extend(_coverage_samples(key, concept, label, n, rng))
            continue

        prompt = PROMPT.format(
            concept=concept["concept"],
            subject=concept["subject"],
            nodes="\n".join(f"- {x['text']}" for x in concept["nodes"]),
            textbook="\n".join(f"- {x}" for x in concept["textbookPhrasings"]),
            misconceptions="\n".join(f"- {x}" for x in concept["misconceptions"]),
            n=n,
            label=label,
            definition=DEFINITIONS[label],
        )
        items = _call_and_parse(key, prompt, f"{concept['id']}/{label}")
        rows.extend((s, label) for s in items)
        print(f"  {concept['id']}/{label}: {len(items)}")
        time.sleep(4)  # stay under the free-tier per-minute request cap
    return rows


# ---------------------------------------------------------------------- driver


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="force template synthesis")
    ap.add_argument("--online", action="store_true", help="force LLM generation")
    ap.add_argument("--per-concept", type=int, default=None,
                    help="total samples per concept (split across the 4 labels)")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--fresh", action="store_true",
                    help="discard existing samples.csv instead of merging into it")
    args = ap.parse_args()

    _load_env_local()

    mix = dict(DEFAULT_MIX)
    if args.per_concept:
        scale = args.per_concept / sum(DEFAULT_MIX.values())
        mix = {k: max(2, round(v * scale)) for k, v in mix.items()}

    has_gemini = bool(os.environ.get("GEMINI_API_KEY"))
    has_claude = bool(os.environ.get("ANTHROPIC_API_KEY"))
    want_online = args.online or (not args.offline and (has_gemini or has_claude))

    if want_online and has_gemini:
        provider = "gemini"
        mode = "online (Gemini-authored, free tier)"
    elif want_online and has_claude:
        provider = "claude"
        mode = "online (Claude-authored)"
    else:
        provider = "offline"
        mode = "offline (template synthesis)"
    print(f"Mode: {mode}")

    rng = random.Random(args.seed)
    concepts = load_concepts()
    print(f"{len(concepts)} concepts: {', '.join(concepts)}\n")

    # Merge with whatever is already on disk unless --fresh is given. A long
    # online run WILL be interrupted; destroying prior samples on every run
    # turns a network blip into total data loss.
    rows: list[tuple[str, str, str]] = []
    seen: set[tuple[str, str]] = set()
    if not args.fresh and OUT_PATH.exists():
        with open(OUT_PATH, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                key = (r["concept_id"], r["explanation"])
                if key in seen:
                    continue
                seen.add(key)
                rows.append((r["concept_id"], r["explanation"], r["label"]))
        print(f"merging with {len(rows)} existing samples\n")

    def flush() -> None:
        with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["concept_id", "explanation", "label"])
            w.writerows(rows)

    for cid, concept in concepts.items():
        print(f"- {cid}")
        if provider == "gemini":
            pairs = gemini_online_samples(concept, mix, rng)
        elif provider == "claude":
            pairs = online_samples(concept, mix)
        else:
            pairs = offline_samples(concept, mix, rng)
        added = 0
        for text, label in pairs:
            key = (cid, text)
            if key in seen:
                continue  # de-dupe across runs
            seen.add(key)
            rows.append((cid, text, label))
            added += 1
        # Save after every concept so an interruption keeps prior progress.
        flush()
        if added:
            print(f"  +{added} (total {len(rows)})")

    flush()
    counts: dict[str, int] = {}
    for _, _, label in rows:
        counts[label] = counts.get(label, 0) + 1
    print(f"\nWrote {len(rows)} samples -> {OUT_PATH}")
    print("Label balance:", counts)


if __name__ == "__main__":
    main()
