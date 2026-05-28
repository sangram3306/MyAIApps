import { Router } from "express";
import { ZodError } from "zod";
import { callMcpTool } from "../mcp/mcpClient";
import { creatorRepurposeSchema } from "../schemas/creatorSchemas";
import { generateCreatorRepurpose } from "../services/nvidiaService";

const router = Router();

type Source = "static" | "llm" | "fallback";

type CreatorDraftRecord = {
  id: string;
  sourceText: string;
  sourceType: string;
  audience: string;
  goal: string;
  tone: string;
  platformOutputs: Record<string, unknown>;
  title: string;
  summary: string;
  hook: string;
  createdAt: string;
  updatedAt: string;
};

type CreatorDraftMcpResult = {
  source: Source;
  confidence: number;
  summary: string;
  draft?: CreatorDraftRecord;
  drafts?: CreatorDraftRecord[];
};

router.post("/repurpose", handleRepurposeRequest);
router.get("/drafts", handleDraftsRequest);
router.post("/drafts/update", handleUpdateDraftRequest);

export async function handleRepurposeRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = creatorRepurposeSchema.parse(req.body);
    const repurpose = await generateCreatorRepurpose(input);
    const now = new Date().toISOString();

    let savedDraft: CreatorDraftRecord | null = null;
    try {
      const result = await callMcpTool<CreatorDraftMcpResult>(
        "createContentDraft",
        {
          ...input,
          title: repurpose.title,
          summary: repurpose.summary,
          hook: repurpose.hook,
          platformOutputs: repurpose.platformOutputs,
          repurposeTips: repurpose.repurposeTips,
          createdAt: now,
          updatedAt: now,
        },
        {
          timeoutMs: 5000,
          retries: 1,
        },
      );
      savedDraft = result.draft || null;
    } catch {
      savedDraft = null;
    }

    return res.json({
      assistantReply: repurpose.summary,
      repurpose,
      savedDraft,
      saved: Boolean(savedDraft),
      agentTrace: ["Generated creator drafts", savedDraft ? "Saved draft to DB" : "Skipped DB save"],
      metadata: {
        toolsUsed: savedDraft ? ["createContentDraft"] : [],
        toolSources: {
          contentGeneration: "llm",
          draftStorage: savedDraft ? "static" : "fallback",
        },
      },
    });
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
        ? "The selected AI provider could not repurpose content right now."
        : "Could not repurpose content right now.",
    });
  }
}

export async function handleDraftsRequest(
  _req: { body?: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const result = await callMcpTool<CreatorDraftMcpResult>(
      "listContentDrafts",
      {
        limit: 20,
      },
      {
        timeoutMs: 5000,
        retries: 1,
      },
    );

    return res.json({
      drafts: result.drafts || [],
      count: result.drafts?.length || 0,
    });
  } catch {
    return res.json({
      drafts: [],
      count: 0,
    });
  }
}

export async function handleUpdateDraftRequest(
  req: { body?: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const payload = req.body as Partial<CreatorDraftRecord> | undefined;
    if (!payload || typeof payload.id !== "string" || !payload.id.trim()) {
      return res.status(400).json({ error: "Draft id is required." });
    }

    const result = await callMcpTool<CreatorDraftMcpResult>(
      "updateContentDraft",
      {
        id: payload.id,
        ...(typeof payload.title === "string" ? { title: payload.title.trim() } : {}),
        ...(typeof payload.summary === "string" ? { summary: payload.summary.trim() } : {}),
        ...(typeof payload.hook === "string" ? { hook: payload.hook.trim() } : {}),
        ...(payload.platformOutputs && typeof payload.platformOutputs === "object"
          ? { platformOutputs: payload.platformOutputs }
          : {}),
        updatedAt: new Date().toISOString(),
      },
      {
        timeoutMs: 5000,
        retries: 1,
      },
    );

    return res.json({
      updated: Boolean(result.draft),
      draft: result.draft || null,
      summary: result.summary,
    });
  } catch {
    return res.status(500).json({
      error: "Could not update this draft right now.",
    });
  }
}

export default router;
