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
  const todo = await findTodo(identifier);
  if (!todo) {
    return null;
  }

  const updated = {
    ...todo,
    completed: true,
    updatedAt: new Date().toISOString(),
  };

  await replaceTodo(updated);
  return updated;
}

export async function deleteTodo(identifier: string): Promise<TodoItem | null> {
  const todo = await findTodo(identifier);
  if (!todo) {
    return null;
  }

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    await collection.deleteOne({ id: todo.id });
    return todo;
  }

  const todos = await readFileTodos();
  await writeFileTodos(todos.filter((item) => item.id !== todo.id));
  return todo;
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
  const query = identifier.trim();
  if (!query) {
    return null;
  }

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    return collection.findOne({
      $or: [
        { id: query },
        { title: query },
        { title: { $regex: escapeRegExp(query), $options: "i" } },
      ],
    });
  }

  const lowered = query.toLowerCase();
  const todos = await readFileTodos();
  return (
    todos.find((todo) => todo.id.toLowerCase() === lowered) ||
    todos.find((todo) => todo.title.trim().toLowerCase() === lowered) ||
    todos.find((todo) => todo.title.toLowerCase().includes(lowered)) ||
    null
  );
}

async function replaceTodo(todo: TodoItem): Promise<void> {
  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    await collection.replaceOne({ id: todo.id }, todo);
    return;
  }

  const todos = await readFileTodos();
  await writeFileTodos(todos.map((item) => (item.id === todo.id ? todo : item)));
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
