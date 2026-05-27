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

export type DeepSeekBalanceResponse = {
  isAvailable: boolean;
  balances: Array<{
    currency: string;
    totalBalance: string;
    grantedBalance: string;
    toppedUpBalance: string;
  }>;
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

async function getApiHeaders(): Promise<Record<string, string>> {
  const preference = await getLlmPreference();
  return {
    "Content-Type": "application/json",
    "X-LLM-Provider": preference.provider,
    "X-LLM-Model": preference.model,
  };
}
