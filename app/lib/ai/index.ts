/**
 * AI provider abstraction (docs/16 "Model provider abstraction", M0.T9).
 *
 * A uniform, vendor-neutral interface over Anthropic (primary), OpenAI
 * (fallback), and a cheap tier, with model tiering, per-shop budget enforcement,
 * AAC metering, and automatic provider failover. Import from here; never import a
 * vendor SDK directly outside `providers/`.
 */
export type {
  AIProvider,
  ChatMessage,
  ChatRole,
  CompletionChunk,
  CompletionRequest,
  CompletionResult,
  Effort,
  JsonSchema,
  ModelResolution,
  ModelTier,
  StopReason,
  TokenUsage,
} from "./types";
export {
  AIService,
  usageToAAC,
  type AIBudgetPort,
  type AICallContext,
  type AIServiceDeps,
} from "./service.server";
export { mapProviderError } from "./errors.server";
export { AnthropicProvider } from "./providers/anthropic.server";
export {
  OpenAICompatibleProvider,
  type OpenAICompatibleConfig,
} from "./providers/openai-compatible.server";
export { OpenAIProvider } from "./providers/openai.server";
export { GoogleProvider } from "./providers/google.server";
export { QwenProvider } from "./providers/qwen.server";
export { HuggingFaceProvider } from "./providers/huggingface.server";
export { buildProviders, hasAnyProvider } from "./factory.server";
