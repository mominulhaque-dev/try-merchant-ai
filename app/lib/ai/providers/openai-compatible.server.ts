import type { ModelProvider } from "../../agents/types";
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
 * A reusable adapter for any vendor that speaks the OpenAI **Chat Completions**
 * wire format (docs/16 "Never hard-couple to one vendor"). OpenAI itself, Qwen
 * (Alibaba DashScope "compatible-mode"), and Hugging Face's router endpoint all
 * expose this shape, so they share one implementation parametrized by id, base
 * URL, and the max-token field name. Implemented on the platform `fetch` global —
 * no vendor SDK — and normalizes responses to the vendor-neutral
 * {@link AIProvider} port.
 */

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
      return reason ? "other" : "stop";
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

interface WireMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function toMessages(system: string, messages: readonly ChatMessage[]): WireMessage[] {
  return [
    { role: "system", content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export interface OpenAICompatibleConfig {
  readonly id: ModelProvider;
  /** Full chat-completions endpoint URL. */
  readonly baseURL: string;
  readonly apiKey: string;
  /**
   * The output-token field name. OpenAI's current API uses
   * `max_completion_tokens`; compatible endpoints (Qwen, HF) use `max_tokens`.
   */
  readonly tokenParam?: "max_tokens" | "max_completion_tokens";
  readonly fetchImpl?: typeof fetch;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly id: ModelProvider;
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly tokenParam: "max_tokens" | "max_completion_tokens";
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAICompatibleConfig) {
    this.id = config.id;
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.tokenParam = config.tokenParam ?? "max_tokens";
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  private body(model: string, req: CompletionRequest): Record<string, unknown> {
    return {
      model,
      [this.tokenParam]: req.maxTokens,
      messages: toMessages(req.system, req.messages),
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
      const response = await this.fetchImpl(this.baseURL, {
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
   * Streaming path. Usage is omitted from the SSE stream unless requested; we opt
   * in via `stream_options.include_usage` (honored by OpenAI/Qwen; HF may omit it,
   * in which case the terminal chunk reports zero usage) and surface a terminal
   * chunk with normalized usage + stop reason once the stream ends.
   */
  async *stream(
    model: string,
    req: CompletionRequest,
  ): AsyncIterable<CompletionChunk> {
    let response: Response;
    try {
      response = await this.fetchImpl(this.baseURL, {
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
