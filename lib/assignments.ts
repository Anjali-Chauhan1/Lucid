import fs from "node:fs";
import path from "node:path";
import type {
  Assignment,
  AssignmentSubmission,
  AssignmentWithSubmissions,
  SessionMode,
} from "@/lib/types";

/**
 * Server-side, JSON-file-backed store for teacher assignments — the
 * multi-device counterpart to lib/store.ts's localStorage (which is
 * single-browser only, so it can never reach a teacher). One file per
 * assignment code, holding the assignment plus every student submission.
 *
 * Same pattern as lib/concepts/generate.ts's disk cache: no database
 * setup, just fs.readFileSync/writeFileSync. Good enough for a classroom's
 * worth of writes; not built for high-concurrency production traffic.
 */

const DATA_DIR = path.join(process.cwd(), ".cache", "assignments");

// Excludes 0/O/1/I/L — characters students commonly misread when copying a
// code off a projector screen.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function filePath(code: string): string {
  return path.join(DATA_DIR, `${code.toUpperCase()}.json`);
}

function readFile(code: string): AssignmentWithSubmissions | null {
  try {
    const p = filePath(code);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf8")) as AssignmentWithSubmissions;
  } catch {
    return null;
  }
}

function writeFile(data: AssignmentWithSubmissions): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath(data.assignment.code), JSON.stringify(data, null, 2), "utf8");
}

export function createAssignment(
  conceptId: string,
  concept: string,
  mode: SessionMode,
  teacherLabel?: string,
): Assignment {
  let code = generateCode();
  // Vanishingly unlikely, but don't silently clobber an existing assignment.
  while (readFile(code)) code = generateCode();

  const assignment: Assignment = {
    code,
    conceptId,
    concept,
    mode,
    teacherLabel,
    createdAt: Date.now(),
  };
  writeFile({ assignment, submissions: [] });
  return assignment;
}

export function getAssignment(code: string): AssignmentWithSubmissions | null {
  return readFile(code);
}

/** Returns false if the assignment code doesn't exist. */
export function addSubmission(
  code: string,
  submission: Omit<AssignmentSubmission, "submissionId" | "submittedAt">,
): boolean {
  const data = readFile(code);
  if (!data) return false;
  data.submissions.push({
    ...submission,
    submissionId: `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    submittedAt: Date.now(),
  });
  writeFile(data);
  return true;
}
