"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";
import { EASE, Eyebrow, Reveal, WordReveal, useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   06 — Three modes, one engine
   Cards share a single perspective frustum: hovering one pulls it
   toward the viewer in Z while its neighbours recede and desaturate.
   ═══════════════════════════════════════════════════════════════ */

const MODES = [
  {
    id: "explain",
    label: "Explain",
    persona: "A confused classmate",
    speaker: "Classmate",
    tone: "gold",
    glyph: "🙋",
    body: "Asks 2–4 follow-ups aimed at the gaps the engine actually detected. Warm, never lectures, one question at a time.",
    transcript: [
      { who: "them", line: "Wait — you said the plant “makes food”. Made out of what, though?" },
      { who: "you", line: "Out of CO₂ from the air and water from the roots." },
      { who: "them", line: "Okay, and what's doing the sticking-together part?" },
    ],
  },
  {
    id: "viva",
    label: "Viva",
    persona: "An examiner",
    speaker: "Examiner",
    tone: "cobalt",
    glyph: "🎓",
    body: "Cross-questions you, builds “why” chains, and presses hardest exactly where your weakest answer was.",
    transcript: [
      { who: "them", line: "You claimed chlorophyll “absorbs energy”. Absorbs it into what?" },
      { who: "you", line: "Into electrons — it excites them." },
      { who: "them", line: "Then why does the plant need water at all?" },
    ],
  },
  {
    id: "loop",
    label: "Loop",
    persona: "A micro-tutor",
    speaker: "Tutor",
    tone: "grass",
    glyph: "↻",
    body: "Finds gaps → teaches only the fuzzy parts in ≤150 words → “now explain it back” → re-scores → shows you the delta.",
    transcript: [
      { who: "them", line: "Two nodes are uncovered: the light reaction, and where O₂ comes from." },
      { who: "them", line: "Here's 120 words on just those. Now explain it back." },
      { who: "you", line: "Grasp 41 → 78" },
    ],
  },
] as const;

const TONE = {
  gold: {
    text: "text-gold-ink",
    dot: "var(--gold)",
    ring: "rgba(201,138,31,0.45)",
    wash: "rgba(201,138,31,0.09)",
  },
  cobalt: {
    text: "text-cobalt-ink",
    dot: "var(--cobalt)",
    ring: "rgba(43,110,232,0.4)",
    wash: "rgba(43,110,232,0.08)",
  },
  grass: {
    text: "text-grass-ink",
    dot: "var(--grass)",
    ring: "rgba(47,158,79,0.4)",
    wash: "rgba(47,158,79,0.08)",
  },
} as const;

export default function Modes() {
  const [hover, setHover] = useState<number | null>(null);
  const reduced = useReducedMotion();

  return (
    <section
      id="modes"
      className="theme-paper paper-field section-anchor relative overflow-hidden px-6 py-28 md:py-36"
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <Eyebrow tone="cobalt">Three modes</Eyebrow>
          </Reveal>
          <h2 className="mt-6 font-display text-[clamp(2rem,4.2vw,3.2rem)] leading-[1.06] text-graphite">
            <WordReveal text="One engine." />{" "}
            <span className="marker text-graphite">
              <WordReveal text="Three people to teach." delay={0.16} />
            </span>
          </h2>
          <Reveal delay={0.15}>
            <p className="mt-5 text-[15px] leading-relaxed text-graphite-muted">
              Same scoring pipeline underneath — only the persona changes. Pick the one
              that matches what you’re preparing for.
            </p>
          </Reveal>
        </div>

        <div
          className="stage-3d mt-14 grid gap-6 md:grid-cols-3"
          onPointerLeave={() => setHover(null)}
        >
          {MODES.map((m, i) => {
            const t = TONE[m.tone];
            const isHot = hover === i;
            const dimmed = hover !== null && !isHot;

            return (
              <motion.article
                key={m.id}
                className="layer-3d group relative"
                onPointerEnter={() => setHover(i)}
                initial={reduced ? { opacity: 1 } : { opacity: 0, y: 40, rotateY: -12 }}
                whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
                viewport={{ once: true, margin: "-15% 0px" }}
                transition={{ duration: 0.8, delay: i * 0.11, ease: EASE }}
              >
                <motion.div
                  className="layer-3d relative h-full overflow-hidden rounded-3xl border bg-ink-800/40 p-6 md:p-7"
                  animate={
                    reduced
                      ? undefined
                      : {
                          z: isHot ? 58 : dimmed ? -28 : 0,
                          rotateX: isHot ? -4 : 0,
                          opacity: dimmed ? 0.55 : 1,
                          borderColor: isHot ? t.ring : "var(--ink-600)",
                        }
                  }
                  transition={{ duration: 0.55, ease: EASE }}
                  style={{ boxShadow: isHot ? `0 40px 90px -50px ${t.dot}` : undefined }}
                >
                  {/* wash that blooms from the top on hover */}
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-40"
                    animate={{ opacity: isHot ? 1 : 0 }}
                    transition={{ duration: 0.5 }}
                    style={{
                      background: `linear-gradient(180deg, ${t.wash}, transparent)`,
                    }}
                  />

                  <div className="relative flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                      style={{ background: t.wash, border: `1px solid ${t.ring}` }}
                    >
                      {m.glyph}
                    </span>
                    <div>
                      <h3 className="font-display text-xl text-chalk">{m.label}</h3>
                      <p className={`text-[11px] uppercase tracking-[0.16em] ${t.text}`}>
                        {m.persona}
                      </p>
                    </div>
                  </div>

                  <p className="relative mt-5 text-sm leading-relaxed text-chalk-dim">
                    {m.body}
                  </p>

                  {/* transcript sits forward of the card face */}
                  <div
                    className="relative mt-6 space-y-2 border-t border-ink-700 pt-5"
                    style={reduced ? undefined : { transform: "translateZ(22px)" }}
                  >
                    {m.transcript.map((l, k) => (
                      <motion.p
                        key={k}
                        className={`rounded-xl px-3 py-2 text-[11.5px] leading-snug ${
                          l.who === "you"
                            ? "ml-6 bg-ink-700/60 text-chalk"
                            : "mr-3 bg-ink-850/80 text-chalk-dim"
                        }`}
                        animate={{ opacity: isHot ? 1 : 0.72 }}
                        transition={{ duration: 0.4, delay: isHot ? k * 0.07 : 0 }}
                      >
                        {l.who === "them" && (
                          <span className={`mr-1.5 ${t.text}`}>{m.speaker}</span>
                        )}
                        {l.line}
                      </motion.p>
                    ))}
                  </div>

                  <Link
                    href={`/#classroom`}
                    className={`relative mt-6 inline-flex items-center gap-1.5 text-xs ${t.text} transition-transform duration-300 group-hover:translate-x-1`}
                  >
                    Run {m.label} mode
                    <span>→</span>
                  </Link>
                </motion.div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
