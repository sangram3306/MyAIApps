import { z } from "zod";

export const recurringCreateSchema = z.object({
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
    .min(1, "Description is required.")
    .max(160, "Description must be under 160 characters."),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
    .optional(),
});

export type RecurringCreateInput = z.infer<typeof recurringCreateSchema>;

export const recurringUpdateSchema = z.object({
  amount: z.number().positive().optional(),
  currency: z.enum(["AED", "INR"]).optional(),
  category: z
    .string()
    .trim()
    .max(80, "Category must be under 80 characters.")
    .optional(),
  description: z
    .string()
    .trim()
    .max(160, "Description must be under 160 characters.")
    .optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  nextDueDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD.")
    .optional(),
  isActive: z.boolean().optional(),
});

export type RecurringUpdateInput = z.infer<typeof recurringUpdateSchema>;
