import { hasNvidiaApiKey } from "../utils/env";
import { safeParseJson } from "../utils/safeJson";
import {
  completeTodo,
  createTodo,
  deleteTodo,
  listTodos,
  TodoItem,
  updateTodo,
} from "../services/todoStore";
import { callMcpTool } from "../mcp/mcpClient";

type ChatIntent = "general" | "create_todo" | "list_todos" | "complete_todo" | "delete_todo" | "update_todo";
type Source = "static" | "llm" | "fallback";

export type ChatResponse = {
  assistantReply: string;
  intent: ChatIntent;
  toolCalls: Array<{
    name: string;
    source: Source;
    summary: string;
  }>;
  todos: TodoItem[];
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      classifyIntent: Source;
      todoSkill: Source;
      answerGeneration: Source;
    };
  };
};

type ClassificationResult = {
  intent: ChatIntent;
  confidence: number;
  reason: string;
  source: Source;
  todoTitle?: string;
  todoTarget?: string;
  replacementText?: string;
};

type TodoMcpResult = {
  source: Source;
  confidence: number;
  summary: string;
  title?: string;
  matchedId?: string;
  matchedTitle?: string;
  replacementText?: string;
  count?: number;
};

const defaultBaseUrl = "https://integrate.api.nvidia.com/v1";
const defaultModel = "meta/llama-3.1-8b-instruct";

export async function handleChatMessage(message: string): Promise<ChatResponse> {
  const trace = ["Checked chat message", "Classified intent"];
  const classification = await classifyChatMessage(message);
  const toolCalls: ChatResponse["toolCalls"] = [];
  const toolsUsed = ["classifyIntent"];
  const todosSnapshotBefore = await listTodos();

  if (classification.intent === "create_todo") {
    const title = classification.todoTitle || extractTodoTitle(message);
    if (!title) {
      return buildGeneralResponse({
        message,
        trace,
        classification,
        toolCalls,
        toolsUsed,
        todos: todosSnapshotBefore,
      });
    }

    const mcpResult = await callTodoSkill("createTodo", {
      title,
      currentTodos: todosSnapshotBefore,
    });
    const todo = await createTodo(mcpResult.title || title);
    trace.push("Created todo item");
    toolCalls.push({
      name: "createTodo",
      source: mcpResult.source,
      summary: `Created todo: ${todo.title}`,
    });
    return {
      assistantReply: `Added todo: ${todo.title}`,
      intent: classification.intent,
      toolCalls,
      todos: await listTodos(),
      agentTrace: [...trace, "Returned todo confirmation"],
      metadata: {
        toolsUsed: [...toolsUsed, "createTodo"],
        toolSources: {
          classifyIntent: classification.source,
          todoSkill: mcpResult.source,
          answerGeneration: "static",
        },
      },
    };
  }

  if (classification.intent === "list_todos") {
    const todos = await listTodos();
    const mcpResult = await callTodoSkill("listTodos", { currentTodos: todos });
    trace.push("Loaded todo list");
    toolCalls.push({
      name: "listTodos",
      source: mcpResult.source,
      summary: mcpResult.summary || `Found ${todos.length} todo${todos.length === 1 ? "" : "s"}`,
    });
    return {
      assistantReply: formatTodoListReply(todos),
      intent: classification.intent,
      toolCalls,
      todos,
      agentTrace: [...trace, "Returned todo list"],
      metadata: {
        toolsUsed: [...toolsUsed, "listTodos"],
        toolSources: {
          classifyIntent: classification.source,
          todoSkill: mcpResult.source,
          answerGeneration: "static",
        },
      },
    };
  }

  if (classification.intent === "complete_todo") {
    const identifier = classification.todoTarget || extractTodoTarget(message);
    if (identifier) {
      const mcpResult = await callTodoSkill("completeTodo", {
        target: identifier,
        currentTodos: todosSnapshotBefore,
      });
      const updated = await completeTodo(mcpResult.matchedId || identifier);
      if (updated) {
        trace.push("Marked todo completed");
        toolCalls.push({
          name: "completeTodo",
          source: mcpResult.source,
          summary: `Completed todo: ${updated.title}`,
        });
        return {
          assistantReply: `Marked complete: ${updated.title}`,
          intent: classification.intent,
          toolCalls,
          todos: await listTodos(),
          agentTrace: [...trace, "Returned completion confirmation"],
          metadata: {
            toolsUsed: [...toolsUsed, "completeTodo"],
            toolSources: {
              classifyIntent: classification.source,
              todoSkill: mcpResult.source,
              answerGeneration: "static",
            },
          },
        };
      }
    }
  }

  if (classification.intent === "delete_todo") {
    const identifier = classification.todoTarget || extractTodoTarget(message);
    if (identifier) {
      const mcpResult = await callTodoSkill("deleteTodo", {
        target: identifier,
        currentTodos: todosSnapshotBefore,
      });
      const deleted = await deleteTodo(mcpResult.matchedId || identifier);
      if (deleted) {
        trace.push("Deleted todo item");
        toolCalls.push({
          name: "deleteTodo",
          source: mcpResult.source,
          summary: `Deleted todo: ${deleted.title}`,
        });
        return {
          assistantReply: `Deleted todo: ${deleted.title}`,
          intent: classification.intent,
          toolCalls,
          todos: await listTodos(),
          agentTrace: [...trace, "Returned delete confirmation"],
          metadata: {
            toolsUsed: [...toolsUsed, "deleteTodo"],
            toolSources: {
              classifyIntent: classification.source,
              todoSkill: mcpResult.source,
              answerGeneration: "static",
            },
          },
        };
      }
    }
  }

  if (classification.intent === "update_todo") {
    const identifier = classification.todoTarget || extractTodoTarget(message);
    const replacement = classification.replacementText || extractReplacementText(message);
    if (identifier && replacement) {
      const mcpResult = await callTodoSkill("updateTodo", {
        target: identifier,
        replacementText: replacement,
        currentTodos: todosSnapshotBefore,
      });
      const updated = await updateTodo(
        mcpResult.matchedId || identifier,
        mcpResult.replacementText || replacement,
      );
      if (updated) {
        trace.push("Updated todo item");
        toolCalls.push({
          name: "updateTodo",
          source: mcpResult.source,
          summary: `Updated todo to: ${updated.title}`,
        });
        return {
          assistantReply: `Updated todo: ${updated.title}`,
          intent: classification.intent,
          toolCalls,
          todos: await listTodos(),
          agentTrace: [...trace, "Returned update confirmation"],
          metadata: {
            toolsUsed: [...toolsUsed, "updateTodo"],
            toolSources: {
              classifyIntent: classification.source,
              todoSkill: mcpResult.source,
              answerGeneration: "static",
            },
          },
        };
      }
    }
  }

  return buildGeneralResponse({
    message,
    trace,
    classification,
    toolCalls,
    toolsUsed,
    todos: todosSnapshotBefore,
  });
}

async function callTodoSkill(toolName: string, payload: unknown): Promise<TodoMcpResult> {
  try {
    return await callMcpTool<TodoMcpResult>(toolName, payload, {
      timeoutMs: 5000,
      retries: 1,
    });
  } catch (error) {
    console.error("[chat] todo MCP tool fallback", {
      toolName,
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      source: "fallback",
      confidence: 0.3,
      summary: `Used local fallback for ${toolName}.`,
    };
  }
}

async function buildGeneralResponse({
  message,
  trace,
  classification,
  toolCalls,
  toolsUsed,
  todos,
}: {
  message: string;
  trace: string[];
  classification: ClassificationResult;
  toolCalls: ChatResponse["toolCalls"];
  toolsUsed: string[];
  todos: TodoItem[];
}): Promise<ChatResponse> {
  trace.push("Answered directly");

  if (!hasNvidiaApiKey()) {
    return {
      assistantReply: fallbackGeneralReply(message, todos),
      intent: "general",
      toolCalls,
      todos,
      agentTrace: [...trace, "Used fallback response"],
      metadata: {
        toolsUsed,
        toolSources: {
          classifyIntent: classification.source,
          todoSkill: "fallback",
          answerGeneration: "fallback",
        },
      },
    };
  }

  try {
    const assistantReply = await generateGeneralReply(message, todos);
    return {
      assistantReply,
      intent: "general",
      toolCalls,
      todos,
      agentTrace: [...trace, "Generated AI response"],
      metadata: {
        toolsUsed,
        toolSources: {
          classifyIntent: classification.source,
          todoSkill: "fallback",
          answerGeneration: "llm",
        },
      },
    };
  } catch (error) {
    console.error("[chat] general reply generation failed", error);
    return {
      assistantReply: fallbackGeneralReply(message, todos),
      intent: "general",
      toolCalls,
      todos,
      agentTrace: [...trace, "Used fallback response"],
      metadata: {
        toolsUsed,
        toolSources: {
          classifyIntent: classification.source,
          todoSkill: "fallback",
          answerGeneration: "fallback",
        },
      },
    };
  }
}

async function classifyChatMessage(message: string): Promise<ClassificationResult> {
  const staticMatch = classifyWithRules(message);
  if (staticMatch.confidence >= 0.8 || !hasNvidiaApiKey()) {
    return staticMatch;
  }

  try {
    const llmResult = await classifyWithNvidia(message);
    return llmResult ?? staticMatch;
  } catch (error) {
    console.error("[chat] classification fallback", error);
    return { ...staticMatch, source: "fallback" };
  }
}

function classifyWithRules(message: string): ClassificationResult {
  const normalized = message.toLowerCase();

  if (isListTodoRequest(normalized)) {
    return {
      intent: "list_todos",
      confidence: 0.96,
      reason: "List request detected.",
      source: "static",
    };
  }

  if (isCompleteTodoRequest(normalized)) {
    return {
      intent: "complete_todo",
      confidence: 0.9,
      reason: "Completion request detected.",
      source: "static",
      todoTarget: extractTodoTarget(message),
    };
  }

  if (isDeleteTodoRequest(normalized)) {
    return {
      intent: "delete_todo",
      confidence: 0.9,
      reason: "Delete request detected.",
      source: "static",
      todoTarget: extractTodoTarget(message),
    };
  }

  if (isUpdateTodoRequest(normalized)) {
    return {
      intent: "update_todo",
      confidence: 0.88,
      reason: "Update request detected.",
      source: "static",
      todoTarget: extractTodoTarget(message),
      replacementText: extractReplacementText(message),
    };
  }

  if (isCreateTodoRequest(normalized)) {
    return {
      intent: "create_todo",
      confidence: 0.92,
      reason: "Create request detected.",
      source: "static",
      todoTitle: extractTodoTitle(message),
    };
  }

  return {
    intent: "general",
    confidence: 0.4,
    reason: "No todo command matched.",
    source: "static",
  };
}

async function classifyWithNvidia(message: string): Promise<ClassificationResult | null> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const model = process.env.NVIDIA_MODEL || defaultModel;
  const baseUrl = process.env.NVIDIA_BASE_URL || defaultBaseUrl;
  if (!apiKey) {
    return null;
  }

  const prompt = JSON.stringify({
    task: "Classify the chat message into a chat intent for the ReplyMate AI chat assistant.",
    allowedIntents: ["general", "create_todo", "list_todos", "complete_todo", "delete_todo", "update_todo"],
    rules: [
      "Return only valid JSON.",
      "No markdown.",
      "Use short user-safe reasons.",
      "If a todo title is present, extract it.",
      "If an identifier or target todo is present, extract it.",
    ],
    message,
    outputSchema: {
      intent: "general | create_todo | list_todos | complete_todo | delete_todo | update_todo",
      confidence: 0.0,
      reason: "short string",
      todoTitle: "string | undefined",
      todoTarget: "string | undefined",
      replacementText: "string | undefined",
    },
  });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`NVIDIA API error: ${response.status}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  const parsed = safeParseJson<Partial<ClassificationResult>>(content);
  if (!parsed || typeof parsed.intent !== "string") {
    return null;
  }

  return {
    intent: parsed.intent as ChatIntent,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    reason: typeof parsed.reason === "string" ? parsed.reason : "LLM classification.",
    source: "llm",
    todoTitle: typeof parsed.todoTitle === "string" ? parsed.todoTitle : undefined,
    todoTarget: typeof parsed.todoTarget === "string" ? parsed.todoTarget : undefined,
    replacementText: typeof parsed.replacementText === "string" ? parsed.replacementText : undefined,
  };
}

async function generateGeneralReply(message: string, todos: TodoItem[]): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const model = process.env.NVIDIA_MODEL || defaultModel;
  const baseUrl = process.env.NVIDIA_BASE_URL || defaultBaseUrl;
  if (!apiKey) {
    return fallbackGeneralReply(message, todos);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are ReplyMate AI Chat. Answer general questions helpfully and concisely. Return only valid JSON with assistantReply.",
        },
        {
          role: "user",
          content: JSON.stringify({
            message,
            currentTodos: todos.slice(0, 10).map((todo) => ({
              id: todo.id,
              title: todo.title,
              completed: todo.completed,
            })),
            outputSchema: {
              assistantReply: "string",
            },
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`NVIDIA API error: ${response.status}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Model response did not include chat content.");
  }

  const parsed = safeParseJson<{ assistantReply?: string }>(content);
  if (!parsed?.assistantReply) {
    throw new Error("Model response did not contain a chat reply.");
  }

  return parsed.assistantReply;
}

function fallbackGeneralReply(message: string, todos: TodoItem[]): string {
  if (isTodoRelatedQuestion(message)) {
    if (!todos.length) {
      return "You do not have any todos yet. Try: Add a todo to call John tomorrow.";
    }

    return formatTodoListReply(todos);
  }

  return "I can help with general questions and todo commands like add, list, complete, update, or delete.";
}

function formatTodoListReply(todos: TodoItem[]): string {
  if (!todos.length) {
    return "You do not have any todos yet.";
  }

  const lines = todos.map((todo, index) => {
    const status = todo.completed ? "done" : "open";
    return `${index + 1}. ${todo.title} (${status})`;
  });

  return `Here are your todos:\n${lines.join("\n")}`;
}

function extractTodoTitle(message: string): string {
  const cleaned = message
    .replace(/^(add|create|make|new|remind me to|remember to)\s+(a\s+)?(todo|task)\s+(to\s+)?/i, "")
    .replace(/^(todo|task)\s*:\s*/i, "")
    .trim();

  return cleaned || message.trim();
}

function extractTodoTarget(message: string): string {
  const match = message.match(/(?:complete|mark|delete|remove|update|rename|change)\s+(?:the\s+)?(.+?)(?:\s+todo)?$/i);
  if (match?.[1]) {
    return match[1].trim();
  }

  return message.trim();
}

function extractReplacementText(message: string): string {
  const match = message.match(/(?:to|as)\s+(.+)$/i);
  return match?.[1]?.trim() || "";
}

function isCreateTodoRequest(message: string): boolean {
  return (
    message.includes("add a todo") ||
    message.includes("create a todo") ||
    message.includes("new todo") ||
    message.includes("todo to") ||
    message.startsWith("todo ") ||
    message.startsWith("task ") ||
    message.includes("remember to") ||
    message.includes("remind me to")
  );
}

function isListTodoRequest(message: string): boolean {
  return (
    message.includes("list todos") ||
    message.includes("show todos") ||
    message.includes("my todos") ||
    message.includes("what todos") ||
    message.includes("show my tasks") ||
    message.includes("list tasks")
  );
}

function isCompleteTodoRequest(message: string): boolean {
  return (
    message.includes("mark done") ||
    message.includes("complete todo") ||
    message.includes("mark as done") ||
    message.startsWith("complete ") ||
    message.startsWith("done ") ||
    message.includes("finish todo")
  );
}

function isDeleteTodoRequest(message: string): boolean {
  return (
    message.includes("delete todo") ||
    message.includes("remove todo") ||
    message.startsWith("delete ") ||
    message.startsWith("remove ")
  );
}

function isUpdateTodoRequest(message: string): boolean {
  return (
    message.includes("update todo") ||
    message.includes("rename todo") ||
    message.includes("change todo") ||
    message.startsWith("update ") ||
    message.startsWith("rename ")
  );
}

function isTodoRelatedQuestion(message: string): boolean {
  return message.includes("todo") || message.includes("task");
}
