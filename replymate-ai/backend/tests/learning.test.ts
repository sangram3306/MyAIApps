import assert from "node:assert/strict";
import test from "node:test";
import { handleRoadmapRequest, handleSkillTreeRequest } from "../src/routes/learningRoutes";

test("POST /api/learning routes generate and save learning artifacts", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const originalNvidiaApiKey = process.env.NVIDIA_API_KEY;
  const originalNvidiaModel = process.env.NVIDIA_MODEL;
  const originalNvidiaBaseUrl = process.env.NVIDIA_BASE_URL;

  process.env.MCP_SERVER_URL = "http://mock-mcp";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.includes("/tools/listSkillTrees")) {
      return jsonResponse({
        source: "static",
        confidence: 0.98,
        summary: "Loaded skill trees.",
        skillTrees: [],
        count: 0,
      });
    }

    if (url.includes("/tools/saveSkillTree")) {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      return jsonResponse({
        source: "static",
        confidence: 0.97,
        summary: "Saved skill tree.",
        skillTree: withMetadata(payload, "skill-1"),
        skillTrees: [withMetadata(payload, "skill-1")],
        count: 1,
      });
    }

    if (url.includes("/tools/listLearningRoadmaps")) {
      return jsonResponse({
        source: "static",
        confidence: 0.98,
        summary: "Loaded roadmaps.",
        roadmaps: [],
        count: 0,
      });
    }

    if (url.includes("/tools/saveLearningRoadmap")) {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      return jsonResponse({
        source: "static",
        confidence: 0.97,
        summary: "Saved roadmap.",
        roadmap: withMetadata(payload, "roadmap-1"),
        roadmaps: [withMetadata(payload, "roadmap-1")],
        count: 1,
      });
    }

    if (url.includes("/chat/completions")) {
      const body = JSON.parse(String(init?.body || "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const prompt = body.messages?.map((message) => message.content || "").join(" ") || "";
      if (prompt.includes("Personal Skill Tree")) {
        return jsonResponse({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  skillName: "Public speaking",
                  currentLevel: "beginner",
                  targetLevel: "confident",
                  timeBudget: "3 hours/week",
                  focusAreas: ["delivery"],
                  overview: "Build confidence through feedback-rich speaking reps.",
                  branches: [
                    {
                      name: "Delivery",
                      description: "Voice and posture.",
                      nodes: [
                        {
                          title: "Record a two-minute talk",
                          type: "practice",
                          difficulty: "easy",
                          whyItMatters: "It creates awareness.",
                          practice: "Record and review.",
                          proofOfSkill: "One reviewed clip.",
                          estimatedHours: 1,
                        },
                      ],
                    },
                  ],
                  weeklyQuests: ["Give one short talk"],
                  milestones: ["Deliver five minutes"],
                  recommendedRoutine: ["Practice twice weekly"],
                }),
              },
            },
          ],
        });
      }

      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                topic: "Backend development",
                goal: "Build APIs confidently",
                currentLevel: "beginner",
                timeline: "8 weeks",
                timePerWeek: "5 hours/week",
                overview: "Learn by shipping small API projects.",
                phases: [
                  {
                    title: "API basics",
                    duration: "2 weeks",
                    outcome: "Build a simple REST API.",
                    lessons: ["HTTP", "Routing"],
                    projects: ["Todo API"],
                    checkpoints: ["CRUD works"],
                    resources: ["Official docs"],
                  },
                ],
                weeklyPlan: ["Build one endpoint"],
                practiceLoop: ["Learn", "Build", "Test"],
                pitfalls: ["Only watching tutorials"],
                successMetrics: ["Can explain request flow"],
                nextActions: ["Create a repo"],
              }),
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const skillResponse = await invokeSkillTree({
      skillName: "Public speaking",
      currentLevel: "beginner",
      targetLevel: "confident",
      timeBudget: "3 hours/week",
    });
    const skillData = skillResponse.body as Record<string, unknown>;
    assert.equal(skillResponse.statusCode, 200);
    assert.equal((skillData.skillTree as Record<string, unknown>).skillName, "Public speaking");
    assert.equal(skillData.saved, true);

    const roadmapResponse = await invokeRoadmap({
      topic: "Backend development",
      goal: "Build APIs confidently",
      currentLevel: "beginner",
      timeline: "8 weeks",
      timePerWeek: "5 hours/week",
    });
    const roadmapData = roadmapResponse.body as Record<string, unknown>;
    assert.equal(roadmapResponse.statusCode, 200);
    assert.equal((roadmapData.roadmap as Record<string, unknown>).topic, "Backend development");
    assert.equal(roadmapData.saved, true);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
    restoreEnv("NVIDIA_API_KEY", originalNvidiaApiKey);
    restoreEnv("NVIDIA_MODEL", originalNvidiaModel);
    restoreEnv("NVIDIA_BASE_URL", originalNvidiaBaseUrl);
  }
});

async function invokeSkillTree(body: unknown): Promise<{ statusCode: number; body: unknown }> {
  let statusCode = 200;
  let responseBody: unknown = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      responseBody = payload;
    },
  };

  await handleSkillTreeRequest({ body }, res);
  return { statusCode, body: responseBody };
}

async function invokeRoadmap(body: unknown): Promise<{ statusCode: number; body: unknown }> {
  let statusCode = 200;
  let responseBody: unknown = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      responseBody = payload;
    },
  };

  await handleRoadmapRequest({ body }, res);
  return { statusCode, body: responseBody };
}

function withMetadata(payload: Record<string, unknown>, id: string): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id,
    ...payload,
    createdAt: now,
    updatedAt: now,
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
