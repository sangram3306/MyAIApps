export type LlmProviderId = "nvidia" | "deepseek" | "openai" | "anthropic";

export type LlmModelOption = {
  label: string;
  value: string;
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
};
