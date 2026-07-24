# Lucid — The Tutor You Teach

> Everyone built an AI that teaches. We built one that listens.

**You** explain a concept — out loud, or typed. The AI plays a confused student
and asks questions exactly where your understanding has holes. A real ML engine —
not the chatbot — measures how well you actually understand it.

Built on the Feynman Technique and the protégé effect: the fastest way to find
the edge of your understanding is to try to teach it.

---

## Why this exists

Four problems this attacks:

1. **Exams measure recall; nothing measures understanding.** You can score full
   marks by reproducing a definition you cannot use.
2. **The illusion of competence.** Re-reading a chapter feels like learning.
   Explaining it out loud is where the gaps appear.
3. **Students never practise articulation.** Vivas and interviews are the first
   time many people say a concept out loud — under pressure.
4. **Feedback loops are broken.** "Study harder" is not feedback. "You never
   explained where the energy comes from" is.

---

## The two USPs

### 1. Grasp Score (0–100)

> Report cards measure what you remember. Grasp Score measures what you understand.

Three independently-computed dimensions:

| Dimension | How it is measured |
|---|---|
| **Coverage** (0.5) | Each idea in the concept map is embedded (MiniLM) and matched against your explanation's clauses by max cosine similarity. Covered at ≥ 0.55. Score is the sum of covered node weights. |
| **Correctness** (0.3) | A DeBERTa NLI cross-encoder checks each claim against reference facts for entailment/contradiction. |
| **Depth** (0.2) | Cosine similarity between your answers to causal "why" questions and the expected idea. `null` until the depth round runs. |

### 2. Parrot Detector

Distinguishes an explanation **in your own words** from **textbook recitation**,
using two signals that must *both* fire:

- **Semantic similarity** to stored textbook phrasings (embedding cosine)
- **N-gram overlap** — trigram containment of the textbook phrasing in your text

Either signal alone is fooled. High semantic similarity alone just means you were
*correct*. It is only recitation when the exact phrasing overlaps too. When it
fires, the AI says:

> That's the textbook talking. Now you tell me — in your own words, with an example.

---

## The three modes (one engine, three personas)

| Mode | Persona | What it does |
|---|---|---|
| **Explain** | A confused classmate | Asks 2–4 follow-ups targeted at **detected** gaps. Warm, never lectures, one question at a time. |
| **Viva** | An examiner | Cross-questions, builds "why" chains, presses hardest on the weakest answer. |
| **Loop** | A micro-tutor | Finds gaps → teaches **only** the fuzzy parts (≤150 words) → "now explain it back" → re-scores → shows the delta. |

---

## Works on *any* topic

The engine is topic-agnostic — it scores *features* (coverage, contradiction
ratio, phrase overlap), not topic text. The only thing it needs is a **concept
map**. Six are hand-authored; for anything else, `POST /api/concept` generates
one on the spot (nodes + weights + reference facts + misconceptions +
why-questions), validates it against a Zod schema, normalizes node weights to
sum to 1.0, and caches it to disk.

So "Ohm's Law", "Supply and Demand", or "Recursion" all work.

---

## Architecture

```
                          ┌──────────────────────────────────┐
  browser (React)         │  Next.js API routes (server)     │
  ─────────────────       │  ──────────────────────────      │
  landing / session  ───► │  POST /api/concept   ──► Claude ──► concept map (Zod-validated, cached)
  understanding panel     │  POST /api/analyze   ──┐
  report / progress       │  POST /api/persona   ──┼─► lib/ml  (the product)
                          │  POST /api/microlesson─┘
                          └──────────────────────────────────┘
                                        │
                        ┌───────────────┴────────────────┐
                        │        lib/ml (TypeScript)     │
                        │  embeddings.ts  MiniLM-L6-v2   │  ← transformers.js,
                        │  scoring.ts     coverage/NLI   │    module-level singletons,
                        │  classifier.ts  weights.json   │    server-side only
                        │  features.ts    FEATURE_ORDER  │
                        └───────────────┬────────────────┘
                                        │ weights.json
                        ┌───────────────┴────────────────┐
                        │   training/  (Python, offline) │
                        │   generate_data.py → samples   │
                        │   features.py  (mirrors TS)    │
                        │   train.py     → weights.json  │
                        └────────────────────────────────┘
```

**The scoring engine never depends on the LLM.** If the Anthropic API is down or
no key is set, the persona degrades to a clean notice and every number in the
report is still computed. That independence is deliberate — the score is not a
chatbot's opinion.

---

## Running it

> **Full walkthrough — modes, demo script, troubleshooting: [USAGE.md](USAGE.md)**

```bash
npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY
npm run dev
```

Open <http://localhost:3000>.

**The API key is only needed for the AI persona, micro-lessons, and custom-topic
generation.** The Grasp Score, Parrot Detector, and gap detection all work
without it.

> First request downloads ~90 MB of models (MiniLM + DeBERTa NLI) and takes a
> few minutes. The app calls `GET /api/analyze` on load to warm them up; after
> that a full analysis takes **1–3 s**.

### Note on ports

If port 3000 is occupied (a local Postgres will silently hold it and reset HTTP
requests), run on another port:

```bash
npx next dev -p 3210 -H 127.0.0.1
```

---

## Training the classifier

```bash
cd training
pip install -r requirements.txt
python generate_data.py --offline   # 300 labeled samples, no credentials needed
python train.py                     # → ../lib/ml/weights.json + metrics
```

`generate_data.py` runs **offline** by default (deterministic template synthesis
from the concept maps, fully reproducible from a clean clone) or **online**
(`--online`, Claude-authored, more natural variety) when a key is present.

`features.py` is a line-by-line mirror of `lib/ml/scoring.ts` — same thresholds,
same NLI relatedness gating. If you change a threshold in one, change it in the
other, or the trained weights will not transfer.

### Metrics

<!-- METRICS:START — regenerated by train.py -->
Run: **659 samples** across **11 concepts / 6 subjects** (Gemini-authored),
494 train / 165 held-out, 8 features, 4 classes.

| Model | 5-fold CV accuracy | Held-out accuracy |
|---|---|---|
| Logistic Regression *(exported)* | 0.753 ± 0.018 | **0.848** |
| Gradient Boosting | 0.747 ± 0.018 | 0.848 |

Per-class, held-out (Logistic Regression):

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| good | 0.81 | 0.86 | 0.83 | 49 |
| partial | 0.78 | 0.73 | 0.76 | 49 |
| **memorized** | **1.00** | **0.97** | **0.99** | 35 |
| wrong | 0.85 | 0.88 | 0.86 | 32 |

macro avg F1 **0.86** · overall accuracy **0.85**

![Confusion matrix](training/confusion_matrix.png)

**What moved the numbers.** The first run (300 template-generated samples) scored
0.733 held-out, and nearly all of its error sat on the `good` ↔ `partial`
boundary (0.58-0.59 precision). The cause was the data, not the model: the
offline generator built both classes from one template, differing only in how
many concept nodes were dropped, so no real boundary existed to learn. Replacing
it with LLM-authored explanations across 6 subjects lifted those two classes to
**0.78-0.81 precision** and the whole model to **0.848** — a +11.5 point gain
from data quality alone, with the feature set untouched.
<!-- METRICS:END -->

**Ablation — does the Parrot Detector actually earn its place?**

Removing the two copying features (`textbook_similarity`, `trigram_overlap`):

| Metric | Full | Ablated | Δ |
|---|---|---|---|
| 5-fold CV accuracy | 0.753 | 0.603 | **+0.150** |
| Held-out accuracy | 0.848 | 0.636 | **+0.212** |
| **`memorized` recall** | **0.97** | **0.34** | **+0.63** |

Semantic similarity alone cannot separate a recited answer from an understood
one, because a memorized explanation is *by construction* semantically correct.
Strip the n-gram signal and memorization detection collapses by nearly
two-thirds — which is the empirical case for the two-signal design.

**Trained on synthetic data, evaluated on human-written explanations.**

<!-- HUMAN-TEST:START -->
> **Human test set — placeholder.** The held-out human-written set (50–80
> explanations collected from real students, labeled independently by two
> raters with Cohen's κ reported) is not yet collected. Numbers above are from
> the synthetic split only. This section will be replaced with the human-set
> results and inter-rater agreement.
<!-- HUMAN-TEST:END -->

---

## Engineering notes

Findings worth recording, because each one changed the design:

**NLI contradiction is only meaningful between co-referential sentences.** The
first implementation compared every clause against every reference fact and
reported near-total nonsense — the cross-encoder rates *"oxygen is released"* vs
*"glucose stores chemical energy"* as **contradiction 0.99**, because it was
trained on same-scene premise/hypothesis pairs. The fix was to gate NLI by
embedding similarity and compare each claim only against the single fact it most
closely matches.

**Over-eager clause splitting destroys everything downstream.** Splitting on a
bare `" and "` shredded `"carbon dioxide and water"` into fragments like
`"oxygen."`, which produce meaningless entailment scores. Segmentation now splits
only on strong clause boundaries and merges anything under four words.

**The coverage threshold is a real precision/recall tradeoff.** At 0.45,
Newton's third law counted as "covered" for an explanation that never mentioned
action–reaction. At 0.55 that is correctly a gap — but a genuinely-covered node
sometimes lands at 0.55 too. Generic MiniLM similarity is not calibrated for
this task, which is precisely the motivation for fine-tuning the embedding model
(see Roadmap).

---

## Limitations (honest)

- **Concept maps are the ceiling.** Hand-authored maps are high quality;
  generated ones are only as good as the model that wrote them. A weak map
  produces a confidently wrong score.
- **Scoring is imperfect.** Coverage uses a single cosine threshold on a generic
  embedding model. Borderline ideas (~0.55) can fall either way.
- **English only**, and tuned for roughly ages 14–18.
- **Voice input needs a Chromium browser.** It uses the browser-native Web
  Speech API (no key, no cost, streams interim words). Firefox has no
  implementation, so the mic button hides itself and typing still works.
- **Depth is shallow** — two why-questions, scored by similarity to an expected
  idea, not by real reasoning assessment.
- **No auth, no DB.** History lives in `localStorage`; clearing site data loses it.
- **The classifier trains on synthetic data.** Until the human test set lands,
  treat the accuracy figures as an upper bound.

## Roadmap

- **Fine-tuned embedding model** — train MiniLM on explanation pairs so
  similarity encodes *explanation quality* rather than generic relatedness, then
  export to ONNX and load it in transformers.js. This is the single highest-value
  improvement; it directly fixes the coverage-threshold problem above.
- Auto-generated concept maps from an uploaded PDF or syllabus.
- Human-labeled test set + inter-rater agreement (Cohen's κ).
- Multilingual support.
- Teacher dashboard: which ideas does a whole class consistently miss?

---

## Tech stack

| Layer | Choice |
|---|---|
| LLM | **Anthropic Claude** (`claude-opus-4-8`) — personas, micro-lessons, concept-map generation |
| Pre-trained models | **Hugging Face**: `Xenova/all-MiniLM-L6-v2` (embeddings) + `Xenova/nli-deberta-v3-xsmall` (NLI), via transformers.js |
| Speech | **Web Speech API** — browser-native dictation, no key required |
| Frontend | **Next.js 16** (App Router) + **React 19** + **Tailwind CSS v4** + Framer Motion + Recharts |
| Backend | **Next.js API routes on the Node runtime** — all keys server-side, Zod-validated inputs |
| Training | **Python**: sentence-transformers, scikit-learn, pandas, matplotlib |

Pre-trained models and open-source libraries are used as *components*; all core
application logic — the scoring engine, the two-signal Parrot Detector, the
concept-map schema and generation, the gap→persona grounding, and the Loop Mode
delta — is original to this project.

## Repo layout

```
app/            landing, session, report, progress + API routes
components/     UI (understanding panel, gauge, delta reveal, parrot banner)
lib/ml/         the scoring engine (embeddings, scoring, classifier, features)
lib/concepts/   6 hand-authored concept maps + runtime generation
lib/personas/   the three persona prompt builders
training/       Python: data generation, feature mirror, training, metrics
demo/           deterministic example explanations for rehearsing the demo
```
