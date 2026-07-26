"""
Feature extraction for the Lucid scorer.

CRITICAL: this file is the Python mirror of lib/ml/scoring.ts + lib/ml/features.ts.
Every constant and every rule here must match the TypeScript runtime, or the
weights trained on these features will not transfer to inference.

If you change a threshold in scoring.ts, change it here too.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import numpy as np

# ---- FEATURE CONTRACT — must match FEATURE_ORDER in lib/ml/features.ts ----
FEATURE_ORDER = [
    "coverage",
    "mean_node_similarity",
    "textbook_similarity",
    "trigram_overlap",
    "length_ratio",
    "contradiction_ratio",
    "entailment_ratio",
    "misconception_similarity",
    # Distribution-shape features over per-node similarity — good vs partial
    # is a coverage-COUNT distinction ("misses 2-3 ideas"), which the
    # weight-blurred `coverage` and averaged `mean_node_similarity` above
    # both wash out. These expose the shape directly, at no extra model-call
    # cost (derived from the same per-node similarity vector).
    "covered_node_fraction",
    "min_node_similarity",
    "weakest_two_mean",
    "median_node_similarity",
    "node_similarity_std",
    "uncovered_node_count_norm",
    "max_similarity_gap",
    "sim_p25",
]

# ---- Thresholds — must match lib/ml/scoring.ts ----
COVERAGE_THRESHOLD = 0.55
CONTRADICTION_THRESHOLD = 0.8
ENTAILMENT_THRESHOLD = 0.6
RELATED_SIM_THRESHOLD = 0.45
TOP_FACTS_PER_SEGMENT = 1
MISCONCEPTION_SIM_THRESHOLD = 0.45
MISCONCEPTION_ENTAIL_THRESHOLD = 0.6
MIN_SEGMENT_LEN = 4
MIN_SEGMENT_WORDS = 4

_ROOT = Path(__file__).resolve().parent.parent
CONCEPTS_DIR = _ROOT / "lib" / "concepts"
# Concept maps auto-generated for arbitrary topics at runtime. Including them
# here means the training set grows in TOPIC DIVERSITY as the app is used,
# which is what actually drives cross-topic generalization.
GENERATED_DIR = _ROOT / ".cache" / "concepts"

# Mirrors the clause regex in scoring.ts (";" / em-dash / "--" /
# ", and|but|while|whereas" / " because|so that|therefore ").
_CLAUSE_RE = re.compile(
    r"\s*(?:;|—|--|,\s+(?:and|but|while|whereas)\s+|\s+(?:because|so that|therefore)\s+)\s*",
    re.IGNORECASE,
)
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+|\n+")


def load_concepts(include_generated: bool = True) -> dict[str, dict[str, Any]]:
    """Load the same concept JSONs the app uses — single source of truth."""
    concepts: dict[str, dict[str, Any]] = {}
    dirs = [CONCEPTS_DIR] + ([GENERATED_DIR] if include_generated else [])
    for directory in dirs:
        if not directory.exists():
            continue
        for path in sorted(directory.glob("*.json")):
            with open(path, encoding="utf-8") as f:
                c = json.load(f)
            # Curated maps are loaded first and win on id collision.
            concepts.setdefault(c["id"], c)
    if not concepts:
        raise FileNotFoundError(f"No concept JSONs found in {CONCEPTS_DIR}")
    return concepts


def segment(explanation: str) -> list[str]:
    """Mirror of segment() in scoring.ts."""
    sentences = _SENTENCE_RE.split(re.sub(r"\s+", " ", explanation))
    clauses: list[str] = []
    for sentence in sentences:
        for part in _CLAUSE_RE.split(sentence):
            t = part.strip().strip(",;:").strip()
            if len(t) < MIN_SEGMENT_LEN:
                continue
            if len(t.split()) < MIN_SEGMENT_WORDS and clauses:
                clauses[-1] = f"{clauses[-1]} {t}"
            else:
                clauses.append(t)
    cleaned = [c for c in clauses if len(c.split()) >= MIN_SEGMENT_WORDS or len(clauses) == 1]
    return cleaned if cleaned else [explanation.strip()]


def _words(text: str) -> list[str]:
    return [w for w in re.sub(r"[^a-z0-9\s]", " ", text.lower()).split() if w]


def _trigrams(text: str) -> set[str]:
    w = _words(text)
    return {" ".join(w[i : i + 3]) for i in range(len(w) - 2)}


def max_trigram_overlap(explanation: str, phrasings: list[str]) -> float:
    """Containment of each textbook phrasing's trigrams inside the explanation."""
    exp = _trigrams(explanation)
    if not exp:
        return 0.0
    best = 0.0
    for p in phrasings:
        pg = _trigrams(p)
        if not pg:
            continue
        best = max(best, len(pg & exp) / len(pg))
    return best


class FeatureExtractor:
    """Holds the embedding + NLI models and computes the 8-feature vector."""

    def __init__(self, embed_model: str = "sentence-transformers/all-MiniLM-L6-v2"):
        from sentence_transformers import SentenceTransformer
        from transformers import (
            AutoModelForSequenceClassification,
            AutoTokenizer,
        )
        import torch

        self.torch = torch
        self.embedder = SentenceTransformer(embed_model)

        nli_name = "cross-encoder/nli-deberta-v3-xsmall"
        self.nli_tok = AutoTokenizer.from_pretrained(nli_name)
        self.nli = AutoModelForSequenceClassification.from_pretrained(nli_name)
        self.nli.eval()
        # Read the label order from the config rather than hardcoding it.
        self.id2label = {int(k): v.lower() for k, v in self.nli.config.id2label.items()}

        self._concept_cache: dict[str, dict[str, np.ndarray]] = {}

    def encode(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, 384), dtype=np.float32)
        return self.embedder.encode(texts, normalize_embeddings=True, show_progress_bar=False)

    def _concept_vectors(self, concept: dict[str, Any]) -> dict[str, np.ndarray]:
        cid = concept["id"]
        if cid not in self._concept_cache:
            self._concept_cache[cid] = {
                "nodes": self.encode([n["text"] for n in concept["nodes"]]),
                "textbook": self.encode(concept["textbookPhrasings"]),
                "facts": self.encode(concept["referenceFacts"]),
                "misconceptions": self.encode(concept["misconceptions"]),
            }
        return self._concept_cache[cid]

    def nli_pair(self, premise: str, hypothesis: str) -> dict[str, float]:
        with self.torch.no_grad():
            inputs = self.nli_tok(
                premise, hypothesis, return_tensors="pt", truncation=True, padding=True
            )
            logits = self.nli(**inputs).logits[0]
            probs = self.torch.softmax(logits, dim=-1).tolist()
        out = {"entailment": 0.0, "neutral": 0.0, "contradiction": 0.0}
        for i, p in enumerate(probs):
            label = self.id2label.get(i, "")
            if "entail" in label:
                out["entailment"] = p
            elif "contradict" in label:
                out["contradiction"] = p
            else:
                out["neutral"] = p
        return out

    def extract(self, concept: dict[str, Any], explanation: str) -> dict[str, float]:
        """Compute the 8 features. Mirrors runAnalysis() in scoring.ts."""
        segments = segment(explanation)
        cv = self._concept_vectors(concept)
        seg_vecs = self.encode(segments)

        # --- coverage ---
        node_sims = seg_vecs @ cv["nodes"].T  # [n_segments, n_nodes]
        best_per_node = node_sims.max(axis=0) if len(segments) else np.zeros(len(concept["nodes"]))
        coverage = float(
            sum(
                node["weight"]
                for node, sim in zip(concept["nodes"], best_per_node)
                if sim >= COVERAGE_THRESHOLD
            )
        )
        mean_node_similarity = float(best_per_node.mean()) if len(best_per_node) else 0.0

        # --- Parrot Detector: semantic AND n-gram ---
        textbook_similarity = float((seg_vecs @ cv["textbook"].T).max()) if len(segments) else 0.0
        trigram_overlap = max_trigram_overlap(explanation, concept["textbookPhrasings"])

        ref_len = float(
            np.mean([len(_words(p)) for p in concept["textbookPhrasings"]]) or 1.0
        )
        length_ratio = min(len(_words(explanation)) / max(1.0, ref_len), 2.0) / 2.0

        misconception_similarity = (
            float((seg_vecs @ cv["misconceptions"].T).max()) if len(segments) else 0.0
        )

        # --- NLI correctness, gated by relatedness (same rule as scoring.ts) ---
        fact_sims = seg_vecs @ cv["facts"].T  # [n_segments, n_facts]
        contradictions = 0
        entailments = 0
        for si, seg in enumerate(segments):
            order = np.argsort(-fact_sims[si])[:TOP_FACTS_PER_SEGMENT]
            found_contradiction = False
            for fi in order:
                if fact_sims[si][fi] < RELATED_SIM_THRESHOLD:
                    continue
                scores = self.nli_pair(seg, concept["referenceFacts"][fi])
                if scores["entailment"] >= ENTAILMENT_THRESHOLD:
                    entailments += 1
                if scores["contradiction"] > CONTRADICTION_THRESHOLD:
                    found_contradiction = True

            # A segment entailing a known misconception is also wrong.
            if not found_contradiction and concept["misconceptions"]:
                mis_sims = seg_vecs[si] @ cv["misconceptions"].T
                mi = int(np.argmax(mis_sims))
                if mis_sims[mi] >= MISCONCEPTION_SIM_THRESHOLD:
                    s = self.nli_pair(seg, concept["misconceptions"][mi])
                    if s["entailment"] >= MISCONCEPTION_ENTAIL_THRESHOLD:
                        found_contradiction = True

            if found_contradiction:
                contradictions += 1

        n = max(1, len(segments))

        # --- distribution-shape features over best_per_node ---
        n_nodes = max(1, len(best_per_node))
        sorted_sims = np.sort(best_per_node) if len(best_per_node) else np.zeros(1)
        gaps = np.diff(sorted_sims) if len(sorted_sims) > 1 else np.array([0.0])

        return {
            "coverage": coverage,
            "mean_node_similarity": mean_node_similarity,
            "textbook_similarity": textbook_similarity,
            "trigram_overlap": trigram_overlap,
            "length_ratio": length_ratio,
            "contradiction_ratio": contradictions / n,
            "entailment_ratio": entailments / n,
            "misconception_similarity": misconception_similarity,
            "covered_node_fraction": float((best_per_node >= COVERAGE_THRESHOLD).sum() / n_nodes),
            "min_node_similarity": float(sorted_sims[0]),
            "weakest_two_mean": float(sorted_sims[: min(2, len(sorted_sims))].mean()),
            "median_node_similarity": float(np.median(best_per_node)) if len(best_per_node) else 0.0,
            "node_similarity_std": float(best_per_node.std()) if len(best_per_node) else 0.0,
            "uncovered_node_count_norm": float((best_per_node < COVERAGE_THRESHOLD).sum() / n_nodes),
            "max_similarity_gap": float(gaps.max()),
            "sim_p25": float(np.percentile(best_per_node, 25)) if len(best_per_node) else 0.0,
        }

    def extract_matrix(self, rows: list[tuple[dict[str, Any], str]]) -> np.ndarray:
        from tqdm import tqdm

        out = []
        for concept, explanation in tqdm(rows, desc="features"):
            f = self.extract(concept, explanation)
            out.append([f[name] for name in FEATURE_ORDER])
        return np.array(out, dtype=np.float64)
