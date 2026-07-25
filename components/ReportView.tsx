"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { BRAND } from "@/lib/brand";
import { loadReport, type StoredReport } from "@/lib/store";
import { categoryInfo } from "@/lib/ml/misconceptionTaxonomy";
import ScoreGauge from "./ScoreGauge";
import DimensionBars from "./DimensionBars";
import DeltaReveal from "./DeltaReveal";

const LABEL_COPY: Record<string, { title: string; blurb: string; color: string }> = {
  good: {
    title: "Understood",
    blurb: "You explained this in your own words and covered the ground.",
    color: "var(--emerald)",
  },
  partial: {
    title: "Partly there",
    blurb: "Your own words — but pieces of the concept are still missing.",
    color: "var(--amber)",
  },
  memorized: {
    title: "Recited, not understood",
    blurb: "This tracked the textbook wording too closely to show understanding.",
    color: "var(--amber-deep)",
  },
  wrong: {
    title: "Contains errors",
    blurb: "Some of what you said contradicts the facts of this concept.",
    color: "var(--rose)",
  },
};

export default function ReportView({ sessionId }: { sessionId: string }) {
  const [stored, setStored] = useState<StoredReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = loadReport(sessionId);
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage is a
       browser-only external store; it cannot be read during SSR or in a render
       body, so hydrating from it on mount is the intended external-system sync. */
    setStored(s);
    setLoading(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    if (s && s.report.samajhScore >= 80) {
      // Celebrate only a genuinely strong result.
      confetti({
        particleCount: 130,
        spread: 78,
        origin: { y: 0.35 },
        colors: ["#f4b942", "#ffd36e", "#5ad19a", "#e9eef3"],
      });
    }
  }, [sessionId]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6">
        <p className="text-sm text-chalk-faint">Loading your report…</p>
      </main>
    );
  }

  if (!stored) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-chalk">Report not found</h1>
        <p className="mt-3 text-sm text-chalk-dim">
          Reports are stored in this browser only. If you cleared site data or opened
          this link elsewhere, it is gone.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-ink-900"
        >
          Start a new session
        </Link>
      </main>
    );
  }

  const { report, priorScore, concept, conceptId, mode, microLesson } = stored;
  const label = LABEL_COPY[report.classifierLabel] ?? LABEL_COPY.partial;
  const improved = typeof priorScore === "number";

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link href="/" className="text-xs text-chalk-faint hover:text-amber">
        ← {BRAND.name}
      </Link>

      <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-chalk-faint">
        {concept} · {mode} mode
      </p>
      <h1 className="mt-1 font-display text-4xl text-chalk">{BRAND.score.name}</h1>
      <p className="mt-2 max-w-xl text-sm text-chalk-dim">{BRAND.score.tagline}</p>

      {/* ---------- Loop Mode money shot ---------- */}
      {improved && (
        <div className="mt-8">
          <DeltaReveal before={priorScore!} after={report.samajhScore} />
        </div>
      )}

      {/* ---------- score + dimensions ---------- */}
      <section className="mt-10 grid items-center gap-10 md:grid-cols-[auto_1fr]">
        <div className="flex justify-center">
          <ScoreGauge score={report.samajhScore} label={BRAND.score.name} />
        </div>
        <div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-6 rounded-xl border p-4"
            style={{ borderColor: `${label.color}55`, background: `${label.color}12` }}
          >
            <p className="font-display text-xl" style={{ color: label.color }}>
              {label.title}
            </p>
            <p className="mt-1 text-sm text-chalk-dim">{label.blurb}</p>
            <p className="mt-2 text-[11px] text-chalk-faint">
              classifier: {report.classifierLabel} ·{" "}
              {(report.confidence * 100).toFixed(0)}% confidence ·{" "}
              {report.usedTrainedModel ? "trained model" : "heuristic fallback"}
            </p>
          </motion.div>
          <DimensionBars dimensions={report.dimensions} />
        </div>
      </section>

      {/* ---------- Parrot Detector ---------- */}
      <section className="mt-12 rounded-2xl border border-ink-600 bg-ink-800/50 p-6">
        <h2 className="font-display text-2xl text-chalk">{BRAND.parrot.name}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Metric
            label="Verdict"
            value={report.ratta.flag ? "Recited" : "Own words"}
            tone={report.ratta.flag ? "warn" : "good"}
          />
          <Metric
            label="Textbook similarity"
            value={`${(report.ratta.similarity * 100).toFixed(0)}%`}
          />
          <Metric
            label="Phrase overlap"
            value={`${(report.ratta.ngramOverlap * 100).toFixed(0)}%`}
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-chalk-faint">
          Both signals matter: high semantic similarity alone just means you were
          correct. It only counts as recitation when the exact phrasing overlaps too.
        </p>
      </section>

      {/* ---------- gaps ---------- */}
      <section className="mt-12">
        <h2 className="font-display text-2xl text-chalk">
          {report.gaps.length ? "What you didn't reach" : "You covered everything"}
        </h2>
        {report.gaps.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {report.gaps.map((g, i) => (
              <motion.div
                key={g.nodeId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="rounded-xl border border-ink-600 bg-ink-850/60 p-4"
              >
                <p className="text-sm text-chalk">{g.nodeText}</p>
                <p className="mt-2 text-[11px] text-chalk-faint">
                  closest match in your explanation:{" "}
                  {(g.bestSimilarity * 100).toFixed(0)}%
                </p>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-chalk-dim">
            Every idea in the concept map showed up in your explanation.
          </p>
        )}
      </section>

      {/* ---------- wrong statements ---------- */}
      {report.wrongStatements.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl text-chalk">Where you went wrong</h2>
          <div className="mt-4 space-y-3">
            {report.wrongStatements.map((w, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
                className="rounded-xl border border-rose/40 bg-rose/[0.07] p-4"
              >
                <p className="text-sm text-chalk">
                  <span className="text-rose">You said:</span> “{w.said}”
                </p>
                <p className="mt-2 text-sm text-chalk-dim">
                  <span className="text-emerald">But actually:</span> {w.contradicts}
                </p>
                {w.misconceptionCategory && (
                  <p className="mt-2 text-[11px] uppercase tracking-wider text-rose/70">
                    Pattern: {categoryInfo(w.misconceptionCategory).label}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {microLesson && (
        <section className="mt-12 rounded-2xl border border-violet/40 bg-violet/[0.07] p-6">
          <h2 className="font-display text-xl text-violet">Your micro-lesson</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-chalk-dim">
            {microLesson}
          </p>
        </section>
      )}

      {/* ---------- actions ---------- */}
      <div className="mt-14 flex flex-wrap gap-3">
        <Link
          href={`/session/${conceptId}?mode=loop`}
          className="rounded-full bg-amber px-6 py-3 text-sm font-semibold text-ink-900 hover:bg-amber-bright"
        >
          Close the gaps (Loop Mode) →
        </Link>
        <Link
          href={`/session/${conceptId}?mode=viva`}
          className="rounded-full border border-ink-600 px-6 py-3 text-sm text-chalk-dim hover:border-ink-500 hover:text-chalk"
        >
          Try a viva
        </Link>
        <Link
          href="/progress"
          className="rounded-full border border-ink-600 px-6 py-3 text-sm text-chalk-dim hover:border-ink-500 hover:text-chalk"
        >
          My progress
        </Link>
      </div>

      <p className="mt-10 text-[11px] leading-relaxed text-chalk-faint">
        Timings: {Object.entries(report.timings).map(([k, v]) => `${k} ${v}ms`).join(" · ")}
        {report.degraded.length > 0 && ` · degraded: ${report.degraded.join(", ")}`}
      </p>
    </main>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  const color =
    tone === "warn" ? "var(--amber)" : tone === "good" ? "var(--emerald)" : "var(--chalk)";
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-850/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-chalk-faint">{label}</p>
      <p className="mt-1 font-display text-xl tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
