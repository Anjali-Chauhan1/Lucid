"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BRAND } from "@/lib/brand";
import { EASE, Reveal, useReducedMotion } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   09 — Footer
   The wordmark rises out of the base as the page bottoms out.
   Recoloured to bookend the page's last section (HazardousWaste):
   that section opens on dark teal and closes on lavender, so the
   footer closes the loop back to teal — the same two tones, same
   hex values, just inverted from card to full page.
   ═══════════════════════════════════════════════════════════════ */

const BG_COLOR     = "#e4e2db"; // Darker paper tone for contrast
const TEXT_COLOR   = "#1a1a1a"; // Graphite text
const ACCENT_COLOR = "var(--highlighter)"; // Yellow accent
const MUTED_COLOR  = "rgba(26,26,26,0.55)"; // Muted graphite

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
       the page's raw body background for that gap instead of this
       section's own tone — exactly the seam that was showing before this
       became `pt-20` doing double duty as both the visual gap and padding
       that stays inside the painted box. */
    <footer
      className="theme-paper paper-field relative overflow-hidden px-6 pt-28"
      style={{ backgroundColor: BG_COLOR, borderTop: `1px solid rgba(26,26,26,0.1)` }}
    >
      <div className="relative mx-auto max-w-6xl">
        <div className="grid gap-12 md:grid-cols-[1.3fr_2fr]">
          <div>
            <Reveal>
              <p className="font-display text-2xl" style={{ color: TEXT_COLOR }}>{BRAND.name}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ color: TEXT_COLOR }}>
                {BRAND.tagline}
              </p>
              <p className="mt-5 max-w-xs text-sm leading-relaxed" style={{ color: MUTED_COLOR }}>
                {BRAND.heroLine}
              </p>
            </Reveal>

            <Reveal delay={0.12}>
              <Link
                href="/learn"
                className="relative mt-7 inline-flex overflow-hidden rounded-full px-6 py-3 text-sm font-bold transition hover:brightness-105"
                style={{ background: TEXT_COLOR, color: BG_COLOR }}
              >
                Start learning →
              </Link>
            </Reveal>
          </div>

          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-8"
          >
            {COLUMNS.map((col, i) => (
              <Reveal key={col.title} delay={i * 0.08}>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: MUTED_COLOR }}>
                  {col.title}
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="group inline-flex items-center gap-1.5 text-sm transition font-medium"
                        style={{ color: "rgba(26,26,26,0.7)" }}
                      >
                        <span
                          className="h-px w-0 transition-all duration-300 group-hover:w-3"
                          style={{ background: TEXT_COLOR }}
                        />
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
          <p
            className="mt-16 max-w-3xl pt-6 text-xs leading-relaxed"
            style={{ borderTop: "1px solid rgba(26,26,26,0.1)", color: MUTED_COLOR }}
          >
            Scores are produced by an on-device ML pipeline — MiniLM embeddings, a DeBERTa
            NLI cross-encoder, and a trained classifier — running independently of the
            conversational AI. The model you talk to never decides your number.
          </p>
        </Reveal>

        <div
          className="mt-8 flex flex-wrap items-center justify-between gap-4 pb-4 text-[11px] font-medium"
          style={{ color: MUTED_COLOR }}
        >
          <span>
            © {new Date().getFullYear()} {BRAND.name}. Built on the Feynman technique and
            the protégé effect.
          </span>
          <Link href="#hero" className="transition font-semibold hover:brightness-50" style={{ color: TEXT_COLOR }}>
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
              // Fades toward the footer's own background at the foot — the
              // wordmark reads as sinking into the page rather than just
              // stopping. Starts near the yellow the page arrives from,
              // ends melting into this section's own graphite.
              background: `linear-gradient(180deg, rgba(26,26,26,0.25), ${BG_COLOR} 82%)`,
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
