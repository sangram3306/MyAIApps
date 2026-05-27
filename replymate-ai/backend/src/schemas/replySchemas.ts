import { z } from "zod";

const toneValues = [
  "none",
  "clearer",
  "shorter",
  "polite",
  "professional",
  "friendly",
  "casual",
  "funny",
  "snarky",
  "confident",
  "apologetic",
  "romantic",
  "sarcastic",
  "excited",
  "calm",
  "formal",
  "persuasive",
  "simple_english",
  "hinglish",
  "hindi",
  "more_human",
  "short",
  "short_sweet",
  "detailed",
] as const;

const roleValues = [
  "none",
  "friend",
  "best_friend",
  "partner",
  "customer_support",
  "manager",
  "professional_writer",
  "sales_expert",
  "marketing_expert",
  "influencer",
  "startup_founder",
  "comedian",
  "savage_friend",
  "poet",
  "teacher",
  "pirate",
  "five_year_old",
  "doctor",
  "ai_engineer",
  "thief",
  "cowboy",
  "astronaut",
  "shakespeare",
  "grandma",
  "lawyer",
  "gym_coach",
  "detective",
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

  if (value.toLowerCase() === "astonout") {
    return "astronaut";
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
