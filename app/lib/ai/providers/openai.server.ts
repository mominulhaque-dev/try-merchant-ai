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
 * OpenAI provider adapter — the secondary/specialist vendor and cross-provider
 * failover target (docs/16 fallback). Implemented against the Chat Completions
 * REST API with the platform `fetch` global (no SDK dependency), so the worker
 * and web tiers carry no extra vendor package. It presents the same
 * {@link AIProvider} port as Anthropic; the {@link AIService} treats them
 * interchangeably.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

function mapStop(reason: string | null | undefined): StopReason {
  switch (reason) {
    case "stop":
    case "tool_calls":
    case "function_call":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "refusal";
    default:
      return "other";
  }
}

function toUsage(usage: OpenAIChatResponse["usage"]): TokenUsage {
  const cached = usage?.prompt_tokens_details?.cached_tokens;
  return {
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    ...(cached != null ? { cachedInputTokens: cached } : {}),
  };
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function toOpenAIMessages(
  system: string,
  messages: readonly ChatMessage[],
): OpenAIMessage[] {
  return [
    { role: "system", content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private body(model: string, req: CompletionRequest): Record<string, unknown> {
    return {
      model,
      max_completion_tokens: req.maxTokens,
      messages: toOpenAIMessages(req.system, req.messages),
      ...(req.responseFormat
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: req.responseFormat.name,
                schema: req.responseFormat.schema,
                strict: true,
              },
            },
          }
        : {}),
    };
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.apiKey}`,
    };
  }

  private signal(req: CompletionRequest): AbortSignal | undefined {
    return req.timeoutMs != null ? AbortSignal.timeout(req.timeoutMs) : undefined;
  }

  async complete(model: string, req: CompletionRequest): Promise<CompletionResult> {
    try {
      const response = await this.fetchImpl(OPENAI_URL, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(this.body(model, req)),
        signal: this.signal(req),
      });
      if (!response.ok) {
        throw { status: response.status, provider: this.id };
      }
      const data = (await response.json()) as OpenAIChatResponse;
      const choice = data.choices?.[0];
      const text = choice?.message?.content ?? "";
      const result: CompletionResult = {
        text,
        usage: toUsage(data.usage),
        stopReason: mapStop(choice?.finish_reason),
        provider: this.id,
        model,
        ...(req.responseFormat ? { parsed: safeParse(text) } : {}),
      };
      return result;
    } catch (err) {
      throw mapProviderError(err, { provider: this.id, traceId: req.traceId });
    }
  }

  /**
   * Streaming failover path. OpenAI's SSE stream omits usage unless explicitly
   * requested; we opt in via `stream_options` and surface a terminal chunk with
   * the normalized usage + stop reason once `[DONE]` arrives.
   */
  async *stream(
    model: string,
    req: CompletionRequest,
  ): AsyncIterable<CompletionChunk> {
    let response: Response;
    try {
      response = await this.fetchImpl(OPENAI_URL, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          ...this.body(model, req),
          stream: true,
          stream_options: { include_usage: true },
        }),
        signal: this.signal(req),
      });
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
          if (payload === "[DONE]") continue;

          const event = JSON.parse(payload) as {
            choices?: Array<{
              delta?: { content?: string };
              finish_reason?: string | null;
            }>;
            usage?: OpenAIChatResponse["usage"];
          };
          const choice = event.choices?.[0];
          const delta = choice?.delta?.content;
          if (delta) yield { delta, done: false };
          if (choice?.finish_reason) stopReason = mapStop(choice.finish_reason);
          if (event.usage) usage = toUsage(event.usage);
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
