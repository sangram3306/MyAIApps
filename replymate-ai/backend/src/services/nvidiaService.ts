import { GenerateRepliesInput } from "../schemas/replySchemas";
import { getMockGrammarFixes, getMockReplies, getMockRewrites } from "../utils/mockReplies";
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
      'You are TupuChat. Generate exactly 5 natural reply suggestions for the user\'s message. Match the selected tone and persona role if provided. Keep replies concise, human, and useful. If a role is selected, make the flavor recognizable but not offensive, unsafe, or extreme. Return only valid JSON in this format: { "replies": ["...", "...", "...", "...", "..."] }',
    userPrompt: `Original message:\n${input.message}\n\nSelected tone: ${getTonePrompt(input.tone)}\nSelected role/persona: ${getRolePrompt(input.role)}`,
  });
}

export async function rewriteMessage(input: GenerateRepliesInput): Promise<string[]> {
  return generateWithNvidia({
    input,
    mockFallback: getMockRewrites,
    logLabel: "rewrites",
    systemPrompt:
      'You are TupuChat. Rewrite the user\'s own message in exactly 5 different versions. Match the selected writing style or language and persona role if provided. Preserve the original meaning. Do not write replies to the message. Keep each version concise, natural, and ready to send. If a role is selected, make the flavor recognizable but not offensive, unsafe, or extreme. Return only valid JSON in this format: { "replies": ["...", "...", "...", "...", "..."] }',
    userPrompt: `Message to rewrite:\n${input.message}\n\nSelected writing style: ${getTonePrompt(input.tone)}\nSelected role/persona: ${getRolePrompt(input.role)}`,
  });
}

function getTonePrompt(tone?: string): string {
  if (!tone || tone === "none") {
    return "none";
  }

  return tone;
}

function getRolePrompt(role?: string): string {
  if (!role || role === "none") {
    return "none";
  }

  const labels: Record<string, string> = {
    comedian: "comedian - playful, witty, light humor",
    thief: "sneaky fictional thief - cheeky and mischievous, no real criminal instructions",
    kid: "kid - simple, innocent, playful wording",
    engineer: "engineer - clear, logical, precise wording",
    cowboy: "cowboy - warm western slang, friendly and rugged",
    superhero: "superhero - confident, brave, uplifting wording",
    police: "police officer - firm, respectful, direct wording",
    teacher: "teacher - clear, patient, helpful wording",
  };

  return labels[role] || role;
}

export async function fixGrammar(input: GenerateRepliesInput): Promise<string[]> {
  return generateWithNvidia({
    input,
    mockFallback: getMockGrammarFixes,
    logLabel: "grammar fixes",
    systemPrompt:
      'You are TupuChat. Fix grammar, spelling, punctuation, capitalization, and clarity in the user\'s message. Preserve the original meaning and do not add new information. Return exactly 5 corrected versions, from minimal correction to slightly more polished. Return only valid JSON in this format: { "replies": ["...", "...", "...", "...", "..."] }',
    userPrompt: `Message to fix:\n${input.message}`,
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
