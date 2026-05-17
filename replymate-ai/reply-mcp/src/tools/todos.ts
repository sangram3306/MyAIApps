import { z } from "zod";

const sourceSchema = z.enum(["static", "llm", "fallback"]);

const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
});

const createTodoInputSchema = z.object({
  title: z.string().min(1),
});

const listTodoInputSchema = z.object({
  currentTodos: z.array(todoSchema).default([]),
});

const targetTodoInputSchema = z.object({
  target: z.string().min(1),
  currentTodos: z.array(todoSchema).default([]),
});

const updateTodoInputSchema = targetTodoInputSchema.extend({
  replacementText: z.string().min(1),
});

const todoToolOutputSchema = z.object({
  source: sourceSchema,
  confidence: z.number(),
  summary: z.string(),
  title: z.string().optional(),
  matchedId: z.string().optional(),
  matchedTitle: z.string().optional(),
  replacementText: z.string().optional(),
  count: z.number().optional(),
});

type TodoToolOutput = z.infer<typeof todoToolOutputSchema>;
type TodoItem = z.infer<typeof todoSchema>;

export async function createTodoTool(input: unknown): Promise<TodoToolOutput> {
  const parsed = createTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the todo title.");
  }

  const title = normalizeTitle(parsed.data.title);
  if (!title) {
    return fallback("Todo title was empty.");
  }

  return {
    source: "static",
    confidence: 0.96,
    summary: `Prepared todo creation: ${title}`,
    title,
  };
}

export async function listTodosTool(input: unknown): Promise<TodoToolOutput> {
  const parsed = listTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the current todo list.");
  }

  return {
    source: "static",
    confidence: 0.98,
    summary: `Prepared todo list with ${parsed.data.currentTodos.length} item(s).`,
    count: parsed.data.currentTodos.length,
  };
}

export async function completeTodoTool(input: unknown): Promise<TodoToolOutput> {
  return matchTargetTodo(input, "Prepared todo completion");
}

export async function deleteTodoTool(input: unknown): Promise<TodoToolOutput> {
  return matchTargetTodo(input, "Prepared todo deletion");
}

export async function updateTodoTool(input: unknown): Promise<TodoToolOutput> {
  const parsed = updateTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the update request.");
  }

  const match = findTodo(parsed.data.currentTodos, parsed.data.target);
  const replacementText = normalizeTitle(parsed.data.replacementText);

  if (!match || !replacementText) {
    return fallback("Could not match the todo to update.");
  }

  return {
    source: "static",
    confidence: 0.9,
    summary: `Prepared todo update: ${match.title}`,
    matchedId: match.id,
    matchedTitle: match.title,
    replacementText,
  };
}

function matchTargetTodo(input: unknown, summaryPrefix: string): TodoToolOutput {
  const parsed = targetTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the target todo.");
  }

  const match = findTodo(parsed.data.currentTodos, parsed.data.target);
  if (!match) {
    return fallback("Could not match the target todo.");
  }

  return {
    source: "static",
    confidence: 0.9,
    summary: `${summaryPrefix}: ${match.title}`,
    matchedId: match.id,
    matchedTitle: match.title,
  };
}

function findTodo(todos: TodoItem[], target: string): TodoItem | null {
  const query = target.trim().toLowerCase();
  if (!query) {
    return null;
  }

  return (
    todos.find((todo) => todo.id.toLowerCase() === query) ||
    todos.find((todo) => todo.title.trim().toLowerCase() === query) ||
    todos.find((todo) => todo.title.toLowerCase().includes(query)) ||
    null
  );
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function fallback(summary: string): TodoToolOutput {
  return {
    source: "fallback",
    confidence: 0.3,
    summary,
  };
}
