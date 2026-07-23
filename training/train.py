"""
Train the Lucid explanation-quality classifier.

Produces (all committed to the repo as evidence):
  ../lib/ml/weights.json     - the model the TypeScript runtime loads
  metrics_report.txt         - CV + held-out metrics table
  confusion_matrix.png       - held-out confusion matrix
  ablation.txt               - delta when the copying features are removed

The classifier is a multinomial logistic regression over 8 hand-designed
features (see features.py). LR is compared against gradient boosting; LR is
exported because its coefficients are inspectable and trivially portable to
TypeScript as `softmax(standardize(x) . coef + intercept)`.

Usage:
    python train.py
    python train.py --test-size 0.25 --seed 42
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from features import FEATURE_ORDER, FeatureExtractor, load_concepts

HERE = Path(__file__).resolve().parent
SAMPLES = HERE / "samples.csv"
WEIGHTS_OUT = HERE.parent / "lib" / "ml" / "weights.json"
CLASSES = ["good", "partial", "memorized", "wrong"]

# The two features that detect copying. The ablation removes these to show how
# much the Parrot Detector actually contributes.
COPYING_FEATURES = ["textbook_similarity", "trigram_overlap"]


def build_matrix(df: pd.DataFrame) -> np.ndarray:
    concepts = load_concepts()
    extractor = FeatureExtractor()
    rows = [(concepts[cid], text) for cid, text in zip(df.concept_id, df.explanation)]
    return extractor.extract_matrix(rows)


def main() -> None:
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import (
        ConfusionMatrixDisplay,
        classification_report,
        confusion_matrix,
    )
    from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    ap = argparse.ArgumentParser()
    ap.add_argument("--test-size", type=float, default=0.25)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    if not SAMPLES.exists():
        raise SystemExit(f"{SAMPLES} not found — run generate_data.py first.")

    df = pd.read_csv(SAMPLES).dropna(subset=["explanation", "label"])
    df = df[df.label.isin(CLASSES)].reset_index(drop=True)
    print(f"Loaded {len(df)} samples")
    print(df.label.value_counts().to_string(), "\n")

    print("Extracting features (loads MiniLM + DeBERTa NLI; first run downloads them)...")
    X = build_matrix(df)
    y = df.label.to_numpy()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.seed, stratify=y
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=args.seed)
    lines: list[str] = []

    def log(s: str = "") -> None:
        print(s)
        lines.append(s)

    log("=" * 66)
    log("LUCID — explanation-quality classifier")
    log("=" * 66)
    log(f"samples={len(df)}  features={len(FEATURE_ORDER)}  classes={CLASSES}")
    log(f"train={len(X_train)}  held-out test={len(X_test)}")
    log("")

    # ---- model comparison (5-fold CV on the training split) ----
    models = {
        "LogisticRegression": make_pipeline(
            StandardScaler(),
            LogisticRegression(max_iter=2000, C=1.0, random_state=args.seed),
        ),
        "GradientBoosting": make_pipeline(
            StandardScaler(),
            GradientBoostingClassifier(random_state=args.seed),
        ),
    }

    log("5-fold cross-validation (accuracy, on training split)")
    log("-" * 66)
    log(f"{'model':<22}{'mean':>10}{'std':>10}")
    cv_results = {}
    for name, model in models.items():
        scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="accuracy")
        cv_results[name] = scores
        log(f"{name:<22}{scores.mean():>10.4f}{scores.std():>10.4f}")
    log("")

    # ---- fit the exported model and evaluate held-out ----
    best = models["LogisticRegression"]
    best.fit(X_train, y_train)
    y_pred = best.predict(X_test)

    log("Held-out classification report (LogisticRegression)")
    log("-" * 66)
    report = classification_report(y_test, y_pred, labels=CLASSES, zero_division=0)
    log(report)

    gbm = models["GradientBoosting"]
    gbm.fit(X_train, y_train)
    log(f"Held-out accuracy  LogisticRegression : {best.score(X_test, y_test):.4f}")
    log(f"Held-out accuracy  GradientBoosting   : {gbm.score(X_test, y_test):.4f}")
    log("")

    # ---- feature weights (interpretability) ----
    clf: LogisticRegression = best.named_steps["logisticregression"]
    log("Feature coefficients per class (standardized units)")
    log("-" * 66)
    header = f"{'feature':<28}" + "".join(f"{c:>10}" for c in clf.classes_)
    log(header)
    for i, fname in enumerate(FEATURE_ORDER):
        row = f"{fname:<28}" + "".join(f"{clf.coef_[k][i]:>10.3f}" for k in range(len(clf.classes_)))
        log(row)
    log("")

    # ---- confusion matrix ----
    cm = confusion_matrix(y_test, y_pred, labels=CLASSES)
    fig, ax = plt.subplots(figsize=(6.5, 5.5))
    ConfusionMatrixDisplay(cm, display_labels=CLASSES).plot(
        ax=ax, cmap="cividis", colorbar=False, values_format="d"
    )
    ax.set_title("Lucid classifier — held-out confusion matrix")
    plt.tight_layout()
    plt.savefig(HERE / "confusion_matrix.png", dpi=160)
    plt.close(fig)
    print(f"Wrote {HERE / 'confusion_matrix.png'}")

    # ---- ablation: remove the copying features ----
    keep = [i for i, f in enumerate(FEATURE_ORDER) if f not in COPYING_FEATURES]
    ablated = make_pipeline(
        StandardScaler(), LogisticRegression(max_iter=2000, random_state=args.seed)
    )
    full_cv = cv_results["LogisticRegression"].mean()
    abl_cv = cross_val_score(ablated, X_train[:, keep], y_train, cv=cv, scoring="accuracy").mean()
    ablated.fit(X_train[:, keep], y_train)
    full_test = best.score(X_test, y_test)
    abl_test = ablated.score(X_test[:, keep], y_test)

    # How badly does the memorized class collapse without copying features?
    mem_mask = y_test == "memorized"
    mem_full = (best.predict(X_test)[mem_mask] == "memorized").mean() if mem_mask.any() else float("nan")
    mem_abl = (
        (ablated.predict(X_test[:, keep])[mem_mask] == "memorized").mean()
        if mem_mask.any()
        else float("nan")
    )

    abl_lines = [
        "ABLATION — removing the Parrot Detector copying features",
        f"removed: {', '.join(COPYING_FEATURES)}",
        "=" * 66,
        f"5-fold CV accuracy   full={full_cv:.4f}   ablated={abl_cv:.4f}   delta={full_cv - abl_cv:+.4f}",
        f"held-out accuracy    full={full_test:.4f}   ablated={abl_test:.4f}   delta={full_test - abl_test:+.4f}",
        f"'memorized' recall   full={mem_full:.4f}   ablated={mem_abl:.4f}   delta={mem_full - mem_abl:+.4f}",
        "",
        "Interpretation: semantic similarity alone cannot separate a recited",
        "answer from an understood one — a memorized explanation is, by",
        "construction, semantically correct. The n-gram overlap signal is what",
        "makes that distinction possible.",
    ]
    (HERE / "ablation.txt").write_text("\n".join(abl_lines), encoding="utf-8")
    print("\n".join(abl_lines))
    log("")
    log("\n".join(abl_lines))

    # ---- export weights for the TypeScript runtime ----
    scaler: StandardScaler = best.named_steps["standardscaler"]
    weights = {
        "feature_order": list(FEATURE_ORDER),
        "classes": [str(c) for c in clf.classes_],
        "coef": clf.coef_.tolist(),
        "intercept": clf.intercept_.tolist(),
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "metadata": {
            "model": "LogisticRegression(multinomial)",
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
            "cv_accuracy": float(full_cv),
            "test_accuracy": float(full_test),
        },
    }
    WEIGHTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    WEIGHTS_OUT.write_text(json.dumps(weights, indent=2), encoding="utf-8")
    print(f"\nWrote {WEIGHTS_OUT}")

    (HERE / "metrics_report.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {HERE / 'metrics_report.txt'}")


if __name__ == "__main__":
    main()
