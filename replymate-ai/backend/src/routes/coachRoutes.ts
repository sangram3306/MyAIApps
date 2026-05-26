import { Router } from "express";
import { ZodError } from "zod";
import { analyzeWithReplyCoach } from "../agents/replyCoachAgent";
import { coachAnalyzeSchema } from "../schemas/coachSchemas";
import { McpClientError } from "../mcp/mcpClient";

const router = Router();

export async function handleCoachAnalyze(req: { body: unknown }, res: {
  json: (value: unknown) => void;
  status: (code: number) => {
    json: (value: unknown) => void;
  };
}) {
  try {
    const input = coachAnalyzeSchema.parse(req.body);
    const result = await analyzeWithReplyCoach(input);
    res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }

    if (error instanceof McpClientError) {
      return res.status(error.statusCode).json({
        error: "Smart Reply Coach is temporarily unavailable. Please try again shortly.",
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const isLlmError = message.includes("API error") || message.includes("Could not generate");
    return res.status(isLlmError ? 502 : 500).json({
      error: isLlmError
        ? "The selected AI provider could not generate coaching advice right now."
        : "Could not analyze the message. Please try again.",
    });
  }
}

router.post("/analyze", (req, res) => {
  void handleCoachAnalyze(req, res);
});

export default router;
