"""Fast model sweep over the cached feature matrix (see experiment_features.py)."""
from __future__ import annotations

from pathlib import Path

import numpy as np
from sklearn.ensemble import (
    ExtraTreesClassifier,
    GradientBoostingClassifier,
    HistGradientBoostingClassifier,
    RandomForestClassifier,
    VotingClassifier,
)
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import PolynomialFeatures, StandardScaler

CACHE = Path(__file__).resolve().parent / ".feature_cache.npz"
SEEDS = [0, 7, 21, 42, 99]


def score(tag: str, make_model) -> tuple[str, float, float]:
    data = np.load(CACHE, allow_pickle=True)
    X, y = data["X"], data["y"]
    accs = []
    for seed in SEEDS:
        Xtr, Xte, ytr, yte = train_test_split(
            X, y, test_size=0.25, random_state=seed, stratify=y
        )
        m = make_model()
        m.fit(Xtr, ytr)
        accs.append(m.score(Xte, yte))
    mean, mn = float(np.mean(accs)), float(np.min(accs))
    print(f"{tag:<58} mean={mean:.4f}  min={mn:.4f}  max={np.max(accs):.4f}")
    return tag, mean, mn


def main() -> None:
    results = []

    print("---- linear (exportable to the current TS runtime) ----")
    for C in [0.5, 1.0, 3.0, 10.0]:
        results.append(
            score(
                f"LogisticRegression C={C}",
                lambda C=C: make_pipeline(
                    StandardScaler(), LogisticRegression(max_iter=5000, C=C, random_state=42)
                ),
            )
        )
    # Polynomial expansion keeps the MODEL linear in its inputs, so it is
    # still exportable as coef/intercept — the extra columns are just
    # products of existing features, computable in TS.
    for C in [1.0, 3.0]:
        results.append(
            score(
                f"LogReg + poly2 interactions C={C}",
                lambda C=C: make_pipeline(
                    PolynomialFeatures(degree=2, include_bias=False, interaction_only=True),
                    StandardScaler(),
                    LogisticRegression(max_iter=8000, C=C, random_state=42),
                ),
            )
        )

    print()
    print("---- tree ensembles (would need new TS inference code) ----")
    for n, lr_, d in [(200, 0.1, 3), (400, 0.05, 3), (300, 0.1, 4)]:
        results.append(
            score(
                f"GradientBoosting n={n} lr={lr_} depth={d}",
                lambda n=n, lr_=lr_, d=d: GradientBoostingClassifier(
                    n_estimators=n, learning_rate=lr_, max_depth=d, random_state=42
                ),
            )
        )
    results.append(
        score(
            "HistGradientBoosting",
            lambda: HistGradientBoostingClassifier(max_iter=300, random_state=42),
        )
    )
    for leaf in [1, 2]:
        results.append(
            score(
                f"RandomForest 600 leaf={leaf}",
                lambda leaf=leaf: RandomForestClassifier(
                    n_estimators=600, min_samples_leaf=leaf, random_state=42, n_jobs=-1
                ),
            )
        )
    results.append(
        score(
            "ExtraTrees 600",
            lambda: ExtraTreesClassifier(n_estimators=600, random_state=42, n_jobs=-1),
        )
    )
    results.append(
        score(
            "Voting(GBM + RF + ExtraTrees), soft",
            lambda: VotingClassifier(
                estimators=[
                    ("gbm", GradientBoostingClassifier(n_estimators=300, random_state=42)),
                    ("rf", RandomForestClassifier(n_estimators=600, random_state=42, n_jobs=-1)),
                    ("et", ExtraTreesClassifier(n_estimators=600, random_state=42, n_jobs=-1)),
                ],
                voting="soft",
            ),
        )
    )

    print()
    print("=" * 80)
    best = max(results, key=lambda r: r[1])
    print(f"BEST: {best[0]}  mean={best[1]:.4f}  min={best[2]:.4f}")


if __name__ == "__main__":
    main()
