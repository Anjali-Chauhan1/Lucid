import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveConcept } from "@/lib/concepts/generate";
import { buildConfusedStudentPrompt } from "@/lib/personas/confusedStudent";
import { buildExaminerPrompt } from "@/lib/personas/examiner";
import { complete, describeLlmError, type Turn } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const PersonaSchema = z.object({
  mode: z.enum(["explain", "viva", "loop"]),
  conceptId: z.string().min(1),
  gaps: z
    .array(z.object({ nodeId: z.string(), nodeText: z.string() }))
    .default([]),
  wrongStatements: z
    .array(z.object({ said: z.string(), contradicts: z.string() }))
    .default([]),
  rattaFlag: z.boolean().default(false),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["student", "persona"]),
        content: z.string(),
      }),
    )
    .default([]),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = PersonaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { mode, conceptId, gaps, wrongStatements, rattaFlag, conversationHistory } =
    parsed.data;

  const concept = resolveConcept(conceptId);
  if (!concept) {
    return NextResponse.json({ error: "unknown_concept" }, { status: 404 });
  }

  const ctx = { concept, gaps, wrongStatements, rattaFlag };
  // Loop Mode re-uses the confused-student persona for the re-explanation round.
  const system =
    mode === "viva" ? buildExaminerPrompt(ctx) : buildConfusedStudentPrompt(ctx);

  // The student speaks as "user", the persona as "assistant".
  const messages: Turn[] = conversationHistory.map((t) => ({
    role: t.role === "student" ? ("user" as const) : ("assistant" as const),
    content: t.content,
  }));

  // The API requires the conversation to start with a user turn.
  if (messages.length > 0 && messages[0].role === "assistant") {
    messages.unshift({ role: "user", content: "Here is my explanation." });
  }

  try {
    const reply = await complete(system, messages, 400);
    return NextResponse.json({ reply });
  } catch (err) {
    const { status, message } = describeLlmError(err);
    console.error("[persona] failed:", message);
    return NextResponse.json({ error: "persona_failed", message }, { status });
  }
}
