import { z } from "zod";
import { relationshipRulesData } from "../static/relationshipRulesData.js";
import { callNvidiaJson } from "../services/nvidiaService.js";
import { clampConfidence } from "../utils/confidence.js";

const outputSchema = z.object({
  styleRules: z.array(z.string()),
  avoid: z.array(z.string()),
  recommendedFormality: z.enum(["casual", "balanced", "formal"]),
  confidence: z.number(),
  source: z.enum(["static", "llm", "fallback"]),
});

const relationshipSchema = z.object({
  relationshipContext: z.string().min(1),
  message: z.string().min(1),
});

export async function relationshipRules(input: unknown): Promise<z.infer<typeof outputSchema>> {
  const parsedInput = relationshipSchema.safeParse(input);
  if (!parsedInput.success) {
    return fallbackResult();
  }

  const staticResult = getStaticRules(parsedInput.data.relationshipContext);
  if (staticResult.confidence >= 0.8) {
    return staticResult;
  }

  return callNvidiaJson({
    systemPrompt:
      'Recommend relationship style rules. Return only JSON: {"styleRules":["..."],"avoid":["..."],"recommendedFormality":"casual|balanced|formal","confidence":0-1,"source":"llm"}',
    userPrompt: JSON.stringify({
      relationshipContext: parsedInput.data.relationshipContext,
      message: parsedInput.data.message,
      task: "relationshipRules",
    }),
    schema: outputSchema,
    fallback: () => ({ ...staticResult, source: "fallback", confidence: Math.min(staticResult.confidence, 0.45) }),
  });
}

function getStaticRules(context: string): z.infer<typeof outputSchema> {
  const rules = relationshipRulesData[context as keyof typeof relationshipRulesData];
  if (!rules) {
    return fallbackResult();
  }

  return {
    styleRules: rules.styleRules,
    avoid: rules.avoid,
    recommendedFormality: rules.recommendedFormality,
    confidence: clampConfidence(0.92),
    source: "static",
  };
}

function fallbackResult(): z.infer<typeof outputSchema> {
  return {
    styleRules: ["Be respectful", "Keep it simple", "Match the other person's tone"],
    avoid: ["Sound harsh", "Sound fake", "Overcomplicate the reply"],
    recommendedFormality: "balanced",
    confidence: 0.35,
    source: "fallback",
  };
}

