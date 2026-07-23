import Anthropic from "@anthropic-ai/sdk";

/**
 * Provider-agnostic LLM access. Every route calls `complete()` and never knows
 * which provider answered.
 *
 * Provider is chosen by which key is present, Gemini first, so the project runs
 * free out of the box for anyone who clones it:
 *   GEMINI_API_KEY     -> Google Gemini  (free tier, no credit card)
 *   ANTHROPIC_API_KEY  -> Anthropic Claude (paid credits)
 * Force one with LUCID_PROVIDER=gemini|anthropic.
 *
 * The scoring engine does NOT depend on any of this. If no key is set the
 * report still renders, because every number in it is computed by lib/ml.
 * That independence is deliberate — keep it.
 */

export type Provider = "gemini" | "anthropic";

const GEMINI_MODEL = process.env.LUCID_GEMINI_MODEL ?? "gemini-2.0-flash";
const ANTHROPIC_MODEL = process.env.LUCID_PERSONA_MODEL ?? "claude-opus-4-8";

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

const NO_CREDENTIALS_HINT =
  "No LLM key found. Copy .env.example to .env.local and set GEMINI_API_KEY " +
  "(free — aistudio.google.com/apikey) or ANTHROPIC_API_KEY, then restart the " +
  "dev server. The Grasp Score, Parrot Detector and gap detection all work " +
  "without a key — only the AI persona, micro-lessons and custom topics need one.";

/** Which provider will be used, or null when no key is configured. */
export function activeProvider(): Provider | null {
  const forced = process.env.LUCID_PROVIDER?.toLowerCase();
  if (forced === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (forced === "anthropic") return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) {
    return "anthropic";
  }
  return null;
}

// ---------------------------------------------------------------- Gemini

interface GeminiPart {
  text?: string;
}
interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; code?: number };
}

async function completeGemini(
  system: string,
  messages: Turn[],
  maxTokens: number,
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LlmUnavailableError(NO_CREDENTIALS_HINT);

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(GEMINI_MODEL)}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      // Gemini calls the system prompt "system_instruction" and uses "model"
      // where Anthropic uses "assistant".
      system_instruction: { parts: [{ text: system }] },
      contents: (messages.length
        ? messages
        : [{ role: "user" as const, content: "Begin." }]
      ).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  const data = (await res.json()) as GeminiResponse;

  if (!res.ok) {
    const message = data.error?.message ?? `Gemini request failed (${res.status})`;
    if (res.status === 400 && /API key not valid/i.test(message)) {
      throw new LlmUnavailableError("Invalid GEMINI_API_KEY.");
    }
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  if (data.promptFeedback?.blockReason) {
    throw new LlmUnavailableError(
      `Gemini blocked the request (${data.promptFeedback.blockReason}).`,
    );
  }

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    // MAX_TOKENS with no text means the whole budget went to a preamble.
    const reason = data.candidates?.[0]?.finishReason ?? "unknown";
    throw new LlmUnavailableError(`Gemini returned no text (finishReason: ${reason}).`);
  }
  return text;
}

// ---------------------------------------------------------------- Anthropic

let anthropicClient: Anthropic | null = null;

/**
 * The zero-arg constructor resolves credentials from ANTHROPIC_API_KEY,
 * ANTHROPIC_AUTH_TOKEN, or an `ant auth login` profile — so we must not gate
 * on the env var alone, or profile-based auth would never be used.
 */
export function getClient(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

async function completeAnthropic(
  system: string,
  messages: Turn[],
  maxTokens: number,
): Promise<string> {
  let anthropic: Anthropic;
  try {
    anthropic = getClient();
  } catch {
    throw new LlmUnavailableError(NO_CREDENTIALS_HINT);
  }

  // Note: temperature/top_p are rejected by Opus 4.8 — do not add them.
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages: messages.length ? messages : [{ role: "user", content: "Begin." }],
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

// ---------------------------------------------------------------- public API

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
  const provider = activeProvider();
  if (!provider) throw new LlmUnavailableError(NO_CREDENTIALS_HINT);
  return provider === "gemini"
    ? completeGemini(system, messages, maxTokens)
    : completeAnthropic(system, messages, maxTokens);
}

/** Map provider errors onto a status code + message for our JSON error envelope. */
export function describeLlmError(err: unknown): { status: number; message: string } {
  if (err instanceof LlmUnavailableError) {
    return { status: 503, message: err.message };
  }
  // The Anthropic SDK resolves credentials lazily, so a missing key surfaces
  // here at request time rather than at construction.
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
  // Gemini errors carry a plain numeric status.
  const status = (err as { status?: number }).status;
  if (typeof status === "number") {
    if (status === 429) {
      return {
        status: 429,
        message:
          "Gemini free-tier rate limit hit — wait a moment and retry. (Scores are unaffected.)",
      };
    }
    return { status, message: (err as Error).message };
  }
  return { status: 500, message: (err as Error).message ?? "Unknown error" };
}
