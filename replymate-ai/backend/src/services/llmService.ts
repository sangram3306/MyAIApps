import { AsyncLocalStorage } from "node:async_hooks";

export type LlmProvider = "nvidia" | "deepseek" | "openai" | "anthropic" | "gemini" | "openrouter";

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
  reasoningEnabled?: boolean;
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
    finishReason?: string;
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  modelVersion?: string;
};

type OpenRouterResponse = ChatResponse;

const defaultNvidiaBaseUrl = "https://integrate.api.nvidia.com/v1";
const defaultNvidiaModel = "meta/llama-3.1-8b-instruct";
const defaultDeepSeekBaseUrl = "https://api.deepseek.com";
const defaultDeepSeekModel = "deepseek-chat";
const defaultGeminiBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
const defaultGeminiModel = "gemini-flash-latest";
const defaultOpenRouterBaseUrl = "https://openrouter.ai/api/v1";
const defaultOpenRouterModel = "openai/gpt-oss-120b:free";
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
    normalized === "openrouter" ||
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

  if (config.provider === "openrouter") {
    return callOpenRouterCompletion(config, options, requestContext.getStore()?.reasoningEnabled === true);
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
  const baseRequest = {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents: contents.length ? contents : [{ role: "user", parts: [{ text: "" }] }],
  };
  const initialMaxOutputTokens = getGeminiMaxOutputTokens(config.model, options.maxTokens);

  let data = await fetchGeminiCompletion(config, options, baseRequest, initialMaxOutputTokens);
  if (data.candidates?.[0]?.finishReason === "MAX_TOKENS") {
    console.warn(`[llm] ${config.displayName} retrying after MAX_TOKENS`, {
      model: config.model,
      modelVersion: data.modelVersion,
      usage: data.usageMetadata,
    });
    data = await fetchGeminiCompletion(config, options, baseRequest, Math.max(initialMaxOutputTokens * 2, 8192));
  }

  const finishReason = data.candidates?.[0]?.finishReason;
  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (finishReason === "MAX_TOKENS") {
    console.error(`[llm] ${config.displayName} response hit max tokens`, {
      model: config.model,
      modelVersion: data.modelVersion,
      usage: data.usageMetadata,
      contentPreview: content?.slice(0, 120),
    });
    throw new Error(`${config.displayName} response hit the output token limit.`);
  }
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

async function fetchGeminiCompletion(
  config: ProviderConfig,
  options: LlmRequestOptions,
  baseRequest: {
    systemInstruction?: { parts: Array<{ text: string }> };
    contents: Array<{ role: string; parts: Array<{ text: string }> }>;
  },
  maxOutputTokens: number,
): Promise<GeminiResponse> {
  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/models/${config.model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": config.apiKey,
    },
    body: JSON.stringify({
      ...baseRequest,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens,
        ...getGeminiThinkingConfig(config.model),
        ...(options.responseFormat?.type === "json_object" ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[llm] ${config.displayName} API error`, response.status, errorText);
    throw new Error(`${config.displayName} API error: ${response.status}`);
  }

  return (await response.json()) as GeminiResponse;
}

async function callOpenRouterCompletion(
  config: ProviderConfig,
  options: LlmRequestOptions,
  reasoningEnabled: boolean,
): Promise<{
  content: string;
  provider: LlmProvider;
  model: string;
  baseUrl: string;
}> {
  const payload: Record<string, unknown> = {
    model: config.model,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 500,
    ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
    messages: options.messages,
  };

  if (reasoningEnabled) {
    payload.reasoning = { enabled: true };
  }

  const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.OPENROUTER_HTTP_REFERER?.trim()
        ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER.trim() }
        : {}),
      ...(process.env.OPENROUTER_APP_TITLE?.trim()
        ? { "X-Title": process.env.OPENROUTER_APP_TITLE.trim() }
        : {}),
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[llm] ${config.displayName} API error`, response.status, errorText);
    throw new Error(`${config.displayName} API error: ${response.status}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
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

function getGeminiThinkingConfig(model: string): { thinkingConfig?: { thinkingBudget: number } } {
  const normalized = model.trim().toLowerCase();
  if (normalized.includes("gemini-2.5-flash") || normalized === "gemini-flash-latest") {
    return {
      thinkingConfig: {
        thinkingBudget: 0,
      },
    };
  }

  return {};
}

function getGeminiMaxOutputTokens(model: string, requestedMaxTokens: number | undefined): number {
  const normalized = model.trim().toLowerCase();
  const requested = requestedMaxTokens ?? 500;
  if (normalized === "gemini-flash-latest") {
    return Math.max(requested, 4096);
  }
  if (normalized.includes("gemini-2.5-flash")) {
    return Math.max(requested, 2048);
  }
  return Math.max(requested, 1200);
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

  if (provider === "openrouter") {
    return {
      provider,
      displayName: "OpenRouter",
      apiKey: process.env.OPENROUTER_API_KEY?.trim() || "",
      baseUrl: process.env.OPENROUTER_BASE_URL?.trim() || defaultOpenRouterBaseUrl,
      model: context?.model || process.env.OPENROUTER_MODEL || defaultOpenRouterModel,
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
