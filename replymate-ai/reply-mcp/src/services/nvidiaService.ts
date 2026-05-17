import { z } from "zod";
import { safeJsonParse } from "../utils/safeJson.js";
import { error } from "../utils/logger.js";

const defaultBaseUrl = "https://integrate.api.nvidia.com/v1";
const defaultModel = "meta/llama-3.1-8b-instruct";

type NvidiaChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type JsonCallOptions<T> = {
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  fallback: () => T;
};

async function callNvidiaJson<T>(options: JsonCallOptions<T>): Promise<T> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const model = process.env.NVIDIA_MODEL || defaultModel;
  const baseUrl = process.env.NVIDIA_BASE_URL || defaultBaseUrl;

  if (!apiKey) {
    return options.fallback();
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 500,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: options.systemPrompt },
            { role: "user", content: options.userPrompt },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        error("NVIDIA request failed", { status: response.status, body });
        if (attempt === 1) {
          return options.fallback();
        }
        continue;
      }

      const data = (await response.json()) as NvidiaChatResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        if (attempt === 1) {
          return options.fallback();
        }
        continue;
      }

      const parsed = safeJsonParse<unknown>(content);
      const result = options.schema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }

      if (attempt === 1) {
        return options.fallback();
      }
    } catch (caught) {
      error("NVIDIA JSON call failed", { message: caught instanceof Error ? caught.message : "unknown" });
      if (attempt === 1) {
        return options.fallback();
      }
    }
  }

  return options.fallback();
}

export { callNvidiaJson };

