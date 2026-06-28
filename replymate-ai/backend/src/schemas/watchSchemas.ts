import { z } from "zod";

export const watchTypeSchema = z.enum(["movie", "series"]);
export const watchStatusSchema = z.enum(["planned", "started", "in_progress", "completed", "dropped"]);

export const logWatchSchema = z.object({
  title: z.string().min(1, "Title is required."),
  imdbId: z.string().optional(),
  type: watchTypeSchema.optional(),
  status: watchStatusSchema.default("planned"),
  favorite: z.boolean().optional().default(false),
  notes: z.string().optional().default(""),
});

export const updateWatchStatusSchema = z.object({
  status: watchStatusSchema,
});

export const watchRatingSchema = z.object({
  source: z.string().min(1),
  value: z.string().default("Unknown"),
});

export const watchAvailabilitySchema = z.object({
  provider: z.string().min(1),
  region: z.string().min(2),
  type: z.enum(["stream", "rent", "buy", "free", "ads"]).default("stream"),
  link: z.string().optional(),
});

export const watchExternalDetailSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const updateWatchDetailsSchema = z.object({
  title: z.string().min(1).optional(),
  type: watchTypeSchema.optional(),
  status: watchStatusSchema.optional(),
  favorite: z.boolean().optional(),
  releaseYear: z.string().optional(),
  director: z.string().optional(),
  leadActors: z.array(z.string()).optional(),
  budget: z.string().optional(),
  boxOffice: z.string().optional(),
  posterUrl: z.string().optional(),
  ratings: z.array(watchRatingSchema).optional(),
  availability: z.array(watchAvailabilitySchema).optional(),
  externalDetails: z.array(watchExternalDetailSchema).optional(),
  synopsis: z.string().optional(),
  notes: z.string().optional(),
});

export const resolveTitleSchema = z.object({
  title: z.string().min(1, "Title is required."),
  year: z.string().optional(),
  type: watchTypeSchema.optional(),
  director: z.string().optional(),
  hint: z.string().optional(),
});

export const searchTitlesSchema = z.object({
  q: z.string().min(1, "Query is required."),
  type: watchTypeSchema.optional(),
});
