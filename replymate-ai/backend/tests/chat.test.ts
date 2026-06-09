import assert from "node:assert/strict";
import test from "node:test";
import { handleChatMessageRequest } from "../src/routes/chatRoutes";

test("POST /api/chat/message returns a direct LLM response", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.NVIDIA_API_KEY;
  process.env.NVIDIA_API_KEY = "test-key";

  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "Sure. Here is a direct answer from SP ONE AI.",
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const response = await invokeChatMessage({ message: "Explain MCP servers simply" });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.equal(data.intent, "general");
    assert.equal(data.assistantReply, "Sure. Here is a direct answer from SP ONE AI.");
    assert.deepEqual(data.toolCalls, []);
    assert.equal(Object.hasOwn(data, "todos"), false);
    assert.ok(Array.isArray(data.agentTrace));
    assert.ok(Array.isArray(data.agentEvents));
    assert.deepEqual((data.metadata as Record<string, unknown>).toolsUsed, ["directLlmChat"]);

    const messages = requestBody?.messages as Array<{ role: string; content: string }>;
    assert.equal(messages?.[1]?.content, "Explain MCP servers simply");
    assert.match(messages?.[0]?.content || "", /general-purpose assistant/i);
    assert.doesNotMatch(messages?.[0]?.content || "", /Todo Manager/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("NVIDIA_API_KEY", originalApiKey);
  }
});

test("POST /api/chat/message no longer routes todo commands to todo tools", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.NVIDIA_API_KEY;
  process.env.NVIDIA_API_KEY = "test-key";

  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "I can chat about that, but I cannot manage app data from this chat.",
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;

  try {
    const response = await invokeChatMessage({ message: "Show all todos" });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.equal(data.intent, "general");
    assert.deepEqual(data.toolCalls, []);
    assert.equal(Object.hasOwn(data, "todos"), false);
    assert.equal((data.metadata as Record<string, Record<string, string>>).toolSources.answerGeneration, "llm");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("NVIDIA_API_KEY", originalApiKey);
  }
});

test("POST /api/chat/message validates empty messages", async () => {
  const response = await invokeChatMessage({ message: "" });
  assert.equal(response.statusCode, 400);
});

async function invokeChatMessage(body: unknown): Promise<{ statusCode: number; body: unknown }> {
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

  await handleChatMessageRequest({ body }, res);
  return { statusCode, body: responseBody };
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
