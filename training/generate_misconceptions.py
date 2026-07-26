"""
Generate labeled training data for the misconception-category classifier.

The "Misconception Fingerprint" feature (see app/progress) tracks WHICH KIND
of wrong reasoning a student repeats across unrelated topics — not just that
they were wrong. This script builds the (misconception text -> category)
training set that classifier is trained on.

Categories are defined once in ../lib/ml/misconception-taxonomy.json (the
single source of truth read by both this script and the TS runtime).

Two sources, merged:
  1. training/misconceptions_seed.csv  - the 24 real misconceptions already
     hand-labeled from lib/concepts/*.json (ground truth, not synthetic).
  2. Gemini-generated examples per category, spanning subjects the seed set
     doesn't cover (Computer Science, Economics, Mathematics), so the
     classifier generalizes across ALL subjects Lucid's concept generator can
     produce, not just the 3 covered by the curated concepts.

Usage:
    python generate_misconceptions.py                  # merge seed + Gemini
    python generate_misconceptions.py --per-category 30
    python generate_misconceptions.py --seed-only       # no network
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TAXONOMY_PATH = ROOT / "lib" / "ml" / "misconception-taxonomy.json"
SEED_PATH = HERE / "misconceptions_seed.csv"
OUT_PATH = HERE / "misconceptions.csv"

SUBJECTS = [
    "Biology", "Physics", "Chemistry", "Computer Science", "Economics", "Mathematics",
]

GEMINI_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
]

PROMPT = """You write TRAINING DATA for a classifier that recognizes PATTERNS of
scientific/mathematical misconceptions, independent of subject.

Category: {label}
Pattern definition: {description}

Examples that clearly fit this exact pattern (mimic their STRUCTURE and
directness, not their topics):
{examples}
{contrast}
Write {n} short, distinct, FALSE-but-commonly-believed statements that follow
this exact pattern. Spread them across these subjects, varying which one each
statement is about: {subjects}.

Requirements:
- Each statement must be a self-contained, plainly false claim a real student
  might believe — not a question, not hedged with "some people think".
- Each must CLEARLY fit the "{label}" pattern above and NOT another pattern.
  If a statement could equally be explained by a different pattern, rewrite
  it so the "{label}" signal (see examples) is unambiguous — use similar
  telltale phrasing/wording to the examples where natural.
- Vary sentence structure and length (6 to 20 words).
- Do not reuse the same topic twice in a row.

Return ONLY a JSON array of {n} strings. No markdown fence, no commentary."""

# Extra contrastive instruction for the two categories that most often get
# confused with each other (both often surface as "X is Y" sentences) — told
# explicitly what NOT to look like, referencing the sibling pattern by name.
CONTRAST_NOTES = {
    "definition_substitution": (
        "\nIMPORTANT — do NOT write this as a flow or exchange between two "
        "named things (that is a DIFFERENT category, Input/Output Reversal). "
        "Stay about what ONE thing IS or DOES in isolation: its role, what "
        "it's made of, how it's measured, what job it has. No 'flows "
        "into', 'absorbs', 'converts to', 'takes in' verbs.\n"
        "ALSO do NOT describe a causal mechanism, a process happening over "
        "time, or a conservation violation (that is a DIFFERENT category, "
        "Naive Causal Model — e.g. 'friction makes things stop', 'energy "
        "appears from nothing'). Stay STATIC: a wrong label, category, "
        "composition, or measurement convention for the thing — not a story "
        "about what causes what. A good test: your sentence should still "
        "make sense with 'is/are' as the main verb, not an action verb.\n"
    ),
    "input_output_reversal": (
        "\nIMPORTANT — do NOT write this as a static wrong property of one "
        "thing (that is a DIFFERENT category, Definition Substitution). You "
        "MUST name two distinct things and a directional verb between them "
        "(takes in / gives off / flows into / converts into / absorbs / "
        "releases / produces from), with the direction stated backwards.\n"
    ),
    "naive_causal_model": (
        "\nIMPORTANT — do NOT just mislabel or miscategorize a single thing "
        "(that is a DIFFERENT category, Definition Substitution). You MUST "
        "describe a CAUSAL STORY — something happening BECAUSE of something "
        "else, over time or through a mechanism — that is wrong specifically "
        "because it violates conservation (creates something from nothing, "
        "destroys something without trace) or invents a force/effect with no "
        "real source. A good test: your sentence should describe an action "
        "or process, not just define what something is.\n"
    ),
}


def _load_env_local() -> None:
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def _gemini_call(key: str, prompt: str, max_tokens: int) -> str:
    last_err: Exception | None = None
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
        for attempt in range(1, 4):
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
                    break
                raise
            except (urllib.error.URLError, OSError, TimeoutError) as e:
                last_err = e
                wait = 5 * attempt
                print(f"    (network issue on {model}, attempt {attempt}/3; retry in {wait}s)")
                time.sleep(wait)
    raise RuntimeError(f"all Gemini models exhausted: {last_err}")


def gemini_category_samples(key: str, cat: dict, n: int) -> list[tuple[str, str, str]]:
    prompt = PROMPT.format(
        label=cat["label"],
        description=cat["description"],
        examples="\n".join(f"- {x}" for x in cat.get("examples", [])),
        contrast=CONTRAST_NOTES.get(cat["id"], ""),
        n=n,
        subjects=", ".join(SUBJECTS),
    )
    text = _gemini_call(key, prompt, max_tokens=4000)
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        items = json.loads(text)
    except json.JSONDecodeError:
        print(f"  ! could not parse JSON for {cat['id']}; skipping")
        return []
    return [(str(s).strip(), cat["id"], "generated") for s in items if str(s).strip()]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-category", type=int, default=36)
    ap.add_argument("--seed-only", action="store_true")
    ap.add_argument(
        "--categories",
        type=str,
        default=None,
        help="comma-separated category ids to (re)generate; others are kept as-is from OUT_PATH",
    )
    args = ap.parse_args()

    _load_env_local()
    taxonomy = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
    only = set(args.categories.split(",")) if args.categories else None
    if only:
        taxonomy = [c for c in taxonomy if c["id"] in only]

    rows: list[tuple[str, str, str]] = []
    seen: set[str] = set()

    # Carry forward existing generated rows for categories we are NOT
    # regenerating this run, so a targeted --categories run doesn't discard
    # already-good data for the other classes.
    if only and OUT_PATH.exists():
        with open(OUT_PATH, newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r["category"] in only:
                    continue  # will be replaced below
                key = r["text"].strip().lower()
                if key in seen:
                    continue
                seen.add(key)
                rows.append((r["text"], r["category"], r["subject"]))
        print(f"carried forward: {len(rows)} rows for untouched categories")

    with open(SEED_PATH, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if only and r["category"] not in only:
                continue
            key = r["text"].strip().lower()
            if key in seen:
                continue
            seen.add(key)
            rows.append((r["text"], r["category"], r["subject"]))
    print(f"seed: {sum(1 for _ in open(SEED_PATH, encoding='utf-8')) - 1} hand-labeled examples total")

    has_gemini = bool(os.environ.get("GEMINI_API_KEY"))
    if args.seed_only or not has_gemini:
        print("Skipping generation (seed-only or no GEMINI_API_KEY).")
    else:
        key = os.environ["GEMINI_API_KEY"]
        # Batch into calls of <=40 so a single response never gets truncated,
        # and so repeated calls (different sampling) add topic variety
        # instead of the model repeating itself within one huge response.
        batch_size = 40
        for cat in taxonomy:
            print(f"- {cat['id']}")
            remaining = args.per_category
            added = 0
            while remaining > 0:
                n = min(batch_size, remaining)
                pairs = gemini_category_samples(key, cat, n)
                for text, label, subject in pairs:
                    k = text.strip().lower()
                    if k in seen:
                        continue
                    seen.add(k)
                    rows.append((text, label, subject))
                    added += 1
                remaining -= n
                time.sleep(4)  # stay under the free-tier per-minute request cap
            print(f"  +{added} (total {len(rows)})")

    with open(OUT_PATH, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["text", "category", "subject"])
        w.writerows(rows)

    counts: dict[str, int] = {}
    for _, label, _s in rows:
        counts[label] = counts.get(label, 0) + 1
    print(f"\nWrote {len(rows)} samples -> {OUT_PATH}")
    print("Category balance:", counts)


if __name__ == "__main__":
    main()
