import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Collection, MongoClient } from "mongodb";

export type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

let mongoClientPromise: Promise<MongoClient> | null = null;

function shouldUseFileStore(): boolean {
  return Boolean(process.env.TODO_STORE_PATH?.trim()) || !process.env.MONGODB_URI?.trim();
}

function getStorePath(): string {
  return process.env.TODO_STORE_PATH?.trim() || path.resolve(process.cwd(), "data", "todos.json");
}

async function getCollection(): Promise<Collection<TodoItem>> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(uri).connect();
  }

  const client = await mongoClientPromise;
  const dbName = process.env.MONGODB_DB_NAME?.trim() || "replymate_ai";
  const collectionName = process.env.MONGODB_TODOS_COLLECTION?.trim() || "todos";
  return client.db(dbName).collection<TodoItem>(collectionName);
}

export async function listTodos(): Promise<TodoItem[]> {
  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    return collection.find({}).sort({ createdAt: -1 }).toArray();
  }

  return readFileTodos();
}

export async function listTodosByStatus(status: "all" | "open" | "completed"): Promise<TodoItem[]> {
  const todos = await listTodos();
  if (status === "completed") {
    return todos.filter((todo) => todo.completed);
  }

  if (status === "open") {
    return todos.filter((todo) => !todo.completed);
  }

  return todos;
}

export async function createTodo(title: string): Promise<TodoItem> {
  const now = new Date().toISOString();
  const todo: TodoItem = {
    id: randomUUID(),
    title: title.trim(),
    completed: false,
    createdAt: now,
    updatedAt: now,
  };

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    await collection.insertOne(todo);
    return todo;
  }

  const todos = await readFileTodos();
  await writeFileTodos([todo, ...todos]);
  return todo;
}

export async function completeTodo(identifier: string): Promise<TodoItem | null> {
  const [todo] = await completeTodos(identifier);
  return todo || null;
}

export async function completeTodos(identifier: string): Promise<TodoItem[]> {
  const todos = await findTodos(identifier);
  if (!todos.length) {
    return [];
  }

  const updatedTodos = todos.map((todo) => ({
    ...todo,
    completed: true,
    updatedAt: new Date().toISOString(),
  }));

  await replaceTodos(updatedTodos);
  return updatedTodos;
}

export async function deleteTodo(identifier: string): Promise<TodoItem | null> {
  const [todo] = await deleteTodos(identifier);
  return todo || null;
}

export async function deleteTodos(identifier: string): Promise<TodoItem[]> {
  const todosToDelete = await findTodos(identifier);
  if (!todosToDelete.length) {
    return [];
  }

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    await collection.deleteMany({ id: { $in: todosToDelete.map((todo) => todo.id) } });
    return todosToDelete;
  }

  const todos = await readFileTodos();
  const idsToDelete = new Set(todosToDelete.map((todo) => todo.id));
  await writeFileTodos(todos.filter((item) => !idsToDelete.has(item.id)));
  return todosToDelete;
}

export async function deleteAllTodos(): Promise<TodoItem[]> {
  const todos = await listTodos();

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    await collection.deleteMany({});
    return todos;
  }

  await writeFileTodos([]);
  return todos;
}

export async function updateTodo(identifier: string, title: string): Promise<TodoItem | null> {
  const todo = await findTodo(identifier);
  if (!todo) {
    return null;
  }

  const updated = {
    ...todo,
    title: title.trim(),
    updatedAt: new Date().toISOString(),
  };

  await replaceTodo(updated);
  return updated;
}

async function findTodo(identifier: string): Promise<TodoItem | null> {
  const [todo] = await findTodos(identifier);
  return todo || null;
}

async function findTodos(identifier: string): Promise<TodoItem[]> {
  const query = identifier.trim();
  if (!query) {
    return [];
  }

  const ordinalIndexes = parseOrdinalIndexes(query);
  if (ordinalIndexes.length) {
    const todos = await listTodos();
    return uniqueTodos(
      ordinalIndexes
        .map((index) => (index === Number.MAX_SAFE_INTEGER ? todos[todos.length - 1] : todos[index]))
        .filter((todo): todo is TodoItem => Boolean(todo)),
    );
  }

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    const todo = await collection.findOne({
      $or: [
        { id: query },
        { title: query },
        { title: { $regex: escapeRegExp(query), $options: "i" } },
      ],
    });
    return todo ? [todo] : [];
  }

  const lowered = query.toLowerCase();
  const todos = await readFileTodos();
  const todo =
    todos.find((todo) => todo.id.toLowerCase() === lowered) ||
    todos.find((todo) => todo.title.trim().toLowerCase() === lowered) ||
    todos.find((todo) => todo.title.toLowerCase().includes(lowered)) ||
    null;
  return todo ? [todo] : [];
}

function parseOrdinalIndexes(value: string): number[] {
  const normalized = value.toLowerCase().trim();
  const tokens = normalized.match(/\b(?:#?\d+(?:st|nd|rd|th)?|first|second|third|fourth|fifth|last)\b/g) || [];
  if (tokens.length > 1) {
    return uniqueIndexes(tokens.flatMap((token) => parseOrdinalIndex(token) ?? []));
  }

  const singleIndex = parseOrdinalIndex(normalized);
  return singleIndex === null ? [] : [singleIndex];
}

function parseOrdinalIndex(value: string): number | null {
  const normalized = value.toLowerCase().trim();
  const directNumber = normalized.match(/^#?(\d+)$/);
  if (directNumber?.[1]) {
    return Math.max(0, Number(directNumber[1]) - 1);
  }

  const ordinal = normalized.match(/^(\d+)(st|nd|rd|th)$/);
  if (ordinal?.[1]) {
    return Math.max(0, Number(ordinal[1]) - 1);
  }

  const words: Record<string, number> = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
    fifth: 4,
    last: -1,
  };

  if (normalized in words) {
    if (normalized === "last") {
      return Number.MAX_SAFE_INTEGER;
    }

    return words[normalized];
  }

  return null;
}

function uniqueIndexes(indexes: number[]): number[] {
  return [...new Set(indexes)];
}

function uniqueTodos(todos: TodoItem[]): TodoItem[] {
  const seen = new Set<string>();
  return todos.filter((todo) => {
    if (seen.has(todo.id)) {
      return false;
    }

    seen.add(todo.id);
    return true;
  });
}

async function replaceTodo(todo: TodoItem): Promise<void> {
  await replaceTodos([todo]);
}

async function replaceTodos(todosToReplace: TodoItem[]): Promise<void> {
  if (!todosToReplace.length) {
    return;
  }

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    await Promise.all(todosToReplace.map((todo) => collection.replaceOne({ id: todo.id }, todo)));
    return;
  }

  const todos = await readFileTodos();
  const replacements = new Map(todosToReplace.map((todo) => [todo.id, todo]));
  await writeFileTodos(todos.map((item) => replacements.get(item.id) || item));
}

async function readFileTodos(): Promise<TodoItem[]> {
  try {
    const raw = await fs.readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isTodoItem) : [];
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function writeFileTodos(todos: TodoItem[]): Promise<void> {
  const filePath = getStorePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(todos, null, 2), "utf8");
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
