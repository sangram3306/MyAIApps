import { z } from "zod";
import {
  createLearningRoadmap,
  createSkillTree,
  LearningRoadmap,
  listLearningRoadmaps,
  listSkillTrees,
  SkillTree,
} from "../services/learningStore.js";

const sourceSchema = z.enum(["static", "llm", "fallback"]);

const skillTreeNodeSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["concept", "practice", "project", "checkpoint"]).default("practice"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  whyItMatters: z.string().default(""),
  practice: z.string().default(""),
  proofOfSkill: z.string().default(""),
  estimatedHours: z.number().min(1).max(100).default(1),
});

const skillTreeBranchSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  nodes: z.array(skillTreeNodeSchema).default([]),
});

const saveSkillTreeInputSchema = z.object({
  skillName: z.string().min(1),
  currentLevel: z.string().default("beginner"),
  targetLevel: z.string().default("confident"),
  timeBudget: z.string().default("3 hours/week"),
  focusAreas: z.array(z.string()).default([]),
  overview: z.string().default(""),
  branches: z.array(skillTreeBranchSchema).default([]),
  weeklyQuests: z.array(z.string()).default([]),
  milestones: z.array(z.string()).default([]),
  recommendedRoutine: z.array(z.string()).default([]),
});

const listSkillTreesInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
  skillName: z.string().optional(),
}).passthrough();

const roadmapPhaseSchema = z.object({
  title: z.string().min(1),
  duration: z.string().default(""),
  outcome: z.string().default(""),
  lessons: z.array(z.string()).default([]),
  projects: z.array(z.string()).default([]),
  checkpoints: z.array(z.string()).default([]),
  resources: z.array(z.string()).default([]),
});

const saveRoadmapInputSchema = z.object({
  topic: z.string().min(1),
  goal: z.string().default("learn the fundamentals"),
  currentLevel: z.string().default("beginner"),
  timeline: z.string().default("8 weeks"),
  timePerWeek: z.string().default("3 hours/week"),
  overview: z.string().default(""),
  phases: z.array(roadmapPhaseSchema).default([]),
  weeklyPlan: z.array(z.string()).default([]),
  practiceLoop: z.array(z.string()).default([]),
  pitfalls: z.array(z.string()).default([]),
  successMetrics: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
});

const listRoadmapsInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
  topic: z.string().optional(),
}).passthrough();

type LearningToolOutput = {
  source: z.infer<typeof sourceSchema>;
  confidence: number;
  summary: string;
  skillTree?: SkillTree;
  skillTrees?: SkillTree[];
  roadmap?: LearningRoadmap;
  roadmaps?: LearningRoadmap[];
  count?: number;
};

export async function saveSkillTreeTool(input: unknown): Promise<LearningToolOutput> {
  const parsed = saveSkillTreeInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the skill tree.");
  }

  try {
    const skillTree = await createSkillTree(parsed.data);
    const skillTrees = await listSkillTrees({ limit: 10 });
    return {
      source: "static",
      confidence: 0.97,
      summary: `Saved skill tree: ${skillTree.skillName}`,
      skillTree,
      skillTrees,
      count: skillTrees.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Skill tree storage failed: ${message}`);
  }
}

export async function listSkillTreesTool(input: unknown): Promise<LearningToolOutput> {
  const parsed = listSkillTreesInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the skill tree history request.");
  }

  try {
    const skillTrees = await listSkillTrees({
      limit: parsed.data.limit,
      skillName: parsed.data.skillName,
    });
    return {
      source: "static",
      confidence: 0.98,
      summary: `Found ${skillTrees.length} saved skill tree${skillTrees.length === 1 ? "" : "s"}.`,
      skillTrees,
      count: skillTrees.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Skill tree history failed: ${message}`);
  }
}

export async function saveLearningRoadmapTool(input: unknown): Promise<LearningToolOutput> {
  const parsed = saveRoadmapInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the learning roadmap.");
  }

  try {
    const roadmap = await createLearningRoadmap(parsed.data);
    const roadmaps = await listLearningRoadmaps({ limit: 10 });
    return {
      source: "static",
      confidence: 0.97,
      summary: `Saved learning roadmap: ${roadmap.topic}`,
      roadmap,
      roadmaps,
      count: roadmaps.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Learning roadmap storage failed: ${message}`);
  }
}

export async function listLearningRoadmapsTool(input: unknown): Promise<LearningToolOutput> {
  const parsed = listRoadmapsInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the roadmap history request.");
  }

  try {
    const roadmaps = await listLearningRoadmaps({
      limit: parsed.data.limit,
      topic: parsed.data.topic,
    });
    return {
      source: "static",
      confidence: 0.98,
      summary: `Found ${roadmaps.length} saved learning roadmap${roadmaps.length === 1 ? "" : "s"}.`,
      roadmaps,
      count: roadmaps.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Learning roadmap history failed: ${message}`);
  }
}

async function fallback(summary: string): Promise<LearningToolOutput> {
  return {
    source: "fallback",
    confidence: 0.3,
    summary,
    skillTrees: [],
    roadmaps: [],
  };
}
