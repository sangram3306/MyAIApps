import { hasNvidiaApiKey } from "../utils/env";
import { safeParseJson } from "../utils/safeJson";
import { callMcpTool } from "../mcp/mcpClient";

type ChatIntent = "general" | "create_todo" | "list_todos" | "complete_todo" | "delete_todo" | "update_todo";
type Source = "static" | "llm" | "fallback";
type TodoListFilter = "all" | "open" | "completed";
type TodoToolName = "createTodo" | "listTodos" | "completeTodo" | "deleteTodo" | "updateTodo";

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

type AgentToolDefinition = {
  name: TodoToolName;
  skill: "Todo Manager";
  usesDb: boolean;
  description: string;
  schema: Record<string, unknown>;
};

type AgentToolCall = {
  type: "tool_call";
  toolName: TodoToolName;
  arguments: Record<string, unknown>;
  reason?: string;
};

type AgentFinal = {
  type: "final";
  assistantReply: string;
};

type AgentAction = AgentToolCall | AgentFinal;

type AgentMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const defaultBaseUrl = "https://integrate.api.nvidia.com/v1";
const defaultModel = "meta/llama-3.1-8b-instruct";
const maxAgentTurns = 5;

const todoTools: AgentToolDefinition[] = [
  {
    name: "createTodo",
    skill: "Todo Manager",
    usesDb: true,
    description: "Create one todo in MongoDB. Use for reminders, tasks to remember, or things the user wants saved.",
    schema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", description: "The todo text only." },
      },
    },
  },
  {
    name: "listTodos",
    skill: "Todo Manager",
    usesDb: true,
    description: "List todos from MongoDB. Use when the user asks to show, list, view, or check todos.",
    schema: {
      type: "object",
      properties: {
        filter: { type: "string", enum: ["all", "open", "completed"], default: "all" },
      },
    },
  },
  {
    name: "completeTodo",
    skill: "Todo Manager",
    usesDb: true,
    description:
      "Mark one or more todos complete in MongoDB. Use numbered references exactly as the user says, such as '2', '2nd', or '1 and 3'.",
    schema: {
      type: "object",
      required: ["target"],
      properties: {
        target: { type: "string", description: "Todo id, title fragment, number, ordinal, or multi-number target." },
      },
    },
  },
  {
    name: "deleteTodo",
    skill: "Todo Manager",
    usesDb: true,
    description:
      "Delete one, many, or all todos from MongoDB. Use numbered references exactly as the user says, or 'todos' for all todos.",
    schema: {
      type: "object",
      required: ["target"],
      properties: {
        target: { type: "string", description: "Todo id, title fragment, number, ordinal, multi-number target, or all target." },
      },
    },
  },
  {
    name: "updateTodo",
    skill: "Todo Manager",
    usesDb: true,
    description: "Update one todo in MongoDB.",
    schema: {
      type: "object",
      required: ["target", "replacementText"],
      properties: {
        target: { type: "string", description: "Todo id, title fragment, number, or ordinal." },
        replacementText: { type: "string", description: "The new todo text." },
      },
    },
  },
];

export async function handleChatMessage(message: string): Promise<ChatResponse> {
  if (!hasNvidiaApiKey()) {
    return runStaticFallback(message, "fallback");
  }

  try {
    return await runAgentLoop(message);
  } catch (error) {
    console.error("[chat] agent loop fallback", error);
    return runStaticFallback(message, "fallback");
  }
}

async function runAgentLoop(message: string): Promise<ChatResponse> {
  const trace = ["Checked chat message"];
  const toolCalls: ChatResponse["toolCalls"] = [];
  const observations: Array<{ toolName: TodoToolName; result: TodoMcpResult }> = [];
  const initialTodos = await getTodosSnapshot();
  const messages: AgentMessage[] = [
    {
      role: "system",
      content:
        "You are ReplyMate AI Chat running an industry-style ReAct/tool-calling loop. You may either call exactly one allowed tool or return a final answer. Never claim a tool action succeeded unless you received a tool_result observation. Return only valid JSON. Do not include private chain-of-thought.",
    },
    {
      role: "user",
      content: JSON.stringify({
        userMessage: message,
        skills: [
          {
            name: "Todo Manager",
            description: "Manage user todos through protected MCP tools. Todo tools read/write MongoDB.",
          },
          {
            name: "Answer Generator",
            description: "Answer general questions directly when no tool is needed.",
          },
        ],
        availableTools: todoTools,
        currentTodos: initialTodos.map((todo, index) => ({
          number: index + 1,
          id: todo.id,
          title: todo.title,
          completed: todo.completed,
        })),
        instructions: [
          "If the user asks to create, list, complete, delete, or update todos, return a tool_call.",
          "If the user references a numbered todo, pass that number or ordinal in the tool arguments.",
          "After a tool_result observation, either call another tool if needed or return final.",
          "For final answers after todo tools, summarize the actual tool_result only.",
          "For normal non-tool questions, return final directly.",
        ],
        responseSchemas: {
          toolCall: {
            type: "tool_call",
            toolName: "createTodo | listTodos | completeTodo | deleteTodo | updateTodo",
            arguments: "object matching the selected tool schema",
            reason: "short user-safe reason",
          },
          final: {
            type: "final",
            assistantReply: "string",
          },
        },
      }),
    },
  ];

  for (let turn = 0; turn < maxAgentTurns; turn += 1) {
    const action = await callAgentModel(messages);

    if (action.type === "final") {
      trace.push(observations.length ? "Generated final answer" : "Answered directly");
      const assistantReply = observations.length
        ? await synthesizeFinalAnswer(message, observations, action.assistantReply)
        : action.assistantReply;
      return buildAgentResponse({
        assistantReply,
        intent: inferIntentFromToolCalls(toolCalls),
        toolCalls,
        todos: latestTodos(observations, initialTodos),
        trace,
        answerSource: "llm",
      });
    }

    const validationError = validateToolCall(action);
    if (validationError) {
      messages.push({
        role: "assistant",
        content: JSON.stringify(action),
      });
      messages.push({
        role: "user",
        content: JSON.stringify({
          type: "tool_result",
          toolName: action.toolName,
          error: validationError,
        }),
      });
      trace.push("Rejected invalid tool call");
      continue;
    }

    trace.push(shortTraceForTool(action.toolName));
    const result = await executeTodoTool(action.toolName, action.arguments);
    observations.push({ toolName: action.toolName, result });
    toolCalls.push({
      name: action.toolName,
      source: result.source,
      summary: result.summary,
    });

    messages.push({
      role: "assistant",
      content: JSON.stringify(action),
    });
    messages.push({
      role: "user",
      content: JSON.stringify({
        type: "tool_result",
        toolName: action.toolName,
        result: sanitizeToolResult(result),
        allToolResultsSoFar: observations.map((observation) => ({
          toolName: observation.toolName,
          result: sanitizeToolResult(observation.result),
        })),
        instruction:
          "Use all tool results so far to decide the next tool call or final answer. If final, mention every completed tool action.",
      }),
    });
  }

  trace.push("Stopped at loop limit");
  return buildAgentResponse({
    assistantReply: finalReplyFromLastObservation(observations) || "I ran out of agent steps before finishing. Please try again.",
    intent: inferIntentFromToolCalls(toolCalls),
    toolCalls,
    todos: latestTodos(observations, initialTodos),
    trace,
    answerSource: "fallback",
  });
}

async function callAgentModel(messages: AgentMessage[]): Promise<AgentAction> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const model = process.env.NVIDIA_MODEL || defaultModel;
  const baseUrl = process.env.NVIDIA_BASE_URL || defaultBaseUrl;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: "json_object" },
        messages: messages.map((item) => ({
          role: item.role,
          content: item.content,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`NVIDIA API error: ${response.status}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    const action = parseAgentAction(content);
    if (action) {
      return action;
    }

    messages.push({
      role: "user",
      content: JSON.stringify({
        type: "format_error",
        instruction: "Return only valid JSON matching either the toolCall or final schema.",
      }),
    });
  }

  throw new Error("Agent model returned invalid JSON.");
}

async function synthesizeFinalAnswer(
  userMessage: string,
  observations: Array<{ toolName: TodoToolName; result: TodoMcpResult }>,
  draftReply: string,
): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const model = process.env.NVIDIA_MODEL || defaultModel;
  const baseUrl = process.env.NVIDIA_BASE_URL || defaultBaseUrl;
  if (!apiKey) {
    return draftReply;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Return only valid JSON with assistantReply. Create the final user-facing answer from all tool observations. Mention every successful tool action. Do not invent actions that are not in observations.",
        },
        {
          role: "user",
          content: JSON.stringify({
            finalSynthesis: true,
            userMessage,
            draftReply,
            toolResults: observations.map((observation) => ({
              toolName: observation.toolName,
              result: sanitizeToolResult(observation.result),
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
    throw new Error(`NVIDIA final synthesis error: ${response.status}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  const parsed = safeParseJson<{ assistantReply?: string }>(content || "");
  return parsed?.assistantReply || draftReply;
}

function parseAgentAction(content: string | undefined): AgentAction | null {
  if (!content) {
    return null;
  }

  const parsed = safeParseJson<Partial<AgentAction>>(content);
  if (!parsed || typeof parsed.type !== "string") {
    return null;
  }

  if (parsed.type === "final" && typeof parsed.assistantReply === "string") {
    return {
      type: "final",
      assistantReply: parsed.assistantReply,
    };
  }

  if (
    parsed.type === "tool_call" &&
    typeof parsed.toolName === "string" &&
    isTodoToolName(parsed.toolName) &&
    parsed.arguments &&
    typeof parsed.arguments === "object" &&
    !Array.isArray(parsed.arguments)
  ) {
    return {
      type: "tool_call",
      toolName: parsed.toolName,
      arguments: parsed.arguments as Record<string, unknown>,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  }

  return null;
}

function validateToolCall(action: AgentToolCall): string | null {
  if (!isTodoToolName(action.toolName)) {
    return `Tool ${action.toolName} is not allowed.`;
  }

  if (action.toolName === "createTodo" && typeof action.arguments.title !== "string") {
    return "createTodo requires a string title.";
  }

  if (["completeTodo", "deleteTodo"].includes(action.toolName) && typeof action.arguments.target !== "string") {
    return `${action.toolName} requires a string target.`;
  }

  if (
    action.toolName === "updateTodo" &&
    (typeof action.arguments.target !== "string" || typeof action.arguments.replacementText !== "string")
  ) {
    return "updateTodo requires string target and replacementText.";
  }

  const filter = action.arguments.filter;
  if (action.toolName === "listTodos" && filter !== undefined && !["all", "open", "completed"].includes(String(filter))) {
    return "listTodos filter must be all, open, or completed.";
  }

  return null;
}

async function executeTodoTool(toolName: TodoToolName, args: Record<string, unknown>): Promise<TodoMcpResult> {
  if (toolName === "createTodo") {
    return callTodoSkill("createTodo", { title: String(args.title).trim() });
  }

  if (toolName === "listTodos") {
    return callTodoSkill("listTodos", { filter: normalizeListFilter(args.filter) });
  }

  if (toolName === "completeTodo") {
    return callTodoSkill("completeTodo", { target: String(args.target).trim() });
  }

  if (toolName === "deleteTodo") {
    return callTodoSkill("deleteTodo", { target: String(args.target).trim() });
  }

  return callTodoSkill("updateTodo", {
    target: String(args.target).trim(),
    replacementText: String(args.replacementText).trim(),
  });
}

async function callTodoSkill(toolName: TodoToolName, payload: unknown): Promise<TodoMcpResult> {
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
      summary: `Could not execute ${toolName}.`,
      todos: [],
    };
  }
}

async function getTodosSnapshot(): Promise<TodoItem[]> {
  const result = await callTodoSkill("listTodos", { filter: "all" });
  return result.todos || [];
}

function buildAgentResponse({
  assistantReply,
  intent,
  toolCalls,
  todos,
  trace,
  answerSource,
}: {
  assistantReply: string;
  intent: ChatIntent;
  toolCalls: ChatResponse["toolCalls"];
  todos: TodoItem[];
  trace: string[];
  answerSource: Source;
}): ChatResponse {
  const lastToolSource = toolCalls.at(-1)?.source || "fallback";
  return {
    assistantReply,
    intent,
    toolCalls,
    todos,
    agentTrace: [...trace, "Returned response"],
    metadata: {
      toolsUsed: ["agentLoop", ...toolCalls.map((tool) => tool.name)],
      toolSources: {
        classifyIntent: "llm",
        todoSkill: toolCalls.length ? lastToolSource : "fallback",
        answerGeneration: answerSource,
      },
    },
  };
}

async function runStaticFallback(message: string, source: Source): Promise<ChatResponse> {
  const intent = classifyWithRules(message);
  const trace = ["Checked chat message", "Used fallback router"];
  const toolCalls: ChatResponse["toolCalls"] = [];
  const initialTodos = await getTodosSnapshot();

  if (intent.intent === "create_todo") {
    const result = await callTodoSkill("createTodo", { title: intent.todoTitle || extractTodoTitle(message) });
    return buildFallbackToolResponse(message, intent.intent, result, "createTodo", trace, toolCalls, source);
  }

  if (intent.intent === "list_todos") {
    const result = await callTodoSkill("listTodos", { filter: getTodoListFilter(message) });
    return buildFallbackToolResponse(message, intent.intent, result, "listTodos", trace, toolCalls, source);
  }

  if (intent.intent === "complete_todo") {
    const result = await callTodoSkill("completeTodo", { target: intent.todoTarget || extractTodoTarget(message) });
    return buildFallbackToolResponse(message, intent.intent, result, "completeTodo", trace, toolCalls, source);
  }

  if (intent.intent === "delete_todo") {
    const result = await callTodoSkill("deleteTodo", { target: intent.todoTarget || extractTodoTarget(message) });
    return buildFallbackToolResponse(message, intent.intent, result, "deleteTodo", trace, toolCalls, source);
  }

  if (intent.intent === "update_todo") {
    const result = await callTodoSkill("updateTodo", {
      target: intent.todoTarget || extractTodoTarget(message),
      replacementText: intent.replacementText || extractReplacementText(message),
    });
    return buildFallbackToolResponse(message, intent.intent, result, "updateTodo", trace, toolCalls, source);
  }

  return {
    assistantReply: fallbackGeneralReply(message, initialTodos),
    intent: "general",
    toolCalls,
    todos: initialTodos,
    agentTrace: [...trace, "Returned response"],
    metadata: {
      toolsUsed: ["fallbackRouter"],
      toolSources: {
        classifyIntent: source,
        todoSkill: "fallback",
        answerGeneration: "fallback",
      },
    },
  };
}

function buildFallbackToolResponse(
  message: string,
  intent: ChatIntent,
  result: TodoMcpResult,
  toolName: TodoToolName,
  trace: string[],
  toolCalls: ChatResponse["toolCalls"],
  classifySource: Source,
): ChatResponse {
  toolCalls.push({
    name: toolName,
    source: result.source,
    summary: result.summary,
  });

  return {
    assistantReply: fallbackReplyForTool(toolName, result, message),
    intent,
    toolCalls,
    todos: result.todos || [],
    agentTrace: [...trace, shortTraceForTool(toolName), "Returned response"],
    metadata: {
      toolsUsed: ["fallbackRouter", toolName],
      toolSources: {
        classifyIntent: classifySource,
        todoSkill: result.source,
        answerGeneration: "fallback",
      },
    },
  };
}

function fallbackReplyForTool(toolName: TodoToolName, result: TodoMcpResult, message: string): string {
  if (toolName === "listTodos") {
    return formatFilteredTodoListReply(result.todos || [], getTodoListFilter(message));
  }

  if (result.summary) {
    return result.summary;
  }

  return finalReplyFromResult(toolName, result);
}

function finalReplyFromLastObservation(observations: Array<{ toolName: TodoToolName; result: TodoMcpResult }>): string {
  const last = observations.at(-1);
  return last ? finalReplyFromResult(last.toolName, last.result) : "";
}

function finalReplyFromResult(toolName: TodoToolName, result: TodoMcpResult): string {
  if (toolName === "createTodo" && result.todo) {
    return `Added todo: ${result.todo.title}`;
  }

  if (toolName === "listTodos") {
    return formatFilteredTodoListReply(result.todos || [], "all");
  }

  if (toolName === "completeTodo" && result.todo) {
    return result.summary || `Marked complete: ${result.todo.title}`;
  }

  if (toolName === "deleteTodo") {
    return result.summary || "Deleted todo.";
  }

  if (toolName === "updateTodo" && result.todo) {
    return `Updated todo: ${result.todo.title}`;
  }

  return result.summary || "I finished the requested action.";
}

function latestTodos(
  observations: Array<{ toolName: TodoToolName; result: TodoMcpResult }>,
  fallbackTodos: TodoItem[],
): TodoItem[] {
  for (const observation of [...observations].reverse()) {
    if (observation.result.todos) {
      return observation.result.todos;
    }
  }

  return fallbackTodos;
}

function inferIntentFromToolCalls(toolCalls: ChatResponse["toolCalls"]): ChatIntent {
  const firstTool = toolCalls[0]?.name;
  if (firstTool === "createTodo") {
    return "create_todo";
  }

  if (firstTool === "listTodos") {
    return "list_todos";
  }

  if (firstTool === "completeTodo") {
    return "complete_todo";
  }

  if (firstTool === "deleteTodo") {
    return "delete_todo";
  }

  if (firstTool === "updateTodo") {
    return "update_todo";
  }

  return "general";
}

function sanitizeToolResult(result: TodoMcpResult): Record<string, unknown> {
  return {
    source: result.source,
    confidence: result.confidence,
    summary: result.summary,
    todo: result.todo,
    todos: result.todos?.slice(0, 20).map((todo, index) => ({
      number: index + 1,
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
    })),
    count: result.count,
    matchedTodos: result.matchedTodos?.map((todo) => ({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
    })),
  };
}

function normalizeListFilter(value: unknown): TodoListFilter {
  return value === "open" || value === "completed" || value === "all" ? value : "all";
}

function validateToolName(value: string): value is TodoToolName {
  return todoTools.some((tool) => tool.name === value);
}

function isTodoToolName(value: string): value is TodoToolName {
  return validateToolName(value);
}

function shortTraceForTool(toolName: TodoToolName): string {
  const labels: Record<TodoToolName, string> = {
    createTodo: "Created todo item",
    listTodos: "Loaded todo list",
    completeTodo: "Marked todo completed",
    deleteTodo: "Deleted todo item",
    updateTodo: "Updated todo item",
  };

  return labels[toolName];
}

type ClassificationResult = {
  intent: ChatIntent;
  confidence: number;
  reason: string;
  source: Source;
  todoTitle?: string;
  todoTarget?: string;
  replacementText?: string;
};

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

function fallbackGeneralReply(message: string, todos: TodoItem[]): string {
  if (isTodoRelatedQuestion(message)) {
    if (!todos.length) {
      return "You do not have any todos yet. Try: Add a todo to call John tomorrow.";
    }

    return formatFilteredTodoListReply(todos, "all");
  }

  return "I can help with general questions and todo commands like add, list, complete, update, or delete.";
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
    .replace(/^please\s+/i, "")
    .replace(/^make sure (i|you)?\s*(do not|don't|dont)\s+forget\s+(to\s+)?/i, "")
    .replace(/^make sure\s+(to\s+)?/i, "")
    .replace(/^(i\s+)?(do not|don't|dont)\s+forget\s+(to\s+)?/i, "")
    .replace(/^don't let me forget\s+(to\s+)?/i, "")
    .replace(/^dont let me forget\s+(to\s+)?/i, "")
    .replace(/^i need to remember\s+(to\s+)?/i, "")
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
    message.includes("remind me to") ||
    isReminderCreateTodoRequest(message)
  );
}

function isReminderCreateTodoRequest(message: string): boolean {
  return (
    message.includes("don't forget to") ||
    message.includes("dont forget to") ||
    message.includes("do not forget to") ||
    message.includes("don't let me forget") ||
    message.includes("dont let me forget") ||
    message.includes("make sure i don't forget") ||
    message.includes("make sure i dont forget") ||
    message.includes("make sure i do not forget") ||
    message.includes("i need to remember")
  );
}

function isListTodoRequest(message: string): boolean {
  return (
    message.includes("list todos") ||
    message.includes("show todos") ||
    message.includes("show all todos") ||
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
