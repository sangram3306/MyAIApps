import { z } from "zod";
import {
  createWatchEntry,
  deleteWatchEntry,
  listWatchEntries,
  updateWatchEntry,
  updateWatchEntryStatus,
  WatchEntry,
  WatchStatus,
} from "../services/watchStore.js";

const sourceSchema = z.enum(["static", "llm", "fallback"]);

const watchRatingSchema = z.object({
  source: z.string().min(1),
  value: z.string().default("Unknown"),
});

const watchAvailabilitySchema = z.object({
  provider: z.string().min(1),
  region: z.string().min(2),
  type: z.enum(["stream", "rent", "buy", "free", "ads"]).default("stream"),
  link: z.string().optional(),
});

const watchExternalDetailSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

const saveWatchInputSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["movie", "series"]).default("movie"),
  status: z.enum(["planned", "started", "in_progress", "completed", "dropped"]).default("planned"),
  favorite: z.boolean().default(false),
  releaseYear: z.string().default("Unknown"),
  director: z.string().default("Unknown"),
  leadActors: z.array(z.string()).default([]),
  budget: z.string().default("Unknown"),
  boxOffice: z.string().default("Unknown"),
  posterUrl: z.string().optional(),
  ratings: z.array(watchRatingSchema).default([]),
  availability: z.array(watchAvailabilitySchema).default([]),
  externalDetails: z.array(watchExternalDetailSchema).default([]),
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

const updateWatchInputSchema = saveWatchInputSchema.partial().extend({
  id: z.string().min(1),
});

const deleteWatchInputSchema = z.object({
  id: z.string().min(1),
});

const fetchWatchMetadataInputSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["movie", "series"]).optional(),
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
    posterUrl?: string;
    ratings: Array<{ source: string; value: string }>;
    availability: Array<{ provider: string; region: string; type: "stream" | "rent" | "buy" | "free" | "ads"; link?: string }>;
    externalDetails: Array<{ label: string; value: string }>;
    synopsis: string;
    favorite?: boolean;
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

export async function updateWatchEntryTool(input: unknown): Promise<WatchToolOutput> {
  const parsed = updateWatchInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read watch details update request.");
  }

  try {
    const { id, ...updates } = parsed.data;
    const entry = await updateWatchEntry(id, updates);
    const entries = await listWatchEntries(30);
    return {
      source: "static",
      confidence: 0.97,
      summary: entry ? `Updated details for ${entry.title}.` : "No matching entry found.",
      entry: entry || undefined,
      entries,
      count: entries.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Watch details update failed: ${message}`);
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
  const requestedType = parsed.data.type;
  try {
    const omdb = await fetchFromOmdb(title, requestedType);
    const resolvedType = omdb?.type || requestedType || "movie";
    const availability = await fetchAvailabilityFromTmdb(title, resolvedType);
    if (omdb) {
      return {
        source: "static",
        confidence: 0.95,
        summary: `Fetched live metadata for ${omdb.title}.`,
        entries: [],
        metadata: { ...omdb, availability },
      };
    }

    const wiki = await fetchFromWikipedia(title, resolvedType);
    return {
      source: wiki ? "static" : "fallback",
      confidence: wiki ? 0.8 : 0.35,
      summary: wiki ? `Fetched partial metadata from Wikipedia for ${wiki.title}.` : "Could not fetch live metadata.",
      entries: [],
      metadata: wiki ? { ...wiki, availability } : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return fallback(`Live metadata fetch failed: ${message}`);
  }
}

async function fetchFromOmdb(
  title: string,
  type?: "movie" | "series",
): Promise<WatchToolOutput["metadata"] | null> {
  const omdbKey = process.env.OMDB_API_KEY?.trim();
  if (!omdbKey) {
    return null;
  }

  const url = new URL("https://www.omdbapi.com/");
  url.searchParams.set("apikey", omdbKey);
  url.searchParams.set("t", title);
  if (type) {
    url.searchParams.set("type", type === "series" ? "series" : "movie");
  }
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

  const inferredType = data.Type === "series" ? "series" : "movie";
  return {
    title: stringOr(data.Title, title),
    type: type || inferredType,
    releaseYear: stringOr(data.Year, "Unknown"),
    director: stringOr(data.Director, "Unknown"),
    leadActors: splitList(stringOr(data.Actors, "")),
    budget: "Unknown",
    boxOffice: stringOr(data.BoxOffice, "Unknown"),
    posterUrl: posterUrlOrUndefined(data.Poster),
    ratings,
    availability: [],
    externalDetails: omdbDetails(data),
    synopsis: stringOr(data.Plot, ""),
  };
}

function omdbDetails(data: Record<string, unknown>): Array<{ label: string; value: string }> {
  const fields: Array<[string, string]> = [
    ["Title", "Title"],
    ["Year", "Year"],
    ["Rated", "Rated"],
    ["Released", "Released"],
    ["Runtime", "Runtime"],
    ["Genre", "Genre"],
    ["Director", "Director"],
    ["Writer", "Writer"],
    ["Actors", "Actors"],
    ["Plot", "Plot"],
    ["Language", "Language"],
    ["Country", "Country"],
    ["Awards", "Awards"],
    ["Metascore", "Metascore"],
    ["IMDb rating", "imdbRating"],
    ["IMDb votes", "imdbVotes"],
    ["Type", "Type"],
    ["DVD", "DVD"],
    ["Box office", "BoxOffice"],
    ["Production", "Production"],
    ["Website", "Website"],
    ["Total seasons", "totalSeasons"],
  ];

  return fields
    .map(([label, key]) => ({ label, value: stringOr(data[key], "") }))
    .filter((item) => item.value && item.value !== "N/A")
    .slice(0, 30);
}

async function fetchAvailabilityFromTmdb(
  title: string,
  type: "movie" | "series",
): Promise<Array<{ provider: string; region: string; type: "stream" | "rent" | "buy" | "free" | "ads"; link?: string }>> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  const bearerToken = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
  if (!apiKey && !bearerToken) {
    return [];
  }

  const mediaType = type === "series" ? "tv" : "movie";
  const searchUrl = new URL(`https://api.themoviedb.org/3/search/${mediaType}`);
  if (apiKey) {
    searchUrl.searchParams.set("api_key", apiKey);
  }
  searchUrl.searchParams.set("query", title);
  searchUrl.searchParams.set("include_adult", "false");

  const headers = bearerToken ? { Authorization: `Bearer ${bearerToken}` } : undefined;
  const searchResponse = await fetch(searchUrl.toString(), { headers });
  if (!searchResponse.ok) {
    return [];
  }

  const searchData = (await searchResponse.json()) as { results?: Array<{ id?: number }> };
  const tmdbId = searchData.results?.[0]?.id;
  if (!tmdbId) {
    return [];
  }

  const providersUrl = new URL(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers`);
  if (apiKey) {
    providersUrl.searchParams.set("api_key", apiKey);
  }
  const providersResponse = await fetch(providersUrl.toString(), { headers });
  if (!providersResponse.ok) {
    return [];
  }

  const providersData = (await providersResponse.json()) as {
    results?: Record<string, { link?: string; flatrate?: Provider[]; rent?: Provider[]; buy?: Provider[]; free?: Provider[]; ads?: Provider[] }>;
  };
  const regions = configuredRegions();
  const availability: Array<{ provider: string; region: string; type: "stream" | "rent" | "buy" | "free" | "ads"; link?: string }> = [];

  for (const region of regions) {
    const regionData = providersData.results?.[region];
    if (!regionData) {
      continue;
    }
    availability.push(...providersFor(regionData.flatrate, region, "stream", regionData.link));
    availability.push(...providersFor(regionData.rent, region, "rent", regionData.link));
    availability.push(...providersFor(regionData.buy, region, "buy", regionData.link));
    availability.push(...providersFor(regionData.free, region, "free", regionData.link));
    availability.push(...providersFor(regionData.ads, region, "ads", regionData.link));
  }

  return dedupeAvailability(availability).slice(0, 40);
}

type Provider = { provider_name?: string };

function providersFor(providers: Provider[] | undefined, region: string, type: "stream" | "rent" | "buy" | "free" | "ads", link?: string) {
  return Array.isArray(providers)
    ? providers
        .filter((provider) => typeof provider.provider_name === "string" && provider.provider_name.trim())
        .map((provider) => ({
          provider: provider.provider_name || "Unknown",
          region,
          type,
          link,
        }))
    : [];
}

function configuredRegions(): string[] {
  const raw = process.env.TMDB_REGIONS || process.env.TMDB_REGION || "AE,IN,US,GB";
  return raw
    .split(",")
    .map((region) => region.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 8);
}

function dedupeAvailability(
  values: Array<{ provider: string; region: string; type: "stream" | "rent" | "buy" | "free" | "ads"; link?: string }>,
) {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = `${item.provider.toLowerCase()}-${item.region}-${item.type}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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
    posterUrl: thumbnailSource(summary),
    ratings: [],
    availability: [],
    externalDetails: [],
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

function posterUrlOrUndefined(value: unknown): string | undefined {
  const poster = stringOr(value, "");
  return poster && poster !== "N/A" ? poster : undefined;
}

function thumbnailSource(summary: Record<string, unknown>): string | undefined {
  const thumbnail = summary.thumbnail;
  if (!thumbnail || typeof thumbnail !== "object") {
    return undefined;
  }
  return posterUrlOrUndefined((thumbnail as { source?: unknown }).source);
}

async function fallback(summary: string): Promise<WatchToolOutput> {
  return {
    source: "fallback",
    confidence: 0.3,
    summary,
    entries: [],
  };
}
