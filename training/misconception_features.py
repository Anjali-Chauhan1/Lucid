"""
Feature extraction for the misconception-category classifier.

CRITICAL: this file is the Python mirror of lib/ml/misconceptionFeatures.ts.
Every regex, constant, and formula here must match the TypeScript runtime
exactly, or the weights trained here will not transfer to inference. This
deliberately does NOT use sklearn's TfidfVectorizer — a hand-rolled TF-IDF
is simple enough to reimplement identically in TS with zero drift risk, and
it needs no embedding model at runtime (pure regex + dict lookup + a linear
layer), which is why classification is sub-millisecond.
"""
from __future__ import annotations

import math
import re
from collections import Counter

WORD_RE = re.compile(r"[a-z0-9]{2,}")
CHAR_NGRAM_SIZES = (3, 4, 5)

DEF_CUES = [
    r"is defined as", r"\bis any\b", r"is a type of", r"\bmeans that\b", r"refers to",
    r"is measured from", r"is characterized by", r"counts as", r"is essentially",
    r"\bis simply\b", r"is classified as",
]
FLOW_CUES = [
    r"\bflows?\b", r"absorbs?", r"releases?", r"produces?", r"produced by", r"converts?",
    r"\bintake\b", r"\boutputs?\b", r"\binput\b", r"breathe[s]? (in|out)", r"takes? in",
    r"gives? off", r"emits?", r"secretes?", r"excretes?", r"\binto\b", r"\bout of\b",
]
CUE_WEIGHT = 3.0


def word_tokens(text: str) -> list[str]:
    return WORD_RE.findall(text.lower())


def word_ngrams(tokens: list[str]) -> list[str]:
    """Unigrams + bigrams, joined the way scikit-learn joins them (single space)."""
    grams = list(tokens)
    for i in range(len(tokens) - 1):
        grams.append(f"{tokens[i]} {tokens[i + 1]}")
    return grams


def char_ngrams(text: str) -> list[str]:
    """char_wb-style: pad each word with one space on each side, slide 3-5 char windows."""
    grams: list[str] = []
    for w in WORD_RE.findall(text.lower()):
        padded = f" {w} "
        for n in CHAR_NGRAM_SIZES:
            if len(padded) < n:
                continue
            for i in range(len(padded) - n + 1):
                grams.append(padded[i : i + n])
    return grams


def cue_counts(text: str) -> tuple[float, float]:
    tl = text.lower()
    definition = sum(len(re.findall(p, tl)) for p in DEF_CUES)
    flow = sum(len(re.findall(p, tl)) for p in FLOW_CUES)
    return definition * CUE_WEIGHT, flow * CUE_WEIGHT


class TfidfSpace:
    """A minimal, from-scratch TF-IDF vectorizer over a fixed vocabulary."""

    def __init__(self, vocab: list[str], idf: list[float]):
        self.vocab = vocab
        self.index = {t: i for i, t in enumerate(vocab)}
        self.idf = idf

    @classmethod
    def fit(cls, docs_grams: list[list[str]], min_df: int, max_features: int) -> "TfidfSpace":
        df: Counter[str] = Counter()
        for grams in docs_grams:
            df.update(set(grams))
        n_docs = len(docs_grams)
        candidates = [(t, c) for t, c in df.items() if c >= min_df]
        # sklearn's max_features selection: keep the highest document-frequency terms.
        candidates.sort(key=lambda x: (-x[1], x[0]))
        candidates = candidates[:max_features]
        vocab = sorted(t for t, _ in candidates)
        idf = [math.log((1 + n_docs) / (1 + df[t])) + 1.0 for t in vocab]
        return cls(vocab, idf)

    def transform_one(self, grams: list[str]) -> list[float]:
        counts = Counter(g for g in grams if g in self.index)
        vec = [0.0] * len(self.vocab)
        for term, count in counts.items():
            i = self.index[term]
            tf = 1.0 + math.log(count)  # sublinear_tf
            vec[i] = tf * self.idf[i]
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        return vec


def build_feature_vector(
    text: str, word_space: TfidfSpace, char_space: TfidfSpace
) -> list[float]:
    tokens = word_tokens(text)
    wv = word_space.transform_one(word_ngrams(tokens))
    cv = char_space.transform_one(char_ngrams(text))
    d1, d2 = cue_counts(text)
    return wv + cv + [d1, d2]
