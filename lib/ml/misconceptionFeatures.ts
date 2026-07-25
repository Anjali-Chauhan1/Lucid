/**
 * Feature extraction for the misconception-category classifier.
 *
 * CRITICAL: this file is the TypeScript mirror of
 * training/misconception_features.py. Every regex, constant, and formula
 * here must match the Python trainer exactly, or lib/ml/misconception-
 * weights.json will not transfer to inference.
 *
 * No embedding model involved by design: category is a pattern-of-phrasing
 * signal (see misconceptionCategory.ts for why), so this is pure regex +
 * dict lookup + a linear layer — sub-millisecond, no model download.
 */

const WORD_RE = /[a-z0-9]{2,}/g;
const CHAR_NGRAM_SIZES = [3, 4, 5];

const DEF_CUES = [
  /is defined as/g,
  /\bis any\b/g,
  /is a type of/g,
  /\bmeans that\b/g,
  /refers to/g,
  /is measured from/g,
  /is characterized by/g,
  /counts as/g,
  /is essentially/g,
  /\bis simply\b/g,
  /is classified as/g,
];
const FLOW_CUES = [
  /\bflows?\b/g,
  /absorbs?/g,
  /releases?/g,
  /produces?/g,
  /produced by/g,
  /converts?/g,
  /\bintake\b/g,
  /\boutputs?\b/g,
  /\binput\b/g,
  /breathe[s]? (in|out)/g,
  /takes? in/g,
  /gives? off/g,
  /emits?/g,
  /secretes?/g,
  /excretes?/g,
  /\binto\b/g,
  /\bout of\b/g,
];
const CUE_WEIGHT = 3.0;

export function wordTokens(text: string): string[] {
  return text.toLowerCase().match(WORD_RE) ?? [];
}

/** Unigrams + bigrams, joined the way scikit-learn joins them (single space). */
export function wordNgrams(tokens: string[]): string[] {
  const grams = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) grams.push(`${tokens[i]} ${tokens[i + 1]}`);
  return grams;
}

/** char_wb-style: pad each word with one space on each side, slide 3-5 char windows. */
export function charNgrams(text: string): string[] {
  const grams: string[] = [];
  const words = text.toLowerCase().match(WORD_RE) ?? [];
  for (const w of words) {
    const padded = ` ${w} `;
    for (const n of CHAR_NGRAM_SIZES) {
      if (padded.length < n) continue;
      for (let i = 0; i <= padded.length - n; i++) grams.push(padded.slice(i, i + n));
    }
  }
  return grams;
}

function countMatches(re: RegExp, text: string): number {
  re.lastIndex = 0;
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

export function cueCounts(text: string): [number, number] {
  const tl = text.toLowerCase();
  const definition = DEF_CUES.reduce((s, re) => s + countMatches(re, tl), 0);
  const flow = FLOW_CUES.reduce((s, re) => s + countMatches(re, tl), 0);
  return [definition * CUE_WEIGHT, flow * CUE_WEIGHT];
}

export interface TfidfSpace {
  vocab: string[];
  idf: number[];
}

/** Transform a bag of n-grams into an L2-normalized TF-IDF vector over `space`. */
export function transformTfidf(grams: string[], space: TfidfSpace): number[] {
  const index = new Map<string, number>();
  space.vocab.forEach((t, i) => index.set(t, i));

  const counts = new Map<number, number>();
  for (const g of grams) {
    const i = index.get(g);
    if (i === undefined) continue;
    counts.set(i, (counts.get(i) ?? 0) + 1);
  }

  const vec = new Array<number>(space.vocab.length).fill(0);
  for (const [i, count] of counts) {
    const tf = 1 + Math.log(count); // sublinear_tf
    vec[i] = tf * space.idf[i];
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

export function buildFeatureVector(
  text: string,
  wordSpace: TfidfSpace,
  charSpace: TfidfSpace,
): number[] {
  const tokens = wordTokens(text);
  const wv = transformTfidf(wordNgrams(tokens), wordSpace);
  const cv = transformTfidf(charNgrams(text), charSpace);
  const [d1, d2] = cueCounts(text);
  return [...wv, ...cv, d1, d2];
}
