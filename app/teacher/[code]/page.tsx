import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getAssignment } from "@/lib/assignments";
import { categoryInfo } from "@/lib/ml/misconceptionTaxonomy";
import type { MisconceptionCategory } from "@/lib/types";

/** Top N weakest (lowest-similarity) gaps to show inline per student. */
const TOP_GAPS_PER_STUDENT = 2;
import RefreshButton from "@/components/RefreshButton";

// Reads .cache/assignments/<code>.json at request time — must never be
// statically cached, or new submissions won't show up on refresh.
export const dynamic = "force-dynamic";

export default async function TeacherResultsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = getAssignment(code);

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-chalk">Code not found</h1>
        <Link
          href="/teacher"
          className="mt-6 rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-ink-900"
        >
          Create a new assignment
        </Link>
      </main>
    );
  }

  const { assignment, submissions } = data;
  const avg = submissions.length
    ? Math.round(submissions.reduce((s, x) => s + x.samajhScore, 0) / submissions.length)
    : 0;

  // Class-wide misconception pattern: a category counts once it has fired
  // for TWO OR MORE DIFFERENT STUDENTS — the cross-student repetition is
  // what tells a teacher "re-teach this," not just "one kid struggled."
  const byCategory = new Map<MisconceptionCategory, Set<string>>();
  for (const s of submissions) {
    for (const cat of s.misconceptionCategories ?? []) {
      const set = byCategory.get(cat) ?? new Set<string>();
      set.add(s.studentName);
      byCategory.set(cat, set);
    }
  }
  const classPatterns = [...byCategory.entries()]
    .filter(([, students]) => students.size >= 2)
    .map(([category, students]) => ({
      category,
      info: categoryInfo(category),
      students: [...students],
    }))
    .sort((a, b) => b.students.length - a.students.length);

  // Class-wide weak points: concept ideas missed by TWO OR MORE DIFFERENT
  // STUDENTS — same "re-teach this" signal as classPatterns above, but for
  // plain coverage gaps, which fire far more often than a misconception match.
  const byGapNode = new Map<string, { nodeText: string; students: Set<string> }>();
  for (const s of submissions) {
    for (const g of s.gaps ?? []) {
      const entry = byGapNode.get(g.nodeId) ?? { nodeText: g.nodeText, students: new Set<string>() };
      entry.students.add(s.studentName);
      byGapNode.set(g.nodeId, entry);
    }
  }
  const classGaps = [...byGapNode.entries()]
    .filter(([, g]) => g.students.size >= 2)
    .map(([nodeId, g]) => ({ nodeId, nodeText: g.nodeText, students: [...g.students] }))
    .sort((a, b) => b.students.length - a.students.length);

  const sortedSubmissions = [...submissions].sort((a, b) => a.samajhScore - b.samajhScore);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <Link href="/teacher" className="text-xs text-chalk-faint hover:text-amber">
        ← New assignment
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-violet">
            Assignment {assignment.code}
          </p>
          <h1 className="mt-1 font-display text-4xl text-chalk">{assignment.concept}</h1>
          <p className="mt-1 text-sm text-chalk-dim">
            {assignment.mode} mode
            {assignment.teacherLabel ? ` · ${assignment.teacherLabel}` : ""} · join at{" "}
            <span className="text-chalk">lucid/join/{assignment.code}</span>
          </p>
        </div>
        <RefreshButton />
      </div>

      {submissions.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-ink-600 bg-ink-800/50 p-10 text-center">
          <p className="font-display text-2xl text-chalk">No submissions yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-chalk-dim">
            Share the code <b className="text-chalk">{assignment.code}</b> with students.
            Results appear here as they finish — hit refresh.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Stat label="Submissions" value={String(submissions.length)} />
            <Stat label="Class average" value={String(avg)} color="var(--amber)" />
            <Stat
              label="Lowest score"
              value={String(sortedSubmissions[0].samajhScore)}
              color="var(--rose)"
            />
          </div>

          {classPatterns.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xl text-chalk">Class-wide misconceptions</h2>
              <p className="mt-1 text-sm text-chalk-dim">
                The same wrong-reasoning pattern, shared by multiple students — a signal to
                re-teach, not just a per-student gap.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {classPatterns.map((p) => (
                  <div
                    key={p.category}
                    className="rounded-xl border border-rose/30 bg-rose/6 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-base text-chalk">{p.info.label}</p>
                      <span className="rounded-full bg-rose/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose">
                        {p.students.length} students
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-chalk-dim">{p.info.description}</p>
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-chalk-faint">
                      {p.students.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {classGaps.length > 0 && (
            <div className="mt-8">
              <h2 className="font-display text-xl text-chalk">Class-wide weak points</h2>
              <p className="mt-1 text-sm text-chalk-dim">
                Ideas multiple students never mentioned — the most common reason for a low
                score, even without a specific misconception.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {classGaps.map((g) => (
                  <div
                    key={g.nodeId}
                    className="rounded-xl border border-amber/30 bg-amber/6 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-chalk">{g.nodeText}</p>
                      <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber">
                        {g.students.length} students
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] uppercase tracking-wider text-chalk-faint">
                      {g.students.join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <h2 className="font-display text-xl text-chalk">
              Students, lowest score first
            </h2>
            <ul className="mt-4 space-y-2">
              {sortedSubmissions.map((s) => {
                const weakestGaps = [...(s.gaps ?? [])]
                  .sort((a, b) => a.bestSimilarity - b.bestSimilarity)
                  .slice(0, TOP_GAPS_PER_STUDENT);
                return (
                <li
                  key={s.submissionId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-600 bg-ink-850/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm text-chalk">{s.studentName}</p>
                    {weakestGaps.length > 0 && (
                      <p className="mt-1 text-[11px] text-chalk-faint">
                        Missed: {weakestGaps.map((g) => g.nodeText).join(" · ")}
                      </p>
                    )}
                    {(s.misconceptionCategories?.length ?? 0) > 0 && (
                      <p className="mt-1 text-[11px] text-rose">
                        {s.misconceptionCategories!.map((c) => categoryInfo(c).label).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm tabular-nums">
                    {typeof s.confidenceRating === "number" && (
                      <span className="text-chalk-faint">{s.confidenceRating}/5 conf.</span>
                    )}
                    <span
                      className="font-display text-lg"
                      style={{
                        color:
                          s.samajhScore >= 80
                            ? "var(--emerald)"
                            : s.samajhScore >= 50
                              ? "var(--amber)"
                              : "var(--rose)",
                      }}
                    >
                      {s.samajhScore}
                    </span>
                  </div>
                </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      <p className="mt-10 text-[11px] text-chalk-faint">
        {BRAND.name} — results are stored server-side against this code only, no accounts
        involved. Anyone with the code can view this page.
      </p>
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
