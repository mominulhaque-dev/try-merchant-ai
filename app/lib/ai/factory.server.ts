import { getConfig } from "../config/env.server";
import type { ModelProvider } from "../agents/types";
import type { AIProvider } from "./types";
import { AnthropicProvider } from "./providers/anthropic.server";
import { OpenAIProvider } from "./providers/openai.server";
import { GoogleProvider } from "./providers/google.server";
import { QwenProvider } from "./providers/qwen.server";
import { HuggingFaceProvider } from "./providers/huggingface.server";

/**
 * Build the configured provider set from validated env (docs/37, docs/16).
 *
 * A provider is included only when its API key is present, so a deploy with just
 * an Anthropic key still runs (the service simply has no OpenAI tier to fail over
 * to). This keeps local dev and partial rollouts working without faking a vendor
 * (docs/16 fallback is best-effort over whatever is configured).
 */
export function buildProviders(): Partial<Record<ModelProvider, AIProvider>> {
  const cfg = getConfig();
  const providers: Partial<Record<ModelProvider, AIProvider>> = {};

  if (cfg.ai.anthropicApiKey) {
    providers.anthropic = new AnthropicProvider(cfg.ai.anthropicApiKey);
  }
  if (cfg.ai.openaiApiKey) {
    providers.openai = new OpenAIProvider(cfg.ai.openaiApiKey);
  }
  if (cfg.ai.googleApiKey) {
    providers.google = new GoogleProvider(cfg.ai.googleApiKey);
  }
  if (cfg.ai.qwenApiKey) {
    providers.qwen = new QwenProvider(cfg.ai.qwenApiKey, cfg.ai.qwenBaseUrl);
  }
  if (cfg.ai.hfApiKey) {
    providers.huggingface = new HuggingFaceProvider(cfg.ai.hfApiKey);
  }

  return providers;
}

/** True when at least one model provider is configured (docs/40 degraded UX). */
export function hasAnyProvider(): boolean {
  const cfg = getConfig();
  const ai = cfg.ai;
  return Boolean(
    ai.anthropicApiKey || ai.openaiApiKey || ai.googleApiKey || ai.qwenApiKey || ai.hfApiKey,
  );
}
