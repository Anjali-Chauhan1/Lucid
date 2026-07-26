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
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-chalk">Code not found</h1>
        <p className="mt-3 text-sm text-chalk-dim">
          “{code.toUpperCase()}” doesn’t match an active assignment. Double-check the
          code with your teacher.
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="text-[11px] uppercase tracking-[0.24em] text-violet">
        {BRAND.name} assignment
      </p>
      <h1 className="mt-2 font-display text-3xl text-chalk">{data.assignment.concept}</h1>
      <p className="mt-1 text-sm text-chalk-dim">
        {data.assignment.mode} mode
        {data.assignment.teacherLabel ? ` · ${data.assignment.teacherLabel}` : ""}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-chalk-dim">
        Same {BRAND.score.name} engine as always — your result will also be shared with
        your teacher under the name you enter below.
      </p>

      <JoinForm assignment={data.assignment} />
    </main>
  );
}
