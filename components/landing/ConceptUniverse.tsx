"use client";

import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { EASE, Eyebrow, Reveal, WordReveal, useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   07 — Works on any topic
   The graph is the argument: the engine scores *features* — coverage,
   contradiction ratio, phrase overlap — never topic text. All it
   needs is a concept map, and it can build one for anything.

   Node coordinates are hand-placed (never random) so the server and
   client render byte-identical markup.
   ═══════════════════════════════════════════════════════════════ */

interface ConceptSummary {
  id: string;
  concept: string;
  subject: string;
  nodeCount: number;
}

/** viewBox is 420×340. */
const NODES: {
  id: string;
  x: number;
  y: number;
  r: number;
  label: string;
  core?: boolean;
}[] = [
  { id: "core", x: 210, y: 168, r: 30, label: "Photosynthesis", core: true },
  { id: "light", x: 74, y: 74, r: 19, label: "Light reaction" },
  { id: "chloro", x: 336, y: 66, r: 17, label: "Chlorophyll" },
  { id: "co2", x: 44, y: 214, r: 16, label: "CO₂ intake" },
  { id: "calvin", x: 352, y: 208, r: 20, label: "Calvin cycle" },
  { id: "glucose", x: 246, y: 300, r: 18, label: "Glucose" },
  { id: "oxygen", x: 118, y: 296, r: 15, label: "O₂ released" },
];

const EDGES = [
  ["core", "light"],
  ["core", "chloro"],
  ["core", "co2"],
  ["core", "calvin"],
  ["core", "glucose"],
  ["core", "oxygen"],
  ["light", "chloro"],
  ["light", "oxygen"],
  ["calvin", "glucose"],
  ["co2", "calvin"],
] as const;

/** Order in which the engine marks nodes covered as you keep explaining. */
const COVER_ORDER = ["core", "chloro", "light", "co2", "calvin", "glucose", "oxygen"];

const TICKER = [
  "Ohm's Law",
  "Supply and Demand",
  "Recursion",
  "Newton's Third Law",
  "Osmosis",
  "Big-O notation",
  "The Krebs cycle",
  "Opportunity cost",
  "Binary search",
  "Le Chatelier's principle",
  "Natural selection",
  "Bayes' theorem",
];

export default function ConceptUniverse({ concepts }: { concepts: ConceptSummary[] }) {
  return (
    <section id="topics" className="section-anchor relative overflow-hidden px-6 py-28 md:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[560px] w-[560px] -translate-x-1/2 rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle, rgba(90,209,154,0.11), transparent 62%)",
          filter: "blur(46px)",
        }}
      />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1fr]">
          {/* ── copy ────────────────────────────────────── */}
          <div>
            <Reveal>
              <Eyebrow tone="emerald">Any topic at all</Eyebrow>
            </Reveal>
            <h2 className="mt-6 font-display text-[clamp(2rem,4.2vw,3.2rem)] leading-[1.06] text-chalk">
              <WordReveal text="It doesn't know your subject." />{" "}
              <span className="text-emerald">
                <WordReveal text="It doesn't need to." delay={0.18} />
              </span>
            </h2>

            <Reveal delay={0.15}>
              <p className="mt-5 text-[15px] leading-relaxed text-chalk-dim">
                The engine scores <em className="text-chalk">features</em> — coverage,
                contradiction ratio, phrase overlap — not topic text. The only thing it
                needs is a concept map. Six are hand-authored; for anything else, one is
                generated on the spot, validated against a schema, weight-normalised to
                1.0, and cached.
              </p>
            </Reveal>

            <Reveal delay={0.25}>
              <ul className="mt-7 space-y-2.5">
                {[
                  "Nodes + weights, so coverage means something",
                  "Reference facts, so correctness is checkable",
                  "Textbook phrasings, so the parrot check has a baseline",
                  "Why-questions + misconceptions, so depth has somewhere to go",
                ].map((f, i) => (
                  <motion.li
                    key={f}
                    className="flex items-start gap-3 text-sm text-chalk-dim"
                    initial={{ opacity: 0, x: -14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-12% 0px" }}
                    transition={{ duration: 0.55, delay: i * 0.08, ease: EASE }}
                  >
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" />
                    {f}
                  </motion.li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.35}>
              <div className="mt-8 flex flex-wrap gap-2">
                {concepts.map((c) => (
                  <span
                    key={c.id}
                    className="rounded-full border border-ink-600 bg-ink-850/60 px-3 py-1.5 text-[11px] text-chalk-dim transition hover:border-emerald/40 hover:text-chalk"
                  >
                    {c.concept}
                    <span className="ml-1.5 text-chalk-faint">{c.nodeCount}</span>
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          {/* ── the graph ───────────────────────────────── */}
          <Reveal from="right">
            <ConceptGraph />
          </Reveal>
        </div>

        {/* ── topic ticker ──────────────────────────────── */}
        <Reveal delay={0.1}>
          <div className="relative mt-20 overflow-hidden border-y border-ink-700 py-5">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
              style={{ background: "linear-gradient(90deg, var(--ink-900), transparent)" }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
              style={{ background: "linear-gradient(-90deg, var(--ink-900), transparent)" }}
            />
            <div className="marquee-track gap-8">
              {[...TICKER, ...TICKER].map((t, i) => (
                <span
                  key={i}
                  className="flex shrink-0 items-center gap-8 font-display text-lg text-chalk-faint"
                >
                  {t}
                  <span className="h-1 w-1 rounded-full bg-amber/60" />
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/**
 * Edges draw first, then nodes ignite in COVER_ORDER — the same sequence
 * the coverage scorer walks. A live counter tracks the covered weight.
 */
function ConceptGraph() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });
  const reduced = useReducedMotion();
  const [covered, setCovered] = useState<string[]>([]);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- reduced-motion
         is a browser-only media query; skip the staged reveal and show the fully
         covered graph in a single commit. */
      setCovered(COVER_ORDER);
      return;
    }
    const timers = COVER_ORDER.map((id, i) =>
      setTimeout(() => setCovered((c) => [...c, id]), 700 + i * 420),
    );
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced]);

  const pos = (id: string) => NODES.find((n) => n.id === id)!;
  const pct = Math.round((covered.length / NODES.length) * 100);

  return (
    <div ref={ref} className="ring-gradient relative rounded-3xl bg-ink-850/60 p-5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-chalk-faint">
          Concept map · live coverage
        </p>
        <span className="font-display text-sm text-emerald tabular-nums">{pct}%</span>
      </div>

      <div className="stage-3d mt-3">
        <motion.svg
          viewBox="0 0 420 340"
          className="layer-3d h-auto w-full"
          animate={reduced ? undefined : { rotateX: [4, -4, 4], rotateY: [-5, 5, -5] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        >
          <defs>
            <radialGradient id="node-on">
              <stop offset="0%" stopColor="#8ff0c2" />
              <stop offset="100%" stopColor="#5ad19a" />
            </radialGradient>
            <radialGradient id="node-core">
              <stop offset="0%" stopColor="#ffd36e" />
              <stop offset="100%" stopColor="#f4b942" />
            </radialGradient>
          </defs>

          {/* edges */}
          {EDGES.map(([a, b], i) => {
            const A = pos(a);
            const B = pos(b);
            const live = covered.includes(a) && covered.includes(b);
            return (
              <g key={`${a}-${b}`}>
                <motion.line
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  stroke={live ? "rgba(90,209,154,0.5)" : "var(--ink-600)"}
                  strokeWidth={live ? 1.4 : 1}
                  initial={reduced ? undefined : { pathLength: 0, opacity: 0 }}
                  animate={inView ? { pathLength: 1, opacity: 1 } : {}}
                  transition={{ duration: 0.7, delay: i * 0.07, ease: EASE }}
                />
                {live && !reduced && (
                  <line
                    x1={A.x}
                    y1={A.y}
                    x2={B.x}
                    y2={B.y}
                    stroke="rgba(143,240,194,0.9)"
                    strokeWidth="1.6"
                    strokeDasharray="4 26"
                    className="dash-flow"
                  />
                )}
              </g>
            );
          })}

          {/* nodes */}
          {NODES.map((n, i) => {
            const on = covered.includes(n.id);
            return (
              <motion.g
                key={n.id}
                initial={reduced ? undefined : { opacity: 0, scale: 0.4 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ duration: 0.55, delay: 0.3 + i * 0.06, ease: EASE }}
                style={{ transformOrigin: `${n.x}px ${n.y}px` }}
              >
                {on && (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={n.r + 7}
                    fill="none"
                    stroke={n.core ? "var(--amber)" : "var(--emerald)"}
                    strokeWidth="1"
                    opacity="0.35"
                  />
                )}
                <motion.circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r}
                  animate={{
                    fill: on
                      ? n.core
                        ? "url(#node-core)"
                        : "url(#node-on)"
                      : "var(--ink-700)",
                  }}
                  transition={{ duration: 0.45 }}
                  stroke={on ? (n.core ? "var(--amber)" : "var(--emerald)") : "var(--ink-600)"}
                  strokeWidth="1.2"
                  style={{
                    filter: on
                      ? `drop-shadow(0 0 10px ${n.core ? "rgba(244,185,66,0.65)" : "rgba(90,209,154,0.55)"})`
                      : "none",
                  }}
                />
                <text
                  x={n.x}
                  y={n.y + n.r + 15}
                  textAnchor="middle"
                  className="fill-current font-sans"
                  style={{
                    fontSize: 10,
                    fill: on ? "var(--chalk-dim)" : "var(--chalk-faint)",
                  }}
                >
                  {n.label}
                </text>
              </motion.g>
            );
          })}
        </motion.svg>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-chalk-faint">
        Each node carries a weight. Coverage is the sum of the weights you actually
        explained — <span className="text-emerald">not</span> the number of words you said.
      </p>
    </div>
  );
}
