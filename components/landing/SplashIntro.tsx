"use client";

import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { useReducedMotion } from "./Primitives";
import { markSplashDone } from "./splashState";

/* ═══════════════════════════════════════════════════════════════
   Splash intro — paper field, pencil draws the mark.

   Beats, matching the reference timing:
     draw   a pencil orbits the centre, trailing the ring it draws
     settle it swings upright and drops inside the ring
     name   the wordmark letters stagger in beside the mark
     exit   the whole lockup shrinks into the navbar slot and the
            page beneath is revealed

   The overlay sits above already-rendered page content, so nothing
   here delays paint or hides anything from crawlers.
   ═══════════════════════════════════════════════════════════════ */

type Phase = "draw" | "settle" | "name" | "exit" | "done";

/** Cumulative ms at which each phase begins. */
const BEATS: { phase: Phase; at: number }[] = [
  { phase: "settle", at: 1700 },
  { phase: "name", at: 2300 },
  { phase: "exit", at: 3600 },
  { phase: "done", at: 4400 },
];

// Mark geometry, in the 120×120 viewBox the glyph is drawn in.
const CX = 60;
const CY = 54;
const R = 34;
const RING_C = 2 * Math.PI * R;
/** Where the pencil rides while it's drawing: on the stroke itself. */
const ORBIT = R;
/** Seconds for the pencil to travel once around, laying the ring. */
const SWEEP = 1.55;
const EASE_DRAW = [0.45, 0, 0.25, 1] as const;

export default function SplashIntro() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("draw");
  const [navTarget, setNavTarget] = useState({ x: 0, y: 0 });

  // Where the lockup should fly to — the navbar's logo slot. Measured so the
  // handoff lands correctly at any viewport width.
  useEffect(() => {
    function measure() {
      const navLeft = Math.max(24, (window.innerWidth - 1180) / 2) + 76;
      setNavTarget({
        x: navLeft - window.innerWidth / 2,
        y: 46 - window.innerHeight / 2,
      });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Advance the phases on a fixed schedule.
  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => setPhase("done"), 400);
      return () => clearTimeout(t);
    }
    const timers = BEATS.map((b) => setTimeout(() => setPhase(b.phase), b.at));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  /**
   * Hand off to the hero the moment the curtain starts lifting — this is
   * what makes the hero's entrance read as a continuation of the splash
   * rather than something that already happened behind it. Covers the
   * skip button and the reduced-motion short-circuit too, since both
   * land on the same phase.
   */
  useEffect(() => {
    if (phase === "done") markSplashDone();
  }, [phase]);

  // Hold the page still while the splash owns the screen.
  useEffect(() => {
    if (phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  const skip = () => setPhase("done");
  const leaving = phase === "exit";
  const showName = phase === "name" || leaving;

  // Half the wordmark (plus the flex gap) — how far right the row must sit for
  // the mark alone to read as centred before the name arrives.
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const [nameOffset, setNameOffset] = useState(0);
  useEffect(() => {
    const el = wordmarkRef.current;
    if (!el) return;
    setNameOffset((el.offsetWidth + 24) / 2);
  }, []);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          key="splash"
          /* Same stock as the hero beneath it, so the curtain lifting reads
             as the page settling rather than a colour swap. */
          className="theme-paper paper-field fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          onClick={skip}
          role="presentation"
          aria-hidden
        >
          <motion.div
            className="flex items-center gap-6"
            // The wordmark always occupies its space, so the row's centre is
            // the *final* lockup centre. Until the name arrives we nudge the
            // row right by half of it, which leaves the mark dead centre while
            // it is being drawn — then slide back, recentring the lockup.
            //
            // Deliberately not framer's `layout`: it corrects size changes with
            // scaleX/scaleY, and those leak into SVG children and visibly
            // squash the ring into an ellipse.
            animate={
              leaving
                ? { scale: 0.18, x: navTarget.x, y: navTarget.y, opacity: 0 }
                : { scale: 1, x: showName ? 0 : nameOffset, y: 0, opacity: 1 }
            }
            transition={{ duration: leaving ? 0.8 : 0.6, ease: [0.65, 0, 0.35, 1] }}
          >
            <Mark phase={phase} reduced={!!reduced} />
            <Wordmark ref={wordmarkRef} show={showName} reduced={!!reduced} />
          </motion.div>

          {/* skip affordance — the splash is decorative, never a gate */}
          <motion.button
            onClick={skip}
            initial={{ opacity: 0 }}
            animate={{ opacity: leaving ? 0 : 0.55 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            className="absolute bottom-8 right-8 text-[11px] uppercase tracking-[0.22em] text-graphite transition hover:opacity-100"
          >
            Skip
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The ring, plus the pencil that draws it and then settles inside. */
function Mark({ phase, reduced }: { phase: Phase; reduced: boolean }) {
  const drawing = phase === "draw";
  const settled = phase !== "draw";

  // One motion value drives both the stroke and the pencil's orbit, so the nib
  // is always exactly on the front of the line it is drawing. Two independent
  // tweens — even with identical duration and easing — visibly drift apart.
  const progress = useMotionValue(reduced ? 1 : 0);
  const dashOffset = useTransform(progress, (p) => RING_C * (1 - p));
  const orbit = useTransform(progress, (p) => p * 360);

  useEffect(() => {
    if (reduced) return;
    const controls = animate(progress, 1, { duration: SWEEP, ease: EASE_DRAW });
    return () => controls.stop();
  }, [progress, reduced]);

  return (
    <svg
      viewBox="0 0 120 120"
      className="h-[210px] w-[210px] shrink-0 md:h-[270px] md:w-[270px]"
      fill="none"
      // While orbiting, the pencil's barrel reaches well outside the viewBox.
      // SVG clips to its viewport by default, which shears the glyph in half.
      style={{ overflow: "visible" }}
    >
      {/* the ring the pencil leaves behind */}
      <motion.circle
        cx={CX}
        cy={CY}
        r={R}
        stroke="var(--graphite)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={RING_C}
        // Starts at the top and sweeps clockwise, following the nib.
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ strokeDashoffset: dashOffset }}
      />

      {/* orbiting pencil — its nib rides the stroke front while drawing */}
      {drawing && !reduced && (
        <motion.g
          // SVG needs an explicit transform-origin, and `transform-box:
          // view-box` so the px values resolve in viewBox units rather than
          // against this group's own (pencil-sized) bounding box.
          style={{
            rotate: orbit,
            transformBox: "view-box",
            transformOrigin: `${CX}px ${CY}px`,
          }}
        >
          {/* Nib sits on the ring at 12 o'clock; the barrel leans back off
              the radius so the pencil trails the stroke it is laying down. */}
          <g transform={`translate(${CX}, ${CY - ORBIT}) rotate(-38)`}>
            <Pencil />
          </g>
        </motion.g>
      )}

      {/* settled pencil — upright inside the ring, nib through the base */}
      {settled && (
        <motion.g
          initial={reduced ? false : { opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <g transform={`translate(${CX}, ${CY + R + 10})`}>
            <Pencil />
          </g>
        </motion.g>
      )}
    </svg>
  );
}

/**
 * Minimal pencil glyph: two barrel bars, a chunky nib, and the detached tip.
 * Drawn with the **tip at the origin** and the body running up in -y, so a
 * caller only has to place the origin where the pencil should be writing.
 */
function Pencil() {
  return (
    <g fill="var(--graphite)">
      <rect x="-7.5" y="-64" width="5.8" height="34" rx="2.9" />
      <rect x="1.7" y="-64" width="5.8" height="34" rx="2.9" />
      <path d="M -9.5 -29 L 9.5 -29 L 0 -11 Z" />
      <path d="M -3.8 -8 L 3.8 -8 L 0 0 Z" />
    </g>
  );
}

/**
 * Wordmark letters, staggered in as in the reference. Always rendered so it
 * reserves its width from the first frame — the parent measures that to work
 * out how far to offset the lockup before the name appears.
 */
function Wordmark({
  ref,
  show,
  reduced,
}: {
  ref: React.Ref<HTMLSpanElement>;
  show: boolean;
  reduced: boolean;
}) {
  const letters = BRAND.name.toUpperCase().split("");

  return (
    <span
      ref={ref}
      // Geometric sans, matching the reference lockup — not the brand serif.
      className="font-sans text-[3rem] font-medium uppercase leading-none tracking-[0.14em] text-graphite md:text-[4.2rem]"
      aria-label={BRAND.name}
    >
      {letters.map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          className="inline-block"
          initial={reduced ? false : { opacity: 0, x: -18, scale: 0.8 }}
          animate={
            show ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: -18, scale: 0.8 }
          }
          transition={{
            duration: 0.42,
            delay: show && !reduced ? i * 0.075 : 0,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}
