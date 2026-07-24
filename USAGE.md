# Lucid — How to run and use it

## 0. Start it

```bash
cd lucid-ai
npm install                    # first time only
cp .env.example .env.local     # add GEMINI_API_KEY (free: aistudio.google.com/apikey)
npx next dev -p 3210 -H 127.0.0.1
```

Open **<http://127.0.0.1:3210>**

> **Why port 3210 and not 3000?** A local Postgres holds port 3000 on this
> machine and silently resets HTTP requests, which looks like the app is broken.
> Any free port works.

**First load takes a few minutes** — it downloads ~90 MB of ML models (MiniLM +
DeBERTa NLI). You'll see *"Warming up the brain…"* in the header. After that,
each analysis takes 1–3 seconds. The models are cached, so this is a one-time cost.

### What needs a key and what doesn't

| Works with **no key** | Needs `GEMINI_API_KEY` |
|---|---|
| Grasp Score, Coverage, Depth | The AI persona's questions |
| Parrot Detector | Micro-lessons (Loop Mode) |
| Gap detection + understanding map | Custom topics |
| Report, progress chart, voice input | |

The score is never the LLM's opinion — that separation is deliberate. If your
key runs out mid-demo, everything above still works.

---

## 1. The core loop (what the user actually does)

```
  Pick a topic
       │
       ▼
  Explain it  ──────► [ ML ENGINE scores it, no LLM involved ]
  (type or 🎙 speak)         │
       │                     ├─ Coverage: which ideas did you reach?
       │                     ├─ Correctness: did you contradict a fact?
       │                     └─ Parrot check: own words or recitation?
       ▼
  Understanding map lights up, live score appears
       │
       ▼
  AI persona asks about YOUR detected gaps   ◄── LLM, driven by engine output
       │
       ▼
  Depth round: 2 causal "why" questions
       │
       ▼
  REPORT: Grasp Score + gaps + wrong statements
```

**The one-way arrow matters:** the ML engine tells the LLM what to ask about.
The LLM never touches the score.

---

## 2. The three modes

Pick a mode on the landing page *before* choosing a topic.

### Explain Mode — the default
A confused classmate asks about the ideas you missed.

1. Pick a concept (or type any topic)
2. Explain it in your own words — type, or press **🎙 Explain out loud**
3. Hit **Teach it →**
4. Watch the **understanding map** light up node-by-node
5. The persona asks ONE question at a time, targeted at a real gap
6. Answer, or click **"I'm done — score me"**
7. Answer 2 depth questions → **Report**

### Viva Mode — exam practice
Same engine, examiner persona. Firmer, builds "why" chains, presses on your
weakest answer. Same flow as Explain.

> Compare on the same topic — the difference is stark:
> **Explain:** *"That makes sense, but where exactly does that released energy go?"*
> **Viva:** *"You have addressed inertia and force, but what happens when two bodies interact?"*

### Loop Mode — the money shot 💰
Measures improvement, before and after.

1. Explain the concept → scored (this becomes your **BEFORE**)
2. A **micro-lesson** appears covering *only* your gaps (≤150 words)
3. Read it, click **Explain it back →**
4. Explain again → re-scored
5. Report opens with the **delta animation**: `59 → 87  +28`

This is the strongest thing to record for a demo video.

---

## 3. Using any topic

On the landing page, type into **"Type any topic…"** and hit **Teach this**.

Lucid generates a concept map on the spot — key ideas with weights, reference
facts, common misconceptions, and causal why-questions — validates it, and
caches it. Verified working on Ohm's Law, Recursion, Supply & Demand, the
Pythagorean Theorem, and Acids & Bases.

**Tip:** phrase it as one specific concept. *"Ohm's Law"* works; *"physics"* is
too broad and will be rejected with a hint.

---

## 4. Reading the report

| Panel | What it means |
|---|---|
| **Gauge (0–100)** | Grasp Score = 0.5×Coverage + 0.3×Correctness + 0.2×Depth |
| **Verdict card** | `good` / `partial` / `memorized` / `wrong` + confidence. Says "trained model" when `weights.json` is loaded |
| **Coverage** | How many concept-map ideas you actually reached |
| **Correctness** | Whether you contradicted a reference fact |
| **Depth** | How you handled the causal "why" questions |
| **Parrot Detector** | Verdict + textbook similarity + phrase overlap. **Both** must be high to count as recitation |
| **What you didn't reach** | Each missed idea + how close you got |
| **Where you went wrong** | *"You said X — but actually Y"* |

Confetti fires only at **≥ 80**.

**Progress page** (`/progress`) plots one line per concept across sessions, and
highlights your biggest Loop Mode jump.

---

## 5. Rehearsing a demo

`demo/examples.json` has verified explanations with predicted outcomes so the
demo is repeatable. The strongest 90-second run:

1. **Photosynthesis → Explain.** Paste the `memorized` sample.
   → 🦜 Parrot banner fires at 100%/100%, score 59, label `memorized`.
   *"The engine caught that this was recited, not understood."*
2. **Same concept → Loop Mode.** Paste the `partial` sample.
   → micro-lesson appears → paste the `good` sample → **delta animation**.
3. **Type "Ohm's Law".** → map generated live, then score a complete explanation → **100**.
   *"It works on any topic, not six hardcoded ones."*
4. **Show `training/confusion_matrix.png` + the ablation.**
   *"Remove the copying features and memorization detection drops from 0.97 to 0.34."*

---

## 6. Retraining the classifier

```bash
cd training
pip install -r requirements.txt
python generate_data.py --online     # Gemini-authored; --offline needs no key
python train.py                      # → ../lib/ml/weights.json + metrics
```

- Runs **merge** into `samples.csv` by default and de-dupe, so an interrupted
  run never loses prior data. Use `--fresh` to start clean.
- `train.py` takes ~30–40 min on CPU (feature extraction runs every explanation
  through MiniLM + the NLI cross-encoder).
- Adding more topics grows training diversity automatically — generated concept
  maps in `.cache/concepts/` are picked up by the trainer.

Current: **659 samples, 11 concepts, 6 subjects → 0.848 held-out accuracy.**

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Connection reset on :3000 | Postgres holds that port — use `-p 3210` |
| "Warming up the brain…" for minutes | First-ever model download (~90 MB). One time only. |
| Persona silent, score still works | No/expired key, or free-tier quota. Working as designed — scores are independent. |
| `429` on a custom topic | Gemini free-tier **daily** cap is *per model*; the app falls through a model chain automatically. Resets midnight Pacific. |
| Mic button missing | Web Speech API is Chromium-only. Typing is unaffected. |
| Report says "not found" | Reports live in `localStorage` — same browser only. |
