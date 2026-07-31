"use client";

import Link from "next/link";
import { motion, useScroll, useSpring, useMotionValueEvent } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { EASE } from "./Primitives";

/**
 * The landing sections, in scroll order. Drives both the nav and the rail.
 *
 * Was eight; Grasp Score, the parrot detector, three modes, the concept
 * universe, and Classroom were pulled off the page and deleted, so this
 * list — and the section rail it draws — shrank to match what's actually
 * on the page.
 */
export const SECTIONS = [
  { id: "hero", label: "Lucid", short: "01" },
  { id: "problem", label: "The problem", short: "02" },
  { id: "how", label: "How it works", short: "03" },
] as const;

/** Top-level nav. Short enough now to sit flat, no dropdown needed. */
const NAV: { label: string; href?: string; items?: { id: string; label: string }[] }[] = [
  { label: "The problem", href: "#problem" },
  { label: "How it works", href: "#how" },
];

/**
 * Fixed navigation + reading progress + the right-hand section rail.
 *
 * The rail is the page's connective tissue: one continuous line threading
 * all eight sections, filling as you scroll, with each node lighting up as
 * its section takes the viewport.
 */
export default function SiteChrome() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });

  const [active, setActive] = useState<string>("hero");
  const [lifted, setLifted] = useState(false);

  useMotionValueEvent(scrollYProgress, "change", (v) => setLifted(v > 0.015));

  // One observer for all sections. The section owning the most viewport wins,
  // which is steadier than "first intersecting" on tall, full-height sections.
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (els.length === 0) return;

    const ratios = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target.id, e.intersectionRatio);
        let best = "";
        let bestRatio = 0;
        for (const [id, r] of ratios) {
          if (r > bestRatio) {
            bestRatio = r;
            best = id;
          }
        }
        if (best && bestRatio > 0.08) setActive(best);
      },
      { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );

    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* ── reading progress ─────────────────────────────── */}
      <motion.div
        aria-hidden
        className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-graphite"
        style={{ scaleX: progress }}
      />

      {/* ── top bar ──────────────────────────────────────── */}
      <motion.header
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: lifted ? -100 : 0, opacity: lifted ? 0 : 1 }}
        transition={{ duration: 0.5, ease: EASE, delay: lifted ? 0 : 0.15 }}
        className="theme-paper fixed inset-x-0 top-0 z-40 pointer-events-none"
      >
        <div
          className="pointer-events-auto mx-auto flex w-[min(1180px,94vw)] items-center justify-between border border-transparent px-1 py-7"
        >
          <Link href="#hero" className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-sans text-[19px] font-black tracking-[-0.03em] text-graphite">
              {BRAND.name}
            </span>
          </Link>

          <nav className="hidden items-center gap-9 lg:flex" aria-label="Sections">
            {NAV.map((item) =>
              item.items ? (
                <NavDropdown key={item.label} label={item.label} items={item.items} active={active} />
              ) : (
                <Link
                  key={item.label}
                  href={item.href as string}
                  className={`whitespace-nowrap text-[15px] transition ${
                    active === item.href?.slice(1)
                      ? "font-semibold text-graphite"
                      : "text-graphite-muted hover:text-graphite"
                  }`}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="flex items-center gap-5">
            <Link
              href="/progress"
              className="hidden whitespace-nowrap text-[15px] text-graphite-muted transition hover:text-graphite sm:block"
            >
              My progress
            </Link>
            <Link
              href="/learn"
              className="whitespace-nowrap rounded-full border-2 border-graphite px-5 py-2.5 text-[15px] font-semibold text-graphite transition hover:bg-graphite hover:text-paper"
            >
              Start learning
            </Link>
          </div>
        </div>
      </motion.header>

      {/* ── section rail (the through-line) ──────────────── */}
      <div aria-hidden className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 xl:block">
        <div className="relative flex flex-col items-center gap-5 py-2">
          {/* track + fill: one line threading every node */}
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-rule-strong" />
          <motion.span
            className="absolute left-1/2 top-0 w-px -translate-x-1/2 origin-top bg-graphite"
            style={{ height: "100%", scaleY: progress }}
          />
          {SECTIONS.map((s) => {
            const on = active === s.id;
            return (
              <Link
                key={s.id}
                href={`#${s.id}`}
                aria-label={s.label}
                className="group relative flex h-3 w-3 items-center justify-center"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full transition-all duration-400 ${
                    on ? "scale-150 bg-graphite" : "bg-rule-strong group-hover:bg-graphite-faint"
                  }`}
                />
                {on && (
                  <span className="pulse-ring absolute h-3 w-3 rounded-full border border-graphite/50" />
                )}
                <span className="pointer-events-none absolute right-6 whitespace-nowrap rounded-md border border-rule bg-paper px-2 py-1 text-[10px] text-graphite-muted opacity-0 shadow-lg transition group-hover:opacity-100">
                  {s.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

/**
 * Nav group with a chevron. Opens on hover for pointers and on focus for
 * keyboards, and Escape closes it — so it is reachable without a mouse
 * rather than being a hover-only affordance.
 */
function NavDropdown({
  label,
  items,
  active,
}: {
  label: string;
  items: { id: string; label: string }[];
  active: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const holds = items.some((i) => i.id === active);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        // Only close once focus has actually left the group, otherwise
        // tabbing between the trigger and its items shuts the menu.
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 whitespace-nowrap text-[15px] transition ${
          holds ? "font-semibold text-graphite" : "text-graphite-muted hover:text-graphite"
        }`}
      >
        {label}
        <motion.svg
          viewBox="0 0 12 8"
          className="h-2 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: EASE }}
        >
          <path d="M1 1.5 L6 6.5 L11 1.5" />
        </motion.svg>
      </button>

      <motion.div
        role="menu"
        initial={false}
        animate={
          open
            ? { opacity: 1, y: 0, pointerEvents: "auto" }
            : { opacity: 0, y: -6, pointerEvents: "none" }
        }
        transition={{ duration: 0.22, ease: EASE }}
        className="absolute left-1/2 top-full w-[196px] -translate-x-1/2 pt-3"
      >
        <div className="card-paper overflow-hidden rounded-xl p-1.5">
          {items.map((it) => (
            <Link
              key={it.id}
              href={`#${it.id}`}
              role="menuitem"
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2 text-[14px] transition ${
                active === it.id
                  ? "bg-paper-deep font-semibold text-graphite"
                  : "text-graphite-muted hover:bg-paper-deep hover:text-graphite"
              }`}
            >
              {it.label}
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * The pencil-in-ring mark, flat black on paper. Kept in the bar because
 * the splash draws exactly this glyph and then flies it into this slot —
 * dropping it would leave that handoff landing on nothing.
 */
function LogoMark() {
  return (
    <span className="relative flex h-7 w-7 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-7 w-7" fill="none">
        <circle cx="60" cy="54" r="34" stroke="var(--graphite)" strokeWidth="9" />
        <g fill="var(--graphite)" transform="translate(60, 98)">
          <rect x="-7.5" y="-64" width="5.8" height="34" rx="2.9" />
          <rect x="1.7" y="-64" width="5.8" height="34" rx="2.9" />
          <path d="M -9.5 -29 L 9.5 -29 L 0 -11 Z" />
          <path d="M -3.8 -8 L 3.8 -8 L 0 0 Z" />
        </g>
      </svg>
    </span>
  );
}
