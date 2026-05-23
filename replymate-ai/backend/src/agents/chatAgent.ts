import { hasNvidiaApiKey } from "../utils/env";
import { safeParseJson } from "../utils/safeJson";
import { callMcpTool } from "../mcp/mcpClient";

type ChatIntent = "general" | "create_todo" | "list_todos" | "complete_todo" | "delete_todo" | "update_todo";
type Source = "static" | "llm" | "fallback";

type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

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
  todo?: TodoItem;
  todos?: TodoItem[];
  matchedTodos?: TodoItem[];
};

type TodoListFilter = "all" | "open" | "completed";

const defaultBaseUrl = "https://integrate.api.nvidia.com/v1";
const defaultModel = "meta/llama-3.1-8b-instruct";
const chatIntents: ChatIntent[] = [
  "general",
  "create_todo",
  "list_todos",
  "complete_todo",
  "delete_todo",
  "update_todo",
];

export async function handleChatMessage(message: string): Promise<ChatResponse> {
  const trace = ["Checked chat message", "Classified intent"];
  const classification = enforceTodoIntent(message, await classifyChatMessage(message));
  const toolCalls: ChatResponse["toolCalls"] = [];
  const toolsUsed = ["classifyIntent"];
  const todosSnapshotBefore = await getTodosSnapshot();

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

    const mcpResult = await callTodoSkill("createTodo", { title });
    const todo = mcpResult.todo;
    if (!todo) {
      return buildGeneralResponse({
        message,
        trace,
        classification,
        toolCalls,
        toolsUsed,
        todos: mcpResult.todos || todosSnapshotBefore,
      });
    }

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
      todos: mcpResult.todos || [todo],
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
    const listFilter = getTodoListFilter(message);
    const mcpResult = await callTodoSkill("listTodos", { filter: listFilter });
    const todos = mcpResult.todos || [];
    trace.push("Loaded todo list");
    toolCalls.push({
      name: "listTodos",
      source: mcpResult.source,
      summary: mcpResult.summary || `Found ${todos.length} todo${todos.length === 1 ? "" : "s"}`,
    });
    return {
      assistantReply: formatFilteredTodoListReply(todos, listFilter),
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
      const mcpResult = await callTodoSkill("completeTodo", { target: identifier });
      const updated = mcpResult.todo;
      if (updated) {
        const completedCount = mcpResult.matchedTodos?.length || 1;
        trace.push("Marked todo completed");
        toolCalls.push({
          name: "completeTodo",
          source: mcpResult.source,
          summary: mcpResult.summary || `Completed todo: ${updated.title}`,
        });
        return {
          assistantReply:
            completedCount > 1
              ? mcpResult.summary || `Marked ${completedCount} todos complete.`
              : `Marked complete: ${updated.title}`,
          intent: classification.intent,
          toolCalls,
          todos: mcpResult.todos || [],
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
      const mcpResult = await callTodoSkill("deleteTodo", { target: identifier });
      if (isDeleteAllTarget(identifier)) {
        trace.push("Deleted todo items");
        toolCalls.push({
          name: "deleteTodo",
          source: mcpResult.source,
          summary: mcpResult.summary,
        });
        return {
          assistantReply:
            (mcpResult.count || 0) > 0
              ? mcpResult.summary
              : "There were no todos to delete.",
          intent: classification.intent,
          toolCalls,
          todos: mcpResult.todos || [],
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

      const deleted = mcpResult.todo;
      if (deleted) {
        const deletedCount = mcpResult.matchedTodos?.length || 1;
        trace.push("Deleted todo item");
        toolCalls.push({
          name: "deleteTodo",
          source: mcpResult.source,
          summary: mcpResult.summary || `Deleted todo: ${deleted.title}`,
        });
        return {
          assistantReply:
            deletedCount > 1
              ? mcpResult.summary || `Deleted ${deletedCount} todos.`
              : `Deleted todo: ${deleted.title}`,
          intent: classification.intent,
          toolCalls,
          todos: mcpResult.todos || [],
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
      });
      const updated = mcpResult.todo;
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
          todos: mcpResult.todos || [],
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

function enforceTodoIntent(message: string, classification: ClassificationResult): ClassificationResult {
  const normalized = message.toLowerCase();

  if (
    (normalized.includes("delete") || normalized.includes("remove")) &&
    (normalized.includes("todo") || normalized.includes("task"))
  ) {
    return {
      ...classification,
      intent: "delete_todo",
      confidence: Math.max(classification.confidence, 0.92),
      source: "static",
      todoTarget: extractTodoTarget(message),
    };
  }

  if (
    (normalized.includes("show") ||
      normalized.includes("list") ||
      normalized.includes("what") ||
      normalized.includes("my")) &&
    (normalized.includes("todo") || normalized.includes("task"))
  ) {
    return {
      ...classification,
      intent: "list_todos",
      confidence: Math.max(classification.confidence, 0.9),
      source: "static",
    };
  }

  if (
    (normalized.includes("mark") ||
      normalized.includes("complete") ||
      normalized.includes("finish") ||
      normalized.includes("done")) &&
    (normalized.includes("todo") || normalized.includes("task"))
  ) {
    return {
      ...classification,
      intent: "complete_todo",
      confidence: Math.max(classification.confidence, 0.9),
      source: "static",
      todoTarget: extractTodoTarget(message),
    };
  }

  return classification;
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
      todos: [],
    };
  }
}

async function getTodosSnapshot(): Promise<TodoItem[]> {
  const result = await callTodoSkill("listTodos", {});
  return result.todos || [];
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

  if (
    (normalized.includes("delete") || normalized.includes("remove")) &&
    (normalized.includes("todo") || normalized.includes("task"))
  ) {
    return {
      intent: "delete_todo",
      confidence: 0.92,
      reason: "Delete request detected.",
      source: "static",
      todoTarget: extractTodoTarget(message),
    };
  }

  if (
    (normalized.includes("mark") ||
      normalized.includes("complete") ||
      normalized.includes("finish") ||
      normalized.includes("done")) &&
    (normalized.includes("todo") || normalized.includes("task"))
  ) {
    return {
      intent: "complete_todo",
      confidence: 0.9,
      reason: "Completion request detected.",
      source: "static",
      todoTarget: extractTodoTarget(message),
    };
  }

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
    task:
      "Route the user's chat message. If the user is asking to create, list, complete, delete, or update todos, choose the matching todo intent so the backend can call the todo MCP tool. Only choose general for normal questions that do not require a todo tool.",
    allowedIntents: chatIntents,
    rules: [
      "Return only valid JSON.",
      "No markdown.",
      "Use short user-safe reasons.",
      "For create_todo, extract the todoTitle as the task text only.",
      "For complete_todo/delete_todo/update_todo, extract todoTarget as the number, ordinal, id, or title fragment.",
      "For update_todo, also extract replacementText as the new todo text.",
      "Natural reminder language like 'don't let me forget', 'I need to remember', or 'remind me' should usually be create_todo.",
      "Numbered references like '2', 'second', '2nd', or '1 and 3' should remain in todoTarget.",
    ],
    examples: [
      {
        message: "please make sure I don't forget to submit the visa form",
        output: {
          intent: "create_todo",
          confidence: 0.86,
          reason: "Reminder-style todo request.",
          todoTitle: "submit the visa form",
        },
      },
      {
        message: "what do I still need to do?",
        output: {
          intent: "list_todos",
          confidence: 0.84,
          reason: "User is asking for their todo list.",
        },
      },
      {
        message: "mark 2 and 4 done",
        output: {
          intent: "complete_todo",
          confidence: 0.9,
          reason: "User wants numbered todos completed.",
          todoTarget: "2 and 4",
        },
      },
      {
        message: "change the second one to call John after lunch",
        output: {
          intent: "update_todo",
          confidence: 0.88,
          reason: "User wants to update a numbered todo.",
          todoTarget: "second",
          replacementText: "call John after lunch",
        },
      },
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
  if (!parsed || typeof parsed.intent !== "string" || !isChatIntent(parsed.intent)) {
    return null;
  }

  const intent = parsed.intent;
  return {
    intent,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    reason: typeof parsed.reason === "string" ? parsed.reason : "LLM classification.",
    source: "llm",
    todoTitle:
      typeof parsed.todoTitle === "string"
        ? parsed.todoTitle
        : intent === "create_todo"
          ? extractTodoTitle(message)
          : undefined,
    todoTarget:
      typeof parsed.todoTarget === "string"
        ? parsed.todoTarget
        : ["complete_todo", "delete_todo", "update_todo"].includes(intent)
          ? extractTodoTarget(message)
          : undefined,
    replacementText:
      typeof parsed.replacementText === "string"
        ? parsed.replacementText
        : intent === "update_todo"
          ? extractReplacementText(message)
          : undefined,
  };
}

function isChatIntent(value: string): value is ChatIntent {
  return chatIntents.includes(value as ChatIntent);
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
  return formatFilteredTodoListReply(todos, "all");
}

function formatFilteredTodoListReply(todos: TodoItem[], filter: TodoListFilter): string {
  if (!todos.length) {
    if (filter === "completed") {
      return "You do not have any completed todos yet.";
    }

    if (filter === "open") {
      return "You do not have any open todos.";
    }

    return "You do not have any todos yet.";
  }

  const lines = todos.map((todo, index) => {
    const status = todo.completed ? "done" : "open";
    return `${index + 1}. ${todo.title} (${status})`;
  });

  const label =
    filter === "completed" ? "completed todos" : filter === "open" ? "open todos" : "todos";
  return `Here are your ${label}:\n${lines.join("\n")}`;
}

function extractTodoTitle(message: string): string {
  const cleaned = message
    .replace(/^(add|create|make|new|remind me to|remember to)\s+(a\s+)?(todo|task)\s+(to\s+)?/i, "")
    .replace(/^(todo|task)\s*:\s*/i, "")
    .trim();

  return cleaned || message.trim();
}

function extractTodoTarget(message: string): string {
  const updateMatch = message.match(/(?:update|rename|change)\s+(?:the\s+)?(.+?)\s+(?:to|as)\s+.+$/i);
  if (updateMatch?.[1]) {
    return cleanTodoTarget(updateMatch[1]);
  }

  const ordinalMatch = message.match(/\b(\d+(?:st|nd|rd|th)?|first|second|third|fourth|fifth|last)\b/i);
  if (ordinalMatch?.[1] && /todo|task/i.test(message)) {
    return ordinalMatch[1].trim();
  }

  const match = message.match(/(?:complete|mark|delete|remove|update|rename|change)\s+(?:the\s+)?(.+?)(?:\s+todo)?$/i);
  if (match?.[1]) {
    return cleanTodoTarget(match[1]);
  }

  return cleanTodoTarget(message);
}

function cleanTodoTarget(value: string): string {
  const originalTarget = value.trim();
  const cleaned = originalTarget
    .replace(/\b(todo|todos|task|tasks|complete|completed|done|as|mark|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return (
    cleaned ||
    originalTarget
      .replace(/^(delete|remove|complete|mark)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function isDeleteAllTarget(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return [
    "all todos",
    "all todo",
    "all tasks",
    "the todos",
    "the tasks",
    "todos",
    "tasks",
    "them all",
    "everything",
  ].includes(normalized);
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
    message.includes("show completed todos") ||
    message.includes("completed todos") ||
    message.includes("done todos") ||
    message.includes("open todos") ||
    message.includes("incomplete todos") ||
    message.includes("pending todos") ||
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
    (message.startsWith("mark ") && message.includes("complete")) ||
    (message.startsWith("mark ") && message.includes("done")) ||
    message.includes("mark as done") ||
    message.startsWith("complete ") ||
    message.startsWith("done ") ||
    message.includes("finish todo")
  );
}

function isDeleteTodoRequest(message: string): boolean {
  return (
    message.includes("delete todo") ||
    message.includes("delete the todo") ||
    message.includes("delete all todo") ||
    message.includes("delete all task") ||
    message.includes("remove todo") ||
    message.includes("remove the todo") ||
    message.includes("remove all todo") ||
    message.includes("remove all task") ||
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

function getTodoListFilter(message: string): TodoListFilter {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("completed") ||
    normalized.includes("done todo") ||
    normalized.includes("finished")
  ) {
    return "completed";
  }

  if (
    normalized.includes("open") ||
    normalized.includes("incomplete") ||
    normalized.includes("pending")
  ) {
    return "open";
  }

  return "all";
}
