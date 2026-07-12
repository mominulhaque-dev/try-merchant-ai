import { OpenAICompatibleProvider } from "./openai-compatible.server";

/**
 * Hugging Face provider adapter — an additional failover vendor (docs/16). Uses
 * the HF Inference router's OpenAI-compatible Chat Completions endpoint, so it's a
 * thin configuration of {@link OpenAICompatibleProvider}. Reads `HF_API_KEY`/
 * `HUGGINGFACE_API_KEY`. Model ids are HF repo ids (e.g.
 * `meta-llama/Llama-3.1-8B-Instruct`); pick a chat/streaming-capable model when
 * pointing a tier at this provider.
 */
const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";

export class HuggingFaceProvider extends OpenAICompatibleProvider {
  constructor(apiKey: string, fetchImpl?: typeof fetch) {
    super({
      id: "huggingface",
      baseURL: HF_ROUTER_URL,
      apiKey,
      tokenParam: "max_tokens",
      fetchImpl,
    });
  }
}
