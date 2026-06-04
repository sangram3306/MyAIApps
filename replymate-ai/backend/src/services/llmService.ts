import { AsyncLocalStorage } from "node:async_hooks";

export type LlmProvider = "nvidia" | "deepseek" | "openai" | "anthropic" | "gemini";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmRequestOptions = {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
  messages: LlmMessage[];
};

type LlmRequestContext = {
  provider?: LlmProvider;
  model?: string;
};

type ProviderConfig = {
  provider: LlmProvider;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  model: string;
};

type ChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const defaultNvidiaBaseUrl = "https://integrate.api.nvidia.com/v1";
const defaultNvidiaModel = "meta/llama-3.1-8b-instruct";
const defaultDeepSeekBaseUrl = "https://api.deepseek.com";
const defaultDeepSeekModel = "deepseek-chat";
const defaultGeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
const defaultGeminiModel = "gemini-flash-latest";
const deepSeekModelAliases: Record<string, string> = {
  "deepseek-v3": "deepseek-chat",
  "deepseek-v4-flash": "deepseek-chat",
  "deepseek-v4-pro": "deepseek-chat",
  "deepseek v3": "deepseek-chat",
  "deepseek v4 flash": "deepseek-chat",
  "deepseek v4 pro": "deepseek-chat",
};

const requestContext = new AsyncLocalStorage<LlmRequestContext>();

export function runWithLlmContext<T>(context: LlmRequestContext, callback: () => T): T {
  return requestContext.run(context, callback);
}

export function normalizeProvider(value: string | undefined): LlmProvider | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "claude") {
    return "anthropic";
  }

  if (
    normalized === "nvidia" ||
    normalized === "deepseek" ||
    normalized === "openai" ||
    normalized === "anthropic" ||
    normalized === "gemini" ||
    normalized === "google" ||
    normalized === "google-gemini"
  ) {
    if (normalized === "google" || normalized === "google-gemini") {
      return "gemini";
    }
    return normalized;
  }

  return undefined;
}

export function hasConfiguredLlmApiKey(): boolean {
  return Boolean(getProviderConfig().apiKey);
}

export function getActiveLlmInfo(): {
  provider: LlmProvider;
  providerName: string;
  model: string;
  apiKeyLoaded: boolean;
} {
  const config = getProviderConfig();
  return {
    provider: config.provider,
    providerName: config.displayName,
    model: config.model,
    apiKeyLoaded: Boolean(config.apiKey),
  };
}

export async function callChatCompletion(options: LlmRequestOptions): Promise<{
  content: string;
  provider: LlmProvider;
  model: string;
  baseUrl: string;
}> {
  const config = getProviderConfig();
  if (!config.apiKey) {
    throw new Error(`${config.displayName} API key is not configured.`);
  }

  if (config.provider === "gemini") {
    return callGeminiCompletion(config, options);
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 500,
      ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
      messages: options.messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[llm] ${config.displayName} API error`, response.status, errorText);
    throw new Error(`${config.displayName} API error: ${response.status}`);
  }

  const data = (await response.json()) as ChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${config.displayName} response did not include message content.`);
  }

  return {
    content,
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
  };
}

async function callGeminiCompletion(
  config: ProviderConfig,
  options: LlmRequestOptions,
): Promise<{
  content: string;
  provider: LlmProvider;
  model: string;
  baseUrl: string;
}> {
  const systemText = options.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n")
    .trim();
  const contents = options.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/models/${config.model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents: contents.length ? contents : [{ role: "user", parts: [{ text: "" }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 500,
        ...(options.responseFormat?.type === "json_object" ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[llm] ${config.displayName} API error`, response.status, errorText);
    throw new Error(`${config.displayName} API error: ${response.status}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!content) {
    throw new Error(`${config.displayName} response did not include message content.`);
  }

  return {
    content,
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
  };
}

function getProviderConfig(): ProviderConfig {
  const context = requestContext.getStore();
  const provider =
    context?.provider ||
    normalizeProvider(process.env.DEFAULT_LLM_PROVIDER) ||
    normalizeProvider(process.env.LLM_PROVIDER) ||
    "nvidia";

  if (provider === "deepseek") {
    const requestedModel = context?.model || process.env.DEEPSEEK_MODEL || defaultDeepSeekModel;
    return {
      provider,
      displayName: "DeepSeek",
      apiKey: process.env.DEEPSEEK_API_KEY?.trim() || "",
      baseUrl: process.env.DEEPSEEK_BASE_URL?.trim() || defaultDeepSeekBaseUrl,
      model: normalizeProviderModel(provider, requestedModel),
    };
  }

  if (provider === "openai") {
    return {
      provider,
      displayName: "OpenAI",
      apiKey: process.env.OPENAI_API_KEY?.trim() || "",
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      model: context?.model || process.env.OPENAI_MODEL || "gpt-4o-mini",
    };
  }

  if (provider === "anthropic") {
    return {
      provider,
      displayName: "Anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim() || "",
      baseUrl: process.env.ANTHROPIC_BASE_URL?.trim() || process.env.CLAUDE_BASE_URL?.trim() || "https://api.anthropic.com/v1",
      model: context?.model || process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || "claude-3-5-sonnet-latest",
    };
  }

  if (provider === "gemini") {
    return {
      provider,
      displayName: "Google Gemini",
      apiKey: process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GEMINI_API_KEY?.trim() || "",
      baseUrl: process.env.GEMINI_BASE_URL?.trim() || process.env.GOOGLE_GEMINI_BASE_URL?.trim() || defaultGeminiBaseUrl,
      model: context?.model || process.env.GEMINI_MODEL || process.env.GOOGLE_GEMINI_MODEL || defaultGeminiModel,
    };
  }

  return {
    provider: "nvidia",
    displayName: "NVIDIA",
    apiKey: process.env.NVIDIA_API_KEY?.trim() || "",
    baseUrl: process.env.NVIDIA_BASE_URL || defaultNvidiaBaseUrl,
    model: context?.model || process.env.NVIDIA_MODEL || defaultNvidiaModel,
  };
}

function normalizeProviderModel(provider: LlmProvider, model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return provider === "deepseek" ? defaultDeepSeekModel : model;
  }

  if (provider !== "deepseek") {
    return trimmed;
  }

  return deepSeekModelAliases[trimmed.toLowerCase()] || trimmed;
}
