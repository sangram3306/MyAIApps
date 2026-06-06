import assert from "node:assert/strict";
import test from "node:test";
import { handleDraftsRequest, handleRepurposeRequest, handleUpdateDraftRequest } from "../src/routes/creatorRoutes";

test("POST /api/creator/repurpose generates and saves drafts", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const originalNvidiaApiKey = process.env.NVIDIA_API_KEY;
  const originalNvidiaModel = process.env.NVIDIA_MODEL;
  const originalNvidiaBaseUrl = process.env.NVIDIA_BASE_URL;
  const drafts: Array<Record<string, unknown>> = [];

  process.env.MCP_SERVER_URL = "http://mock-mcp";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/chat/completions")) {
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "Launch copy pack",
                summary: "Ready-to-publish content for the main platforms.",
                hook: "Make the launch feel practical and useful.",
                platformOutputs: {
                  x: {
                    post: "X post draft",
                    thread: ["X thread 1", "X thread 2"],
                    hashtags: ["#launch"],
                  },
                  linkedin: {
                    post: "LinkedIn post draft",
                    headline: "Launch headline",
                  },
                },
                repurposeTips: ["Lead with the benefit", "Keep it short"],
              }),
            },
          },
        ],
      });
    }

    if (url.includes("/tools/createContentDraft")) {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      const now = new Date().toISOString();
      const draft = {
        id: `draft-${drafts.length + 1}`,
        sourceText: String(payload.sourceText || ""),
        sourceType: String(payload.sourceType || "note"),
        audience: String(payload.audience || "general"),
        goal: String(payload.goal || "repurpose"),
        tone: String(payload.tone || "balanced"),
        platformOutputs: payload.platformOutputs || {},
        title: String(payload.title || "Draft"),
        summary: String(payload.summary || ""),
        hook: String(payload.hook || ""),
        createdAt: now,
        updatedAt: now,
      };
      drafts.unshift(draft);
      return jsonResponse({
        source: "static",
        confidence: 0.99,
        summary: "Saved creator draft.",
        draft,
      });
    }

    if (url.includes("/tools/listContentDrafts")) {
      return jsonResponse({
        source: "static",
        confidence: 0.95,
        summary: "Loaded drafts.",
        drafts,
      });
    }
    if (url.includes("/tools/updateContentDraft")) {
      const payload = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      const id = String(payload.id || "");
      const found = drafts.find((item) => item.id === id);
      if (found) {
        found.title = String(payload.title || found.title);
        found.summary = String(payload.summary || found.summary);
        found.hook = String(payload.hook || found.hook);
      }
      return jsonResponse({
        source: "static",
        confidence: 0.95,
        summary: "Updated draft.",
        draft: found,
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const response = await invokeRepurpose({
      sourceText: "We are launching a new productivity app.",
      sourceType: "idea",
      audience: "founders",
      goal: "launch",
      tone: "professional",
      platforms: ["x", "linkedin"],
    });
    const data = response.body as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.match(String(data.assistantReply), /Ready-to-publish content/i);
    assert.equal((data.saved as boolean), true);
    assert.equal((data.savedDraft as Record<string, unknown>).title, "Launch copy pack");

    const listResponse = await invokeDrafts();
    const listData = listResponse.body as Record<string, unknown>;
    assert.equal(listResponse.statusCode, 200);
    assert.equal((listData.drafts as Array<unknown>).length, 1);

    const updateResponse = await invokeUpdateDraft({
      id: "draft-1",
      title: "Updated launch pack",
      summary: "Updated summary",
      hook: "Updated hook",
    });
    const updateData = updateResponse.body as Record<string, unknown>;
    assert.equal(updateResponse.statusCode, 200);
    assert.equal(updateData.updated, true);
    assert.equal((updateData.draft as Record<string, unknown>).title, "Updated launch pack");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
    restoreEnv("NVIDIA_API_KEY", originalNvidiaApiKey);
    restoreEnv("NVIDIA_MODEL", originalNvidiaModel);
    restoreEnv("NVIDIA_BASE_URL", originalNvidiaBaseUrl);
  }
});

test("POST /api/creator/repurpose normalizes provider-specific platform keys", async () => {
  const originalFetch = globalThis.fetch;
  const originalMcpServerUrl = process.env.MCP_SERVER_URL;
  const originalNvidiaApiKey = process.env.NVIDIA_API_KEY;
  const originalNvidiaModel = process.env.NVIDIA_MODEL;
  const originalNvidiaBaseUrl = process.env.NVIDIA_BASE_URL;

  process.env.MCP_SERVER_URL = "";
  process.env.NVIDIA_API_KEY = "test-key";
  process.env.NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
  process.env.NVIDIA_BASE_URL = "http://mock-nvidia";

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/chat/completions")) {
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "Variant copy pack",
                summary: "Normalized provider-specific platform keys.",
                hook: "One idea, many channels.",
                platforms: {
                  twitter: {
                    tweet: "Twitter/X post draft",
                    posts: [{ text: "Thread part 1" }, { text: "Thread part 2" }],
                    hashtags: ["#buildinpublic"],
                  },
                  ig: {
                    post: "Instagram caption draft",
                    hashtags: ["#creator"],
                  },
                },
                tips: ["Use concrete examples"],
              }),
            },
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const response = await invokeRepurpose({
      sourceText: "We are launching a new productivity app.",
      sourceType: "idea",
      audience: "founders",
      goal: "launch",
      tone: "professional",
      platforms: ["x", "instagram"],
    });
    const data = response.body as Record<string, unknown>;
    const repurpose = data.repurpose as Record<string, unknown>;
    const platformOutputs = repurpose.platformOutputs as Record<string, unknown>;

    assert.equal(response.statusCode, 200);
    assert.equal((platformOutputs.x as Record<string, unknown>).post, "Twitter/X post draft");
    assert.equal((platformOutputs.instagram as Record<string, unknown>).caption, "Instagram caption draft");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("MCP_SERVER_URL", originalMcpServerUrl);
    restoreEnv("NVIDIA_API_KEY", originalNvidiaApiKey);
    restoreEnv("NVIDIA_MODEL", originalNvidiaModel);
    restoreEnv("NVIDIA_BASE_URL", originalNvidiaBaseUrl);
  }
});

async function invokeRepurpose(body: unknown): Promise<{ statusCode: number; body: unknown }> {
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

  await handleRepurposeRequest({ body }, res);
  return { statusCode, body: responseBody };
}

async function invokeUpdateDraft(body: unknown): Promise<{ statusCode: number; body: unknown }> {
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

  await handleUpdateDraftRequest({ body }, res);
  return { statusCode, body: responseBody };
}

async function invokeDrafts(): Promise<{ statusCode: number; body: unknown }> {
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

  await handleDraftsRequest({}, res);
  return { statusCode, body: responseBody };
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
