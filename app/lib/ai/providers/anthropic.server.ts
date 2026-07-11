import Anthropic from "@anthropic-ai/sdk";
import type {
  AIProvider,
  ChatMessage,
  CompletionChunk,
  CompletionRequest,
  CompletionResult,
  Effort,
  StopReason,
  TokenUsage,
} from "../types";
import { mapProviderError } from "../errors.server";

/**
 * Anthropic (Claude) provider adapter — the primary model vendor (docs/16
 * ADR-016-2). It translates vendor-neutral {@link CompletionRequest}s to the
 * official SDK and normalizes responses back, so nothing outside this file sees
 * an Anthropic type. Uses adaptive thinking + the effort knob (the current Claude
 * request surface: `budget_tokens`/`temperature` are rejected on Opus 4.8), and
 * structured outputs via `output_config.format` when a schema is requested.
 */

const EFFORT_MAP: Record<Effort, "low" | "medium" | "high"> = {
  low: "low",
  medium: "medium",
  high: "high",
};

/** Map Anthropic stop reasons to the vendor-neutral set (docs/40). */
function mapStop(reason: string | null): StopReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
    case "tool_use":
      return "stop";
    case "max_tokens":
      return "length";
    case "refusal":
      return "refusal";
    default:
      return "other";
  }
}

function toUsage(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
}): TokenUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    ...(usage.cache_read_input_tokens != null
      ? { cachedInputTokens: usage.cache_read_input_tokens }
      : {}),
  };
}

function toAnthropicMessages(messages: readonly ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;
  private readonly client: Anthropic;

  constructor(apiKey: string, client?: Anthropic) {
    // Cache the stable system prompt prefix by default (docs/33): the charter is
    // identical across calls, so Anthropic's prefix cache cuts input cost.
    this.client = client ?? new Anthropic({ apiKey });
  }

  /** Shared param builder for complete()/stream(). */
  private buildParams(
    model: string,
    req: CompletionRequest,
  ): Anthropic.MessageCreateParams {
    return {
      model,
      max_tokens: req.maxTokens,
      system: [
        {
          type: "text",
          text: req.system,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: toAnthropicMessages(req.messages),
      // Adaptive thinking is the recommended on-mode for Opus 4.8; omitting it
      // would run without thinking (docs/16 reasoning).
      thinking: { type: "adaptive" },
      ...(req.effort
        ? { output_config: { effort: EFFORT_MAP[req.effort] } }
        : {}),
      ...(req.responseFormat
        ? {
            output_config: {
              ...(req.effort ? { effort: EFFORT_MAP[req.effort] } : {}),
              format: {
                type: "json_schema",
                schema: req.responseFormat.schema,
              },
            },
          }
        : {}),
    };
  }

  private options(req: CompletionRequest): { timeout?: number } {
    return req.timeoutMs != null ? { timeout: req.timeoutMs } : {};
  }

  async complete(model: string, req: CompletionRequest): Promise<CompletionResult> {
    try {
      const message = await this.client.messages.create(
        { ...this.buildParams(model, req), stream: false },
        this.options(req),
      );

      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      const result: CompletionResult = {
        text,
        usage: toUsage(message.usage),
        stopReason: mapStop(message.stop_reason),
        provider: this.id,
        model: message.model,
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
    let stream: ReturnType<Anthropic["messages"]["stream"]>;
    try {
      stream = this.client.messages.stream(this.buildParams(model, req), this.options(req));
    } catch (err) {
      throw mapProviderError(err, { provider: this.id, traceId: req.traceId });
    }

    try {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { delta: event.delta.text, done: false };
        }
      }
      const final = await stream.finalMessage();
      yield {
        delta: "",
        done: true,
        usage: toUsage(final.usage),
        stopReason: mapStop(final.stop_reason),
        provider: this.id,
        model: final.model,
      };
    } catch (err) {
      throw mapProviderError(err, { provider: this.id, traceId: req.traceId });
    }
  }
}

/** Parse structured-output text, tolerating a non-JSON body without throwing. */
function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
