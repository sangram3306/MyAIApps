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
  | "updateWatchEntry"
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
  posterUrl?: string;
  ratings: Array<{ source: string; value: string }>;
  availability: Array<{ provider: string; region: string; type: "stream" | "rent" | "buy" | "free" | "ads"; link?: string }>;
  externalDetails: Array<{ label: string; value: string }>;
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

export type WatcherProfileResponse = {
  source: Source;
  profile: {
    archetype: string;
    summary: string;
    traits: string[];
    patterns: string[];
    suggestions: string[];
  };
  count: number;
};

export async function logWatchItem(input: {
  title: string;
  type?: WatchType;
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

export async function buildWatcherProfile(): Promise<WatcherProfileResponse> {
  const result = await callWatchTool("listWatchEntries", { limit: 100 });
  const entries = result.entries || [];
  if (!entries.length) {
    return {
      source: "fallback",
      count: 0,
      profile: {
        archetype: "Fresh Watcher",
        summary: "Your watchlist is just getting started.",
        traits: ["Exploratory", "Open-ended"],
        patterns: ["No saved titles yet"],
        suggestions: ["Add a few movies or series to unlock a more personal profile"],
      },
    };
  }

  if (hasConfiguredLlmApiKey()) {
    const profile = await buildWatcherProfileWithLlm(entries).catch(() => localWatcherProfile(entries));
    return {
      source: profile.source,
      count: entries.length,
      profile: profile.profile,
    };
  }

  const profile = localWatcherProfile(entries);
  return {
    source: profile.source,
    count: entries.length,
    profile: profile.profile,
  };
}

async function buildWatcherProfileWithLlm(entries: WatchEntry[]): Promise<Omit<WatcherProfileResponse, "count">> {
  const completion = await callChatCompletion({
    temperature: 0.45,
    maxTokens: 650,
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Return only JSON. Create a fun but practical watcher profile from a user's movie/series watchlist. Avoid spoilers. Keep it concise.",
      },
      {
        role: "user",
        content: JSON.stringify({
          watchlist: entries.slice(0, 80).map((entry) => ({
            title: entry.title,
            type: entry.type,
            status: entry.status,
            releaseYear: entry.releaseYear,
            director: entry.director,
            leadActors: entry.leadActors,
            imdb: entry.ratings.find((rating) => rating.source.toLowerCase().includes("internet movie database") || rating.source.toLowerCase() === "imdb")?.value,
          })),
          outputSchema: {
            archetype: "string",
            summary: "string",
            traits: ["string"],
            patterns: ["string"],
            suggestions: ["string"],
          },
        }),
      },
    ],
  });

  const parsed = safeParseJson<Record<string, unknown>>(completion.content);
  if (!parsed) {
    throw new Error("Could not parse watcher profile.");
  }

  return {
    source: "llm",
    profile: normalizeWatcherProfile(parsed),
  };
}

function localWatcherProfile(entries: WatchEntry[]): Omit<WatcherProfileResponse, "count"> {
  const movies = entries.filter((entry) => entry.type === "movie").length;
  const series = entries.filter((entry) => entry.type === "series").length;
  const completed = entries.filter((entry) => entry.status === "completed").length;
  const planned = entries.filter((entry) => entry.status === "planned").length;
  const olderTitles = entries.filter((entry) => Number(entry.releaseYear.slice(0, 4)) < 2010).length;
  const archetype = series > movies
    ? "Serial Story Explorer"
    : olderTitles >= Math.ceil(entries.length / 2)
      ? "Modern Classic Curator"
      : "Blockbuster Pathfinder";

  return {
    source: "fallback",
    profile: {
      archetype,
      summary: `You lean toward ${movies >= series ? "movies" : "series"}, with ${planned} planned and ${completed} completed titles.`,
      traits: [
        movies >= series ? "Movie-first" : "Series-first",
        olderTitles ? "Comfortable with classics" : "Current-release curious",
        planned > completed ? "Watchlist builder" : "Completion-minded",
      ],
      patterns: [
        `${movies} movies and ${series} series saved`,
        `${completed} completed, ${planned} planned`,
      ],
      suggestions: [
        "Mark more titles completed to improve your profile",
        "Add notes after watching to make recommendations sharper",
      ],
    },
  };
}

function normalizeWatcherProfile(payload: Record<string, unknown>): WatcherProfileResponse["profile"] {
  return {
    archetype: typeof payload.archetype === "string" && payload.archetype.trim() ? payload.archetype.trim() : "Curious Watcher",
    summary: typeof payload.summary === "string" && payload.summary.trim() ? payload.summary.trim() : "Your watchlist shows a developing taste profile.",
    traits: stringList(payload.traits, 5),
    patterns: stringList(payload.patterns, 5),
    suggestions: stringList(payload.suggestions, 5),
  };
}

function stringList(value: unknown, limit: number): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()).slice(0, limit)
    : [];
}

export async function updateWatchStatus(input: { id: string; status: WatchStatus }): Promise<WatchListResponse> {
  const result = await callWatchTool("updateWatchEntryStatus", input);
  return {
    entries: result.entries || [],
    source: result.source,
  };
}

export async function updateWatchDetails(input: {
  id: string;
  title?: string;
  type?: WatchType;
  status?: WatchStatus;
  releaseYear?: string;
  director?: string;
  leadActors?: string[];
  budget?: string;
  boxOffice?: string;
  posterUrl?: string;
  ratings?: Array<{ source: string; value: string }>;
  availability?: Array<{ provider: string; region: string; type: "stream" | "rent" | "buy" | "free" | "ads"; link?: string }>;
  externalDetails?: Array<{ label: string; value: string }>;
  synopsis?: string;
  notes?: string;
}): Promise<{ entry?: WatchEntry; entries: WatchEntry[]; source: Source }> {
  const result = await callWatchTool("updateWatchEntry", input);
  return {
    entry: result.entry,
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
  type?: WatchType;
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
            posterUrl: "string",
            ratings: [{ source: "IMDb|Rotten Tomatoes|Metacritic|Other", value: "string" }],
            availability: [{ provider: "string", region: "string", type: "stream|rent|buy|free|ads", link: "string" }],
            externalDetails: [{ label: "string", value: "string" }],
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
  type?: WatchType;
  notes: string;
}): {
  source: Source;
  data: Omit<WatchEntry, "id" | "createdAt" | "updatedAt" | "status"> & { status?: WatchStatus };
} {
  return {
    source: "fallback",
    data: {
      title: input.title,
      type: input.type || "movie",
      releaseYear: "Unknown",
      director: "Unknown",
      leadActors: [],
      budget: "Unknown",
      boxOffice: "Unknown",
      posterUrl: undefined,
      ratings: [],
      availability: [],
      externalDetails: [],
      synopsis: "",
      notes: input.notes || "",
    },
  };
}

function normalizeEnrichment(
  payload: Record<string, unknown>,
  input: { title: string; type?: WatchType; notes: string },
): Omit<WatchEntry, "id" | "createdAt" | "updatedAt" | "status"> {
  return {
    title: typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : input.title,
    type: payload.type === "series" ? "series" : input.type || "movie",
    releaseYear: typeof payload.releaseYear === "string" && payload.releaseYear.trim() ? payload.releaseYear.trim() : "Unknown",
    director: typeof payload.director === "string" && payload.director.trim() ? payload.director.trim() : "Unknown",
    leadActors: Array.isArray(payload.leadActors)
      ? payload.leadActors.filter((x): x is string => typeof x === "string" && Boolean(x.trim())).slice(0, 8)
      : [],
    budget: typeof payload.budget === "string" && payload.budget.trim() ? payload.budget.trim() : "Unknown",
    boxOffice: typeof payload.boxOffice === "string" && payload.boxOffice.trim() ? payload.boxOffice.trim() : "Unknown",
    posterUrl: posterUrlOrUndefined(payload.posterUrl),
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
    availability: Array.isArray(payload.availability)
      ? payload.availability
          .filter((item): item is { provider: string; region: string; type?: string; link?: string } =>
            Boolean(item && typeof item === "object" && typeof (item as { provider?: unknown }).provider === "string"),
          )
          .map((item) => ({
            provider: item.provider.trim(),
            region: typeof item.region === "string" ? item.region.trim().toUpperCase() : "Unknown",
            type: normalizeAvailabilityType(item.type),
            link: typeof item.link === "string" && item.link.trim() ? item.link.trim() : undefined,
          }))
          .slice(0, 40)
      : [],
    externalDetails: Array.isArray(payload.externalDetails)
      ? payload.externalDetails
          .filter((item): item is { label: string; value: string } =>
            Boolean(
              item
                && typeof item === "object"
                && typeof (item as { label?: unknown }).label === "string"
                && typeof (item as { value?: unknown }).value === "string",
            ),
          )
          .map((item) => ({
            label: item.label.trim(),
            value: item.value.trim(),
          }))
          .filter((item) => item.label && item.value)
          .slice(0, 30)
      : [],
    synopsis: typeof payload.synopsis === "string" ? payload.synopsis.trim() : "",
    notes: input.notes || (typeof payload.notes === "string" ? payload.notes.trim() : ""),
  };
}

function posterUrlOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized && normalized !== "N/A" ? normalized : undefined;
}

function normalizeAvailabilityType(value: string | undefined): "stream" | "rent" | "buy" | "free" | "ads" {
  if (value === "stream" || value === "rent" || value === "buy" || value === "free" || value === "ads") {
    return value;
  }
  return "stream";
}

async function callWatchTool(toolName: WatchToolName, payload: unknown): Promise<WatchToolResult> {
  return callMcpTool<WatchToolResult>(toolName, payload, { timeoutMs: 8000, retries: 1 });
}
