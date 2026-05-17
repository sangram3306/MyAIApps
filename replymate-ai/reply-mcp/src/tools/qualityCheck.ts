import { z } from "zod";
import { qualityRules } from "../static/qualityRules.js";
import { callNvidiaJson } from "../services/nvidiaService.js";
import { clampConfidence } from "../utils/confidence.js";

const outputSchema = z.object({
  passed: z.boolean(),
  score: z.number(),
  issues: z.array(z.string()),
  improvedReply: z.string(),
  confidence: z.number(),
  source: z.enum(["static", "llm", "fallback"]),
});

const qualitySchema = z.object({
  message: z.string().min(1),
  recommendedReply: z.string().min(1),
  relationshipContext: z.string().min(1),
  intent: z.string().min(1),
  emotion: z.string().min(1),
});

export async function qualityCheck(input: unknown): Promise<z.infer<typeof outputSchema>> {
  const parsedInput = qualitySchema.safeParse(input);
  if (!parsedInput.success) {
    return fallbackResult();
  }

  const staticResult = evaluateStatic(parsedInput.data);
  if (staticResult.score >= 0.85 || staticResult.score <= 0.55) {
    return staticResult;
  }

  return callNvidiaJson({
    systemPrompt:
      'Evaluate the reply quality. Return only JSON: {"passed":true,"score":0-1,"issues":["..."],"improvedReply":"string","confidence":0-1,"source":"llm"}',
    userPrompt: JSON.stringify({ ...parsedInput.data, task: "qualityCheck" }),
    schema: outputSchema,
    fallback: () => ({ ...staticResult, source: "fallback", confidence: Math.min(staticResult.confidence, 0.45) }),
  });
}

function evaluateStatic(input: z.infer<typeof qualitySchema>): z.infer<typeof outputSchema> {
  const issues: string[] = [];
  const reply = input.recommendedReply.trim();
  const lowered = reply.toLowerCase();
  const formalContext = input.relationshipContext === "Boss" || input.relationshipContext === "Client" || input.relationshipContext === "Customer";
  let score = 1;

  if (reply.length > 260) {
    issues.push("Reply is too long");
    score -= 0.2;
  }

  if (qualityRules.rudeTerms.some((term) => includesPhrase(lowered, term))) {
    issues.push("Reply sounds rude");
    score -= 0.3;
  }

  if (qualityRules.defensiveTerms.some((term) => includesPhrase(lowered, term))) {
    issues.push("Reply sounds defensive");
    score -= 0.25;
  }

  if (qualityRules.blameTerms.some((term) => includesPhrase(lowered, term))) {
    issues.push("Reply blames others");
    score -= 0.25;
  }

  if (formalContext && qualityRules.slangForFormal.some((term) => includesPhrase(lowered, term))) {
    issues.push("Reply uses casual slang in a formal context");
    score -= 0.25;
  }

  if (input.emotion === "angry" || input.emotion === "sad" || input.emotion === "disappointed") {
    if (!/(understand|sorry|hear|acknowledge|get it|i know)/i.test(reply)) {
      issues.push("Reply does not acknowledge the emotion");
      score -= 0.2;
    }
  }

  if ((input.intent === "request" || input.intent === "follow_up" || input.intent === "professional") && !/(let me|i will|i'll|next step|can do|will handle|get back)/i.test(reply)) {
    issues.push("Reply does not include a next step");
    score -= 0.15;
  }

  const finalScore = clampConfidence(score);
  const passed = finalScore >= 0.75 && issues.length === 0;

  return {
    passed,
    score: finalScore,
    issues,
    improvedReply: passed ? reply : suggestImprovement(reply, input.relationshipContext),
    confidence: finalScore >= 0.8 ? 0.9 : 0.7,
    source: "static",
  };
}

function includesPhrase(value: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(value);
}

function suggestImprovement(reply: string, relationshipContext: string): string {
  if (relationshipContext === "Boss" || relationshipContext === "Client" || relationshipContext === "Customer") {
    return `Thanks for the update. ${reply.replace(/\s+/g, " ").trim()}`;
  }

  return reply;
}

function fallbackResult(): z.infer<typeof outputSchema> {
  return {
    passed: false,
    score: 0.4,
    issues: ["Could not evaluate reply quality"],
    improvedReply: "Thanks for the message. I'll get back to you shortly.",
    confidence: 0.3,
    source: "fallback",
  };
}
