import { callMcpTool, McpClientError } from "../mcp/mcpClient";
import { CoachAnalyzeInput } from "../schemas/coachSchemas";
import { CoachDraftInput } from "./replyCoachTypes";
import { generateCoachOutput } from "../services/nvidiaService";

type IntentResult = {
  intent: string;
  confidence: number;
  reason: string;
  source: "static" | "llm" | "fallback";
};

type EmotionResult = {
  emotion: string;
  confidence: number;
  reason: string;
  source: "static" | "llm" | "fallback";
};

type RelationshipRulesResult = {
  styleRules: string[];
  avoid: string[];
  recommendedFormality: "casual" | "balanced" | "formal";
  confidence: number;
  source: "static" | "llm" | "fallback";
};

type RiskAssessmentResult = {
  riskLevel: "low" | "medium" | "high";
  risks: string[];
  recommendedHandling: string;
  confidence: number;
  source: "static" | "llm" | "fallback";
};

type QualityCheckResult = {
  passed: boolean;
  score: number;
  issues: string[];
  improvedReply: string;
  confidence: number;
  source: "static" | "llm" | "fallback";
};

export type CoachAnalyzeResponse = {
  intent: string;
  emotion: string;
  riskLevel: "low" | "medium" | "high";
  suggestedTone: string;
  strategy: string;
  doTips: string[];
  dontTips: string[];
  recommendedReply: string;
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      classifyIntent: "static" | "llm" | "fallback";
      detectEmotion: "static" | "llm" | "fallback";
      relationshipRules: "static" | "llm" | "fallback";
      riskAssessment: "static" | "llm" | "fallback";
      qualityCheck: "static" | "llm" | "fallback";
    };
  };
};

function safeList(values: unknown[], fallback: string[]): string[] {
  const filtered = values.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return filtered.length > 0 ? filtered.slice(0, 3) : fallback;
}

function simplifyFormality(value: string): string {
  return value || "balanced";
}

export async function analyzeWithReplyCoach(input: CoachAnalyzeInput): Promise<CoachAnalyzeResponse> {
  const agentTrace: string[] = [
    "Checked message intent",
    "Detected emotional context",
    "Checked relationship rules",
    "Assessed reply risk",
    "Generated reply strategy",
    "Checked final quality",
  ];

  let intent: IntentResult;
  let emotion: EmotionResult;
  let relationshipRules: RelationshipRulesResult;
  let riskAssessment: RiskAssessmentResult;
  let qualityCheck: QualityCheckResult;

  try {
    intent = await callMcpTool<IntentResult>("classifyIntent", { message: input.message });
    emotion = await callMcpTool<EmotionResult>("detectEmotion", { message: input.message });
    relationshipRules = await callMcpTool<RelationshipRulesResult>("relationshipRules", {
      relationshipContext: input.relationshipContext,
      message: input.message,
    });
    riskAssessment = await callMcpTool<RiskAssessmentResult>("riskAssessment", {
      message: input.message,
      intent: intent.intent,
      emotion: emotion.emotion,
      relationshipContext: input.relationshipContext,
    });
  } catch (error) {
    if (error instanceof McpClientError) {
      throw error;
    }
    throw new McpClientError("Smart Reply Coach could not reach the MCP tools.", 503);
  }

  const coachDraft = await generateCoachOutput({
    message: input.message,
    relationshipContext: input.relationshipContext,
    intent: intent.intent,
    emotion: emotion.emotion,
    riskLevel: riskAssessment.riskLevel,
    styleRules: relationshipRules.styleRules,
    avoidRules: relationshipRules.avoid,
    recommendedHandling: riskAssessment.recommendedHandling,
  });

  qualityCheck = await callMcpTool<QualityCheckResult>("qualityCheck", {
    message: input.message,
    recommendedReply: coachDraft.recommendedReply,
    relationshipContext: input.relationshipContext,
    intent: intent.intent,
    emotion: emotion.emotion,
  });

  const finalReply =
    qualityCheck.passed && qualityCheck.improvedReply.trim()
      ? qualityCheck.improvedReply.trim()
      : coachDraft.recommendedReply.trim();

  return {
    intent: intent.intent,
    emotion: emotion.emotion,
    riskLevel: riskAssessment.riskLevel,
    suggestedTone: coachDraft.suggestedTone,
    strategy: coachDraft.strategy,
    doTips: safeList(coachDraft.doTips, ["Keep it clear", "Stay respectful", "Move the conversation forward"]),
    dontTips: safeList(coachDraft.dontTips, ["Do not be rude", "Do not over-explain", "Do not ignore context"]),
    recommendedReply: finalReply,
    agentTrace,
    metadata: {
      toolsUsed: ["classifyIntent", "detectEmotion", "relationshipRules", "riskAssessment", "qualityCheck"],
      toolSources: {
        classifyIntent: intent.source,
        detectEmotion: emotion.source,
        relationshipRules: relationshipRules.source,
        riskAssessment: riskAssessment.source,
        qualityCheck: qualityCheck.source,
      },
    },
  };
}
