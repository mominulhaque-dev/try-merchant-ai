import { describe, it, expect } from "vitest";
import { QwenProvider } from "./qwen.server";
import { OpenAIProvider } from "./openai.server";
import { HuggingFaceProvider } from "./huggingface.server";
import type { CompletionRequest } from "../types";

const req: CompletionRequest = {
  system: "You are the SEO agent.",
  messages: [{ role: "user", content: "Draft an SEO title." }],
  maxTokens: 500,
  traceId: "trace-oc",
};

interface Captured {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** A fetch stub that records the request and returns a fixed JSON body. */
function capturingFetch(payload: unknown, captured: Captured[]): typeof fetch {
  return (async (url: string, init: RequestInit) => {
    captured.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string),
    });
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

function errorFetch(status: number): typeof fetch {
  return (async () =>
    ({ ok: false, status }) as unknown as Response) as unknown as typeof fetch;
}

function sseFetch(events: unknown[]): typeof fetch {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return (async () =>
    ({ ok: true, status: 200, body }) as unknown as Response) as unknown as typeof fetch;
}

const okBody = {
  choices: [{ message: { content: "Great Title" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 20, completion_tokens: 6, prompt_tokens_details: { cached_tokens: 5 } },
};

describe("OpenAI-compatible providers — complete", () => {
  it("Qwen posts to the DashScope endpoint with a bearer token and max_tokens", async () => {
    const captured: Captured[] = [];
    const provider = new QwenProvider("qwen-key", undefined, capturingFetch(okBody, captured));

    const result = await provider.complete("qwen-turbo", req);
    expect(result.provider).toBe("qwen");
    expect(result.text).toBe("Great Title");
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 6, cachedInputTokens: 5 });

    const call = captured[0];
    expect(call.url).toContain("dashscope");
    expect(call.headers.authorization).toBe("Bearer qwen-key");
    expect(call.body.max_tokens).toBe(500);
    expect(call.body.messages).toEqual([
      { role: "system", content: "You are the SEO agent." },
      { role: "user", content: "Draft an SEO title." },
    ]);
  });

  it("OpenAI uses max_completion_tokens; Qwen/HF use max_tokens", async () => {
    const oa: Captured[] = [];
    await new OpenAIProvider("k", capturingFetch(okBody, oa)).complete("gpt-4.1", req);
    expect(oa[0].body.max_completion_tokens).toBe(500);
    expect(oa[0].body.max_tokens).toBeUndefined();

    const hf: Captured[] = [];
    const hfProvider = new HuggingFaceProvider("k", capturingFetch(okBody, hf));
    const r = await hfProvider.complete("meta-llama/Llama-3.1-8B-Instruct", req);
    expect(r.provider).toBe("huggingface");
    expect(hf[0].url).toContain("router.huggingface.co");
    expect(hf[0].body.max_tokens).toBe(500);
  });

  it("honors a Qwen base-url override (e.g. the China host)", async () => {
    const captured: Captured[] = [];
    const provider = new QwenProvider(
      "k",
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      capturingFetch(okBody, captured),
    );
    await provider.complete("qwen-turbo", req);
    expect(captured[0].url).toBe(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    );
  });

  it("maps a 429 to a retryable RATE_LIMITED AppError", async () => {
    const provider = new QwenProvider("k", undefined, errorFetch(429));
    await expect(provider.complete("qwen-turbo", req)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryable: true,
    });
  });
});

describe("OpenAI-compatible providers — stream", () => {
  it("streams deltas and surfaces terminal usage from the final chunk", async () => {
    const provider = new QwenProvider(
      "k",
      undefined,
      sseFetch([
        { choices: [{ delta: { content: "Hel" } }] },
        { choices: [{ delta: { content: "lo" }, finish_reason: null }] },
        { choices: [{ delta: {}, finish_reason: "stop" }] },
        { choices: [], usage: { prompt_tokens: 3, completion_tokens: 2 } },
      ]),
    );

    const deltas: string[] = [];
    let terminal: { usage?: unknown; stopReason?: string } | undefined;
    for await (const chunk of provider.stream("qwen-turbo", req)) {
      if (chunk.delta) deltas.push(chunk.delta);
      if (chunk.done) terminal = { usage: chunk.usage, stopReason: chunk.stopReason };
    }
    expect(deltas.join("")).toBe("Hello");
    expect(terminal?.stopReason).toBe("stop");
    expect(terminal?.usage).toEqual({ inputTokens: 3, outputTokens: 2 });
  });
});
