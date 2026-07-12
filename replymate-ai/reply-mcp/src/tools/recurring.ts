import { z } from "zod";
import {
  createRecurring,
  deleteRecurring,
  listRecurring,
  markRecurringAsLogged,
  RecurringExpense,
  updateRecurring,
} from "../services/recurringStore.js";

const createRecurringInputSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["AED", "INR"]).optional().default("AED"),
  category: z.string().min(1).default("other"),
  description: z.string().min(1).default("Recurring expense"),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  startDate: z.string().optional(),
});

const listRecurringInputSchema = z.object({
  activeOnly: z.boolean().optional().default(true),
  dueToday: z.boolean().optional().default(false),
});

const updateRecurringInputSchema = z.object({
  id: z.string().min(1),
  amount: z.number().positive().optional(),
  currency: z.enum(["AED", "INR"]).optional(),
  category: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  nextDueDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

const deleteRecurringInputSchema = z.object({
  id: z.string().min(1),
});

type RecurringToolOutput = {
  source: "static" | "fallback";
  confidence: number;
  summary: string;
  recurring?: RecurringExpense;
  items: RecurringExpense[];
};

export async function createRecurringExpenseTool(input: unknown): Promise<RecurringToolOutput> {
  const parsed = createRecurringInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the recurring expense details.");
  }

  const recurring = await createRecurring(parsed.data);
  const items = await listRecurring();
  return {
    source: "static",
    confidence: 0.96,
    summary: `Created recurring ${recurring.frequency} expense: ${formatAmount(recurring.amount, recurring.currency)} for ${recurring.description}.`,
    recurring,
    items,
  };
}

export async function listRecurringExpensesTool(input: unknown): Promise<RecurringToolOutput> {
  const parsed = listRecurringInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the recurring expenses list request.");
  }

  const items = await listRecurring(parsed.data);
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return {
    source: "static",
    confidence: 0.98,
    summary: `Found ${items.length} recurring expense${items.length === 1 ? "" : "s"} totaling ${formatAmount(total)}/cycle.`,
    items,
  };
}

export async function updateRecurringExpenseTool(input: unknown): Promise<RecurringToolOutput> {
  const parsed = updateRecurringInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the recurring expense update request.");
  }

  const { id, ...updates } = parsed.data;
  const recurring = await updateRecurring(id, updates);
  if (!recurring) {
    return fallback("Could not find the recurring expense to update.");
  }

  const items = await listRecurring();
  return {
    source: "static",
    confidence: 0.94,
    summary: `Updated recurring expense: ${recurring.description}.`,
    recurring,
    items,
  };
}

export async function deleteRecurringExpenseTool(input: unknown): Promise<RecurringToolOutput> {
  const parsed = deleteRecurringInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the recurring expense to delete.");
  }

  const recurring = await deleteRecurring(parsed.data.id);
  if (!recurring) {
    return fallback("Could not find the recurring expense to delete.");
  }

  const items = await listRecurring();
  return {
    source: "static",
    confidence: 0.9,
    summary: `Deleted recurring expense: ${recurring.description} (${formatAmount(recurring.amount, recurring.currency)} ${recurring.frequency}).`,
    recurring,
    items,
  };
}

export async function logRecurringExpenseTool(input: unknown): Promise<RecurringToolOutput> {
  const parsed = deleteRecurringInputSchema.safeParse(input); // same schema: just needs { id }
  if (!parsed.success) {
    return fallback("Could not read the recurring expense to log.");
  }

  const recurring = await markRecurringAsLogged(parsed.data.id);
  if (!recurring) {
    return fallback("Could not find the recurring expense to log.");
  }

  const items = await listRecurring();
  return {
    source: "static",
    confidence: 0.95,
    summary: `Logged recurring expense: ${recurring.description}. Next due: ${recurring.nextDueDate}.`,
    recurring,
    items,
  };
}

function formatAmount(amount: number, currency?: "AED" | "INR"): string {
  const formatted = amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

async function fallback(summary: string): Promise<RecurringToolOutput> {
  return {
    source: "fallback",
    confidence: 0.3,
    summary,
    items: await listRecurring().catch(() => []),
  };
}
