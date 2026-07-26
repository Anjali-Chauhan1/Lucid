import Link from "next/link";
import { resolveConcept } from "@/lib/concepts/generate";
import type { SessionMode } from "@/lib/types";
import SessionExperience from "@/components/SessionExperience";

// In Next 16 both params and searchParams are Promises and must be awaited.
export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ conceptId: string }>;
  searchParams: Promise<{ mode?: string; assignmentCode?: string; studentName?: string }>;
}) {
  const { conceptId } = await params;
  const { mode, assignmentCode, studentName } = await searchParams;

  const concept = resolveConcept(conceptId);

  if (!concept) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-chalk">Concept not found</h1>
        <p className="mt-3 text-sm text-chalk-dim">
          No concept map exists for “{conceptId}”. Custom topics are built when you
          launch them from the home page.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-full bg-amber px-5 py-2.5 text-sm font-semibold text-ink-900"
        >
          Back home
        </Link>
      </main>
    );
  }

  const validMode: SessionMode =
    mode === "viva" || mode === "loop" ? mode : "explain";

  return (
    <SessionExperience
      concept={concept}
      mode={validMode}
      assignment={assignmentCode && studentName ? { code: assignmentCode, studentName } : undefined}
    />
  );
}
