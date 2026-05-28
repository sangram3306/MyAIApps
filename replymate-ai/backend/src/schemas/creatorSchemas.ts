import { z } from "zod";

export const creatorRepurposeSchema = z.object({
  sourceText: z
    .string()
    .trim()
    .min(1, "Source text is required.")
    .max(8000, "Source text must be under 8000 characters."),
  sourceType: z
    .enum(["idea", "note", "article", "thread", "meeting", "video", "other"])
    .optional()
    .default("note"),
  audience: z
    .string()
    .trim()
    .max(120, "Audience must be under 120 characters.")
    .optional()
    .default("general"),
  goal: z
    .string()
    .trim()
    .max(160, "Goal must be under 160 characters.")
    .optional()
    .default("repurpose"),
  tone: z
    .string()
    .trim()
    .max(80, "Tone must be under 80 characters.")
    .optional()
    .default("balanced"),
  platforms: z
    .array(z.enum(["x", "linkedin", "instagram", "email", "thread"]))
    .optional()
    .default(["x", "linkedin", "instagram", "email"]),
});

export type CreatorRepurposeInput = z.infer<typeof creatorRepurposeSchema>;
