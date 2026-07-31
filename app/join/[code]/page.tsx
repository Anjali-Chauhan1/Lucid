import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { getAssignment } from "@/lib/assignments";
import JoinForm from "@/components/JoinForm";

// Reads .cache/assignments/<code>.json at request time — a freshly created
// assignment must be joinable immediately, not served from a stale build.
export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const data = getAssignment(code);

  if (!data) {
    return (
      <main className="theme-paper paper-field flex min-h-screen w-full flex-col items-center justify-center px-6 text-center">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="font-display text-3xl text-graphite">Code not found</h1>
          <p className="mt-3 text-sm text-graphite-muted">
            “{code.toUpperCase()}” doesn’t match an active assignment. Double-check the
            code with your teacher.
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

  return (
    <main className="theme-paper paper-field flex min-h-screen w-full flex-col justify-center">
      <div className="mx-auto w-full max-w-md px-6 py-16">
        <p className="text-[11px] uppercase tracking-[0.24em] text-cobalt-ink">
          {BRAND.name} assignment
        </p>
        <h1 className="mt-2 font-display text-3xl text-graphite">{data.assignment.concept}</h1>
        <p className="mt-1 text-sm text-graphite-muted">
          {data.assignment.mode} mode
          {data.assignment.teacherLabel ? ` · ${data.assignment.teacherLabel}` : ""}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-graphite-muted">
          Same {BRAND.score.name} engine as always — your result will also be shared with
          your teacher under the name you enter below.
        </p>

        <JoinForm assignment={data.assignment} />
      </div>
    </main>
  );
}
