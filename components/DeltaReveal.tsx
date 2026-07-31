"use client";

import { animate, motion, useMotionValue } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * The Loop Mode money shot: before → after, with the delta scaling up.
 * This is the shot the demo video is built around, so it gets deliberate
 * staging — the numbers land first, the delta punches in after.
 */
export default function DeltaReveal({
  before,
  after,
}: {
  before: number;
  after: number;
}) {
  const delta = after - before;
  const improved = delta > 0;

  const [shownAfter, setShownAfter] = useState(before);
  const afterValue = useMotionValue(before);

  useEffect(() => {
    const controls = animate(afterValue, after, {
      duration: 1.4,
      delay: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setShownAfter(Math.round(v)),
    });
    return () => controls.stop();
  }, [after, afterValue]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-grass/40 bg-gradient-to-r from-grass/[0.12] to-transparent p-6"
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-grass-ink">
        After the micro-lesson
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-5">
        <span className="font-display text-5xl tabular-nums text-graphite-faint line-through decoration-2">
          {before}
        </span>

        <motion.span
          aria-hidden
          className="text-3xl text-grass-ink"
          initial={{ x: -6, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          →
        </motion.span>

        <span className="font-display text-6xl tabular-nums text-grass-ink">
          {shownAfter}
        </span>

        {improved && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: [0.4, 1.25, 1], opacity: 1 }}
            transition={{ delay: 1.9, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-full bg-grass px-4 py-1.5 font-display text-2xl font-semibold tabular-nums text-paper"
          >
            +{delta}
          </motion.span>
        )}
      </div>

      <p className="mt-4 text-sm text-graphite-muted">
        {improved
          ? "Same concept, same student — measured before and after a lesson that targeted only the detected gaps."
          : "No improvement this round. The gaps below are still open."}
      </p>
    </motion.div>
  );
}
