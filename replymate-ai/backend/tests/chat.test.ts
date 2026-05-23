import assert from "node:assert/strict";
import test from "node:test";
import { handleChatMessageRequest } from "../src/routes/chatRoutes";

test("POST /api/chat/message creates a todo from a natural language command", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const mockMcp = createMockMcp();
  process.env.MCP_SERVER_URL = "http://mock-mcp";
  globalThis.fetch = mockMcp.fetch;

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
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
  }
});

test("POST /api/chat/message lists todos from the todo skill", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const mockMcp = createMockMcp();
  process.env.MCP_SERVER_URL = "http://mock-mcp";
  globalThis.fetch = mockMcp.fetch;

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
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
  }
});

test("POST /api/chat/message deletes all todos when asked to delete the todos", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const mockMcp = createMockMcp();
  process.env.MCP_SERVER_URL = "http://mock-mcp";
  globalThis.fetch = mockMcp.fetch;

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
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
  }
});

test("POST /api/chat/message completes ordinal todos and lists completed todos", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const mockMcp = createMockMcp();
  process.env.MCP_SERVER_URL = "http://mock-mcp";
  globalThis.fetch = mockMcp.fetch;

  try {
    await invokeChatMessage({ message: "Add a todo to remind me to go to theater" });
    await invokeChatMessage({ message: "Add a todo to go out for shopping tomorrow" });

    const completeResponse = await invokeChatMessage({ message: "Mark the 2nd todo complete" });
    const completeData = completeResponse.body as Record<string, unknown>;
    assert.equal(completeResponse.statusCode, 200);
    assert.equal(completeData.intent, "complete_todo");
    assert.match(String(completeData.assistantReply), /Marked complete/i);

    const listResponse = await invokeChatMessage({ message: "Show completed todos" });
    const listData = listResponse.body as Record<string, unknown>;
    assert.equal(listData.intent, "list_todos");
    assert.match(String(listData.assistantReply), /completed todos/i);
    assert.equal((listData.todos as Array<unknown>).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
  }
});

test("POST /api/chat/message applies numbered todo commands to stored records", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const mockMcp = createMockMcp();
  process.env.MCP_SERVER_URL = "http://mock-mcp";
  globalThis.fetch = mockMcp.fetch;

  try {
    await invokeChatMessage({ message: "Add a todo to first item" });
    await invokeChatMessage({ message: "Add a todo to second item" });
    await invokeChatMessage({ message: "Add a todo to third item" });

    const updateResponse = await invokeChatMessage({ message: "Update 2 to updated second item" });
    const updateData = updateResponse.body as Record<string, unknown>;
    assert.equal(updateData.intent, "update_todo");
    assert.match(String(updateData.assistantReply), /updated second item/i);

    const deleteResponse = await invokeChatMessage({ message: "Delete 1 and 3" });
    const deleteData = deleteResponse.body as Record<string, unknown>;
    assert.equal(deleteData.intent, "delete_todo");
    assert.match(String(deleteData.assistantReply), /Deleted 2 todos/i);
    assert.equal((deleteData.todos as Array<unknown>).length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
  }
});

test("POST /api/chat/message lets the LLM router trigger todo tools", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const originalNvidiaApiKey = process.env.NVIDIA_API_KEY;
  const originalNvidiaModel = process.env.NVIDIA_MODEL;
  const originalNvidiaBaseUrl = process.env.NVIDIA_BASE_URL;
  const mockMcp = createMockMcp();
  process.env.MCP_SERVER_URL = "http://mock-mcp";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/tools/")) {
      return mockMcp.fetch(input, init);
    }

    if (url.includes("/chat/completions")) {
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: "create_todo",
                confidence: 0.88,
                reason: "Reminder-style todo request.",
                todoTitle: "submit the visa form",
              }),
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const response = await invokeChatMessage({
      message: "please make sure I don't forget to submit the visa form",
    });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.equal(data.intent, "create_todo");
    assert.match(String(data.assistantReply), /submit the visa form/i);
    assert.deepEqual(
      (data.toolCalls as Array<Record<string, unknown>>).map((tool) => tool.name),
      ["createTodo"],
    );
    assert.equal((data.metadata as { toolSources: { classifyIntent: string } }).toolSources.classifyIntent, "llm");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
    restoreEnv("NVIDIA_API_KEY", originalNvidiaApiKey);
    restoreEnv("NVIDIA_MODEL", originalNvidiaModel);
    restoreEnv("NVIDIA_BASE_URL", originalNvidiaBaseUrl);
  }
});

test("POST /api/chat/message falls back to NVIDIA for general questions", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const mockMcp = createMockMcp();
  process.env.MCP_SERVER_URL = "http://mock-mcp";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/tools/")) {
      return mockMcp.fetch(input);
    }

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

function createMockMcp(): { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> } {
  const todos: Array<{
    id: string;
    title: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
  }> = [];

  return {
    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = String(input);
      const payload = init?.body ? JSON.parse(String(init.body)) as Record<string, string> : {};

      if (url.includes("/tools/listTodos")) {
        const filteredTodos =
          payload.filter === "completed"
            ? todos.filter((todo) => todo.completed)
            : payload.filter === "open"
              ? todos.filter((todo) => !todo.completed)
              : todos;
        return jsonResponse({
          source: "static",
          confidence: 0.98,
          summary: `Found ${filteredTodos.length} todos.`,
          todos: filteredTodos,
          count: filteredTodos.length,
        });
      }

      if (url.includes("/tools/createTodo")) {
        const now = new Date().toISOString();
        const todo = {
          id: `todo-${todos.length + 1}`,
          title: payload.title,
          completed: false,
          createdAt: now,
          updatedAt: now,
        };
        todos.unshift(todo);
        return jsonResponse({
          source: "static",
          confidence: 0.96,
          summary: `Created todo: ${todo.title}`,
          todo,
          todos,
          count: todos.length,
        });
      }

      if (url.includes("/tools/deleteTodo")) {
        if (payload.target?.toLowerCase().includes("todos")) {
          const count = todos.length;
          todos.splice(0, todos.length);
          return jsonResponse({
            source: "static",
            confidence: 0.88,
            summary: `Deleted ${count} todo${count === 1 ? "" : "s"}.`,
            todos,
            count,
          });
        }

        const indexes = resolveMockTargetIndexes(String(payload.target), todos);
        const deletedTodos = indexes
          .sort((a, b) => b - a)
          .map((index) => todos.splice(index, 1)[0])
          .filter(Boolean);
        const [todo] = deletedTodos;
        return jsonResponse({
          source: todo ? "static" : "fallback",
          confidence: todo ? 0.9 : 0.3,
          summary:
            deletedTodos.length > 1
              ? `Deleted ${deletedTodos.length} todos: ${deletedTodos.map((item) => item.title).join(", ")}`
              : todo
                ? `Deleted todo: ${todo.title}`
                : "Could not match the todo to delete.",
          todo,
          matchedTodos: deletedTodos,
          todos,
          count: todos.length,
        });
      }

      if (url.includes("/tools/completeTodo")) {
        const indexes = resolveMockTargetIndexes(String(payload.target), todos);
        const completedTodos = indexes.map((index) => todos[index]).filter(Boolean);
        completedTodos.forEach((todo) => {
          todo.completed = true;
          todo.updatedAt = new Date().toISOString();
        });
        const [todo] = completedTodos;

        return jsonResponse({
          source: todo ? "static" : "fallback",
          confidence: todo ? 0.9 : 0.3,
          summary:
            completedTodos.length > 1
              ? `Completed ${completedTodos.length} todos: ${completedTodos.map((item) => item.title).join(", ")}`
              : todo
                ? `Completed todo: ${todo.title}`
                : "Could not match the todo to complete.",
          todo,
          matchedTodos: completedTodos,
          todos,
          count: todos.length,
        });
      }

      if (url.includes("/tools/updateTodo")) {
        const indexes = resolveMockTargetIndexes(String(payload.target), todos);
        const todo = todos[indexes[0]];
        if (todo) {
          todo.title = String(payload.replacementText);
          todo.updatedAt = new Date().toISOString();
        }

        return jsonResponse({
          source: todo ? "static" : "fallback",
          confidence: todo ? 0.9 : 0.3,
          summary: todo ? `Updated todo: ${todo.title}` : "Could not match the todo to update.",
          todo,
          todos,
          count: todos.length,
        });
      }

      return jsonResponse({
        source: "fallback",
        confidence: 0.3,
        summary: "Unknown mock MCP tool.",
        todos,
      });
    },
  };
}

function resolveMockTargetIndexes(
  target: string,
  todos: Array<{ title: string }>,
): number[] {
  const numberMatches = target.match(/\b\d+(?:st|nd|rd|th)?\b/g);
  if (numberMatches?.length) {
    return [...new Set(numberMatches.map((value) => Number.parseInt(value, 10) - 1))].filter(
      (index) => index >= 0 && index < todos.length,
    );
  }

  const index = todos.findIndex((todo) => todo.title.toLowerCase().includes(target.toLowerCase()));
  return index >= 0 ? [index] : [];
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
