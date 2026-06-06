import { Router } from "express";
import { getActiveLlmInfo } from "../services/llmService";

const router = Router();

type OpenRouterModel = {
  id?: string;
  name?: string;
  supported_parameters?: string[];
};

type DeepSeekBalanceResponse = {
  is_available?: boolean;
  balance_infos?: Array<{
    currency?: string;
    total_balance?: string;
    granted_balance?: string;
    topped_up_balance?: string;
  }>;
};

router.get("/llm-options", async (_req, res) => {
  let openrouterProvider = {
    id: "openrouter" as const,
    label: "OpenRouter",
    enabled: false,
    models: [] as Array<{
      label: string;
      value: string;
      reasoningSupported: boolean;
    }>,
  };

  try {
    openrouterProvider = await getOpenRouterProvider();
  } catch (error) {
    console.error("[settings] OpenRouter model fetch error", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  res.json({
    active: getActiveLlmInfo(),
    providers: [
      {
        id: "nvidia",
        label: "NVIDIA",
        enabled: true,
        models: [
          {
            label: "Llama 3.1 8B Instruct",
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
      openrouterProvider,
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
    ],
  });
});

router.get("/deepseek-balance", handleDeepSeekBalance);
router.get("/deepseek-usage", handleDeepSeekBalance);
router.get("/usage", handleDeepSeekBalance);

async function handleDeepSeekBalance(_req: unknown, res: {
  status(code: number): { json(payload: unknown): void };
  json(payload: unknown): void;
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  const baseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com";

  if (!apiKey) {
    return res.status(503).json({
      error: "DeepSeek API key is not configured on the backend.",
    });
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/user/balance`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return res.status(response.status >= 500 ? 502 : response.status).json({
        error: "Could not fetch DeepSeek usage right now.",
      });
    }

    const data = (await response.json()) as DeepSeekBalanceResponse;
    return res.json({
      isAvailable: Boolean(data.is_available),
      balances: (data.balance_infos || []).map((item) => ({
        currency: item.currency || "unknown",
        totalBalance: item.total_balance || "0",
        grantedBalance: item.granted_balance || "0",
        toppedUpBalance: item.topped_up_balance || "0",
      })),
    });
  } catch (error) {
    console.error("[settings] DeepSeek balance error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return res.status(502).json({
      error: "Could not reach DeepSeek usage API.",
    });
  }
}

async function getOpenRouterProvider(): Promise<{
  id: "openrouter";
  label: string;
  enabled: boolean;
  models: Array<{
    label: string;
    value: string;
    reasoningSupported: boolean;
  }>;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const baseUrl = process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";

  if (!apiKey) {
    return {
      id: "openrouter",
      label: "OpenRouter",
      enabled: false,
      models: [],
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter model lookup failed: ${response.status}`);
  }

  const data = (await response.json()) as { data?: OpenRouterModel[] };
  const models = (data.data || [])
    .filter((model) => typeof model.id === "string" && model.id.includes(":free"))
    .map((model) => ({
      label: model.name?.trim() || model.id!.trim(),
      value: model.id!.trim(),
      reasoningSupported: Boolean(
        model.supported_parameters?.some((parameter) => {
          const normalized = parameter.trim().toLowerCase();
          return normalized === "reasoning" || normalized === "include_reasoning";
        }),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    id: "openrouter",
    label: "OpenRouter",
    enabled: models.length > 0,
    models,
  };
}

export default router;
