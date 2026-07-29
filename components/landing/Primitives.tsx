"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionStyle,
} from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/* ═══════════════════════════════════════════════════════════════
   Shared building blocks for the landing page.
   Every one of these degrades to a static element when the user
   has asked for reduced motion.
   ═══════════════════════════════════════════════════════════════ */

/** The one easing curve the whole page uses, so nothing feels borrowed. */
export const EASE = [0.22, 1, 0.36, 1] as const;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReduced(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * Reduced-motion preference, safe to branch the rendered tree on.
 *
 * framer-motion's own `useReducedMotion` resolves the media query during the
 * first client render, which disagrees with the server's HTML and hydrates
 * mismatched. `useSyncExternalStore` pins the first render to the server
 * snapshot (`false`) and re-renders once hydration is done, so SSR and the
 * client always agree.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/**
 * Fades + lifts its children when they scroll into view, once.
 * `delay` staggers siblings; `from` picks the direction of travel.
 */
export function Reveal({
  children,
  delay = 0,
  from = "up",
  distance = 26,
  className,
}: {
  children: ReactNode;
  delay?: number;
  from?: "up" | "down" | "left" | "right" | "none";
  distance?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  const offset =
    from === "up"
      ? { y: distance }
      : from === "down"
        ? { y: -distance }
        : from === "left"
          ? { x: -distance }
          : from === "right"
            ? { x: distance }
            : {};

  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 1 } : { opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px -12% 0px" }}
      transition={{ duration: 0.72, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A surface that tilts toward the pointer in real 3D.
 *
 * The rotation is applied on the wrapper while children sit on their own
 * translateZ planes, so the parallax between layers is genuine perspective
 * projection rather than a 2D fake.
 */
export function Tilt3D({
  children,
  className,
  strength = 12,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  /** Max rotation in degrees at the far corners. */
  strength?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // -0.5 … 0.5, normalized pointer position within the element.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const spring = { stiffness: 220, damping: 22, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [strength, -strength]), spring);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-strength, strength]), spring);

  // Glare tracks the pointer across the surface.
  const glareX = useTransform(px, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(py, [-0.5, 0.5], ["0%", "100%"]);
  const glareBg = useTransform(
    [glareX, glareY],
    ([x, y]: string[]) =>
      `radial-gradient(420px circle at ${x} ${y}, rgba(255,211,110,0.15), transparent 62%)`,
  );

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }

  function reset() {
    px.set(0);
    py.set(0);
  }

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div ref={ref} className="stage-3d" onPointerMove={onPointerMove} onPointerLeave={reset}>
      <motion.div
        className={`layer-3d relative ${className ?? ""}`}
        style={{ rotateX, rotateY }}
      >
        {children}
        {glare && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ background: glareBg } as MotionStyle}
          />
        )}
      </motion.div>
    </div>
  );
}

/**
 * Small caps label that sits above a section title.
 *
 * The first five tones are the dark-theme accents; `grass` and `cobalt` are
 * their counterparts for `theme-paper` sections. Those two use the palette's
 * `-ink` partners for the text and the plain fill only for border and wash —
 * the saturated fills are too light to carry type on paper.
 */
export function Eyebrow({
  children,
  tone = "amber",
}: {
  children: ReactNode;
  tone?: "amber" | "violet" | "sky" | "emerald" | "rose" | "grass" | "cobalt" | "gold" | "rose-paper";
}) {
  const tones = {
    amber: "text-amber border-amber/30 bg-amber/8",
    violet: "text-violet border-violet/30 bg-violet/8",
    sky: "text-sky border-sky/30 bg-sky/8",
    emerald: "text-emerald border-emerald/30 bg-emerald/8",
    rose: "text-rose border-rose/30 bg-rose/8",
    grass: "text-grass-ink border-grass/40 bg-grass/10",
    cobalt: "text-cobalt-ink border-cobalt/40 bg-cobalt/10",
    gold: "text-gold-ink border-gold/40 bg-gold/10",
    "rose-paper": "text-rose-paper-ink border-rose-paper/40 bg-rose-paper/10",
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Counts up to `value` the first time it enters the viewport.
 * Uses framer-motion's `animate` so it shares the page's easing.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  suffix = "",
  duration = 1.6,
  immediate = false,
  className,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  duration?: number;
  /**
   * Count on mount instead of waiting for the viewport. For numbers that sit
   * at or below the fold on first paint, where "in view" never fires and the
   * value would otherwise read a misleading 0.
   */
  immediate?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "-15% 0px" });
  const inView = immediate || seen;
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- reduced-motion
         is a browser-only media query, so the final value can only be committed
         after mount. One render, no cascade. */
      setShown(value);
      return;
    }
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setShown(v),
    });
    return () => controls.stop();
  }, [inView, value, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/**
 * A button that leans toward the cursor as it approaches.
 * Falls back to a plain wrapper under reduced motion.
 *
 * `strength` is the lean in px at the very edge of the reach, and it is a hard
 * cap rather than a coefficient — that distinction matters. Scaling the raw
 * cursor offset instead (`dx * 0.22`, as this did) sounds bounded but isn't:
 * the reach grows with the element, so on a wide button the far corner of its
 * own trigger zone is ~180px out and the thing slides ~40px, far enough to
 * collide with whatever sits beside it. Keep `strength` under the smallest
 * gap to a neighbour and a collision is arithmetically impossible.
 */
export function Magnetic({
  children,
  className,
  radius = 90,
  strength = 7,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
  /** Maximum lean, in px. Never exceeded, whatever the element's size. */
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const x = useSpring(0, { stiffness: 260, damping: 18 });
  const y = useSpring(0, { stiffness: 260, damping: 18 });

  useEffect(() => {
    if (reduced) return;
    function onMove(e: PointerEvent) {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const reach = radius + Math.max(r.width, r.height) / 2;
      if (Math.hypot(dx, dy) < reach) {
        // Normalizing by `reach` is what bounds this: each axis contributes at
        // most `strength`, since |dx| and |dy| are themselves under `reach`.
        x.set((dx / reach) * strength);
        y.set((dy / reach) * strength);
      } else {
        x.set(0);
        y.set(0);
      }
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [radius, strength, reduced, x, y]);

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div ref={ref} style={{ x, y }} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Reveals text word-by-word on scroll. Kept to headline-length strings —
 * the whole string stays in the accessibility tree as one label.
 */
export function WordReveal({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  const words = text.split(" ");

  if (reduced) return <span className={className}>{text}</span>;

  return (
    <motion.span
      className={className}
      aria-label={text}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ staggerChildren: 0.045, delayChildren: delay }}
    >
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden className="inline-block overflow-hidden align-bottom">
          <motion.span
            className="inline-block"
            variants={{
              hidden: { y: "108%", opacity: 0 },
              show: { y: "0%", opacity: 1 },
            }}
            transition={{ duration: 0.66, ease: EASE }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </motion.span>
  );
}

/**
 * Two lavender-blues for a smoke/cloud trail — a muted back tone and a
 * lighter front tone, layered so a cloud reads as several lobes at slightly
 * different depths rather than one flat blob. Shared by every paper-plane
 * trail on the site, so they all read as the same exhaust.
 */
export const CLOUD_BACK = "#93a8e0";
export const CLOUD_FRONT = "#cfd9f6";

/**
 * A soft, layered cloud — several overlapping circles in two lavender-blue
 * tones, deliberately breaking this site's usual flat-poster construction
 * (solid fill + single crisp graphite line). A hard-outlined cloud reads as
 * a shape, not as vapour, so this skips the outline entirely and leans on
 * soft overlap instead — and the whole group carries a blur, so the edges
 * genuinely diffuse into the page rather than just being an unstroked circle
 * (which, filled solid, still has a crisp silhouette — fog doesn't).
 *
 * Scale/opacity are left to the caller (a wrapping `motion.svg` or `motion.g`
 * with its own `style`), so this stays a plain static shape reusable
 * anywhere a plane needs a trail behind it.
 */
export function SmokeCloud() {
  return (
    <g style={{ filter: "blur(9px)" }}>
      <g fill={CLOUD_BACK} opacity={0.85}>
        <circle cx={-38} cy={-6} r={30} />
        <circle cx={-10} cy={-24} r={26} />
        <circle cx={24} cy={-12} r={24} />
      </g>
      <g fill={CLOUD_FRONT}>
        <circle cx={-46} cy={14} r={34} />
        <circle cx={-8} cy={-2} r={38} />
        <circle cx={30} cy={10} r={30} />
        <circle cx={-24} cy={28} r={28} />
      </g>
    </g>
  );
}
