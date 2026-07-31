import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { conceptSummaries } from "@/lib/concepts";
import TopicLauncher from "@/components/TopicLauncher";

export default function LearnPage() {
  const concepts = conceptSummaries();

  return (
    <main className="theme-paper paper-field min-h-screen w-full">
      <div className="mx-auto w-full max-w-3xl px-6 py-16 md:py-24">
        <Link href="/" className="text-xs text-graphite-faint hover:text-gold-ink">
          ← {BRAND.name}
        </Link>

        <p className="mt-4 text-[11px] uppercase tracking-[0.24em] text-gold-ink">Your turn</p>
        <h1 className="mt-2 font-display text-4xl text-graphite md:text-5xl">
          So — what will you teach?
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-graphite-muted">
          Pick a prepared concept, or type any topic at all — a concept map gets built
          for it on the spot. The AI plays a confused student and asks exactly where
          your understanding has gaps.
        </p>

        <div className="mt-8 rounded-3xl border border-rule bg-paper-card p-6 md:p-8">
          <TopicLauncher concepts={concepts} />
        </div>

        <Link
          href="/progress"
          className="mt-6 inline-block text-sm text-graphite-muted transition hover:text-graphite"
        >
          See my progress →
        </Link>
      </div>
    </main>
  );
}
