import { z } from "zod";
import {
  createWatchEntry,
  deleteWatchEntry,
  listWatchEntries,
  updateWatchEntryStatus,
  WatchEntry,
  WatchStatus,
} from "../services/watchStore.js";

const sourceSchema = z.enum(["static", "llm", "fallback"]);

const watchRatingSchema = z.object({
  source: z.string().min(1),
  value: z.string().default("Unknown"),
});

const saveWatchInputSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["movie", "series"]).default("movie"),
  status: z.enum(["planned", "started", "in_progress", "completed", "dropped"]).default("planned"),
  releaseYear: z.string().default("Unknown"),
  director: z.string().default("Unknown"),
  leadActors: z.array(z.string()).default([]),
  budget: z.string().default("Unknown"),
  boxOffice: z.string().default("Unknown"),
  ratings: z.array(watchRatingSchema).default([]),
  synopsis: z.string().default(""),
  notes: z.string().default(""),
});

const listWatchInputSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(30),
}).passthrough();

const updateWatchStatusInputSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["planned", "started", "in_progress", "completed", "dropped"]),
});

const deleteWatchInputSchema = z.object({
  id: z.string().min(1),
});

const fetchWatchMetadataInputSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["movie", "series"]).default("movie"),
}).passthrough();

type WatchToolOutput = {
  source: z.infer<typeof sourceSchema>;
  confidence: number;
  summary: string;
  entry?: WatchEntry;
  entries: WatchEntry[];
  count?: number;
  deletedCount?: number;
  id?: string;
  metadata?: {
    title: string;
    type: "movie" | "series";
    releaseYear: string;
    director: string;
    leadActors: string[];
    budget: string;
    boxOffice: string;
    ratings: Array<{ source: string; value: string }>;
    synopsis: string;
  };
};

export async function saveWatchEntryTool(input: unknown): Promise<WatchToolOutput> {
  const parsed = saveWatchInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read watch tracker input.");
  }

  try {
    const entry = await createWatchEntry(parsed.data);
    const entries = await listWatchEntries(30);
    return {
      source: "static",
      confidence: 0.97,
      summary: `Saved ${entry.title} to watch tracker.`,
      entry,
      entries,
      count: entries.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Watch tracker save failed: ${message}`);
  }
}

export async function listWatchEntriesTool(input: unknown): Promise<WatchToolOutput> {
  const parsed = listWatchInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read watch history request.");
  }

  try {
    const entries = await listWatchEntries(parsed.data.limit);
    return {
      source: "static",
      confidence: 0.98,
      summary: `Found ${entries.length} watch entr${entries.length === 1 ? "y" : "ies"}.`,
      entries,
      count: entries.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Watch tracker history failed: ${message}`);
  }
}

export async function updateWatchEntryStatusTool(input: unknown): Promise<WatchToolOutput> {
  const parsed = updateWatchStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read watch status update request.");
  }

  try {
    const entry = await updateWatchEntryStatus(parsed.data.id, parsed.data.status as WatchStatus);
    const entries = await listWatchEntries(30);
    return {
      source: "static",
      confidence: 0.97,
      summary: entry ? `Updated status for ${entry.title}.` : "No matching entry found.",
      entry: entry || undefined,
      entries,
      count: entries.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Watch status update failed: ${message}`);
  }
}

export async function deleteWatchEntryTool(input: unknown): Promise<WatchToolOutput> {
  const parsed = deleteWatchInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read watch delete request.");
  }

  try {
    const removed = await deleteWatchEntry(parsed.data.id);
    const entries = await listWatchEntries(30);
    return {
      source: "static",
      confidence: 0.97,
      summary: removed.deletedCount > 0 ? "Deleted watch entry." : "No matching watch entry found.",
      entries,
      count: entries.length,
      deletedCount: removed.deletedCount,
      id: removed.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Watch delete failed: ${message}`);
  }
}

export async function fetchWatchMetadataTool(input: unknown): Promise<WatchToolOutput> {
  const parsed = fetchWatchMetadataInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read watch metadata request.");
  }

  const title = parsed.data.title.trim();
  const type = parsed.data.type;
  try {
    const omdb = await fetchFromOmdb(title, type);
    if (omdb) {
      return {
        source: "static",
        confidence: 0.95,
        summary: `Fetched live metadata for ${omdb.title}.`,
        entries: [],
        metadata: omdb,
      };
    }

    const wiki = await fetchFromWikipedia(title, type);
    return {
      source: wiki ? "static" : "fallback",
      confidence: wiki ? 0.8 : 0.35,
      summary: wiki ? `Fetched partial metadata from Wikipedia for ${wiki.title}.` : "Could not fetch live metadata.",
      entries: [],
      metadata: wiki || undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Live metadata fetch failed: ${message}`);
  }
}

async function fetchFromOmdb(
  title: string,
  type: "movie" | "series",
): Promise<WatchToolOutput["metadata"] | null> {
  const omdbKey = process.env.OMDB_API_KEY?.trim();
  if (!omdbKey) {
    return null;
  }

  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", omdbKey);
  url.searchParams.set("t", title);
  url.searchParams.set("type", type === "series" ? "series" : "movie");
  url.searchParams.set("plot", "short");

  const response = await fetch(url.toString());
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as Record<string, unknown>;
  if (data.Response !== "True") {
    return null;
  }

  const ratings = Array.isArray(data.Ratings)
    ? data.Ratings
        .filter((item): item is { Source: string; Value: string } =>
          Boolean(item && typeof item === "object" && typeof (item as { Source?: unknown }).Source === "string"),
        )
        .map((item) => ({ source: item.Source, value: item.Value }))
    : [];

  return {
    title: stringOr(data.Title, title),
    type,
    releaseYear: stringOr(data.Year, "Unknown"),
    director: stringOr(data.Director, "Unknown"),
    leadActors: splitList(stringOr(data.Actors, "")),
    budget: "Unknown",
    boxOffice: stringOr(data.BoxOffice, "Unknown"),
    ratings,
    synopsis: stringOr(data.Plot, ""),
  };
}

async function fetchFromWikipedia(
  title: string,
  type: "movie" | "series",
): Promise<WatchToolOutput["metadata"] | null> {
  const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
  searchUrl.searchParams.set("action", "opensearch");
  searchUrl.searchParams.set("search", title);
  searchUrl.searchParams.set("limit", "1");
  searchUrl.searchParams.set("namespace", "0");
  searchUrl.searchParams.set("format", "json");
  searchUrl.searchParams.set("origin", "*");

  const searchResponse = await fetch(searchUrl.toString());
  if (!searchResponse.ok) {
    return null;
  }
  const searchData = (await searchResponse.json()) as unknown[];
  const titles = Array.isArray(searchData?.[1]) ? (searchData[1] as string[]) : [];
  const pageTitle = titles[0];
  if (!pageTitle) {
    return null;
  }

  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
  const summaryResponse = await fetch(summaryUrl);
  if (!summaryResponse.ok) {
    return null;
  }
  const summary = (await summaryResponse.json()) as Record<string, unknown>;

  const extract = stringOr(summary.extract, "");
  const yearMatch = extract.match(/\b(19|20)\d{2}\b/);
  return {
    title: stringOr(summary.title, pageTitle),
    type,
    releaseYear: yearMatch ? yearMatch[0] : "Unknown",
    director: "Unknown",
    leadActors: [],
    budget: "Unknown",
    boxOffice: "Unknown",
    ratings: [],
    synopsis: extract,
  };
}

function stringOr(value: unknown, fallbackValue: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallbackValue;
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

async function fallback(summary: string): Promise<WatchToolOutput> {
  return {
    source: "fallback",
    confidence: 0.3,
    summary,
    entries: [],
  };
}
