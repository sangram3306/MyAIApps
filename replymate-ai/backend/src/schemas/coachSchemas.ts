import { z } from "zod";

export const relationshipContextValues = [
  "Friend",
  "Wife",
  "Boss",
  "Client",
  "Customer",
  "Parent",
  "Sibling",
  "Other",
] as const;

export const coachAnalyzeSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required.")
    .max(2000, "Message must be under 2000 characters."),
  relationshipContext: z.enum(relationshipContextValues),
});

export type CoachAnalyzeInput = z.infer<typeof coachAnalyzeSchema>;
export type RelationshipContext = z.infer<typeof coachAnalyzeSchema>["relationshipContext"];

