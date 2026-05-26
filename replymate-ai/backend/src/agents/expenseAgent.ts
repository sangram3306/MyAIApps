import { callMcpTool } from "../mcp/mcpClient";
import { callChatCompletion, hasConfiguredLlmApiKey } from "../services/llmService";
import { safeParseJson } from "../utils/safeJson";

type Source = "static" | "llm" | "fallback";
type ExpenseToolName = "createExpense" | "listExpenses" | "expenseSummary" | "deleteExpense";

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

export type ExpenseResponse = {
  assistantReply: string;
  toolCalls: Array<{
    name: string;
    source: Source;
    summary: string;
  }>;
  expenses: ExpenseItem[];
  total?: number;
  byCategory?: Array<{ category: string; total: number; count: number }>;
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      expenseSkill: Source;
      answerGeneration: Source;
    };
  };
};

type ExpenseToolResult = {
  source: Source;
  confidence: number;
  summary: string;
  expense?: ExpenseItem;
  expenses: ExpenseItem[];
  total?: number;
  count?: number;
  byCategory?: Array<{ category: string; total: number; count: number }>;
};

type AgentAction =
  | {
      type: "tool_call";
      toolName: ExpenseToolName;
      arguments: Record<string, unknown>;
      reason?: string;
    }
  | {
      type: "final";
      assistantReply: string;
    };

type AgentMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const maxTurns = 6;

const expenseTools = [
  {
    name: "createExpense",
    description: "Log one expense to MongoDB.",
    schema: {
      amount: "number",
      category: "string",
      description: "string",
      date: "YYYY-MM-DD optional",
    },
  },
  {
    name: "listExpenses",
    description: "List expense records from MongoDB.",
    schema: {
      period: "all | today | week | month",
      category: "string optional",
      limit: "number optional",
    },
  },
  {
    name: "expenseSummary",
    description: "Summarize spending totals and categories from MongoDB.",
    schema: {
      period: "all | today | week | month",
      category: "string optional",
    },
  },
  {
    name: "deleteExpense",
    description: "Delete one expense from MongoDB by number, id, or description.",
    schema: {
      target: "string",
    },
  },
];

export async function handleExpenseMessage(message: string): Promise<ExpenseResponse> {
  if (!hasConfiguredLlmApiKey()) {
    return fallbackExpenseResponse(message);
  }

  try {
    return await runExpenseAgentLoop(message);
  } catch (error) {
    console.error("[expenses] agent loop fallback", error);
    return fallbackExpenseResponse(message);
  }
}

async function runExpenseAgentLoop(message: string): Promise<ExpenseResponse> {
  const trace = ["Checked expense message"];
  const toolCalls: ExpenseResponse["toolCalls"] = [];
  const observations: Array<{ toolName: ExpenseToolName; result: ExpenseToolResult }> = [];
  const initialExpenses = await callExpenseTool("listExpenses", { period: "month", limit: 20 });
  const messages: AgentMessage[] = [
    {
      role: "system",
      content:
        "You are an Expense Tracker agent running an industry-style tool loop. You may call exactly one allowed tool or return a final answer. Return only valid JSON. Do not claim an expense was saved unless a tool_result confirms it. Do not include private chain-of-thought.",
    },
    {
      role: "user",
      content: JSON.stringify({
        userMessage: message,
        skill: {
          name: "Expense Tracker With AI Insights",
          description: "Extract spending from natural language, persist it with MCP tools, then provide spending insights.",
        },
        availableTools: expenseTools,
        recentExpenses: initialExpenses.expenses.slice(0, 10).map((expense, index) => ({
          number: index + 1,
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          date: expense.date,
        })),
        instructions: [
          "For messages with multiple expenses, call createExpense once per expense.",
          "Use expenseSummary after logging expenses when the user asks for insight or when a concise total would help.",
          "For spending questions, call expenseSummary or listExpenses.",
          "When the user mentions a category like food, groceries, fuel, transport, bills, health, entertainment, shopping, or rent, include category in listExpenses or expenseSummary arguments.",
          "For 'summarize food expenses', call expenseSummary with category food.",
          "For normal non-expense questions, return final directly.",
        ],
        responseSchemas: {
          toolCall: {
            type: "tool_call",
            toolName: "createExpense | listExpenses | expenseSummary | deleteExpense",
            arguments: "object matching selected tool schema",
          },
          final: {
            type: "final",
            assistantReply: "string",
          },
        },
      }),
    },
  ];

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const action = await callExpenseModel(messages);
    if (action.type === "final") {
      trace.push(observations.length ? "Generated expense insight" : "Answered directly");
      const finalReply = observations.length
        ? await synthesizeExpenseFinal(message, observations, action.assistantReply)
        : action.assistantReply;
      return buildExpenseResponse(finalReply, toolCalls, observations, initialExpenses.expenses, trace, "llm");
    }

    const validationError = validateExpenseToolCall(action);
    if (validationError) {
      messages.push({ role: "assistant", content: JSON.stringify(action) });
      messages.push({
        role: "user",
        content: JSON.stringify({
          type: "tool_result",
          toolName: action.toolName,
          error: validationError,
        }),
      });
      trace.push("Rejected invalid expense tool call");
      continue;
    }

    const normalizedArguments = normalizeExpenseToolArguments(action.toolName, action.arguments, message);
    const result = await callExpenseTool(action.toolName, normalizedArguments);
    observations.push({ toolName: action.toolName, result });
    toolCalls.push({
      name: action.toolName,
      source: result.source,
      summary: result.summary,
    });
    trace.push(traceForExpenseTool(action.toolName));

    messages.push({ role: "assistant", content: JSON.stringify(action) });
    messages.push({
      role: "user",
      content: JSON.stringify({
        type: "tool_result",
        toolName: action.toolName,
        result: sanitizeExpenseResult(result),
        allToolResultsSoFar: observations.map((observation) => ({
          toolName: observation.toolName,
          result: sanitizeExpenseResult(observation.result),
        })),
        instruction: "Return another tool_call if more work remains, otherwise return final.",
      }),
    });
  }

  trace.push("Stopped at loop limit");
  return buildExpenseResponse(
    observations.at(-1)?.result.summary || "I ran out of expense agent steps before finishing.",
    toolCalls,
    observations,
    initialExpenses.expenses,
    trace,
    "fallback",
  );
}

async function callExpenseModel(messages: AgentMessage[]): Promise<AgentAction> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await callChatCompletion({
      temperature: 0.2,
      maxTokens: 500,
      responseFormat: { type: "json_object" },
      messages,
    });

    const action = parseExpenseAction(completion.content);
    if (action) {
      return action;
    }

    messages.push({
      role: "user",
      content: JSON.stringify({
        type: "format_error",
        instruction: "Return only valid JSON matching either the toolCall or final schema.",
      }),
    });
  }

  throw new Error("Expense model returned invalid JSON.");
}

function parseExpenseAction(content: string | undefined): AgentAction | null {
  if (!content) {
    return null;
  }

  const parsed = safeParseJson<Partial<AgentAction>>(content);
  if (!parsed || typeof parsed.type !== "string") {
    return null;
  }

  if (parsed.type === "final" && typeof parsed.assistantReply === "string") {
    return {
      type: "final",
      assistantReply: parsed.assistantReply,
    };
  }

  if (
    parsed.type === "tool_call" &&
    typeof parsed.toolName === "string" &&
    isExpenseToolName(parsed.toolName) &&
    parsed.arguments &&
    typeof parsed.arguments === "object" &&
    !Array.isArray(parsed.arguments)
  ) {
    return {
      type: "tool_call",
      toolName: parsed.toolName,
      arguments: parsed.arguments as Record<string, unknown>,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  }

  return null;
}

async function synthesizeExpenseFinal(
  userMessage: string,
  observations: Array<{ toolName: ExpenseToolName; result: ExpenseToolResult }>,
  draftReply: string,
): Promise<string> {
  if (!hasConfiguredLlmApiKey()) {
    return draftReply;
  }

  const requestBody = {
    temperature: 0.2,
    max_tokens: 350,
    response_format: { type: "json_object" as const },
    messages: [
      {
        role: "system" as const,
        content:
          "Return only valid JSON with assistantReply. Mention every successful expense tool action and include useful spending insight if totals/categories are available. Do not invent actions that are not in observations.",
      },
      {
        role: "user" as const,
        content: JSON.stringify({
          userMessage,
          draftReply,
          toolResults: observations.map((observation) => ({
            toolName: observation.toolName,
            result: sanitizeExpenseResult(observation.result),
          })),
          outputSchema: { assistantReply: "string" },
        }),
      },
    ],
  };

  try {
    const completion = await callChatCompletion({
      temperature: requestBody.temperature,
      maxTokens: requestBody.max_tokens,
      responseFormat: requestBody.response_format,
      messages: requestBody.messages,
    });
    const parsed = safeParseJson<{ assistantReply?: string }>(completion.content || "");
    return parsed?.assistantReply || draftReply;
  } catch (error) {
    console.error("[expenses] final synthesis failed", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return draftReply;
  }
}

async function callExpenseTool(toolName: ExpenseToolName, payload: unknown): Promise<ExpenseToolResult> {
  try {
    return await callMcpTool<ExpenseToolResult>(toolName, payload, {
      timeoutMs: 5000,
      retries: 1,
    });
  } catch (error) {
    console.error("[expenses] MCP fallback", {
      toolName,
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      source: "fallback",
      confidence: 0.3,
      summary: `Could not execute ${toolName}.`,
      expenses: [],
    };
  }
}

function buildExpenseResponse(
  assistantReply: string,
  toolCalls: ExpenseResponse["toolCalls"],
  observations: Array<{ toolName: ExpenseToolName; result: ExpenseToolResult }>,
  fallbackExpenses: ExpenseItem[],
  trace: string[],
  answerGeneration: Source,
): ExpenseResponse {
  const latest = observations.at(-1)?.result;
  return {
    assistantReply,
    toolCalls,
    expenses: latest?.expenses || fallbackExpenses,
    total: latest?.total,
    byCategory: latest?.byCategory,
    agentTrace: [...trace, "Returned expense response"],
    metadata: {
      toolsUsed: ["expenseAgent", ...toolCalls.map((tool) => tool.name)],
      toolSources: {
        expenseSkill: toolCalls.at(-1)?.source || "fallback",
        answerGeneration,
      },
    },
  };
}

async function fallbackExpenseResponse(message: string): Promise<ExpenseResponse> {
  const trace = ["Checked expense message", "Used fallback expense router"];
  const toolCalls: ExpenseResponse["toolCalls"] = [];
  const fallbackAction = classifyExpenseFallback(message);

  if (fallbackAction) {
    const result = await callExpenseTool(fallbackAction.toolName, fallbackAction.arguments);
    toolCalls.push({
      name: fallbackAction.toolName,
      source: result.source,
      summary: result.summary,
    });
    return buildExpenseResponse(
      fallbackReplyForExpenseTool(fallbackAction.toolName, result),
      toolCalls,
      [{ toolName: fallbackAction.toolName, result }],
      [],
      [...trace, traceForExpenseTool(fallbackAction.toolName)],
      "fallback",
    );
  }

  const expenses = await callExpenseTool("listExpenses", { period: "month", limit: 20 });
  return {
    assistantReply:
      "Expense Tracker needs the AI router online to extract spending from natural language. You can still ask again shortly.",
    toolCalls: [],
    expenses: expenses.expenses,
    total: expenses.total,
    byCategory: expenses.byCategory,
    agentTrace: ["Checked expense message", "Used fallback response"],
    metadata: {
      toolsUsed: ["expenseAgent"],
      toolSources: {
        expenseSkill: "fallback",
        answerGeneration: "fallback",
      },
    },
  };
}

function validateExpenseToolCall(action: Extract<AgentAction, { type: "tool_call" }>): string | null {
  if (action.toolName === "createExpense") {
    if (typeof action.arguments.amount !== "number") {
      return "createExpense requires numeric amount.";
    }

    if (typeof action.arguments.category !== "string" || typeof action.arguments.description !== "string") {
      return "createExpense requires string category and description.";
    }
  }

  if (action.toolName === "deleteExpense" && typeof action.arguments.target !== "string") {
    return "deleteExpense requires string target.";
  }

  if (["listExpenses", "expenseSummary"].includes(action.toolName)) {
    const period = action.arguments.period;
    if (period !== undefined && !["all", "today", "week", "month"].includes(String(period))) {
      return `${action.toolName} period must be all, today, week, or month.`;
    }
  }

  return null;
}

function normalizeExpenseToolArguments(
  toolName: ExpenseToolName,
  args: Record<string, unknown>,
  originalMessage: string,
): Record<string, unknown> {
  if (toolName === "createExpense") {
    const description = String(args.description || "expense").trim();
    return {
      ...args,
      category: typeof args.category === "string" ? normalizeExpenseCategory(args.category) : inferExpenseCategory(description),
      description,
    };
  }

  if (toolName === "listExpenses" || toolName === "expenseSummary") {
    const inferredCategory = extractExpenseCategory(originalMessage);
    return {
      ...args,
      period: normalizeExpensePeriod(args.period, originalMessage),
      ...(typeof args.category === "string" && args.category.trim()
        ? { category: normalizeExpenseCategory(args.category) }
        : inferredCategory
          ? { category: inferredCategory }
          : {}),
      ...(toolName === "listExpenses" ? { limit: typeof args.limit === "number" ? args.limit : 20 } : {}),
    };
  }

  return args;
}

function classifyExpenseFallback(message: string): Extract<AgentAction, { type: "tool_call" }> | null {
  const lowered = message.toLowerCase().trim();
  const createMatch = lowered.match(
    /(?:spent|paid|bought|purchase(?:d)?|log(?:ged)?|add(?:ed)?)\s+(?:aed|rs\.?|inr|usd|\$)?\s*(\d+(?:\.\d{1,2})?)\s+(?:on|for|at)?\s*(.+)/i,
  );

  if (createMatch?.[1]) {
    const amount = Number(createMatch[1]);
    const description = cleanupExpenseDescription(createMatch[2] || "expense");
    return {
      type: "tool_call",
      toolName: "createExpense",
      arguments: {
        amount,
        category: inferExpenseCategory(description),
        description,
      },
    };
  }

  if (/(show|list|view|all).*(expense|spending|spent)|expense|spending/.test(lowered) && !/(summary|summarize|total|insight)/.test(lowered)) {
    return {
      type: "tool_call",
      toolName: "listExpenses",
      arguments: {
        period: extractExpensePeriod(lowered, "all"),
        ...(extractExpenseCategory(lowered) ? { category: extractExpenseCategory(lowered) } : {}),
        limit: 20,
      },
    };
  }

  if (/(summary|summarize|total|insight|breakdown).*(expense|spending|spent)|how much/.test(lowered)) {
    return {
      type: "tool_call",
      toolName: "expenseSummary",
      arguments: {
        period: extractExpensePeriod(lowered, "month"),
        ...(extractExpenseCategory(lowered) ? { category: extractExpenseCategory(lowered) } : {}),
      },
    };
  }

  if (/(delete|remove).*(expense|spending|spent|\d+)/.test(lowered)) {
    const target = lowered.match(/\b\d+(?:st|nd|rd|th)?\b/)?.[0] || lowered;
    return {
      type: "tool_call",
      toolName: "deleteExpense",
      arguments: { target },
    };
  }

  return null;
}

function fallbackReplyForExpenseTool(toolName: ExpenseToolName, result: ExpenseToolResult): string {
  if (result.source === "fallback") {
    return result.summary || "I could not complete that expense action right now.";
  }

  if (toolName === "listExpenses") {
    if (!result.expenses.length) {
      return "I could not find any expenses yet.";
    }

    return `Here are your expenses:\n${result.expenses
      .slice(0, 10)
      .map((expense, index) => `${index + 1}. ${expense.description} - ${formatAmount(expense.amount)} (${expense.category})`)
      .join("\n")}`;
  }

  if (toolName === "expenseSummary") {
    const categories = result.byCategory
      ?.slice(0, 4)
      .map((item) => `${item.category}: ${formatAmount(item.total)}`)
      .join(", ");
    return categories
      ? `Your total spending is ${formatAmount(result.total || 0)}. Top categories: ${categories}.`
      : result.summary;
  }

  return result.summary;
}

function cleanupExpenseDescription(value: string): string {
  return value
    .replace(/\b(today|yesterday|tomorrow|this month|this week)\b/gi, "")
    .replace(/[.?!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase() || "expense";
}

function inferExpenseCategory(description: string): string {
  const lowered = description.toLowerCase();
  if (/(grocery|groceries|food|lunch|dinner|breakfast|coffee|restaurant|snack)/.test(lowered)) {
    return "food";
  }

  if (/(fuel|petrol|uber|taxi|bus|train|metro|parking)/.test(lowered)) {
    return "transport";
  }

  if (/(movie|cinema|game|netflix|show|concert)/.test(lowered)) {
    return "entertainment";
  }

  if (/(rent|electricity|water|internet|phone|bill)/.test(lowered)) {
    return "bills";
  }

  if (/(medicine|doctor|hospital|pharmacy)/.test(lowered)) {
    return "health";
  }

  return "other";
}

function extractExpenseCategory(message: string): string | null {
  const lowered = message.toLowerCase();
  if (/(food|grocery|groceries|lunch|dinner|breakfast|coffee|restaurant|snack)/.test(lowered)) {
    return "food";
  }

  if (/(transport|fuel|petrol|uber|taxi|bus|train|metro|parking)/.test(lowered)) {
    return "transport";
  }

  if (/(entertainment|movie|cinema|game|netflix|show|concert)/.test(lowered)) {
    return "entertainment";
  }

  if (/(bill|bills|rent|electricity|water|internet|phone)/.test(lowered)) {
    return "bills";
  }

  if (/(health|medicine|doctor|hospital|pharmacy)/.test(lowered)) {
    return "health";
  }

  if (/(shopping|clothes|clothing|mall)/.test(lowered)) {
    return "shopping";
  }

  return null;
}

function normalizeExpenseCategory(category: string): string {
  const inferred = extractExpenseCategory(category);
  return inferred || category.replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeExpensePeriod(value: unknown, originalMessage: string): "all" | "today" | "week" | "month" {
  if (value !== undefined && ["all", "today", "week", "month"].includes(String(value))) {
    return String(value) as "all" | "today" | "week" | "month";
  }

  return extractExpensePeriod(originalMessage.toLowerCase(), "month");
}

function extractExpensePeriod(message: string, fallback: "all" | "today" | "week" | "month"): "all" | "today" | "week" | "month" {
  if (message.includes("today")) {
    return "today";
  }

  if (message.includes("week")) {
    return "week";
  }

  if (message.includes("month")) {
    return "month";
  }

  if (message.includes("all")) {
    return "all";
  }

  return fallback;
}

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
}

function sanitizeExpenseResult(result: ExpenseToolResult): Record<string, unknown> {
  return {
    source: result.source,
    summary: result.summary,
    expense: result.expense,
    total: result.total,
    count: result.count,
    byCategory: result.byCategory,
    expenses: result.expenses.slice(0, 20).map((expense, index) => ({
      number: index + 1,
      amount: expense.amount,
      category: expense.category,
      description: expense.description,
      date: expense.date,
    })),
  };
}

function traceForExpenseTool(toolName: ExpenseToolName): string {
  const labels: Record<ExpenseToolName, string> = {
    createExpense: "Logged expense",
    listExpenses: "Loaded expenses",
    expenseSummary: "Calculated spending summary",
    deleteExpense: "Deleted expense",
  };
  return labels[toolName];
}

function isExpenseToolName(value: string): value is ExpenseToolName {
  return ["createExpense", "listExpenses", "expenseSummary", "deleteExpense"].includes(value);
}
