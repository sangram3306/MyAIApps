import { z } from "zod";

export const toneSchema = z.enum([
  "polite",
  "professional",
  "funny",
  "romantic",
  "short",
  "Hinglish",
  "Hindi",
  "English",
]);

export const generateRepliesSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(2000, "Message must be under 2000 characters."),
  tone: toneSchema,
});

export type GenerateRepliesInput = z.infer<typeof generateRepliesSchema>;
export type ReplyTone = z.infer<typeof toneSchema>;
