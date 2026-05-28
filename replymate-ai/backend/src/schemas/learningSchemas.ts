import { z } from "zod";

export const skillTreeSchema = z.object({
  skillName: z.string().min(2).max(160),
  currentLevel: z.string().max(120).optional().default("beginner"),
  targetLevel: z.string().max(120).optional().default("confident"),
  timeBudget: z.string().max(120).optional().default("3 hours/week"),
  focusAreas: z.array(z.string().min(1).max(120)).max(8).optional().default([]),
});

export const learningRoadmapSchema = z.object({
  topic: z.string().min(2).max(160),
  goal: z.string().max(300).optional().default("learn the fundamentals"),
  currentLevel: z.string().max(120).optional().default("beginner"),
  timeline: z.string().max(120).optional().default("8 weeks"),
  timePerWeek: z.string().max(120).optional().default("3 hours/week"),
});

