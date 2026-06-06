export type LlmProviderId = "nvidia" | "deepseek" | "openai" | "anthropic" | "gemini" | "openrouter";

export type LlmModelOption = {
  label: string;
  value: string;
  reasoningSupported?: boolean;
};

export type LlmProviderOption = {
  id: LlmProviderId;
  label: string;
  enabled: boolean;
  models: LlmModelOption[];
};

export type LlmPreference = {
  provider: LlmProviderId;
  model: string;
  reasoningEnabled?: boolean;
};

export const llmProviders: LlmProviderOption[] = [
  {
    id: "nvidia",
    label: "NVIDIA",
    enabled: true,
    models: [
      {
        label: "Meta Llama 3.1 8B Instruct",
        value: "meta/llama-3.1-8b-instruct",
      },
    ],
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    enabled: true,
    models: [
      {
        label: "DeepSeek V4 Flash",
        value: "deepseek-v4-flash",
      },
      {
        label: "DeepSeek V3",
        value: "deepseek-chat",
      },
      {
        label: "DeepSeek V4 Pro",
        value: "deepseek-v4-pro",
      },
    ],
  },
  {
    id: "gemini",
    label: "Google Gemini",
    enabled: true,
    models: [
      {
        label: "Gemini 2.5 Flash",
        value: "gemini-2.5-flash",
      },
      {
        label: "Gemini Flash Latest",
        value: "gemini-flash-latest",
      },
      {
        label: "Gemini 2.5 Flash Lite",
        value: "gemini-2.5-flash-lite",
      },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    enabled: true,
    models: [],
  },
  {
    id: "openai",
    label: "OpenAI",
    enabled: false,
    models: [],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    enabled: false,
    models: [],
  },
];

export const defaultLlmPreference: LlmPreference = {
  provider: "nvidia",
  model: "meta/llama-3.1-8b-instruct",
  reasoningEnabled: false,
};
