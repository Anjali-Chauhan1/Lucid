import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { conceptSummaries } from "@/lib/concepts";
import TeacherCreateForm from "@/components/TeacherCreateForm";

export default function TeacherPage() {
  const concepts = conceptSummaries();

  return (
    <main className="theme-paper paper-field min-h-screen w-full">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
        <Link href="/" className="text-xs text-graphite-faint hover:text-gold-ink">
          ← {BRAND.name}
        </Link>

        <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-cobalt-ink">For teachers</p>
        <h1 className="mt-2 font-display text-4xl text-graphite md:text-5xl">Assign a topic</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-graphite-muted">
          Pick a concept and a mode, get a join code. Every student who joins runs the
          exact same {BRAND.score.name} + {BRAND.parrot.name} session — you get a class-wide
          view of scores and, more usefully, which misconception patterns are recurring
          across your students, not just within one.
        </p>

        <TeacherCreateForm concepts={concepts} />
      </div>
    </main>
  );
}
