import assert from "node:assert/strict";
import test from "node:test";
import { handleDecisionSimulateRequest } from "../src/routes/decisionRoutes";

test("POST /api/decisions/simulate runs a tool-backed decision simulation", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const originalNvidiaApiKey = process.env.NVIDIA_API_KEY;
  const originalNvidiaModel = process.env.NVIDIA_MODEL;
  const originalNvidiaBaseUrl = process.env.NVIDIA_BASE_URL;

  process.env.MCP_SERVER_URL = "http://mock-mcp";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";

  const simulations: Array<Record<string, unknown>> = [];
  const modelActions = [
    {
      type: "tool_call",
      toolName: "listDecisionSimulations",
      arguments: { limit: 5 },
      reason: "Check recent decisions first.",
    },
    {
      type: "tool_call",
      toolName: "saveDecisionSimulation",
      arguments: {
        question: "Should I switch jobs?",
        context: "Current job is stable but growth is slow.",
        category: "career",
        horizon: "next 3 months",
        stakes: "high",
        recommendation: "Interview seriously before resigning",
        recommendationSummary: "Explore the market without quitting yet.",
        confidence: 74,
        options: [
          {
            name: "Interview first",
            score: 82,
            pros: ["Keeps income safe"],
            cons: ["Takes time"],
            reasoning: "It protects downside while creating upside.",
          },
        ],
        keyFactors: ["Growth", "Stability"],
        tradeoffs: ["Speed versus safety"],
        risks: ["Leaving too soon"],
        assumptions: ["Market has relevant roles"],
        experiments: ["Apply to five roles"],
        nextSteps: ["Update resume"],
        regretCheck: "Would you regret not testing the market?",
        decisionRule: "Do not resign before a concrete offer.",
      },
      reason: "Save the completed simulation.",
    },
    {
      type: "final",
      assistantReply: "I recommend interviewing seriously before resigning. Saved the simulation.",
    },
  ];

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/chat/completions")) {
      const action = modelActions.shift();
      return jsonResponse({
        choices: [{ message: { content: JSON.stringify(action) } }],
      });
    }

    if (url.includes("/tools/listDecisionSimulations")) {
      return jsonResponse({
        source: "static",
        confidence: 0.98,
        summary: "Found saved decision simulations.",
        simulations,
        count: simulations.length,
      });
    }

    if (url.includes("/tools/saveDecisionSimulation")) {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      const now = new Date().toISOString();
      const simulation = {
        id: "decision-1",
        ...payload,
        createdAt: now,
        updatedAt: now,
      };
      simulations.unshift(simulation);
      return jsonResponse({
        source: "static",
        confidence: 0.97,
        summary: "Saved decision simulation.",
        simulation,
        simulations,
        count: simulations.length,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const response = await invokeDecision({
      question: "Should I switch jobs?",
      context: "Current job is stable but growth is slow.",
      options: ["Interview first", "Stay put", "Resign now"],
      horizon: "next 3 months",
      stakes: "high",
    });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.match(String(data.assistantReply), /interviewing seriously/i);
    assert.equal((data.simulation as Record<string, unknown>).recommendation, "Interview seriously before resigning");
    assert.equal((data.toolCalls as Array<unknown>).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
    restoreEnv("NVIDIA_API_KEY", originalNvidiaApiKey);
    restoreEnv("NVIDIA_MODEL", originalNvidiaModel);
    restoreEnv("NVIDIA_BASE_URL", originalNvidiaBaseUrl);
  }
});

async function invokeDecision(body: unknown): Promise<{ statusCode: number; body: unknown }> {
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

  await handleDecisionSimulateRequest({ body }, res);
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
