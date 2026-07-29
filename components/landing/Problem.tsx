"use client";

import { motion } from "framer-motion";

import { EASE, Eyebrow, Reveal, useReducedMotion } from "./Primitives";


const headlineReveal = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.72, delay: 0.08, ease: EASE } },
};

/**
 * Three failures, each carried by a different accent this palette can supply
 * on paper (`--grass`/`--cobalt` are true fills; the third card is carried
 * by the highlighter wash, since there's no third saturated accent to spend).
 */


/* ═══════════════════════════════════════════════════════════════
   02 — The problem
   A single hero-style block: a slowly hand-drawn desk illustration
   on one side, the thesis on the other. Modelled on a reference
   layout (illustration left, pill-accented headline right) but
   redrawn in this page's own flat-poster grammar and colour tokens
   rather than importing the reference's palette.
   ═══════════════════════════════════════════════════════════════ */

export default function Problem() {
  const reduced = useReducedMotion();

  return (
    <section
      id="problem"
      className="theme-paper cloud-field section-anchor relative overflow-hidden px-6 py-28 pb-[32rem] md:py-36 md:pb-[44rem]"
    >
      {/* ── full-section cloud layer ─────────────────────────────────────────
          Seven white blobs spread across the whole section, blurred heavily
          so they read as volumetric sky-clouds rather than shapes. Each uses
          one of the three fog-drift keyframes at a different delay so they
          never move in sync. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* top-left cluster */}
        <div className="fog-blob-a absolute" style={{ top: "-10%", left: "-8%", width: "55%", height: "55%", borderRadius: "50%", background: "radial-gradient(ellipse at 55% 50%, rgba(255,255,255,0.82) 0%, transparent 68%)", filter: "blur(52px)" }} />
        {/* top-right bloom */}
        <div className="fog-blob-b absolute" style={{ top: "-5%", right: "-10%", width: "50%", height: "48%", borderRadius: "50%", background: "radial-gradient(ellipse at 45% 55%, rgba(255,255,255,0.75) 0%, transparent 65%)", filter: "blur(60px)", animationDelay: "-6s" }} />
        {/* mid-left */}
        <div className="fog-blob-c absolute" style={{ top: "28%", left: "5%", width: "42%", height: "40%", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.68) 0%, transparent 62%)", filter: "blur(44px)", animationDelay: "-3s" }} />
        {/* mid-right */}
        <div className="fog-blob-a absolute" style={{ top: "30%", right: "2%", width: "48%", height: "44%", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.72) 0%, transparent 65%)", filter: "blur(56px)", animationDelay: "-9s" }} />
        {/* centre wide band */}
        <div className="fog-blob-b absolute" style={{ top: "40%", left: "20%", width: "60%", height: "35%", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 60%, rgba(255,255,255,0.65) 0%, transparent 60%)", filter: "blur(64px)", animationDelay: "-14s" }} />
        {/* bottom-left */}
        <div className="fog-blob-c absolute" style={{ bottom: "-5%", left: "-5%", width: "65%", height: "50%", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 80%, rgba(255,255,255,0.78) 0%, transparent 70%)", filter: "blur(48px)", animationDelay: "-7s" }} />
        {/* bottom-right */}
        <div className="fog-blob-a absolute" style={{ bottom: "-15%", right: "-8%", width: "58%", height: "55%", borderRadius: "50%", background: "radial-gradient(ellipse at 50% 85%, rgba(255,255,255,0.7) 0%, transparent 68%)", filter: "blur(52px)", animationDelay: "-11s" }} />
      </div>

      <div className="relative mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center gap-0 lg:grid lg:grid-cols-2 lg:gap-12">
        <Reveal from="left" className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/problem-desk.png"
            alt="A person sitting at a desk on a video call, with a plant and lamp nearby"
            className="h-auto w-full object-contain"
            draggable={false}
          />
        </Reveal>

        <div className="flex flex-col items-start justify-center px-4 lg:px-8">
          <Reveal>
            <Eyebrow tone="grass">The problem</Eyebrow>
          </Reveal>

          <h2 className="mt-6 font-display text-[clamp(2.2rem,4.8vw,4rem)] leading-[1.06] text-graphite">
            {/* `motion.span`, not `Reveal` (a div): this sits inside an <h2>,
                where a block-level child is invalid markup. */}
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
            <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-graphite-muted">
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

/**
 * A word set inside a rounded capsule — the reference's device for one
 * emphasised word, redrawn with this page's own tokens (highlighter wash,
 * graphite ink, the display serif in italic) instead of the reference's
 * orange, so it reads as this brand's mark rather than a borrowed one.
 */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mx-1 inline-block -rotate-1 rounded-full px-4 py-0.5 font-display italic text-graphite"
      style={{ background: "var(--highlighter)" }}
    >
      {children}
    </span>
  );
}


