import type {
  AIProvider,
  ChatMessage,
  CompletionChunk,
  CompletionRequest,
  CompletionResult,
  StopReason,
  TokenUsage,
} from "../types";
import { mapProviderError } from "../errors.server";

/**
 * Google (Gemini) provider adapter — an additional failover vendor (docs/16
 * "Never hard-couple to one vendor"). Implemented against the Google AI Studio
 * Generative Language REST API with the platform `fetch` global (no SDK
 * dependency), presenting the same {@link AIProvider} port as Anthropic/OpenAI.
 *
 * Not on any agent's model tier by default — the fleet stays Claude-primary
 * (docs/16, CLAUDE.md). Point a tier's {@link ModelRef} at `{ provider: "google",
 * model: "gemini-…" }` to use it, and set `GOOGLE_API_KEY` (or `GEMINI_API_KEY`).
 */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text?: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
  finishReason?: string | null;
}
interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsage;
}

/** Map Gemini finish reasons to the vendor-neutral set (docs/40). */
function mapStop(reason: string | null | undefined): StopReason {
  switch (reason) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "RECITATION":
    case "BLOCKLIST":
    case "PROHIBITED_CONTENT":
    case "SPII":
      return "refusal";
    default:
      // Gemini omits finishReason on non-terminal stream chunks; treat as stop.
      return reason ? "other" : "stop";
  }
}

function toUsage(usage: GeminiUsage | undefined): TokenUsage {
  const cached = usage?.cachedContentTokenCount;
  return {
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    ...(cached != null ? { cachedInputTokens: cached } : {}),
  };
}

/** Concatenate all text parts of a candidate. */
function candidateText(candidate: GeminiCandidate | undefined): string {
  return (candidate?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

/** Gemini uses `model` for the assistant role and a separate systemInstruction. */
function toContents(messages: readonly ChatMessage[]): GeminiContent[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export class GoogleProvider implements AIProvider {
  readonly id = "google" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private body(req: CompletionRequest): Record<string, unknown> {
    return {
      systemInstruction: { parts: [{ text: req.system }] },
      contents: toContents(req.messages),
      generationConfig: {
        maxOutputTokens: req.maxTokens,
        ...(req.responseFormat
          ? {
              responseMimeType: "application/json",
              responseSchema: req.responseFormat.schema,
            }
          : {}),
      },
    };
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-goog-api-key": this.apiKey,
    };
  }

  private signal(req: CompletionRequest): AbortSignal | undefined {
    return req.timeoutMs != null ? AbortSignal.timeout(req.timeoutMs) : undefined;
  }

  async complete(model: string, req: CompletionRequest): Promise<CompletionResult> {
    try {
      const response = await this.fetchImpl(
        `${API_BASE}/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(this.body(req)),
          signal: this.signal(req),
        },
      );
      if (!response.ok) {
        throw { status: response.status, provider: this.id };
      }
      const data = (await response.json()) as GeminiResponse;
      const candidate = data.candidates?.[0];
      const text = candidateText(candidate);
      const result: CompletionResult = {
        text,
        usage: toUsage(data.usageMetadata),
        stopReason: mapStop(candidate?.finishReason),
        provider: this.id,
        model,
        ...(req.responseFormat ? { parsed: safeParse(text) } : {}),
      };
      return result;
    } catch (err) {
      throw mapProviderError(err, { provider: this.id, traceId: req.traceId });
    }
  }

  async *stream(
    model: string,
    req: CompletionRequest,
  ): AsyncIterable<CompletionChunk> {
    let response: Response;
    try {
      response = await this.fetchImpl(
        `${API_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(this.body(req)),
          signal: this.signal(req),
        },
      );
      if (!response.ok || !response.body) {
        throw { status: response.status, provider: this.id };
      }
    } catch (err) {
      throw mapProviderError(err, { provider: this.id, traceId: req.traceId });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let usage: TokenUsage | undefined;
    let stopReason: StopReason = "stop";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;

          const event = JSON.parse(payload) as GeminiResponse;
          const candidate = event.candidates?.[0];
          const delta = candidateText(candidate);
          if (delta) yield { delta, done: false };
          if (candidate?.finishReason) stopReason = mapStop(candidate.finishReason);
          if (event.usageMetadata) usage = toUsage(event.usageMetadata);
        }
      }
    } catch (err) {
      throw mapProviderError(err, { provider: this.id, traceId: req.traceId });
    }

    yield {
      delta: "",
      done: true,
      usage: usage ?? { inputTokens: 0, outputTokens: 0 },
      stopReason,
      provider: this.id,
      model,
    };
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
