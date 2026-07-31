"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Assignment } from "@/lib/types";

export default function JoinForm({ assignment }: { assignment: Assignment }) {
  const router = useRouter();
  const [name, setName] = useState("");

  function start() {
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    const params = new URLSearchParams({
      mode: assignment.mode,
      assignmentCode: assignment.code,
      studentName: trimmed,
    });
    router.push(`/session/${assignment.conceptId}?${params.toString()}`);
  }

  return (
    <div className="mt-6">
      <label className="text-xs uppercase tracking-[0.16em] text-graphite-faint">
        Your name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && start()}
        placeholder="First name is fine"
        autoFocus
        className="mt-2 w-full rounded-xl border border-rule bg-paper-card px-4 py-3 text-sm text-graphite placeholder:text-graphite-faint focus:border-cobalt focus:outline-none"
      />
      <button
        onClick={start}
        disabled={name.trim().length < 1}
        className="mt-4 w-full rounded-xl bg-graphite px-6 py-3 text-sm font-semibold text-paper transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        Start →
      </button>
    </div>
  );
}
