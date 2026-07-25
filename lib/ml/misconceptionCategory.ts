/**
 * Misconception-category inference ("Misconception Fingerprint").
 *
 * Classifies WHICH KIND of wrong reasoning a matched misconception is an
 * instance of (term conflation, overgeneralization, ...), independent of
 * subject. This is what lets the progress page notice that a student who
 * got Photosynthesis wrong with "plants breathe in oxygen" and Newton's
 * Laws wrong with "a constant force keeps things moving" made the SAME
 * kind of mistake in two unrelated subjects.
 *
 * Reads lib/ml/misconception-weights.json (exported by
 * training/train_misconception_classifier.py): standardize-free
 * linear -> softmax multinomial logistic regression over a hand-rolled
 * TF-IDF + lexical-cue feature space (see misconceptionFeatures.ts). No
 * embedding model — held-out accuracy testing showed dense sentence
 * embeddings smooth away exactly the surface phrasing this task depends on
 * (58% accuracy vs 95%+ for this lexical approach).
 *
 * If weights.json is absent or malformed, falls back to transparent
 * keyword heuristics and logs a warning, mirroring classifier.ts.
 */
import fs from "node:fs";
import path from "node:path";
import type { MisconceptionCategory } from "@/lib/types";
import { buildFeatureVector, cueCounts, type TfidfSpace } from "./misconceptionFeatures";

export type { MisconceptionCategory };

interface Weights {
  classes: MisconceptionCategory[];
  coef: number[][]; // coef[classIndex][featureIndex]
  intercept: number[];
  word_vocab: string[];
  word_idf: number[];
  char_vocab: string[];
  char_idf: number[];
}

let weights: Weights | null = null;
let wordSpace: TfidfSpace | null = null;
let charSpace: TfidfSpace | null = null;
let warned = false;

try {
  const weightsPath = path.join(process.cwd(), "lib", "ml", "misconception-weights.json");
  if (fs.existsSync(weightsPath)) {
    const loaded = JSON.parse(fs.readFileSync(weightsPath, "utf8")) as Weights;
    if (
      loaded &&
      Array.isArray(loaded.coef) &&
      Array.isArray(loaded.classes) &&
      Array.isArray(loaded.word_vocab) &&
      Array.isArray(loaded.char_vocab)
    ) {
      weights = loaded;
      wordSpace = { vocab: loaded.word_vocab, idf: loaded.word_idf };
      charSpace = { vocab: loaded.char_vocab, idf: loaded.char_idf };
      console.info("[misconceptionCategory] loaded trained misconception-weights.json");
    } else {
      console.warn("[misconceptionCategory] misconception-weights.json malformed — using heuristic fallback.");
    }
  }
} catch (err) {
  console.warn("[misconceptionCategory] could not load misconception-weights.json:", (err as Error).message);
}

function softmax(z: number[]): number[] {
  const max = Math.max(...z);
  const exps = z.map((v) => Math.exp(v - max));
  const sum = exps.reduce((s, e) => s + e, 0);
  return exps.map((e) => e / sum);
}

export interface MisconceptionClassifierResult {
  category: MisconceptionCategory;
  confidence: number;
  usedTrainedModel: boolean;
}

/** Transparent keyword heuristic used when no trained weights are available. */
function heuristic(text: string): MisconceptionClassifierResult {
  if (!warned) {
    console.warn("[misconceptionCategory] misconception-weights.json not found — using heuristic fallback.");
    warned = true;
  }
  const tl = text.toLowerCase();
  const [defCue, flowCue] = cueCounts(text);

  if (/\b(same thing|identical|synonymous|interchangeable)\b/.test(tl)) {
    return { category: "term_conflation", confidence: 0.6, usedTrainedModel: false };
  }
  if (/\b(always|never|only|all|every)\b/.test(tl)) {
    return { category: "overgeneralization", confidence: 0.5, usedTrainedModel: false };
  }
  if (/\b(from nothing|destroyed|disappears|used up|out of thin air)\b/.test(tl)) {
    return { category: "naive_causal_model", confidence: 0.5, usedTrainedModel: false };
  }
  if (flowCue > defCue) {
    return { category: "input_output_reversal", confidence: 0.45, usedTrainedModel: false };
  }
  return { category: "definition_substitution", confidence: 0.4, usedTrainedModel: false };
}

/** Classify a matched misconception's underlying pattern-of-reasoning category. */
export function classifyMisconception(text: string): MisconceptionClassifierResult {
  if (!weights || !wordSpace || !charSpace) return heuristic(text);

  const x = buildFeatureVector(text, wordSpace, charSpace);
  const logits = weights.coef.map((row, k) => {
    let z = weights!.intercept[k];
    for (let i = 0; i < row.length; i++) z += row[i] * x[i];
    return z;
  });
  const probs = softmax(logits);
  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;

  return {
    category: weights.classes[bestIdx],
    confidence: probs[bestIdx],
    usedTrainedModel: true,
  };
}
