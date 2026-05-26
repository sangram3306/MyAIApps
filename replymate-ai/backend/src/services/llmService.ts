import { AsyncLocalStorage } from "node:async_hooks";

export type LlmProvider = "nvidia" | "deepseek" | "openai" | "anthropic";

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

const defaultNvidiaBaseUrl = "https://integrate.api.nvidia.com/v1";
const defaultNvidiaModel = "meta/llama-3.1-8b-instruct";
const defaultDeepSeekBaseUrl = "https://api.deepseek.com";
const defaultDeepSeekModel = "deepseek-chat";

const requestContext = new AsyncLocalStorage<LlmRequestContext>();

export function runWithLlmContext<T>(context: LlmRequestContext, callback: () => T): T {
  return requestContext.run(context, callback);
}

export function normalizeProvider(value: string | undefined): LlmProvider | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "claude") {
    return "anthropic";
  }

  if (normalized === "nvidia" || normalized === "deepseek" || normalized === "openai" || normalized === "anthropic") {
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

function getProviderConfig(): ProviderConfig {
  const context = requestContext.getStore();
  const provider =
    context?.provider ||
    normalizeProvider(process.env.DEFAULT_LLM_PROVIDER) ||
    normalizeProvider(process.env.LLM_PROVIDER) ||
    "nvidia";

  if (provider === "deepseek") {
    return {
      provider,
      displayName: "DeepSeek",
      apiKey: process.env.DEEPSEEK_API_KEY?.trim() || "",
      baseUrl: process.env.DEEPSEEK_BASE_URL?.trim() || defaultDeepSeekBaseUrl,
      model: context?.model || process.env.DEEPSEEK_MODEL || defaultDeepSeekModel,
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

  return {
    provider: "nvidia",
    displayName: "NVIDIA",
    apiKey: process.env.NVIDIA_API_KEY?.trim() || "",
    baseUrl: process.env.NVIDIA_BASE_URL || defaultNvidiaBaseUrl,
    model: context?.model || process.env.NVIDIA_MODEL || defaultNvidiaModel,
  };
}
