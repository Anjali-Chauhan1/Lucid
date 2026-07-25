/**
 * Client-safe taxonomy lookup (label/description per category).
 *
 * Deliberately has NO fs/node imports — components/ReportView.tsx and
 * app/progress/page.tsx (client components) import this directly. The
 * trained classifier itself (classifyMisconception, which does use fs) lives
 * in misconceptionCategory.ts and is server-only, same split as
 * embeddings.ts/classifier.ts vs the types they classify into.
 */
import type { MisconceptionCategory } from "@/lib/types";
import taxonomy from "./misconception-taxonomy.json";

export interface MisconceptionCategoryInfo {
  id: MisconceptionCategory;
  label: string;
  description: string;
}

export const MISCONCEPTION_TAXONOMY = taxonomy as MisconceptionCategoryInfo[];

const TAXONOMY_BY_ID = new Map(MISCONCEPTION_TAXONOMY.map((c) => [c.id, c]));

export function categoryInfo(id: MisconceptionCategory): MisconceptionCategoryInfo {
  return TAXONOMY_BY_ID.get(id) ?? { id, label: id, description: "" };
}
