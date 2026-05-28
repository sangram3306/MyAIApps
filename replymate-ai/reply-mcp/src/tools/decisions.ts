import { z } from "zod";
import {
  createDecisionSimulation,
  DecisionSimulation,
  listDecisionSimulations,
} from "../services/decisionStore.js";

const sourceSchema = z.enum(["static", "llm", "fallback"]);

const decisionOptionSchema = z.object({
  name: z.string().min(1),
  score: z.number().min(0).max(100),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  reasoning: z.string().default(""),
});

const saveDecisionInputSchema = z.object({
  question: z.string().min(1),
  context: z.string().default(""),
  category: z.string().default("life"),
  horizon: z.string().default("near-term"),
  stakes: z.enum(["low", "medium", "high"]).default("medium"),
  recommendation: z.string().min(1),
  recommendationSummary: z.string().default(""),
  confidence: z.number().min(0).max(100).default(60),
  options: z.array(decisionOptionSchema).default([]),
  keyFactors: z.array(z.string()).default([]),
  tradeoffs: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  experiments: z.array(z.string()).default([]),
  nextSteps: z.array(z.string()).default([]),
  regretCheck: z.string().default(""),
  decisionRule: z.string().default(""),
});

const listDecisionInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
  category: z.string().optional(),
}).passthrough();

type DecisionToolOutput = {
  source: z.infer<typeof sourceSchema>;
  confidence: number;
  summary: string;
  simulation?: DecisionSimulation;
  simulations: DecisionSimulation[];
  count?: number;
};

export async function saveDecisionSimulationTool(input: unknown): Promise<DecisionToolOutput> {
  const parsed = saveDecisionInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the decision simulation.");
  }

  const simulation = await createDecisionSimulation(parsed.data);
  const simulations = await listDecisionSimulations({ limit: 10 });

  return {
    source: "static",
    confidence: 0.97,
    summary: `Saved decision simulation: ${simulation.question}`,
    simulation,
    simulations,
    count: simulations.length,
  };
}

export async function listDecisionSimulationsTool(input: unknown): Promise<DecisionToolOutput> {
  const parsed = listDecisionInputSchema.safeParse(input);
  if (!parsed.success) {
    return fallback("Could not read the decision history request.");
  }

  const simulations = await listDecisionSimulations({
    limit: parsed.data.limit,
    category: parsed.data.category,
  });

  return {
    source: "static",
    confidence: 0.98,
    summary: `Found ${simulations.length} saved decision simulation${simulations.length === 1 ? "" : "s"}.`,
    simulations,
    count: simulations.length,
  };
}

async function fallback(summary: string): Promise<DecisionToolOutput> {
  return {
    source: "fallback",
    confidence: 0.3,
    summary,
    simulations: await listDecisionSimulations({ limit: 10 }).catch(() => []),
  };
}
