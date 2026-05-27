import { GenerateRepliesInput } from "../schemas/replySchemas";
import { CoachDraftInput } from "../agents/replyCoachTypes";
import { getMockGrammarFixes, getMockReplies, getMockRewrites } from "../utils/mockReplies";
import { parseRepliesFromModel } from "../utils/parseReplies";
import { callChatCompletion, hasConfiguredLlmApiKey } from "./llmService";

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

  if (tone === "short_sweet") {
    return "short and sweet";
  }

  const labels: Record<string, string> = {
    simple_english: "simple English",
    hinglish: "Hinglish - natural Hindi-English mix, chatty and easy to read",
    hindi: "Hindi - natural Hindi, clean and easy to understand",
    more_human: "more human and natural",
    snarky: "snarky - dry, witty, mildly sarcastic, but not mean or insulting",
  };

  if (labels[tone]) {
    return labels[tone];
  }

  return tone;
}

function getRolePrompt(role?: string): string {
  if (!role || role === "none") {
    return "none";
  }

  const labels: Record<string, string> = {
    friend: "friend - warm, natural, familiar",
    best_friend: "best friend - very close, casual, supportive",
    partner: "romantic partner - caring and emotionally warm",
    customer_support: "customer support - helpful, patient, service-oriented",
    manager: "manager - clear, professional, decisive",
    professional_writer: "professional writer - polished, concise, expressive",
    sales_expert: "sales expert - persuasive, benefit-focused, confident",
    marketing_expert: "marketing expert - punchy, engaging, audience-aware",
    influencer: "influencer - trendy, relatable, social-media friendly",
    startup_founder: "startup founder - direct, ambitious, high-energy",
    comedian: "comedian - playful, witty, light humor",
    savage_friend: "savage friend - teasing, bold, witty, but not cruel",
    poet: "poet - expressive, lyrical, elegant",
    teacher: "teacher - clear, patient, helpful wording",
    pirate: "pirate - playful sea-captain wording, light 'arrr' flavor, still understandable",
    five_year_old: "5 year old kid - innocent, simple, excited, adorably direct",
    doctor: "doctor - calm, reassuring, precise, with a caring bedside manner",
    ai_engineer: "AI engineer - technical, concise, slightly nerdy, explains like debugging a system",
    thief: "movie-style thief - sneaky, playful, harmless heist slang; never encourage real wrongdoing",
    cowboy: "cowboy - western, confident, folksy, warm, with light cowboy flavor",
    astronaut: "astronaut - calm mission-control space explorer style, optimistic and a little cosmic",
    shakespeare: "Shakespeare - dramatic old-English theatrical style, but still easy to understand",
    grandma: "grandma - warm, loving, slightly old-school, comforting",
    lawyer: "lawyer - careful, precise, persuasive, with polished formal phrasing",
    gym_coach: "gym coach - energetic, motivational, direct, hype-person style",
    detective: "detective - observant, mysterious, clue-focused, playful noir style",
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

export async function generateCoachOutput(input: CoachDraftInput): Promise<{
  suggestedTone: string;
  strategy: string;
  doTips: string[];
  dontTips: string[];
  recommendedReply: string;
}> {
  if (!hasConfiguredLlmApiKey()) {
    return {
      suggestedTone: getSuggestedTone(input),
      strategy: getFallbackStrategy(input),
      doTips: getFallbackDoTips(input),
      dontTips: getFallbackDontTips(input),
      recommendedReply: getFallbackReply(input),
    };
  }

  const prompt = buildCoachPrompt(input);
  const completion = await callChatCompletion({
    temperature: 0.4,
    maxTokens: 700,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'You are ReplyMate AI Smart Reply Coach. Return only valid JSON and no markdown. Do not expose chain-of-thought.',
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = completion.content;

  if (!content) {
    throw new Error("Model response did not include coaching content.");
  }

  const parsed = safeParseCoachJson(content);
  if (!parsed) {
    throw new Error("Model response did not contain valid coach JSON.");
  }

  return parsed;
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
  if (!hasConfiguredLlmApiKey()) {
    console.log(`[llm] API key missing. Returning mock ${logLabel}.`);
    return mockFallback(input);
  }

  const completion = await callChatCompletion({
    temperature: 0.7,
    maxTokens: 500,
    responseFormat: { type: "json_object" },
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
  });

  const content = completion.content;

  if (!content) {
    throw new Error("NVIDIA response did not include message content.");
  }

  const replies = parseRepliesFromModel(content);

  if (replies.length < 1) {
    throw new Error("Model response did not contain valid replies.");
  }

  return replies;
}

function buildCoachPrompt(input: CoachDraftInput): string {
  return JSON.stringify({
    task: "Generate a smart reply coaching plan for the user.",
    rules: [
      "Return only valid JSON.",
      "No markdown.",
      "No explanation outside JSON.",
      "Keep tips short and user safe.",
    ],
    input: {
      message: input.message,
      relationshipContext: input.relationshipContext,
      intent: input.intent,
      emotion: input.emotion,
      riskLevel: input.riskLevel,
      styleRules: input.styleRules,
      avoidRules: input.avoidRules,
      recommendedHandling: input.recommendedHandling,
    },
    outputSchema: {
      suggestedTone: "string",
      strategy: "string",
      doTips: ["string", "string", "string"],
      dontTips: ["string", "string", "string"],
      recommendedReply: "string",
    },
  });
}

function safeParseCoachJson(content: string): {
  suggestedTone: string;
  strategy: string;
  doTips: string[];
  dontTips: string[];
  recommendedReply: string;
} | null {
  try {
    const parsed = JSON.parse(content) as Partial<{
      suggestedTone: string;
      strategy: string;
      doTips: unknown;
      dontTips: unknown;
      recommendedReply: string;
    }>;

    if (
      typeof parsed.suggestedTone !== "string" ||
      typeof parsed.strategy !== "string" ||
      typeof parsed.recommendedReply !== "string" ||
      !Array.isArray(parsed.doTips) ||
      !Array.isArray(parsed.dontTips)
    ) {
      return null;
    }

    return {
      suggestedTone: parsed.suggestedTone,
      strategy: parsed.strategy,
      doTips: parsed.doTips.filter((item): item is string => typeof item === "string").slice(0, 3),
      dontTips: parsed.dontTips.filter((item): item is string => typeof item === "string").slice(0, 3),
      recommendedReply: parsed.recommendedReply,
    };
  } catch {
    return null;
  }
}

function getSuggestedTone(input: CoachDraftInput): string {
  if (input.riskLevel === "high") {
    return input.relationshipContext === "Boss" || input.relationshipContext === "Client" || input.relationshipContext === "Customer"
      ? "formal, calm, and professional"
      : "calm, respectful, and careful";
  }

  if (input.intent === "romantic") {
    return "warm and affectionate";
  }

  return input.relationshipContext === "Friend" || input.relationshipContext === "Sibling"
    ? "friendly and natural"
    : "balanced and considerate";
}

function getFallbackStrategy(input: CoachDraftInput): string {
  return `Acknowledge the message, match the tone, and keep the reply aligned to ${input.relationshipContext.toLowerCase()} expectations.`;
}

function getFallbackDoTips(input: CoachDraftInput): string[] {
  return [
    `Keep the reply suited for a ${input.relationshipContext.toLowerCase()} conversation`,
    "Address the main point clearly",
    "End with a simple next step when needed",
  ];
}

function getFallbackDontTips(input: CoachDraftInput): string[] {
  return [
    "Do not sound defensive",
    "Do not add unnecessary detail",
    input.relationshipContext === "Boss" || input.relationshipContext === "Client"
      ? "Do not use casual slang"
      : "Do not ignore the other person's tone",
  ];
}

function getFallbackReply(input: CoachDraftInput): string {
  if (input.riskLevel === "high") {
    return "Thanks for letting me know. I understand your concern, and I want to handle this properly. Let me review it and get back to you shortly.";
  }

  if (input.intent === "apology") {
    return "I understand, and I'm sorry about that. I'll handle it and make sure we move forward the right way.";
  }

  if (input.relationshipContext === "Friend" || input.relationshipContext === "Sibling") {
    return "Got it. Thanks for telling me. I'm on it.";
  }

  return "Thanks for the message. I understand, and I'll keep this moving in the right direction.";
}
