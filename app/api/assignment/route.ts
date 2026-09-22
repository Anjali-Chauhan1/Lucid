import { NextResponse } from "next/server";
import { z } from "zod";
import { createAssignment } from "@/lib/assignments";
import { resolveConcept } from "@/lib/concepts/generate";

export const runtime = "nodejs";

const CreateSchema = z.object({
  conceptId: z.string().min(1),
  mode: z.enum(["explain", "viva", "loop"]),
  teacherLabel: z.string().max(80).optional(),
});

/** POST — a teacher creates an assignment and gets back a join code. */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const concept = await resolveConcept(parsed.data.conceptId);
  if (!concept) {
    return NextResponse.json({ error: "unknown_concept" }, { status: 404 });
  }

  const assignment = await createAssignment(
    concept.id,
    concept.concept,
    parsed.data.mode,
    parsed.data.teacherLabel,
  );
  return NextResponse.json({ assignment });
}
