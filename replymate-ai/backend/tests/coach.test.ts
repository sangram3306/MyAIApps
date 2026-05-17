import test from "node:test";
import assert from "node:assert/strict";
import { handleCoachAnalyze } from "../src/routes/coachRoutes";

test("POST /api/coach/analyze returns coaching response", async () => {
  const originalFetch = globalThis.fetch;
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";
  process.env.MCP_SERVER_URL = "http://mock-mcp";
  process.env.MCP_SHARED_SECRET = "shared-secret";
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/tools/classifyIntent")) {
      return jsonResponse({ intent: "request", confidence: 0.9, reason: "static", source: "static" });
    }
    if (url.includes("/tools/detectEmotion")) {
      return jsonResponse({ emotion: "urgent", confidence: 0.9, reason: "static", source: "static" });
    }
    if (url.includes("/tools/relationshipRules")) {
      return jsonResponse({
        styleRules: ["Be clear", "Stay professional"],
        avoid: ["Be casual"],
        recommendedFormality: "formal",
        confidence: 0.92,
        source: "static",
      });
    }
    if (url.includes("/tools/riskAssessment")) {
      return jsonResponse({
        riskLevel: "medium",
        risks: ["Timing sensitivity"],
        recommendedHandling: "Acknowledge and offer a next step.",
        confidence: 0.88,
        source: "static",
      });
    }
    if (url.includes("/tools/qualityCheck")) {
      return jsonResponse({
        passed: true,
        score: 0.95,
        issues: [],
        improvedReply: "Thanks for the update. I'll review this and get back to you shortly.",
        confidence: 0.9,
        source: "static",
      });
    }
    if (url.includes("/chat/completions")) {
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestedTone: "calm and professional",
                strategy: "Acknowledge the concern and offer a short next step.",
                doTips: ["Acknowledge the issue", "Stay concise", "Offer a next step"],
                dontTips: ["Do not sound defensive", "Do not over-explain", "Do not use slang"],
                recommendedReply: "Thanks for the update. I'll review this and get back to you shortly.",
              }),
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch call: ${url} ${init?.method || "GET"}`);
  };

  try {
    const response = await invokeCoachAnalyze({
      message: "Can you review this today?",
      relationshipContext: "Client",
    });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.equal(data.intent, "request");
    assert.equal(data.emotion, "urgent");
    assert.equal(data.riskLevel, "medium");
    assert.equal(data.recommendedReply, "Thanks for the update. I'll review this and get back to you shortly.");
    assert.ok(Array.isArray(data.agentTrace));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

async function invokeCoachAnalyze(body: unknown): Promise<{ statusCode: number; body: unknown }> {
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

  await handleCoachAnalyze({ body }, res);
  return { statusCode, body: responseBody };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
