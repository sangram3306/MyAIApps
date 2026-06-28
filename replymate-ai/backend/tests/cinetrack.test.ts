import assert from "node:assert/strict";
import test from "node:test";
import { handleCineTrackChatRequest } from "../src/routes/cinetrackRoutes";

test("POST /api/cinetrack/chat validates empty messages", async () => {
  let statusCode = 200;
  let responseBody: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      responseBody = payload;
    },
  };
  await handleCineTrackChatRequest({ body: { message: "" } }, res);
  assert.equal(statusCode, 400);
});

test("POST /api/cinetrack/chat returns a cinetrack response", async () => {
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
    if (url.includes("/chat/completions")) {
      return jsonResponse({
        choices: [
          {
            message: {
              content: "You should watch The Matrix.",
            },
          },
        ],
      });
    }
    return jsonResponse({ source: "static", summary: "mock tool", confidence: 1 });
  };

  try {
    let statusCode = 200;
    let responseBody: unknown;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        responseBody = payload;
      },
    };
    await handleCineTrackChatRequest({ body: { message: "Recommend a movie" } }, res);

    assert.equal(statusCode, 200);
    const data = responseBody as Record<string, unknown>;
    assert.equal(data.assistantReply, "You should watch The Matrix.");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalMcpServerUrl === undefined) delete process.env.MCP_SERVER_URL; else process.env.MCP_SERVER_URL = originalMcpServerUrl;
    if (originalNvidiaApiKey === undefined) delete process.env.NVIDIA_API_KEY; else process.env.NVIDIA_API_KEY = originalNvidiaApiKey;
    if (originalNvidiaModel === undefined) delete process.env.NVIDIA_MODEL; else process.env.NVIDIA_MODEL = originalNvidiaModel;
    if (originalNvidiaBaseUrl === undefined) delete process.env.NVIDIA_BASE_URL; else process.env.NVIDIA_BASE_URL = originalNvidiaBaseUrl;
  }
});

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
