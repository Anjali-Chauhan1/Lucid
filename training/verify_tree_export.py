"""
Cross-check lib/ml/treeEnsemble.ts against sklearn on real feature vectors.

Fits an ExtraTreesClassifier on the cached feature matrix (same hyperparams
as train.py), exports it the same way train.py does, and dumps a sample of
(feature vector, sklearn predict_proba) pairs for a Node script to replay
through the actual TS module and diff.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.model_selection import train_test_split

from train import TREE_KWARGS, export_tree_ensemble

HERE = Path(__file__).resolve().parent
CACHE = HERE / ".feature_cache.npz"
OUT = HERE / "verify_sample.json"
WEIGHTS_OUT = HERE / "verify_weights.json"

data = np.load(CACHE, allow_pickle=True)
X, y = data["X"], data["y"]
feature_names = list(data["feature_names"])

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42, stratify=y
)

model = ExtraTreesClassifier(random_state=42, n_jobs=-1, **TREE_KWARGS)
model.fit(X_train, y_train)
print("held-out accuracy on cache:", model.score(X_test, y_test))

trees = export_tree_ensemble(model, list(model.classes_))
weights = {
    "type": "tree_ensemble",
    "feature_order": feature_names,
    "classes": [str(c) for c in model.classes_],
    "trees": trees,
}
WEIGHTS_OUT.write_text(json.dumps(weights, separators=(",", ":")), encoding="utf-8")
print(f"Wrote {WEIGHTS_OUT} ({WEIGHTS_OUT.stat().st_size / 1e6:.2f} MB)")

# Sample 40 held-out vectors and sklearn's own predict_proba for them.
n = min(40, len(X_test))
idx = np.random.RandomState(0).choice(len(X_test), n, replace=False)
sample_X = X_test[idx]
sample_proba = model.predict_proba(sample_X)

OUT.write_text(
    json.dumps(
        {
            "classes": [str(c) for c in model.classes_],
            "samples": [
                {"x": row.tolist(), "expected_proba": proba.tolist()}
                for row, proba in zip(sample_X, sample_proba)
            ],
        }
    ),
    encoding="utf-8",
)
print(f"Wrote {OUT} ({n} samples)")
