import { Router } from "express";
import { ZodError } from "zod";
import { buildLearningRoadmap, buildSkillTree } from "../agents/learningAgent";
import { learningRoadmapSchema, skillTreeSchema } from "../schemas/learningSchemas";

const router = Router();

router.post("/skill-tree", handleSkillTreeRequest);
router.post("/roadmap", handleRoadmapRequest);

export async function handleSkillTreeRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = skillTreeSchema.parse(req.body);
    const result = await buildSkillTree(input);
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
        ? "The selected AI provider could not build a skill tree right now."
        : "Could not build this skill tree right now.",
    });
  }
}

export async function handleRoadmapRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = learningRoadmapSchema.parse(req.body);
    const result = await buildLearningRoadmap(input);
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
        ? "The selected AI provider could not build a learning roadmap right now."
        : "Could not build this learning roadmap right now.",
    });
  }
}

export default router;
