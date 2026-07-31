"use client";

import { motion, useScroll, useTransform, useMotionValue, useSpring, type MotionValue } from "framer-motion";
import { useRef } from "react";
import { useReducedMotion } from "./Primitives";

import { useEffect } from "react";
import { EASE } from "./Primitives";

/* ═══════════════════════════════════════════════════════════════
   04 — Hazardous Waste (Redesigned)
   Using the 'paper' theme, scattered draggable fact cards, and
   bold marker typography to match the Hero's playful vibe.
   ═══════════════════════════════════════════════════════════════ */

const MINI_CARDS = [
  { title: "Feynman Technique", body: "Explain complex ideas simply. If you stumble, you've found a gap in your knowledge.", Icon: BubbleIcon, rotate: -3 },
  { title: "Active Recall", body: "Force your brain to retrieve information instead of passively re-reading notes.", Icon: LightningIcon, rotate: 4 },
  { title: "Targeted Feedback", body: "Our AI plays a confused student, asking questions that test your true understanding.", Icon: TargetIcon, rotate: -2 },
  { title: "Deep Mastery", body: "Move beyond rote memorization and build robust mental models that actually stick.", Icon: BrainIcon, rotate: 5 },
];

export default function HazardousWaste() {
  const reduced    = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const soft = { stiffness: 110, damping: 20, mass: 0.7 };
  const driftX = useSpring(useTransform(mx, [-0.5, 0.5], [-18, 18]), soft);
  const driftY = useSpring(useTransform(my, [-0.5, 0.5], [-12, 12]), soft);
  const driftXRev = useSpring(useTransform(mx, [-0.5, 0.5], [14, -14]), soft);

  useEffect(() => {
    if (reduced) return;
    function onMove(e: PointerEvent) {
      mx.set(e.clientX / window.innerWidth - 0.5);
      my.set(e.clientY / window.innerHeight - 0.5);
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [mx, my, reduced]);

  const run = true; // Entrance always plays when scrolled into view

  return (
    <section
      ref={sectionRef}
      id="hazard"
      className="theme-paper paper-field section-anchor relative flex min-h-[140vh] flex-col items-center justify-start overflow-hidden px-6 pt-32"
    >
      <div className="sticky top-0 flex h-screen w-full items-center justify-center overflow-hidden">
        
        {/* ── Headline ── */}
        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center text-center">
          <h2 className="font-display text-[clamp(2.4rem,6vw,5rem)] font-extrabold leading-[1.05] tracking-tight text-graphite">
            <motion.div
              initial={reduced ? undefined : { y: 30, opacity: 0 }}
              whileInView={reduced ? undefined : { y: 0, opacity: 1 }}
              viewport={{ once: true, margin: "-20%" }}
              transition={{ duration: 0.8, ease: EASE }}
            >
              Master any subject by <span className="marker">teaching it</span>
            </motion.div>
          </h2>
          <motion.p 
            initial={reduced ? undefined : { y: 20, opacity: 0 }}
            whileInView={reduced ? undefined : { y: 0, opacity: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
            className="mt-8 max-w-xl text-[1.1rem] leading-relaxed text-graphite-muted"
          >
            The Protégé Effect proves that explaining a concept out loud is the most effective way to lock it into your long-term memory.
          </motion.p>
        </div>

        {/* ── Scattered Draggable Cards ── */}
        <Drop
          run={run}
          reduced={!!reduced}
          delay={0.1}
          from={{ opacity: 0, scale: 0.8 }}
          progress={scrollYProgress}
          fall={{ distance: 150, spin: -12, sway: -40 }}
          drift={{ x: driftX, y: driftY }}
          className="absolute left-[2%] top-[8%] z-20 hidden md:block"
        >
          <MiniCard {...MINI_CARDS[0]} />
        </Drop>

        <Drop
          run={run}
          reduced={!!reduced}
          delay={0.25}
          from={{ opacity: 0, scale: 0.8 }}
          progress={scrollYProgress}
          fall={{ distance: 250, spin: 18, sway: 30 }}
          drift={{ x: driftXRev, y: driftY }}
          className="absolute right-[2%] top-[6%] z-20 hidden lg:block"
        >
          <MiniCard {...MINI_CARDS[1]} />
        </Drop>

        <Drop
          run={run}
          reduced={!!reduced}
          delay={0.4}
          from={{ opacity: 0, scale: 0.8 }}
          progress={scrollYProgress}
          fall={{ distance: 200, spin: -22, sway: -20 }}
          drift={{ x: driftX, y: driftY }}
          className="absolute bottom-[10%] left-[4%] z-20 hidden lg:block"
        >
          <MiniCard {...MINI_CARDS[2]} />
        </Drop>

        <Drop
          run={run}
          reduced={!!reduced}
          delay={0.55}
          from={{ opacity: 0, scale: 0.8 }}
          progress={scrollYProgress}
          fall={{ distance: 300, spin: 14, sway: 50 }}
          drift={{ x: driftXRev, y: driftY }}
          className="absolute bottom-[16%] right-[2%] z-20 hidden md:block"
        >
          <MiniCard {...MINI_CARDS[3]} />
        </Drop>

        {/* Fallback for mobile */}
        <div className="md:hidden absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col gap-4 z-20">
          <MiniCard {...MINI_CARDS[0]} />
          <MiniCard {...MINI_CARDS[3]} />
        </div>
      </div>
    </section>
  );
}

/* ── scroll-driven drop ── */
const DRAG_BOUNDS = { left: -380, right: 380, top: -300, bottom: 300 };
const FALL_SPRING = { stiffness: 130, damping: 20, mass: 0.9 } as const;
const FALL_FROM = 0.05;
const FALL_TO = 0.95;

function fallCurve(t: number) {
  return 0.22 * t + 0.78 * t * t;
}

type Fall = { distance: number; spin: number; sway?: number };

function Drop({
  children,
  run,
  reduced,
  delay,
  from,
  className,
  progress,
  fall,
  drift,
}: {
  children: React.ReactNode;
  run: boolean;
  reduced: boolean;
  delay: number;
  from: { opacity: number; y?: number; scale?: number };
  className: string;
  progress: MotionValue<number>;
  fall: Fall;
  drift: { x: MotionValue<number>; y: MotionValue<number> };
}) {
  const t = useTransform(progress, (p) =>
    Math.min(1, Math.max(0, (p - FALL_FROM) / (FALL_TO - FALL_FROM))),
  );
  const y = useSpring(useTransform(t, (v) => fallCurve(v) * fall.distance), FALL_SPRING);
  const x = useSpring(useTransform(t, (v) => fallCurve(v) * (fall.sway ?? 0)), FALL_SPRING);
  const rotate = useSpring(useTransform(t, (v) => fallCurve(v) * fall.spin), FALL_SPRING);
  const opacity = useTransform(t, [0, 0.95, 1], [1, 1, 0]);

  const grab = (
    <motion.div
      className="pointer-events-auto inline-block cursor-grab touch-none active:cursor-grabbing"
      drag={!reduced}
      dragConstraints={DRAG_BOUNDS}
      dragElastic={0.16}
      dragTransition={{ power: 0.26, timeConstant: 280, bounceStiffness: 240, bounceDamping: 22 }}
      whileDrag={{ scale: 1.04 }}
    >
      {children}
    </motion.div>
  );

  if (reduced) return <div className={`pointer-events-none ${className}`}>{grab}</div>;

  return (
    <div className={`pointer-events-none ${className}`}>
      <motion.div style={{ y, x, rotate, opacity }}>
        <motion.div style={{ x: drift.x, y: drift.y }}>
          <motion.div
            initial={from}
            whileInView={run ? { opacity: 1, y: 0, scale: 1 } : from}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.75, delay: run ? delay : 0, ease: EASE }}
          >
            {grab}
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/* ── Mini fact card ─────────────────────────────────────────────
   A plain card — all the reveal motion lives on the shared track,
   not per-card, so the row moves as one filmstrip. */
function MiniCard({
  title,
  body,
  Icon,
  rotate,
}: {
  title: string;
  body: string;
  Icon: () => React.JSX.Element;
  rotate: number;
}) {
  return (
    <div
      className={`card-paper shrink-0 rounded-[1.25rem] p-6 transition-all duration-300 hover:shadow-[0_26px_54px_-20px_rgba(17,17,17,0.5)]`}
      style={{ width: 280, transform: `rotate(${rotate}deg)` }}
    >
      <div className="mb-4 flex h-24 items-center justify-center rounded-xl bg-paper-deep p-3">
        <Icon />
      </div>
      <h4 className="font-display text-xl font-bold leading-tight text-graphite">
        {title}
      </h4>
      <p className="mt-2 text-[13px] leading-snug" style={{ color: "#6b7280" }}>
        {body}
      </p>
    </div>
  );
}

/* ── Illustrations ── */

function BubbleIcon() {
  return (
    <svg viewBox="0 0 100 80" className="h-16 w-full" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20 L80 20 A10 10 0 0 1 90 30 L90 50 A10 10 0 0 1 80 60 L40 60 L20 75 L20 60 L20 60 A10 10 0 0 1 10 50 L10 30 A10 10 0 0 1 20 20 Z" fill="var(--highlighter)" stroke="none" />
      <path d="M20 20 L80 20 A10 10 0 0 1 90 30 L90 50 A10 10 0 0 1 80 60 L40 60 L20 75 L20 60 L20 60 A10 10 0 0 1 10 50 L10 30 A10 10 0 0 1 20 20 Z" className="text-graphite" />
      <circle cx="35" cy="40" r="4" fill="currentColor" className="text-graphite" />
      <circle cx="50" cy="40" r="4" fill="currentColor" className="text-graphite" />
      <circle cx="65" cy="40" r="4" fill="currentColor" className="text-graphite" />
    </svg>
  );
}

function LightningIcon() {
  return (
    <svg viewBox="0 0 100 80" className="h-16 w-full" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M55 10 L30 45 L50 45 L45 75 L70 35 L50 35 Z" fill="var(--cobalt)" stroke="none" />
      <path d="M55 10 L30 45 L50 45 L45 75 L70 35 L50 35 Z" className="text-graphite" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 100 80" className="h-16 w-full" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="50" cy="40" r="28" fill="var(--rose-paper)" stroke="none" />
      <circle cx="50" cy="40" r="28" className="text-graphite" />
      <circle cx="50" cy="40" r="14" fill="var(--paper)" className="text-graphite" />
      <circle cx="50" cy="40" r="4" fill="currentColor" className="text-graphite" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg viewBox="0 0 100 80" className="h-16 w-full" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M30 50 C20 50 15 40 20 30 C25 20 35 15 45 20 C50 15 65 15 70 25 C75 35 75 45 65 50 C70 60 60 70 50 65 C40 70 30 60 30 50 Z" fill="var(--grass)" stroke="none" />
      <path d="M30 50 C20 50 15 40 20 30 C25 20 35 15 45 20 C50 15 65 15 70 25 C75 35 75 45 65 50 C70 60 60 70 50 65 C40 70 30 60 30 50 Z" className="text-graphite" />
      <path d="M50 20 L50 65" className="text-graphite" strokeWidth="4" />
      <path d="M35 35 L45 35" className="text-graphite" strokeWidth="4" />
      <path d="M55 40 L65 40" className="text-graphite" strokeWidth="4" />
    </svg>
  );
}
