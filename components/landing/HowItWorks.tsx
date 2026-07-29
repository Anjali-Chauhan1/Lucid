"use client";

import { motion, useInView, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useRef } from "react";
import { EASE, Eyebrow, Reveal, WordReveal, useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   03 — How it works
   Five steps threaded onto one spine that draws itself as you
   scroll. Each node ignites when its step reaches the viewport, so
   the connection between stages is literal, not implied.
   ═══════════════════════════════════════════════════════════════ */

const STEPS = [
  {
    k: "You explain",
    title: "Teach it out loud — or type it",
    body: "Pick a concept and explain it the way you would to a friend. Voice is a convenience, never a requirement.",
    meta: "🎤 speak  ·  ⌨️ type",
    tone: "gold",
  },
  {
    k: "It gets confused",
    title: "A persona asks about your actual gaps",
    body: "Not generic quizzing. The follow-ups target the ideas your explanation skipped, one question at a time.",
    meta: "“But where does the energy come from?”",
    tone: "rose",
  },
  {
    k: "The engine reads it",
    title: "ML scores it — independently of the chatbot",
    body: "MiniLM embeddings match your clauses to the concept map. A DeBERTa NLI cross-encoder checks your claims for entailment and contradiction.",
    meta: "coverage · correctness · depth",
    tone: "cobalt",
  },
  {
    k: "You get a number",
    title: "A Grasp Score you can argue with",
    body: "Not a vibe. Every point traces back to a concept node you covered, a fact you entailed, or a why-chain you followed.",
    meta: "0 – 100, with the working shown",
    tone: "grass",
  },
  {
    k: "You close the loop",
    title: "Micro-lesson → re-explain → see the delta",
    body: "Loop mode teaches only the fuzzy parts in ≤150 words, then asks you to explain it back and re-scores. The delta is the proof.",
    meta: "41 → 78",
    tone: "gold",
  },
] as const;

const TONE = {
  gold: { text: "text-gold-ink", dot: "var(--gold)", ring: "rgba(201,138,31,0.45)" },
  rose: { text: "text-rose-paper-ink", dot: "var(--rose-paper)", ring: "rgba(209,72,63,0.4)" },
  cobalt: { text: "text-cobalt-ink", dot: "var(--cobalt)", ring: "rgba(43,110,232,0.4)" },
  grass: { text: "text-grass-ink", dot: "var(--grass)", ring: "rgba(47,158,79,0.4)" },
} as const;

/**
 * The panel's own line, revealed character-by-character as you scroll. Kept
 * short and rhythmic on purpose — the sweep effect is legible at reading
 * pace, not at the pace of a whole paragraph.
 */
const STATEMENT =
  "Reading a definition feels like understanding it. Teaching it back is the only way to find out if it actually is.";

/**
 * A card that starts inline, grows to fill the viewport as you scroll into
 * it, holds there, then — instead of just sitting still through the hold —
 * sweeps a character-by-character highlight through its own line: the read
 * portion goes bright, the rest stays dim, and the boundary between them
 * tracks scroll position exactly, including mid-word, the way a karaoke
 * lyric line highlights.
 *
 * Same growth mechanic as this site's other scroll-expanding panels:
 * percentage dimensions of a pinned, exactly-one-viewport container — mixing
 * units here (`px` → `vh`, anything → `min()`) silently produces nonsense
 * instead of failing, which is why every dimension below stays in `%`.
 * Growth finishes at the halfway mark so the back half is a dedicated hold
 * for the reveal, not a moment mid-transition.
 */
function ExpandingStatement() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  const width = useTransform(scrollYProgress, [0, 0.5], ["min(560px, 90vw)", "100%"]);
  const height = useTransform(scrollYProgress, [0, 0.5], ["38%", "100%"]);
  const radius = useTransform(scrollYProgress, [0, 0.5], [28, 0]);

  // The highlight sweep only runs in the hold half — while the panel is
  // still growing there's nothing settled enough to read yet.
  const reveal = useTransform(scrollYProgress, [0.55, 0.96], [0, 1], { clamp: true });

  if (reduced) {
    return (
      <div className="my-20 flex justify-center px-6">
        <div className="card-paper flex h-70 w-full max-w-3xl items-center justify-center rounded-[28px] px-8">
          <p className="max-w-2xl text-center font-display text-2xl leading-[1.35] text-graphite">
            {STATEMENT}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative my-20 h-[240vh]">
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        <motion.div
          className="card-paper relative min-h-70 min-w-80 overflow-hidden"
          style={{ width, height, borderRadius: radius }}
        >
          <div className="absolute inset-0 flex items-center justify-center px-8 md:px-16">
            {/* `min-w-0` overrides the flex-item default of `min-width: auto`,
                which otherwise refuses to let this shrink below its content's
                unwrapped natural width — with a hundred-odd individual
                character spans as that content, the effect is the whole
                sentence rendering as one line and running straight off the
                edge of the viewport, `max-w-3xl` notwithstanding. */}
            <p className="max-w-3xl min-w-0 text-center font-display text-[clamp(1.3rem,3.2vw,2.6rem)] leading-[1.3]">
              <HighlightSweep text={STATEMENT} progress={reveal} />
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/**
 * Splits `text` into characters and colours each individually, its own
 * bright↔dim transition landing at a slightly different point along
 * `progress` than its neighbours. That per-character stagger — a hair over
 * one `1/length`th of the range each — is what makes the sweep read as a
 * wave passing through the line, rather than the whole block cross-fading
 * as one piece.
 */
function HighlightSweep({ text, progress }: { text: string; progress: MotionValue<number> }) {
  const chars = [...text];
  return (
    <>
      {chars.map((ch, i) => {
        const start = i / chars.length;
        const end = Math.min(start + 1.6 / chars.length, 1);
        return <Char key={i} ch={ch} start={start} end={end} progress={progress} />;
      })}
    </>
  );
}

/**
 * `--graphite-faint` / `--graphite` as literal hex, not `var(...)` — framer-
 * motion interpolates colour by parsing the two endpoints as actual colour
 * values; a CSS custom property reference isn't one, so animating between
 * two `var()` strings just holds at whichever value React last committed,
 * no transition. Keep these in sync with the tokens of the same name in
 * globals.css.
 */
const DIM = "#6f6e67";
const BRIGHT = "#111111";

function Char({
  ch,
  start,
  end,
  progress,
}: {
  ch: string;
  start: number;
  end: number;
  progress: MotionValue<number>;
}) {
  const color = useTransform(progress, [start, end], [DIM, BRIGHT]);
  return <motion.span style={{ color }}>{ch}</motion.span>;
}

export default function HowItWorks() {
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Drives the spine fill across the whole step list.
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 72%", "end 60%"],
  });
  const fill = useSpring(scrollYProgress, { stiffness: 80, damping: 26, mass: 0.4 });
  const cometTop = useTransform(fill, [0, 1], ["0%", "100%"]);

  return (
    /* No `overflow-hidden` on this section, deliberately: an ancestor with a
       clipped overflow becomes the scroll container for any `position:
       sticky` descendant, so `ExpandingStatement`'s pin would silently stop
       working and just scroll past at full size. */
    <section
      id="how"
      className="theme-paper paper-field section-anchor relative px-6 py-28 md:py-36"
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <Eyebrow tone="cobalt">How it works</Eyebrow>
          </Reveal>
          <h2 className="mt-6 font-display text-[clamp(2rem,4.2vw,3.2rem)] leading-[1.06] text-graphite">
            <WordReveal text="One loop, end to end." />
          </h2>
          <Reveal delay={0.15}>
            <p className="mt-5 text-[15px] leading-relaxed text-graphite-muted">
              Every stage feeds the next. The persona only knows what to ask because the
              engine already found the gap — and the engine only re-scores because you
              answered back.
            </p>
          </Reveal>
        </div>
      </div>

      <ExpandingStatement />

      <div className="relative mx-auto max-w-6xl">
        {/* ── the spine ─────────────────────────────────── */}
        <div ref={trackRef} className="relative mt-16 md:mt-20">
          {/* track */}
          <span
            aria-hidden
            className="absolute left-[19px] top-2 h-[calc(100%-1rem)] w-px bg-rule-strong md:left-1/2 md:-translate-x-1/2"
          />
          {/* scroll-driven fill */}
          <motion.span
            aria-hidden
            className="absolute left-[19px] top-2 w-px origin-top md:left-1/2 md:-translate-x-1/2"
            style={{
              height: "calc(100% - 1rem)",
              scaleY: reduced ? 1 : fill,
              background:
                "linear-gradient(180deg, var(--gold), var(--rose-paper) 38%, var(--cobalt) 64%, var(--grass))",
            }}
          />
          {/* comet riding the fill front */}
          {!reduced && (
            <motion.span
              aria-hidden
              className="absolute left-[19px] z-10 h-3 w-3 -translate-x-1/2 rounded-full md:left-1/2"
              style={{ top: cometTop, background: "var(--gold)" }}
            />
          )}

          <ol className="space-y-10 md:space-y-12">
            {STEPS.map((s, i) => (
              <Step key={s.k} step={s} index={i} />
            ))}
          </ol>
        </div>

        {/* the loop closes back on itself */}
        <Reveal delay={0.1}>
          <div className="mt-12 flex items-center justify-center gap-3 text-xs text-graphite-faint">
            <span className="h-px w-10 bg-rule-strong" />
            <motion.span
              animate={reduced ? undefined : { rotate: 360 }}
              transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
              className="text-gold-ink"
            >
              ↻
            </motion.span>
            <span>and then you run it again, on the part you just learned</span>
            <span className="h-px w-10 bg-rule-strong" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Step({ step, index }: { step: (typeof STEPS)[number]; index: number }) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, margin: "-45% 0px -35% 0px" });
  const reduced = useReducedMotion();
  const tone = TONE[step.tone];
  const left = index % 2 === 0;

  return (
    <li ref={ref} className="relative md:grid md:grid-cols-2 md:gap-12">
      {/* node on the spine. Ring colour matches the sheet (`--paper`, not
          `--paper-card`) rather than glowing — the dark theme used a glow to
          read as light against ink; here the ring achieves the same "cut
          into the page" look by matching the page itself. */}
      <span className="absolute left-[19px] top-2 z-10 flex h-4 w-4 -translate-x-1/2 items-center justify-center md:left-1/2">
        <motion.span
          className="h-2.5 w-2.5 rounded-full ring-4 ring-paper"
          animate={{
            background: inView ? tone.dot : "var(--rule-strong)",
            scale: inView ? 1.15 : 1,
          }}
          transition={{ duration: 0.5, ease: EASE }}
        />
        {inView && !reduced && (
          <span
            className="pulse-ring absolute h-4 w-4 rounded-full border"
            style={{ borderColor: tone.dot }}
          />
        )}
      </span>

      {/* card — alternates sides on desktop */}
      <motion.div
        className={`stage-3d pl-12 md:pl-0 ${
          left ? "md:col-start-1 md:pr-4 md:text-right" : "md:col-start-2 md:pl-4"
        }`}
        initial={reduced ? { opacity: 1 } : { opacity: 0, x: left ? -34 : 34, y: 16 }}
        whileInView={{ opacity: 1, x: 0, y: 0 }}
        viewport={{ once: true, margin: "-20% 0px" }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${tone.text}`}
        >
          {String(index + 1).padStart(2, "0")} — {step.k}
        </span>
        <h3 className="mt-3 font-display text-xl leading-snug text-graphite md:text-2xl">
          {step.title}
        </h3>
        <p className="mt-2.5 text-sm leading-relaxed text-graphite-muted">{step.body}</p>
        <span
          className={`card-paper mt-4 inline-block rounded-lg px-3 py-1.5 font-mono text-[11px] ${tone.text}`}
        >
          {step.meta}
        </span>
      </motion.div>
    </li>
  );
}
