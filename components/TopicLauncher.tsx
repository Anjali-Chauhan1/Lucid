"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import type { SessionMode } from "@/lib/types";

interface ConceptSummary {
  id: string;
  concept: string;
  subject: string;
  nodeCount: number;
}

const MODES: { id: SessionMode; label: string; blurb: string }[] = [
  { id: "explain", label: "Explain", blurb: "A confused classmate asks about your gaps" },
  { id: "viva", label: "Viva", blurb: "An examiner cross-questions you" },
  { id: "loop", label: "Loop", blurb: "Find gaps → micro-lesson → re-explain" },
];

export default function TopicLauncher({ concepts }: { concepts: ConceptSummary[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<SessionMode>("explain");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function go(conceptId: string) {
    router.push(`/session/${conceptId}?mode=${mode}`);
  }

  async function launchCustom(e: React.FormEvent) {
    e.preventDefault();
    const t = topic.trim();
    if (t.length < 2 || busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/concept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: t }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Could not build a concept map for that topic.");
        return;
      }
      go(data.concept.id);
    } catch {
      setError("Network error — is the dev server still running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      {/* mode selector */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Session mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              mode === m.id
                ? "border-amber bg-amber/15 text-amber-bright"
                : "border-ink-600 text-chalk-dim hover:border-ink-500 hover:text-chalk"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-chalk-faint">
        {MODES.find((m) => m.id === mode)?.blurb}
      </p>

      {/* any-topic input */}
      <form onSubmit={launchCustom} className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Type any topic — “Ohm's Law”, “Supply and Demand”, “Recursion”…"
          className="flex-1 rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-sm text-chalk placeholder:text-chalk-faint focus:border-amber focus:outline-none"
          aria-label="Custom topic"
        />
        <button
          type="submit"
          disabled={busy || topic.trim().length < 2}
          className="rounded-xl bg-amber px-6 py-3 text-sm font-semibold text-ink-900 transition hover:bg-amber-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Building map…" : "Teach this"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-rose">{error}</p>}

      {/* curated concepts */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {concepts.map((c, i) => (
          <motion.button
            key={c.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            whileHover={{ y: -4 }}
            onClick={() => go(c.id)}
            className="group rounded-2xl border border-ink-600 bg-ink-800/50 p-5 text-left transition hover:border-amber/60"
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-chalk-faint">
              {c.subject}
            </p>
            <h3 className="mt-1.5 font-display text-xl text-chalk group-hover:text-amber-bright">
              {c.concept}
            </h3>
            <p className="mt-2 text-xs text-chalk-faint">{c.nodeCount} key ideas to cover</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
