import { Router } from "express";
import { ZodError } from "zod";
import { handleExpenseMessage } from "../agents/expenseAgent";
import { callMcpTool } from "../mcp/mcpClient";
import { expenseCreateSchema, expenseMessageSchema } from "../schemas/expenseSchemas";

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

export default router;
