"use client";

import { AnimatePresence, motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { EASE, Eyebrow, Reveal, WordReveal, useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   05 — USP 2: Parrot Detector
   Two samples, two signals. The demo exists to show the one thing
   a static list can't: high semantic similarity on its own does
   NOT mean recitation. Both meters have to fire.
   ═══════════════════════════════════════════════════════════════ */

const SAMPLES = [
  {
    id: "recited",
    tab: "Recited",
    text: "Photosynthesis is the process by which green plants and certain other organisms transform light energy into chemical energy, using chlorophyll to convert carbon dioxide and water into glucose and oxygen.",
    semantic: 0.94,
    ngram: 0.71,
    verdict: "parrot",
  },
  {
    id: "own",
    tab: "Own words",
    text: "So the leaf basically catches sunlight, and uses that energy to stick CO₂ and water together into sugar — the oxygen is just what's left over once it's pulled the hydrogen off the water.",
    semantic: 0.81,
    ngram: 0.06,
    verdict: "own",
  },
] as const;

const THRESHOLD = { semantic: 0.72, ngram: 0.35 };

export default function ParrotDetector() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { margin: "-30% 0px -30% 0px" });
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-cycles only while on screen, so it never animates off-view.
  useEffect(() => {
    if (!inView || paused || reduced) return;
    const t = setInterval(() => setI((v) => (v + 1) % SAMPLES.length), 4600);
    return () => clearInterval(t);
  }, [inView, paused, reduced]);

  const s = SAMPLES[i];
  const isParrot = s.verdict === "parrot";

  return (
    <section
      ref={ref}
      id="parrot"
      className="theme-paper paper-field section-anchor relative overflow-hidden px-6 py-28 md:py-36"
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <Eyebrow tone="cobalt">USP 02 — the memorisation detector</Eyebrow>
          </Reveal>
          <h2 className="mt-6 font-display text-[clamp(2rem,4.2vw,3.2rem)] leading-[1.06] text-graphite">
            <WordReveal text="Say it right, or say it yourself?" />
          </h2>
          <Reveal delay={0.15}>
            <p className="mt-5 text-[15px] leading-relaxed text-graphite-muted">
              Two signals, and both must fire. Semantic similarity alone only proves you
              were <em className="text-graphite">correct</em>. It’s recitation only when the
              exact phrasing overlaps too.
            </p>
          </Reveal>
        </div>

        <div
          className="mt-14 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
        >
          {/* ── the sample ────────────────────────────── */}
          <Reveal from="left">
            {/* Was `.ring-gradient`: a hairline border built from low-alpha
                amber/violet/sky, tuned to glow against `--ink-850`. Those same
                alphas against white paper would barely register, so this
                drops the effect for the section's usual flat card instead of
                trying to rescue a glow that only works on a dark ground. */}
            <div className="card-paper relative overflow-hidden rounded-3xl p-6 md:p-8">
              {/* tabs */}
              <div className="flex gap-2" role="tablist" aria-label="Explanation sample">
                {SAMPLES.map((x, idx) => (
                  <button
                    key={x.id}
                    role="tab"
                    aria-selected={i === idx}
                    onClick={() => setI(idx)}
                    className={`relative rounded-full px-4 py-1.5 text-xs transition ${
                      i === idx ? "text-paper" : "text-graphite-muted hover:text-graphite"
                    }`}
                  >
                    {i === idx && (
                      <motion.span
                        layoutId="parrot-tab"
                        className="absolute inset-0 rounded-full bg-graphite"
                        transition={{ type: "spring", stiffness: 340, damping: 30 }}
                      />
                    )}
                    <span className="relative font-medium">{x.tab}</span>
                  </button>
                ))}
                <span className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-graphite-faint">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-grass" />
                  live
                </span>
              </div>

              <p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-graphite-faint">
                Student explains · Photosynthesis
              </p>

              <div className="mt-3 min-h-[132px]">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={s.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.45, ease: EASE }}
                    className={`text-[15px] leading-relaxed ${
                      isParrot ? "text-graphite-muted" : "text-graphite"
                    }`}
                  >
                    {s.text}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* verdict */}
              <div className="mt-6 border-t border-rule pt-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={s.verdict}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className="flex items-start gap-3"
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
                        isParrot
                          ? "bg-rose-paper/15 text-rose-paper-ink ring-1 ring-rose-paper/40"
                          : "bg-grass/15 text-grass-ink ring-1 ring-grass/40"
                      }`}
                    >
                      {isParrot ? "🦜" : "✓"}
                    </span>
                    <div>
                      <p
                        className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                          isParrot ? "text-rose-paper-ink" : "text-grass-ink"
                        }`}
                      >
                        {isParrot ? "Parrot detected" : "Explained in your own words"}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-graphite-muted">
                        {isParrot ? (
                          <em>“{BRAND.parrot.challenge}”</em>
                        ) : (
                          "Correct and reconstructed — the phrasing is yours, so the understanding is too. Score it."
                        )}
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Reveal>

          {/* ── the two signals ───────────────────────── */}
          <Reveal from="right" delay={0.1}>
            <div className="flex h-full flex-col gap-4">
              <Signal
                label="Semantic similarity"
                sub="embedding cosine vs stored textbook phrasings"
                value={s.semantic}
                threshold={THRESHOLD.semantic}
              />
              <Signal
                label="N-gram overlap"
                sub="trigram containment of the textbook phrasing"
                value={s.ngram}
                threshold={THRESHOLD.ngram}
              />

              <div className="card-paper mt-auto rounded-2xl p-5">
                <p className="font-mono text-[11px] leading-relaxed text-graphite-faint">
                  <span className="text-cobalt-ink">if</span> semantic{" "}
                  <span className="text-gold-ink">≥ {THRESHOLD.semantic}</span>{" "}
                  <span className="text-cobalt-ink">and</span> ngram{" "}
                  <span className="text-gold-ink">≥ {THRESHOLD.ngram}</span>
                  <br />
                  <span className="pl-4 text-rose-paper-ink">→ recitation</span>
                  <br />
                  <span className="text-cobalt-ink">else</span>
                  <span className="pl-2 text-grass-ink">→ their own words</span>
                </p>
                <p className="mt-3 border-t border-rule pt-3 text-[11px] leading-relaxed text-graphite-muted">
                  Either signal alone gets fooled. That&apos;s why a trained classifier
                  weighs both — not a prompt asking the model to guess.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** A meter with a threshold marker; the bar goes red only once it crosses. */
function Signal({
  label,
  sub,
  value,
  threshold,
}: {
  label: string;
  sub: string;
  value: number;
  threshold: number;
}) {
  const fired = value >= threshold;
  const color = fired ? "var(--rose-paper)" : "var(--grass)";

  return (
    <div className="card-paper rounded-2xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-graphite">{label}</h3>
        <motion.span
          key={value}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-lg tabular-nums"
          style={{ color }}
        >
          {value.toFixed(2)}
        </motion.span>
      </div>
      <p className="mt-1 text-[11px] text-graphite-faint">{sub}</p>

      {/* Flat fill, no glow — see the note on the same pattern in
          GraspScore's Dimension bars: a bloom reads as light on dark, and as
          a smudge on paper. */}
      <div className="relative mt-3.5 h-2 rounded-full bg-paper-deep">
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          animate={{ width: `${value * 100}%`, background: color }}
          transition={{ duration: 0.9, ease: EASE }}
        />
        {/* threshold marker */}
        <span
          className="absolute -top-1 h-4 w-px bg-graphite-faint"
          style={{ left: `${threshold * 100}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-graphite-faint">
        <span>0.00</span>
        <span style={{ color: fired ? color : undefined }}>
          {fired ? "▲ over threshold" : "under threshold"}
        </span>
        <span>1.00</span>
      </div>
    </div>
  );
}
