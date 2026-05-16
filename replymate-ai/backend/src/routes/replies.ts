import { Router } from "express";
import { ZodError } from "zod";
import { generateRepliesSchema } from "../schemas/replySchemas";
import { generateReplies } from "../services/nvidiaService";

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
    const isNvidiaError = message.includes("NVIDIA API error");
    const isModelError = message.includes("Model response");

    return res.status(isNvidiaError || isModelError ? 502 : 500).json({
      error: isNvidiaError
        ? "NVIDIA API could not generate replies right now."
        : isModelError
          ? "AI returned an unexpected response. Please try again."
          : "Could not generate replies. Please try again.",
    });
  }
});

export default router;
