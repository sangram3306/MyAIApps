import { z } from "zod";

export const decisionSimulateSchema = z.object({
  question: z.string().min(5).max(500),
  context: z.string().max(2000).optional().default(""),
  options: z.array(z.string().min(1).max(160)).max(6).optional().default([]),
  horizon: z.string().max(120).optional().default("near-term"),
  stakes: z.enum(["low", "medium", "high"]).optional().default("medium"),
});

