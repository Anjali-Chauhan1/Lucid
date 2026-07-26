/**
 * Inference for a scikit-learn tree ensemble (ExtraTreesClassifier/
 * RandomForestClassifier) exported by training/train.py's
 * `export_tree_ensemble()`.
 *
 * Each tree is walked from its root; the leaf's class-probability vector is
 * read off, and the vectors are averaged across all trees — this is
 * arithmetically identical to sklearn's own `predict_proba()` (soft
 * voting), so predictions match the Python model exactly (verified in
 * training/verify_tree_export.py before this shipped).
 */

export interface TreeNode {
  feature: number[]; // -2 at leaves
  threshold: number[];
  left: number[];
  right: number[];
  value: (number[] | null)[]; // populated only at leaves
}

/** Walk one tree for a single sample; returns the leaf's probability vector. */
function predictTree(tree: TreeNode, x: number[]): number[] {
  let node = 0;
  while (tree.feature[node] !== -2) {
    const f = tree.feature[node];
    node = x[f] <= tree.threshold[node] ? tree.left[node] : tree.right[node];
  }
  const value = tree.value[node];
  if (!value) throw new Error(`tree ensemble: leaf node ${node} has no value`);
  return value;
}

/** Average per-class probabilities across every tree (soft voting). */
export function predictEnsemble(trees: TreeNode[], nClasses: number, x: number[]): number[] {
  const sums = new Array(nClasses).fill(0);
  for (const tree of trees) {
    const probs = predictTree(tree, x);
    for (let c = 0; c < nClasses; c++) sums[c] += probs[c];
  }
  return sums.map((s) => s / trees.length);
}
