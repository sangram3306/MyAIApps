import { z } from "zod";
import {
  createExpense,
  deleteExpense,
  ExpenseItem,
  getExpenseSummary,
  listExpenses,
} from "../services/expenseStore.js";

const createExpenseInputSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1).default("other"),
  description: z.string().min(1).default("Expense"),
  date: z.string().optional(),
});

const listExpenseInputSchema = z.object({
  period: z.enum(["all", "today", "week", "month"]).optional().default("all"),
  category: z.string().optional(),
  limit: z.number().int().positive().max(100).optional().default(20),
});

const summaryInputSchema = z.object({
  period: z.enum(["all", "today", "week", "month"]).optional().default("month"),
  category: z.string().optional(),
});

const deleteExpenseInputSchema = z.object({
  target: z.string().min(1),
});

type ExpenseToolOutput = {
  source: "static" | "llm" | "fallback";
  confidence: number;
  summary: string;
  expense?: ExpenseItem;
  expenses: ExpenseItem[];
  total?: number;
  count?: number;
  byCategory?: Array<{ category: string; total: number; count: number }>;
};

export async function createExpenseTool(input: unknown): Promise<ExpenseToolOutput> {
  const parsed = createExpenseInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the expense details.");
  }

  const expense = await createExpense(parsed.data);
  const summary = await getExpenseSummary({ period: "month" });
  return {
    source: "static",
    confidence: 0.96,
    summary: `Logged ${formatAmount(expense.amount)} for ${expense.description} in ${expense.category}.`,
    expense,
    expenses: summary.expenses,
    total: summary.total,
    count: summary.count,
    byCategory: summary.byCategory,
  };
}

export async function listExpensesTool(input: unknown): Promise<ExpenseToolOutput> {
  const parsed = listExpenseInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the expense list request.");
  }

  const expenses = await listExpenses(parsed.data);
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  return {
    source: "static",
    confidence: 0.98,
    summary: `Found ${expenses.length} expense${expenses.length === 1 ? "" : "s"} totaling ${formatAmount(total)}.`,
    expenses,
    total: Number(total.toFixed(2)),
    count: expenses.length,
  };
}

export async function expenseSummaryTool(input: unknown): Promise<ExpenseToolOutput> {
  const parsed = summaryInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the expense summary request.");
  }

  const summary = await getExpenseSummary(parsed.data);
  return {
    source: "static",
    confidence: 0.98,
    summary: `Total spending is ${formatAmount(summary.total)} across ${summary.count} expense${summary.count === 1 ? "" : "s"}.`,
    expenses: summary.expenses,
    total: summary.total,
    count: summary.count,
    byCategory: summary.byCategory,
  };
}

export async function deleteExpenseTool(input: unknown): Promise<ExpenseToolOutput> {
  const parsed = deleteExpenseInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the expense to delete.");
  }

  const expense = await deleteExpense(parsed.data.target);
  if (!expense) {
    return fallback("Could not match the expense to delete.");
  }

  const summary = await getExpenseSummary({ period: "month" });
  return {
    source: "static",
    confidence: 0.9,
    summary: `Deleted ${formatAmount(expense.amount)} for ${expense.description}.`,
    expense,
    expenses: summary.expenses,
    total: summary.total,
    count: summary.count,
    byCategory: summary.byCategory,
  };
}

function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
}

async function fallback(summary: string): Promise<ExpenseToolOutput> {
  return {
    source: "fallback",
    confidence: 0.3,
    summary,
    expenses: await listExpenses({ limit: 20 }).catch(() => []),
  };
}
