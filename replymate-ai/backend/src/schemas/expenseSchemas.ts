import { z } from "zod";

export const expenseMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(2000, "Message must be under 2000 characters."),
});

export type ExpenseMessageInput = z.infer<typeof expenseMessageSchema>;
