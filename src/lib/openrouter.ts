type OpenRouterRole = "system" | "user" | "assistant";

export type OpenRouterMessage = {
  role: OpenRouterRole;
  content: string;
};

export type OpenRouterChatOptions = {
  messages: OpenRouterMessage[];
  primaryModel: string;
  fallbackModel?: string | null;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string;
};

type OpenRouterChoice = {
  message?: {
    role?: string;
    content?: string;
  };
};

type OpenRouterResponse = {
  id?: string;
  model?: string;
  choices?: OpenRouterChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

export function buildOpenRouterChatPayload(options: OpenRouterChatOptions) {
  const fallbackModel = options.fallbackModel?.trim();
  const models = fallbackModel ? [options.primaryModel, fallbackModel] : undefined;

  return {
    ...(models ? { models } : { model: options.primaryModel }),
    messages: options.messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 800,
  };
}

export function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY?.trim() || "";
}

export async function sendOpenRouterChatCompletion(options: OpenRouterChatOptions) {
  const apiKey = options.apiKey?.trim() || getOpenRouterApiKey();

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY belum dikonfigurasi.");
  }

  const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildOpenRouterChatPayload(options)),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request gagal: ${response.status}`);
  }

  return (await response.json()) as OpenRouterResponse;
}
