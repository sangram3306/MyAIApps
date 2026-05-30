import { Router } from "express";
import { ZodError } from "zod";
import {
  buildWatcherProfile,
  listWatchItems,
  logWatchItem,
  removeWatchItem,
  updateWatchDetails,
  updateWatchStatus,
} from "../agents/watchAgent";
import { logWatchSchema, updateWatchDetailsSchema, updateWatchStatusSchema } from "../schemas/watchSchemas";

const router = Router();

router.post("/log", handleLogWatchRequest);
router.get("/items", handleListWatchRequest);
router.get("/profile", handleWatcherProfileRequest);
router.patch("/items/:id", handleUpdateWatchDetailsRequest);
router.patch("/items/:id/status", handleUpdateWatchStatusRequest);
router.delete("/items/:id", handleDeleteWatchRequest);

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
      type: input.type,
      status: input.status,
      favorite: input.favorite,
      notes: input.notes,
    });
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
  } catch {
    return res.status(500).json({ error: "Could not load watch items." });
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
    return res.json(result);
  } catch {
    return res.status(500).json({ error: "Could not delete watch item." });
  }
}

export default router;
