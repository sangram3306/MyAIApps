import { callMcpTool } from "../mcp/mcpClient";
import { callChatCompletion, hasConfiguredLlmApiKey } from "../services/llmService";
import { safeParseJson } from "../utils/safeJson";

type Source = "static" | "llm" | "fallback";
type WatchType = "movie" | "series";
type WatchStatus = "planned" | "started" | "in_progress" | "completed" | "dropped";
type WatchToolName =
  | "saveWatchEntry"
  | "listWatchEntries"
  | "updateWatchEntryStatus"
  | "deleteWatchEntry"
  | "fetchWatchMetadata";

export type WatchEntry = {
  id: string;
  title: string;
  type: WatchType;
  status: WatchStatus;
  releaseYear: string;
  director: string;
  leadActors: string[];
  budget: string;
  boxOffice: string;
  ratings: Array<{ source: string; value: string }>;
  synopsis: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type WatchToolResult = {
  source: Source;
  confidence: number;
  summary: string;
  entry?: WatchEntry;
  entries?: WatchEntry[];
  count?: number;
  deletedCount?: number;
  id?: string;
  metadata?: Omit<WatchEntry, "id" | "createdAt" | "updatedAt" | "status" | "notes">;
};

type ToolCallSummary = {
  name: string;
  source: Source;
  summary: string;
};

export type WatchLogResponse = {
  assistantReply: string;
  entry: WatchEntry;
  entries: WatchEntry[];
  toolCalls: ToolCallSummary[];
  agentTrace: string[];
  metadata: {
    toolSources: {
      enrichment: Source;
      storage: Source;
    };
  };
};

export type WatchListResponse = {
  entries: WatchEntry[];
  source: Source;
};

export async function logWatchItem(input: {
  title: string;
  type: WatchType;
  status: WatchStatus;
  notes: string;
}): Promise<WatchLogResponse> {
  const trace = ["Received watch tracker request"];
  const toolCalls: ToolCallSummary[] = [];

  const live = await callWatchTool("fetchWatchMetadata", {
    title: input.title,
    type: input.type,
  }).catch(() => null);
  const liveEnrichment = live?.metadata
    ? { source: live.source as Source, data: { ...live.metadata, notes: input.notes || "" } }
    : null;

  const enrichment = liveEnrichment
    || (hasConfiguredLlmApiKey()
      ? await enrichWithLlm(input).catch(() => fallbackEnrichment(input))
      : fallbackEnrichment(input));
  trace.push(
    liveEnrichment
      ? "Fetched live web metadata"
      : enrichment.source === "llm"
        ? "Generated AI metadata"
        : "Used fallback metadata",
  );

  const saved = await callWatchTool("saveWatchEntry", {
    ...enrichment.data,
    status: input.status,
    notes: input.notes || enrichment.data.notes,
  });
  toolCalls.push({ name: "saveWatchEntry", source: saved.source, summary: saved.summary });
  trace.push(saved.entry ? "Saved watch entry" : "Could not save watch entry");

  const entry = saved.entry || {
    ...enrichment.data,
    status: input.status,
    notes: input.notes || enrichment.data.notes,
    id: `local-watch-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    assistantReply: `${entry.title} added to your watch tracker with status "${entry.status.replace("_", " ")}".`,
    entry,
    entries: saved.entries || [],
    toolCalls,
    agentTrace: [...trace, "Returned watch tracker response"],
    metadata: {
      toolSources: {
        enrichment: enrichment.source,
        storage: saved.source,
      },
    },
  };
}

export async function listWatchItems(): Promise<WatchListResponse> {
  const result = await callWatchTool("listWatchEntries", { limit: 50 });
  return {
    entries: result.entries || [],
    source: result.source,
  };
}

export async function updateWatchStatus(input: { id: string; status: WatchStatus }): Promise<WatchListResponse> {
  const result = await callWatchTool("updateWatchEntryStatus", input);
  return {
    entries: result.entries || [],
    source: result.source,
  };
}

export async function removeWatchItem(id: string): Promise<{ deleted: boolean; entries: WatchEntry[]; source: Source }> {
  const result = await callWatchTool("deleteWatchEntry", { id });
  return {
    deleted: (result.deletedCount || 0) > 0,
    entries: result.entries || [],
    source: result.source,
  };
}

async function enrichWithLlm(input: {
  title: string;
  type: WatchType;
  notes: string;
}): Promise<{
  source: Source;
  data: Omit<WatchEntry, "id" | "createdAt" | "updatedAt" | "status"> & { status?: WatchStatus };
}> {
  const completion = await callChatCompletion({
    temperature: 0.2,
    maxTokens: 700,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Return only JSON. If uncertain, use 'Unknown'. Do not fabricate precise financial numbers unless you are confident. Keep synopsis under 35 words.",
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Enrich movie or series metadata from model knowledge.",
          input,
          outputSchema: {
            title: "string",
            type: "movie|series",
            releaseYear: "string",
            director: "string",
            leadActors: ["string"],
            budget: "string",
            boxOffice: "string",
            ratings: [{ source: "IMDb|Rotten Tomatoes|Metacritic|Other", value: "string" }],
            synopsis: "string",
            notes: "string",
          },
        }),
      },
    ],
  });

  const parsed = safeParseJson<Record<string, unknown>>(completion.content);
  if (!parsed) {
    throw new Error("Could not parse enrichment payload.");
  }

  return {
    source: "llm",
    data: normalizeEnrichment(parsed, input),
  };
}

function fallbackEnrichment(input: {
  title: string;
  type: WatchType;
  notes: string;
}): {
  source: Source;
  data: Omit<WatchEntry, "id" | "createdAt" | "updatedAt" | "status"> & { status?: WatchStatus };
} {
  return {
    source: "fallback",
    data: {
      title: input.title,
      type: input.type,
      releaseYear: "Unknown",
      director: "Unknown",
      leadActors: [],
      budget: "Unknown",
      boxOffice: "Unknown",
      ratings: [],
      synopsis: "",
      notes: input.notes || "",
    },
  };
}

function normalizeEnrichment(
  payload: Record<string, unknown>,
  input: { title: string; type: WatchType; notes: string },
): Omit<WatchEntry, "id" | "createdAt" | "updatedAt" | "status"> {
  return {
    title: typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : input.title,
    type: payload.type === "series" ? "series" : input.type,
    releaseYear: typeof payload.releaseYear === "string" && payload.releaseYear.trim() ? payload.releaseYear.trim() : "Unknown",
    director: typeof payload.director === "string" && payload.director.trim() ? payload.director.trim() : "Unknown",
    leadActors: Array.isArray(payload.leadActors)
      ? payload.leadActors.filter((x): x is string => typeof x === "string" && Boolean(x.trim())).slice(0, 8)
      : [],
    budget: typeof payload.budget === "string" && payload.budget.trim() ? payload.budget.trim() : "Unknown",
    boxOffice: typeof payload.boxOffice === "string" && payload.boxOffice.trim() ? payload.boxOffice.trim() : "Unknown",
    ratings: Array.isArray(payload.ratings)
      ? payload.ratings
          .filter((item): item is { source: string; value: string } =>
            Boolean(item && typeof item === "object" && typeof (item as { source?: unknown }).source === "string"),
          )
          .map((item) => ({
            source: item.source.trim(),
            value: typeof item.value === "string" && item.value.trim() ? item.value.trim() : "Unknown",
          }))
          .slice(0, 6)
      : [],
    synopsis: typeof payload.synopsis === "string" ? payload.synopsis.trim() : "",
    notes: input.notes || (typeof payload.notes === "string" ? payload.notes.trim() : ""),
  };
}

async function callWatchTool(toolName: WatchToolName, payload: unknown): Promise<WatchToolResult> {
  return callMcpTool<WatchToolResult>(toolName, payload, { timeoutMs: 8000, retries: 1 });
}
