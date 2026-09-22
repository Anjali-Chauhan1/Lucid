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

  const concept = await resolveConcept(conceptId);

  if (!concept) {
    return (
      <main className="theme-paper paper-field flex min-h-screen w-full flex-col items-center justify-center px-6 text-center">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="font-display text-3xl text-graphite">Concept not found</h1>
          <p className="mt-3 text-sm text-graphite-muted">
            No concept map exists for “{conceptId}”. Custom topics are built when you
            launch them from the home page.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-full bg-graphite px-5 py-2.5 text-sm font-semibold text-paper"
          >
            Back home
          </Link>
        </div>
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
