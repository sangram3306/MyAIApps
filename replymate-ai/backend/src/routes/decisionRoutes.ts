import { Router } from "express";
import { ZodError } from "zod";
import { simulateDecision } from "../agents/decisionAgent";
import { decisionSimulateSchema } from "../schemas/decisionSchemas";

const router = Router();

router.post("/simulate", handleDecisionSimulateRequest);

export async function handleDecisionSimulateRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = decisionSimulateSchema.parse(req.body);
    const result = await simulateDecision(input);
    return res.json(result);
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
        ? "The selected AI provider could not simulate this decision right now."
        : "Could not simulate this decision right now.",
    });
  }
}

export default router;
