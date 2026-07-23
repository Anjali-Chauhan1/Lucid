import type { ConceptMap } from "@/lib/types";
import photosynthesis from "./photosynthesis.json";
import respiration from "./respiration.json";
import newtons_laws from "./newtons_laws.json";
import atoms_molecules from "./atoms_molecules.json";
import reflection_light from "./reflection_light.json";
import cell_structure from "./cell_structure.json";

export const CONCEPTS: ConceptMap[] = [
  photosynthesis,
  respiration,
  newtons_laws,
  atoms_molecules,
  reflection_light,
  cell_structure,
] as ConceptMap[];

const BY_ID = new Map<string, ConceptMap>(CONCEPTS.map((c) => [c.id, c]));

export function getConcept(id: string): ConceptMap | undefined {
  return BY_ID.get(id);
}

export function conceptSummaries() {
  return CONCEPTS.map((c) => ({
    id: c.id,
    concept: c.concept,
    subject: c.subject,
    nodeCount: c.nodes.length,
  }));
}
