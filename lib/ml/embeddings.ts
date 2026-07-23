/**
 * transformers.js wrappers. Models are heavy, so every pipeline is a
 * module-level singleton — the first call warms up (a few seconds while the
 * model downloads/loads), and every call after that is fast.
 *
 * SERVER-SIDE ONLY. Never import this from a client component.
 */
import {
  pipeline,
  AutoTokenizer,
  AutoModelForSequenceClassification,
  env,
  type FeatureExtractionPipeline,
  type PreTrainedTokenizer,
  type PreTrainedModel,
} from "@xenova/transformers";

// Download models from the HF hub and cache to disk (default cache dir).
env.allowLocalModels = false;

const EMBED_MODEL = "Xenova/all-MiniLM-L6-v2";
const NLI_MODEL = "Xenova/nli-deberta-v3-xsmall";

// ---------- Embedder ----------

let embedderPromise: Promise<FeatureExtractionPipeline> | null = null;

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedderPromise) {
    embedderPromise = pipeline(
      "feature-extraction",
      EMBED_MODEL,
    ) as Promise<FeatureExtractionPipeline>;
  }
  return embedderPromise;
}

/**
 * Embed an array of texts into L2-normalized mean-pooled vectors.
 * Returns number[][] (one vector per input).
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getEmbedder();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  // output is a Tensor of shape [n, dim]
  return output.tolist() as number[][];
}

/** Cosine similarity of two L2-normalized vectors (== dot product). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// ---------- NLI cross-encoder ----------

interface NliBundle {
  tokenizer: PreTrainedTokenizer;
  model: PreTrainedModel;
  id2label: Record<string, string>;
}

let nliPromise: Promise<NliBundle> | null = null;

function getNli(): Promise<NliBundle> {
  if (!nliPromise) {
    nliPromise = (async () => {
      const [tokenizer, model] = await Promise.all([
        AutoTokenizer.from_pretrained(NLI_MODEL),
        AutoModelForSequenceClassification.from_pretrained(NLI_MODEL),
      ]);
      // Read the label mapping from the model config so we never hardcode a
      // wrong order (cross-encoder NLI models vary in label ordering).
      const cfg = (model as unknown as { config: { id2label?: Record<string, string> } })
        .config;
      const id2label = cfg.id2label ?? {
        "0": "contradiction",
        "1": "entailment",
        "2": "neutral",
      };
      return { tokenizer, model, id2label };
    })();
  }
  return nliPromise;
}

export interface NliScores {
  entailment: number;
  neutral: number;
  contradiction: number;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((s, e) => s + e, 0);
  return exps.map((e) => e / sum);
}

/**
 * Run NLI for a single (premise, hypothesis) pair.
 * premise = the student's statement, hypothesis = a reference fact.
 */
export async function nliPair(
  premise: string,
  hypothesis: string,
): Promise<NliScores> {
  const { tokenizer, model, id2label } = await getNli();
  const inputs = tokenizer(premise, {
    text_pair: hypothesis,
    padding: true,
    truncation: true,
  });
  const output = (await model(inputs)) as { logits: { data: Float32Array | number[] } };
  const logits = Array.from(output.logits.data as ArrayLike<number>);
  const probs = softmax(logits);

  const scores: NliScores = { entailment: 0, neutral: 0, contradiction: 0 };
  for (let i = 0; i < probs.length; i++) {
    const label = (id2label[String(i)] ?? "").toLowerCase();
    if (label.includes("entail")) scores.entailment = probs[i];
    else if (label.includes("contradict")) scores.contradiction = probs[i];
    else scores.neutral = probs[i];
  }
  return scores;
}

/** Warm up both models (used by the GET /api/analyze warmup handler). */
export async function warmup(): Promise<void> {
  await Promise.all([
    embed(["warming up the embedder"]),
    nliPair("The sky is blue.", "The sky has a color."),
  ]);
}
