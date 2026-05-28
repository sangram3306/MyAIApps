import assert from "node:assert/strict";
import test from "node:test";
import { handleExpenseIntelligenceRequest } from "../src/routes/expenseRoutes";

test("POST /api/expenses/intelligence returns a practical insight report", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const originalNvidiaApiKey = process.env.NVIDIA_API_KEY;
  const originalNvidiaModel = process.env.NVIDIA_MODEL;
  const originalNvidiaBaseUrl = process.env.NVIDIA_BASE_URL;

  process.env.MCP_SERVER_URL = "http://mock-mcp";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/tools/listExpenses")) {
      return jsonResponse({
        source: "static",
        confidence: 0.98,
        summary: "Loaded expenses.",
        expenses: [
          {
            id: "1",
            amount: 45,
            category: "food",
            description: "lunch",
            date: "2026-05-01",
            createdAt: "2026-05-01T10:00:00.000Z",
            updatedAt: "2026-05-01T10:00:00.000Z",
          },
          {
            id: "2",
            amount: 100,
            category: "transport",
            description: "fuel",
            date: "2026-05-02",
            createdAt: "2026-05-02T10:00:00.000Z",
            updatedAt: "2026-05-02T10:00:00.000Z",
          },
        ],
        total: 145,
        count: 2,
        byCategory: [
          { category: "food", total: 45, count: 1 },
          { category: "transport", total: 100, count: 1 },
        ],
      });
    }

    if (url.includes("/tools/expenseSummary")) {
      return jsonResponse({
        source: "static",
        confidence: 0.98,
        summary: "Expense summary loaded.",
        total: 145,
        count: 2,
        byCategory: [
          { category: "food", total: 45, count: 1 },
          { category: "transport", total: 100, count: 1 },
        ],
      });
    }

    if (url.includes("/chat/completions")) {
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                headline: "Transport is pushing the budget the hardest.",
                summary: "You spent more on transport than food in this period.",
                highlights: ["Transport is the largest category.", "Average spend is moderate."],
                opportunities: ["Set a transport cap.", "Group similar purchases."],
                anomalies: ["Fuel looks like the largest single expense."],
                recurringPatterns: ["Food appears repeatedly."],
                forecast: {
                  label: "Next month estimate",
                  amount: 150,
                  rationale: "Based on the current spending pace.",
                },
              }),
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch call: ${url} ${init?.method || "GET"}`);
  };

  try {
    const response = await invokeIntelligence({ period: "month" });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.equal(data.period, "month");
    assert.equal((data.intelligence as Record<string, unknown>).headline, "Transport is pushing the budget the hardest.");
    assert.equal((data.byCategory as Array<unknown>).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
    restoreEnv("NVIDIA_API_KEY", originalNvidiaApiKey);
    restoreEnv("NVIDIA_MODEL", originalNvidiaModel);
    restoreEnv("NVIDIA_BASE_URL", originalNvidiaBaseUrl);
  }
});

async function invokeIntelligence(body: unknown): Promise<{ statusCode: number; body: unknown }> {
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

  await handleExpenseIntelligenceRequest({ body }, res);
  return { statusCode, body: responseBody };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
