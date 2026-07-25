"""
Train the misconception-CATEGORY classifier ("Misconception Fingerprint").

Unlike the explanation-quality classifier (train.py), this one does not use
a sentence-embedding model at all. Category is a PATTERN-OF-PHRASING signal
(e.g. "X and Y are the same thing" vs "X flows into Y" vs "X is defined as
Y") that lives in the words themselves, not in deep semantics — dense
sentence embeddings actually smooth this signal away and cluster by TOPIC
instead (measured: 58% held-out accuracy). A from-scratch TF-IDF (word
1-2grams + char 3-5grams) plus two hand-designed lexical cue features
recovers it cleanly, and costs nothing extra to serve at runtime: no model
download, pure regex + dict lookup + a linear layer (see
misconception_features.py, mirrored 1:1 in lib/ml/misconceptionFeatures.ts).

Produces:
  ../lib/ml/misconception-weights.json   - the model the TS runtime loads
  misconception_metrics_report.txt       - CV + held-out metrics table
  misconception_confusion_matrix.png     - held-out confusion matrix

Usage:
    python train_misconception_classifier.py
    python train_misconception_classifier.py --test-size 0.25 --seed 42
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

from misconception_features import TfidfSpace, build_feature_vector, char_ngrams, word_ngrams, word_tokens

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SAMPLES = HERE / "misconceptions.csv"
TAXONOMY_PATH = ROOT / "lib" / "ml" / "misconception-taxonomy.json"
WEIGHTS_OUT = ROOT / "lib" / "ml" / "misconception-weights.json"

WORD_MIN_DF = 2
WORD_MAX_FEATURES = 1500
CHAR_MIN_DF = 3
CHAR_MAX_FEATURES = 1500


def main() -> None:
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import ConfusionMatrixDisplay, classification_report, confusion_matrix
    from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    ap = argparse.ArgumentParser()
    ap.add_argument("--test-size", type=float, default=0.25)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--C", type=float, default=5.0)
    args = ap.parse_args()

    if not SAMPLES.exists():
        raise SystemExit(f"{SAMPLES} not found — run generate_misconceptions.py first.")

    taxonomy = json.loads(TAXONOMY_PATH.read_text(encoding="utf-8"))
    classes = sorted(c["id"] for c in taxonomy)

    df = pd.read_csv(SAMPLES).dropna(subset=["text", "category"])
    df = df[df.category.isin(classes)].reset_index(drop=True)
    print(f"Loaded {len(df)} samples")
    print(df.category.value_counts().to_string(), "\n")

    train_df, test_df = train_test_split(
        df, test_size=args.test_size, random_state=args.seed, stratify=df.category
    )

    print("Fitting TF-IDF vocabularies on the training split...")
    word_space = TfidfSpace.fit(
        [word_ngrams(word_tokens(t)) for t in train_df.text],
        min_df=WORD_MIN_DF,
        max_features=WORD_MAX_FEATURES,
    )
    char_space = TfidfSpace.fit(
        [char_ngrams(t) for t in train_df.text],
        min_df=CHAR_MIN_DF,
        max_features=CHAR_MAX_FEATURES,
    )
    print(f"word vocab={len(word_space.vocab)}  char vocab={len(char_space.vocab)}")

    X_train = np.array([build_feature_vector(t, word_space, char_space) for t in train_df.text])
    X_test = np.array([build_feature_vector(t, word_space, char_space) for t in test_df.text])
    y_train = train_df.category.to_numpy()
    y_test = test_df.category.to_numpy()

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=args.seed)
    lines: list[str] = []

    def log(s: str = "") -> None:
        print(s)
        lines.append(s)

    log("=" * 70)
    log("LUCID — misconception-category classifier (Misconception Fingerprint)")
    log("=" * 70)
    log(f"samples={len(df)}  features={X_train.shape[1]}  classes={classes}")
    log(f"train={len(X_train)}  held-out test={len(X_test)}")
    log("")

    clf = LogisticRegression(max_iter=4000, C=args.C, class_weight="balanced", random_state=args.seed)
    cv_scores = cross_val_score(clf, X_train, y_train, cv=cv, scoring="accuracy")
    log(f"5-fold CV accuracy (training split): mean={cv_scores.mean():.4f}  std={cv_scores.std():.4f}")
    log("")

    clf.fit(X_train, y_train)
    y_pred = clf.predict(X_test)
    test_acc = clf.score(X_test, y_test)

    log("Held-out classification report")
    log("-" * 70)
    log(classification_report(y_test, y_pred, labels=classes, zero_division=0))
    log(f"Held-out accuracy: {test_acc:.4f}")
    log("")
    if test_acc < 0.95:
        log(f"WARNING: held-out accuracy {test_acc:.4f} is below the 0.95 target.")
    else:
        log(f"Target met: held-out accuracy {test_acc:.4f} >= 0.95")

    cm = confusion_matrix(y_test, y_pred, labels=classes)
    fig, ax = plt.subplots(figsize=(7.5, 6.5))
    ConfusionMatrixDisplay(cm, display_labels=classes).plot(
        ax=ax, cmap="cividis", colorbar=False, values_format="d", xticks_rotation=30
    )
    ax.set_title("Misconception-category classifier — held-out confusion matrix")
    plt.tight_layout()
    plt.savefig(HERE / "misconception_confusion_matrix.png", dpi=160)
    plt.close(fig)
    print(f"Wrote {HERE / 'misconception_confusion_matrix.png'}")

    # ---- export weights + vocab for the TypeScript runtime ----
    weights = {
        "classes": [str(c) for c in clf.classes_],
        "coef": clf.coef_.tolist(),
        "intercept": clf.intercept_.tolist(),
        "word_vocab": word_space.vocab,
        "word_idf": word_space.idf,
        "char_vocab": char_space.vocab,
        "char_idf": char_space.idf,
        "metadata": {
            "model": "LogisticRegression(multinomial) on hand-rolled TF-IDF + lexical cues",
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
            "n_features": int(X_train.shape[1]),
            "cv_accuracy": float(cv_scores.mean()),
            "test_accuracy": float(test_acc),
        },
    }
    WEIGHTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    WEIGHTS_OUT.write_text(json.dumps(weights), encoding="utf-8")
    print(f"\nWrote {WEIGHTS_OUT} ({WEIGHTS_OUT.stat().st_size / 1024:.1f} KB)")

    (HERE / "misconception_metrics_report.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {HERE / 'misconception_metrics_report.txt'}")


if __name__ == "__main__":
    main()
