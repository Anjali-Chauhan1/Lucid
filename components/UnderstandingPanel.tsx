"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ConceptMap, AnalysisReport } from "@/lib/types";

interface Props {
  concept: ConceptMap;
  report: AnalysisReport | null;
  analyzing: boolean;
}

/**
 * The signature visual: every idea in the concept map is a node that stays
 * dim until the engine detects the student actually covered it, then lights
 * up. Watching this fill in during the demo is the whole product in one image.
 */
export default function UnderstandingPanel({ concept, report, analyzing }: Props) {
  const coveredIds = new Set(report?.coveredNodes.map((n) => n.nodeId) ?? []);
  const covered = coveredIds.size;
  const total = concept.nodes.length;
  const pct = total ? Math.round((covered / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-rule bg-paper-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg text-graphite">Understanding map</h3>
        <span className="text-xs tabular-nums text-graphite-faint">
          {covered}/{total} ideas
        </span>
      </div>

      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-paper-deep">
        <motion.div
          className="h-full rounded-full bg-gold"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {concept.nodes.map((node, i) => {
          const isCovered = coveredIds.has(node.id);
          return (
            <motion.li
              key={node.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-colors duration-500 ${
                isCovered
                  ? "border-grass/40 bg-grass/[0.07]"
                  : "border-rule bg-paper-deep/60"
              }`}
            >
              <motion.span
                aria-hidden
                className="mt-[3px] block h-2.5 w-2.5 shrink-0 rounded-full"
                animate={
                  isCovered
                    ? {
                        backgroundColor: "var(--grass)",
                        boxShadow: "0 0 12px 2px rgba(47,158,79,0.35)",
                        scale: [1, 1.5, 1],
                      }
                    : { backgroundColor: "var(--rule-strong)", boxShadow: "none", scale: 1 }
                }
                transition={{ duration: 0.5 }}
              />
              <span
                className={`text-sm leading-snug ${
                  isCovered ? "text-graphite" : "text-graphite-faint"
                }`}
              >
                {node.text}
              </span>
            </motion.li>
          );
        })}
      </ul>

      <AnimatePresence>
        {analyzing && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 text-center text-xs text-gold-ink"
          >
            Measuring your explanation…
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
