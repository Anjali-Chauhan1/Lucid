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

const SERIES_COLORS = [
  "var(--amber)",
  "var(--emerald)",
  "var(--sky)",
  "var(--violet)",
  "var(--rose)",
  "var(--amber-bright)",
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

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link href="/" className="text-xs text-chalk-faint hover:text-amber">
        ← {BRAND.name}
      </Link>
      <h1 className="mt-3 font-display text-4xl text-chalk">Your progress</h1>
      <p className="mt-2 text-sm text-chalk-dim">
        {BRAND.score.name} per concept, across every session. Stored in this browser
        only.
      </p>

      {!ready ? (
        <p className="mt-10 text-sm text-chalk-faint">Loading…</p>
      ) : history.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-ink-600 bg-ink-800/50 p-10 text-center">
          <p className="font-display text-2xl text-chalk">Nothing here yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-chalk-dim">
            Teach a concept and your score will start plotting here. The interesting
            line is the one that climbs after Loop Mode.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-amber px-6 py-3 text-sm font-semibold text-ink-900"
          >
            Teach something →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <Stat label="Sessions" value={String(history.length)} />
            <Stat label="Best score" value={String(best)} color="var(--emerald)" />
            <Stat label="Average" value={String(avg)} color="var(--amber)" />
            <Stat
              label="Biggest jump"
              value={biggestJump > 0 ? `+${biggestJump}` : "—"}
              color="var(--violet)"
            />
          </div>

          {blindSpots.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xl text-chalk">Recurring blind spots</h2>
              <p className="mt-1 text-sm text-chalk-dim">
                The same kind of wrong reasoning, caught across unrelated topics — not
                what you got wrong, but the pattern behind it.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {blindSpots.map((b) => (
                  <div
                    key={b.category}
                    className="rounded-xl border border-rose/30 bg-rose/6 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-base text-chalk">{b.info.label}</p>
                      <span className="rounded-full bg-rose/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose">
                        {b.concepts.length} subjects
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-chalk-dim">{b.info.description}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-chalk-faint">
                      Seen in: {b.concepts.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 h-[380px] rounded-2xl border border-ink-600 bg-ink-800/50 p-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -18 }}>
                <CartesianGrid stroke="var(--ink-700)" vertical={false} />
                <XAxis
                  dataKey="attempt"
                  stroke="var(--chalk-faint)"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="var(--chalk-faint)"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--ink-800)",
                    border: "1px solid var(--ink-600)",
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                  labelStyle={{ color: "var(--chalk-faint)" }}
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
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-850/50 px-4 py-3"
              >
                <div>
                  <Link
                    href={`/report/${h.sessionId}`}
                    className="text-sm text-chalk hover:text-amber"
                  >
                    {h.concept}
                  </Link>
                  <span className="ml-2 text-[11px] uppercase tracking-wider text-chalk-faint">
                    {h.mode}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm tabular-nums">
                  {typeof h.priorScore === "number" && (
                    <span className="text-chalk-faint">
                      {h.priorScore} →{" "}
                      <span className="text-emerald">+{h.samajhScore - h.priorScore}</span>
                    </span>
                  )}
                  <span className="font-display text-lg text-amber">{h.samajhScore}</span>
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={() => {
              clearHistory();
              setHistory([]);
            }}
            className="mt-8 text-xs text-chalk-faint underline-offset-4 hover:text-rose hover:underline"
          >
            Clear history
          </button>
        </>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  color = "var(--chalk)",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800/50 p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-chalk-faint">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
