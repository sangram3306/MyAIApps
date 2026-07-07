import { Router } from "express";
import { ZodError } from "zod";
import { chatMessageSchema } from "../schemas/chatSchemas";
import { handleChatMessage } from "../agents/chatAgent";
import { verifyToken } from "../services/authService";

const router = Router();

router.post("/message", handleChatMessageRequest);

export async function handleChatMessageRequest(req: { body: unknown; headers?: Record<string, string | string[] | undefined> }, res: {
  status(code: number): { json(payload: unknown): void };
  json(payload: unknown): void;
}) {
  try {
    const input = chatMessageSchema.parse(req.body);

    let userId = "default";
    let userName: string | undefined = undefined;
    const authHeader = req.headers.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split(" ")[1];
        const decoded = verifyToken(token);
        if (decoded && decoded.userId) {
          userId = decoded.userId;
          userName = decoded.name;
        }
      } catch (err) {
        // Ignored, fallback to "default"
      }
    }

    const result = await handleChatMessage(input.message, userId, input.history, userName);
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
