import { WatchEmbedding, IWatchEmbedding } from "../models/WatchEmbedding";
import type { WatchEntry } from "../agents/watchAgent";

// ─── Gemini Embedding API ────────────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMENSIONS = 768;

type GeminiEmbeddingResponse = {
  embedding?: {
    values?: number[];
  };
};

function getGeminiApiKey(): string {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
    ""
  );
}

/**
 * Generate a 768-dimensional embedding vector using Gemini text-embedding-004.
 * Free tier: 1,500 requests/minute.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Cannot generate embeddings.");
  }

  const trimmedText = text.trim().slice(0, 8000); // Gemini embedding limit
  if (!trimmedText) {
    throw new Error("Cannot generate embedding for empty text.");
  }

  const baseUrl = (
    process.env.GEMINI_BASE_URL?.trim() ||
    process.env.GOOGLE_GEMINI_BASE_URL?.trim() ||
    "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/$/, "");

  const response = await fetch(
    `${baseUrl}/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: {
          parts: [{ text: trimmedText }],
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[embedding] Gemini API error", response.status, errorText);
    throw new Error(`Gemini embedding API error: ${response.status}`);
  }

  const data = (await response.json()) as GeminiEmbeddingResponse;
  const values = data.embedding?.values;

  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Unexpected embedding dimensions: expected ${EMBEDDING_DIMENSIONS}, got ${values?.length ?? 0}`);
  }

  return values;
}

// ─── Watch Entry Embedding ───────────────────────────────────────────────────

/**
 * Build a text representation of a watch entry for embedding.
 * Includes the most semantically meaningful fields.
 */
function buildEmbeddingText(entry: WatchEntry): string {
  const genres = getGenresFromEntry(entry);
  const parts = [
    entry.title,
    entry.type,
    genres.length ? `Genres: ${genres.join(", ")}` : "",
    entry.director && entry.director !== "Unknown" ? `Director: ${entry.director}` : "",
    entry.releaseYear && entry.releaseYear !== "Unknown" ? `Year: ${entry.releaseYear}` : "",
    entry.leadActors?.length ? `Cast: ${entry.leadActors.slice(0, 4).join(", ")}` : "",
    entry.synopsis ? `Synopsis: ${entry.synopsis}` : "",
    entry.favorite ? "Favorite" : "",
    entry.status ? `Status: ${entry.status.replace(/_/g, " ")}` : "",
  ];
  return parts.filter(Boolean).join(". ");
}

function getGenresFromEntry(entry: WatchEntry): string[] {
  const details = Array.isArray(entry.externalDetails) ? entry.externalDetails : [];
  const genreField = details.find(
    (d) => String(d.label || "").trim().toLowerCase() === "genre",
  );
  if (!genreField?.value) return [];
  return String(genreField.value)
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean);
}

function getImdbRating(entry: WatchEntry): string {
  const ratings = Array.isArray(entry.ratings) ? entry.ratings : [];
  const imdb = ratings.find((r) => {
    const src = String(r.source || "").trim().toLowerCase();
    return src === "imdb" || src === "internet movie database";
  });
  return imdb?.value || "";
}

/**
 * Generate an embedding for a watch entry and upsert it into the
 * WatchEmbedding collection.
 */
export async function embedWatchEntry(entry: WatchEntry): Promise<void> {
  const textContent = buildEmbeddingText(entry);
  const embedding = await generateEmbedding(textContent);

  await WatchEmbedding.findOneAndUpdate(
    { watchEntryId: entry.id },
    {
      watchEntryId: entry.id,
      title: entry.title,
      type: entry.type,
      genres: getGenresFromEntry(entry),
      director: entry.director || "Unknown",
      releaseYear: entry.releaseYear || "Unknown",
      status: entry.status,
      favorite: Boolean(entry.favorite),
      imdbRating: getImdbRating(entry),
      synopsis: entry.synopsis || "",
      textContent,
      embedding,
    },
    { upsert: true, new: true },
  );
}

/**
 * Remove the embedding for a deleted watch entry.
 */
export async function removeWatchEmbedding(watchEntryId: string): Promise<void> {
  await WatchEmbedding.deleteOne({ watchEntryId });
}

// ─── Vector Search ───────────────────────────────────────────────────────────

export type VectorSearchResult = {
  watchEntryId: string;
  title: string;
  type: string;
  genres: string[];
  director: string;
  releaseYear: string;
  status: string;
  favorite: boolean;
  imdbRating: string;
  synopsis: string;
  score: number;
};

/**
 * Search for similar watch entries using MongoDB Atlas Vector Search.
 * Requires a vector search index named "vector_index" on the WatchEmbedding collection.
 */
export async function searchSimilarEntries(
  query: string,
  limit = 10,
): Promise<VectorSearchResult[]> {
  const queryEmbedding = await generateEmbedding(query);

  const results = await WatchEmbedding.aggregate<
    IWatchEmbedding & { score: number }
  >([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: Math.max(limit * 10, 100),
        limit,
      },
    },
    {
      $addFields: {
        score: { $meta: "vectorSearchScore" },
      },
    },
    {
      $project: {
        _id: 0,
        watchEntryId: 1,
        title: 1,
        type: 1,
        genres: 1,
        director: 1,
        releaseYear: 1,
        status: 1,
        favorite: 1,
        imdbRating: 1,
        synopsis: 1,
        score: 1,
      },
    },
  ]);

  return results.map((doc) => ({
    watchEntryId: doc.watchEntryId,
    title: doc.title,
    type: doc.type,
    genres: doc.genres || [],
    director: doc.director || "Unknown",
    releaseYear: doc.releaseYear || "Unknown",
    status: doc.status || "planned",
    favorite: Boolean(doc.favorite),
    imdbRating: doc.imdbRating || "",
    synopsis: doc.synopsis || "",
    score: doc.score,
  }));
}

/**
 * Embed all existing watch entries that don't have embeddings yet.
 * Returns the count of newly embedded entries.
 */
export async function embedAllWatchEntries(
  entries: WatchEntry[],
): Promise<{ embedded: number; skipped: number; failed: number; errors?: string[] }> {
  const existingIds = new Set(
    (await WatchEmbedding.find({}, { watchEntryId: 1 }).lean()).map(
      (doc) => doc.watchEntryId,
    ),
  );

  let embedded = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    if (existingIds.has(entry.id)) {
      skipped += 1;
      continue;
    }

    try {
      await embedWatchEntry(entry);
      embedded += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[embedding] Failed to embed "${entry.title}":`, msg);
      failed += 1;
      if (errors.length < 10) {
        errors.push(`${entry.title}: ${msg}`);
      }
    }
  }

  return { embedded, skipped, failed, errors };
}
