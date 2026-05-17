import { Tone } from "../constants/tones";
import { Role } from "../constants/roles";

export async function generateRepliesFromApi(params: {
  backendUrl: string;
  message: string;
  tone: Tone;
  role?: Role;
}): Promise<string[]> {
  const response = await fetch(`${params.backendUrl}/api/replies/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
    headers: {
      "Content-Type": "application/json",
    },
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
    headers: {
      "Content-Type": "application/json",
    },
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

export type ChatMessageResponse = {
  assistantReply: string;
  intent: string;
  toolCalls: ChatToolCall[];
  todos: ChatTodoItem[];
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      classifyIntent: "static" | "llm" | "fallback";
      todoSkill: "static" | "llm" | "fallback";
      answerGeneration: "static" | "llm" | "fallback";
    };
  };
};

export async function analyzeCoachFromApi(params: {
  backendUrl: string;
  message: string;
  relationshipContext: string;
}): Promise<CoachAnalyzeResponse> {
  const response = await fetch(`${params.backendUrl}/api/coach/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
    headers: {
      "Content-Type": "application/json",
    },
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
