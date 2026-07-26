/**
 * Confidence calibration — comparing what a student SAID they understood
 * against what the ML engine actually measured, before any feedback was
 * shown. The gap itself is the finding: it's the illusion-of-competence
 * signal that a plain quiz never surfaces.
 */

/** Points of gap beyond which the mismatch is worth calling out. */
export const CALIBRATION_GAP_THRESHOLD = 20;

export type CalibrationVerdict = "overconfident" | "underconfident" | "calibrated";

/** Map the 1-5 self-rating onto the same 0-100 scale as the Grasp Score. */
export function confidenceToPercent(rating: number): number {
  return (rating / 5) * 100;
}

export function calibrate(
  confidenceRating: number,
  actualScore: number,
): { verdict: CalibrationVerdict; gap: number; confidencePercent: number } {
  const confidencePercent = confidenceToPercent(confidenceRating);
  const gap = confidencePercent - actualScore;
  const verdict: CalibrationVerdict =
    gap > CALIBRATION_GAP_THRESHOLD
      ? "overconfident"
      : gap < -CALIBRATION_GAP_THRESHOLD
        ? "underconfident"
        : "calibrated";
  return { verdict, gap, confidencePercent };
}
