import { z } from "zod";

export const expenseMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(2000, "Message must be under 2000 characters."),
});

export type ExpenseMessageInput = z.infer<typeof expenseMessageSchema>;

export const expenseCreateSchema = z.object({
  amount: z.number().positive("Amount must be greater than zero."),
  currency: z.enum(["AED", "INR"]).optional().default("AED"),
  category: z
    .string()
    .trim()
    .min(1, "Category is required.")
    .max(80, "Category must be under 80 characters."),
  description: z
    .string()
    .trim()
    .max(160, "Note must be under 160 characters.")
    .optional(),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
    .optional(),
});

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;

export const expenseIntelligenceSchema = z.object({
  period: z.enum(["all", "month", "year"]).optional().default("month"),
});

export type ExpenseIntelligenceInput = z.infer<typeof expenseIntelligenceSchema>;
