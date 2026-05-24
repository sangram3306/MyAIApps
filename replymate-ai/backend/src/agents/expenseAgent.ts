import { callMcpTool } from "../mcp/mcpClient";
import { hasNvidiaApiKey } from "../utils/env";
import { safeParseJson } from "../utils/safeJson";

type Source = "static" | "llm" | "fallback";
type ExpenseToolName = "createExpense" | "listExpenses" | "expenseSummary" | "deleteExpense";

export type ExpenseItem = {
  id: string;
  amount: number;
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

const defaultBaseUrl = "https://integrate.api.nvidia.com/v1";
const defaultModel = "meta/llama-3.1-8b-instruct";
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
  if (!hasNvidiaApiKey()) {
    return fallbackExpenseResponse(message);
  }

  const trace = ["Checked expense message"];
  const toolCalls: ExpenseResponse["toolCalls"] = [];
  const observations: Array<{ toolName: ExpenseToolName; result: ExpenseToolResult }> = [];
  const initialExpenses = await callExpenseTool("listExpenses", { period: "month", limit: 20 });
  const messages: AgentMessage[] = [
    {
      role: "system",
      content:
        "You are an Expense Tracker agent. Use tool calls to log expenses, list expenses, delete expenses, and summarize spending. Return only valid JSON. Do not claim an expense was saved unless a tool_result confirms it.",
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

    const result = await callExpenseTool(action.toolName, action.arguments);
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
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const model = process.env.NVIDIA_MODEL || defaultModel;
  const baseUrl = process.env.NVIDIA_BASE_URL || defaultBaseUrl;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`NVIDIA API error: ${response.status}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  const parsed = safeParseJson<Partial<AgentAction>>(content || "");
  if (!parsed?.type) {
    throw new Error("Expense model returned invalid JSON.");
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

  throw new Error("Expense model returned unsupported action.");
}

async function synthesizeExpenseFinal(
  userMessage: string,
  observations: Array<{ toolName: ExpenseToolName; result: ExpenseToolResult }>,
  draftReply: string,
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const model = process.env.NVIDIA_MODEL || defaultModel;
  const baseUrl = process.env.NVIDIA_BASE_URL || defaultBaseUrl;
  if (!apiKey) {
    return draftReply;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return only valid JSON with assistantReply. Mention every expense tool action and include useful spending insight if totals/categories are available.",
        },
        {
          role: "user",
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
    }),
  });

  if (!response.ok) {
    throw new Error(`NVIDIA API error: ${response.status}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  const parsed = safeParseJson<{ assistantReply?: string }>(content || "");
  return parsed?.assistantReply || draftReply;
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
        expenseSkill: message ? "fallback" : "fallback",
        answerGeneration: "fallback",
      },
    },
  };
}

function validateExpenseToolCall(action: Extract<AgentAction, { type: "tool_call" }>): string | null {
  if (action.toolName === "createExpense" && typeof action.arguments.amount !== "number") {
    return "createExpense requires numeric amount.";
  }

  if (action.toolName === "deleteExpense" && typeof action.arguments.target !== "string") {
    return "deleteExpense requires string target.";
  }

  return null;
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
