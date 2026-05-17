import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

function getStorePath(): string {
  return process.env.TODO_STORE_PATH?.trim() || path.resolve(process.cwd(), "data", "todos.json");
}

async function readTodos(): Promise<TodoItem[]> {
  try {
    const raw = await fs.readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isTodoItem);
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function writeTodos(todos: TodoItem[]): Promise<void> {
  const filePath = getStorePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(todos, null, 2), "utf8");
}

export async function listTodos(): Promise<TodoItem[]> {
  return readTodos();
}

export async function createTodo(title: string): Promise<TodoItem> {
  const todos = await readTodos();
  const now = new Date().toISOString();
  const todo: TodoItem = {
    id: randomUUID(),
    title: title.trim(),
    completed: false,
    createdAt: now,
    updatedAt: now,
  };

  await writeTodos([todo, ...todos]);
  return todo;
}

export async function completeTodo(identifier: string): Promise<TodoItem | null> {
  const todos = await readTodos();
  const index = findTodoIndex(todos, identifier);

  if (index < 0) {
    return null;
  }

  const now = new Date().toISOString();
  const updated = [...todos];
  updated[index] = {
    ...updated[index],
    completed: true,
    updatedAt: now,
  };
  await writeTodos(updated);
  return updated[index];
}

export async function deleteTodo(identifier: string): Promise<TodoItem | null> {
  const todos = await readTodos();
  const index = findTodoIndex(todos, identifier);

  if (index < 0) {
    return null;
  }

  const [deleted] = todos.splice(index, 1);
  await writeTodos(todos);
  return deleted ?? null;
}

export async function deleteAllTodos(): Promise<TodoItem[]> {
  const todos = await readTodos();
  await writeTodos([]);
  return todos;
}

export async function updateTodo(identifier: string, title: string): Promise<TodoItem | null> {
  const todos = await readTodos();
  const index = findTodoIndex(todos, identifier);

  if (index < 0) {
    return null;
  }

  const now = new Date().toISOString();
  const updated = [...todos];
  updated[index] = {
    ...updated[index],
    title: title.trim(),
    updatedAt: now,
  };
  await writeTodos(updated);
  return updated[index];
}

function findTodoIndex(todos: TodoItem[], identifier: string): number {
  const query = identifier.trim().toLowerCase();
  return todos.findIndex((todo) => {
    const idMatch = todo.id.toLowerCase() === query;
    const exactTitleMatch = todo.title.trim().toLowerCase() === query;
    const partialTitleMatch = todo.title.toLowerCase().includes(query);
    return idMatch || exactTitleMatch || partialTitleMatch;
  });
}

function isTodoItem(value: unknown): value is TodoItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.completed === "boolean" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT",
  );
}
