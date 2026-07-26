"""
Feature-engineering experiment for the Grasp Score classifier.

Extraction (MiniLM + NLI over every sample) is the slow part, so this
computes an EXTENDED feature set once, caches the matrix to .npz, and then
model/feature-subset selection can be iterated on in seconds.

Motivation: the weakest class is `partial` (0.76 F1). generate_data.py
defines partial as "MISSES 2-3 of the key ideas entirely" — but the current
8 features expose only `mean_node_similarity` and a weight-blurred
`coverage`, and BOTH average that signal away. A single badly-missed node
disappears into the mean. The added features below expose the shape of the
per-node similarity distribution (its worst end especially), which is
exactly where good/partial differ.

All new features are derived from `best_per_node`, which the extractor
already computes — no extra model calls, so runtime inference cost is
unchanged.

Usage:
    python experiment_features.py --extract    # slow, run once
    python experiment_features.py              # fast, iterate on models
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
SAMPLES = HERE / "samples.csv"
CACHE = HERE / ".feature_cache.npz"

BASE_FEATURES = [
    "coverage",
    "mean_node_similarity",
    "textbook_similarity",
    "trigram_overlap",
    "length_ratio",
    "contradiction_ratio",
    "entailment_ratio",
    "misconception_similarity",
]

# Distribution-shape features over per-node similarity — the good/partial signal.
EXTRA_FEATURES = [
    "covered_node_fraction",  # unweighted COUNT fraction of nodes covered
    "min_node_similarity",  # the single worst-reached node
    "weakest_two_mean",  # mean of the 2 worst nodes ("missed 2-3 ideas")
    "median_node_similarity",  # robust centre, unlike the mean
    "node_similarity_std",  # spread: partial answers are uneven
    "uncovered_node_count_norm",  # how many nodes fell below threshold
    # A `partial` explanation omits specific ideas, so its sorted similarity
    # profile has a CLIFF (covered ~0.8, omitted ~0.3). A `good` one is
    # uniformly high with no cliff. These two measure that directly.
    "max_similarity_gap",  # largest jump between consecutive sorted sims
    "sim_p25",  # 25th percentile — the "bottom quarter" of nodes
]

ALL_FEATURES = BASE_FEATURES + EXTRA_FEATURES


def extract() -> None:
    """Run the full extraction once and cache the extended feature matrix."""
    from tqdm import tqdm
    from features import (
        COVERAGE_THRESHOLD,
        FeatureExtractor,
        load_concepts,
    )

    df = pd.read_csv(SAMPLES).dropna(subset=["explanation", "label"])
    df = df[df.label.isin(["good", "partial", "memorized", "wrong"])].reset_index(drop=True)
    print(f"Loaded {len(df)} samples")

    concepts = load_concepts()
    extractor = FeatureExtractor()

    rows: list[list[float]] = []
    for cid, text in tqdm(list(zip(df.concept_id, df.explanation)), desc="features"):
        concept = concepts[cid]
        base = extractor.extract(concept, text)

        # Recompute the per-node similarity vector (cheap: vectors are cached
        # inside the extractor, so this is a matmul, not a model call).
        cv = extractor._concept_vectors(concept)
        from features import segment as seg_fn

        segments = seg_fn(text)
        seg_vecs = extractor.encode(segments)
        node_sims = seg_vecs @ cv["nodes"].T
        best_per_node = (
            node_sims.max(axis=0) if len(segments) else np.zeros(len(concept["nodes"]))
        )
        sorted_sims = np.sort(best_per_node)
        n_nodes = max(1, len(best_per_node))

        gaps = np.diff(sorted_sims) if len(sorted_sims) > 1 else np.array([0.0])
        extra = {
            "covered_node_fraction": float((best_per_node >= COVERAGE_THRESHOLD).sum() / n_nodes),
            "min_node_similarity": float(sorted_sims[0]),
            "weakest_two_mean": float(sorted_sims[: min(2, len(sorted_sims))].mean()),
            "median_node_similarity": float(np.median(best_per_node)),
            "node_similarity_std": float(best_per_node.std()),
            "uncovered_node_count_norm": float(
                (best_per_node < COVERAGE_THRESHOLD).sum() / n_nodes
            ),
            "max_similarity_gap": float(gaps.max()),
            "sim_p25": float(np.percentile(best_per_node, 25)),
        }
        merged = {**base, **extra}
        rows.append([merged[name] for name in ALL_FEATURES])

    X = np.array(rows, dtype=np.float64)
    y = df.label.to_numpy()
    groups = df.concept_id.to_numpy()
    np.savez(CACHE, X=X, y=y, groups=groups, feature_names=np.array(ALL_FEATURES))
    print(f"Cached {X.shape} -> {CACHE}")


def evaluate() -> None:
    from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import classification_report
    from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    if not CACHE.exists():
        raise SystemExit("No cache — run with --extract first.")

    data = np.load(CACHE, allow_pickle=True)
    X_all, y = data["X"], data["y"]
    names = list(data["feature_names"])
    base_idx = [names.index(f) for f in BASE_FEATURES]
    all_idx = list(range(len(names)))

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    def run(tag: str, idx: list[int], model) -> float:
        accs, cvs = [], []
        for seed in [0, 7, 21, 42, 99]:
            Xtr, Xte, ytr, yte = train_test_split(
                X_all[:, idx], y, test_size=0.25, random_state=seed, stratify=y
            )
            model.fit(Xtr, ytr)
            accs.append(model.score(Xte, yte))
            if seed == 42:
                cvs = cross_val_score(model, Xtr, ytr, cv=cv, scoring="accuracy")
        print(
            f"{tag:<46} held-out mean={np.mean(accs):.4f} min={np.min(accs):.4f} "
            f"max={np.max(accs):.4f}  cv={np.mean(cvs):.4f}"
        )
        return float(np.mean(accs))

    def lr():
        return make_pipeline(StandardScaler(), LogisticRegression(max_iter=3000, C=1.0, random_state=42))

    def gbm():
        return make_pipeline(StandardScaler(), GradientBoostingClassifier(random_state=42))

    def rf():
        return make_pipeline(
            StandardScaler(),
            RandomForestClassifier(n_estimators=400, min_samples_leaf=2, random_state=42),
        )

    print("=" * 100)
    print("BASELINE — original 8 features")
    print("=" * 100)
    run("LogisticRegression / 8 base features", base_idx, lr())
    run("GradientBoosting   / 8 base features", base_idx, gbm())

    print()
    print("=" * 100)
    print("EXTENDED — 8 base + 6 distribution-shape features")
    print("=" * 100)
    run("LogisticRegression / 14 features", all_idx, lr())
    best_gbm = run("GradientBoosting   / 14 features", all_idx, gbm())
    run("RandomForest       / 14 features", all_idx, rf())

    # Detailed report for the strongest configuration.
    print()
    print("=" * 100)
    print("Per-class detail — GradientBoosting / 14 features (seed 42)")
    print("=" * 100)
    Xtr, Xte, ytr, yte = train_test_split(
        X_all, y, test_size=0.25, random_state=42, stratify=y
    )
    m = gbm()
    m.fit(Xtr, ytr)
    print(classification_report(yte, m.predict(Xte), zero_division=0))
    print(f"(mean held-out across seeds for this config: {best_gbm:.4f})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--extract", action="store_true")
    args = ap.parse_args()
    if args.extract:
        extract()
    else:
        evaluate()
