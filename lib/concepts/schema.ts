import { z } from "zod";
import type { ConceptMap } from "@/lib/types";

/**
 * Validation for concept maps — used for both the hand-authored JSONs and
 * anything generated at runtime for an arbitrary topic.
 */
export const ConceptNodeSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(8),
  weight: z.number().min(0).max(1),
});

export const ConceptMapSchema = z.object({
  id: z.string().min(1),
  concept: z.string().min(1),
  subject: z.string().min(1),
  nodes: z.array(ConceptNodeSchema).min(4).max(10),
  textbookPhrasings: z.array(z.string().min(20)).min(2).max(5),
  referenceFacts: z.array(z.string().min(8)).min(4).max(10),
  whyQuestions: z
    .array(z.object({ q: z.string().min(8), expectedIdea: z.string().min(8) }))
    .min(2)
    .max(5),
  misconceptions: z.array(z.string().min(8)).min(2).max(6),
});

/** Turn an arbitrary topic string into a stable, filesystem-safe id. */
export function slugify(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/**
 * Node weights must sum to 1.0 for the coverage score to be meaningful.
 * A generative model will not reliably hit that, so we renormalize instead of
 * rejecting an otherwise-good map.
 */
export function normalizeWeights(map: ConceptMap): ConceptMap {
  const total = map.nodes.reduce((s, n) => s + n.weight, 0);
  if (total <= 0) {
    const even = 1 / map.nodes.length;
    return { ...map, nodes: map.nodes.map((n) => ({ ...n, weight: even })) };
  }
  return {
    ...map,
    nodes: map.nodes.map((n) => ({ ...n, weight: n.weight / total })),
  };
}
