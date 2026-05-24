import { Router } from "express";
import { ZodError } from "zod";
import { handleExpenseMessage } from "../agents/expenseAgent";
import { expenseMessageSchema } from "../schemas/expenseSchemas";

const router = Router();

router.post("/message", handleExpenseMessageRequest);

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
    const isNvidiaError = message.includes("NVIDIA API error");

    return res.status(isNvidiaError ? 502 : 500).json({
      error: isNvidiaError
        ? "Expense AI could not answer right now."
        : "Could not process your expense request. Please try again.",
    });
  }
}

export default router;
