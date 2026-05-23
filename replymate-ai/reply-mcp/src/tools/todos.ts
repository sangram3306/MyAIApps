import { z } from "zod";
import {
  completeTodo,
  createTodo,
  deleteAllTodos,
  deleteTodo,
  listTodos,
  TodoItem,
  updateTodo,
} from "../services/todoStore.js";

const sourceSchema = z.enum(["static", "llm", "fallback"]);

const createTodoInputSchema = z.object({
  title: z.string().min(1),
});

const listTodoInputSchema = z.object({}).passthrough();

const targetTodoInputSchema = z.object({
  target: z.string().min(1),
});

const updateTodoInputSchema = targetTodoInputSchema.extend({
  replacementText: z.string().min(1),
});

type TodoToolOutput = {
  source: z.infer<typeof sourceSchema>;
  confidence: number;
  summary: string;
  todo?: TodoItem;
  todos: TodoItem[];
  title?: string;
  matchedId?: string;
  matchedTitle?: string;
  replacementText?: string;
  count?: number;
};

export async function createTodoTool(input: unknown): Promise<TodoToolOutput> {
  const parsed = createTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the todo title.");
  }

  const title = normalizeTitle(parsed.data.title);
  if (!title) {
    return fallback("Todo title was empty.");
  }

  const todo = await createTodo(title);
  const todos = await listTodos();

  return {
    source: "static",
    confidence: 0.96,
    summary: `Created todo: ${todo.title}`,
    todo,
    todos,
    title: todo.title,
    count: todos.length,
  };
}

export async function listTodosTool(input: unknown): Promise<TodoToolOutput> {
  const parsed = listTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the list request.");
  }

  const todos = await listTodos();
  return {
    source: "static",
    confidence: 0.98,
    summary: `Found ${todos.length} todo${todos.length === 1 ? "" : "s"}.`,
    todos,
    count: todos.length,
  };
}

export async function completeTodoTool(input: unknown): Promise<TodoToolOutput> {
  const parsed = targetTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the target todo.");
  }

  const todo = await completeTodo(parsed.data.target);
  if (!todo) {
    return fallback("Could not match the todo to complete.");
  }

  const todos = await listTodos();
  return {
    source: "static",
    confidence: 0.9,
    summary: `Completed todo: ${todo.title}`,
    todo,
    todos,
    matchedId: todo.id,
    matchedTitle: todo.title,
    count: todos.length,
  };
}

export async function deleteTodoTool(input: unknown): Promise<TodoToolOutput> {
  const parsed = targetTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the target todo.");
  }

  if (isAllTodosTarget(parsed.data.target)) {
    const deletedTodos = await deleteAllTodos();
    return {
      source: "static",
      confidence: 0.88,
      summary: `Deleted ${deletedTodos.length} todo${deletedTodos.length === 1 ? "" : "s"}.`,
      todos: [],
      count: deletedTodos.length,
    };
  }

  const todo = await deleteTodo(parsed.data.target);
  if (!todo) {
    return fallback("Could not match the todo to delete.");
  }

  const todos = await listTodos();
  return {
    source: "static",
    confidence: 0.9,
    summary: `Deleted todo: ${todo.title}`,
    todo,
    todos,
    matchedId: todo.id,
    matchedTitle: todo.title,
    count: todos.length,
  };
}

export async function updateTodoTool(input: unknown): Promise<TodoToolOutput> {
  const parsed = updateTodoInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the update request.");
  }

  const replacementText = normalizeTitle(parsed.data.replacementText);
  if (!replacementText) {
    return fallback("Replacement todo text was empty.");
  }

  const todo = await updateTodo(parsed.data.target, replacementText);
  if (!todo) {
    return fallback("Could not match the todo to update.");
  }

  const todos = await listTodos();
  return {
    source: "static",
    confidence: 0.9,
    summary: `Updated todo: ${todo.title}`,
    todo,
    todos,
    matchedId: todo.id,
    matchedTitle: todo.title,
    replacementText: todo.title,
    count: todos.length,
  };
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isAllTodosTarget(value: string): boolean {
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

async function fallback(summary: string): Promise<TodoToolOutput> {
  return {
    source: "fallback",
    confidence: 0.3,
    summary,
    todos: await listTodos().catch(() => []),
  };
}
