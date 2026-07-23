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


# ---------------------------------------------------------------------- driver


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offline", action="store_true", help="force template synthesis")
    ap.add_argument("--online", action="store_true", help="force LLM generation")
    ap.add_argument("--per-concept", type=int, default=None,
                    help="total samples per concept (split across the 4 labels)")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    mix = dict(DEFAULT_MIX)
    if args.per_concept:
        scale = args.per_concept / sum(DEFAULT_MIX.values())
        mix = {k: max(2, round(v * scale)) for k, v in mix.items()}

    use_online = args.online or (not args.offline and bool(os.environ.get("ANTHROPIC_API_KEY")))
    mode = "online (Claude-authored)" if use_online else "offline (template synthesis)"
    print(f"Mode: {mode}")

    rng = random.Random(args.seed)
    concepts = load_concepts()
    rows: list[tuple[str, str, str]] = []

    for cid, concept in concepts.items():
        print(f"- {cid}")
        pairs = online_samples(concept, mix) if use_online else offline_samples(concept, mix, rng)
        rows.extend((cid, text, label) for text, label in pairs)

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["concept_id", "explanation", "label"])
        w.writerows(rows)

    counts: dict[str, int] = {}
    for _, _, label in rows:
        counts[label] = counts.get(label, 0) + 1
    print(f"\nWrote {len(rows)} samples -> {OUT_PATH}")
    print("Label balance:", counts)


if __name__ == "__main__":
    main()
