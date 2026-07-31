"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type {
  AnalysisReport,
  ChatTurn,
  ConceptMap,
  SessionMode,
  WhyAnswer,
} from "@/lib/types";
import { BRAND } from "@/lib/brand";
import UnderstandingPanel from "./UnderstandingPanel";
import ParrotBanner from "./ParrotBanner";
import { appendHistory, newSessionId, saveReport } from "@/lib/store";
import { useSpeechInput } from "@/lib/useSpeechInput";

type Phase =
  | "explaining"
  | "analyzing"
  | "chatting"
  | "lesson"
  | "reexplaining"
  | "depth"
  | "finishing";

const MAX_CHAT_TURNS = 3;
const DEPTH_QUESTIONS = 2;

export default function SessionExperience({
  concept,
  mode,
  assignment,
}: {
  concept: ConceptMap;
  mode: SessionMode;
  /** present when this session was launched via a teacher's join code */
  assignment?: { code: string; studentName: string };
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("explaining");
  const [warm, setWarm] = useState(false);
  const [draft, setDraft] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [priorReport, setPriorReport] = useState<AnalysisReport | null>(null);
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  const [personaThinking, setPersonaThinking] = useState(false);
  const [microLesson, setMicroLesson] = useState<string | null>(null);

  const [explanation, setExplanation] = useState("");
  const [whyAnswers, setWhyAnswers] = useState<WhyAnswer[]>([]);
  const [depthIndex, setDepthIndex] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(newSessionId());

  // Warm the models up front so the first real analysis is fast.
  useEffect(() => {
    fetch("/api/analyze")
      .then((r) => setWarm(r.ok))
      .catch(() => setWarm(false));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, personaThinking]);

  const whyQuestions = concept.whyQuestions.slice(0, DEPTH_QUESTIONS);

  // ---------------------------------------------------------------- analysis

  const analyze = useCallback(
    async (text: string, answers?: WhyAnswer[]): Promise<AnalysisReport | null> => {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conceptId: concept.id,
          explanation: text,
          whyAnswers: answers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Analysis failed.");
        return null;
      }
      return data as AnalysisReport;
    },
    [concept.id],
  );

  /** Ask the persona for its next line. Never blocks the engine on failure. */
  const askPersona = useCallback(
    async (rep: AnalysisReport, history: ChatTurn[]) => {
      setPersonaThinking(true);
      try {
        const res = await fetch("/api/persona", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode,
            conceptId: concept.id,
            gaps: rep.gaps.map((g) => ({ nodeId: g.nodeId, nodeText: g.nodeText })),
            wrongStatements: rep.wrongStatements.map((w) => ({
              said: w.said,
              contradicts: w.contradicts,
            })),
            rattaFlag: rep.ratta.flag,
            conversationHistory: history,
          }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setNotice(
            data.message ??
              "The AI persona is unavailable, but your score is unaffected — it is computed by the engine.",
          );
          return false;
        }

        // Stream the reply into a bubble that grows as text arrives, so the
        // student sees words immediately rather than a spinner.
        setPersonaThinking(false);
        setTranscript((t) => [...t, { role: "persona", content: "" }]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setTranscript((t) => {
            const next = [...t];
            next[next.length - 1] = { role: "persona", content: acc };
            return next;
          });
        }
        return true;
      } catch {
        setNotice("Could not reach the AI persona. Your score is unaffected.");
        return false;
      } finally {
        setPersonaThinking(false);
      }
    },
    [concept.id, mode],
  );

  // ------------------------------------------------------------ submit steps

  async function submitExplanation() {
    const text = draft.trim();
    if (text.length < 15) {
      setError("Write a bit more — at least a sentence or two.");
      return;
    }
    if (confidence === null) {
      setError("Rate your confidence first — that's what makes the gap meaningful.");
      return;
    }
    setError(null);
    setNotice(null);
    setExplanation(text);
    setTranscript([{ role: "student", content: text }]);
    setDraft("");
    setPhase("analyzing");

    const rep = await analyze(text);
    if (!rep) {
      setPhase("explaining");
      return;
    }
    setReport(rep);

    if (mode === "loop") {
      setPriorReport(rep);
      await fetchMicroLesson(rep);
      return;
    }

    setPhase("chatting");
    await askPersona(rep, [{ role: "student", content: text }]);
  }

  async function fetchMicroLesson(rep: AnalysisReport) {
    setPhase("lesson");
    try {
      const res = await fetch("/api/microlesson", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          conceptId: concept.id,
          gaps: rep.gaps.map((g) => ({ nodeId: g.nodeId, nodeText: g.nodeText })),
          wrongStatements: rep.wrongStatements.map((w) => ({
            said: w.said,
            contradicts: w.contradicts,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice(
          data.message ?? "Micro-lesson unavailable — you can still re-explain below.",
        );
      } else {
        setMicroLesson(data.lesson);
      }
    } catch {
      setNotice("Micro-lesson unavailable — you can still re-explain below.");
    }
  }

  async function submitChatAnswer() {
    const text = draft.trim();
    if (!text) return;
    const next: ChatTurn[] = [...transcript, { role: "student", content: text }];
    setTranscript(next);
    setDraft("");

    const studentTurns = next.filter((t) => t.role === "student").length;
    if (studentTurns > MAX_CHAT_TURNS || !report) {
      startDepth();
      return;
    }
    await askPersona(report, next);
  }

  async function submitReexplanation() {
    const text = draft.trim();
    if (text.length < 15) {
      setError("Give it a proper go — a sentence or two at least.");
      return;
    }
    setError(null);
    setExplanation(text);
    setTranscript((t) => [...t, { role: "student", content: text }]);
    setDraft("");
    setPhase("analyzing");

    const rep = await analyze(text);
    if (!rep) {
      setPhase("reexplaining");
      return;
    }
    setReport(rep);
    startDepth();
  }

  function startDepth() {
    setDepthIndex(0);
    setWhyAnswers([]);
    setPhase("depth");
  }

  async function submitDepthAnswer() {
    const text = draft.trim();
    if (!text) return;
    const answers = [...whyAnswers, { index: depthIndex, answer: text }];
    setWhyAnswers(answers);
    setTranscript((t) => [
      ...t,
      { role: "persona", content: whyQuestions[depthIndex].q },
      { role: "student", content: text },
    ]);
    setDraft("");

    if (depthIndex + 1 < whyQuestions.length) {
      setDepthIndex(depthIndex + 1);
      return;
    }
    await finish(answers);
  }

  async function finish(answers: WhyAnswer[]) {
    setPhase("finishing");
    const finalReport = await analyze(explanation, answers);
    if (!finalReport) {
      setPhase("depth");
      return;
    }

    const sessionId = sessionIdRef.current;
    saveReport({
      sessionId,
      conceptId: concept.id,
      concept: concept.concept,
      mode,
      report: finalReport,
      priorScore: priorReport?.samajhScore,
      priorReport: priorReport ?? undefined,
      transcript,
      microLesson: microLesson ?? undefined,
      createdAt: Date.now(),
      confidenceRating: confidence ?? undefined,
    });
    const misconceptionCategories = [
      ...new Set(
        finalReport.wrongStatements
          .map((w) => w.misconceptionCategory)
          .filter((c): c is NonNullable<typeof c> => Boolean(c)),
      ),
    ];
    appendHistory({
      sessionId,
      conceptId: concept.id,
      concept: concept.concept,
      mode,
      samajhScore: finalReport.samajhScore,
      dimensions: finalReport.dimensions,
      timestamp: Date.now(),
      priorScore: priorReport?.samajhScore,
      misconceptionCategories: misconceptionCategories.length ? misconceptionCategories : undefined,
      confidenceRating: confidence ?? undefined,
    });

    if (assignment) {
      // Best-effort: a failed submit shouldn't block the student from seeing
      // their own report, which already saved locally above.
      fetch(`/api/assignment/${assignment.code}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentName: assignment.studentName,
          samajhScore: finalReport.samajhScore,
          dimensions: finalReport.dimensions,
          misconceptionCategories: misconceptionCategories.length ? misconceptionCategories : undefined,
          gaps: finalReport.gaps.length ? finalReport.gaps : undefined,
          confidenceRating: confidence ?? undefined,
        }),
      }).catch(() => {
        /* the student's own report is unaffected either way */
      });
    }

    router.push(`/report/${sessionId}`);
  }

  // ------------------------------------------------------------------- input

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, action: () => void) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      action();
    }
  }

  const busy = phase === "analyzing" || phase === "finishing";

  return (
    <main className="theme-paper paper-field min-h-screen w-full">
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-graphite-faint hover:text-gold-ink">
            ← {BRAND.name}
          </Link>
          <h1 className="mt-1 font-display text-3xl text-graphite">{concept.concept}</h1>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite-faint">
            {concept.subject} · {mode} mode
          </p>
          {assignment && (
            <p className="mt-1 text-[11px] text-cobalt-ink">
              Assignment {assignment.code} · submitting as {assignment.studentName}
            </p>
          )}
        </div>
        {!warm && (
          <span className="rounded-full border border-rule px-3 py-1.5 text-xs text-gold-ink">
            Warming up the brain…
          </span>
        )}
      </header>

      <div className="mt-6">
        <ParrotBanner ratta={report?.ratta ?? null} />
      </div>

      {notice && (
        <p className="mt-4 rounded-xl border border-cobalt/40 bg-cobalt/[0.08] p-3 text-sm text-graphite-muted">
          {notice}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        {/* ---------------- left: conversation ---------------- */}
        <section className="rounded-2xl border border-rule bg-paper-card p-5">
          <div className="max-h-[46vh] space-y-4 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {transcript.map((turn, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${turn.role === "student" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      turn.role === "student"
                        ? "bg-gold/15 text-graphite"
                        : "border border-rule bg-paper-deep text-graphite-muted"
                    }`}
                  >
                    {turn.content}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {personaThinking && (
              <div className="flex justify-start">
                <div className="flex gap-1.5 rounded-2xl border border-rule bg-paper-deep px-4 py-3">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-graphite-faint"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.18 }}
                    />
                  ))}
                </div>
              </div>
            )}

            {phase === "lesson" && microLesson && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-cobalt/40 bg-cobalt/[0.08] p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-cobalt-ink">
                  Targeted micro-lesson
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-graphite">
                  {microLesson}
                </p>
              </motion.div>
            )}

            {phase === "depth" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-cobalt/40 bg-cobalt/[0.08] p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-cobalt-ink">
                  Depth check {depthIndex + 1}/{whyQuestions.length}
                </p>
                <p className="mt-2 text-sm text-graphite">{whyQuestions[depthIndex]?.q}</p>
              </motion.div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* ---------------- composer ---------------- */}
          <div className="mt-4 border-t border-rule pt-4">
            {phase === "explaining" && (
              <ConfidenceSelector value={confidence} onChange={setConfidence} disabled={busy} />
            )}
            {phase === "explaining" && (
              <Composer
                value={draft}
                onChange={setDraft}
                onSubmit={submitExplanation}
                onKeyDown={onKeyDown}
                busy={busy}
                label={`Explain ${concept.concept} in your own words`}
                cta="Teach it →"
                placeholder="Pretend I know nothing. Explain it to me…"
                rows={7}
              />
            )}
            {phase === "chatting" && (
              <Composer
                value={draft}
                onChange={setDraft}
                onSubmit={submitChatAnswer}
                onKeyDown={onKeyDown}
                busy={personaThinking}
                label="Answer them"
                cta="Reply"
                placeholder="Answer the question…"
                rows={3}
                secondary={{ label: "I'm done — score me", onClick: startDepth }}
              />
            )}
            {phase === "lesson" && (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-graphite-muted">
                  Read the micro-lesson, then explain it back — this is where the
                  before→after jump comes from.
                </p>
                <button
                  onClick={() => setPhase("reexplaining")}
                  className="self-start rounded-xl bg-graphite px-5 py-2.5 text-sm font-semibold text-paper hover:bg-black"
                >
                  Explain it back →
                </button>
              </div>
            )}
            {phase === "reexplaining" && (
              <Composer
                value={draft}
                onChange={setDraft}
                onSubmit={submitReexplanation}
                onKeyDown={onKeyDown}
                busy={busy}
                label="Now explain it again, in your own words"
                cta="Re-score me →"
                placeholder="This time, include what you just learned…"
                rows={7}
              />
            )}
            {phase === "depth" && (
              <Composer
                value={draft}
                onChange={setDraft}
                onSubmit={submitDepthAnswer}
                onKeyDown={onKeyDown}
                busy={busy}
                label="Why?"
                cta={depthIndex + 1 < whyQuestions.length ? "Next →" : "Finish & score →"}
                placeholder="Because…"
                rows={3}
              />
            )}
            {(phase === "analyzing" || phase === "finishing") && (
              <p className="py-4 text-center text-sm text-gold-ink">
                {phase === "finishing"
                  ? "Scoring your understanding…"
                  : "Measuring your explanation…"}
              </p>
            )}
            {error && <p className="mt-2 text-sm text-rose-paper-ink">{error}</p>}
          </div>
        </section>

        {/* ---------------- right: live understanding ---------------- */}
        <aside className="space-y-4">
          <UnderstandingPanel
            concept={concept}
            report={report}
            analyzing={phase === "analyzing"}
          />
          {report && (
            <div className="rounded-2xl border border-rule bg-paper-card p-5">
              <p className="text-[11px] uppercase tracking-[0.16em] text-graphite-faint">
                Live {BRAND.score.name}
              </p>
              <p className="mt-1 font-display text-4xl tabular-nums text-gold-ink">
                {report.samajhScore}
                <span className="text-lg text-graphite-faint">/100</span>
              </p>
              <p className="mt-2 text-xs text-graphite-faint">
                Engine label:{" "}
                <b className="text-graphite-muted">{report.classifierLabel}</b>
                {report.usedTrainedModel ? " (trained model)" : " (heuristic)"}
              </p>
            </div>
          )}
        </aside>
      </div>
      </div>
    </main>
  );
}

/* -------------------------------------------------------- confidence rating */

/**
 * Captured BEFORE the explanation is scored, so it reflects genuine
 * self-assessment rather than a reaction to feedback already seen — that's
 * what makes the gap against the actual Grasp Score meaningful (see
 * lib/calibration.ts).
 */
function ConfidenceSelector({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="mb-4">
      <label className="text-xs uppercase tracking-[0.16em] text-graphite-faint">
        Before you explain — how confident are you in this topic?
      </label>
      <div className="mt-2 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={`h-9 w-9 rounded-full border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              value === n
                ? "border-cobalt bg-cobalt/20 text-cobalt-ink"
                : "border-rule text-graphite-faint hover:border-rule-strong hover:text-graphite"
            }`}
          >
            {n}
          </button>
        ))}
        <span className="ml-2 text-[11px] text-graphite-faint">
          1 = not sure at all · 5 = very confident
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ composer */

function Composer({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  busy,
  label,
  cta,
  placeholder,
  rows,
  secondary,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, a: () => void) => void;
  busy: boolean;
  label: string;
  cta: string;
  placeholder: string;
  rows: number;
  secondary?: { label: string; onClick: () => void };
}) {
  // Appending spoken chunks needs the *current* draft, so go through the
  // functional form rather than closing over a stale `value`.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const speech = useSpeechInput((chunk) => {
    const current = valueRef.current;
    const joined = current.trim() ? `${current.trim()} ${chunk}` : chunk;
    onChange(joined);
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs uppercase tracking-[0.16em] text-graphite-faint">
          {label}
        </label>
        {speech.supported && (
          <button
            type="button"
            onClick={speech.listening ? speech.stop : speech.start}
            disabled={busy}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? "Stop dictating" : "Explain out loud"}
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-40 ${
              speech.listening
                ? "border-rose-paper bg-rose-paper/15 text-rose-paper-ink"
                : "border-rule text-graphite-faint hover:border-gold hover:text-gold-ink"
            }`}
          >
            {speech.listening ? (
              <motion.span
                aria-hidden
                className="block h-2 w-2 rounded-full bg-rose-paper"
                animate={{ opacity: [1, 0.25, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            ) : (
              <span aria-hidden>🎙</span>
            )}
            {speech.listening ? "Listening — tap to stop" : "Explain out loud"}
          </button>
        )}
      </div>

      <div className="relative">
        <textarea
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => onKeyDown(e, onSubmit)}
          placeholder={placeholder}
          disabled={busy}
          className="mt-2 w-full resize-none rounded-xl border border-rule bg-paper-card px-4 py-3 text-sm leading-relaxed text-graphite placeholder:text-graphite-faint focus:border-gold focus:outline-none disabled:opacity-50"
        />
        {speech.interim && (
          <p className="pointer-events-none absolute inset-x-4 bottom-3 truncate text-sm italic text-graphite-faint">
            {speech.interim}
          </p>
        )}
      </div>

      {speech.error && <p className="mt-1 text-xs text-rose-paper-ink">{speech.error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={onSubmit}
          disabled={busy || !value.trim()}
          className="rounded-xl bg-graphite px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {cta}
        </button>
        {secondary && (
          <button
            onClick={secondary.onClick}
            className="text-sm text-graphite-faint underline-offset-4 hover:text-graphite hover:underline"
          >
            {secondary.label}
          </button>
        )}
        <span className="ml-auto text-[11px] text-graphite-faint">⌘/Ctrl + Enter</span>
      </div>
    </div>
  );
}
