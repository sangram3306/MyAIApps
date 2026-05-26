import { Router } from "express";
import { ZodError } from "zod";
import { chatMessageSchema } from "../schemas/chatSchemas";
import { handleChatMessage } from "../agents/chatAgent";

const router = Router();

router.post("/message", handleChatMessageRequest);

export async function handleChatMessageRequest(req: { body: unknown }, res: {
  status(code: number): { json(payload: unknown): void };
  json(payload: unknown): void;
}) {
  try {
    const input = chatMessageSchema.parse(req.body);
    const result = await handleChatMessage(input.message);
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
        ? "The selected AI provider could not answer right now."
        : "Could not process your chat message. Please try again.",
    });
  }
}

export default router;
