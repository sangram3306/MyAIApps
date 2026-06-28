import { Router } from "express";
import { ZodError } from "zod";
import {
  buildWatcherProfile,
  listWatchItems,
  logWatchItem,
  OmdbTitleCandidate,
  removeWatchItem,
  resolveImdbId,
  searchOmdbTitles,
  updateWatchDetails,
  updateWatchStatus,
} from "../agents/watchAgent";
import { logWatchSchema, resolveTitleSchema, searchTitlesSchema, updateWatchDetailsSchema, updateWatchStatusSchema } from "../schemas/watchSchemas";
import { embedAllWatchEntries, embedWatchEntry, removeWatchEmbedding, searchSimilarEntries } from "../services/embeddingService";

const router = Router();

router.post("/log", handleLogWatchRequest);
router.get("/items", handleListWatchRequest);
router.get("/profile", handleWatcherProfileRequest);
router.get("/search-titles", handleSearchTitlesRequest);
router.post("/resolve-title", handleResolveTitleRequest);
router.patch("/items/:id", handleUpdateWatchDetailsRequest);
router.patch("/items/:id/status", handleUpdateWatchStatusRequest);
router.delete("/items/:id", handleDeleteWatchRequest);
router.post("/search", handleSearchRequest);
router.post("/embed-all", handleEmbedAllRequest);


export async function handleLogWatchRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = logWatchSchema.parse(req.body);
    const result = await logWatchItem({
      title: input.title,
      imdbId: input.imdbId,
      type: input.type,
      status: input.status,
      favorite: input.favorite,
      notes: input.notes,
    });
    // Generate embedding in background (non-blocking)
    if (result.entry) {
      void embedWatchEntry(result.entry).catch((err) =>
        console.error("[watch] background embed failed", err instanceof Error ? err.message : err),
      );
    }
    return res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }
    return res.status(500).json({ error: "Could not add this watch item." });
  }
}

export async function handleListWatchRequest(
  _req: unknown,
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const result = await listWatchItems();
    return res.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("[watch] list failed", detail);
    return res.status(500).json({ error: `Could not load watch items: ${detail}` });
  }
}

export async function handleWatcherProfileRequest(
  _req: unknown,
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const result = await buildWatcherProfile();
    return res.json(result);
  } catch {
    return res.status(500).json({ error: "Could not build watcher profile." });
  }
}

export async function handleUpdateWatchStatusRequest(
  req: { body: unknown; params?: Record<string, string | undefined> },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  const id = req.params?.id?.trim();
  if (!id) {
    return res.status(400).json({ error: "Watch item id is required." });
  }

  try {
    const input = updateWatchStatusSchema.parse(req.body);
    const result = await updateWatchStatus({ id, status: input.status });
    return res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }
    return res.status(500).json({ error: "Could not update watch status." });
  }
}

export async function handleUpdateWatchDetailsRequest(
  req: { body: unknown; params?: Record<string, string | undefined> },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  const id = req.params?.id?.trim();
  if (!id) {
    return res.status(400).json({ error: "Watch item id is required." });
  }

  try {
    const input = updateWatchDetailsSchema.parse(req.body);
    const result = await updateWatchDetails({ id, ...input });
    // Re-embed updated entry in background
    if (result.entry) {
      void embedWatchEntry(result.entry).catch((err) =>
        console.error("[watch] background re-embed failed", err instanceof Error ? err.message : err),
      );
    }
    return res.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }
    return res.status(500).json({ error: "Could not update watch details." });
  }
}

export async function handleDeleteWatchRequest(
  req: { params?: Record<string, string | undefined> },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  const id = req.params?.id?.trim();
  if (!id) {
    return res.status(400).json({ error: "Watch item id is required." });
  }

  try {
    const result = await removeWatchItem(id);
    // Remove embedding in background
    void removeWatchEmbedding(id).catch((err) =>
      console.error("[watch] background embedding removal failed", err instanceof Error ? err.message : err),
    );
    return res.json(result);
  } catch {
    return res.status(500).json({ error: "Could not delete watch item." });
  }
}

export async function handleSearchRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const body = req.body as { query?: string; limit?: number } | null;
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) {
      return res.status(400).json({ error: "Query string is required." });
    }
    const limit = typeof body?.limit === "number" ? Math.min(Math.max(body.limit, 1), 30) : 10;
    const results = await searchSimilarEntries(query, limit);
    return res.json({ entries: results });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("[watch] vector search failed", detail);
    return res.status(500).json({ error: `Vector search failed: ${detail}` });
  }
}

export async function handleEmbedAllRequest(
  _req: unknown,
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const list = await listWatchItems();
    const result = await embedAllWatchEntries(list.entries);
    return res.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("[watch] embed-all failed", detail);
    return res.status(500).json({ error: `Bulk embedding failed: ${detail}` });
  }
}

export async function handleSearchTitlesRequest(
  req: { query: Record<string, unknown> },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const parsed = searchTitlesSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: "Query string 'q' is required." });
    }
    const typeParam = parsed.data.type;
    const result = await searchOmdbTitles({
      title: parsed.data.q,
      type: typeParam,
    });
    return res.json(result);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("[watch] search-titles failed", detail);
    return res.status(500).json({ error: `Title search failed: ${detail}` });
  }
}

export async function handleResolveTitleRequest(
  req: { body: unknown },
  res: {
    status(code: number): { json(payload: unknown): void };
    json(payload: unknown): void;
  },
) {
  try {
    const input = resolveTitleSchema.parse(req.body);
    const result = await resolveImdbId({
      title: input.title,
      year: input.year,
      type: input.type,
      director: input.director,
      hint: input.hint,
    });
    // If we got an imdbId, also fetch a preview candidate from OMDB search to confirm
    let candidate: OmdbTitleCandidate | null = null;
    if (result.imdbId) {
      const searchResult = await searchOmdbTitles({ title: result.canonicalTitle, type: input.type });
      candidate = searchResult.candidates.find((c) => c.imdbId === result.imdbId) || null;
      // If not in search results, build a minimal candidate
      if (!candidate) {
        candidate = {
          imdbId: result.imdbId,
          title: result.canonicalTitle,
          year: result.year,
          type: input.type || "movie",
        };
      }
    }
    return res.json({ ...result, candidate });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        error: "Invalid request.",
        details: error.flatten().fieldErrors,
      });
    }
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error("[watch] resolve-title failed", detail);
    return res.status(500).json({ error: `Title resolution failed: ${detail}` });
  }
}



export default router;
