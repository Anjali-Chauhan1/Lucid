/**
 * Spaced repetition — a scientifically-grounded nudge to revisit a concept
 * before it's forgotten, not after. Deliberately simple (score-tiered fixed
 * intervals, not a full SM-2 scheduler): the point is surfacing "this is
 * about to fade" from data Lucid already has, not building a new subsystem.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Well-understood material tolerates a longer gap than a shaky first pass. */
export function reviewIntervalDays(lastScore: number): number {
  if (lastScore >= 80) return 7;
  if (lastScore >= 60) return 3;
  return 1;
}

export function daysSince(timestamp: number, now: number = Date.now()): number {
  return Math.floor((now - timestamp) / DAY_MS);
}

export function isDueForReview(
  lastTimestamp: number,
  lastScore: number,
  now: number = Date.now(),
): boolean {
  return daysSince(lastTimestamp, now) >= reviewIntervalDays(lastScore);
}
