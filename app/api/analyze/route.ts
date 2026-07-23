import { NextResponse } from "next/server";
import { z } from "zod";
import { getConcept } from "@/lib/concepts";
import { runAnalysis } from "@/lib/ml/scoring";
import { warmup } from "@/lib/ml/embeddings";

// The ML models need the Node runtime (native/wasm), not the edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

const AnalyzeSchema = z.object({
  conceptId: z.string().min(1),
  explanation: z.string().min(1).max(6000),
  priorGaps: z.array(z.string()).optional(),
  whyAnswers: z
    .array(z.object({ index: z.number().int().min(0), answer: z.string() }))
    .optional(),
});

/** GET warms up both models so the first real analysis is fast. */
export async function GET() {
  const start = performance.now();
  try {
    await warmup();
    return NextResponse.json({
      ready: true,
      warmupMs: Math.round(performance.now() - start),
    });
  } catch (err) {
    console.error("[analyze:warmup]", err);
    return NextResponse.json(
      { ready: false, error: "warmup_failed" },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = AnalyzeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const concept = getConcept(parsed.data.conceptId);
  if (!concept) {
    return NextResponse.json({ error: "unknown_concept" }, { status: 404 });
  }

  try {
    console.time("[analyze] total");
    const report = await runAnalysis(
      concept,
      parsed.data.explanation,
      parsed.data.whyAnswers,
    );
    console.timeEnd("[analyze] total");
    return NextResponse.json(report);
  } catch (err) {
    console.error("[analyze] failed:", err);
    return NextResponse.json(
      { error: "analysis_failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}
