"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { EASE, Eyebrow, Reveal, useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   02 — The problem
   Centered text layout over a deeply blurred, slowly animating
   cloud field that visually continues the smoke from the hero
   section above.
   ═══════════════════════════════════════════════════════════════ */

const headlineReveal = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.72, delay: 0.08, ease: EASE } },
};

export default function Problem() {
  const reduced = useReducedMotion();

  return (
    <section
      id="problem"
      className="theme-paper cloud-field section-anchor relative overflow-hidden px-6 py-20 min-h-screen flex flex-col justify-center"
    >
      {/* ── full-section cloud layer ─────────────────────────────────────────
          Seven white blobs spread across the whole section, blurred heavily
          so they read as volumetric sky-clouds rather than shapes. Each uses
          one of the three fog-drift keyframes at a different delay so they
          drift independently. */}
      {!reduced && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-0" style={{ filter: "blur(60px)", opacity: 0.85 }}>
            <div className="absolute left-[-10%] top-[0%] h-[400px] w-[600px] rounded-full bg-white" style={{ animation: "fog-drift-a 18s infinite alternate ease-in-out" }} />
            <div className="absolute right-[-5%] top-[10%] h-[500px] w-[500px] rounded-full bg-white" style={{ animation: "fog-drift-b 24s infinite alternate ease-in-out -4s" }} />
            <div className="absolute left-[20%] top-[30%] h-[400px] w-[700px] rounded-full bg-white" style={{ animation: "fog-drift-c 20s infinite alternate ease-in-out -8s" }} />
            <div className="absolute right-[10%] top-[40%] h-[600px] w-[600px] rounded-full bg-white" style={{ animation: "fog-drift-a 26s infinite alternate ease-in-out -12s" }} />
            <div className="absolute left-[-5%] top-[60%] h-[500px] w-[600px] rounded-full bg-white" style={{ animation: "fog-drift-b 22s infinite alternate ease-in-out -16s" }} />
            <div className="absolute right-[20%] top-[70%] h-[400px] w-[800px] rounded-full bg-white" style={{ animation: "fog-drift-c 25s infinite alternate ease-in-out -2s" }} />
            <div className="absolute left-[10%] top-[85%] h-[600px] w-[700px] rounded-full bg-white" style={{ animation: "fog-drift-a 21s infinite alternate ease-in-out -10s" }} />
          </div>
        </div>
      )}

      {/* The seam where the hero's paper meets this section's tint */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 z-10 h-px w-[min(1100px,90vw)] -translate-x-1/2"
        style={{
          background: "linear-gradient(90deg, transparent, var(--rule-strong), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2">
        <Reveal from="left">
          <Image 
            src="/problem-desk.png" 
            alt="Desk Illustration" 
            width={560} 
            height={400} 
            className="mx-auto h-auto w-full max-w-lg object-contain" 
            priority
          />
        </Reveal>

        <div>
          <Reveal>
            <Eyebrow tone="grass">The problem</Eyebrow>
          </Reveal>

          <h2 className="mt-6 font-display text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.08] text-graphite">
            <motion.span
              className="inline-block"
              initial={reduced ? "show" : "hidden"}
              whileInView="show"
              viewport={{ once: true, margin: "-15% 0px" }}
              variants={headlineReveal}
            >
              We turn <Pill>confusion</Pill> into confidence.
            </motion.span>
          </h2>

          <Reveal delay={0.2}>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-graphite-muted">
              The gap between recognising an idea and being able to reconstruct it is
              where every exam surprise lives. Lucid is built on the Feynman technique
              and the protégé effect: the fastest way to find the edge of your
              understanding is to try to teach it.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mx-1 inline-block -rotate-1 rounded-full px-5 py-1 font-display italic text-graphite"
      style={{ background: "var(--highlighter)" }}
    >
      {children}
    </span>
  );
}
