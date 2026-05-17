import { z } from "zod";
import { emotionRules } from "../static/emotionRules.js";
import { callNvidiaJson } from "../services/nvidiaService.js";
import { clampConfidence } from "../utils/confidence.js";

const outputSchema = z.object({
  emotion: z.enum([
    "angry",
    "sad",
    "happy",
    "neutral",
    "urgent",
    "disappointed",
    "excited",
    "confused",
    "anxious",
    "sarcastic",
  ]),
  confidence: z.number(),
  reason: z.string(),
  source: z.enum(["static", "llm", "fallback"]),
});

const emotionSchema = z.object({
  message: z.string().min(1),
});

export async function detectEmotion(input: unknown): Promise<z.infer<typeof outputSchema>> {
  const parsedInput = emotionSchema.safeParse(input);
  if (!parsedInput.success) {
    return fallbackResult();
  }

  const staticResult = detectStatic(parsedInput.data.message);
  if (staticResult.confidence >= 0.7) {
    return staticResult;
  }

  return callNvidiaJson({
    systemPrompt:
      'Detect the message emotion. Return only JSON: {"emotion":"angry|sad|happy|neutral|urgent|disappointed|excited|confused|anxious|sarcastic","confidence":0-1,"reason":"short user-safe reason","source":"llm"}',
    userPrompt: JSON.stringify({ message: parsedInput.data.message, task: "detectEmotion" }),
    schema: outputSchema,
    fallback: () => ({ ...staticResult, source: "fallback", confidence: Math.min(staticResult.confidence, 0.45) }),
  });
}

function detectStatic(message: string): z.infer<typeof outputSchema> {
  const lowered = message.toLowerCase();
  const punctuationBoost = /!{2,}/.test(message) ? 0.1 : 0;
  const capsBoost = /[A-Z]{4,}/.test(message) ? 0.05 : 0;

  const scored = Object.entries(emotionRules).map(([emotion, keywords]) => {
    const hits = keywords.filter((needle) => lowered.includes(needle)).length;
    return { emotion, hits };
  });

  const best = scored.sort((left, right) => right.hits - left.hits)[0];
  if (!best || best.hits === 0) {
    return fallbackResult();
  }

  const confidence = clampConfidence(Math.min(0.95, 0.72 + best.hits * 0.08 + punctuationBoost + capsBoost));

  return {
    emotion: best.emotion as z.infer<typeof outputSchema>["emotion"],
    confidence,
    reason: `Static emotional signal for ${best.emotion}.`,
    source: "static",
  };
}

function fallbackResult(): z.infer<typeof outputSchema> {
  return {
    emotion: "neutral",
    confidence: 0.32,
    reason: "No strong emotional signal detected.",
    source: "fallback",
  };
}

