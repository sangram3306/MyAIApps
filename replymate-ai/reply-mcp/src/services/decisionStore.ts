import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Collection, MongoClient } from "mongodb";

export type DecisionOption = {
  name: string;
  score: number;
  pros: string[];
  cons: string[];
  reasoning: string;
};

export type DecisionSimulation = {
  id: string;
  question: string;
  context: string;
  category: string;
  horizon: string;
  stakes: "low" | "medium" | "high";
  recommendation: string;
  recommendationSummary: string;
  confidence: number;
  options: DecisionOption[];
  keyFactors: string[];
  tradeoffs: string[];
  risks: string[];
  assumptions: string[];
  experiments: string[];
  nextSteps: string[];
  regretCheck: string;
  decisionRule: string;
  createdAt: string;
  updatedAt: string;
};

type DecisionSimulationInput = Omit<DecisionSimulation, "id" | "createdAt" | "updatedAt">;

let mongoClientPromise: Promise<MongoClient> | null = null;

function shouldUseFileStore(): boolean {
  return Boolean(process.env.DECISION_STORE_PATH?.trim()) || !process.env.MONGODB_URI?.trim();
}

function getStorePath(): string {
  return process.env.DECISION_STORE_PATH?.trim() || path.resolve(process.cwd(), "data", "decisions.json");
}

async function getCollection(): Promise<Collection<DecisionSimulation>> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(uri).connect();
  }

  const client = await mongoClientPromise;
  const dbName = process.env.MONGODB_DB_NAME?.trim() || "replymate_ai";
  const collectionName = process.env.MONGODB_DECISIONS_COLLECTION?.trim() || "decisions";
  return client.db(dbName).collection<DecisionSimulation>(collectionName);
}

export async function createDecisionSimulation(input: DecisionSimulationInput): Promise<DecisionSimulation> {
  const now = new Date().toISOString();
  const simulation: DecisionSimulation = {
    ...sanitizeDecisionSimulationInput(input),
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    await collection.insertOne(simulation);
    return simulation;
  }

  const simulations = await readFileSimulations();
  await writeFileSimulations([simulation, ...simulations]);
  return simulation;
}

export async function listDecisionSimulations(filter: {
  limit?: number;
  category?: string;
} = {}): Promise<DecisionSimulation[]> {
  const limit = Math.min(Math.max(filter.limit || 10, 1), 50);
  const category = normalizeText(filter.category || "");

  if (!shouldUseFileStore()) {
    const collection = await getCollection();
    const query = category ? { category } : {};
    return collection.find(query).sort({ createdAt: -1 }).limit(limit).toArray();
  }

  const simulations = await readFileSimulations();
  return simulations
    .filter((simulation) => (category ? simulation.category === category : true))
    .slice(0, limit);
}

async function readFileSimulations(): Promise<DecisionSimulation[]> {
  try {
    const raw = await fs.readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isDecisionSimulation) : [];
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function writeFileSimulations(simulations: DecisionSimulation[]): Promise<void> {
  const filePath = getStorePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(simulations, null, 2), "utf8");
}

function sanitizeDecisionSimulationInput(input: DecisionSimulationInput): DecisionSimulationInput {
  return {
    question: normalizeSentence(input.question || "Untitled decision"),
    context: normalizeSentence(input.context || ""),
    category: normalizeText(input.category || "life"),
    horizon: normalizeSentence(input.horizon || "near-term"),
    stakes: ["low", "medium", "high"].includes(input.stakes) ? input.stakes : "medium",
    recommendation: normalizeSentence(input.recommendation || "Run a small test first"),
    recommendationSummary: normalizeSentence(input.recommendationSummary || ""),
    confidence: clampScore(input.confidence),
    options: sanitizeOptions(input.options),
    keyFactors: sanitizeList(input.keyFactors),
    tradeoffs: sanitizeList(input.tradeoffs),
    risks: sanitizeList(input.risks),
    assumptions: sanitizeList(input.assumptions),
    experiments: sanitizeList(input.experiments),
    nextSteps: sanitizeList(input.nextSteps),
    regretCheck: normalizeSentence(input.regretCheck || ""),
    decisionRule: normalizeSentence(input.decisionRule || ""),
  };
}

function sanitizeOptions(options: DecisionOption[]): DecisionOption[] {
  return options
    .filter((option) => option && typeof option.name === "string" && option.name.trim())
    .slice(0, 6)
    .map((option) => ({
      name: normalizeSentence(option.name),
      score: clampScore(option.score),
      pros: sanitizeList(option.pros),
      cons: sanitizeList(option.cons),
      reasoning: normalizeSentence(option.reasoning || ""),
    }));
}

function sanitizeList(values: string[]): string[] {
  return Array.isArray(values)
    ? values
        .filter((value) => typeof value === "string" && value.trim())
        .map(normalizeSentence)
        .slice(0, 8)
    : [];
}

function clampScore(value: number): number {
  const score = Number.isFinite(value) ? value : 50;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase() || "life";
}

function normalizeSentence(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isDecisionSimulation(value: unknown): value is DecisionSimulation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.question === "string" &&
    typeof item.context === "string" &&
    typeof item.category === "string" &&
    typeof item.horizon === "string" &&
    (item.stakes === "low" || item.stakes === "medium" || item.stakes === "high") &&
    typeof item.recommendation === "string" &&
    typeof item.recommendationSummary === "string" &&
    typeof item.confidence === "number" &&
    Array.isArray(item.options) &&
    Array.isArray(item.keyFactors) &&
    Array.isArray(item.tradeoffs) &&
    Array.isArray(item.risks) &&
    Array.isArray(item.assumptions) &&
    Array.isArray(item.experiments) &&
    Array.isArray(item.nextSteps) &&
    typeof item.regretCheck === "string" &&
    typeof item.decisionRule === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}
