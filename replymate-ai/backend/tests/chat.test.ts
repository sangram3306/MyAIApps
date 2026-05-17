import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { handleChatMessageRequest } from "../src/routes/chatRoutes";

test("POST /api/chat/message creates a todo from a natural language command", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "replymate-chat-"));
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.TODO_STORE_PATH = path.join(tempDir, "todos.json");
  process.env.MCP_SERVER_URL = "";

  try {
    const response = await invokeChatMessage({ message: "Add a todo to call John tomorrow" });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.equal(data.intent, "create_todo");
    assert.equal(typeof data.assistantReply, "string");
    assert.match(String(data.assistantReply), /Added todo/i);
    assert.ok(Array.isArray(data.todos));
    assert.equal((data.todos as Array<unknown>).length, 1);
    assert.ok(Array.isArray(data.toolCalls));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.TODO_STORE_PATH;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
  }
});

test("POST /api/chat/message lists todos from the todo skill", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "replymate-chat-"));
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.TODO_STORE_PATH = path.join(tempDir, "todos.json");
  process.env.MCP_SERVER_URL = "";

  try {
    await invokeChatMessage({ message: "Add a todo to call John tomorrow" });
    const response = await invokeChatMessage({ message: "Show my todos" });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.equal(data.intent, "list_todos");
    assert.match(String(data.assistantReply), /Here are your todos/i);
    assert.ok(Array.isArray(data.todos));
    assert.equal((data.todos as Array<unknown>).length, 1);
    assert.ok(Array.isArray(data.agentTrace));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.TODO_STORE_PATH;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
  }
});

test("POST /api/chat/message deletes all todos when asked to delete the todos", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "replymate-chat-"));
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.TODO_STORE_PATH = path.join(tempDir, "todos.json");
  process.env.MCP_SERVER_URL = "";

  try {
    await invokeChatMessage({ message: "Add a todo to call John tomorrow" });
    await invokeChatMessage({ message: "Add a todo to send the report" });

    const deleteResponse = await invokeChatMessage({ message: "Delete the todos" });
    const deleteData = deleteResponse.body as Record<string, unknown>;

    assert.equal(deleteResponse.statusCode, 200);
    assert.equal(deleteData.intent, "delete_todo");
    assert.match(String(deleteData.assistantReply), /Deleted 2 todos/i);
    assert.equal((deleteData.todos as Array<unknown>).length, 0);

    const listResponse = await invokeChatMessage({ message: "Show my todos" });
    const listData = listResponse.body as Record<string, unknown>;

    assert.match(String(listData.assistantReply), /do not have any todos/i);
    assert.equal((listData.todos as Array<unknown>).length, 0);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.TODO_STORE_PATH;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
  }
});

test("POST /api/chat/message falls back to NVIDIA for general questions", async () => {
  const originalFetch = globalThis.fetch;
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "replymate-chat-"));
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  process.env.TODO_STORE_PATH = path.join(tempDir, "todos.json");
  process.env.MCP_SERVER_URL = "";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/chat/completions")) {
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                assistantReply: "Here is a concise answer from the model.",
              }),
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const response = await invokeChatMessage({ message: "What can you help me with?" });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.equal(data.intent, "general");
    assert.equal(data.assistantReply, "Here is a concise answer from the model.");
    assert.ok(Array.isArray(data.toolCalls));
    assert.equal((data.toolCalls as Array<unknown>).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
    delete process.env.TODO_STORE_PATH;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
    delete process.env.NVIDIA_API_KEY;
    delete process.env.NVIDIA_MODEL;
    delete process.env.NVIDIA_BASE_URL;
  }
});

async function invokeChatMessage(body: unknown): Promise<{ statusCode: number; body: unknown }> {
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

  await handleChatMessageRequest({ body }, res);
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
