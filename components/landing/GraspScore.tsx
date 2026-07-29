"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { BRAND } from "@/lib/brand";
import { AnimatedNumber, EASE, Eyebrow, Reveal, Tilt3D, WordReveal, useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   04 — USP 1: Grasp Score
   The gauge fills to the same number the three dimension bars add
   up to, so the visual is the arithmetic, not a decoration.
   ═══════════════════════════════════════════════════════════════ */

const SCORE = 78;

const DIMENSIONS = [
  {
    name: "Coverage",
    weight: 0.5,
    pct: 82,
    color: "var(--gold)",
    how: "Every idea in the concept map is embedded with MiniLM and matched against your explanation's clauses by max cosine similarity. Covered at ≥ 0.55.",
    unit: "embedding similarity",
  },
  {
    name: "Correctness",
    weight: 0.3,
    pct: 74,
    color: "var(--grass)",
    how: "A DeBERTa NLI cross-encoder checks each claim you made against the reference facts for entailment — and flags contradictions outright.",
    unit: "NLI entailment",
  },
  {
    name: "Depth",
    weight: 0.2,
    pct: 68,
    color: "var(--cobalt)",
    how: "Cosine similarity between your answers to the causal “why” questions and the expected idea. Stays null until the depth round actually runs.",
    unit: "causal why-chains",
  },
] as const;

export default function GraspScore() {
  return (
    <section
      id="grasp"
      className="theme-paper paper-field section-anchor relative overflow-hidden px-6 py-28 md:py-36"
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <Eyebrow tone="gold">USP 01 — the score</Eyebrow>
          </Reveal>
          <h2 className="mt-6 font-display text-[clamp(2rem,4.2vw,3.2rem)] leading-[1.06] text-graphite">
            <WordReveal text="Report cards measure what you remember." />{" "}
            <span className="marker text-graphite">
              <WordReveal text="Grasp Score measures what you understand." delay={0.2} />
            </span>
          </h2>
        </div>

        <div className="mt-16 grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          {/* ── gauge ───────────────────────────────────── */}
          <Reveal from="left">
            <Tilt3D strength={14} className="mx-auto w-fit rounded-full">
              <Gauge />
            </Tilt3D>
          </Reveal>

          {/* ── dimensions ──────────────────────────────── */}
          <div className="space-y-4">
            {DIMENSIONS.map((d, i) => (
              <Dimension key={d.name} dim={d} index={i} />
            ))}

            <Reveal delay={0.34}>
              <p className="card-paper rounded-xl px-4 py-3 text-[11px] leading-relaxed text-graphite-faint">
                <span className="text-graphite-muted">The chatbot never picks the number.</span>{" "}
                Scoring runs in <span className="font-mono text-gold-ink">lib/ml</span> on the
                server — embeddings, an NLI cross-encoder, and a trained classifier —
                completely separately from the conversation you just had.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Round a computed SVG coordinate to a fixed precision.
 *
 * `Math.cos`/`Math.sin` are not required to be correctly rounded, so Node and
 * the browser can disagree in the last digit — enough for React to flag a
 * hydration mismatch on the tick marks. Three decimals is far below a
 * subpixel and makes both sides serialize identically.
 */
const tick = (n: number) => Number(n.toFixed(3));

/** Conic-ish ring built from two stacked SVG circles + a counting label. */
function Gauge() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduced = useReducedMotion();

  const R = 108;
  const C = 2 * Math.PI * R;

  return (
    <div ref={ref} className="layer-3d relative h-75 w-75">
      {/* No halo here — a soft glow behind a shape is a dark-theme trick for
          reading as light; on paper the identical blur just looks like a
          smudge under the gauge, so this version skips it rather than
          fighting the effect to make it work on a light ground. */}

      {/* outer tick ring, pushed back in Z */}
      <div
        className={`absolute inset-0 ${reduced ? "" : "spin-slow"}`}
        style={{ transform: "translateZ(-24px)" }}
      >
        <svg viewBox="0 0 300 300" className="h-full w-full">
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const r1 = 140;
            const r2 = i % 5 === 0 ? 130 : 135;
            return (
              <line
                key={i}
                x1={tick(150 + Math.cos(a) * r1)}
                y1={tick(150 + Math.sin(a) * r1)}
                x2={tick(150 + Math.cos(a) * r2)}
                y2={tick(150 + Math.sin(a) * r2)}
                stroke="var(--rule-strong)"
                strokeWidth={i % 5 === 0 ? 1.4 : 0.7}
                opacity={i % 5 === 0 ? 0.9 : 0.6}
              />
            );
          })}
        </svg>
      </div>

      {/* the arc itself, pulled forward */}
      <svg
        viewBox="0 0 300 300"
        className="absolute inset-0 h-full w-full -rotate-90"
        style={{ transform: "translateZ(30px) rotate(-90deg)" }}
      >
        <defs>
          <linearGradient id="grasp-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e0a83a" />
            <stop offset="52%" stopColor="#c98a1f" />
            <stop offset="100%" stopColor="#2b6ee8" />
          </linearGradient>
        </defs>
        <circle
          cx="150"
          cy="150"
          r={R}
          fill="none"
          stroke="var(--paper-deep)"
          strokeWidth="14"
        />
        <motion.circle
          cx="150"
          cy="150"
          r={R}
          fill="none"
          stroke="url(#grasp-arc)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={inView ? { strokeDashoffset: C * (1 - SCORE / 100) } : {}}
          transition={{ duration: reduced ? 0 : 1.9, ease: EASE }}
        />
      </svg>

      {/* label plane, furthest forward */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ transform: "translateZ(56px)" }}
      >
        <span className="font-display text-[4.2rem] leading-none text-graphite">
          <AnimatedNumber value={SCORE} duration={1.9} />
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.26em] text-gold-ink">
          {BRAND.score.name}
        </span>
        <span className="mt-3 rounded-full border border-grass/30 bg-grass/10 px-2.5 py-0.5 text-[10px] text-grass-ink">
          ▲ 37 after one loop
        </span>
      </div>
    </div>
  );
}

function Dimension({
  dim,
  index,
}: {
  dim: (typeof DIMENSIONS)[number];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-18% 0px" });

  return (
    <motion.div
      ref={ref}
      className="card-paper group rounded-2xl p-5 transition-colors duration-400 hover:border-graphite-faint"
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15% 0px" }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: EASE }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-display text-lg text-graphite">
          {dim.name}
          <span className="ml-2 font-sans text-[11px] font-normal text-graphite-faint">
            weight {dim.weight.toFixed(1)}
          </span>
        </h3>
        <span className="font-display text-lg tabular-nums" style={{ color: dim.color }}>
          <AnimatedNumber value={dim.pct} />
        </span>
      </div>

      {/* Flat fill, no glow — a bloom around a bar reads as light on a dark
          surface; on paper it just looks like a printing smudge. */}
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-paper-deep">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: dim.color }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${dim.pct}%` } : {}}
          transition={{ duration: 1.3, delay: 0.25 + index * 0.1, ease: EASE }}
        />
      </div>

      <p className="mt-3 text-[11px] uppercase tracking-[0.16em] text-graphite-faint">
        {dim.unit}
      </p>
      <p className="mt-1.5 max-h-0 overflow-hidden text-xs leading-relaxed text-graphite-muted opacity-0 transition-all duration-500 group-hover:max-h-32 group-hover:opacity-100">
        {dim.how}
      </p>
    </motion.div>
  );
}
