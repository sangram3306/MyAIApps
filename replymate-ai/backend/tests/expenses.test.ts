import assert from "node:assert/strict";
import test from "node:test";
import { handleExpenseMessageRequest } from "../src/routes/expenseRoutes";

test("POST /api/expenses/message logs an expense through LLM-selected MCP tool", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const originalNvidiaApiKey = process.env.NVIDIA_API_KEY;
  const originalNvidiaModel = process.env.NVIDIA_MODEL;
  const originalNvidiaBaseUrl = process.env.NVIDIA_BASE_URL;

  const mockMcp = createMockExpenseMcp();
  process.env.MCP_SERVER_URL = "http://mock-mcp";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";
  globalThis.fetch = mockMcp.fetch;

  try {
    const response = await invokeExpenseMessage({ message: "I spent 45 on groceries today" });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.match(String(data.assistantReply), /groceries/i);
    assert.deepEqual(
      (data.toolCalls as Array<Record<string, unknown>>).map((tool) => tool.name),
      ["createExpense"],
    );
    assert.equal((data.expenses as Array<unknown>).length, 1);
    assert.equal((data.metadata as { toolSources: { answerGeneration: string } }).toolSources.answerGeneration, "llm");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
    restoreEnv("NVIDIA_API_KEY", originalNvidiaApiKey);
    restoreEnv("NVIDIA_MODEL", originalNvidiaModel);
    restoreEnv("NVIDIA_BASE_URL", originalNvidiaBaseUrl);
  }
});

test("POST /api/expenses/message returns validation errors for empty messages", async () => {
  const response = await invokeExpenseMessage({ message: "" });
  assert.equal(response.statusCode, 400);
  assert.equal((response.body as { error?: string }).error, "Invalid request.");
});

async function invokeExpenseMessage(body: unknown): Promise<{ statusCode: number; body: unknown }> {
  let statusCode = 200;
  let responseBody: unknown = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      responseBody = payload;
    },
  };

  await handleExpenseMessageRequest({ body }, res);
  return { statusCode, body: responseBody };
}

function createMockExpenseMcp(): { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } {
  const expenses: Array<{
    id: string;
    amount: number;
    category: string;
    description: string;
    date: string;
    createdAt: string;
    updatedAt: string;
  }> = [];

  return {
    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = String(input);
      const payload = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};

      if (url.includes("/chat/completions")) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify(mockExpenseCompletion(init?.body)),
              },
            },
          ],
        });
      }

      if (url.includes("/tools/listExpenses")) {
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
        return jsonResponse({
          source: "static",
          confidence: 0.98,
          summary: `Found ${expenses.length} expenses totaling ${total}.`,
          expenses,
          total,
          count: expenses.length,
        });
      }

      if (url.includes("/tools/createExpense")) {
        const now = new Date().toISOString();
        const expense = {
          id: `expense-${expenses.length + 1}`,
          amount: Number(payload.amount),
          category: String(payload.category),
          description: String(payload.description),
          date: String(payload.date || now.slice(0, 10)),
          createdAt: now,
          updatedAt: now,
        };
        expenses.unshift(expense);
        return jsonResponse({
          source: "static",
          confidence: 0.96,
          summary: `Logged ${expense.amount} for ${expense.description} in ${expense.category}.`,
          expense,
          expenses,
          count: expenses.length,
        });
      }

      return jsonResponse({
        source: "fallback",
        confidence: 0.3,
        summary: "Unknown mock MCP tool.",
        expenses,
      });
    },
  };
}

function mockExpenseCompletion(body: BodyInit | null | undefined): Record<string, unknown> {
  const request = body ? JSON.parse(String(body)) as { messages?: Array<{ content?: string }> } : {};
  const latest = request.messages?.at(-1)?.content || "";
  const parsed = safeJsonParse<{
    userMessage?: string;
    type?: string;
    toolName?: string;
    toolResults?: Array<{ result?: { summary?: string } }>;
  }>(latest);

  if (parsed?.toolResults) {
    return {
      assistantReply: parsed.toolResults.map((toolResult) => toolResult.result?.summary).filter(Boolean).join(" "),
    };
  }

  if (parsed?.type === "tool_result") {
    return {
      type: "final",
      assistantReply: parsed.toolName === "createExpense" ? "I logged the groceries expense." : "Done.",
    };
  }

  const message = (parsed?.userMessage || "").toLowerCase();
  if (message.includes("spent")) {
    return {
      type: "tool_call",
      toolName: "createExpense",
      arguments: {
        amount: 45,
        category: "groceries",
        description: "groceries",
      },
    };
  }

  return {
    type: "final",
    assistantReply: "Ask me to log or summarize expenses.",
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
