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
  // Accessibility — a factual property of being text-first, not a dedicated
  // feature: nothing was specially built for this, the app just never
  // needed audio in the first place. State it as an observation, not a claim.
  access: {
    name: "Works without sound, top to bottom",
    tagline:
      "Voice input is an optional convenience, never a requirement. Every question, gap, and score is delivered as text — type your explanation, read the persona's questions, read your report. That also means nothing here requires hearing or speaking.",
  },
} as const;
