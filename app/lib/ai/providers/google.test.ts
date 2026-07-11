import { describe, it, expect } from "vitest";
import { GoogleProvider } from "./google.server";
import type { CompletionRequest } from "../types";

const req: CompletionRequest = {
  system: "You are the SEO agent.",
  messages: [{ role: "user", content: "Draft an SEO title." }],
  maxTokens: 500,
  traceId: "trace-g",
};

/** A fetch stub returning a JSON body for the non-streaming path. */
function jsonFetch(status: number, payload: unknown): typeof fetch {
  return (async () =>
    ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    }) as unknown as Response) as unknown as typeof fetch;
}

/** A fetch stub whose body streams the given SSE lines (Gemini `alt=sse`). */
function sseFetch(events: unknown[]): typeof fetch {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const e of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      }
      controller.close();
    },
  });
  return (async () =>
    ({ ok: true, status: 200, body }) as unknown as Response) as unknown as typeof fetch;
}

describe("GoogleProvider.complete", () => {
  it("maps Gemini candidates + usage into a normalized result", async () => {
    const provider = new GoogleProvider(
      "key",
      jsonFetch(200, {
        candidates: [{ content: { parts: [{ text: "Best " }, { text: "Title" }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 4, cachedContentTokenCount: 8 },
      }),
    );

    const result = await provider.complete("gemini-2.5-flash", req);
    expect(result.text).toBe("Best Title");
    expect(result.provider).toBe("google");
    expect(result.model).toBe("gemini-2.5-flash");
    expect(result.stopReason).toBe("stop");
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 4, cachedInputTokens: 8 });
  });

  it("maps MAX_TOKENS to length and SAFETY to refusal", async () => {
    const length = new GoogleProvider(
      "key",
      jsonFetch(200, { candidates: [{ content: { parts: [{ text: "x" }] }, finishReason: "MAX_TOKENS" }] }),
    );
    expect((await length.complete("m", req)).stopReason).toBe("length");

    const refused = new GoogleProvider(
      "key",
      jsonFetch(200, { candidates: [{ finishReason: "SAFETY" }] }),
    );
    const r = await refused.complete("m", req);
    expect(r.stopReason).toBe("refusal");
    expect(r.text).toBe("");
  });

  it("parses structured output when a response format is requested", async () => {
    const provider = new GoogleProvider(
      "key",
      jsonFetch(200, {
        candidates: [{ content: { parts: [{ text: '{"title":"ok"}' }] }, finishReason: "STOP" }],
      }),
    );
    const result = await provider.complete("m", {
      ...req,
      responseFormat: { name: "seo", schema: { type: "object" } },
    });
    expect(result.parsed).toEqual({ title: "ok" });
  });

  it("maps a 429 to a retryable RATE_LIMITED AppError", async () => {
    const provider = new GoogleProvider("key", jsonFetch(429, {}));
    await expect(provider.complete("m", req)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryable: true,
    });
  });
});

describe("GoogleProvider.stream", () => {
  it("streams text deltas and surfaces terminal usage + stop reason", async () => {
    const provider = new GoogleProvider(
      "key",
      sseFetch([
        { candidates: [{ content: { parts: [{ text: "Hel" }] } }] },
        { candidates: [{ content: { parts: [{ text: "lo" }] } }] },
        {
          candidates: [{ content: { parts: [{ text: "!" }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 },
        },
      ]),
    );

    const deltas: string[] = [];
    let terminal: { usage?: unknown; stopReason?: string } | undefined;
    for await (const chunk of provider.stream("gemini-2.5-flash", req)) {
      if (chunk.delta) deltas.push(chunk.delta);
      if (chunk.done) terminal = { usage: chunk.usage, stopReason: chunk.stopReason };
    }
    expect(deltas.join("")).toBe("Hello!");
    expect(terminal?.stopReason).toBe("stop");
    expect(terminal?.usage).toEqual({ inputTokens: 3, outputTokens: 2 });
  });
});
