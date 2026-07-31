"use client";

import { motion } from "framer-motion";
import type { ScoreDimensions } from "@/lib/types";

const DIMENSIONS = [
  {
    key: "coverage" as const,
    label: "Coverage",
    color: "var(--gold-ink)",
    blurb: "How much of the concept you actually reached",
  },
  {
    key: "correctness" as const,
    label: "Correctness",
    color: "var(--grass-ink)",
    blurb: "Whether what you said contradicts the facts",
  },
  {
    key: "depth" as const,
    label: "Depth",
    color: "var(--cobalt-ink)",
    blurb: "How you handled the causal “why” questions",
  },
];

export default function DimensionBars({ dimensions }: { dimensions: ScoreDimensions }) {
  return (
    <div className="space-y-5">
      {DIMENSIONS.map((d, i) => {
        const value = dimensions[d.key];
        const pct = value === null ? 0 : Math.round(value * 100);
        return (
          <div key={d.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-graphite">{d.label}</span>
              <span className="text-sm tabular-nums text-graphite-muted">
                {value === null ? "not measured" : `${pct}%`}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-paper-deep">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: d.color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{
                  duration: 0.9,
                  delay: 0.5 + i * 0.18,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            </div>
            <p className="mt-1.5 text-xs text-graphite-faint">{d.blurb}</p>
          </div>
        );
      })}
    </div>
  );
}
