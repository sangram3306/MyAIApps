import { randomUUID } from "node:crypto";
import { Collection, MongoClient } from "mongodb";

export type WatchStatus = "planned" | "started" | "in_progress" | "completed" | "dropped";
export type WatchType = "movie" | "series";

export type WatchRating = {
  source: string;
  value: string;
};

export type WatchAvailability = {
  provider: string;
  region: string;
  type: "stream" | "rent" | "buy" | "free" | "ads";
  link?: string;
};

export type WatchExternalDetail = {
  label: string;
  value: string;
};

export type WatchEntry = {
  id: string;
  title: string;
  type: WatchType;
  status: WatchStatus;
  favorite: boolean;
  releaseYear: string;
  director: string;
  leadActors: string[];
  budget: string;
  boxOffice: string;
  posterUrl?: string;
  ratings: WatchRating[];
  availability: WatchAvailability[];
  externalDetails: WatchExternalDetail[];
  synopsis: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type WatchEntryInput = Omit<WatchEntry, "id" | "createdAt" | "updatedAt">;
type WatchEntryUpdateInput = Partial<WatchEntryInput>;

let mongoClientPromise: Promise<MongoClient> | null = null;

async function getCollection(): Promise<Collection<WatchEntry>> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(uri).connect();
  }

  const client = await mongoClientPromise;
  const dbName = process.env.MONGODB_DB_NAME?.trim() || "replymate_ai";
  const collectionName = process.env.MONGODB_WATCH_COLLECTION?.trim() || "watch_tracker";
  return client.db(dbName).collection<WatchEntry>(collectionName);
}

export async function createWatchEntry(input: WatchEntryInput): Promise<WatchEntry> {
  const now = new Date().toISOString();
  const entry: WatchEntry = {
    ...sanitizeWatchEntryInput(input),
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  const collection = await getCollection();
  await collection.insertOne(entry);
  return entry;
}

export async function listWatchEntries(limit = 30): Promise<WatchEntry[]> {
  const collection = await getCollection();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  return collection.find({}).sort({ updatedAt: -1 }).limit(safeLimit).toArray();
}

export async function updateWatchEntryStatus(id: string, status: WatchStatus): Promise<WatchEntry | null> {
  const collection = await getCollection();
  const now = new Date().toISOString();
  const normalizedId = normalizeSentence(id);
  const result = await collection.findOneAndUpdate(
    { id: normalizedId },
    { $set: { status, updatedAt: now } },
    { returnDocument: "after" },
  );
  return result || null;
}

export async function updateWatchEntry(id: string, input: WatchEntryUpdateInput): Promise<WatchEntry | null> {
  const collection = await getCollection();
  const normalizedId = normalizeSentence(id);
  const current = await collection.findOne({ id: normalizedId });
  if (!current) {
    return null;
  }

  const now = new Date().toISOString();
  const sanitized = sanitizeWatchEntryInput({
    title: input.title ?? current.title,
    type: input.type ?? current.type,
    status: input.status ?? current.status,
    favorite: input.favorite ?? current.favorite,
    releaseYear: input.releaseYear ?? current.releaseYear,
    director: input.director ?? current.director,
    leadActors: input.leadActors ?? current.leadActors,
    budget: input.budget ?? current.budget,
    boxOffice: input.boxOffice ?? current.boxOffice,
    posterUrl: input.posterUrl ?? current.posterUrl,
    ratings: input.ratings ?? current.ratings,
    availability: input.availability ?? current.availability ?? [],
    externalDetails: input.externalDetails ?? current.externalDetails ?? [],
    synopsis: input.synopsis ?? current.synopsis,
    notes: input.notes ?? current.notes,
  });

  const result = await collection.findOneAndUpdate(
    { id: normalizedId },
    { $set: { ...sanitized, updatedAt: now } },
    { returnDocument: "after" },
  );
  return result || null;
}

export async function deleteWatchEntry(id: string): Promise<{ deletedCount: number; id: string }> {
  const collection = await getCollection();
  const normalizedId = normalizeSentence(id);
  const result = await collection.deleteOne({ id: normalizedId });
  return { deletedCount: result.deletedCount, id: normalizedId };
}

function sanitizeWatchEntryInput(input: WatchEntryInput): WatchEntryInput {
  return {
    title: normalizeSentence(input.title || "Untitled"),
    type: input.type === "series" ? "series" : "movie",
    status: sanitizeStatus(input.status),
    favorite: Boolean(input.favorite),
    releaseYear: normalizeSentence(input.releaseYear || "Unknown"),
    director: normalizeSentence(input.director || "Unknown"),
    leadActors: sanitizeList(input.leadActors, 8),
    budget: normalizeSentence(input.budget || "Unknown"),
    boxOffice: normalizeSentence(input.boxOffice || "Unknown"),
    posterUrl: sanitizePosterUrl(input.posterUrl),
    ratings: sanitizeRatings(input.ratings),
    availability: sanitizeAvailability(input.availability),
    externalDetails: sanitizeExternalDetails(input.externalDetails),
    synopsis: normalizeSentence(input.synopsis || ""),
    notes: normalizeSentence(input.notes || ""),
  };
}

function sanitizeExternalDetails(values: WatchExternalDetail[] | undefined): WatchExternalDetail[] {
  return Array.isArray(values)
    ? values
        .filter((item) => item && typeof item.label === "string" && item.label.trim() && typeof item.value === "string" && item.value.trim())
        .map((item) => ({
          label: normalizeSentence(item.label),
          value: normalizeSentence(item.value),
        }))
        .slice(0, 30)
    : [];
}

function sanitizeAvailability(values: WatchAvailability[] | undefined): WatchAvailability[] {
  return Array.isArray(values)
    ? values
        .filter((item) => item && typeof item.provider === "string" && item.provider.trim())
        .slice(0, 40)
        .map((item) => ({
          provider: normalizeSentence(item.provider),
          region: normalizeSentence(item.region || "Unknown").toUpperCase(),
          type: sanitizeAvailabilityType(item.type),
          link: sanitizePosterUrl(item.link),
        }))
    : [];
}

function sanitizeAvailabilityType(value: WatchAvailability["type"]): WatchAvailability["type"] {
  if (value === "stream" || value === "rent" || value === "buy" || value === "free" || value === "ads") {
    return value;
  }
  return "stream";
}

function sanitizePosterUrl(value: string | undefined): string | undefined {
  const normalized = normalizeSentence(value || "");
  if (!normalized || normalized === "N/A") {
    return undefined;
  }
  return normalized;
}

function sanitizeStatus(value: WatchStatus): WatchStatus {
  if (value === "planned" || value === "started" || value === "in_progress" || value === "completed" || value === "dropped") {
    return value;
  }
  return "planned";
}

function sanitizeRatings(ratings: WatchRating[]): WatchRating[] {
  return Array.isArray(ratings)
    ? ratings
        .filter((item) => item && typeof item.source === "string" && item.source.trim())
        .slice(0, 6)
        .map((item) => ({
          source: normalizeSentence(item.source),
          value: normalizeSentence(item.value || "Unknown"),
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

function normalizeSentence(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
