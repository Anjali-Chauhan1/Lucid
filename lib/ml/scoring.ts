/**
 * The scoring engine. Pure, deterministic, and independent of any LLM —
 * this is the product. Given a concept map and a student's explanation it
 * produces the full AnalysisReport (Grasp Score + gaps + wrong statements +
 * Parrot Detector signal + classifier label).
 */
import type {
  AnalysisReport,
  ConceptMap,
  CoveredNode,
  Gap,
  RattaSignal,
  ScoreDimensions,
  WhyQuestion,
  WrongStatement,
} from "@/lib/types";
import { cosine, embed, nliPair } from "./embeddings";
import { classify } from "./classifier";
import type { FeatureVector } from "./features";

/**
 * Cosine bar for calling a concept node "covered".
 *
 * Empirically tuned for all-MiniLM-L6-v2, where paraphrases land around
 * 0.6-0.8, merely-related sentences around 0.4-0.55, and unrelated text below
 * 0.3. A 0.45 bar marked Newton's third law as "covered" for an explanation
 * that never mentioned action-reaction at all, so the bar sits at 0.55.
 */
const COVERAGE_THRESHOLD = 0.55;
const CONTRADICTION_THRESHOLD = 0.8;
const ENTAILMENT_THRESHOLD = 0.6;
const MAX_NLI_PAIRS = 60;

/**
 * NLI is only run on pairs that are actually ABOUT the same thing.
 *
 * A cross-encoder will happily report "contradiction" with 0.99 confidence for
 * two unrelated true sentences (e.g. "oxygen is released" vs "glucose stores
 * chemical energy"), because it was trained on same-scene premise/hypothesis
 * pairs. Gating by embedding similarity removes those false positives and cuts
 * the pair count at the same time.
 */
const RELATED_SIM_THRESHOLD = 0.45;
/**
 * Compare each claim only against the fact it most closely matches. Testing a
 * claim about oxygen against the glucose fact is what produced false
 * contradictions — the pair is topical but not co-referential.
 */
const TOP_FACTS_PER_SEGMENT = 1;
/** A segment that ENTAILS a known misconception is a wrong statement. */
const MISCONCEPTION_SIM_THRESHOLD = 0.45;
const MISCONCEPTION_ENTAIL_THRESHOLD = 0.6;
const MIN_SEGMENT_LEN = 4;
/**
 * A clause must carry at least this many words to stand alone. Anything
 * shorter is merged back into its neighbour — otherwise we hand the NLI model
 * fragments like "oxygen." or "green plants", which produce meaningless
 * entailment/contradiction scores.
 */
const MIN_SEGMENT_WORDS = 4;

// ---------- Segmentation ----------

/**
 * Split an explanation into scoreable idea-units.
 *
 * Sentences first, then only on STRONG clause boundaries. We deliberately do
 * not split on a bare " and ", because that shreds noun phrases such as
 * "carbon dioxide and water" into fragments that destroy downstream NLI.
 */
export function segment(explanation: string): string[] {
  const sentences = explanation
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/g);

  const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

  const clauses: string[] = [];
  for (const sentence of sentences) {
    const parts = sentence.split(
      // ; — --  |  ", and/but/while/whereas"  |  " because / so that / therefore "
      // NOTE: ", which" is deliberately excluded — splitting there strands a
      // dangling relative clause ("is the sugar the plant stores as food").
      /\s*(?:;|—|--|,\s+(?:and|but|while|whereas)\s+|\s+(?:because|so that|therefore)\s+)\s*/gi,
    );

    for (const part of parts) {
      const t = part.trim().replace(/^[,;:]+|[,;:]+$/g, "").trim();
      if (t.length < MIN_SEGMENT_LEN) continue;

      // Merge too-short clauses into the previous segment rather than
      // emitting a meaningless fragment.
      if (wordCount(t) < MIN_SEGMENT_WORDS && clauses.length > 0) {
        clauses[clauses.length - 1] = `${clauses[clauses.length - 1]} ${t}`;
      } else {
        clauses.push(t);
      }
    }
  }

  // Drop any leading fragment that never found a neighbour to merge with.
  const cleaned = clauses.filter(
    (c) => wordCount(c) >= MIN_SEGMENT_WORDS || clauses.length === 1,
  );

  return cleaned.length > 0 ? cleaned : [explanation.trim()];
}

// ---------- n-gram overlap (Parrot Detector, signal 2) ----------

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function trigrams(text: string): Set<string> {
  const w = words(text);
  const grams = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) grams.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return grams;
}

/** Max containment of any textbook phrasing's trigrams inside the explanation. */
function maxTrigramOverlap(explanation: string, phrasings: string[]): number {
  const exp = trigrams(explanation);
  if (exp.size === 0) return 0;
  let max = 0;
  for (const p of phrasings) {
    const pg = trigrams(p);
    if (pg.size === 0) continue;
    let common = 0;
    for (const g of pg) if (exp.has(g)) common++;
    max = Math.max(max, common / pg.size);
  }
  return max;
}

// ---------- Score composition ----------

/**
 * Compose the 0..100 Grasp Score.
 *
 * Weights are coverage 0.5 / correctness 0.3 / depth 0.2. A dimension that is
 * null (not measured) is dropped and the remaining weights are renormalized —
 * never substituted with a full mark, which would silently inflate the score.
 */
export function composeScore(d: ScoreDimensions): number {
  const parts: [number | null, number][] = [
    [d.coverage, 0.5],
    [d.correctness, 0.3],
    [d.depth, 0.2],
  ];
  let weighted = 0;
  let totalWeight = 0;
  for (const [value, weight] of parts) {
    if (value === null) continue;
    weighted += value * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round((weighted / totalWeight) * 100);
}

// ---------- Depth (causal why-questions) ----------

/**
 * Score depth from answers to why-questions: mean cosine similarity between
 * each answer and the question's expected idea.
 */
export async function scoreDepth(
  whyQuestions: WhyQuestion[],
  answers: { index: number; answer: string }[],
): Promise<number | null> {
  const valid = answers.filter(
    (a) => a.answer.trim().length >= MIN_SEGMENT_LEN && whyQuestions[a.index],
  );
  if (valid.length === 0) return null;

  const ideaVecs = await embed(valid.map((a) => whyQuestions[a.index].expectedIdea));
  const ansVecs = await embed(valid.map((a) => a.answer));
  let sum = 0;
  for (let i = 0; i < valid.length; i++) {
    // map cosine (~0.2..0.85 useful range) to a 0..1 depth signal
    const sim = cosine(ansVecs[i], ideaVecs[i]);
    sum += Math.max(0, Math.min(1, (sim - 0.2) / 0.55));
  }
  return sum / valid.length;
}

// ---------- Main pipeline ----------

export async function runAnalysis(
  concept: ConceptMap,
  explanation: string,
  whyAnswers?: { index: number; answer: string }[],
): Promise<AnalysisReport> {
  const timings: Record<string, number> = {};
  const degraded: string[] = [];
  const t = (k: string, start: number) => {
    timings[k] = Math.round(performance.now() - start);
  };

  // 1. Segment
  let s = performance.now();
  const segments = segment(explanation);
  t("segment", s);

  // 2. Embed segments + nodes
  s = performance.now();
  const nodeTexts = concept.nodes.map((n) => n.text);
  const [segVecs, nodeVecs, textbookVecs, misconceptionVecs, factVecs] =
    await Promise.all([
      embed(segments),
      embed(nodeTexts),
      embed(concept.textbookPhrasings),
      embed(concept.misconceptions),
      embed(concept.referenceFacts),
    ]);
  t("embed", s);

  // 3. Coverage
  s = performance.now();
  const covered: CoveredNode[] = [];
  const gaps: Gap[] = [];
  let coverageScore = 0;
  let nodeSimSum = 0;
  concept.nodes.forEach((node, i) => {
    let best = 0;
    for (const sv of segVecs) best = Math.max(best, cosine(sv, nodeVecs[i]));
    nodeSimSum += best;
    if (best >= COVERAGE_THRESHOLD) {
      coverageScore += node.weight;
      covered.push({ nodeId: node.id, nodeText: node.text, similarity: best });
    } else {
      gaps.push({ nodeId: node.id, nodeText: node.text, bestSimilarity: best });
    }
  });
  const meanNodeSimilarity = nodeSimSum / Math.max(1, concept.nodes.length);
  t("coverage", s);

  // 4. Parrot Detector features
  s = performance.now();
  let textbookSimilarity = 0;
  for (const sv of segVecs) {
    for (const tv of textbookVecs) textbookSimilarity = Math.max(textbookSimilarity, cosine(sv, tv));
  }
  const ngramOverlap = maxTrigramOverlap(explanation, concept.textbookPhrasings);
  const refLen =
    concept.textbookPhrasings.reduce((sum, p) => sum + words(p).length, 0) /
    Math.max(1, concept.textbookPhrasings.length);
  const lengthRatio = Math.min(words(explanation).length / Math.max(1, refLen), 2) / 2;
  const ratta: RattaSignal = {
    flag: textbookSimilarity > 0.72 && ngramOverlap > 0.28,
    similarity: textbookSimilarity,
    ngramOverlap,
  };
  t("ratta", s);

  // 5. Misconception similarity
  let misconceptionSimilarity = 0;
  for (const sv of segVecs) {
    for (const mv of misconceptionVecs)
      misconceptionSimilarity = Math.max(misconceptionSimilarity, cosine(sv, mv));
  }

  // 6. NLI correctness — collect contradictions vs reference facts
  s = performance.now();
  const wrongStatements: WrongStatement[] = [];
  let contradictionCount = 0;
  let entailmentCount = 0;
  let pairsRun = 0;
  let correctness = 1;
  try {
    for (let si = 0; si < segments.length; si++) {
      const seg = segments[si];
      let segEntails = false;
      let bestContradiction: { fact: string; score: number } | null = null;

      // Only compare this segment against the facts it is actually about.
      const related = concept.referenceFacts
        .map((fact, fi) => ({ fact, sim: cosine(segVecs[si], factVecs[fi]) }))
        .filter((r) => r.sim >= RELATED_SIM_THRESHOLD)
        .sort((a, b) => b.sim - a.sim)
        .slice(0, TOP_FACTS_PER_SEGMENT);

      for (const { fact } of related) {
        if (pairsRun >= MAX_NLI_PAIRS) break;
        const scores = await nliPair(seg, fact);
        pairsRun++;
        if (scores.entailment >= ENTAILMENT_THRESHOLD) segEntails = true;
        if (
          scores.contradiction > CONTRADICTION_THRESHOLD &&
          (!bestContradiction || scores.contradiction > bestContradiction.score)
        ) {
          bestContradiction = { fact, score: scores.contradiction };
        }
      }

      // A segment that entails a known misconception is wrong even when it
      // contradicts no single reference fact.
      if (!bestContradiction && concept.misconceptions.length > 0) {
        let bestMis = { idx: -1, sim: 0 };
        concept.misconceptions.forEach((_, mi) => {
          const sim = cosine(segVecs[si], misconceptionVecs[mi]);
          if (sim > bestMis.sim) bestMis = { idx: mi, sim };
        });
        if (
          bestMis.idx >= 0 &&
          bestMis.sim >= MISCONCEPTION_SIM_THRESHOLD &&
          pairsRun < MAX_NLI_PAIRS
        ) {
          const scores = await nliPair(seg, concept.misconceptions[bestMis.idx]);
          pairsRun++;
          if (scores.entailment >= MISCONCEPTION_ENTAIL_THRESHOLD) {
            // Show the closest reference fact as the correction.
            let correction = concept.referenceFacts[0] ?? "";
            let bestSim = -1;
            concept.referenceFacts.forEach((f, fi) => {
              const sim = cosine(segVecs[si], factVecs[fi]);
              if (sim > bestSim) {
                bestSim = sim;
                correction = f;
              }
            });
            bestContradiction = { fact: correction, score: scores.entailment };
          }
        }
      }

      if (segEntails) entailmentCount++;
      if (bestContradiction) {
        contradictionCount++;
        wrongStatements.push({
          said: seg,
          contradicts: bestContradiction.fact,
          score: bestContradiction.score,
        });
      }
    }
    correctness = 1 - contradictionCount / Math.max(1, segments.length);
  } catch (err) {
    console.warn("[scoring] NLI failed, omitting correctness dimension:", err);
    degraded.push("nli");
  }
  t("nli", s);

  const contradictionRatio = contradictionCount / Math.max(1, segments.length);
  const entailmentRatio = entailmentCount / Math.max(1, segments.length);

  // 7. Classifier
  const features: FeatureVector = {
    coverage: coverageScore,
    mean_node_similarity: meanNodeSimilarity,
    textbook_similarity: textbookSimilarity,
    trigram_overlap: ngramOverlap,
    length_ratio: lengthRatio,
    contradiction_ratio: contradictionRatio,
    entailment_ratio: entailmentRatio,
    misconception_similarity: misconceptionSimilarity,
  };
  const cls = classify(features);

  // 8. Depth (optional, from why-answers)
  let depth: number | null = null;
  if (whyAnswers && whyAnswers.length > 0) {
    depth = await scoreDepth(concept.whyQuestions, whyAnswers);
  }

  const dimensions: ScoreDimensions = {
    coverage: coverageScore,
    // NLI failure omits the dimension entirely — composeScore renormalizes.
    correctness: degraded.includes("nli") ? null : correctness,
    depth,
  };

  const samajhScore = composeScore(dimensions);

  return {
    conceptId: concept.id,
    samajhScore,
    dimensions,
    gaps,
    coveredNodes: covered,
    wrongStatements: wrongStatements.sort((a, b) => b.score - a.score),
    ratta,
    classifierLabel: cls.label,
    confidence: cls.confidence,
    usedTrainedModel: cls.usedTrainedModel,
    timings,
    degraded,
  };
}
