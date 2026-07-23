"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BRAND } from "@/lib/brand";
import type { RattaSignal } from "@/lib/types";

/**
 * The Parrot Detector moment — a full-width banner that slides down when the
 * engine finds BOTH high semantic similarity AND high n-gram overlap with the
 * stored textbook phrasing. Built to be screenshot-worthy for the demo video.
 */
export default function ParrotBanner({ ratta }: { ratta: RattaSignal | null }) {
  return (
    <AnimatePresence>
      {ratta?.flag && (
        <motion.div
          initial={{ opacity: 0, y: -24, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -24, height: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-4 rounded-2xl border border-amber/50 bg-gradient-to-r from-amber/[0.14] to-transparent p-5 glow-amber">
            <span aria-hidden className="text-3xl leading-none">
              🦜
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg text-amber-bright">
                {BRAND.parrot.name} triggered
              </p>
              <p className="mt-1 text-sm text-chalk">{BRAND.parrot.challenge}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-[11px] uppercase tracking-wider text-chalk-faint">
                <span>
                  textbook similarity{" "}
                  <b className="text-amber tabular-nums">
                    {(ratta.similarity * 100).toFixed(0)}%
                  </b>
                </span>
                <span>
                  phrase overlap{" "}
                  <b className="text-amber tabular-nums">
                    {(ratta.ngramOverlap * 100).toFixed(0)}%
                  </b>
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
