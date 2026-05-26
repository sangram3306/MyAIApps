import { Router } from "express";
import { getActiveLlmInfo } from "../services/llmService";

const router = Router();

router.get("/llm-options", (_req, res) => {
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

export default router;
