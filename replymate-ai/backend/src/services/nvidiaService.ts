import { GenerateRepliesInput } from "../schemas/replySchemas";
import { getMockReplies, getMockRewrites } from "../utils/mockReplies";
import { parseRepliesFromModel } from "../utils/parseReplies";
import { hasNvidiaApiKey } from "../utils/env";

type NvidiaChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const defaultBaseUrl = "https://integrate.api.nvidia.com/v1";
const defaultModel = "meta/llama-3.1-8b-instruct";

export async function generateReplies(input: GenerateRepliesInput): Promise<string[]> {
  return generateWithNvidia({
    input,
    mockFallback: getMockReplies,
    logLabel: "replies",
    systemPrompt:
      'You are ReplyMate AI. Generate exactly 5 natural reply suggestions for the user\'s message. Match the selected tone. Keep replies concise, human, and useful. Return only valid JSON in this format: { "replies": ["...", "...", "...", "...", "..."] }',
    userPrompt: `Original message:\n${input.message}\n\nSelected tone: ${input.tone}`,
  });
}

export async function rewriteMessage(input: GenerateRepliesInput): Promise<string[]> {
  return generateWithNvidia({
    input,
    mockFallback: getMockRewrites,
    logLabel: "rewrites",
    systemPrompt:
      'You are ReplyMate AI. Rewrite the user\'s own message in exactly 5 different versions. Match the selected writing style or language. Preserve the original meaning. Do not write replies to the message. Keep each version concise, natural, and ready to send. Return only valid JSON in this format: { "replies": ["...", "...", "...", "...", "..."] }',
    userPrompt: `Message to rewrite:\n${input.message}\n\nSelected writing style: ${input.tone}`,
  });
}

async function generateWithNvidia({
  input,
  mockFallback,
  logLabel,
  systemPrompt,
  userPrompt,
}: {
  input: GenerateRepliesInput;
  mockFallback: (input: GenerateRepliesInput) => string[];
  logLabel: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<string[]> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const model = process.env.NVIDIA_MODEL || defaultModel;
  const baseUrl = process.env.NVIDIA_BASE_URL || defaultBaseUrl;

  if (!hasNvidiaApiKey()) {
    console.log(`[nvidia] NVIDIA_API_KEY missing. Returning mock ${logLabel}.`);
    return mockFallback(input);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[nvidia] API error", response.status, errorText);
    throw new Error(`NVIDIA API error: ${response.status}`);
  }

  const data = (await response.json()) as NvidiaChatResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("NVIDIA response did not include message content.");
  }

  const replies = parseRepliesFromModel(content);

  if (replies.length !== 5) {
    throw new Error("Model response did not contain exactly 5 valid replies.");
  }

  return replies;
}
