// Replays training/verify_sample.json through the REAL lib/ml/treeEnsemble.ts
// module and diffs against sklearn's own predict_proba for the same vectors.
// Run after verify_tree_export.py.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { predictEnsemble } from "../lib/ml/treeEnsemble.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const weights = JSON.parse(fs.readFileSync(path.join(__dirname, "verify_weights.json"), "utf8"));
const sample = JSON.parse(fs.readFileSync(path.join(__dirname, "verify_sample.json"), "utf8"));

if (weights.classes.join(",") !== sample.classes.join(",")) {
  throw new Error("class order mismatch between weights and sample export");
}

let maxAbsDiff = 0;
let labelMismatches = 0;

for (const { x, expected_proba } of sample.samples) {
  const got = predictEnsemble(weights.trees, weights.classes.length, x);
  for (let i = 0; i < got.length; i++) {
    maxAbsDiff = Math.max(maxAbsDiff, Math.abs(got[i] - expected_proba[i]));
  }
  const gotLabel = got.indexOf(Math.max(...got));
  const expLabel = expected_proba.indexOf(Math.max(...expected_proba));
  if (gotLabel !== expLabel) labelMismatches++;
}

console.log(`samples checked: ${sample.samples.length}`);
console.log(`max |prob diff| (TS vs sklearn): ${maxAbsDiff.toExponential(3)}`);
console.log(`label mismatches: ${labelMismatches}`);

if (maxAbsDiff > 1e-6 || labelMismatches > 0) {
  console.error("FAIL: TS tree inference does not match sklearn");
  process.exit(1);
}
console.log("PASS: TS tree inference matches sklearn predict_proba exactly");
