import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side Anthropic client. The API key never reaches the browser —
 * every call happens inside an API route.
 *
 * The scoring engine does NOT depend on this. If the LLM is unavailable the
 * report still renders, because every number in it is computed by lib/ml.
 * That independence is deliberate — keep it.
 */
const MODEL = process.env.LUCID_PERSONA_MODEL ?? "claude-opus-4-8";

let client: Anthropic | null = null;

/**
 * The zero-arg constructor resolves credentials from ANTHROPIC_API_KEY,
 * ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile — so we must not gate
 * on the env var alone, or profile-based auth would never be used.
 */
export function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export class LlmUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

/**
 * Single non-streaming completion.
 * `maxTokens` is deliberately small — persona replies are capped at two
 * sentences and micro-lessons at 150 words.
 */
export async function complete(
  system: string,
  messages: Turn[],
  maxTokens = 400,
): Promise<string> {
  let anthropic: Anthropic;
  try {
    anthropic = getClient();
  } catch {
    throw new LlmUnavailableError(
      "No Anthropic credentials found — copy .env.example to .env.local and add ANTHROPIC_API_KEY.",
    );
  }

  // Note: temperature/top_p are rejected by Opus 4.8 — do not add them.
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: messages.length
      ? messages
      : [{ role: "user", content: "Begin." }],
  });

  if (response.stop_reason === "refusal") {
    throw new LlmUnavailableError("The model declined to respond.");
  }

  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Map SDK errors onto a status code + message for our JSON error envelope. */
const NO_CREDENTIALS_HINT =
  "No Anthropic credentials found. Copy .env.example to .env.local and set ANTHROPIC_API_KEY, then restart the dev server. (The Grasp Score still works without it — only the AI persona needs a key.)";

export function describeLlmError(err: unknown): { status: number; message: string } {
  if (err instanceof LlmUnavailableError) {
    return { status: 503, message: err.message };
  }
  // The SDK resolves credentials lazily, so a missing key surfaces here at
  // request time rather than at construction.
  if (
    err instanceof Error &&
    err.message.includes("Could not resolve authentication method")
  ) {
    return { status: 503, message: NO_CREDENTIALS_HINT };
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return { status: 401, message: "Invalid ANTHROPIC_API_KEY." };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { status: 429, message: "Rate limited — try again in a moment." };
  }
  if (err instanceof Anthropic.APIError) {
    return { status: err.status ?? 502, message: err.message };
  }
  return { status: 500, message: (err as Error).message ?? "Unknown error" };
}
