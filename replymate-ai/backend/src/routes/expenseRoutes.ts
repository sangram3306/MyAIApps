import { Router } from "express";
import { ZodError } from "zod";
import { handleExpenseMessage } from "../agents/expenseAgent";
import { callMcpTool } from "../mcp/mcpClient";
import { expenseCreateSchema, expenseIntelligenceSchema, expenseMessageSchema } from "../schemas/expenseSchemas";
import { generateExpenseIntelligence } from "../services/nvidiaService";

const router = Router();

type Source = "static" | "llm" | "fallback";
type ExpenseItem = {
  id: string;
  amount: number;
  currency?: "AED" | "INR";
  category: string;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
};
type ExpenseToolResult = {
  source: Source;
  confidence: number;
  summary: string;
  expense?: ExpenseItem;
  expenses: ExpenseItem[];
  total?: number;
  count?: number;
  byCategory?: Array<{ category: string; total: number; count: number }>;
};

router.post("/create", handleCreateExpenseRequest);
router.post("/message", handleExpenseMessageRequest);
router.get("/export", handleExportExpensesRequest);
router.post("/intelligence", handleExpenseIntelligenceRequest);
router.post("/clear", handleClearExpensesRequest);

export async function handleCreateExpenseRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = expenseCreateSchema.parse(req.body);
    const description = input.description?.trim() || input.category;
    const result = await callMcpTool<ExpenseToolResult>(
      "createExpense",
      {
        amount: input.amount,
        currency: input.currency,
        category: input.category,
        description,
        ...(input.date ? { date: input.date } : {}),
      },
      {
        timeoutMs: 5000,
        retries: 1,
      },
    );

    res.json({
      assistantReply: result.summary,
      toolCalls: [
        {
          name: "createExpense",
          source: result.source,
          summary: result.summary,
        },
      ],
      expenses: result.expenses,
      total: result.total,
      byCategory: result.byCategory,
      agentTrace: ["Validated expense form", "Saved expense through MCP", "Returned expense response"],
      metadata: {
        toolsUsed: ["createExpense"],
        toolSources: {
          expenseSkill: result.source,
          answerGeneration: "static",
        },
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }

    return res.status(500).json({
      error: "Could not save your expense. Please try again.",
    });
  }
}

export async function handleExpenseMessageRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = expenseMessageSchema.parse(req.body);
    const result = await handleExpenseMessage(input.message);
    res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const isLlmError = message.includes("API error");

    return res.status(isLlmError ? 502 : 500).json({
      error: isLlmError
        ? "The selected AI provider could not answer expense questions right now."
        : "Could not process your expense request. Please try again.",
    });
  }
}

export async function handleExportExpensesRequest(
  _req: { body?: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const [expensesResult, summaryResult] = await Promise.all([
      callMcpTool<ExpenseToolResult>(
        "listExpenses",
        {
          period: "all",
          limit: 100,
        },
        {
          timeoutMs: 5000,
          retries: 1,
        },
      ),
      callMcpTool<ExpenseToolResult>(
        "expenseSummary",
        {
          period: "all",
        },
        {
          timeoutMs: 5000,
          retries: 1,
        },
      ),
    ]);

    res.json({
      exportedAt: new Date().toISOString(),
      expenses: expensesResult.expenses || [],
      total: summaryResult.total ?? expensesResult.total ?? 0,
      byCategory: summaryResult.byCategory || expensesResult.byCategory || [],
      count: summaryResult.count ?? expensesResult.expenses.length ?? 0,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not export expenses right now.",
    });
  }
}

export async function handleExpenseIntelligenceRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = expenseIntelligenceSchema.parse(req.body);
    const [expensesResult, summaryResult] = await Promise.all([
      callMcpTool<ExpenseToolResult>(
        "listExpenses",
        {
          period: input.period,
          limit: input.period === "all" ? 200 : 120,
        },
        {
          timeoutMs: 5000,
          retries: 1,
        },
      ),
      callMcpTool<ExpenseToolResult>(
        "expenseSummary",
        {
          period: input.period,
        },
        {
          timeoutMs: 5000,
          retries: 1,
        },
      ),
    ]);

    const expenses = expensesResult.expenses || [];
    const byCategory = summaryResult.byCategory || expensesResult.byCategory || [];
    const total = summaryResult.total ?? expensesResult.total ?? 0;
    const count = summaryResult.count ?? expenses.length ?? 0;
    const average = count > 0 ? total / count : 0;
    const recurringPatterns = buildRecurringPatterns(expenses);
    const largestExpense = [...expenses].sort((a, b) => b.amount - a.amount)[0];
    const comparedPeriod = buildComparedPeriod(expenses, input.period);
    const intelligence = await generateExpenseIntelligence({
      period: input.period,
      total,
      count,
      average,
      currency: getCommonCurrency(expenses),
      byCategory,
      recurringPatterns,
      peakPeriod: buildPeakPeriodLabel(expenses),
      largestExpense: largestExpense
        ? {
            amount: largestExpense.amount,
            category: largestExpense.category,
            description: largestExpense.description,
            date: largestExpense.date,
          }
        : undefined,
      comparedPeriod,
    });

    return res.json({
      period: input.period,
      exportedAt: new Date().toISOString(),
      total,
      count,
      average,
      byCategory,
      expenses,
      intelligence,
      source: {
        expenseSkill: expensesResult.source || summaryResult.source || "static",
        analysis: "llm",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const isLlmError = message.includes("API error");
    return res.status(isLlmError ? 502 : 500).json({
      error: isLlmError
        ? "The selected AI provider could not analyze spending right now."
        : "Could not analyze your expenses right now.",
    });
  }
}

export async function handleClearExpensesRequest(
  _req: { body?: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const listResult = await callMcpTool<ExpenseToolResult>(
      "listExpenses",
      {
        period: "all",
        limit: 100,
      },
      {
        timeoutMs: 5000,
        retries: 1,
      },
    );

    const expenses = listResult.expenses || [];
    const deleted: string[] = [];

    for (const expense of expenses) {
      const deleteResult = await callMcpTool<ExpenseToolResult>(
        "deleteExpense",
        {
          target: expense.id,
        },
        {
          timeoutMs: 5000,
          retries: 1,
        },
      );

      if (deleteResult?.expense?.id) {
        deleted.push(deleteResult.expense.id);
      }
    }

    res.json({
      cleared: deleted.length,
      deleted,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Could not clear expenses right now.",
    });
  }
}

function buildRecurringPatterns(expenses: ExpenseItem[]): string[] {
  const categoryCounts = new Map<string, number>();
  const descriptionCounts = new Map<string, number>();

  for (const expense of expenses) {
    const normalizedCategory = expense.category.trim().toLowerCase();
    const normalizedDescription = expense.description.trim().toLowerCase();
    categoryCounts.set(normalizedCategory, (categoryCounts.get(normalizedCategory) || 0) + 1);
    if (normalizedDescription) {
      descriptionCounts.set(normalizedDescription, (descriptionCounts.get(normalizedDescription) || 0) + 1);
    }
  }

  const repeatedCategories = [...categoryCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => `${capitalize(category)} appears ${count} times`);

  const repeatedDescriptions = [...descriptionCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([description, count]) => `${capitalize(description)} repeats ${count} times`);

  return [...repeatedCategories, ...repeatedDescriptions];
}

function buildPeakPeriodLabel(expenses: ExpenseItem[]): string {
  if (!expenses.length) {
    return "No data yet";
  }

  const byDate = new Map<string, number>();
  for (const expense of expenses) {
    const key = expense.date.slice(0, 10);
    byDate.set(key, (byDate.get(key) || 0) + expense.amount);
  }

  const top = [...byDate.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) {
    return "No data yet";
  }

  return `${top[0]} at ${top[1]}`;
}

function buildComparedPeriod(expenses: ExpenseItem[], period: "all" | "month" | "year") {
  if (!expenses.length) {
    return undefined;
  }

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const filter = period === "year"
    ? (expense: ExpenseItem) => new Date(expense.date).getFullYear() === currentYear
    : (expense: ExpenseItem) => {
        const expenseDate = new Date(expense.date);
        return expenseDate.getFullYear() === currentYear && expenseDate.getMonth() === currentMonth;
      };

  const currentTotal = expenses.filter(filter).reduce((sum, expense) => sum + expense.amount, 0);
  const previousTotal = expenses
    .filter((expense) => {
      const expenseDate = new Date(expense.date);
      if (period === "year") {
        return expenseDate.getFullYear() === currentYear - 1;
      }

      const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return expenseDate.getFullYear() === previousYear && expenseDate.getMonth() === previousMonth;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  const label = period === "year" ? `${currentYear - 1}` : "previous month";
  return {
    label,
    total: previousTotal,
    difference: currentTotal - previousTotal,
  };
}

function getCommonCurrency(expenses: ExpenseItem[]): "AED" | "INR" | undefined {
  const currencies = new Set(expenses.map((expense) => expense.currency || "AED"));
  return currencies.size === 1 ? (currencies.values().next().value as "AED" | "INR") : undefined;
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default router;
