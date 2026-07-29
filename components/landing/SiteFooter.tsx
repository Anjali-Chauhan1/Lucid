"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BRAND } from "@/lib/brand";
import { EASE, Reveal, useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   09 — Footer
   The wordmark rises out of the base as the page bottoms out.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Trimmed to two columns: "Product" used to also link out to Grasp Score,
 * the parrot detector, and the three modes, and "Under the hood" existed
 * almost entirely to point at those same now-removed sections. Neither
 * column has anywhere left to send a click, so rather than leave dead
 * anchors in place they're gone rather than patched.
 */
const COLUMNS = [
  {
    title: "Product",
    links: [{ label: "How it works", href: "#how" }],
  },
  {
    title: "Start",
    links: [
      { label: "Teach a concept", href: "/teacher" },
      { label: "My progress", href: "/progress" },
      { label: "For teachers", href: "/teacher" },
    ],
  },
] as const;

export default function SiteFooter() {
  const reduced = useReducedMotion();

  return (
    /* `mt-10`, not `pt-10`, deliberately doesn't exist here: a margin sits
       outside this element's own painted background, so it would expose
       the page's raw dark body background for that gap instead of this
       section's paper tone — exactly the seam that was showing before this
       became `pt-20` doing double duty as both the visual gap and padding
       that stays inside the painted box. */
    <footer className="theme-paper paper-field relative overflow-hidden border-t border-rule px-6 pt-28">
      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-[1.3fr_2fr]">
          <div>
            <Reveal>
              <p className="font-display text-2xl text-graphite">{BRAND.name}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-gold-ink">
                {BRAND.tagline}
              </p>
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-graphite-muted">
                {BRAND.heroLine}
              </p>
            </Reveal>

            <Reveal delay={0.12}>
              <Link
                href="/teacher"
                className="relative mt-7 inline-flex overflow-hidden rounded-full bg-graphite px-6 py-3 text-sm font-semibold text-paper transition hover:bg-black"
              >
                Start teaching →
              </Link>
            </Reveal>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-8"
          >
            {COLUMNS.map((col, i) => (
              <Reveal key={col.title} delay={i * 0.08}>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-graphite-faint">
                  {col.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="group inline-flex items-center gap-1.5 text-sm text-graphite-muted transition hover:text-graphite"
                      >
                        <span className="h-px w-0 bg-gold transition-all duration-300 group-hover:w-3" />
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </nav>
        </div>

        {/* technical honesty note */}
        <Reveal delay={0.1}>
          <p className="mt-16 max-w-3xl border-t border-rule pt-6 text-xs leading-relaxed text-graphite-faint">
            Scores are produced by an on-device ML pipeline — MiniLM embeddings, a DeBERTa
            NLI cross-encoder, and a trained classifier — running independently of the
            conversational AI. The model you talk to never decides your number.
          </p>
        </Reveal>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 pb-4 text-[11px] text-graphite-faint">
          <span>
            © {new Date().getFullYear()} {BRAND.name}. Built on the Feynman technique and
            the protégé effect.
          </span>
          <Link href="#hero" className="transition hover:text-gold-ink">
            Back to top ↑
          </Link>
        </div>

        {/* Oversized wordmark. Driven by whileInView rather than useScroll:
            the footer sits flush with the document bottom, so a scroll range
            ending at "end end" never actually advances. */}
        <motion.p
          aria-hidden
          className="select-none pt-6 text-center font-display leading-[0.78] tracking-tight"
          initial={reduced ? { opacity: 0.5 } : { opacity: 0, y: 70 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -10% 0px" }}
          transition={{ duration: 1.1, ease: EASE }}
        >
          <span
            className="block text-[clamp(4rem,20vw,15rem)]"
            style={{
              // Fades toward the page's own colour at the foot, not toward
              // black — the dark theme faded this into --ink-900; on paper
              // the letters need to melt into --paper instead for the same
              // "sinking into the bottom of the page" read.
              background: "linear-gradient(180deg, rgba(201,138,31,0.5), rgba(242,241,236,0.4) 82%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {BRAND.name}
          </span>
        </motion.p>
      </div>
    </footer>
  );
}

/** Re-exported so the page can stagger the footer in with the same curve. */
export { EASE };
