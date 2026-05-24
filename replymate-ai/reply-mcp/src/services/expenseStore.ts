import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Collection, MongoClient } from "mongodb";

export type ExpenseItem = {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};

let mongoClientPromise: Promise<MongoClient> | null = null;

function shouldUseFileStore(): boolean {
  return Boolean(process.env.EXPENSE_STORE_PATH?.trim()) || !process.env.MONGODB_URI?.trim();
}

function getStorePath(): string {
  return process.env.EXPENSE_STORE_PATH?.trim() || path.resolve(process.cwd(), "data", "expenses.json");
}

async function getCollection(): Promise<Collection<ExpenseItem>> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(uri).connect();
  }

  const client = await mongoClientPromise;
  const dbName = process.env.MONGODB_DB_NAME?.trim() || "replymate_ai";
  const collectionName = process.env.MONGODB_EXPENSES_COLLECTION?.trim() || "expenses";
  return client.db(dbName).collection<ExpenseItem>(collectionName);
}

export async function createExpense(input: {
  amount: number;
  category: string;
  description: string;
  date?: string;
}): Promise<ExpenseItem> {
  const now = new Date().toISOString();
  const expense: ExpenseItem = {
    id: randomUUID(),
    amount: Number(input.amount.toFixed(2)),
    category: normalizeText(input.category || "other"),
    description: normalizeText(input.description || input.category || "Expense"),
    date: input.date?.trim() || now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
  };

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    await collection.insertOne(expense);
    return expense;
  }

  const expenses = await readFileExpenses();
  await writeFileExpenses([expense, ...expenses]);
  return expense;
}

export async function listExpenses(filter: {
  period?: "all" | "today" | "week" | "month";
  category?: string;
  limit?: number;
} = {}): Promise<ExpenseItem[]> {
  const limit = Math.min(Math.max(filter.limit || 20, 1), 100);
  const category = filter.category?.trim().toLowerCase();

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    const query: Record<string, unknown> = {};
    const dateRange = getDateRange(filter.period || "all");
    if (dateRange) {
      query.date = { $gte: dateRange.start, $lte: dateRange.end };
    }

    if (category) {
      query.category = category;
    }

    return collection.find(query).sort({ date: -1, createdAt: -1 }).limit(limit).toArray();
  }

  const expenses = await readFileExpenses();
  const dateRange = getDateRange(filter.period || "all");
  return expenses
    .filter((expense) => {
      if (category && expense.category !== category) {
        return false;
      }

      if (!dateRange) {
        return true;
      }

      return expense.date >= dateRange.start && expense.date <= dateRange.end;
    })
    .slice(0, limit);
}

export async function getExpenseSummary(filter: {
  period?: "all" | "today" | "week" | "month";
  category?: string;
} = {}): Promise<{
  total: number;
  count: number;
  byCategory: Array<{ category: string; total: number; count: number }>;
  expenses: ExpenseItem[];
}> {
  const expenses = await listExpenses({ ...filter, limit: 100 });
  const categories = new Map<string, { category: string; total: number; count: number }>();
  let total = 0;

  expenses.forEach((expense) => {
    total += expense.amount;
    const current = categories.get(expense.category) || {
      category: expense.category,
      total: 0,
      count: 0,
    };
    current.total += expense.amount;
    current.count += 1;
    categories.set(expense.category, current);
  });

  return {
    total: Number(total.toFixed(2)),
    count: expenses.length,
    byCategory: [...categories.values()]
      .map((item) => ({ ...item, total: Number(item.total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total),
    expenses,
  };
}

export async function deleteExpense(identifier: string): Promise<ExpenseItem | null> {
  const expense = await findExpense(identifier);
  if (!expense) {
    return null;
  }

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    await collection.deleteOne({ id: expense.id });
    return expense;
  }

  const expenses = await readFileExpenses();
  await writeFileExpenses(expenses.filter((item) => item.id !== expense.id));
  return expense;
}

async function findExpense(identifier: string): Promise<ExpenseItem | null> {
  const query = identifier.trim();
  if (!query) {
    return null;
  }

  const index = parseOrdinalIndex(query);
  if (index !== null) {
    const expenses = await listExpenses({ limit: 100 });
    return expenses[index] || null;
  }

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    return collection.findOne({
      $or: [
        { id: query },
        { description: query },
        { description: { $regex: escapeRegExp(query), $options: "i" } },
      ],
    });
  }

  const lowered = query.toLowerCase();
  const expenses = await readFileExpenses();
  return (
    expenses.find((expense) => expense.id.toLowerCase() === lowered) ||
    expenses.find((expense) => expense.description.toLowerCase().includes(lowered)) ||
    null
  );
}

function getDateRange(period: "all" | "today" | "week" | "month"): { start: string; end: string } | null {
  if (period === "all") {
    return null;
  }

  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  const startDate = new Date(now);

  if (period === "today") {
    return { start: end, end };
  }

  if (period === "week") {
    startDate.setDate(now.getDate() - 6);
  }

  if (period === "month") {
    startDate.setDate(now.getDate() - 29);
  }

  return { start: startDate.toISOString().slice(0, 10), end };
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

  return null;
}

async function readFileExpenses(): Promise<ExpenseItem[]> {
  try {
    const raw = await fs.readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isExpenseItem) : [];
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function writeFileExpenses(expenses: ExpenseItem[]): Promise<void> {
  const filePath = getStorePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(expenses, null, 2), "utf8");
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isExpenseItem(value: unknown): value is ExpenseItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.amount === "number" &&
    typeof item.category === "string" &&
    typeof item.description === "string" &&
    typeof item.date === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
