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
      <div className="mt-8 rounded-2xl border border-cobalt/40 bg-cobalt/[0.07] p-6">
        <p className="text-[11px] uppercase tracking-wider text-cobalt-ink">Assignment created</p>
        <p className="mt-2 font-display text-5xl tracking-[0.08em] text-graphite">{created.code}</p>
        <p className="mt-2 text-sm text-graphite-muted">
          {created.concept} · {created.mode} mode
          {created.teacherLabel ? ` · ${created.teacherLabel}` : ""}
        </p>
        <p className="mt-4 text-xs text-graphite-faint">Share this join link with students:</p>
        <p className="mt-1 break-all rounded-lg border border-rule bg-paper-deep px-3 py-2 text-sm text-graphite">
          {joinUrl}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/teacher/${created.code}`}
            className="rounded-full bg-graphite px-6 py-3 text-sm font-semibold text-paper hover:bg-black"
          >
            Open results dashboard →
          </Link>
          <button
            onClick={() => setCreated(null)}
            className="rounded-full border border-rule px-6 py-3 text-sm text-graphite-muted hover:border-rule-strong hover:text-graphite"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-[11px] uppercase tracking-wider text-graphite-faint">Mode</p>
      <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Session mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              mode === m.id
                ? "border-cobalt bg-cobalt/10 text-cobalt-ink"
                : "border-rule text-graphite-muted hover:border-rule-strong hover:text-graphite"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className="mt-6 text-[11px] uppercase tracking-wider text-graphite-faint">
        Topic — type any topic, or pick one below
      </p>
      <input
        value={customTopic}
        onChange={(e) => {
          setCustomTopic(e.target.value);
          if (e.target.value.trim()) setConceptId(null);
        }}
        placeholder="Type any topic — “Animal Kingdom”, “Ohm's Law”, “Supply and Demand”…"
        className="mt-2 w-full rounded-xl border border-rule bg-paper-card px-4 py-3 text-sm text-graphite placeholder:text-graphite-faint focus:border-cobalt focus:outline-none"
      />
      {hasCustomTopic && (
        <p className="mt-1.5 text-[11px] text-cobalt-ink">
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
                ? "border-cobalt bg-cobalt/10"
                : "border-rule bg-paper-card hover:border-rule-strong"
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.16em] text-graphite-faint">
              {c.subject}
            </p>
            <p className="mt-1 font-display text-lg text-graphite">{c.concept}</p>
          </button>
        ))}
      </div>

      <p className="mt-6 text-[11px] uppercase tracking-wider text-graphite-faint">
        Label (optional — e.g. &quot;Period 3&quot;)
      </p>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Period 3 Biology"
        className="mt-2 w-full max-w-sm rounded-xl border border-rule bg-paper-card px-4 py-3 text-sm text-graphite placeholder:text-graphite-faint focus:border-cobalt focus:outline-none"
      />

      <button
        onClick={create}
        disabled={busy || !canCreate}
        className="mt-6 rounded-full bg-graphite px-6 py-3 text-sm font-semibold text-paper transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (hasCustomTopic ? "Building concept map…" : "Creating…") : "Create assignment →"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-paper-ink">{error}</p>}
    </div>
  );
}
