import { GenerateRepliesInput } from "../schemas/replySchemas";
import { CoachDraftInput } from "../agents/replyCoachTypes";
import { CreatorRepurposeInput } from "../schemas/creatorSchemas";
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
      'You are TupuChat. Fix grammar, spelling, punctuation, capitalization, and clarity in the user\'s message. Preserve the original meaning and do not add new information. Return exactly 1 corrected version. Return only valid JSON. The top-level object must have exactly one key named "replies". The "replies" array must contain exactly one string. Do not use keys like corrections, grammarFixes, options, or messages. Format: { "replies": ["..."] }',
    userPrompt: `Message to fix:\n${input.message}\n\nReturn JSON only with this exact shape: { "replies": ["corrected message"] }`,
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

export type ExpenseIntelligenceInput = {
  period: "all" | "month" | "year";
  total: number;
  count: number;
  average: number;
  currency?: "AED" | "INR";
  byCategory: Array<{ category: string; total: number; count: number }>;
  recurringPatterns: string[];
  peakPeriod: string;
  largestExpense?: { amount: number; category: string; description: string; date: string };
  comparedPeriod?: { label: string; total: number; difference: number };
};

export type ExpenseIntelligenceReport = {
  headline: string;
  summary: string;
  highlights: string[];
  opportunities: string[];
  anomalies: string[];
  recurringPatterns: string[];
  forecast: {
    label: string;
    amount: number;
    rationale: string;
  };
};

export async function generateExpenseIntelligence(
  input: ExpenseIntelligenceInput,
): Promise<ExpenseIntelligenceReport> {
  if (!hasConfiguredLlmApiKey()) {
    return buildMockExpenseIntelligence(input);
  }

  const completion = await callChatCompletion({
    temperature: 0.25,
    maxTokens: 700,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are ReplyMate AI Expense Intelligence. Return only valid JSON, no markdown, and no hidden reasoning.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Analyze spending patterns and produce a short practical insight report.",
          input,
          outputSchema: {
            headline: "string",
            summary: "string",
            highlights: ["string"],
            opportunities: ["string"],
            anomalies: ["string"],
            recurringPatterns: ["string"],
            forecast: {
              label: "string",
              amount: "number",
              rationale: "string",
            },
          },
          rules: [
            "Keep the language user-friendly and actionable.",
            "Mention notable spending concentration or budget pressure.",
            "Keep highlights short.",
            "Use the provided recurring patterns only if relevant.",
          ],
        }),
      },
    ],
  });

  const parsed = safeParseExpenseIntelligenceJson(completion.content || "");
  if (!parsed) {
    throw new Error("Model response did not contain valid expense intelligence JSON.");
  }

  return parsed;
}

export type CreatorRepurposeReport = {
  title: string;
  summary: string;
  hook: string;
  platformOutputs: {
    x?: {
      post: string;
      thread: string[];
      hashtags: string[];
    };
    linkedin?: {
      post: string;
      headline: string;
    };
    instagram?: {
      caption: string;
      hashtags: string[];
    };
    email?: {
      subject: string;
      body: string;
    };
    thread?: {
      hook: string;
      posts: string[];
    };
  };
  repurposeTips: string[];
};

export async function generateCreatorRepurpose(input: CreatorRepurposeInput): Promise<CreatorRepurposeReport> {
  if (!hasConfiguredLlmApiKey()) {
    return buildMockCreatorRepurpose(input);
  }

  const completion = await callChatCompletion({
    temperature: 0.45,
    maxTokens: 2200,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are ReplyMate AI Creator Studio. Transform source content into polished platform-ready drafts. Return only valid JSON and no markdown.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Repurpose source content for multiple platforms.",
          input,
          outputSchema: {
            title: "string",
            summary: "string",
            hook: "string",
            platformOutputs: {
              x: { post: "string", thread: ["string"], hashtags: ["string"] },
              linkedin: { post: "string", headline: "string" },
              instagram: { caption: "string", hashtags: ["string"] },
              email: { subject: "string", body: "string" },
              thread: { hook: "string", posts: ["string"] },
            },
            repurposeTips: ["string"],
          },
          rules: [
            "Only include platform sections requested by the input.",
            "Keep copy natural, useful, and ready to publish.",
            "Threads should be concise and numbered logically.",
            "Hashtags should be relevant, not spammy.",
          ],
        }),
      },
    ],
  });

  const parsed = safeParseCreatorJson(completion.content || "");
  if (!parsed) {
    throw new Error("Model response did not contain valid creator JSON.");
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

function safeParseExpenseIntelligenceJson(content: string): ExpenseIntelligenceReport | null {
  try {
    const parsed = JSON.parse(content) as Partial<ExpenseIntelligenceReport>;
    if (
      typeof parsed.headline !== "string" ||
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.highlights) ||
      !Array.isArray(parsed.opportunities) ||
      !Array.isArray(parsed.anomalies) ||
      !Array.isArray(parsed.recurringPatterns) ||
      !parsed.forecast ||
      typeof parsed.forecast.label !== "string" ||
      typeof parsed.forecast.amount !== "number" ||
      typeof parsed.forecast.rationale !== "string"
    ) {
      return null;
    }

    return {
      headline: parsed.headline,
      summary: parsed.summary,
      highlights: parsed.highlights.filter((item): item is string => typeof item === "string"),
      opportunities: parsed.opportunities.filter((item): item is string => typeof item === "string"),
      anomalies: parsed.anomalies.filter((item): item is string => typeof item === "string"),
      recurringPatterns: parsed.recurringPatterns.filter(
        (item): item is string => typeof item === "string",
      ),
      forecast: {
        label: parsed.forecast.label,
        amount: parsed.forecast.amount,
        rationale: parsed.forecast.rationale,
      },
    };
  } catch {
    return null;
  }
}

function safeParseCreatorJson(content: string): CreatorRepurposeReport | null {
  try {
    const parsed = parseJsonObject(content) as Partial<CreatorRepurposeReport> | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const platformOutputs = normalizeCreatorPlatformOutputs(parsed);
    const repurposeTips = normalizeStringArray((parsed as Record<string, unknown>).repurposeTips)
      || normalizeStringArray((parsed as Record<string, unknown>).tips)
      || normalizeStringArray((parsed as Record<string, unknown>).recommendations)
      || [];

    return {
      title: stringOrFallback((parsed as Record<string, unknown>).title, "Repurposed content pack"),
      summary: stringOrFallback((parsed as Record<string, unknown>).summary, "Platform-ready drafts generated from your source content."),
      hook: stringOrFallback((parsed as Record<string, unknown>).hook, "A clear hook for your audience."),
      platformOutputs,
      repurposeTips,
    };
  } catch {
    return null;
  }
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    const candidate = extractJsonObject(trimmed);
    if (!candidate) {
      return null;
    }
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}

function extractJsonObject(text: string): string | null {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  return text.slice(firstBrace, lastBrace + 1);
}

function normalizeCreatorPlatformOutputs(parsed: Record<string, unknown>): CreatorRepurposeReport["platformOutputs"] {
  const source = objectValue(parsed.platformOutputs)
    || objectValue(parsed.platforms)
    || objectValue(parsed.outputs)
    || objectValue(parsed.platform_drafts)
    || parsed;

  return {
    x: normalizeXOutput(objectValue(source.x) || objectValue(source.twitter)),
    linkedin: normalizeLinkedInOutput(objectValue(source.linkedin) || objectValue(source.linkedIn)),
    instagram: normalizeInstagramOutput(objectValue(source.instagram) || objectValue(source.ig)),
    email: normalizeEmailOutput(objectValue(source.email) || objectValue(source.newsletter)),
    thread: normalizeThreadOutput(objectValue(source.thread) || objectValue(source.threads)),
  };
}

function normalizeXOutput(value: Record<string, unknown> | null): CreatorRepurposeReport["platformOutputs"]["x"] {
  if (!value) return undefined;
  const post = stringOrFallback(value.post ?? value.tweet ?? value.text ?? value.content, "");
  const thread = normalizeStringArray(value.thread) || normalizeStringArray(value.posts) || [];
  const hashtags = normalizeStringArray(value.hashtags) || [];
  return post || thread.length || hashtags.length ? { post, thread, hashtags } : undefined;
}

function normalizeLinkedInOutput(value: Record<string, unknown> | null): CreatorRepurposeReport["platformOutputs"]["linkedin"] {
  if (!value) return undefined;
  const post = stringOrFallback(value.post ?? value.text ?? value.content ?? value.body, "");
  const headline = stringOrFallback(value.headline ?? value.title ?? value.hook, "");
  return post || headline ? { post, headline } : undefined;
}

function normalizeInstagramOutput(value: Record<string, unknown> | null): CreatorRepurposeReport["platformOutputs"]["instagram"] {
  if (!value) return undefined;
  const caption = stringOrFallback(value.caption ?? value.post ?? value.text ?? value.content, "");
  const hashtags = normalizeStringArray(value.hashtags) || [];
  return caption || hashtags.length ? { caption, hashtags } : undefined;
}

function normalizeEmailOutput(value: Record<string, unknown> | null): CreatorRepurposeReport["platformOutputs"]["email"] {
  if (!value) return undefined;
  const subject = stringOrFallback(value.subject ?? value.title ?? value.headline, "");
  const body = stringOrFallback(value.body ?? value.email ?? value.text ?? value.content, "");
  return subject || body ? { subject, body } : undefined;
}

function normalizeThreadOutput(value: Record<string, unknown> | null): CreatorRepurposeReport["platformOutputs"]["thread"] {
  if (!value) return undefined;
  const hook = stringOrFallback(value.hook ?? value.title ?? value.opening, "");
  const posts = normalizeStringArray(value.posts) || normalizeStringArray(value.thread) || normalizeStringArray(value.items) || [];
  return hook || posts.length ? { hook, posts } : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringOrFallback(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return stringOrFallback(record.text ?? record.post ?? record.content ?? record.value, "");
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 12);
}

function buildMockExpenseIntelligence(input: ExpenseIntelligenceInput): ExpenseIntelligenceReport {
  const topCategory = input.byCategory[0];
  return {
    headline: `${capitalize(input.period)} spending stays ${input.total > 0 ? "active" : "quiet"}`,
    summary:
      input.count > 0
        ? `You made ${input.count} expense entries totaling ${formatAmountForPrompt(input.total, input.currency)}.`
        : "There is not enough spending data yet to build a trend report.",
    highlights: [
      topCategory
        ? `${topCategory.category} is the top category at ${formatAmountForPrompt(topCategory.total, input.currency)}.`
        : "No category data yet.",
      `Average spend per entry is ${formatAmountForPrompt(input.average, input.currency)}.`,
      input.peakPeriod ? `Peak period: ${input.peakPeriod}.` : "No peak period identified yet.",
    ].filter(Boolean),
    opportunities: [
      input.comparedPeriod
        ? `Compared with ${input.comparedPeriod.label}, spending changed by ${formatAmountForPrompt(
            input.comparedPeriod.difference,
            input.currency,
          )}.`
        : "Compare this period with the previous one to spot drift.",
      "Watch for repeated small purchases that can add up fast.",
    ],
    anomalies: input.largestExpense
      ? [`Largest expense: ${input.largestExpense.description} at ${formatAmountForPrompt(input.largestExpense.amount, input.currency)}.`]
      : ["No clear anomaly yet."],
    recurringPatterns: input.recurringPatterns.length
      ? input.recurringPatterns
      : ["No recurring patterns detected yet."],
    forecast: {
      label: input.period === "year" ? "Next year estimate" : "Next period estimate",
      amount: Math.max(0, Math.round(input.total * 1.05)),
      rationale: "Simple trend projection based on the current period total.",
    },
  };
}

function buildMockCreatorRepurpose(input: CreatorRepurposeInput): CreatorRepurposeReport {
  const base = input.sourceText.slice(0, 120).trim();
  const xPost = `${base}${base.length >= input.sourceText.length ? "" : "..."}\n\n${input.goal}.`;
  return {
    title: `${capitalize(input.goal)} for ${input.audience}`,
    summary: `Repurposed the source into platform-ready drafts for ${input.platforms.join(", ")}.`,
    hook: `Turn ${input.sourceType} into something useful for ${input.audience}.`,
    platformOutputs: {
      x: input.platforms.includes("x")
        ? {
            post: xPost,
            thread: [xPost, "Key point 2", "Key point 3"],
            hashtags: ["#creator", "#content"],
          }
        : undefined,
      linkedin: input.platforms.includes("linkedin")
        ? {
            headline: `${capitalize(input.goal)} with a practical angle`,
            post: `If you're building for ${input.audience}, here is a clearer take:\n\n${base}`,
          }
        : undefined,
      instagram: input.platforms.includes("instagram")
        ? {
            caption: `${base}\n\n${input.goal}`,
            hashtags: ["#contentcreator", "#storytelling"],
          }
        : undefined,
      email: input.platforms.includes("email")
        ? {
            subject: `${capitalize(input.goal)} update`,
            body: `Hi,\n\n${base}\n\nBest,\nReplyMate`,
          }
        : undefined,
      thread: input.platforms.includes("thread")
        ? {
            hook: `${capitalize(input.goal)} thread`,
            posts: [base, "Detail 2", "Detail 3"],
          }
        : undefined,
    },
    repurposeTips: [
      "Start with the strongest angle first.",
      "Shorten the copy before posting on X.",
      "Add one clear CTA for better engagement.",
    ],
  };
}

function formatAmountForPrompt(amount: number, currency?: "AED" | "INR"): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
  return currency ? `${currency} ${formatted}` : formatted;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
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
