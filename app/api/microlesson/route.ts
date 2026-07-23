import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveConcept } from "@/lib/concepts/generate";
import { buildMicroLessonPrompt } from "@/lib/personas/microTeacher";
import { complete, describeLlmError } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const MicrolessonSchema = z.object({
  conceptId: z.string().min(1),
  gaps: z
    .array(z.object({ nodeId: z.string(), nodeText: z.string() }))
    .default([]),
  wrongStatements: z
    .array(z.object({ said: z.string(), contradicts: z.string() }))
    .default([]),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = MicrolessonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const concept = resolveConcept(parsed.data.conceptId);
  if (!concept) {
    return NextResponse.json({ error: "unknown_concept" }, { status: 404 });
  }

  const system = buildMicroLessonPrompt(
    concept,
    parsed.data.gaps,
    parsed.data.wrongStatements,
  );

  try {
    const lesson = await complete(
      system,
      [{ role: "user", content: "Write the micro-lesson." }],
      600,
    );
    return NextResponse.json({ lesson });
  } catch (err) {
    const { status, message } = describeLlmError(err);
    console.error("[microlesson] failed:", message);
    return NextResponse.json({ error: "microlesson_failed", message }, { status });
  }
}
