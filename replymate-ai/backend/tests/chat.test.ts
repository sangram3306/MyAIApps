import assert from "node:assert/strict";
import test from "node:test";
import { handleChatMessageRequest } from "../src/routes/chatRoutes";

test("POST /api/chat/message route answers general questions", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const originalNvidiaApiKey = process.env.NVIDIA_API_KEY;
  const originalNvidiaModel = process.env.NVIDIA_MODEL;
  const originalNvidiaBaseUrl = process.env.NVIDIA_BASE_URL;

  process.env.MCP_SERVER_URL = "http://mock-mcp";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/chat/completions")) {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  type: "final",
                  assistantReply: "A mockingbird can mimic the songs of other birds.",
                }),
              },
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    let statusCode = 200;
    let responseBody: any = null;
    const req = { body: { message: "What is a mockingbird?" } };
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: any) {
        responseBody = payload;
      },
    };

    await handleChatMessageRequest(req, res);

    assert.equal(statusCode, 200);
    assert.equal(responseBody.intent, "general");
    assert.equal(responseBody.assistantReply, "A mockingbird can mimic the songs of other birds.");

  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
    restoreEnv("NVIDIA_API_KEY", originalNvidiaApiKey);
    restoreEnv("NVIDIA_MODEL", originalNvidiaModel);
    restoreEnv("NVIDIA_BASE_URL", originalNvidiaBaseUrl);
  }
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}
