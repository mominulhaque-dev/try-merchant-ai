import { OpenAICompatibleProvider } from "./openai-compatible.server";

/**
 * Qwen (Alibaba) provider adapter — an additional failover vendor (docs/16). Qwen
 * exposes an OpenAI-compatible Chat Completions endpoint ("compatible-mode"), so
 * it's a thin configuration of {@link OpenAICompatibleProvider}. Defaults to the
 * international DashScope host; override with `QWEN_BASE_URL` (e.g. the China host)
 * via the factory. Reads `QWEN_API_KEY`/`DASHSCOPE_API_KEY`.
 */
const DEFAULT_QWEN_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

export class QwenProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, baseURL?: string, fetchImpl?: typeof fetch) {
    super({
      id: "qwen",
      baseURL: baseURL || DEFAULT_QWEN_URL,
      apiKey,
      tokenParam: "max_tokens",
      fetchImpl,
    });
  }
}
