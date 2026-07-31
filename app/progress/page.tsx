"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BRAND } from "@/lib/brand";
import { clearHistory, loadHistory } from "@/lib/store";
import type { MisconceptionCategory, SessionHistoryEntry } from "@/lib/types";
import { categoryInfo } from "@/lib/ml/misconceptionTaxonomy";
import { calibrate } from "@/lib/calibration";
import { daysSince, isDueForReview } from "@/lib/spacedRepetition";

const SERIES_COLORS = [
  "var(--gold-ink)",
  "var(--grass-ink)",
  "var(--cobalt-ink)",
  "var(--rose-paper-ink)",
  "var(--gold)",
  "var(--grass)",
];

export default function ProgressPage() {
  const [history, setHistory] = useState<SessionHistoryEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage is a
       browser-only external store; it cannot be read during SSR. */
    setHistory(loadHistory());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  /** One line per concept, x = attempt number for that concept. */
  const { rows, concepts } = useMemo(() => {
    const byConcept = new Map<string, SessionHistoryEntry[]>();
    for (const h of history) {
      const list = byConcept.get(h.concept) ?? [];
      list.push(h);
      byConcept.set(h.concept, list);
    }
    const names = [...byConcept.keys()];
    const maxLen = Math.max(0, ...names.map((n) => byConcept.get(n)!.length));
    const data: Record<string, number | string>[] = [];
    for (let i = 0; i < maxLen; i++) {
      const row: Record<string, number | string> = { attempt: `#${i + 1}` };
      for (const n of names) {
        const entry = byConcept.get(n)![i];
        if (entry) row[n] = entry.samajhScore;
      }
      data.push(row);
    }
    return { rows: data, concepts: names };
  }, [history]);

  const best = history.length
    ? Math.max(...history.map((h) => h.samajhScore))
    : 0;
  const avg = history.length
    ? Math.round(history.reduce((s, h) => s + h.samajhScore, 0) / history.length)
    : 0;
  const biggestJump = history.reduce((max, h) => {
    if (typeof h.priorScore !== "number") return max;
    return Math.max(max, h.samajhScore - h.priorScore);
  }, 0);

  /**
   * Misconception Fingerprint: a category only counts as a "recurring blind
   * spot" once it has fired in TWO OR MORE DIFFERENT concepts — that cross-
   * topic repetition is the signal that it's a pattern in how the student
   * reasons, not just one hard topic.
   */
  const blindSpots = useMemo(() => {
    const byCategory = new Map<MisconceptionCategory, { concepts: Set<string>; count: number }>();
    for (const h of history) {
      for (const cat of h.misconceptionCategories ?? []) {
        const entry = byCategory.get(cat) ?? { concepts: new Set<string>(), count: 0 };
        entry.concepts.add(h.concept);
        entry.count += 1;
        byCategory.set(cat, entry);
      }
    }
    return [...byCategory.entries()]
      .filter(([, v]) => v.concepts.size >= 2)
      .map(([category, v]) => ({
        category,
        info: categoryInfo(category),
        concepts: [...v.concepts],
        count: v.count,
      }))
      .sort((a, b) => b.concepts.length - a.concepts.length);
  }, [history]);

  /**
   * Spaced repetition: for each concept, look only at its MOST RECENT
   * session — a concept last seen well is due later than one last seen
   * shakily (see lib/spacedRepetition.ts). This surfaces "about to be
   * forgotten" purely from timestamps already being recorded, no new
   * tracking needed.
   */
  const dueForReview = useMemo(() => {
    const latestByConcept = new Map<string, SessionHistoryEntry>();
    for (const h of history) {
      const existing = latestByConcept.get(h.concept);
      if (!existing || h.timestamp > existing.timestamp) latestByConcept.set(h.concept, h);
    }
    return [...latestByConcept.values()]
      .filter((h) => isDueForReview(h.timestamp, h.samajhScore))
      .map((h) => ({ ...h, daysAgo: daysSince(h.timestamp) }))
      .sort((a, b) => b.daysAgo - a.daysAgo);
  }, [history]);

  /** Calibration: confidence vs actual score across every rated session. */
  const calibration = useMemo(() => {
    const points = history
      .filter((h): h is SessionHistoryEntry & { confidenceRating: number } =>
        typeof h.confidenceRating === "number",
      )
      .map((h) => ({
        concept: h.concept,
        actualScore: h.samajhScore,
        ...calibrate(h.confidenceRating, h.samajhScore),
      }));
    const counts = { overconfident: 0, underconfident: 0, calibrated: 0 };
    for (const p of points) counts[p.verdict]++;
    return { points, counts };
  }, [history]);

  return (
    <main className="theme-paper paper-field min-h-screen w-full">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link href="/" className="text-xs text-graphite-faint hover:text-gold-ink">
        ← {BRAND.name}
      </Link>
      <h1 className="mt-3 font-display text-4xl text-graphite">Your progress</h1>
      <p className="mt-2 text-sm text-graphite-muted">
        {BRAND.score.name} per concept, across every session. Stored in this browser
        only.
      </p>

      {!ready ? (
        <p className="mt-10 text-sm text-graphite-faint">Loading…</p>
      ) : history.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-rule bg-paper-card p-10 text-center">
          <p className="font-display text-2xl text-graphite">Nothing here yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-graphite-muted">
            Teach a concept and your score will start plotting here. The interesting
            line is the one that climbs after Loop Mode.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-graphite px-6 py-3 text-sm font-semibold text-paper"
          >
            Teach something →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <Stat label="Sessions" value={String(history.length)} />
            <Stat label="Best score" value={String(best)} color="var(--grass-ink)" />
            <Stat label="Average" value={String(avg)} color="var(--gold-ink)" />
            <Stat
              label="Biggest jump"
              value={biggestJump > 0 ? `+${biggestJump}` : "—"}
              color="var(--cobalt-ink)"
            />
          </div>

          {dueForReview.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xl text-graphite">Time to review</h2>
              <p className="mt-1 text-sm text-graphite-muted">
                Understanding fades on a schedule, not randomly — these are due before
                you forget them, not after.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {dueForReview.map((h) => (
                  <Link
                    key={h.conceptId}
                    href={`/session/${h.conceptId}?mode=explain`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gold/30 bg-gold/6 p-4 transition hover:border-gold/60"
                  >
                    <div>
                      <p className="font-display text-base text-graphite">{h.concept}</p>
                      <p className="mt-1 text-xs text-graphite-faint">
                        Scored {h.samajhScore} · {h.daysAgo === 0 ? "today" : `${h.daysAgo}d ago`}
                      </p>
                    </div>
                    <span className="text-sm text-gold-ink">Review →</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {blindSpots.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xl text-graphite">Recurring blind spots</h2>
              <p className="mt-1 text-sm text-graphite-muted">
                The same kind of wrong reasoning, caught across unrelated topics — not
                what you got wrong, but the pattern behind it.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {blindSpots.map((b) => (
                  <div
                    key={b.category}
                    className="rounded-xl border border-rose-paper/30 bg-rose-paper/6 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-base text-graphite">{b.info.label}</p>
                      <span className="rounded-full bg-rose-paper/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-paper-ink">
                        {b.concepts.length} subjects
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-graphite-muted">{b.info.description}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-graphite-faint">
                      Seen in: {b.concepts.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {calibration.points.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xl text-graphite">How well do you know what you know?</h2>
              <p className="mt-1 text-sm text-graphite-muted">
                Self-rated confidence, captured before scoring, compared against what
                you actually demonstrated.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <CalibrationStat
                  label="Overconfident"
                  count={calibration.counts.overconfident}
                  total={calibration.points.length}
                  color="var(--rose-paper-ink)"
                />
                <CalibrationStat
                  label="Well calibrated"
                  count={calibration.counts.calibrated}
                  total={calibration.points.length}
                  color="var(--grass-ink)"
                />
                <CalibrationStat
                  label="Underconfident"
                  count={calibration.counts.underconfident}
                  total={calibration.points.length}
                  color="var(--cobalt-ink)"
                />
              </div>
            </div>
          )}

          <div className="mt-8 h-[380px] rounded-2xl border border-rule bg-paper-card p-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="var(--rule)" vertical={false} />
                <XAxis
                  dataKey="attempt"
                  stroke="var(--graphite-faint)"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="var(--graphite-faint)"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--paper-card)",
                    border: "1px solid var(--rule)",
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                  labelStyle={{ color: "var(--graphite-faint)" }}
                />
                {concepts.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                    strokeWidth={2.5}
                    dot={{ r: 3.5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <ul className="mt-8 space-y-2">
            {[...history].reverse().map((h) => (
              <li
                key={h.sessionId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule bg-paper-card px-4 py-3"
              >
                <div>
                  <Link
                    href={`/report/${h.sessionId}`}
                    className="text-sm text-graphite hover:text-gold-ink"
                  >
                    {h.concept}
                  </Link>
                  <span className="ml-2 text-[11px] uppercase tracking-wider text-graphite-faint">
                    {h.mode}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm tabular-nums">
                  {typeof h.priorScore === "number" && (
                    <span className="text-graphite-faint">
                      {h.priorScore} →{" "}
                      <span className="text-grass-ink">+{h.samajhScore - h.priorScore}</span>
                    </span>
                  )}
                  <span className="font-display text-lg text-gold-ink">{h.samajhScore}</span>
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={() => {
              clearHistory();
              setHistory([]);
            }}
            className="mt-8 text-xs text-graphite-faint underline-offset-4 hover:text-rose-paper-ink hover:underline"
          >
            Clear history
          </button>
        </>
      )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  color = "var(--graphite)",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-rule bg-paper-card p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-graphite-faint">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function CalibrationStat({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-rule bg-paper-card p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-graphite-faint">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums" style={{ color }}>
        {count}/{total}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-deep">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
