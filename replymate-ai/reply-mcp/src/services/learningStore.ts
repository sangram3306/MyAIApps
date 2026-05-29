import { randomUUID } from "node:crypto";
import { Collection, MongoClient } from "mongodb";

export type SkillTreeNode = {
  title: string;
  type: "concept" | "practice" | "project" | "checkpoint";
  difficulty: "easy" | "medium" | "hard";
  whyItMatters: string;
  practice: string;
  proofOfSkill: string;
  estimatedHours: number;
};

export type SkillTreeBranch = {
  name: string;
  description: string;
  nodes: SkillTreeNode[];
};

export type SkillTree = {
  id: string;
  skillName: string;
  currentLevel: string;
  targetLevel: string;
  timeBudget: string;
  focusAreas: string[];
  overview: string;
  branches: SkillTreeBranch[];
  weeklyQuests: string[];
  milestones: string[];
  recommendedRoutine: string[];
  createdAt: string;
  updatedAt: string;
};

export type LearningRoadmapPhase = {
  title: string;
  duration: string;
  outcome: string;
  lessons: string[];
  projects: string[];
  checkpoints: string[];
  resources: string[];
};

export type LearningRoadmap = {
  id: string;
  topic: string;
  goal: string;
  currentLevel: string;
  timeline: string;
  timePerWeek: string;
  overview: string;
  phases: LearningRoadmapPhase[];
  weeklyPlan: string[];
  practiceLoop: string[];
  pitfalls: string[];
  successMetrics: string[];
  nextActions: string[];
  createdAt: string;
  updatedAt: string;
};

type SkillTreeInput = Omit<SkillTree, "id" | "createdAt" | "updatedAt">;
type LearningRoadmapInput = Omit<LearningRoadmap, "id" | "createdAt" | "updatedAt">;

let mongoClientPromise: Promise<MongoClient> | null = null;

async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(uri).connect();
  }

  return mongoClientPromise;
}

async function getSkillTreeCollection(): Promise<Collection<SkillTree>> {
  const client = await getClient();
  const dbName = process.env.MONGODB_DB_NAME?.trim() || "replymate_ai";
  const collectionName = process.env.MONGODB_SKILL_TREES_COLLECTION?.trim() || "skill_trees";
  return client.db(dbName).collection<SkillTree>(collectionName);
}

async function getRoadmapCollection(): Promise<Collection<LearningRoadmap>> {
  const client = await getClient();
  const dbName = process.env.MONGODB_DB_NAME?.trim() || "replymate_ai";
  const collectionName = process.env.MONGODB_LEARNING_ROADMAPS_COLLECTION?.trim() || "learning_roadmaps";
  return client.db(dbName).collection<LearningRoadmap>(collectionName);
}

export async function createSkillTree(input: SkillTreeInput): Promise<SkillTree> {
  const now = new Date().toISOString();
  const tree: SkillTree = {
    ...sanitizeSkillTreeInput(input),
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  const collection = await getSkillTreeCollection();
  await collection.insertOne(tree);
  return tree;
}

export async function listSkillTrees(filter: { limit?: number; skillName?: string } = {}): Promise<SkillTree[]> {
  const limit = Math.min(Math.max(filter.limit || 10, 1), 50);
  const skillName = normalizeSentence(filter.skillName || "").toLowerCase();
  const collection = await getSkillTreeCollection();
  const query = skillName ? { skillName: { $regex: escapeRegExp(skillName), $options: "i" } } : {};
  return collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function deleteSkillTree(id: string): Promise<{ deletedCount: number; id: string }> {
  const collection = await getSkillTreeCollection();
  const result = await collection.deleteOne({ id: normalizeSentence(id) });
  return { deletedCount: result.deletedCount, id: normalizeSentence(id) };
}

export async function createLearningRoadmap(input: LearningRoadmapInput): Promise<LearningRoadmap> {
  const now = new Date().toISOString();
  const roadmap: LearningRoadmap = {
    ...sanitizeLearningRoadmapInput(input),
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  const collection = await getRoadmapCollection();
  await collection.insertOne(roadmap);
  return roadmap;
}

export async function listLearningRoadmaps(filter: { limit?: number; topic?: string } = {}): Promise<LearningRoadmap[]> {
  const limit = Math.min(Math.max(filter.limit || 10, 1), 50);
  const topic = normalizeSentence(filter.topic || "").toLowerCase();
  const collection = await getRoadmapCollection();
  const query = topic ? { topic: { $regex: escapeRegExp(topic), $options: "i" } } : {};
  return collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}

function sanitizeSkillTreeInput(input: SkillTreeInput): SkillTreeInput {
  return {
    skillName: normalizeSentence(input.skillName || "Untitled skill"),
    currentLevel: normalizeSentence(input.currentLevel || "beginner"),
    targetLevel: normalizeSentence(input.targetLevel || "confident"),
    timeBudget: normalizeSentence(input.timeBudget || "3 hours/week"),
    focusAreas: sanitizeList(input.focusAreas, 8),
    overview: normalizeSentence(input.overview || ""),
    branches: sanitizeBranches(input.branches),
    weeklyQuests: sanitizeList(input.weeklyQuests, 8),
    milestones: sanitizeList(input.milestones, 8),
    recommendedRoutine: sanitizeList(input.recommendedRoutine, 8),
  };
}

function sanitizeLearningRoadmapInput(input: LearningRoadmapInput): LearningRoadmapInput {
  return {
    topic: normalizeSentence(input.topic || "Untitled topic"),
    goal: normalizeSentence(input.goal || "learn the fundamentals"),
    currentLevel: normalizeSentence(input.currentLevel || "beginner"),
    timeline: normalizeSentence(input.timeline || "8 weeks"),
    timePerWeek: normalizeSentence(input.timePerWeek || "3 hours/week"),
    overview: normalizeSentence(input.overview || ""),
    phases: sanitizePhases(input.phases),
    weeklyPlan: sanitizeList(input.weeklyPlan, 10),
    practiceLoop: sanitizeList(input.practiceLoop, 8),
    pitfalls: sanitizeList(input.pitfalls, 8),
    successMetrics: sanitizeList(input.successMetrics, 8),
    nextActions: sanitizeList(input.nextActions, 8),
  };
}

function sanitizeBranches(branches: SkillTreeBranch[]): SkillTreeBranch[] {
  return Array.isArray(branches)
    ? branches
        .filter((branch) => branch && typeof branch.name === "string" && branch.name.trim())
        .slice(0, 6)
        .map((branch) => ({
          name: normalizeSentence(branch.name),
          description: normalizeSentence(branch.description || ""),
          nodes: sanitizeNodes(branch.nodes),
        }))
    : [];
}

function sanitizeNodes(nodes: SkillTreeNode[]): SkillTreeNode[] {
  return Array.isArray(nodes)
    ? nodes
        .filter((node) => node && typeof node.title === "string" && node.title.trim())
        .slice(0, 8)
        .map((node) => ({
          title: normalizeSentence(node.title),
          type: ["concept", "practice", "project", "checkpoint"].includes(node.type) ? node.type : "practice",
          difficulty: ["easy", "medium", "hard"].includes(node.difficulty) ? node.difficulty : "medium",
          whyItMatters: normalizeSentence(node.whyItMatters || ""),
          practice: normalizeSentence(node.practice || ""),
          proofOfSkill: normalizeSentence(node.proofOfSkill || ""),
          estimatedHours: clampHours(node.estimatedHours),
        }))
    : [];
}

function sanitizePhases(phases: LearningRoadmapPhase[]): LearningRoadmapPhase[] {
  return Array.isArray(phases)
    ? phases
        .filter((phase) => phase && typeof phase.title === "string" && phase.title.trim())
        .slice(0, 8)
        .map((phase) => ({
          title: normalizeSentence(phase.title),
          duration: normalizeSentence(phase.duration || ""),
          outcome: normalizeSentence(phase.outcome || ""),
          lessons: sanitizeList(phase.lessons, 8),
          projects: sanitizeList(phase.projects, 6),
          checkpoints: sanitizeList(phase.checkpoints, 6),
          resources: sanitizeList(phase.resources, 6),
        }))
    : [];
}

function sanitizeList(values: string[], limit: number): string[] {
  return Array.isArray(values)
    ? values
        .filter((value) => typeof value === "string" && value.trim())
        .map(normalizeSentence)
        .slice(0, limit)
    : [];
}

function clampHours(value: number): number {
  const hours = Number.isFinite(value) ? value : 1;
  return Math.min(100, Math.max(1, Math.round(hours)));
}

function normalizeSentence(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
