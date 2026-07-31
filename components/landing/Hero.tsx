"use client";

import Link from "next/link";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { BRAND } from "@/lib/brand";
import { EASE, Magnetic, SmokeCloud, useReducedMotion } from "./Primitives";
import { useSplashDone } from "./splashState";

/* ═══════════════════════════════════════════════════════════════
   01 — Hero  ·  editorial "paper" theme

   Speckled off-white stock, near-black chunky sans, flat poster
   accents, and media set *inline in the headline* rather than in a
   panel beside it.

   The entrance is gated on the splash handoff (see splashState.ts):
   nothing here moves until the curtain starts lifting, so the two
   read as one continuous sequence instead of the hero quietly
   finishing its animation behind the overlay.
   ═══════════════════════════════════════════════════════════════ */

/**
 * Media for the two inline headline slots.
 *
 * Currently filled with Pexels stock footage, cropped to each slot's
 * aspect and downscaled to ~2× its display size:
 *   pill — "Video Of People Talking With Each Other", Pexels #4625286
 *   disc — "Woman Talking and Looking at the Camera", RDNE Stock, #8124136
 * Both are Pexels License: free for commercial use, no attribution
 * required (credited here as a courtesy, and so the sources are
 * traceable if these ever need regenerating).
 *
 * WebM/VP8, because they were transcoded through Chromium's recorder —
 * there is no usable ffmpeg on this machine. That covers Chrome, Edge,
 * Firefox and Safari 14.1+. Anywhere it doesn't decode, the `poster`
 * shows instead, so the failure mode is a still rather than a hole.
 * Re-encoding these to h.264 mp4 would widen support and roughly halve
 * the size; worth doing if these stay past the prototype.
 *
 * Each slot degrades independently: no `video` → `poster`; neither →
 * the flat accent block, which is a finished look, not a broken one.
 */
type Media = { video: string | null; poster: string | null; fill: string };

const EXPLAIN_MEDIA: Media = {
  video: "/hero-explain.webm",
  poster: "/hero-explain.jpg",
  fill: "var(--cobalt)",
};
const GAPS_MEDIA: Media = {
  video: "/hero-gaps.webm",
  poster: "/hero-gaps.jpg",
  fill: "var(--grass)",
};

/** Entrance beat offsets, in seconds after the splash hands off. */
const B = {
  strokes: 0.0,
  line1: 0.12,
  line2: 0.26,
  sub: 0.46,
  cta: 0.58,
  furniture: 0.72,
} as const;

export default function Hero() {
  const reduced = useReducedMotion();
  const started = useSplashDone();
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll-out: the sheet lifts and fades as the next section arrives.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const sheetY = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const sheetFade = useTransform(scrollYProgress, [0, 0.9], [1, 0]);

  // Pointer parallax for the loose furniture (cards, badge, strokes).
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

  // One switch drives every entrance: hold at `hidden` until the splash
  // lifts, then run. Reduced motion skips straight to the rest state.
  const run = reduced || started;

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="theme-paper paper-field section-anchor relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-28"
    >
      <GreenStrokes run={run} reduced={!!reduced} driftX={driftXRev} driftY={driftY} />

      <motion.div
        style={reduced ? undefined : { y: sheetY, opacity: sheetFade }}
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center"
      >
        {/* ── headline, with media set into the line ─────── */}
        <h1 className="font-sans text-[clamp(2.4rem,6.6vw,5.2rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-graphite">
          <HeadlineLine run={run} reduced={!!reduced} delay={B.line1}>
            <span>Teach</span>
            <MediaPill media={EXPLAIN_MEDIA} label="A learner explaining a concept out loud" />
            <span>the AI.</span>
          </HeadlineLine>

          <HeadlineLine run={run} reduced={!!reduced} delay={B.line2}>
            <span>It finds</span>
            <AmpBadge />
            <span>your</span>
            <span className="marker">gaps.</span>
            <MediaDisc media={GAPS_MEDIA} label="A gap closing in a concept map" />
          </HeadlineLine>
        </h1>

        <Beat run={run} reduced={!!reduced} delay={B.sub}>
          <p className="mx-auto mt-8 max-w-lg text-[15px] leading-relaxed text-graphite-muted">
            You explain a concept out loud. The AI plays a confused student and asks
            exactly where your understanding has holes — then a real ML engine, not the
            chatbot, scores how well you actually understand it.
          </p>
        </Beat>

        <Beat run={run} reduced={!!reduced} delay={B.cta}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Magnetic>
              <Link
                href="/learn"
                className="group flex items-center gap-2 rounded-full bg-graphite px-8 py-4 text-sm font-semibold text-paper transition hover:bg-black"
              >
                Start learning
                <span className="transition-transform duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </Magnetic>
            <Link
              href="#how"
              className="rounded-full border-2 border-graphite px-7 py-[13px] text-sm font-semibold text-graphite transition hover:bg-graphite hover:text-paper"
            >
              See how it works
            </Link>
            <Link
              href="/teacher"
              className="rounded-full px-4 py-4 text-sm font-medium text-graphite-muted underline decoration-rule-strong underline-offset-4 transition hover:text-graphite hover:decoration-graphite"
            >
              For teachers
            </Link>
          </div>
        </Beat>
      </motion.div>

      {/* ── loose furniture ────────────────────────────── */}
      {/* Each piece is pinned to the sheet only until you scroll: past that
          it lets go and drops out of frame. `spin`/`sway` differ per piece so
          they tumble at their own rate instead of moving as one slab. All
          three are also draggable — see Drop. */}
      <Drop
        run={run}
        reduced={!!reduced}
        delay={B.furniture}
        from={{ opacity: 0, y: 26 }}
        progress={scrollYProgress}
        fall={{ distance: 900, spin: -22, sway: -60 }}
        drift={{ x: driftX, y: driftY }}
        className="absolute bottom-14 left-[9%] z-20 hidden xl:block"
      >
        <ScoreCard />
      </Drop>

      <Drop
        run={run}
        reduced={!!reduced}
        delay={B.furniture + 0.1}
        from={{ opacity: 0, scale: 0.8 }}
        progress={scrollYProgress}
        fall={{ distance: 1180, spin: 34, sway: 46 }}
        drift={{ x: driftXRev, y: driftY }}
        className="absolute right-[8%] top-[26%] z-20 hidden lg:block"
      >
        <TopicTag />
      </Drop>

      <Drop
        run={run}
        reduced={!!reduced}
        delay={B.furniture + 0.18}
        from={{ opacity: 0, scale: 0.7 }}
        progress={scrollYProgress}
        fall={{ distance: 820, spin: 62, sway: 24 }}
        drift={{ x: driftXRev, y: driftY }}
        className="absolute bottom-12 right-[7%] z-20 hidden lg:block"
      >
        <RoundBadge reduced={!!reduced} />
      </Drop>

      <PaperPlane progress={scrollYProgress} reduced={!!reduced} />
    </section>
  );
}

/* ── paper plane ───────────────────────────────────────────── */

/**
 * A folded dart that launches out of the foot of the hero as you scroll, on
 * a straight climb (not an arc — a fixed heading, computed once from the
 * flight's own displacement rather than chosen separately, so the nose
 * always points exactly where the line is actually going) and trailing a
 * growing cloud of smoke behind it.
 *
 * `x0` is the exact horizontal centre of the 900-unit box and `y0` sits at
 * its floor, so the plane starts dead centre at the bottom of the hero.
 */
const FLIGHT = { x0: 450, y0: 238 };
const FLIGHT_DX = 340;
const FLIGHT_DY = -260;
const FLIGHT_ANGLE = (Math.atan2(FLIGHT_DY, FLIGHT_DX) * 180) / Math.PI;

function PaperPlane({
  progress,
  reduced,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
}) {
  // Launch early and finish before the hero is gone, so the flight plays while
  // there's still sheet behind it.
  const t = useTransform(progress, [0.02, 0.46], [0, 1], { clamp: true });

  const { x0, y0 } = FLIGHT;
  const x = useTransform(t, (v) => x0 + v * FLIGHT_DX);
  const y = useTransform(t, (v) => y0 + v * FLIGHT_DY);

  // The plane itself grows through the flight — already bigger at launch than
  // the old design, growing further as it climbs.
  const scale = useTransform(t, [0, 1], [1.5, 2.3]);

  // Visible from the moment the hero lands — it's parked centre-bottom waiting
  // to launch, not fading in once you've already started scrolling. Only the
  // tail of the flight fades, as it leaves frame.
  const opacity = useTransform(t, [0, 0.86, 1], [1, 1, 0]);

  // The cloud has its own scale, independent of the plane's — sized as a
  // sibling under the same position/rotation wrapper rather than nested
  // inside the plane's own scaled group, so its growth doesn't compound with
  // the plane's. Growth finishes at 0.6, not 1, so this trailing puff doesn't
  // keep swelling over the CTA row for the whole rest of the flight.
  const cloudScale = useTransform(t, [0, 0.12, 0.6], [0.2, 1, 1.8]);
  const cloudOpacity = useTransform(t, [0, 0.1, 1], [0, 0.9, 0.95]);

  if (reduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden h-80 w-[min(1000px,94vw)] -translate-x-1/2 md:block"
    >
      <svg viewBox="0 0 900 260" className="h-full w-full overflow-visible" fill="none">
        <motion.g style={{ x, y, rotate: FLIGHT_ANGLE, opacity, transformOrigin: "0px 0px" }}>
          {/* Smoke, fixed behind the tail in the plane's own local space — a
              straight, unchanging heading means this offset trails correctly
              at every point in the flight, not just an approximation. */}
          <g transform="translate(-70 4)">
            <motion.g style={{ scale: cloudScale, opacity: cloudOpacity, transformOrigin: "0px 0px" }}>
              <SmokeCloud />
            </motion.g>
          </g>

          <motion.g style={{ scale, transformOrigin: "0px 0px" }}>
            {/* Two folds, light over dark — the same flat poster logic as the
                rest of the sheet, so it reads as folded paper without shading. */}
            <path
              d="M-17 -11 L19 0 L-9 1 Z"
              fill="var(--paper-card)"
              stroke="var(--graphite)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            <path
              d="M-17 11 L19 0 L-9 1 Z"
              fill="var(--graphite)"
              stroke="var(--graphite)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </motion.g>
        </motion.g>
      </svg>
    </div>
  );
}

/* ── entrance primitives ───────────────────────────────────── */

/**
 * One staged beat. Held at its `from` state until `run` flips, which is
 * what keeps the whole hero still while the splash is up.
 *
 * Positioning belongs on `className`, i.e. on this element — never on a
 * child. Animating `y`/`scale` gives this div a transform, and a
 * transformed element becomes the containing block for any absolutely
 * positioned descendant, which would anchor it to this wrapper instead
 * of to the section.
 */
function Beat({
  children,
  run,
  reduced,
  delay,
  from = { opacity: 0, y: 22 },
  className,
}: {
  children: React.ReactNode;
  run: boolean;
  reduced: boolean;
  delay: number;
  from?: { opacity: number; y?: number; scale?: number };
  className?: string;
}) {
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={from}
      animate={run ? { opacity: 1, y: 0, scale: 1 } : from}
      transition={{ duration: 0.75, delay: run ? delay : 0, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ── scroll-driven drop ────────────────────────────────────── */

/**
 * How far a piece may be thrown from where it started. Deliberately wide —
 * the point is that the furniture is loose — but bounded, so a piece can't
 * be flung somewhere it would overlap the headline or leave the section.
 */
const DRAG_BOUNDS = { left: -380, right: 380, top: -300, bottom: 300 };

/** A little lag on the fall, so the pieces read as weighted rather than glued to the wheel. */
const FALL_SPRING = { stiffness: 130, damping: 20, mass: 0.9 } as const;

/**
 * The window of hero-scroll the drop plays over. It has to finish well
 * inside the scroll-out: the section itself is travelling *up* the viewport
 * at the same time, so a piece only looks like it's falling while its own
 * downward speed beats the scroll's. Ending at 0.5 keeps it comfortably
 * ahead for the whole descent.
 */
const FALL_FROM = 0.02;
const FALL_TO = 0.42;

/**
 * Displacement curve, normalized to 1 at the end of the window.
 *
 * Mostly `t²` — constant acceleration, i.e. gravity — but with a linear term
 * mixed in, so a piece leaves with a small shove instead of easing out of
 * rest. Pure `t²` creeps for the first third of the window, which here means
 * the piece hangs around long enough for the section's clip edge to slice it
 * in half rather than dropping cleanly behind the next section.
 */
function fallCurve(t: number) {
  return 0.22 * t + 0.78 * t * t;
}

type Fall = {
  /** Total drop in px by the end of the window. */
  distance: number;
  /** Degrees of tumble, signed — which way the piece topples. */
  spin: number;
  /** Sideways drift in px, signed. */
  sway?: number;
};

/**
 * A piece of loose furniture: enters with the hero, drifts with the pointer,
 * falls away on scroll, and can be picked up and thrown at any time.
 *
 * The layers are separate elements on purpose. Drag owns the `x`/`y` of the
 * element it's on, so the scroll fall, the pointer parallax and the entrance
 * each need their own wrapper — stacking them on one node would have drag
 * and the entrance animation fighting over the same two motion values.
 *
 * The fade at the end is not decoration: the section clips at its own bottom
 * edge, which by then has risen above the fold, so a piece that outlived the
 * window would be sliced mid-air instead of leaving frame.
 */
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
  const y = useSpring(
    useTransform(t, (v) => fallCurve(v) * fall.distance),
    FALL_SPRING,
  );
  const x = useSpring(
    useTransform(t, (v) => fallCurve(v) * (fall.sway ?? 0)),
    FALL_SPRING,
  );
  const rotate = useSpring(
    useTransform(t, (v) => fallCurve(v) * fall.spin),
    FALL_SPRING,
  );
  const opacity = useTransform(t, [0, 0.5, 0.95], [1, 1, 0]);

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

  // Reduced motion keeps the piece where it is — still draggable, since that
  // only ever moves on a deliberate gesture.
  if (reduced) return <div className={`pointer-events-none ${className}`}>{grab}</div>;

  return (
    <div className={`pointer-events-none ${className}`}>
      <motion.div style={{ y, x, rotate, opacity }}>
        <motion.div style={{ x: drift.x, y: drift.y }}>
          <motion.div
            initial={from}
            animate={run ? { opacity: 1, y: 0, scale: 1 } : from}
            transition={{ duration: 0.75, delay: run ? delay : 0, ease: EASE }}
          >
            {grab}
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * A headline row whose contents rise out of a clipping mask. The mask is
 * on the row, so the media pills wipe up with the words they sit between
 * rather than fading in separately.
 */
function HeadlineLine({
  children,
  run,
  reduced,
  delay,
}: {
  children: React.ReactNode;
  run: boolean;
  reduced: boolean;
  delay: number;
}) {
  const row = (
    <span className="flex flex-wrap items-center justify-center gap-x-[0.28em] gap-y-2">
      {children}
    </span>
  );

  if (reduced) return <span className="block">{row}</span>;

  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <motion.span
        className="block"
        initial={{ y: "108%" }}
        animate={run ? { y: "0%" } : { y: "108%" }}
        transition={{ duration: 1, delay: run ? delay : 0, ease: EASE }}
      >
        {row}
      </motion.span>
    </span>
  );
}

/* ── inline media ──────────────────────────────────────────── */

/**
 * Wide pill set between headline words. Sized in `em` so it scales with
 * the clamped headline instead of drifting out of the line at any width.
 */
function MediaPill({ media, label }: { media: Media; label: string }) {
  return (
    <span
      className="relative inline-block h-[0.92em] w-[2.5em] shrink-0 overflow-hidden rounded-full align-middle"
      style={{ background: media.fill }}
    >
      <MediaFill media={media} label={label} />
    </span>
  );
}

/** Circular counterpart, sitting at the end of the second line. */
function MediaDisc({ media, label }: { media: Media; label: string }) {
  return (
    <span
      className="relative inline-block h-[1em] w-[1em] shrink-0 overflow-hidden rounded-full align-middle"
      style={{ background: media.fill }}
    >
      <MediaFill media={media} label={label} />
    </span>
  );
}

/**
 * Fills a media slot with the best asset available. The flat accent block
 * underneath always renders, so an empty slot reads as a deliberate colour
 * shape rather than a hole.
 */
function MediaFill({ media, label }: { media: Media; label: string }) {
  const reduced = useReducedMotion();

  // A looping clip has no reduced-motion story — fall back to its poster.
  if (media.video && !reduced) {
    return (
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={media.video}
        poster={media.poster ?? undefined}
        aria-label={label}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
      />
    );
  }

  if (media.poster) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={media.poster}
        alt={label}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />
    );
  }

  return null;
}

/** The two slots the badge's circles trade between. */
const SLOT_L = "0em";
const SLOT_R = "0.48em";

/**
 * The two-tone glyph that separates the second line: a search glass and a
 * checkmark, overlapping — "finds" resolving into "found". Every beat the
 * pair trades places outright — whichever circle is in the front-left slot
 * slides to back-right, and the other slides up to take the front — rather
 * than the two just holding still and flipping which is on top. Each swap
 * is a quick snap, then a hold, not a continuous drift.
 */
function AmpBadge() {
  const reduced = useReducedMotion();
  const [front, setFront] = useState<"search" | "check">("search");

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      setFront((f) => (f === "search" ? "check" : "search"));
    }, 2000);
    return () => clearInterval(id);
  }, [reduced]);

  // A touch of overshoot on the snap reads as a flick rather than a fade.
  const snap = { duration: 0.32, ease: [0.34, 1.4, 0.64, 1] as const };

  return (
    <span
      aria-hidden
      className="relative inline-block shrink-0 align-middle"
      style={{ width: "1.26em", height: "0.78em" }}
    >
      <motion.span
        className="absolute top-0 flex h-[0.78em] w-[0.78em] items-center justify-center rounded-full"
        style={{ background: "var(--highlighter)", zIndex: front === "search" ? 2 : 1 }}
        initial={{ left: SLOT_L }}
        animate={{ left: front === "search" ? SLOT_L : SLOT_R }}
        transition={snap}
      >
        <SearchGlyph className="h-[0.44em] w-[0.44em] text-graphite" />
      </motion.span>
      <motion.span
        className="absolute top-0 flex h-[0.78em] w-[0.78em] items-center justify-center rounded-full"
        style={{ background: "var(--cobalt)", zIndex: front === "check" ? 2 : 1 }}
        initial={{ left: SLOT_R }}
        animate={{ left: front === "check" ? SLOT_L : SLOT_R }}
        transition={snap}
      >
        <CheckGlyph className="h-[0.4em] w-[0.4em] text-paper" />
      </motion.span>
    </span>
  );
}

function SearchGlyph({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
    >
      <circle cx="10" cy="10" r="6" />
      <path d="M15 15 L20.5 20.5" />
    </svg>
  );
}

function CheckGlyph({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 12.5 L9.5 17.5 L19.5 6" />
    </svg>
  );
}

/* ── furniture ─────────────────────────────────────────────── */

/**
 * Dark checklist card, bottom-left.
 *
 * The lean is a plain CSS transform, not a motion value: it belongs to the
 * card's resting pose, so it has to survive independently of the fall's
 * rotation and the drag's translate, both of which live on ancestors and
 * compose with this rather than overwrite it.
 */
function ScoreCard() {
  return (
    <div className="w-[264px] -rotate-6 rounded-2xl bg-graphite p-5 text-left shadow-[0_26px_54px_-24px_rgba(17,17,17,0.7)]">
      <p className="font-sans text-sm font-bold text-paper">{BRAND.name}</p>
      <div className="mt-3 h-px w-full bg-white/15" />
      <ul className="mt-3 space-y-2.5">
        {[BRAND.score.name, BRAND.parrot.name].map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-graphite"
              style={{ background: "var(--grass)" }}
            >
              ✓
            </span>
            <span className="text-[13px] leading-snug text-white/80">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Black tag with a cursor, as if someone just hovered a topic.
 *
 * The arrow is a classic pointer — a solid chisel head with a squared tail —
 * sized up so it reads as an actual cursor sitting on the tag rather than a
 * decorative tick. Tilted a few degrees off true so it looks dropped there
 * by a hand, and given the same shadow as the tag so the two sit on one plane.
 */
function TopicTag() {
  return (
    <span className="relative inline-flex">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="absolute -left-7 -top-6 h-9 w-9 rotate-[-10deg] text-graphite drop-shadow-[0_6px_10px_rgba(17,17,17,0.28)]"
        fill="currentColor"
      >
        <path d="M5.2 1.9 L19.6 13.4 L12.3 13.9 L15.9 21.2 L12.6 22.8 L9 15.4 L5.2 19.1 Z" />
      </svg>
      <span className="rounded-full bg-graphite px-5 py-2.5 text-sm font-semibold text-paper shadow-[0_18px_36px_-18px_rgba(17,17,17,0.75)]">
        Photosynthesis
      </span>
    </span>
  );
}

/** Rotating stamp, bottom-right. */
function RoundBadge({ reduced }: { reduced: boolean }) {
  const text = "TEACH IT · TO LEARN IT · TEACH IT · TO LEARN IT · ";
  return (
    <div className="sticker relative flex h-[104px] w-[104px] items-center justify-center">
      <svg
        viewBox="0 0 100 100"
        className={`absolute inset-0 h-full w-full ${reduced ? "" : "badge-spin"}`}
        aria-hidden
      >
        <defs>
          <path id="badge-arc" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0" fill="none" />
        </defs>
        <text className="fill-graphite text-[9.2px] font-semibold tracking-[0.08em]">
          <textPath href="#badge-arc">{text}</textPath>
        </text>
      </svg>
      <span aria-hidden className="text-xl">
        ✎
      </span>
    </div>
  );
}

/**
 * Loose green marker strokes behind the type. Drawn as filled polygons
 * rather than strokes so the ends stay chisel-cut like a real marker.
 */
function GreenStrokes({
  run,
  reduced,
  driftX,
  driftY,
}: {
  run: boolean;
  reduced: boolean;
  driftX: ReturnType<typeof useSpring>;
  driftY: ReturnType<typeof useSpring>;
}) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
      style={reduced ? undefined : { x: driftX, y: driftY }}
      initial={{ opacity: 0 }}
      animate={{ opacity: run ? 1 : 0 }}
      transition={{ duration: 1.1, delay: run ? B.strokes : 0, ease: EASE }}
    >
      {/* Both strokes are kept out of the headline's horizontal band —
          they sit behind it in z, but crossing the type still reads as a
          collision rather than as depth. */}
      <svg
        className={`absolute bottom-[17%] left-[6%] h-[150px] w-[280px] ${reduced ? "" : "stroke-breathe"}`}
        viewBox="0 0 340 190"
        fill="var(--grass)"
      >
        <path d="M6 150 L96 66 L130 96 L188 40 L214 66 L150 132 L118 104 L38 182 Z" />
      </svg>
      <svg
        className={`absolute right-[5%] top-[9%] h-[140px] w-[250px] ${reduced ? "" : "stroke-breathe"}`}
        viewBox="0 0 300 170"
        fill="var(--grass)"
        style={{ animationDelay: "-5s" }}
      >
        <path d="M12 96 L78 22 L110 52 L166 6 L196 32 L292 26 L286 62 L176 72 L138 44 L86 92 L52 66 Z" />
      </svg>
    </motion.div>
  );
}
