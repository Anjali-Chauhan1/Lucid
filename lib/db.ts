import { Pool } from "pg";

/**
 * Postgres pool via `pg` (standard TCP wire protocol), not
 * @neondatabase/serverless's HTTP driver.
 *
 * The HTTP driver was tried first — it's the theoretically better fit for
 * serverless (no persistent connection to open per cold start) — but its
 * default `fetchEndpoint` rewrites the connection host into a shared
 * `api.<region>.aws.neon.tech` gateway host, and that specific derived
 * host failed to resolve in this environment (`getaddrinfo ENOTFOUND`)
 * even though the real project endpoint resolves fine. Rather than fight
 * an unexplained DNS/network issue with Neon's API gateway, this uses the
 * plain `pg` driver against the pooled connection string instead — proven
 * working here, and a very standard pattern for Postgres on Vercel.
 *
 * Uses DATABASE_URL's pooled host (-pooler): a real TCP connection is
 * opened per invocation, so pooling (PgBouncer, on Neon's side) is what
 * keeps many concurrent serverless invocations from exhausting Postgres's
 * own connection limit.
 */
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set — add it to .env.local (see .env.example).",
      );
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

let schemaReady: Promise<void> | null = null;

/**
 * Creates the tables if they don't exist yet. Called lazily before the
 * first query rather than as a separate migration step — this project has
 * no migration tooling, and `CREATE TABLE IF NOT EXISTS` is idempotent, so
 * running it on every cold start is cheap and safe.
 */
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getPool()
      .query(
        `
        CREATE TABLE IF NOT EXISTS assignments (
          code          TEXT PRIMARY KEY,
          concept_id    TEXT NOT NULL,
          concept       TEXT NOT NULL,
          mode          TEXT NOT NULL,
          teacher_label TEXT,
          created_at    BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS submissions (
          submission_id            TEXT PRIMARY KEY,
          code                     TEXT NOT NULL REFERENCES assignments(code) ON DELETE CASCADE,
          student_name             TEXT NOT NULL,
          samajh_score             INTEGER NOT NULL,
          dimensions               JSONB NOT NULL,
          misconception_categories JSONB,
          gaps                     JSONB,
          confidence_rating        INTEGER,
          submitted_at             BIGINT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS submissions_code_idx ON submissions(code);

        CREATE TABLE IF NOT EXISTS concept_maps (
          id         TEXT PRIMARY KEY,
          map        JSONB NOT NULL,
          created_at BIGINT NOT NULL
        );
        `,
      )
      .then(() => undefined);
  }
  return schemaReady;
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
