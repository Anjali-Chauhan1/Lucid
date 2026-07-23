/**
 * Trained scorer inference in pure TypeScript.
 *
 * Reads lib/ml/weights.json (exported by training/train.py) and runs a
 * standardize -> linear -> softmax multinomial logistic regression.
 *
 * If weights.json is absent or malformed, we fall back to transparent
 * heuristic thresholds and log a warning. The rest of the report does not
 * depend on the trained model, so this degrades gracefully.
 */
import fs from "node:fs";
import path from "node:path";
import type { ClassifierLabel } from "@/lib/types";
import { FEATURE_ORDER, toVector, type FeatureVector } from "./features";

interface Weights {
  feature_order: string[];
  classes: ClassifierLabel[];
  // coef[classIndex][featureIndex]
  coef: number[][];
  intercept: number[];
  // StandardScaler params (optional; identity if absent)
  mean?: number[];
  scale?: number[];
}

/**
 * Load weights.json at runtime via fs (not a bundler `require`/`import`, which
 * would fail the build when the file is absent before training). Read from the
 * source tree relative to the project root.
 */
let weights: Weights | null = null;
let warned = false;
try {
  const weightsPath = path.join(process.cwd(), "lib", "ml", "weights.json");
  if (fs.existsSync(weightsPath)) {
    const loaded = JSON.parse(fs.readFileSync(weightsPath, "utf8")) as Weights;
    if (
      loaded &&
      Array.isArray(loaded.coef) &&
      Array.isArray(loaded.classes) &&
      Array.isArray(loaded.feature_order) &&
      loaded.feature_order.join(",") === FEATURE_ORDER.join(",")
    ) {
      weights = loaded;
      console.info("[classifier] loaded trained weights.json");
    } else {
      console.warn(
        "[classifier] weights.json feature_order mismatch — using heuristic fallback.",
      );
    }
  }
} catch (err) {
  console.warn("[classifier] could not load weights.json:", (err as Error).message);
}

function softmax(z: number[]): number[] {
  const max = Math.max(...z);
  const exps = z.map((v) => Math.exp(v - max));
  const sum = exps.reduce((s, e) => s + e, 0);
  return exps.map((e) => e / sum);
}

export interface ClassifierResult {
  label: ClassifierLabel;
  confidence: number;
  probabilities: Record<ClassifierLabel, number>;
  usedTrainedModel: boolean;
}

/** Transparent heuristic used when no trained weights are available. */
function heuristic(f: FeatureVector): ClassifierResult {
  if (!warned) {
    console.warn(
      "[classifier] weights.json not found — using heuristic fallback labels.",
    );
    warned = true;
  }

  const probs: Record<ClassifierLabel, number> = {
    good: 0,
    partial: 0,
    memorized: 0,
    wrong: 0,
  };

  // Wrong: contradicts facts or closely matches a misconception.
  const wrongScore = 0.6 * f.contradiction_ratio + 0.7 * f.misconception_similarity;
  // Memorized: the two-signal combo — high semantic AND high n-gram overlap.
  const memScore = Math.min(f.textbook_similarity, f.trigram_overlap + 0.15) *
    (f.textbook_similarity > 0.6 ? 1 : 0.4);
  // Good: strong coverage + own words (low copying) + no contradictions.
  const goodScore =
    0.6 * f.coverage +
    0.4 * f.mean_node_similarity -
    0.5 * f.contradiction_ratio -
    0.4 * f.misconception_similarity;
  // Partial: everything else / moderate coverage.
  const partialScore = 0.5 + 0.4 * (1 - f.coverage);

  probs.wrong = Math.max(0, wrongScore);
  probs.memorized = Math.max(0, memScore);
  probs.good = Math.max(0, goodScore);
  probs.partial = Math.max(0, partialScore);

  // Priority overrides so the heuristic is decisive and legible.
  //
  // Order matters. "memorized" is checked first because a recited answer is
  // usually also accurate and well-covered — the copying is the finding.
  // The misconception threshold is deliberately high: misconceptions are
  // topically near-identical to correct explanations, so raw similarity to one
  // is a weak signal on its own.
  let label: ClassifierLabel = "partial";
  if (f.textbook_similarity > 0.72 && f.trigram_overlap > 0.28) {
    label = "memorized";
  } else if (f.contradiction_ratio > 0.3 || f.misconception_similarity > 0.78) {
    label = "wrong";
  } else if (f.coverage >= 0.7 && f.mean_node_similarity >= 0.45) {
    label = "good";
  } else {
    label = "partial";
  }

  const total = probs.good + probs.partial + probs.memorized + probs.wrong || 1;
  (Object.keys(probs) as ClassifierLabel[]).forEach((k) => (probs[k] /= total));

  return {
    label,
    confidence: Math.min(0.95, Math.max(0.4, probs[label])),
    probabilities: probs,
    usedTrainedModel: false,
  };
}

export function classify(f: FeatureVector): ClassifierResult {
  if (!weights) return heuristic(f);

  const x = toVector(f);
  const mean = weights.mean ?? x.map(() => 0);
  const scale = weights.scale ?? x.map(() => 1);
  const standardized = x.map((v, i) => (v - mean[i]) / (scale[i] || 1));

  const logits = weights.coef.map((row, k) => {
    let z = weights!.intercept[k];
    for (let i = 0; i < row.length; i++) z += row[i] * standardized[i];
    return z;
  });

  const probs = softmax(logits);
  let bestIdx = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[bestIdx]) bestIdx = i;

  const probabilities = {
    good: 0,
    partial: 0,
    memorized: 0,
    wrong: 0,
  } as Record<ClassifierLabel, number>;
  weights.classes.forEach((c, i) => (probabilities[c] = probs[i]));

  return {
    label: weights.classes[bestIdx],
    confidence: probs[bestIdx],
    probabilities,
    usedTrainedModel: true,
  };
}
