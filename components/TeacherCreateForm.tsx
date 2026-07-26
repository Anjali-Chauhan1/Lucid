"use client";

import { useState } from "react";
import Link from "next/link";
import type { Assignment, SessionMode } from "@/lib/types";

interface ConceptSummary {
  id: string;
  concept: string;
  subject: string;
  nodeCount: number;
}

const MODES: { id: SessionMode; label: string }[] = [
  { id: "explain", label: "Explain" },
  { id: "viva", label: "Viva" },
  { id: "loop", label: "Loop" },
];

export default function TeacherCreateForm({ concepts }: { concepts: ConceptSummary[] }) {
  // No default selection — a silently-selected first concept is exactly
  // what caused a teacher who typed a custom topic into the wrong field to
  // get "Photosynthesis" without realizing it. Force an explicit choice.
  const [conceptId, setConceptId] = useState<string | null>(null);
  const [customTopic, setCustomTopic] = useState("");
  const [mode, setMode] = useState<SessionMode>("viva");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Assignment | null>(null);

  const hasCustomTopic = customTopic.trim().length >= 2;
  const canCreate = hasCustomTopic || Boolean(conceptId);

  async function create() {
    if (!canCreate || busy) return;
    setBusy(true);
    setError(null);
    try {
      // A typed topic wins over a curated pick — resolve/generate its
      // concept map first (same endpoint the student "type any topic" flow
      // uses), then create the assignment against the resulting id.
      let resolvedConceptId = conceptId;
      if (hasCustomTopic) {
        const conceptRes = await fetch("/api/concept", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ topic: customTopic.trim() }),
        });
        const conceptData = await conceptRes.json();
        if (!conceptRes.ok) {
          setError(conceptData.message ?? "Could not build a concept map for that topic.");
          return;
        }
        resolvedConceptId = conceptData.concept.id;
      }

      const res = await fetch("/api/assignment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conceptId: resolvedConceptId,
          mode,
          teacherLabel: label.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Could not create the assignment.");
        return;
      }
      setCreated(data.assignment);
    } catch {
      setError("Network error — is the dev server still running?");
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join/${created.code}` : "";
    return (
      <div className="mt-8 rounded-2xl border border-violet/40 bg-violet/[0.07] p-6">
        <p className="text-[11px] uppercase tracking-wider text-violet">Assignment created</p>
        <p className="mt-2 font-display text-5xl tracking-[0.08em] text-chalk">{created.code}</p>
        <p className="mt-2 text-sm text-chalk-dim">
          {created.concept} · {created.mode} mode
          {created.teacherLabel ? ` · ${created.teacherLabel}` : ""}
        </p>
        <p className="mt-4 text-xs text-chalk-faint">Share this join link with students:</p>
        <p className="mt-1 break-all rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-chalk">
          {joinUrl}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/teacher/${created.code}`}
            className="rounded-full bg-violet px-6 py-3 text-sm font-semibold text-ink-900 hover:opacity-90"
          >
            Open results dashboard →
          </Link>
          <button
            onClick={() => setCreated(null)}
            className="rounded-full border border-ink-600 px-6 py-3 text-sm text-chalk-dim hover:border-ink-500 hover:text-chalk"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-[11px] uppercase tracking-wider text-chalk-faint">Mode</p>
      <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Session mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              mode === m.id
                ? "border-violet bg-violet/15 text-violet"
                : "border-ink-600 text-chalk-dim hover:border-ink-500 hover:text-chalk"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="mt-6 text-[11px] uppercase tracking-wider text-chalk-faint">
        Topic — type any topic, or pick one below
      </p>
      <input
        value={customTopic}
        onChange={(e) => {
          setCustomTopic(e.target.value);
          if (e.target.value.trim()) setConceptId(null);
        }}
        placeholder="Type any topic — “Animal Kingdom”, “Ohm's Law”, “Supply and Demand”…"
        className="mt-2 w-full rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-sm text-chalk placeholder:text-chalk-faint focus:border-violet focus:outline-none"
      />
      {hasCustomTopic && (
        <p className="mt-1.5 text-[11px] text-violet">
          Will build a fresh concept map for “{customTopic.trim()}” when you create the
          assignment.
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {concepts.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              setConceptId(c.id);
              setCustomTopic("");
            }}
            aria-pressed={conceptId === c.id}
            className={`rounded-xl border p-4 text-left transition ${
              conceptId === c.id
                ? "border-violet bg-violet/10"
                : "border-ink-600 bg-ink-800/50 hover:border-ink-500"
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-chalk-faint">
              {c.subject}
            </p>
            <p className="mt-1 font-display text-lg text-chalk">{c.concept}</p>
          </button>
        ))}
      </div>

      <p className="mt-6 text-[11px] uppercase tracking-wider text-chalk-faint">
        Label (optional — e.g. &quot;Period 3&quot;)
      </p>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Period 3 Biology"
        className="mt-2 w-full max-w-sm rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 text-sm text-chalk placeholder:text-chalk-faint focus:border-violet focus:outline-none"
      />

      <button
        onClick={create}
        disabled={busy || !canCreate}
        className="mt-6 rounded-full bg-violet px-6 py-3 text-sm font-semibold text-ink-900 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (hasCustomTopic ? "Building concept map…" : "Creating…") : "Create assignment →"}
      </button>
      {error && <p className="mt-2 text-sm text-rose">{error}</p>}
    </div>
  );
}
