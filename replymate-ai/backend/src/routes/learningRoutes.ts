import { Router } from "express";
import { ZodError } from "zod";
import { z } from "zod";
import { callMcpTool } from "../mcp/mcpClient";
import { buildLearningRoadmap, buildSkillTree } from "../agents/learningAgent";
import { learningRoadmapSchema, skillTreeSchema } from "../schemas/learningSchemas";

const router = Router();

router.post("/skill-tree", handleSkillTreeRequest);
router.post("/roadmap", handleRoadmapRequest);
router.get("/skill-trees", handleSkillTreesRequest);
router.post("/skill-trees/save", handleSaveSkillTreeRequest);
router.delete("/skill-trees/:id", handleDeleteSkillTreeRequest);
router.get("/roadmaps", handleRoadmapsRequest);

const saveSkillTreePayloadSchema = z.object({
  skillName: z.string().min(1),
  currentLevel: z.string().default("beginner"),
  targetLevel: z.string().default("confident"),
  timeBudget: z.string().default("3 hours/week"),
  focusAreas: z.array(z.string()).default([]),
  overview: z.string().default(""),
  branches: z.array(z.any()).default([]),
  weeklyQuests: z.array(z.string()).default([]),
  milestones: z.array(z.string()).default([]),
  recommendedRoutine: z.array(z.string()).default([]),
});

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

export async function handleSaveSkillTreeRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = saveSkillTreePayloadSchema.parse(req.body);
    const result = await callMcpTool<{
      source: "static" | "llm" | "fallback";
      summary: string;
      skillTree?: unknown;
    }>("saveSkillTree", input, { timeoutMs: 8000, retries: 1 });

    return res.json({
      saved: Boolean(result.skillTree),
      summary: result.summary,
      source: result.source,
      skillTree: result.skillTree || null,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }

    return res.status(500).json({ error: "Could not save this skill tree." });
  }
}

export async function handleDeleteSkillTreeRequest(
  req: { params?: Record<string, string | undefined> },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  const id = req.params?.id?.trim();
  if (!id) {
    return res.status(400).json({ error: "Skill tree id is required." });
  }

  try {
    const result = await callMcpTool<{
      source: "static" | "llm" | "fallback";
      summary: string;
      deletedCount?: number;
      id?: string;
    }>("deleteSkillTree", { id }, { timeoutMs: 8000, retries: 1 });

    return res.json({
      deleted: (result.deletedCount || 0) > 0,
      deletedCount: result.deletedCount || 0,
      id: result.id || id,
      summary: result.summary,
      source: result.source,
    });
  } catch {
    return res.status(500).json({ error: "Could not delete this skill tree." });
  }
}

export default router;
