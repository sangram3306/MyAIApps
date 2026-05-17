import { z } from "zod";
import { intentOrder, intentRules } from "../static/intentRules.js";
import { callNvidiaJson } from "../services/nvidiaService.js";
import { clampConfidence } from "../utils/confidence.js";

const outputSchema = z.object({
  intent: z.enum([
    "apology",
    "complaint",
    "request",
    "reminder",
    "follow_up",
    "romantic",
    "casual",
    "professional",
    "sales",
    "emotional_support",
    "unknown",
  ]),
  confidence: z.number(),
  reason: z.string(),
  source: z.enum(["static", "llm", "fallback"]),
});

const intentSchema = z.object({
  message: z.string().min(1),
});

export async function classifyIntent(input: unknown): Promise<z.infer<typeof outputSchema>> {
  const parsedInput = intentSchema.safeParse(input);
  if (!parsedInput.success) {
    return fallbackResult();
  }

  const staticResult = classifyStatic(parsedInput.data.message);
  if (staticResult.confidence >= 0.75) {
    return staticResult;
  }

  return callNvidiaJson({
    systemPrompt:
      'Classify the message intent. Return only JSON: {"intent":"apology|complaint|request|reminder|follow_up|romantic|casual|professional|sales|emotional_support|unknown","confidence":0-1,"reason":"short user-safe reason","source":"llm"}',
    userPrompt: JSON.stringify({ message: parsedInput.data.message, task: "classifyIntent" }),
    schema: outputSchema,
    fallback: () => ({ ...staticResult, source: "fallback", confidence: Math.min(staticResult.confidence, 0.45) }),
  });
}

function classifyStatic(message: string): z.infer<typeof outputSchema> {
  const lowered = message.toLowerCase();
  const scores = intentOrder.map((intent) => {
    const hits = intentRules[intent].filter((needle) => lowered.includes(needle)).length;
    return { intent, hits };
  });

  const best = scores.sort((left, right) => right.hits - left.hits)[0];
  if (!best || best.hits === 0) {
    return fallbackResult();
  }

  const confidence = clampConfidence(best.hits >= 2 ? 0.9 : 0.78);

  return {
    intent: best.intent,
    confidence,
    reason: `Static keyword match for ${best.intent}.`,
    source: "static",
  };
}

function fallbackResult(): z.infer<typeof outputSchema> {
  return {
    intent: "unknown",
    confidence: 0.3,
    reason: "No clear intent match.",
    source: "fallback",
  };
}

