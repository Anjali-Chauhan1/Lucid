/**
 * FEATURE CONTRACT — shared between the TS inference path and Python train.py.
 *
 * The order here MUST match FEATURE_ORDER in training/train.py exactly.
 * Adding/removing/reordering a feature requires retraining and regenerating
 * weights.json.
 */
export const FEATURE_ORDER = [
  "coverage", // weighted fraction of concept nodes covered (0..1)
  "mean_node_similarity", // mean best cosine similarity across nodes (0..1)
  "textbook_similarity", // max semantic similarity to any textbook phrasing (0..1)
  "trigram_overlap", // max word-trigram overlap with textbook phrasings (0..1)
  "length_ratio", // explanation length vs textbook length, normalized (0..1)
  "contradiction_ratio", // fraction of segments that contradict a reference fact (0..1)
  "entailment_ratio", // fraction of segments that entail a reference fact (0..1)
  "misconception_similarity", // max semantic similarity to a known misconception (0..1)
] as const;

export type FeatureName = (typeof FEATURE_ORDER)[number];

export type FeatureVector = Record<FeatureName, number>;

/** Turn a feature record into the ordered numeric array the model expects. */
export function toVector(f: FeatureVector): number[] {
  return FEATURE_ORDER.map((name) => f[name]);
}
