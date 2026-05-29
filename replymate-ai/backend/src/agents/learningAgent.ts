import { callMcpTool } from "../mcp/mcpClient";
import { callChatCompletion, hasConfiguredLlmApiKey } from "../services/llmService";
import { safeParseJson } from "../utils/safeJson";

type Source = "static" | "llm" | "fallback";
type LearningToolName = "listSkillTrees" | "saveSkillTree" | "listLearningRoadmaps" | "saveLearningRoadmap";

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

export type SkillTreeInput = {
  skillName: string;
  currentLevel: string;
  targetLevel: string;
  timeBudget: string;
  focusAreas: string[];
};

export type RoadmapInput = {
  topic: string;
  goal: string;
  currentLevel: string;
  timeline: string;
  timePerWeek: string;
};

export type SkillTreeResponse = {
  assistantReply: string;
  skillTree: SkillTree;
  recentSkillTrees: SkillTree[];
  saved: boolean;
  saveSummary: string;
  toolCalls: ToolCallSummary[];
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      skillMemory: Source;
      skillStorage: Source;
      planGeneration: Source;
    };
  };
};

export type RoadmapResponse = {
  assistantReply: string;
  roadmap: LearningRoadmap;
  recentRoadmaps: LearningRoadmap[];
  saved: boolean;
  saveSummary: string;
  toolCalls: ToolCallSummary[];
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      roadmapMemory: Source;
      roadmapStorage: Source;
      planGeneration: Source;
    };
  };
};

type ToolCallSummary = {
  name: string;
  source: Source;
  summary: string;
};

type LearningToolResult = {
  source: Source;
  confidence: number;
  summary: string;
  skillTree?: SkillTree;
  skillTrees?: SkillTree[];
  roadmap?: LearningRoadmap;
  roadmaps?: LearningRoadmap[];
  count?: number;
};

export async function buildSkillTree(input: SkillTreeInput): Promise<SkillTreeResponse> {
  const trace = ["Received skill tree request"];
  const toolCalls: ToolCallSummary[] = [];
  const recent = await callLearningTool("listSkillTrees", { limit: 5, skillName: input.skillName });
  toolCalls.push({ name: "listSkillTrees", source: recent.source, summary: recent.summary });
  trace.push("Loaded skill memory");

  const generated = hasConfiguredLlmApiKey()
    ? await generateSkillTreeWithLlm(input, recent.skillTrees || []).catch(() => localSkillTree(input))
    : localSkillTree(input);
  trace.push("Generated skill tree");

  const saved = await callLearningTool("saveSkillTree", generated);
  toolCalls.push({ name: "saveSkillTree", source: saved.source, summary: saved.summary });
  trace.push(saved.skillTree ? "Saved skill tree to MongoDB" : "Returned skill tree without DB save");

  const skillTree = saved.skillTree || withSkillTreeMetadata(generated);
  const savedToDb = Boolean(saved.skillTree);
  const saveSummary = saved.summary || (savedToDb ? "Saved to MongoDB." : "Save skipped.");

  return {
    assistantReply: `${skillTree.skillName} is mapped into ${skillTree.branches.length} branches with ${skillTree.weeklyQuests.length} weekly quests.${savedToDb ? " I saved it to your skill memory." : " I could not save this to DB."}`,
    skillTree,
    recentSkillTrees: recent.skillTrees || [],
    saved: savedToDb,
    saveSummary,
    toolCalls,
    agentTrace: [...trace, "Returned skill tree response"],
    metadata: {
      toolsUsed: ["learningAgent", ...toolCalls.map((tool) => tool.name)],
      toolSources: {
        skillMemory: recent.source,
        skillStorage: saved.source,
        planGeneration: hasConfiguredLlmApiKey() ? "llm" : "fallback",
      },
    },
  };
}

export async function buildLearningRoadmap(input: RoadmapInput): Promise<RoadmapResponse> {
  const trace = ["Received roadmap request"];
  const toolCalls: ToolCallSummary[] = [];
  const recent = await callLearningTool("listLearningRoadmaps", { limit: 5, topic: input.topic });
  toolCalls.push({ name: "listLearningRoadmaps", source: recent.source, summary: recent.summary });
  trace.push("Loaded roadmap memory");

  const generated = hasConfiguredLlmApiKey()
    ? await generateRoadmapWithLlm(input, recent.roadmaps || []).catch(() => localRoadmap(input))
    : localRoadmap(input);
  trace.push("Generated learning roadmap");

  const saved = await callLearningTool("saveLearningRoadmap", generated);
  toolCalls.push({ name: "saveLearningRoadmap", source: saved.source, summary: saved.summary });
  trace.push(saved.roadmap ? "Saved roadmap to MongoDB" : "Returned roadmap without DB save");

  const roadmap = saved.roadmap || withRoadmapMetadata(generated);
  const savedToDb = Boolean(saved.roadmap);
  const saveSummary = saved.summary || (savedToDb ? "Saved to MongoDB." : "Save skipped.");

  return {
    assistantReply: `${roadmap.topic} is planned across ${roadmap.phases.length} phases for ${roadmap.timeline}.${savedToDb ? " I saved it to your learning memory." : " I could not save this to DB."}`,
    roadmap,
    recentRoadmaps: recent.roadmaps || [],
    saved: savedToDb,
    saveSummary,
    toolCalls,
    agentTrace: [...trace, "Returned roadmap response"],
    metadata: {
      toolsUsed: ["learningAgent", ...toolCalls.map((tool) => tool.name)],
      toolSources: {
        roadmapMemory: recent.source,
        roadmapStorage: saved.source,
        planGeneration: hasConfiguredLlmApiKey() ? "llm" : "fallback",
      },
    },
  };
}

async function generateSkillTreeWithLlm(
  input: SkillTreeInput,
  recentSkillTrees: SkillTree[],
): Promise<Omit<SkillTree, "id" | "createdAt" | "updatedAt">> {
  const completion = await callChatCompletion({
    temperature: 0.35,
    maxTokens: 1200,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Return only valid JSON for a Personal Skill Tree. Make it practical, skill-based, and measurable. Do not include external links.",
      },
      {
        role: "user",
        content: JSON.stringify({
          input,
          recentSkillTrees: recentSkillTrees.slice(0, 3).map((tree) => ({
            skillName: tree.skillName,
            targetLevel: tree.targetLevel,
            branches: tree.branches.map((branch) => branch.name),
          })),
          outputSchema: {
            skillName: "string",
            currentLevel: "string",
            targetLevel: "string",
            timeBudget: "string",
            focusAreas: "string[]",
            overview: "string",
            branches: [
              {
                name: "string",
                description: "string",
                nodes: [
                  {
                    title: "string",
                    type: "concept | practice | project | checkpoint",
                    difficulty: "easy | medium | hard",
                    whyItMatters: "string",
                    practice: "string",
                    proofOfSkill: "string",
                    estimatedHours: "number",
                  },
                ],
              },
            ],
            weeklyQuests: "string[]",
            milestones: "string[]",
            recommendedRoutine: "string[]",
          },
        }),
      },
    ],
  });

  const parsed = safeParseJson<Partial<Omit<SkillTree, "id" | "createdAt" | "updatedAt">>>(completion.content);
  return normalizeSkillTree({ ...localSkillTree(input), ...parsed });
}

async function generateRoadmapWithLlm(
  input: RoadmapInput,
  recentRoadmaps: LearningRoadmap[],
): Promise<Omit<LearningRoadmap, "id" | "createdAt" | "updatedAt">> {
  const completion = await callChatCompletion({
    temperature: 0.35,
    maxTokens: 1300,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Return only valid JSON for a Learning Roadmap. Create an actionable learning path with projects, checkpoints, and a weekly practice loop. Do not include external links.",
      },
      {
        role: "user",
        content: JSON.stringify({
          input,
          recentRoadmaps: recentRoadmaps.slice(0, 3).map((roadmap) => ({
            topic: roadmap.topic,
            goal: roadmap.goal,
            phases: roadmap.phases.map((phase) => phase.title),
          })),
          outputSchema: {
            topic: "string",
            goal: "string",
            currentLevel: "string",
            timeline: "string",
            timePerWeek: "string",
            overview: "string",
            phases: [
              {
                title: "string",
                duration: "string",
                outcome: "string",
                lessons: "string[]",
                projects: "string[]",
                checkpoints: "string[]",
                resources: "string[]",
              },
            ],
            weeklyPlan: "string[]",
            practiceLoop: "string[]",
            pitfalls: "string[]",
            successMetrics: "string[]",
            nextActions: "string[]",
          },
        }),
      },
    ],
  });

  const parsed = safeParseJson<Partial<Omit<LearningRoadmap, "id" | "createdAt" | "updatedAt">>>(completion.content);
  return normalizeRoadmap({ ...localRoadmap(input), ...parsed });
}

async function callLearningTool(toolName: LearningToolName, payload: unknown): Promise<LearningToolResult> {
  try {
    return await callMcpTool<LearningToolResult>(toolName, payload, {
      timeoutMs: 5000,
      retries: 1,
    });
  } catch (error) {
    console.error("[learning] MCP fallback", {
      toolName,
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      source: "fallback",
      confidence: 0.3,
      summary: `Could not execute ${toolName}.`,
      skillTrees: [],
      roadmaps: [],
    };
  }
}

function localSkillTree(input: SkillTreeInput): Omit<SkillTree, "id" | "createdAt" | "updatedAt"> {
  return normalizeSkillTree({
    skillName: input.skillName,
    currentLevel: input.currentLevel,
    targetLevel: input.targetLevel,
    timeBudget: input.timeBudget,
    focusAreas: input.focusAreas,
    overview: `A practical path from ${input.currentLevel} to ${input.targetLevel} in ${input.skillName}.`,
    branches: [
      {
        name: "Foundations",
        description: "Core concepts and vocabulary.",
        nodes: [
          {
            title: `Map the basics of ${input.skillName}`,
            type: "concept",
            difficulty: "easy",
            whyItMatters: "You need a clear mental model before practicing deeply.",
            practice: "Write a one-page explanation in your own words.",
            proofOfSkill: "You can explain the basics without notes.",
            estimatedHours: 2,
          },
        ],
      },
      {
        name: "Deliberate practice",
        description: "Repeat small drills with feedback.",
        nodes: [
          {
            title: "Run a focused practice sprint",
            type: "practice",
            difficulty: "medium",
            whyItMatters: "Skill grows through feedback-rich repetitions.",
            practice: "Do three short sessions and record what improved.",
            proofOfSkill: "You can show before/after evidence.",
            estimatedHours: 4,
          },
        ],
      },
      {
        name: "Real-world proof",
        description: "Turn practice into visible output.",
        nodes: [
          {
            title: "Ship a small proof project",
            type: "project",
            difficulty: "medium",
            whyItMatters: "Projects reveal gaps that passive learning hides.",
            practice: "Create one small public or private deliverable.",
            proofOfSkill: "Someone else can review the output.",
            estimatedHours: 6,
          },
        ],
      },
    ],
    weeklyQuests: ["Complete one focused drill", "Ask for one piece of feedback", "Create one proof artifact"],
    milestones: ["Explain the basics", "Complete a feedback sprint", "Ship a small project"],
    recommendedRoutine: ["2 practice sessions", "1 review session", "1 small deliverable each week"],
  });
}

function localRoadmap(input: RoadmapInput): Omit<LearningRoadmap, "id" | "createdAt" | "updatedAt"> {
  return normalizeRoadmap({
    topic: input.topic,
    goal: input.goal,
    currentLevel: input.currentLevel,
    timeline: input.timeline,
    timePerWeek: input.timePerWeek,
    overview: `A project-first roadmap for ${input.topic}, designed around ${input.goal}.`,
    phases: [
      {
        title: "Orientation",
        duration: "Week 1",
        outcome: "Understand the map and key terms.",
        lessons: ["Core vocabulary", "Common mistakes", "What good looks like"],
        projects: ["Create a personal cheat sheet"],
        checkpoints: ["Explain the topic simply"],
        resources: ["Official docs", "Beginner-friendly examples"],
      },
      {
        title: "Build the basics",
        duration: "Weeks 2-3",
        outcome: "Use the fundamentals without constant guidance.",
        lessons: ["Fundamental patterns", "Hands-on drills", "Debugging your misunderstandings"],
        projects: ["Build a small practice project"],
        checkpoints: ["Complete the project without copying"],
        resources: ["Reference docs", "Worked examples"],
      },
      {
        title: "Applied project",
        duration: "Final weeks",
        outcome: "Produce a portfolio-quality proof of learning.",
        lessons: ["Project planning", "Quality checks", "Iteration"],
        projects: ["Ship one useful project"],
        checkpoints: ["Explain decisions and tradeoffs"],
        resources: ["Community examples", "Official guides"],
      },
    ],
    weeklyPlan: ["Learn one concept", "Practice twice", "Build one small artifact", "Review and adjust"],
    practiceLoop: ["Learn", "Apply", "Get feedback", "Fix", "Repeat"],
    pitfalls: ["Consuming too much without building", "Skipping fundamentals", "No feedback loop"],
    successMetrics: ["Can explain concepts", "Can build without copying", "Can spot and fix mistakes"],
    nextActions: ["Choose a first mini-project", "Schedule practice blocks", "Define a proof of completion"],
  });
}

function normalizeSkillTree(
  tree: Omit<SkillTree, "id" | "createdAt" | "updatedAt">,
): Omit<SkillTree, "id" | "createdAt" | "updatedAt"> {
  return {
    skillName: stringOr(tree.skillName, "Untitled skill"),
    currentLevel: stringOr(tree.currentLevel, "beginner"),
    targetLevel: stringOr(tree.targetLevel, "confident"),
    timeBudget: stringOr(tree.timeBudget, "3 hours/week"),
    focusAreas: listOr(tree.focusAreas),
    overview: stringOr(tree.overview, ""),
    branches: Array.isArray(tree.branches) ? tree.branches.slice(0, 6).map(normalizeBranch) : [],
    weeklyQuests: listOr(tree.weeklyQuests),
    milestones: listOr(tree.milestones),
    recommendedRoutine: listOr(tree.recommendedRoutine),
  };
}

function normalizeBranch(branch: SkillTreeBranch): SkillTreeBranch {
  return {
    name: stringOr(branch.name, "Skill branch"),
    description: stringOr(branch.description, ""),
    nodes: Array.isArray(branch.nodes) ? branch.nodes.slice(0, 8).map(normalizeNode) : [],
  };
}

function normalizeNode(node: SkillTreeNode): SkillTreeNode {
  return {
    title: stringOr(node.title, "Practice node"),
    type: ["concept", "practice", "project", "checkpoint"].includes(node.type) ? node.type : "practice",
    difficulty: ["easy", "medium", "hard"].includes(node.difficulty) ? node.difficulty : "medium",
    whyItMatters: stringOr(node.whyItMatters, ""),
    practice: stringOr(node.practice, ""),
    proofOfSkill: stringOr(node.proofOfSkill, ""),
    estimatedHours: numberOr(node.estimatedHours, 1),
  };
}

function normalizeRoadmap(
  roadmap: Omit<LearningRoadmap, "id" | "createdAt" | "updatedAt">,
): Omit<LearningRoadmap, "id" | "createdAt" | "updatedAt"> {
  return {
    topic: stringOr(roadmap.topic, "Untitled topic"),
    goal: stringOr(roadmap.goal, "learn the fundamentals"),
    currentLevel: stringOr(roadmap.currentLevel, "beginner"),
    timeline: stringOr(roadmap.timeline, "8 weeks"),
    timePerWeek: stringOr(roadmap.timePerWeek, "3 hours/week"),
    overview: stringOr(roadmap.overview, ""),
    phases: Array.isArray(roadmap.phases) ? roadmap.phases.slice(0, 8).map(normalizePhase) : [],
    weeklyPlan: listOr(roadmap.weeklyPlan),
    practiceLoop: listOr(roadmap.practiceLoop),
    pitfalls: listOr(roadmap.pitfalls),
    successMetrics: listOr(roadmap.successMetrics),
    nextActions: listOr(roadmap.nextActions),
  };
}

function normalizePhase(phase: LearningRoadmapPhase): LearningRoadmapPhase {
  return {
    title: stringOr(phase.title, "Learning phase"),
    duration: stringOr(phase.duration, ""),
    outcome: stringOr(phase.outcome, ""),
    lessons: listOr(phase.lessons),
    projects: listOr(phase.projects),
    checkpoints: listOr(phase.checkpoints),
    resources: listOr(phase.resources),
  };
}

function withSkillTreeMetadata(tree: Omit<SkillTree, "id" | "createdAt" | "updatedAt">): SkillTree {
  const now = new Date().toISOString();
  return { ...tree, id: `local-skill-${Date.now()}`, createdAt: now, updatedAt: now };
}

function withRoadmapMetadata(roadmap: Omit<LearningRoadmap, "id" | "createdAt" | "updatedAt">): LearningRoadmap {
  const now = new Date().toISOString();
  return { ...roadmap, id: `local-roadmap-${Date.now()}`, createdAt: now, updatedAt: now };
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.replace(/\s+/g, " ").trim() : fallback;
}

function listOr(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 10)
    : [];
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
}
