"use client";

import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";
import { useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   03 — Feature Reveal
   A dark-green card expands from 40% centred to full-viewport as
   the user scrolls (0 → 30% progress). Then words in the body
   text light up one by one left-to-right (30 → 100% progress),
   going from muted green → cream, with "600,000" flipping to
   bright yellow as its accent turn arrives.
   ═══════════════════════════════════════════════════════════════ */

/* ── Palette ──────────────────────────────────────────────────── */
const GREEN = "#0F5C4A";
const CREAM = "#F5EFE0";
const MUTED = "#5F8A7D";
const YELLOW = "#F2D024";

/* ── Body words ───────────────────────────────────────────────── */
const WORDS: { text: string; accent: "yellow" | null }[] = [
  { text: "One", accent: null },
  { text: "button-cell", accent: null },
  { text: "battery", accent: null },
  { text: "contains", accent: null },
  { text: "enough", accent: null },
  { text: "mercury", accent: null },
  { text: "to", accent: null },
  { text: "pollute", accent: null },
  { text: "600,000", accent: "yellow" },
  { text: "liters", accent: null },
  { text: "of", accent: null },
  { text: "water—the", accent: null },
  { text: "equivalent", accent: null },
  { text: "of", accent: null },
  { text: "an", accent: null },
  { text: "Olympic-size", accent: null },
  { text: "swimming", accent: null },
  { text: "pool.", accent: null },
];

/* ── Word animation range ─────────────────────────────────────── */
const WORD_WINDOW_START = 0.3; // card fully expanded at 0.30
const WORD_WINDOW_END = 1.0;
const WORD_WINDOW = WORD_WINDOW_END - WORD_WINDOW_START;

/* ── Per-word component ───────────────────────────────────────── *
   Each Word calls its own useTransform — valid because Word is a
   real React component, not a callback, so hooks are at top level. */
function Word({
  text,
  accent,
  scrollYProgress,
  start,
  end,
}: {
  text: string;
  accent: "yellow" | null;
  scrollYProgress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const targetColor = accent === "yellow" ? YELLOW : CREAM;
  const color = useTransform(scrollYProgress, [start, Math.min(end, 0.98)], [MUTED, targetColor]);
  return (
    <motion.span style={{ color }} className="inline">
      {text}{" "}
    </motion.span>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export default function FeatureReveal() {
  const reduced = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  /* Single scroll source — offset ["start start","end end"] means
     progress 0 when section-top = viewport-top, and 1 when
     section-bottom = viewport-bottom. For 300vh that's 200vh of
     actual scroll travel, so 30% ≈ 60vh and 70% ≈ 140vh. */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  /* Card geometry ── 0 → 0.30 ───────────────────────────────────
     `{ clamp: true }` made explicit on every one of these (framer's
     documented default, but forcing it here ruled out a real bug during
     testing: several of these read back as small fractional values deep
     into the scroll — e.g. 0.12 opacity at ~89% progress, well past every
     window below — rather than holding at their settled endpoint). */
  const cardW = useTransform(scrollYProgress, [0, 0.3], ["40%", "100%"], { clamp: true });
  const cardH = useTransform(scrollYProgress, [0, 0.3], ["45vh", "100vh"], { clamp: true });
  const cardRadius = useTransform(scrollYProgress, [0, 0.3], [32, 0], { clamp: true });
  const cardOp = useTransform(scrollYProgress, [0, 0.07], [0, 1], { clamp: true });

  /* Heading enters as card finishes ── 0.22 → 0.38 ──────────── */
  const headOp = useTransform(scrollYProgress, [0.22, 0.38], [0, 1], { clamp: true });
  const headY = useTransform(scrollYProgress, [0.22, 0.38], [24, 0], { clamp: true });

  /* Body wrapper fades in just after heading ── 0.28 → 0.44 ─── */
  const bodyOp = useTransform(scrollYProgress, [0.28, 0.44], [0, 1], { clamp: true });

  /* Per-word timing ─────────────────────────────────────────── */
  const n = WORDS.length; // 18 words
  const perWord = WORD_WINDOW / n; // ≈ 0.039 per word
  const overlap = 1.6; // highlight span = 1.6× slot

  return (
    <section
      ref={sectionRef}
      id="highlights"
      className="section-anchor relative"
      style={{ minHeight: "300vh", background: "var(--paper)" }}
    >
      {/* ── Sticky frame ── */}
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <motion.div
          className="relative flex flex-col items-center justify-center overflow-hidden"
          style={
            reduced
              ? { width: "100%", height: "100vh", borderRadius: 0, background: GREEN }
              : {
                  width: cardW,
                  height: cardH,
                  borderRadius: cardRadius,
                  opacity: cardOp,
                  background: GREEN,
                }
          }
        >
          <div className="flex h-full w-full flex-col items-center justify-center px-8 py-12 md:px-20">
            {/* ── Heading ── */}
            <motion.h2
              className="w-full text-center font-display font-bold tracking-tight"
              style={
                reduced
                  ? { color: CREAM, fontSize: "clamp(2.2rem,5vw,4.5rem)" }
                  : { color: CREAM, fontSize: "clamp(2.2rem,5vw,4.5rem)", opacity: headOp, y: headY }
              }
            >
              Did you know?
            </motion.h2>

            {/* ── Body text ── */}
            <motion.p
              className="mt-6 max-w-3xl text-left font-display font-bold leading-[1.6] md:mt-10"
              style={
                reduced
                  ? { color: CREAM, fontSize: "clamp(1.3rem,2.6vw,2.1rem)" }
                  : { fontSize: "clamp(1.3rem,2.6vw,2.1rem)", opacity: bodyOp }
              }
            >
              {reduced
                ? /* Reduced motion: all words visible immediately */
                  WORDS.map((w, i) => (
                    <span key={i} style={{ color: w.accent === "yellow" ? YELLOW : CREAM }}>
                      {w.text}{" "}
                    </span>
                  ))
                : /* Full motion: per-word scroll-driven colour */
                  WORDS.map((w, i) => {
                    const s = WORD_WINDOW_START + i * perWord;
                    const e = s + perWord * overlap;
                    return (
                      <Word
                        key={i}
                        text={w.text}
                        accent={w.accent}
                        scrollYProgress={scrollYProgress}
                        start={s}
                        end={Math.min(e, 0.99)}
                      />
                    );
                  })}
            </motion.p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
