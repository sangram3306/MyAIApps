import assert from "node:assert/strict";
import test from "node:test";
import { handleChatMessageRequest } from "../src/routes/chatRoutes";
import { mock } from "node:test";
import * as memoryService from "../src/services/memoryService";
import * as chatAgent from "../src/agents/chatAgent";

test("POST /api/chat/message returns a direct LLM response", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.NVIDIA_API_KEY;
  process.env.NVIDIA_API_KEY = "test-key";

  // This route recently changed to extract title natively inside the agent causing
  // the very first request to be for the agent chat but then immediately following
  // is a title request causing our fetch override to capture the title prompt as [0]
  // In the real system it doesn't fail but the assertions are now expecting the agent
  // messages not the title generation messages.

  let chatMessages: Array<{ role: string; content: string }> | undefined;

  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const requestBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
    const messages = requestBody.messages as Array<{ role: string; content: string }>;

    const bodyStr = String(init?.body || "");
    if (bodyStr.includes("EXTRACT_MEMORIES_PROMPT") || bodyStr.includes("extract")) {
       return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "[]",
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (messages && messages.length > 0 && messages[0].content.includes("Generate a very short title")) {
         return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: "Test Chat Title",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
    }

    // Only capture the actual chat agent messages
    if (messages && messages.length > 0 && messages[0].content.includes("general-purpose AI assistant")) {
      chatMessages = messages;
    }

    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: "Sure. Here is a direct answer from Tupu chat.",
            },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const response = await invokeChatMessage({ message: "Explain MCP servers simply" }, { authorization: "Bearer invalid" });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.equal(data.intent, "general");
    assert.equal(data.assistantReply, "Sure. Here is a direct answer from Tupu chat.");
    assert.deepEqual(data.toolCalls, []);
    assert.ok(Array.isArray(data.agentTrace));
    assert.ok(Array.isArray(data.agentEvents));
    assert.deepEqual((data.metadata as Record<string, unknown>).toolsUsed, ["directLlmChat"]);

    assert.match(chatMessages?.[1]?.content || "", /Explain MCP servers simply/i);
    assert.match(chatMessages?.[0]?.content || "", /general-purpose AI assistant/i);

  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("NVIDIA_API_KEY", originalApiKey);
  }
});

test("POST /api/chat/message validates empty messages", async () => {
  const response = await invokeChatMessage({ message: "" }, {});
  assert.equal(response.statusCode, 400);
});

async function invokeChatMessage(body: unknown, headers: Record<string, string> = {}): Promise<{ statusCode: number; body: unknown }> {
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

  await handleChatMessageRequest({ body, headers }, res);
  return { statusCode, body: responseBody };
}

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
