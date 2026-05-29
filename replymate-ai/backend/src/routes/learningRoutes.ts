import { Router } from "express";
import { ZodError } from "zod";
import { callMcpTool } from "../mcp/mcpClient";
import { buildLearningRoadmap, buildSkillTree } from "../agents/learningAgent";
import { learningRoadmapSchema, skillTreeSchema } from "../schemas/learningSchemas";

const router = Router();

router.post("/skill-tree", handleSkillTreeRequest);
router.post("/roadmap", handleRoadmapRequest);
router.get("/skill-trees", handleSkillTreesRequest);
router.get("/roadmaps", handleRoadmapsRequest);

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

export async function handleSkillTreesRequest(
  _req: { query?: Record<string, unknown> },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const result = await callMcpTool<{
      source: "static" | "llm" | "fallback";
      summary: string;
      skillTrees?: unknown[];
      count?: number;
    }>(
      "listSkillTrees",
      { limit: 20 },
      { timeoutMs: 5000, retries: 1 },
    );

    return res.json({
      skillTrees: result.skillTrees || [],
      count: result.count ?? (result.skillTrees?.length || 0),
      source: result.source,
    });
  } catch {
    return res.json({
      skillTrees: [],
      count: 0,
      source: "fallback",
    });
  }
}

export async function handleRoadmapsRequest(
  _req: { query?: Record<string, unknown> },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const result = await callMcpTool<{
      source: "static" | "llm" | "fallback";
      summary: string;
      roadmaps?: unknown[];
      count?: number;
    }>(
      "listLearningRoadmaps",
      { limit: 20 },
      { timeoutMs: 5000, retries: 1 },
    );

    return res.json({
      roadmaps: result.roadmaps || [],
      count: result.count ?? (result.roadmaps?.length || 0),
      source: result.source,
    });
  } catch {
    return res.json({
      roadmaps: [],
      count: 0,
      source: "fallback",
    });
  }
}

export default router;
