import { z } from "zod";

export const watchTypeSchema = z.enum(["movie", "series"]);
export const watchStatusSchema = z.enum(["planned", "started", "in_progress", "completed", "dropped"]);

export const logWatchSchema = z.object({
  title: z.string().min(1, "Title is required."),
  type: watchTypeSchema.default("movie"),
  status: watchStatusSchema.default("planned"),
  notes: z.string().optional().default(""),
});

export const updateWatchStatusSchema = z.object({
  status: watchStatusSchema,
});

