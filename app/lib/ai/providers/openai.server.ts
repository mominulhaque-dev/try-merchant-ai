import { OpenAICompatibleProvider } from "./openai-compatible.server";

/**
 * OpenAI provider adapter — the secondary/specialist vendor and cross-provider
 * failover target (docs/16 fallback). A thin configuration of the shared
 * {@link OpenAICompatibleProvider} (Chat Completions over `fetch`, no SDK).
 */
export class OpenAIProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    super({
      id: "openai",
      baseURL: "https://api.openai.com/v1/chat/completions",
      apiKey,
      tokenParam: "max_completion_tokens",
      fetchImpl,
    });
  }
}
