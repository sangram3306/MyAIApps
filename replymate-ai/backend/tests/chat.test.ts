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
    assert.match(String(data.assistantReply), /(Added|Created) todo/i);
    assert.ok(Array.isArray(data.todos));
    assert.equal((data.todos as Array<unknown>).length, 1);
    assert.ok(Array.isArray(data.toolCalls));
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
  }
});

test("POST /api/chat/message creates todos from natural reminder phrasing", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const mockMcp = createMockMcp();
  process.env.MCP_SERVER_URL = "http://mock-mcp";
  globalThis.fetch = mockMcp.fetch;

  try {
    const createResponse = await invokeChatMessage({
      message: "Please make sure i dont forget to submit visa form",
    });
    const createData = createResponse.body as Record<string, unknown>;

    assert.equal(createResponse.statusCode, 200);
    assert.equal(createData.intent, "create_todo");
    assert.match(String(createData.assistantReply), /submit visa form/i);
    assert.deepEqual(
      (createData.toolCalls as Array<Record<string, unknown>>).map((tool) => tool.name),
      ["createTodo"],
    );

    const listResponse = await invokeChatMessage({ message: "Show all todos" });
    const listData = listResponse.body as Record<string, unknown>;
    assert.match(String(listData.assistantReply), /submit visa form/i);
    assert.equal((listData.todos as Array<unknown>).length, 1);
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
    assert.match(String(completeData.assistantReply), /(Marked complete|Completed todo)/i);

    const listResponse = await invokeChatMessage({ message: "Show completed todos" });
    const listData = listResponse.body as Record<string, unknown>;
    assert.equal(listData.intent, "list_todos");
    assert.match(String(listData.assistantReply), /done/i);
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
  globalThis.fetch = mockMcp.fetch;

  try {
    const response = await invokeChatMessage({
      message: "could you keep this on my radar: submit the visa form",
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
                type: "final",
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

      if (url.includes("/chat/completions")) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify(classifyMockChatCompletion(init?.body)),
              },
            },
          ],
        });
      }

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

function classifyMockChatCompletion(body: BodyInit | null | undefined): Record<string, unknown> {
  const request = body ? JSON.parse(String(body)) as { messages?: Array<{ content?: string }> } : {};
  const prompt = request.messages?.at(-1)?.content || "";
  const parsedPrompt = safeJsonParse<{
    userMessage?: string;
    type?: string;
    toolName?: string;
    result?: {
      summary?: string;
      todo?: { title?: string };
      todos?: Array<{ title?: string; completed?: boolean }>;
    };
  }>(prompt);

  if (parsedPrompt?.type === "tool_result") {
    if (parsedPrompt.toolName === "listTodos") {
      const todos = parsedPrompt.result?.todos || [];
      const lines = todos.map((todo, index) => {
        const status = todo.completed ? "done" : "open";
        return `${index + 1}. ${todo.title} (${status})`;
      });
      return {
        type: "final",
        assistantReply: lines.length ? `Here are your todos:\n${lines.join("\n")}` : "You do not have any todos yet.",
      };
    }

    return {
      type: "final",
      assistantReply: parsedPrompt.result?.summary || "Done.",
    };
  }

  const message = (parsedPrompt?.userMessage || "").toLowerCase();

  if (message.includes("show") && (message.includes("todo") || message.includes("task"))) {
    return {
      type: "tool_call",
      toolName: "listTodos",
      arguments: {
        filter: message.includes("completed") ? "completed" : "all",
      },
      reason: "User asked to list todos.",
    };
  }

  if (
    (message.includes("mark") || message.includes("complete") || message.includes("done")) &&
    (message.includes("todo") || /\b\d+(?:st|nd|rd|th)?\b/.test(message))
  ) {
    return {
      type: "tool_call",
      toolName: "completeTodo",
      arguments: {
        target: extractMockTarget(message),
      },
      reason: "User asked to complete todos.",
    };
  }

  if (message.includes("delete") || message.includes("remove")) {
    return {
      type: "tool_call",
      toolName: "deleteTodo",
      arguments: {
        target: extractMockTarget(message),
      },
      reason: "User asked to delete todos.",
    };
  }

  if (message.includes("update") || message.includes("change") || message.includes("rename")) {
    return {
      type: "tool_call",
      toolName: "updateTodo",
      arguments: {
        target: extractMockTarget(message),
        replacementText: message.match(/(?:to|as)\s+(.+)$/)?.[1] || "",
      },
      reason: "User asked to update a todo.",
    };
  }

  if (
    message.includes("add") ||
    message.includes("remind me") ||
    message.includes("remember") ||
    message.includes("forget") ||
    message.includes("keep this on my radar")
  ) {
    return {
      type: "tool_call",
      toolName: "createTodo",
      arguments: {
        title: message
          .replace(/^add a todo to\s+/i, "")
          .replace(/^please make sure i dont forget to\s+/i, "")
          .replace(/^could you keep this on my radar:\s*/i, "")
          .trim(),
      },
      reason: "User asked to create a todo.",
    };
  }

  return {
    type: "final",
    assistantReply: "Here is a concise answer from the model.",
  };
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function extractMockTarget(message: string): string {
  const updateTarget = message.match(/(?:update|change|rename)\s+(.*?)\s+(?:to|as)\s+/);
  if (updateTarget?.[1]) {
    return updateTarget[1];
  }

  const numberMatches = message.match(/\b\d+(?:st|nd|rd|th)?\b/g);
  if (numberMatches?.length) {
    return numberMatches.join(" and ");
  }

  if (message.includes("todos")) {
    return "todos";
  }

  return message;
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
