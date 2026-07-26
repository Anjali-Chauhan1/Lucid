"use client";

import type { AnalysisReport, SessionHistoryEntry, SessionMode } from "@/lib/types";

/**
 * localStorage-backed persistence. No DB, no auth — score history and the
 * hand-off between the session screen and the report screen live here.
 */

const HISTORY_KEY = "lucid.history.v1";
const REPORT_PREFIX = "lucid.report.";

export interface StoredReport {
  sessionId: string;
  conceptId: string;
  concept: string;
  mode: SessionMode;
  report: AnalysisReport;
  /** Loop Mode: the score before the micro-lesson, for the delta reveal. */
  priorScore?: number;
  priorReport?: AnalysisReport;
  transcript: { role: "student" | "persona"; content: string }[];
  microLesson?: string;
  createdAt: number;
  /** self-rated confidence (1-5), captured BEFORE the explanation was scored */
  confidenceRating?: number;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function newSessionId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function saveReport(stored: StoredReport): void {
  try {
    localStorage.setItem(REPORT_PREFIX + stored.sessionId, JSON.stringify(stored));
  } catch (err) {
    console.warn("[store] could not save report:", err);
  }
}

export function loadReport(sessionId: string): StoredReport | null {
  if (typeof window === "undefined") return null;
  return safeParse<StoredReport>(localStorage.getItem(REPORT_PREFIX + sessionId));
}

export function loadHistory(): SessionHistoryEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse<SessionHistoryEntry[]>(localStorage.getItem(HISTORY_KEY)) ?? [];
}

export function appendHistory(entry: SessionHistoryEntry): void {
  try {
    const all = loadHistory();
    all.push(entry);
    // Keep the store bounded.
    localStorage.setItem(HISTORY_KEY, JSON.stringify(all.slice(-200)));
  } catch (err) {
    console.warn("[store] could not append history:", err);
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
