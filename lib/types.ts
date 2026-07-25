/**
 * Shared types across the ML engine, API routes, and UI.
 * Kept dependency-free so it can be imported anywhere.
 */

// ---------- Concept map schema ----------

export interface ConceptNode {
  id: string;
  text: string;
  /** relative importance; node weights within a concept sum to 1.0 */
  weight: number;
}

export interface WhyQuestion {
  q: string;
  expectedIdea: string;
}

export interface ConceptMap {
  id: string;
  concept: string;
  subject: string;
  nodes: ConceptNode[];
  textbookPhrasings: string[];
  referenceFacts: string[];
  whyQuestions: WhyQuestion[];
  misconceptions: string[];
}

// ---------- Misconception Fingerprint ----------

/**
 * The pattern-of-reasoning a matched misconception is an instance of,
 * independent of subject — see lib/ml/misconception-taxonomy.json for the
 * human-readable label/description of each.
 */
export type MisconceptionCategory =
  | "term_conflation"
  | "overgeneralization"
  | "input_output_reversal"
  | "naive_causal_model"
  | "definition_substitution";

// ---------- Analysis output ----------

export type ClassifierLabel = "good" | "partial" | "memorized" | "wrong";

export type SessionMode = "explain" | "viva" | "loop";

export interface Gap {
  nodeId: string;
  nodeText: string;
  /** best cosine similarity found for this node (0..1) */
  bestSimilarity: number;
}

export interface CoveredNode {
  nodeId: string;
  nodeText: string;
  similarity: number;
}

export interface WrongStatement {
  said: string;
  contradicts: string;
  score: number;
  /** set only when this statement matched a known misconception (not a plain fact contradiction) */
  misconceptionCategory?: MisconceptionCategory;
}

export interface RattaSignal {
  /** true when the explanation reads like textbook recitation */
  flag: boolean;
  /** max semantic similarity to any stored textbook phrasing (0..1) */
  similarity: number;
  /** max n-gram (trigram) overlap with textbook phrasings (0..1) */
  ngramOverlap: number;
}

export interface ScoreDimensions {
  coverage: number; // 0..1
  /** 0..1, null when the NLI stage degraded (omitted, NOT treated as perfect) */
  correctness: number | null;
  depth: number | null; // 0..1, null until why-questions answered
}

export interface AnalysisReport {
  conceptId: string;
  samajhScore: number; // 0..100  (a.k.a. Grasp Score)
  dimensions: ScoreDimensions;
  gaps: Gap[];
  coveredNodes: CoveredNode[];
  wrongStatements: WrongStatement[];
  ratta: RattaSignal;
  classifierLabel: ClassifierLabel;
  confidence: number; // 0..1
  /** true when the trained weights.json was used; false = heuristic fallback */
  usedTrainedModel: boolean;
  timings: Record<string, number>;
  degraded: string[]; // stages that gracefully degraded (e.g. "nli")
}

// ---------- API payloads ----------

export interface WhyAnswer {
  index: number;
  answer: string;
}

export interface AnalyzeRequest {
  conceptId: string;
  explanation: string;
  priorGaps?: string[];
  /** answers to why-questions, used to compute the depth dimension */
  whyAnswers?: WhyAnswer[];
}

export interface ChatTurn {
  role: "student" | "persona";
  content: string;
}

export interface PersonaRequest {
  mode: SessionMode;
  conceptId: string;
  gaps: { nodeId: string; nodeText: string }[];
  wrongStatements: { said: string; contradicts: string }[];
  rattaFlag: boolean;
  conversationHistory: ChatTurn[];
}

export interface PersonaResponse {
  reply: string;
  /** which why-question the persona is probing, if any */
  probingWhyIndex?: number;
}

export interface MicrolessonRequest {
  conceptId: string;
  gaps: { nodeId: string; nodeText: string }[];
  wrongStatements: { said: string; contradicts: string }[];
}

export interface MicrolessonResponse {
  lesson: string;
}

// ---------- localStorage history ----------

export interface SessionHistoryEntry {
  sessionId: string;
  conceptId: string;
  concept: string;
  mode: SessionMode;
  samajhScore: number;
  dimensions: ScoreDimensions;
  timestamp: number;
  /** for Loop Mode: the score before the micro-lesson */
  priorScore?: number;
  /** distinct misconception categories triggered in this session, if any */
  misconceptionCategories?: MisconceptionCategory[];
}
