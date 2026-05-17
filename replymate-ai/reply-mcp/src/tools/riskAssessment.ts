import { z } from "zod";
import { callNvidiaJson } from "../services/nvidiaService.js";
import { clampConfidence } from "../utils/confidence.js";

const outputSchema = z.object({
  riskLevel: z.enum(["low", "medium", "high"]),
  risks: z.array(z.string()),
  recommendedHandling: z.string(),
  confidence: z.number(),
  source: z.enum(["static", "llm", "fallback"]),
});

const riskSchema = z.object({
  message: z.string().min(1),
  intent: z.string().min(1),
  emotion: z.string().min(1),
  relationshipContext: z.string().min(1),
});

export async function riskAssessment(input: unknown): Promise<z.infer<typeof outputSchema>> {
  const parsedInput = riskSchema.safeParse(input);
  if (!parsedInput.success) {
    return fallbackResult();
  }

  const staticResult = assessStatic(
    parsedInput.data.message,
    parsedInput.data.intent,
    parsedInput.data.emotion,
    parsedInput.data.relationshipContext,
  );
  if (staticResult.confidence >= 0.75) {
    return staticResult;
  }

  return callNvidiaJson({
    systemPrompt:
      'Assess reply risk. Return only JSON: {"riskLevel":"low|medium|high","risks":["..."],"recommendedHandling":"short user-safe guidance","confidence":0-1,"source":"llm"}',
    userPrompt: JSON.stringify({ ...parsedInput.data, task: "riskAssessment" }),
    schema: outputSchema,
    fallback: () => ({ ...staticResult, source: "fallback", confidence: Math.min(staticResult.confidence, 0.45) }),
  });
}

function assessStatic(message: string, intent: string, emotion: string, relationshipContext: string): z.infer<typeof outputSchema> {
  const combo = `${intent}:${emotion}:${relationshipContext}`.toLowerCase();
  const urgent = /urgent|asap|immediately/i.test(message);

  if (
    combo.includes("complaint:angry:client") ||
    combo.includes("complaint:angry:customer") ||
    combo.includes("complaint:angry:boss") ||
    combo.includes("professional:urgent:boss") ||
    combo.includes("professional:urgent:client") ||
    combo.includes("professional:urgent:customer")
  ) {
    return {
      riskLevel: "high",
      risks: ["Escalation risk", "Defensive wording risk", "Professional tone risk"],
      recommendedHandling: "Respond calmly, acknowledge the concern, and avoid defensiveness.",
      confidence: clampConfidence(0.9),
      source: "static",
    };
  }

  if (
    combo.includes("romantic:sad:wife") ||
    combo.includes("romantic:angry:wife") ||
    combo.includes("casual:angry:friend") ||
    urgent
  ) {
    return {
      riskLevel: "medium",
      risks: ["Tone mismatch risk", "Emotional sensitivity"],
      recommendedHandling: "Keep the response careful, supportive, and short.",
      confidence: clampConfidence(0.8),
      source: "static",
    };
  }

  if (combo.includes("casual:happy:friend")) {
    return {
      riskLevel: "low",
      risks: ["Minor tone mismatch"],
      recommendedHandling: "A simple friendly reply is enough.",
      confidence: clampConfidence(0.85),
      source: "static",
    };
  }

  return fallbackResult();
}

function fallbackResult(): z.infer<typeof outputSchema> {
  return {
    riskLevel: "medium",
    risks: ["Context unclear"],
    recommendedHandling: "Use a balanced response and review the final wording.",
    confidence: 0.35,
    source: "fallback",
  };
}

