/**
 * Central brand config. Everything user-facing pulls from here so the product
 * can be renamed in one place.
 */
export const BRAND = {
  name: "Lucid",
  tagline: "The Tutor You Teach",
  heroLine: "Everyone built an AI that teaches. We built one that listens.",
  // USP 1 — the score
  score: {
    name: "Grasp Score",
    tagline:
      "Report cards measure what you remember. Grasp Score measures what you understand.",
  },
  // USP 2 — the memorization detector
  parrot: {
    name: "Parrot Detector",
    challenge:
      "That's the textbook talking. Now you tell me — in your own words, with an example.",
  },
} as const;
