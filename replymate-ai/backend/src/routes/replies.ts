import { Router } from "express";
import { ZodError } from "zod";
import { generateRepliesSchema } from "../schemas/replySchemas";
import { fixGrammar, generateReplies, rewriteMessage } from "../services/nvidiaService";

const router = Router();

router.post("/generate", async (req, res) => {
  try {
    const input = generateRepliesSchema.parse(req.body);
    const replies = await generateReplies(input);

    res.json({ replies });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const isLlmError = message.includes("API error");
    const isModelError = message.includes("Model response");

    return res.status(isLlmError || isModelError ? 502 : 500).json({
      error: isLlmError
        ? "The selected AI provider could not generate replies right now."
        : isModelError
          ? "AI returned an unexpected response. Please try again."
          : "Could not generate replies. Please try again.",
    });
  }
});

router.post("/rewrite", async (req, res) => {
  try {
    const input = generateRepliesSchema.parse(req.body);
    const replies = await rewriteMessage(input);

    res.json({ replies });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const isLlmError = message.includes("API error");
    const isModelError = message.includes("Model response");

    return res.status(isLlmError || isModelError ? 502 : 500).json({
      error: isLlmError
        ? "The selected AI provider could not rewrite your message right now."
        : isModelError
          ? "AI returned an unexpected response. Please try again."
          : "Could not rewrite your message. Please try again.",
    });
  }
});

router.post("/grammar", async (req, res) => {
  try {
    const input = generateRepliesSchema.parse(req.body);
    const replies = await fixGrammar(input);

    res.json({ replies });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const isLlmError = message.includes("API error");
    const isModelError = message.includes("Model response");

    return res.status(isLlmError || isModelError ? 502 : 500).json({
      error: isLlmError
        ? "The selected AI provider could not fix grammar right now."
        : isModelError
          ? "AI returned an unexpected response. Please try again."
          : "Could not fix grammar. Please try again.",
    });
  }
});

export default router;
