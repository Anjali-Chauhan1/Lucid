import { query } from "@/lib/db";
import type {
  Assignment,
  AssignmentSubmission,
  AssignmentWithSubmissions,
  SessionMode,
} from "@/lib/types";

/**
 * Server-side store for teacher assignments — the multi-device counterpart
 * to lib/store.ts's localStorage (which is single-browser only, so it can
 * never reach a teacher). One row per assignment code, one row per student
 * submission against it.
 *
 * Backed by Postgres (see lib/db.ts) rather than the local filesystem this
 * used to write to: a serverless function's disk is ephemeral and not
 * shared between invocations, so a teacher's assignment and a student's
 * join could land on different instances and never see each other's
 * writes. A real database is the fix, not a workaround.
 */

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

interface AssignmentRow {
  code: string;
  concept_id: string;
  concept: string;
  mode: SessionMode;
  teacher_label: string | null;
  created_at: string; // BIGINT comes back as a string from node-postgres
}

interface SubmissionRow {
  submission_id: string;
  student_name: string;
  samajh_score: number;
  dimensions: AssignmentSubmission["dimensions"];
  misconception_categories: AssignmentSubmission["misconceptionCategories"] | null;
  gaps: AssignmentSubmission["gaps"] | null;
  confidence_rating: number | null;
  submitted_at: string;
}

function toAssignment(row: AssignmentRow): Assignment {
  return {
    code: row.code,
    conceptId: row.concept_id,
    concept: row.concept,
    mode: row.mode,
    teacherLabel: row.teacher_label ?? undefined,
    createdAt: Number(row.created_at),
  };
}

function toSubmission(row: SubmissionRow): AssignmentSubmission {
  return {
    submissionId: row.submission_id,
    studentName: row.student_name,
    samajhScore: row.samajh_score,
    dimensions: row.dimensions,
    misconceptionCategories: row.misconception_categories ?? undefined,
    gaps: row.gaps ?? undefined,
    confidenceRating: row.confidence_rating ?? undefined,
    submittedAt: Number(row.submitted_at),
  };
}

export async function createAssignment(
  conceptId: string,
  concept: string,
  mode: SessionMode,
  teacherLabel?: string,
): Promise<Assignment> {
  let code = generateCode();
  // Vanishingly unlikely, but don't silently clobber an existing assignment.
  while (await getAssignment(code)) code = generateCode();

  const assignment: Assignment = {
    code,
    conceptId,
    concept,
    mode,
    teacherLabel,
    createdAt: Date.now(),
  };

  await query(
    `INSERT INTO assignments (code, concept_id, concept, mode, teacher_label, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      assignment.code,
      assignment.conceptId,
      assignment.concept,
      assignment.mode,
      assignment.teacherLabel ?? null,
      assignment.createdAt,
    ],
  );

  return assignment;
}

export async function getAssignment(
  code: string,
): Promise<AssignmentWithSubmissions | null> {
  const normalized = code.toUpperCase();

  const assignmentRows = await query<AssignmentRow>(
    `SELECT * FROM assignments WHERE code = $1`,
    [normalized],
  );
  const assignmentRow = assignmentRows[0];
  if (!assignmentRow) return null;

  const submissionRows = await query<SubmissionRow>(
    `SELECT * FROM submissions WHERE code = $1 ORDER BY submitted_at ASC`,
    [normalized],
  );

  return {
    assignment: toAssignment(assignmentRow),
    submissions: submissionRows.map(toSubmission),
  };
}

/** Returns false if the assignment code doesn't exist. */
export async function addSubmission(
  code: string,
  submission: Omit<AssignmentSubmission, "submissionId" | "submittedAt">,
): Promise<boolean> {
  const normalized = code.toUpperCase();
  const existing = await query(`SELECT 1 FROM assignments WHERE code = $1`, [normalized]);
  if (existing.length === 0) return false;

  const submissionId = `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  await query(
    `INSERT INTO submissions
       (submission_id, code, student_name, samajh_score, dimensions,
        misconception_categories, gaps, confidence_rating, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      submissionId,
      normalized,
      submission.studentName,
      submission.samajhScore,
      JSON.stringify(submission.dimensions),
      submission.misconceptionCategories ? JSON.stringify(submission.misconceptionCategories) : null,
      submission.gaps ? JSON.stringify(submission.gaps) : null,
      submission.confidenceRating ?? null,
      Date.now(),
    ],
  );

  return true;
}
