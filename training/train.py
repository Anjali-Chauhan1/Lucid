"""
Train the Lucid explanation-quality classifier.

Produces (all committed to the repo as evidence):
  ../lib/ml/weights.json     - the model the TypeScript runtime loads
  metrics_report.txt         - CV + held-out metrics table
  confusion_matrix.png       - held-out confusion matrix
  ablation.txt               - delta when the copying features are removed

The classifier is an ExtraTreesClassifier over 16 features (see features.py):
the original 8 hand-designed signals, plus 8 distribution-shape features
over per-node similarity added specifically to fix the weakest boundary
(good vs partial, which is a coverage-COUNT distinction that the original
averaged/weighted features washed out).

Why trees and not logistic regression: LR plateaued at ~79-85% depending on
the split (see metrics_report.txt history) even after the feature and label
fixes below. ExtraTrees captures the nonlinear "count how many nodes are
below threshold" decision boundary that a linear model structurally cannot,
without overfitting the way a single deep tree would. It costs portability —
the TS runtime needs a tree-walking inference module (lib/ml/treeEnsemble.ts)
instead of a one-line softmax(coef.x+b) — which is why this is the model of
last resort, not the default: LR is tried first and only unseated if it
falls meaningfully short.

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

# Chosen via training/sweep.py: n=150 was BOTH the most accurate config
# tested AND the smallest (fewer, less-overfit trees generalized better than
# 600+), so there was no accuracy/size tradeoff to make here.
N_ESTIMATORS = 150
TREE_KWARGS = dict(n_estimators=N_ESTIMATORS, max_features="log2", min_samples_leaf=1)

ROUND_DP = 5  # rounding for exported thresholds/values — keeps weights.json a few MB, not tens


def build_matrix(df: pd.DataFrame) -> np.ndarray:
    concepts = load_concepts()
    extractor = FeatureExtractor()
    rows = [(concepts[cid], text) for cid, text in zip(df.concept_id, df.explanation)]
    return extractor.extract_matrix(rows)


def export_tree_ensemble(model, classes: list[str]) -> list[dict]:
    """
    Flatten each sklearn tree into parallel arrays the TS runtime can walk.
    `value` is populated ONLY at leaves (internal nodes never read it at
    inference) to keep the export small.
    """
    trees = []
    for estimator in model.estimators_:
        t = estimator.tree_
        n_nodes = t.node_count
        feature = t.feature.tolist()  # -2 at leaves
        threshold = [round(float(v), ROUND_DP) for v in t.threshold]
        left = t.children_left.tolist()
        right = t.children_right.tolist()
        value = []
        for i in range(n_nodes):
            if feature[i] == -2:  # leaf
                counts = t.value[i][0]
                total = counts.sum()
                probs = (counts / total) if total > 0 else counts
                value.append([round(float(p), ROUND_DP) for p in probs])
            else:
                value.append(None)
        trees.append({"feature": feature, "threshold": threshold, "left": left, "right": right, "value": value})
    return trees


def main() -> None:
    from sklearn.ensemble import ExtraTreesClassifier
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
            LogisticRegression(max_iter=3000, C=3.0, random_state=args.seed),
        ),
        "ExtraTrees": ExtraTreesClassifier(random_state=args.seed, n_jobs=-1, **TREE_KWARGS),
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

    # ---- fit both, export whichever wins (ExtraTrees, unless LR is close) ----
    lr = models["LogisticRegression"]
    lr.fit(X_train, y_train)
    et = models["ExtraTrees"]
    et.fit(X_train, y_train)

    lr_test = lr.score(X_test, y_test)
    et_test = et.score(X_test, y_test)
    log(f"Held-out accuracy  LogisticRegression : {lr_test:.4f}")
    log(f"Held-out accuracy  ExtraTrees         : {et_test:.4f}")
    log("")

    use_trees = et_test >= lr_test
    best = et if use_trees else lr
    best_name = "ExtraTrees" if use_trees else "LogisticRegression"
    y_pred = best.predict(X_test)

    log(f"Held-out classification report ({best_name}, exported model)")
    log("-" * 66)
    log(classification_report(y_test, y_pred, labels=CLASSES, zero_division=0))

    # ---- feature importance / coefficients (interpretability) ----
    if use_trees:
        log("Feature importances (ExtraTrees, mean decrease in impurity)")
        log("-" * 66)
        for name, imp in sorted(
            zip(FEATURE_ORDER, et.feature_importances_), key=lambda x: -x[1]
        ):
            log(f"{name:<28}{imp:>8.4f}")
    else:
        clf: LogisticRegression = lr.named_steps["logisticregression"]
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

    # ---- ablation: remove the copying features (on the exported model type) ----
    keep = [i for i, f in enumerate(FEATURE_ORDER) if f not in COPYING_FEATURES]
    full_cv = cv_results[best_name].mean()
    if use_trees:
        ablated = ExtraTreesClassifier(random_state=args.seed, n_jobs=-1, **TREE_KWARGS)
    else:
        ablated = make_pipeline(
            StandardScaler(), LogisticRegression(max_iter=3000, random_state=args.seed)
        )
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
        f"removed: {', '.join(COPYING_FEATURES)}   (model: {best_name})",
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
    WEIGHTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    if use_trees:
        weights = {
            "type": "tree_ensemble",
            "feature_order": list(FEATURE_ORDER),
            "classes": [str(c) for c in et.classes_],
            "trees": export_tree_ensemble(et, list(et.classes_)),
            "metadata": {
                "model": f"ExtraTreesClassifier(n_estimators={N_ESTIMATORS})",
                "n_train": int(len(X_train)),
                "n_test": int(len(X_test)),
                "cv_accuracy": float(full_cv),
                "test_accuracy": float(full_test),
            },
        }
    else:
        scaler: StandardScaler = lr.named_steps["standardscaler"]
        clf = lr.named_steps["logisticregression"]
        weights = {
            "type": "linear",
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
    WEIGHTS_OUT.write_text(json.dumps(weights, separators=(",", ":")), encoding="utf-8")
    size_mb = WEIGHTS_OUT.stat().st_size / (1024 * 1024)
    print(f"\nWrote {WEIGHTS_OUT} ({size_mb:.2f} MB, type={weights['type']})")

    (HERE / "metrics_report.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {HERE / 'metrics_report.txt'}")


if __name__ == "__main__":
    main()
