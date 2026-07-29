"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand";
import TopicLauncher from "@/components/TopicLauncher";
import { EASE, Eyebrow, Magnetic, Reveal, Tilt3D, WordReveal, useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   08 — Classroom, access, and the actual entry point
   The last section stops selling and starts the product: the real
   TopicLauncher lives here.
   ═══════════════════════════════════════════════════════════════ */

interface ConceptSummary {
  id: string;
  concept: string;
  subject: string;
  nodeCount: number;
}

const FLOW = [
  { n: "01", t: "Pick a concept + mode", d: "You choose what they teach back, and who they teach it to." },
  { n: "02", t: "Share the join code", d: "One code. Students land straight in the session — no accounts to set up." },
  { n: "03", t: "Read the class view", d: "Scores, yes — but more usefully, which misconceptions recur across students." },
] as const;

export default function Classroom({ concepts }: { concepts: ConceptSummary[] }) {
  const reduced = useReducedMotion();

  return (
    <section
      id="classroom"
      className="section-anchor relative overflow-hidden px-6 py-28 md:py-36"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full opacity-45"
        style={{
          background: "radial-gradient(ellipse, rgba(183,156,255,0.14), transparent 65%)",
          filter: "blur(50px)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        {/* ── teachers ──────────────────────────────────── */}
        <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <Reveal>
              <Eyebrow tone="violet">For teachers</Eyebrow>
            </Reveal>
            <h2 className="mt-6 font-display text-[clamp(2rem,4.2vw,3.2rem)] leading-[1.06] text-chalk">
              <WordReveal text="See the misconception the whole class shares." />
            </h2>
            <Reveal delay={0.15}>
              <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-chalk-dim">
                Assign a topic, hand out a join code, and every student runs the same{" "}
                {BRAND.score.name} and {BRAND.parrot.name} session. What comes back
                isn’t a leaderboard — it’s the pattern: the node nobody covered, the
                fact everyone contradicted.
              </p>
            </Reveal>

            <ol className="mt-8 space-y-3">
              {FLOW.map((s, i) => (
                <motion.li
                  key={s.n}
                  className="flex gap-4 rounded-xl border border-ink-600 bg-ink-800/35 p-4"
                  initial={reduced ? { opacity: 1 } : { opacity: 0, x: -18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-12% 0px" }}
                  transition={{ duration: 0.6, delay: i * 0.09, ease: EASE }}
                >
                  <span className="font-display text-sm text-violet">{s.n}</span>
                  <div>
                    <p className="text-sm font-medium text-chalk">{s.t}</p>
                    <p className="mt-1 text-xs leading-relaxed text-chalk-faint">{s.d}</p>
                  </div>
                </motion.li>
              ))}
            </ol>

            <Reveal delay={0.3}>
              <Link
                href="/teacher"
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-violet/40 px-6 py-3 text-sm text-violet transition hover:bg-violet/10"
              >
                Create an assignment
                <span>→</span>
              </Link>
            </Reveal>
          </div>

          {/* mock class view */}
          <Reveal from="right" delay={0.1}>
            <Tilt3D strength={9} className="rounded-3xl">
              <ClassCard />
            </Tilt3D>
          </Reveal>
        </div>

        {/* ── accessibility ─────────────────────────────── */}
        <Reveal>
          <div className="mt-24 overflow-hidden rounded-3xl border border-sky/25 bg-sky/[0.05] p-7 md:p-9">
            <div className="flex flex-wrap items-center gap-3">
              <Eyebrow tone="sky">No audio required</Eyebrow>
            </div>
            <h3 className="mt-5 font-display text-2xl text-chalk md:text-3xl">
              {BRAND.access.name}
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-chalk-dim">
              {BRAND.access.tagline}
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { i: "🎤 → ⌨️", t: "Speak or type — your choice, every time" },
                { i: "💬", t: "Persona questions are always text, never audio-only" },
                { i: "📄", t: "Reports, gaps and scores are fully readable" },
              ].map((x, k) => (
                <motion.li
                  key={x.t}
                  className="rounded-xl border border-ink-600 bg-ink-850/60 px-4 py-3.5 text-xs leading-relaxed text-chalk-dim"
                  initial={reduced ? { opacity: 1 } : { opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-10% 0px" }}
                  transition={{ duration: 0.6, delay: k * 0.08, ease: EASE }}
                >
                  <span className="mr-2">{x.i}</span>
                  {x.t}
                </motion.li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* ── the launcher ──────────────────────────────── */}
        <div id="start" className="section-anchor mt-24 text-center">
          <Reveal>
            <Eyebrow tone="amber">Your turn</Eyebrow>
          </Reveal>
          <h2 className="mx-auto mt-6 max-w-3xl font-display text-[clamp(2.1rem,5vw,3.6rem)] leading-[1.04] text-chalk">
            <WordReveal text="So — what will you teach?" />
          </h2>
          <Reveal delay={0.15}>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-chalk-dim">
              Pick a prepared concept, or type any topic at all — a concept map gets built
              for it on the spot.
            </p>
          </Reveal>

          <Reveal delay={0.22}>
            <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-ink-600 bg-ink-850/50 p-6 text-left md:p-8">
              <TopicLauncher concepts={concepts} />
            </div>
          </Reveal>

          <Reveal delay={0.3}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Magnetic>
                <Link
                  href="/progress"
                  className="rounded-full border border-ink-600 px-6 py-3 text-sm text-chalk-dim transition hover:border-chalk-faint hover:text-chalk"
                >
                  See my progress
                </Link>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Mock of the teacher's class view — three depth planes inside one tilt. */
function ClassCard() {
  const rows = [
    { name: "Aarav K.", score: 82, tag: "Own words", tone: "emerald" },
    { name: "Meera S.", score: 64, tag: "Missed: light reaction", tone: "amber" },
    { name: "Dev P.", score: 47, tag: "Parrot ×2", tone: "rose" },
    { name: "Ishita R.", score: 71, tag: "Own words", tone: "emerald" },
  ] as const;

  const toneText = {
    emerald: "text-emerald bg-emerald/10 ring-emerald/25",
    amber: "text-amber bg-amber/10 ring-amber/25",
    rose: "text-rose bg-rose/10 ring-rose/25",
  } as const;

  return (
    <div className="layer-3d ring-gradient relative rounded-3xl bg-ink-850/70 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-chalk-faint">
            Assignment · Photosynthesis · Loop
          </p>
          <p className="mt-1 font-display text-xl text-chalk">Class 9-B</p>
        </div>
        <span className="rounded-lg border border-violet/30 bg-violet/10 px-3 py-1.5 font-mono text-sm text-violet">
          K7QX2
        </span>
      </div>

      <div className="mt-5 space-y-2" style={{ transform: "translateZ(26px)" }}>
        {rows.map((r, i) => (
          <motion.div
            key={r.name}
            className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-800/60 px-3.5 py-2.5"
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.08, ease: EASE }}
          >
            <span className="w-20 shrink-0 truncate text-xs text-chalk">{r.name}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
              <motion.span
                className="block h-full rounded-full bg-gradient-to-r from-amber/50 to-amber"
                initial={{ width: 0 }}
                whileInView={{ width: `${r.score}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.35 + i * 0.08, ease: EASE }}
              />
            </div>
            <span className="w-7 shrink-0 text-right font-display text-sm tabular-nums text-chalk">
              {r.score}
            </span>
            <span
              className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] ring-1 sm:block ${toneText[r.tone]}`}
            >
              {r.tag}
            </span>
          </motion.div>
        ))}
      </div>

      <div
        className="mt-5 rounded-xl border border-rose/25 bg-rose/[0.07] px-4 py-3"
        style={{ transform: "translateZ(42px)" }}
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose">
          Class-wide pattern
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-chalk-dim">
          11 of 14 students said the plant “takes in oxygen at night instead” — the same
          misconception, from the same textbook line.
        </p>
      </div>
    </div>
  );
}

/** Kept for callers that want the section heading pattern elsewhere. */
export function SectionNote({ children }: { children: ReactNode }) {
  return <p className="text-xs text-chalk-faint">{children}</p>;
}
