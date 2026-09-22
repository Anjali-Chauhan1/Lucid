import fs from "node:fs";
import path from "node:path";
import type { ConceptMap } from "@/lib/types";
import { complete } from "@/lib/llm";
import { query } from "@/lib/db";
import { ConceptMapSchema, normalizeWeights, slugify } from "./schema";
import { getConcept } from "./index";

/**
 * Auto-generate a concept map for ANY topic.
 *
 * This is what lifts Lucid from "6 hardcoded concepts" to open-domain: the
 * scoring engine is topic-agnostic (it scores coverage/contradiction features,
 * not topic text), so the only thing standing between it and an arbitrary
 * subject is a concept map. We generate one, validate it, and cache it.
 *
 * Generated maps are persisted in Postgres (same database as assignments)
 * so the same topic is only ever paid for once. They used to live only in
 * an on-disk cache, but a serverless function's disk is ephemeral and not
 * shared between invocations: a teacher could create an assignment for a
 * custom topic, the assignment row would land in the DB, and the student's
 * /session/<id> render on another instance would find no map and 404. The
 * disk cache is kept as a local-dev fallback (fast, works offline).
 */

const CACHE_DIR = path.join(process.cwd(), ".cache", "concepts");

const SYSTEM = `You build concept maps used by an automated understanding-scorer. Your output is consumed by a program, so it must be valid JSON and nothing else.

Given a topic, produce a concept map with this exact shape:

{
  "id": "<snake_case_id>",
  "concept": "<Display Name>",
  "subject": "<e.g. Biology, Physics, Chemistry, Computer Science, Economics, History>",
  "nodes": [{"id": "<snake_case>", "text": "<one core idea, as a short declarative clause>", "weight": <0..1>}],
  "textbookPhrasings": ["<formal textbook-style sentence>", ...],
  "referenceFacts": ["<short declarative fact>", ...],
  "whyQuestions": [{"q": "<causal why-question>", "expectedIdea": "<what a good answer says>"}],
  "misconceptions": ["<a specific FALSE belief learners commonly hold>", ...]
}

Hard requirements:
- "nodes": 5 to 8 entries. Each is ONE atomic idea a complete explanation must contain, written as a short clause in plain language (NOT a question, NOT a definition of the whole topic). Node "weight" reflects importance and all weights MUST sum to exactly 1.0.
- "textbookPhrasings": 2 to 4 formal, textbook-sounding sentences. These are used to detect memorized recitation, so they must sound like an actual textbook.
- "referenceFacts": 5 to 8 SHORT declarative sentences, each independently checkable. These are used as entailment premises, so each must be self-contained and unambiguous.
- "whyQuestions": 3 causal questions that probe understanding rather than recall.
- "misconceptions": 3 to 4 statements that are actually FALSE but commonly believed. They must be plainly wrong, not merely incomplete.
- Write for a motivated learner (roughly ages 14-18). Use plain international English.

Return ONLY the JSON object. No markdown fence, no commentary.`;

function cachePath(id: string): string {
  return path.join(CACHE_DIR, `${id}.json`);
}

function readCache(id: string): ConceptMap | null {
  try {
    const p = cachePath(id);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8")) as ConceptMap;
  } catch {
    return null;
  }
}

function writeCache(map: ConceptMap): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath(map.id), JSON.stringify(map, null, 2), "utf8");
  } catch (err) {
    // A read-only filesystem must not break generation.
    console.warn("[concepts] could not cache map:", (err as Error).message);
  }
}

async function readDb(id: string): Promise<ConceptMap | null> {
  try {
    const rows = await query<{ map: ConceptMap }>(
      "SELECT map FROM concept_maps WHERE id = $1",
      [id],
    );
    return rows[0]?.map ?? null;
  } catch (err) {
    console.warn("[concepts] db read failed:", (err as Error).message);
    return null;
  }
}

async function writeDb(map: ConceptMap): Promise<void> {
  try {
    await query(
      `INSERT INTO concept_maps (id, map, created_at) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET map = EXCLUDED.map`,
      [map.id, JSON.stringify(map), Date.now()],
    );
  } catch (err) {
    console.warn("[concepts] db write failed:", (err as Error).message);
  }
}

function stripFence(raw: string): string {
  return raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

export interface GeneratedConcept {
  map: ConceptMap;
  source: "curated" | "cache" | "generated";
}

/**
 * Look up a concept WITHOUT calling the LLM: curated maps first, then the
 * local disk cache, then the database. Used by /api/analyze, which must
 * never trigger generation as a side effect of scoring.
 */
export async function resolveConcept(id: string): Promise<ConceptMap | null> {
  const local = getConcept(id) ?? readCache(id);
  if (local) return local;
  const fromDb = await readDb(id);
  // Warm the local cache so subsequent lookups on this instance skip the DB.
  if (fromDb) writeCache(fromDb);
  return fromDb;
}

export async function getOrCreateConcept(topic: string): Promise<GeneratedConcept> {
  const id = slugify(topic);
  if (!id) throw new Error("empty_topic");

  // 1. Hand-authored maps win — they are the highest quality.
  const curated = getConcept(id);
  if (curated) return { map: curated, source: "curated" };

  // 2. Previously generated (on this instance, or anywhere else)?
  const cached = readCache(id) ?? (await readDb(id));
  if (cached) return { map: cached, source: "cache" };

  // 3. Generate.
  // A full concept map (5-8 nodes + phrasings + facts + why-questions +
  // misconceptions) is a big JSON object. A 2000-token budget truncated it
  // mid-object, which surfaced as an opaque parse error.
  const raw = await complete(
    SYSTEM,
    [{ role: "user", content: `Topic: ${topic}` }],
    6000,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    // Log both ends: a truncated response is obvious from the tail.
    console.error(
      `[concepts] JSON parse failed for "${topic}" (${raw.length} chars)\n` +
        `  head: ${raw.slice(0, 200)}\n` +
        `  tail: ${raw.slice(-200)}`,
    );
    throw new Error("concept_generation_invalid_json");
  }

  // Force our id so lookups are stable regardless of what the model chose.
  const withId = { ...(parsed as Record<string, unknown>), id };
  const result = ConceptMapSchema.safeParse(withId);
  if (!result.success) {
    console.error("[concepts] schema validation failed:", result.error.flatten());
    throw new Error("concept_generation_invalid_shape");
  }

  const map = normalizeWeights(result.data as ConceptMap);
  writeCache(map);
  await writeDb(map);
  return { map, source: "generated" };
}
