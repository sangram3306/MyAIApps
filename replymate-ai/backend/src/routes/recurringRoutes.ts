import { Router } from "express";
import { ZodError } from "zod";
import { callMcpTool } from "../mcp/mcpClient";
import { recurringCreateSchema, recurringUpdateSchema } from "../schemas/recurringSchemas";

const router = Router();

type RecurringExpense = {
  id: string;
  amount: number;
  currency: "AED" | "INR";
  category: string;
  description: string;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  nextDueDate: string;
  lastLoggedDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type RecurringToolResult = {
  source: string;
  summary: string;
  recurring?: RecurringExpense;
  items: RecurringExpense[];
};

router.post("/create", handleCreateRecurring);
router.get("/list", handleListRecurring);
router.put("/:id", handleUpdateRecurring);
router.delete("/:id", handleDeleteRecurring);
router.post("/:id/log", handleLogRecurring);

export async function handleCreateRecurring(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = recurringCreateSchema.parse(req.body);
    const result = await callMcpTool<RecurringToolResult>(
      "createRecurringExpense",
      input,
      { timeoutMs: 5000, retries: 1 },
    );
    res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request.", details: error.flatten().fieldErrors });
    }
    return res.status(500).json({ error: "Could not create recurring expense." });
  }
}

export async function handleListRecurring(
  req: { query: { activeOnly?: string; dueToday?: string } },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const activeOnly = req.query.activeOnly !== "false";
    const dueToday = req.query.dueToday === "true";
    const result = await callMcpTool<RecurringToolResult>(
      "listRecurringExpenses",
      { activeOnly, dueToday },
      { timeoutMs: 5000, retries: 1 },
    );
    res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Could not list recurring expenses." });
  }
}

export async function handleUpdateRecurring(
  req: { params: { id: string }; body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = recurringUpdateSchema.parse(req.body);
    const result = await callMcpTool<RecurringToolResult>(
      "updateRecurringExpense",
      { id: req.params.id, ...input },
      { timeoutMs: 5000, retries: 1 },
    );
    res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ error: "Invalid request.", details: error.flatten().fieldErrors });
    }
    return res.status(500).json({ error: "Could not update recurring expense." });
  }
}

export async function handleDeleteRecurring(
  req: { params: { id: string } },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const result = await callMcpTool<RecurringToolResult>(
      "deleteRecurringExpense",
      { id: req.params.id },
      { timeoutMs: 5000, retries: 1 },
    );
    res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Could not delete recurring expense." });
  }
}

export async function handleLogRecurring(
  req: { params: { id: string } },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const result = await callMcpTool<RecurringToolResult>(
      "logRecurringExpense",
      { id: req.params.id },
      { timeoutMs: 5000, retries: 1 },
    );

    if (result.recurring) {
      // Create a one-time expense
      await callMcpTool(
        "createExpense",
        {
          amount: result.recurring.amount,
          currency: result.recurring.currency,
          category: result.recurring.category,
          description: result.recurring.description,
          date: new Date().toISOString().slice(0, 10), // Use today's date for the actual logged expense
        },
        { timeoutMs: 5000, retries: 1 }
      );
    }

    res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Could not log recurring expense." });
  }
}

export default router;
