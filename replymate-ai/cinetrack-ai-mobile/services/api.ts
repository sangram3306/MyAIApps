import { Tone } from "../constants/tones";
import { Role } from "../constants/roles";
import { getLlmPreference } from "../storage/appStorage";

export async function generateRepliesFromApi(params: {
  backendUrl: string;
  message: string;
  tone: Tone;
  role?: Role;
}): Promise<string[]> {
  const response = await fetch(`${params.backendUrl}/api/replies/generate`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      message: params.message,
      tone: params.tone,
      role: params.role,
    }),
  });

  const data = (await response.json().catch(() => null)) as { replies?: string[]; error?: string } | null;

  if (!response.ok) {
    throw new Error(data?.error || "Backend could not generate replies.");
  }

  if (!Array.isArray(data?.replies)) {
    throw new Error("Backend returned an unexpected response.");
  }

  return data.replies;
}

export async function rewriteMessageFromApi(params: {
  backendUrl: string;
  message: string;
  tone: Tone;
  role?: Role;
}): Promise<string[]> {
  const response = await fetch(`${params.backendUrl}/api/replies/rewrite`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      message: params.message,
      tone: params.tone,
      role: params.role,
    }),
  });

  const data = (await response.json().catch(() => null)) as { replies?: string[]; error?: string } | null;

  if (!response.ok) {
    throw new Error(data?.error || "Backend could not rewrite your message.");
  }

  if (!Array.isArray(data?.replies)) {
    throw new Error("Backend returned an unexpected response.");
  }

  return data.replies;
}

export async function fixGrammarFromApi(params: {
  backendUrl: string;
  message: string;
  tone: Tone;
  role?: Role;
}): Promise<string[]> {
  const response = await fetch(`${params.backendUrl}/api/replies/grammar`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      message: params.message,
      tone: params.tone,
    }),
  });

  const data = (await response.json().catch(() => null)) as { replies?: string[]; error?: string } | null;

  if (!response.ok) {
    throw new Error(data?.error || "Backend could not fix grammar.");
  }

  if (!Array.isArray(data?.replies)) {
    throw new Error("Backend returned an unexpected response.");
  }

  return data.replies;
}

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

export type ChatToolCall = {
  name: string;
  source: "static" | "llm" | "fallback";
  summary: string;
};

export type ChatTodoItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChatAgentEvent = {
  id: string;
  title: string;
  type: "llm" | "tool" | "mcp" | "final";
  request: unknown;
  response: unknown;
};

export type ChatMessageResponse = {
  assistantReply: string;
  intent: string;
  toolCalls: ChatToolCall[];
  todos: ChatTodoItem[];
  agentTrace: string[];
  agentEvents?: ChatAgentEvent[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      classifyIntent: "static" | "llm" | "fallback";
      todoSkill: "static" | "llm" | "fallback";
      answerGeneration: "static" | "llm" | "fallback";
    };
  };
};

export type ExpenseItem = {
  id: string;
  amount: number;
  currency?: "AED" | "INR";
  category: string;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseToolCall = {
  name: string;
  source: "static" | "llm" | "fallback";
  summary: string;
};

export type ExpenseMessageResponse = {
  assistantReply: string;
  toolCalls: ExpenseToolCall[];
  expenses: ExpenseItem[];
  total?: number;
  byCategory?: Array<{ category: string; total: number; count: number }>;
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      expenseSkill: "static" | "llm" | "fallback";
      answerGeneration: "static" | "llm" | "fallback";
    };
  };
};

export type ExpenseExportResponse = {
  exportedAt: string;
  expenses: ExpenseItem[];
  total: number;
  byCategory: Array<{ category: string; total: number; count: number }>;
  count: number;
};

export type ExpenseIntelligenceResponse = {
  period: "all" | "month" | "year";
  exportedAt: string;
  total: number;
  count: number;
  average: number;
  byCategory: Array<{ category: string; total: number; count: number }>;
  expenses: ExpenseItem[];
  intelligence: {
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
  source: {
    expenseSkill: "static" | "llm" | "fallback";
    analysis: "static" | "llm" | "fallback";
  };
};

export type CreatorDraft = {
  id: string;
  sourceText: string;
  sourceType: string;
  audience: string;
  goal: string;
  tone: string;
  platformOutputs: Record<string, unknown>;
  title: string;
  summary: string;
  hook: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatorRepurposeResponse = {
  assistantReply: string;
  repurpose: {
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
  savedDraft: CreatorDraft | null;
  saved: boolean;
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      contentGeneration: "static" | "llm" | "fallback";
      draftStorage: "static" | "llm" | "fallback";
    };
  };
};

export type CreatorDraftsResponse = {
  drafts: CreatorDraft[];
  count: number;
};

export type CreatorDraftUpdateResponse = {
  updated: boolean;
  draft: CreatorDraft | null;
  summary: string;
};

export type DecisionOption = {
  name: string;
  score: number;
  pros: string[];
  cons: string[];
  reasoning: string;
};

export type DecisionSimulation = {
  id: string;
  question: string;
  context: string;
  category: string;
  horizon: string;
  stakes: "low" | "medium" | "high";
  recommendation: string;
  recommendationSummary: string;
  confidence: number;
  options: DecisionOption[];
  keyFactors: string[];
  tradeoffs: string[];
  risks: string[];
  assumptions: string[];
  experiments: string[];
  nextSteps: string[];
  regretCheck: string;
  decisionRule: string;
  createdAt: string;
  updatedAt: string;
};

export type DecisionSimulationResponse = {
  assistantReply: string;
  simulation: DecisionSimulation;
  recentDecisions: DecisionSimulation[];
  toolCalls: Array<{
    name: string;
    source: "static" | "llm" | "fallback";
    summary: string;
  }>;
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      decisionMemory: "static" | "llm" | "fallback";
      simulationStorage: "static" | "llm" | "fallback";
      answerGeneration: "static" | "llm" | "fallback";
    };
  };
};

export type SkillTreeNode = {
  title: string;
  type: "concept" | "practice" | "project" | "checkpoint";
  difficulty: "easy" | "medium" | "hard";
  whyItMatters: string;
  practice: string;
  proofOfSkill: string;
  estimatedHours: number;
};

export type SkillTreeBranch = {
  name: string;
  description: string;
  nodes: SkillTreeNode[];
};

export type SkillTree = {
  id: string;
  skillName: string;
  currentLevel: string;
  targetLevel: string;
  timeBudget: string;
  focusAreas: string[];
  overview: string;
  branches: SkillTreeBranch[];
  weeklyQuests: string[];
  milestones: string[];
  recommendedRoutine: string[];
  createdAt: string;
  updatedAt: string;
};

export type SkillTreeResponse = {
  assistantReply: string;
  skillTree: SkillTree;
  recentSkillTrees: SkillTree[];
  saved: boolean;
  saveSummary?: string;
  metadata?: {
    toolSources: {
      planGeneration: "static" | "llm" | "fallback";
    };
  };
  toolCalls: Array<{
    name: string;
    source: "static" | "llm" | "fallback";
    summary: string;
  }>;
  agentTrace: string[];
};

export type SkillTreeHistoryResponse = {
  skillTrees: SkillTree[];
  count: number;
  source: "static" | "llm" | "fallback";
};

export type SaveSkillTreeResponse = {
  saved: boolean;
  summary: string;
  source: "static" | "llm" | "fallback";
  skillTree: SkillTree | null;
};

export type DeleteSkillTreeResponse = {
  deleted: boolean;
  deletedCount: number;
  id: string;
  summary: string;
  source: "static" | "llm" | "fallback";
};

export type LearningRoadmapPhase = {
  title: string;
  duration: string;
  outcome: string;
  lessons: string[];
  projects: string[];
  checkpoints: string[];
  resources: string[];
};

export type LearningRoadmap = {
  id: string;
  topic: string;
  goal: string;
  currentLevel: string;
  timeline: string;
  timePerWeek: string;
  overview: string;
  phases: LearningRoadmapPhase[];
  weeklyPlan: string[];
  practiceLoop: string[];
  pitfalls: string[];
  successMetrics: string[];
  nextActions: string[];
  createdAt: string;
  updatedAt: string;
};

export type LearningRoadmapResponse = {
  assistantReply: string;
  roadmap: LearningRoadmap;
  recentRoadmaps: LearningRoadmap[];
  saved: boolean;
  saveSummary?: string;
  metadata?: {
    toolSources: {
      planGeneration: "static" | "llm" | "fallback";
    };
  };
  toolCalls: Array<{
    name: string;
    source: "static" | "llm" | "fallback";
    summary: string;
  }>;
  agentTrace: string[];
};

export type LearningRoadmapHistoryResponse = {
  roadmaps: LearningRoadmap[];
  count: number;
  source: "static" | "llm" | "fallback";
};

export type SaveLearningRoadmapResponse = {
  saved: boolean;
  summary: string;
  source: "static" | "llm" | "fallback";
  roadmap: LearningRoadmap | null;
};

export type DeleteLearningRoadmapResponse = {
  deleted: boolean;
  deletedCount: number;
  id: string;
  summary: string;
  source: "static" | "llm" | "fallback";
};

export type DeepSeekBalanceResponse = {
  isAvailable: boolean;
  balances: Array<{
    currency: string;
    totalBalance: string;
    grantedBalance: string;
    toppedUpBalance: string;
  }>;
};

export type WatchStatus = "planned" | "started" | "in_progress" | "completed" | "dropped";
export type WatchType = "movie" | "series";

export type WatchEntry = {
  id: string;
  title: string;
  type: WatchType;
  status: WatchStatus;
  favorite: boolean;
  releaseYear: string;
  director: string;
  leadActors: string[];
  budget: string;
  boxOffice: string;
  posterUrl?: string;
  ratings: Array<{ source: string; value: string }>;
  availability: Array<{ provider: string; region: string; type: "stream" | "rent" | "buy" | "free" | "ads"; link?: string }>;
  externalDetails?: Array<{ label: string; value: string }>;
  synopsis: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type WatchLogResponse = {
  assistantReply: string;
  entry: WatchEntry;
  entries: WatchEntry[];
  agentTrace: string[];
  toolCalls: Array<{ name: string; source: "static" | "llm" | "fallback"; summary: string }>;
  metadata: {
    toolSources: {
      enrichment: "static" | "llm" | "fallback";
      storage: "static" | "llm" | "fallback";
    };
  };
};

export type WatcherProfileResponse = {
  source: "static" | "llm" | "fallback";
  fallbackReason?: string;
  count: number;
  profile: {
    archetype: string;
    summary: string;
    traits: string[];
    patterns: string[];
    suggestions: string[];
  };
};

export async function analyzeCoachFromApi(params: {
  backendUrl: string;
  message: string;
  relationshipContext: string;
}): Promise<CoachAnalyzeResponse> {
  const response = await fetch(`${params.backendUrl}/api/coach/analyze`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      message: params.message,
      relationshipContext: params.relationshipContext,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<CoachAnalyzeResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Backend could not analyze the message.");
  }

  if (
    typeof data?.intent !== "string" ||
    typeof data?.emotion !== "string" ||
    !Array.isArray(data?.doTips) ||
    !Array.isArray(data?.dontTips) ||
    typeof data?.recommendedReply !== "string" ||
    typeof data?.suggestedTone !== "string" ||
    typeof data?.strategy !== "string" ||
    !Array.isArray(data?.agentTrace)
  ) {
    throw new Error("Backend returned an unexpected response.");
  }

  return data as CoachAnalyzeResponse;
}

export async function sendChatMessageFromApi(params: {
  backendUrl: string;
  message: string;
}): Promise<ChatMessageResponse> {
  const response = await fetch(`${params.backendUrl}/api/chat/message`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      message: params.message,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<ChatMessageResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Backend could not process the chat message.");
  }

  if (
    typeof data?.assistantReply !== "string" ||
    typeof data?.intent !== "string" ||
    !Array.isArray(data?.toolCalls) ||
    !Array.isArray(data?.todos) ||
    !Array.isArray(data?.agentTrace)
  ) {
    throw new Error("Backend returned an unexpected response.");
  }

  return data as ChatMessageResponse;
}

export async function sendExpenseMessageFromApi(params: {
  backendUrl: string;
  message: string;
}): Promise<ExpenseMessageResponse> {
  const response = await fetch(`${params.backendUrl}/api/expenses/message`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      message: params.message,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<ExpenseMessageResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Backend could not process expenses.");
  }

  if (
    typeof data?.assistantReply !== "string" ||
    !Array.isArray(data?.toolCalls) ||
    !Array.isArray(data?.expenses) ||
    !Array.isArray(data?.agentTrace)
  ) {
    throw new Error("Backend returned an unexpected response.");
  }

  return data as ExpenseMessageResponse;
}

export async function createExpenseFromApi(params: {
  backendUrl: string;
  amount: number;
  currency: "AED" | "INR";
  category: string;
  description?: string;
}): Promise<ExpenseMessageResponse> {
  const response = await fetch(`${params.backendUrl}/api/expenses/create`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      category: params.category,
      description: params.description,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<ExpenseMessageResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Backend could not save expense.");
  }

  if (
    typeof data?.assistantReply !== "string" ||
    !Array.isArray(data?.toolCalls) ||
    !Array.isArray(data?.expenses) ||
    !Array.isArray(data?.agentTrace)
  ) {
    throw new Error("Backend returned an unexpected response.");
  }

  return data as ExpenseMessageResponse;
}

export async function getExpenseExportFromApi(params: {
  backendUrl: string;
}): Promise<ExpenseExportResponse> {
  const response = await fetch(`${params.backendUrl}/api/expenses/export`, {
    method: "GET",
    headers: await getApiHeaders(),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<ExpenseExportResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not export expenses.");
  }

  if (
    typeof data?.exportedAt !== "string" ||
    !Array.isArray(data?.expenses) ||
    !Array.isArray(data?.byCategory) ||
    typeof data?.total !== "number" ||
    typeof data?.count !== "number"
  ) {
    throw new Error("Backend returned an unexpected expense export response.");
  }

  return data as ExpenseExportResponse;
}

export async function getExpenseIntelligenceFromApi(params: {
  backendUrl: string;
  period?: "all" | "month" | "year";
}): Promise<ExpenseIntelligenceResponse> {
  const response = await fetch(`${params.backendUrl}/api/expenses/intelligence`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      period: params.period || "month",
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<ExpenseIntelligenceResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not analyze expenses.");
  }

  if (
    typeof data?.period !== "string" ||
    typeof data?.exportedAt !== "string" ||
    typeof data?.total !== "number" ||
    typeof data?.count !== "number" ||
    typeof data?.average !== "number" ||
    !Array.isArray(data?.byCategory) ||
    !Array.isArray(data?.expenses) ||
    typeof data?.intelligence?.headline !== "string" ||
    typeof data?.intelligence?.summary !== "string"
  ) {
    throw new Error("Backend returned an unexpected expense intelligence response.");
  }

  return data as ExpenseIntelligenceResponse;
}

export async function repurposeContentFromApi(params: {
  backendUrl: string;
  sourceText: string;
  sourceType?: string;
  audience?: string;
  goal?: string;
  tone?: string;
  platforms?: Array<"x" | "linkedin" | "instagram" | "email" | "thread">;
}): Promise<CreatorRepurposeResponse> {
  const response = await fetch(`${params.backendUrl}/api/creator/repurpose`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      sourceText: params.sourceText,
      sourceType: params.sourceType,
      audience: params.audience,
      goal: params.goal,
      tone: params.tone,
      platforms: params.platforms,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<CreatorRepurposeResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not repurpose content.");
  }

  if (
    typeof data?.assistantReply !== "string" ||
    typeof data?.repurpose?.title !== "string" ||
    typeof data?.repurpose?.summary !== "string" ||
    typeof data?.repurpose?.hook !== "string" ||
    !Array.isArray(data?.agentTrace)
  ) {
    throw new Error("Backend returned an unexpected creator response.");
  }

  return data as CreatorRepurposeResponse;
}

export async function getCreatorDraftsFromApi(params: {
  backendUrl: string;
}): Promise<CreatorDraftsResponse> {
  const response = await fetch(`${params.backendUrl}/api/creator/drafts`, {
    method: "GET",
    headers: await getApiHeaders(),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<CreatorDraftsResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not load drafts.");
  }

  if (!Array.isArray(data?.drafts) || typeof data?.count !== "number") {
    throw new Error("Backend returned an unexpected drafts response.");
  }

  return data as CreatorDraftsResponse;
}

export async function updateCreatorDraftFromApi(params: {
  backendUrl: string;
  id: string;
  title: string;
  summary: string;
  hook: string;
  platformOutputs?: Record<string, unknown>;
}): Promise<CreatorDraftUpdateResponse> {
  const response = await fetch(`${params.backendUrl}/api/creator/drafts/update`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      id: params.id,
      title: params.title,
      summary: params.summary,
      hook: params.hook,
      platformOutputs: params.platformOutputs,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<CreatorDraftUpdateResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not update draft.");
  }

  if (typeof data?.updated !== "boolean" || typeof data?.summary !== "string") {
    throw new Error("Backend returned an unexpected draft update response.");
  }

  return data as CreatorDraftUpdateResponse;
}

export async function simulateDecisionFromApi(params: {
  backendUrl: string;
  question: string;
  context?: string;
  options?: string[];
  horizon?: string;
  stakes?: "low" | "medium" | "high";
}): Promise<DecisionSimulationResponse> {
  const response = await fetch(`${params.backendUrl}/api/decisions/simulate`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      question: params.question,
      context: params.context,
      options: params.options,
      horizon: params.horizon,
      stakes: params.stakes,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<DecisionSimulationResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not simulate this decision.");
  }

  if (
    typeof data?.assistantReply !== "string" ||
    typeof data?.simulation?.recommendation !== "string" ||
    typeof data?.simulation?.confidence !== "number" ||
    !Array.isArray(data?.simulation?.options) ||
    !Array.isArray(data?.agentTrace) ||
    !Array.isArray(data?.toolCalls)
  ) {
    throw new Error("Backend returned an unexpected decision simulation response.");
  }

  return data as DecisionSimulationResponse;
}

export async function buildSkillTreeFromApi(params: {
  backendUrl: string;
  skillName: string;
  currentLevel?: string;
  targetLevel?: string;
  timeBudget?: string;
  focusAreas?: string[];
}): Promise<SkillTreeResponse> {
  const response = await fetch(`${params.backendUrl}/api/learning/skill-tree`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      skillName: params.skillName,
      currentLevel: params.currentLevel,
      targetLevel: params.targetLevel,
      timeBudget: params.timeBudget,
      focusAreas: params.focusAreas,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<SkillTreeResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not build this skill tree.");
  }

  if (
    typeof data?.assistantReply !== "string" ||
    typeof data?.skillTree?.skillName !== "string" ||
    !Array.isArray(data?.skillTree?.branches) ||
    !Array.isArray(data?.agentTrace) ||
    !Array.isArray(data?.toolCalls)
  ) {
    throw new Error("Backend returned an unexpected skill tree response.");
  }

  return data as SkillTreeResponse;
}

export async function buildLearningRoadmapFromApi(params: {
  backendUrl: string;
  topic: string;
  goal?: string;
  currentLevel?: string;
  timeline?: string;
  timePerWeek?: string;
}): Promise<LearningRoadmapResponse> {
  const response = await fetch(`${params.backendUrl}/api/learning/roadmap`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      topic: params.topic,
      goal: params.goal,
      currentLevel: params.currentLevel,
      timeline: params.timeline,
      timePerWeek: params.timePerWeek,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<LearningRoadmapResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not build this learning roadmap.");
  }

  if (
    typeof data?.assistantReply !== "string" ||
    typeof data?.roadmap?.topic !== "string" ||
    !Array.isArray(data?.roadmap?.phases) ||
    !Array.isArray(data?.agentTrace) ||
    !Array.isArray(data?.toolCalls)
  ) {
    throw new Error("Backend returned an unexpected learning roadmap response.");
  }

  return data as LearningRoadmapResponse;
}

export async function getSkillTreeHistoryFromApi(params: {
  backendUrl: string;
}): Promise<SkillTreeHistoryResponse> {
  const response = await fetch(`${params.backendUrl}/api/learning/skill-trees`, {
    method: "GET",
    headers: await getApiHeaders(),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<SkillTreeHistoryResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not load skill tree history.");
  }

  if (!Array.isArray(data?.skillTrees) || typeof data?.count !== "number") {
    throw new Error("Backend returned an unexpected skill tree history response.");
  }

  return {
    skillTrees: data.skillTrees as SkillTree[],
    count: data.count,
    source: (data.source as "static" | "llm" | "fallback") || "fallback",
  };
}

export async function getLearningRoadmapHistoryFromApi(params: {
  backendUrl: string;
}): Promise<LearningRoadmapHistoryResponse> {
  const response = await fetch(`${params.backendUrl}/api/learning/roadmaps`, {
    method: "GET",
    headers: await getApiHeaders(),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<LearningRoadmapHistoryResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not load learning roadmap history.");
  }

  if (!Array.isArray(data?.roadmaps) || typeof data?.count !== "number") {
    throw new Error("Backend returned an unexpected learning roadmap history response.");
  }

  return {
    roadmaps: data.roadmaps as LearningRoadmap[],
    count: data.count,
    source: (data.source as "static" | "llm" | "fallback") || "fallback",
  };
}

export async function saveLearningRoadmapFromApi(params: {
  backendUrl: string;
  roadmap: LearningRoadmap;
}): Promise<SaveLearningRoadmapResponse> {
  const response = await fetch(`${params.backendUrl}/api/learning/roadmaps/save`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      topic: params.roadmap.topic,
      goal: params.roadmap.goal,
      currentLevel: params.roadmap.currentLevel,
      timeline: params.roadmap.timeline,
      timePerWeek: params.roadmap.timePerWeek,
      overview: params.roadmap.overview,
      phases: params.roadmap.phases,
      weeklyPlan: params.roadmap.weeklyPlan,
      practiceLoop: params.roadmap.practiceLoop,
      pitfalls: params.roadmap.pitfalls,
      successMetrics: params.roadmap.successMetrics,
      nextActions: params.roadmap.nextActions,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<SaveLearningRoadmapResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not save this learning roadmap.");
  }

  if (typeof data?.saved !== "boolean" || typeof data?.summary !== "string") {
    throw new Error("Backend returned an unexpected save learning roadmap response.");
  }

  return {
    saved: data.saved,
    summary: data.summary,
    source: (data.source as "static" | "llm" | "fallback") || "fallback",
    roadmap: (data.roadmap as LearningRoadmap | null) || null,
  };
}

export async function deleteLearningRoadmapFromApi(params: {
  backendUrl: string;
  id: string;
}): Promise<DeleteLearningRoadmapResponse> {
  const response = await fetch(
    `${params.backendUrl}/api/learning/roadmaps/${encodeURIComponent(params.id)}`,
    {
      method: "DELETE",
      headers: await getApiHeaders(),
    },
  );

  const data = (await response.json().catch(() => null)) as
    | Partial<DeleteLearningRoadmapResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not delete this learning roadmap.");
  }

  if (typeof data?.deleted !== "boolean" || typeof data?.deletedCount !== "number" || typeof data?.summary !== "string") {
    throw new Error("Backend returned an unexpected delete learning roadmap response.");
  }

  return {
    deleted: data.deleted,
    deletedCount: data.deletedCount,
    id: typeof data.id === "string" ? data.id : params.id,
    summary: data.summary,
    source: (data.source as "static" | "llm" | "fallback") || "fallback",
  };
}

export async function saveSkillTreeFromApi(params: {
  backendUrl: string;
  skillTree: SkillTree;
}): Promise<SaveSkillTreeResponse> {
  const response = await fetch(`${params.backendUrl}/api/learning/skill-trees/save`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify({
      skillName: params.skillTree.skillName,
      currentLevel: params.skillTree.currentLevel,
      targetLevel: params.skillTree.targetLevel,
      timeBudget: params.skillTree.timeBudget,
      focusAreas: params.skillTree.focusAreas,
      overview: params.skillTree.overview,
      branches: params.skillTree.branches,
      weeklyQuests: params.skillTree.weeklyQuests,
      milestones: params.skillTree.milestones,
      recommendedRoutine: params.skillTree.recommendedRoutine,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<SaveSkillTreeResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not save this skill tree.");
  }

  if (typeof data?.saved !== "boolean" || typeof data?.summary !== "string") {
    throw new Error("Backend returned an unexpected save skill tree response.");
  }

  return {
    saved: data.saved,
    summary: data.summary,
    source: (data.source as "static" | "llm" | "fallback") || "fallback",
    skillTree: (data.skillTree as SkillTree | null) || null,
  };
}

export async function deleteSkillTreeFromApi(params: {
  backendUrl: string;
  id: string;
}): Promise<DeleteSkillTreeResponse> {
  const response = await fetch(
    `${params.backendUrl}/api/learning/skill-trees/${encodeURIComponent(params.id)}`,
    {
      method: "DELETE",
      headers: await getApiHeaders(),
    },
  );

  const data = (await response.json().catch(() => null)) as
    | Partial<DeleteSkillTreeResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not delete this skill tree.");
  }

  if (typeof data?.deleted !== "boolean" || typeof data?.deletedCount !== "number" || typeof data?.summary !== "string") {
    throw new Error("Backend returned an unexpected delete skill tree response.");
  }

  return {
    deleted: data.deleted,
    deletedCount: data.deletedCount,
    id: typeof data.id === "string" ? data.id : params.id,
    summary: data.summary,
    source: (data.source as "static" | "llm" | "fallback") || "fallback",
  };
}

export async function clearExpensesFromApi(params: {
  backendUrl: string;
}): Promise<{ cleared: number; deleted: string[] }> {
  const response = await fetch(`${params.backendUrl}/api/expenses/clear`, {
    method: "POST",
    headers: await getApiHeaders(),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<{ cleared: number; deleted: string[] } & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not clear expenses.");
  }

  if (typeof data?.cleared !== "number" || !Array.isArray(data?.deleted)) {
    throw new Error("Backend returned an unexpected clear expenses response.");
  }

  return { cleared: data.cleared, deleted: data.deleted };
}

export async function getDeepSeekBalanceFromApi(params: {
  backendUrl: string;
}): Promise<DeepSeekBalanceResponse> {
  const response = await fetch(`${params.backendUrl}/api/settings/deepseek-balance`, {
    method: "GET",
    headers: await getApiHeaders(),
  });

  const data = (await response.json().catch(() => null)) as
    | Partial<DeepSeekBalanceResponse & { error?: string }>
    | null;

  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not fetch DeepSeek usage.");
  }

  if (typeof data?.isAvailable !== "boolean" || !Array.isArray(data?.balances)) {
    throw new Error("Backend returned an unexpected DeepSeek usage response.");
  }

  return data as DeepSeekBalanceResponse;
}

export async function logWatchItemFromApi(params: {
  backendUrl: string;
  title: string;
  type?: WatchType;
  status: WatchStatus;
  favorite?: boolean;
  notes?: string;
}): Promise<WatchLogResponse> {
  const response = await fetch(`${params.backendUrl}/api/watch/log`, {
    method: "POST",
    headers: await getApiHeaders(),
    body: JSON.stringify(params),
  });
  const data = (await response.json().catch(() => null)) as Partial<WatchLogResponse & { error?: string }> | null;
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not log this watch item.");
  }
  if (!data?.entry || !Array.isArray(data.entries)) {
    throw new Error("Backend returned an unexpected watch log response.");
  }
  return data as WatchLogResponse;
}

export async function listWatchItemsFromApi(params: {
  backendUrl: string;
}): Promise<{ entries: WatchEntry[]; source: "static" | "llm" | "fallback" }> {
  const response = await fetch(`${params.backendUrl}/api/watch/items`, {
    method: "GET",
    headers: await getApiHeaders(),
  });
  const data = (await response.json().catch(() => null)) as Partial<{ entries: WatchEntry[]; source: "static" | "llm" | "fallback"; error?: string }> | null;
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not load watch items.");
  }
  if (!Array.isArray(data?.entries)) {
    throw new Error("Backend returned an unexpected watch list response.");
  }
  return {
    entries: data.entries,
    source: data.source || "fallback",
  };
}

export async function getWatcherProfileFromApi(params: {
  backendUrl: string;
}): Promise<WatcherProfileResponse> {
  const response = await fetch(`${params.backendUrl}/api/watch/profile`, {
    method: "GET",
    headers: await getApiHeaders(),
  });
  const data = (await response.json().catch(() => null)) as Partial<WatcherProfileResponse & { error?: string }> | null;
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not build watcher profile.");
  }
  if (typeof data?.profile?.archetype !== "string" || !Array.isArray(data.profile.traits)) {
    throw new Error("Backend returned an unexpected watcher profile response.");
  }
  return data as WatcherProfileResponse;
}

export async function updateWatchStatusFromApi(params: {
  backendUrl: string;
  id: string;
  status: WatchStatus;
}): Promise<{ entries: WatchEntry[]; source: "static" | "llm" | "fallback" }> {
  const response = await fetch(`${params.backendUrl}/api/watch/items/${encodeURIComponent(params.id)}/status`, {
    method: "PATCH",
    headers: await getApiHeaders(),
    body: JSON.stringify({ status: params.status }),
  });
  const data = (await response.json().catch(() => null)) as Partial<{ entries: WatchEntry[]; source: "static" | "llm" | "fallback"; error?: string }> | null;
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not update watch status.");
  }
  if (!Array.isArray(data?.entries)) {
    throw new Error("Backend returned an unexpected watch status response.");
  }
  return {
    entries: data.entries,
    source: data.source || "fallback",
  };
}

export async function updateWatchDetailsFromApi(params: {
  backendUrl: string;
  id: string;
  updates: Partial<Omit<WatchEntry, "id" | "createdAt" | "updatedAt">>;
}): Promise<{ entry?: WatchEntry; entries: WatchEntry[]; source: "static" | "llm" | "fallback" }> {
  const response = await fetch(`${params.backendUrl}/api/watch/items/${encodeURIComponent(params.id)}`, {
    method: "PATCH",
    headers: await getApiHeaders(),
    body: JSON.stringify(params.updates),
  });
  const data = (await response.json().catch(() => null)) as Partial<{ entry?: WatchEntry; entries: WatchEntry[]; source: "static" | "llm" | "fallback"; error?: string }> | null;
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not update watch details.");
  }
  if (!Array.isArray(data?.entries)) {
    throw new Error("Backend returned an unexpected watch details response.");
  }
  return {
    entry: data.entry,
    entries: data.entries,
    source: data.source || "fallback",
  };
}

export async function deleteWatchItemFromApi(params: {
  backendUrl: string;
  id: string;
}): Promise<{ deleted: boolean; entries: WatchEntry[]; source: "static" | "llm" | "fallback" }> {
  const response = await fetch(`${params.backendUrl}/api/watch/items/${encodeURIComponent(params.id)}`, {
    method: "DELETE",
    headers: await getApiHeaders(),
  });
  const data = (await response.json().catch(() => null)) as Partial<{ deleted: boolean; entries: WatchEntry[]; source: "static" | "llm" | "fallback"; error?: string }> | null;
  if (!response.ok) {
    throw new Error((data as { error?: string } | null)?.error || "Could not delete watch item.");
  }
  if (typeof data?.deleted !== "boolean" || !Array.isArray(data?.entries)) {
    throw new Error("Backend returned an unexpected watch delete response.");
  }
  return {
    deleted: data.deleted,
    entries: data.entries,
    source: data.source || "fallback",
  };
}

async function getApiHeaders(): Promise<Record<string, string>> {
  const preference = await getLlmPreference();
  return {
    "Content-Type": "application/json",
    "X-LLM-Provider": preference.provider,
    "X-LLM-Model": preference.model,
  };
}
