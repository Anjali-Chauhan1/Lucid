import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { conceptSummaries } from "@/lib/concepts";
import TopicLauncher from "@/components/TopicLauncher";
import HeroTagline from "@/components/HeroTagline";

export default function Home() {
  const concepts = conceptSummaries();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24">
      {/* ---------- hero ---------- */}
      <section className="max-w-3xl">
        <p className="text-[11px] uppercase tracking-[0.24em] text-amber">
          {BRAND.tagline}
        </p>
        <h1 className="mt-4 font-display text-5xl leading-[1.05] text-chalk md:text-7xl">
          {BRAND.name}
        </h1>

        <HeroTagline text={BRAND.heroLine} />

        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-chalk-dim">
          You explain a concept out loud. The AI plays a confused student and asks
          questions exactly where your understanding has holes — and a real ML engine,
          not the chatbot, measures how well you actually understand it.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="#start"
            className="rounded-full bg-amber px-6 py-3 text-sm font-semibold text-ink-900 transition hover:bg-amber-bright"
          >
            Start teaching →
          </Link>
          <Link
            href="/progress"
            className="rounded-full border border-ink-600 px-6 py-3 text-sm text-chalk-dim transition hover:border-ink-500 hover:text-chalk"
          >
            My progress
          </Link>
        </div>
      </section>

      {/* ---------- the two USPs ---------- */}
      <section className="mt-20 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-ink-600 bg-ink-800/50 p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber">USP 01</p>
          <h2 className="mt-2 font-display text-2xl text-chalk">{BRAND.score.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-chalk-dim">
            {BRAND.score.tagline}
          </p>
          <p className="mt-3 text-xs text-chalk-faint">
            Coverage (embedding similarity vs the concept map) · Correctness (NLI
            entailment vs reference facts) · Depth (causal “why” follow-ups)
          </p>
        </div>
        <div className="rounded-2xl border border-ink-600 bg-ink-800/50 p-6">
          <p className="text-[11px] uppercase tracking-[0.18em] text-amber">USP 02</p>
          <h2 className="mt-2 font-display text-2xl text-chalk">{BRAND.parrot.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-chalk-dim">
            A trained classifier separates an explanation in your own words from
            textbook recitation — using semantic similarity <em>and</em> n-gram
            overlap, because either signal alone gets fooled.
          </p>
          <p className="mt-3 text-xs italic text-chalk-faint">
            “{BRAND.parrot.challenge}”
          </p>
        </div>
      </section>

      {/* ---------- accessibility ---------- */}
      <section className="mt-8 rounded-2xl border border-sky/30 bg-sky/6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-sky/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky">
            No audio required
          </span>
        </div>
        <h2 className="mt-3 font-display text-2xl text-chalk">{BRAND.access.name}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-chalk-dim">
          {BRAND.access.tagline}
        </p>
        <ul className="mt-4 grid gap-2 text-xs text-chalk-faint sm:grid-cols-3">
          <li className="rounded-lg border border-ink-600 bg-ink-850/50 px-3 py-2">
            🎤 → ⌨️ Speak or type — your choice, every time
          </li>
          <li className="rounded-lg border border-ink-600 bg-ink-850/50 px-3 py-2">
            💬 Persona questions are always shown as text, never audio-only
          </li>
          <li className="rounded-lg border border-ink-600 bg-ink-850/50 px-3 py-2">
            📄 Reports, gaps, and scores are fully readable — no sound needed
          </li>
        </ul>
      </section>

      {/* ---------- concept picker ---------- */}
      <section id="start" className="mt-20 scroll-mt-8">
        <h2 className="font-display text-3xl text-chalk">What will you teach?</h2>
        <p className="mt-2 text-sm text-chalk-dim">
          Pick a prepared concept, or type any topic at all — a concept map is built
          for it on the spot.
        </p>
        <TopicLauncher concepts={concepts} />
      </section>

      <footer className="mt-24 border-t border-ink-700 pt-6 text-xs text-chalk-faint">
        {BRAND.name} — {BRAND.tagline}. Scores are produced by an on-device ML
        pipeline (MiniLM embeddings + a DeBERTa NLI cross-encoder + a trained
        classifier), independently of the conversational AI.
      </footer>
    </main>
  );
}
