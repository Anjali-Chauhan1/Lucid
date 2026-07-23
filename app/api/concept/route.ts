import { NextResponse } from "next/server";
import { z } from "zod";
import { conceptSummaries } from "@/lib/concepts";
import { getOrCreateConcept } from "@/lib/concepts/generate";
import { describeLlmError } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

const ConceptSchema = z.object({
  topic: z.string().min(2).max(120),
});

/** GET — list the curated starter concepts for the landing page. */
export async function GET() {
  return NextResponse.json({ concepts: conceptSummaries() });
}

/**
 * POST — resolve ANY topic to a concept map, generating one if needed.
 * This is what makes Lucid open-domain rather than limited to 6 topics.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ConceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    console.time("[concept] resolve");
    const { map, source } = await getOrCreateConcept(parsed.data.topic);
    console.timeEnd("[concept] resolve");
    return NextResponse.json({ concept: map, source });
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith("concept_generation_invalid")) {
      return NextResponse.json(
        {
          error: message,
          message:
            "Could not build a reliable concept map for that topic. Try phrasing it as a single specific concept, e.g. \"Ohm's Law\" rather than \"physics\".",
        },
        { status: 422 },
      );
    }
    const described = describeLlmError(err);
    console.error("[concept] failed:", described.message);
    return NextResponse.json(
      { error: "concept_failed", message: described.message },
      { status: described.status },
    );
  }
}
