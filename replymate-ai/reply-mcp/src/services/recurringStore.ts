import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Collection, MongoClient } from "mongodb";

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type RecurringExpense = {
  id: string;
  amount: number;
  currency: "AED" | "INR";
  category: string;
  description: string;
  frequency: RecurringFrequency;
  nextDueDate: string;        // YYYY-MM-DD
  lastLoggedDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

let mongoClientPromise: Promise<MongoClient> | null = null;

function shouldUseFileStore(): boolean {
  return Boolean(process.env.EXPENSE_STORE_PATH?.trim()) || !process.env.MONGODB_URI?.trim();
}

function getStorePath(): string {
  const basePath = process.env.EXPENSE_STORE_PATH?.trim() || path.resolve(process.cwd(), "data");
  return path.join(basePath.endsWith(".json") ? path.dirname(basePath) : basePath, "recurring.json");
}

async function getCollection(): Promise<Collection<RecurringExpense>> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(uri).connect();
  }

  const client = await mongoClientPromise;
  const dbName = process.env.MONGODB_DB_NAME?.trim() || "replymate_ai";
  return client.db(dbName).collection<RecurringExpense>("recurring_expenses");
}

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function createRecurring(input: {
  amount: number;
  currency?: "AED" | "INR";
  category: string;
  description: string;
  frequency: RecurringFrequency;
  startDate?: string;
}): Promise<RecurringExpense> {
  const now = new Date().toISOString();
  const recurring: RecurringExpense = {
    id: randomUUID(),
    amount: Number(input.amount.toFixed(2)),
    currency: input.currency || "AED",
    category: normalizeText(input.category || "other"),
    description: normalizeText(input.description || input.category || "Recurring"),
    frequency: input.frequency,
    nextDueDate: input.startDate?.trim() || now.slice(0, 10),
    lastLoggedDate: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    await collection.insertOne(recurring);
    return recurring;
  }

  const items = await readFileStore();
  await writeFileStore([recurring, ...items]);
  return recurring;
}

export async function listRecurring(filter: {
  activeOnly?: boolean;
  dueToday?: boolean;
} = {}): Promise<RecurringExpense[]> {
  let items: RecurringExpense[];

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    const query: Record<string, unknown> = {};
    if (filter.activeOnly !== false) {
      query.isActive = true;
    }
    items = await collection.find(query).sort({ nextDueDate: 1 }).toArray();
  } else {
    items = await readFileStore();
    if (filter.activeOnly !== false) {
      items = items.filter((item) => item.isActive);
    }
    items.sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  }

  if (filter.dueToday) {
    const today = new Date().toISOString().slice(0, 10);
    items = items.filter((item) => item.nextDueDate <= today);
  }

  return items;
}

export async function updateRecurring(
  id: string,
  updates: Partial<Pick<RecurringExpense, "amount" | "currency" | "category" | "description" | "frequency" | "nextDueDate" | "isActive">>
): Promise<RecurringExpense | null> {
  const now = new Date().toISOString();

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    const result = await collection.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: now } },
      { returnDocument: "after" }
    );
    return result || null;
  }

  const items = await readFileStore();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  items[index] = { ...items[index], ...updates, updatedAt: now };
  await writeFileStore(items);
  return items[index];
}

export async function deleteRecurring(id: string): Promise<RecurringExpense | null> {
  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    const item = await collection.findOne({ id });
    if (!item) return null;
    await collection.deleteOne({ id });
    return item;
  }

  const items = await readFileStore();
  const target = items.find((item) => item.id === id);
  if (!target) return null;
  await writeFileStore(items.filter((item) => item.id !== id));
  return target;
}

export async function markRecurringAsLogged(id: string): Promise<RecurringExpense | null> {
  const items = await listRecurring({ activeOnly: false });
  const target = items.find((item) => item.id === id);
  if (!target) return null;

  const today = new Date().toISOString().slice(0, 10);
  const nextDue = computeNextDueDate(today, target.frequency);

  return updateRecurring(id, {
    nextDueDate: nextDue,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

export function computeNextDueDate(fromDate: string, frequency: RecurringFrequency): string {
  const date = new Date(fromDate + "T00:00:00Z");

  switch (frequency) {
    case "daily":
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    case "weekly":
      date.setUTCDate(date.getUTCDate() + 7);
      break;
    case "monthly":
      date.setUTCMonth(date.getUTCMonth() + 1);
      break;
    case "yearly":
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

async function readFileStore(): Promise<RecurringExpense[]> {
  try {
    const raw = await fs.readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecurringExpense) : [];
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }
    throw error;
  }
}

async function writeFileStore(items: RecurringExpense[]): Promise<void> {
  const filePath = getStorePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(items, null, 2), "utf8");
}

function isRecurringExpense(value: unknown): value is RecurringExpense {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.amount === "number" &&
    typeof item.category === "string" &&
    typeof item.description === "string" &&
    typeof item.frequency === "string" &&
    typeof item.nextDueDate === "string" &&
    typeof item.isActive === "boolean" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
