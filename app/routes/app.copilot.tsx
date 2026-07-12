import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { captureStoreSnapshot, scoreSnapshot } from "../lib/domain/store-health";
import { assertShop } from "../lib/security/tenant.server";
import { hasAnyProvider } from "../lib/ai";
import {
  clampHistory,
  encodeSSE,
  streamCopilotReply,
  suggestedPrompts,
  type CopilotEvent,
} from "../lib/ai/copilot.server";
import { logger } from "../lib/telemetry/logger.server";
import { newTraceId } from "../lib/ids";
import { AppError } from "../lib/errors";

/**
 * Copilot (docs/15) — the conversational surface. The merchant asks about their
 * store; answers stream token-by-token, grounded in the live Store-Health scan
 * (docs/15 grounding). Writes never happen here: chat points the merchant to the
 * Findings page for the reversible preview→approve→execute→undo loop.
 *
 * The `action` returns a Server-Sent Events stream so tokens render as they
 * arrive; the client reads it with `fetch` (App Bridge auto-authenticates
 * same-origin requests) rather than a data-router fetcher, which would buffer.
 * On provider outage or no configured key it degrades to a Suggest-only banner
 * (docs/40). Threads are session-local until persisted storage lands (M0.T7).
 */

/* ---------------------------------------------------------------- Loader -- */

interface TopFinding {
  id: string;
  title: string;
  severity: string;
  domain: string;
}

interface CopilotData {
  shop: string;
  providerConfigured: boolean;
  suggestions: string[];
  overallScore: number | null;
  topFindings: TopFinding[];
  scanError: boolean;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = assertShop(session.shop);
  const traceId = newTraceId();
  const log = logger.child({ traceId, shop });

  try {
    const snapshot = await captureStoreSnapshot(admin, {
      shopDomain: shop,
      capturedAt: new Date().toISOString(),
    });
    const report = scoreSnapshot(snapshot);
    const topFindings: TopFinding[] = [...report.findings]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3)
      .map((f) => ({ id: f.id, title: f.title, severity: f.severity, domain: f.domain }));
    log.info("copilot.loaded", { findings: report.findings.length });
    return {
      shop,
      providerConfigured: hasAnyProvider(),
      suggestions: suggestedPrompts(report),
      overallScore: report.overallScore,
      topFindings,
      scanError: false,
    } satisfies CopilotData;
  } catch (error) {
    log.error("copilot.scan_failed", { err: AppError.from(error, traceId) });
    return {
      shop,
      providerConfigured: hasAnyProvider(),
      suggestions: suggestedPrompts(null),
      overallScore: null,
      topFindings: [] as TopFinding[],
      scanError: true,
    } satisfies CopilotData;
  }
};

/* ---------------------------------------------------------------- Action -- */

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
} as const;

/** A one-shot SSE response carrying a single event then closing (for errors). */
function sseOnce(event: CopilotEvent): Response {
  return new Response(encodeSSE(event), { headers: SSE_HEADERS });
}

/** Turn a failure into a user-safe, non-leaky message (docs/40). */
function userMessage(error: AppError): string {
  if (error.code === "BUDGET_EXCEEDED") {
    return "You've reached your AI usage limit for now. It resets soon, or upgrade your plan for more.";
  }
  return "Something went wrong generating a reply. Please try again.";
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = assertShop(session.shop);
  const traceId = newTraceId();
  const log = logger.child({ traceId, shop });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return sseOnce({ type: "error", code: "VALIDATION", message: "Malformed request." });
  }

  const message = String((payload as { message?: unknown })?.message ?? "").trim();
  const history = clampHistory((payload as { history?: unknown })?.history);

  if (!message) {
    return sseOnce({ type: "error", code: "VALIDATION", message: "Please enter a message." });
  }
  if (!hasAnyProvider()) {
    return sseOnce({
      type: "error",
      code: "PROVIDER_UNAVAILABLE",
      message: "The AI assistant isn't configured yet. You can still review findings on the Findings page.",
    });
  }

  // Ground the turn in a fresh quick scan. Best-effort: if it fails, the model
  // is told the scan is unavailable rather than fabricating (docs/15). Cached
  // scans supersede this per-turn read at M0.T7/M1.T5.
  let report = null as Awaited<ReturnType<typeof scoreSnapshot>> | null;
  try {
    const snapshot = await captureStoreSnapshot(admin, {
      shopDomain: shop,
      capturedAt: new Date().toISOString(),
    });
    report = scoreSnapshot(snapshot);
  } catch (error) {
    log.warn("copilot.grounding_failed", { err: AppError.from(error, traceId) });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamCopilotReply({ shop, report, history, message, traceId })) {
          if (chunk.delta) {
            controller.enqueue(encoder.encode(encodeSSE({ type: "token", value: chunk.delta })));
          }
        }
        controller.enqueue(encoder.encode(encodeSSE({ type: "done" })));
        log.info("copilot.reply.ok", {});
      } catch (error) {
        const appError = AppError.from(error, traceId);
        log.error("copilot.reply.failed", { err: appError });
        controller.enqueue(
          encoder.encode(
            encodeSSE({ type: "error", code: appError.code, message: userMessage(appError) }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
};

/* ------------------------------------------------------------------ View -- */

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const COPILOT_ENDPOINT = "/app/copilot";

export default function CopilotPage() {
  const data = useLoaderData<typeof loader>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;
      setError(null);

      // History sent to the server excludes the just-added turn.
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        { role: "assistant", content: "" },
      ]);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const appendToAssistant = (delta: string) =>
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            next[next.length - 1] = { ...last, content: last.content + delta };
          }
          return next;
        });

      try {
        const res = await fetch(COPILOT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let sawError = false;

        // Parse the SSE frames: events are separated by a blank line.
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const event = JSON.parse(line.slice(5).trim()) as CopilotEvent;
            if (event.type === "token") {
              appendToAssistant(event.value);
            } else if (event.type === "error") {
              sawError = true;
              setError(event.message);
            }
          }
        }

        if (sawError) {
          // Drop the empty assistant placeholder on a hard error.
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && last.content === "") {
              return prev.slice(0, -1);
            }
            return prev;
          });
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") {
          // Stopped by the merchant; keep whatever streamed so far.
        } else {
          setError("The assistant is unavailable right now. Please try again.");
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === "assistant" && last.content === "") {
              return prev.slice(0, -1);
            }
            return prev;
          });
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const disabled = !data.providerConfigured;

  return (
    <s-page heading="Copilot">
      <s-section heading="Ask about your store">
        <s-paragraph>
          Ask anything about your store's health and what to improve next. Answers
          are grounded in your latest scan. To apply a fix, head to the{" "}
          <s-link href="/app/findings">Findings</s-link> page — nothing is changed
          from chat without your approval.
        </s-paragraph>
        {data.overallScore !== null && (
          <s-text color="subdued">Current health score: {data.overallScore}/100</s-text>
        )}

        {disabled && (
          <s-banner tone="info" heading="Assistant not configured">
            <s-paragraph>
              The AI assistant isn't available in this environment yet. You can
              still review and fix issues on the Findings page.
            </s-paragraph>
          </s-banner>
        )}

        {data.scanError && !disabled && (
          <s-banner tone="warning" heading="Working without your latest scan">
            <s-paragraph>
              We couldn't read your store just now, so answers may be limited.
              Reload to try grounding on a fresh scan.
            </s-paragraph>
          </s-banner>
        )}

        {error && (
          <s-banner tone="critical" heading="Couldn't complete that">
            <s-paragraph>{error}</s-paragraph>
          </s-banner>
        )}

        {/* Conversation transcript, announced politely to assistive tech. */}
        <div
          ref={scrollRef}
          aria-live="polite"
          aria-busy={streaming}
          style={{ maxHeight: "420px", overflowY: "auto" }}
        >
          <s-stack direction="block" gap="base">
            {messages.length === 0 ? (
              <EmptyState suggestions={data.suggestions} onPick={send} disabled={disabled} />
            ) : (
              messages.map((m, i) => <MessageBubble key={i} message={m} streaming={streaming} last={i === messages.length - 1} />)
            )}
          </s-stack>
        </div>

        <form onSubmit={onSubmit}>
          <s-stack direction="block" gap="small-300">
            <s-text-field
              label="Message"
              labelAccessibilityVisibility="exclusive"
              placeholder="Ask about your store…"
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              {...(disabled ? { disabled: true } : {})}
            ></s-text-field>
            <s-stack direction="inline" gap="small-300">
              {streaming ? (
                <s-button type="button" onClick={stop}>
                  Stop
                </s-button>
              ) : (
                <s-button
                  type="submit"
                  variant="primary"
                  {...(disabled || input.trim() === "" ? { disabled: true } : {})}
                >
                  Send
                </s-button>
              )}
            </s-stack>
          </s-stack>
        </form>
      </s-section>

      <s-section slot="aside" heading="What Copilot can do">
        <s-paragraph>
          Copilot reads your latest Store Health scan to answer questions and
          recommend the highest-impact next step. It can explain any finding and
          point you to the exact fix.
        </s-paragraph>
        <s-paragraph color="subdued">
          It never writes to your store from chat — every change goes through the
          reversible preview-and-approve flow on the Findings page.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

function EmptyState({
  suggestions,
  onPick,
  disabled,
}: {
  suggestions: string[];
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small-300">
        <s-text color="subdued">Try asking:</s-text>
        <s-stack direction="block" gap="small-300">
          {suggestions.map((s) => (
            <s-button
              key={s}
              onClick={() => onPick(s)}
              {...(disabled ? { disabled: true } : {})}
            >
              {s}
            </s-button>
          ))}
        </s-stack>
      </s-stack>
    </s-box>
  );
}

function MessageBubble({
  message,
  streaming,
  last,
}: {
  message: ChatMessage;
  streaming: boolean;
  last: boolean;
}) {
  const isUser = message.role === "user";
  const pending = !isUser && last && streaming && message.content === "";
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background={isUser ? "subdued" : "base"}
    >
      <s-stack direction="block" gap="small-300">
        <s-text color="subdued">{isUser ? "You" : "Copilot"}</s-text>
        {pending ? (
          <s-text color="subdued">Thinking…</s-text>
        ) : (
          <s-paragraph>{message.content}</s-paragraph>
        )}
      </s-stack>
    </s-box>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
