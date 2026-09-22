import { NextResponse } from "next/server";
import { z } from "zod";
import { addSubmission } from "@/lib/assignments";

export const runtime = "nodejs";

const MisconceptionCategorySchema = z.enum([
  "term_conflation",
  "overgeneralization",
  "input_output_reversal",
  "naive_causal_model",
  "definition_substitution",
]);

const SubmitSchema = z.object({
  studentName: z.string().min(1).max(60),
  samajhScore: z.number().min(0).max(100),
  dimensions: z.object({
    coverage: z.number(),
    correctness: z.number().nullable(),
    depth: z.number().nullable(),
  }),
  misconceptionCategories: z.array(MisconceptionCategorySchema).optional(),
  gaps: z
    .array(
      z.object({
        nodeId: z.string(),
        nodeText: z.string(),
        bestSimilarity: z.number(),
      }),
    )
    .optional(),
  confidenceRating: z.number().min(1).max(5).optional(),
});

/** POST — a student's finished session is recorded against the assignment. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = SubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ok = await addSubmission(code, {
    studentName: parsed.data.studentName,
    samajhScore: parsed.data.samajhScore,
    dimensions: parsed.data.dimensions,
    misconceptionCategories: parsed.data.misconceptionCategories,
    gaps: parsed.data.gaps,
    confidenceRating: parsed.data.confidenceRating,
  });

  if (!ok) {
    return NextResponse.json({ error: "unknown_assignment" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
