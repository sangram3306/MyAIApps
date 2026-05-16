import { z } from "zod";

const toneValues = [
  "none",
  "polite",
  "professional",
  "funny",
  "romantic",
  "short",
  "Hinglish",
  "Hindi",
  "English",
] as const;

const roleValues = [
  "none",
  "comedian",
  "thief",
  "kid",
  "engineer",
  "cowboy",
  "superhero",
  "police",
  "teacher",
] as const;

export const toneSchema = z.preprocess((value) => {
  if (typeof value !== "string" || !value.trim() || value === "default") {
    return "none";
  }

  return value;
}, z.enum(toneValues));

export const roleSchema = z.preprocess((value) => {
  if (typeof value !== "string" || !value.trim() || value === "default") {
    return "none";
  }

  if (value.toLowerCase() === "theif") {
    return "thief";
  }

  return value;
}, z.enum(roleValues));

export const generateRepliesSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(2000, "Message must be under 2000 characters."),
  tone: toneSchema.optional().default("none"),
  role: roleSchema.optional().default("none"),
});

export type GenerateRepliesInput = z.infer<typeof generateRepliesSchema>;
export type ReplyTone = z.infer<typeof toneSchema>;
export type ReplyRole = z.infer<typeof roleSchema>;
