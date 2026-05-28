import { callMcpTool } from "../mcp/mcpClient";
import { callChatCompletion, hasConfiguredLlmApiKey } from "../services/llmService";
import { safeParseJson } from "../utils/safeJson";

type Source = "static" | "llm" | "fallback";
type DecisionToolName = "listDecisionSimulations" | "saveDecisionSimulation";

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

export type DecisionInput = {
  question: string;
  context: string;
  options: string[];
  horizon: string;
  stakes: "low" | "medium" | "high";
};

export type DecisionResponse = {
  assistantReply: string;
  simulation: DecisionSimulation;
  recentDecisions: DecisionSimulation[];
  toolCalls: Array<{
    name: string;
    source: Source;
    summary: string;
  }>;
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      decisionMemory: Source;
      simulationStorage: Source;
      answerGeneration: Source;
    };
  };
};

type DecisionToolResult = {
  source: Source;
  confidence: number;
  summary: string;
  simulation?: DecisionSimulation;
  simulations: DecisionSimulation[];
  count?: number;
};

type AgentAction =
  | {
      type: "tool_call";
      toolName: DecisionToolName;
      arguments: Record<string, unknown>;
      reason?: string;
    }
  | {
      type: "final";
      assistantReply: string;
    };

type AgentMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const maxTurns = 6;

const decisionTools = [
  {
    name: "listDecisionSimulations",
    description: "Load recent saved decision simulations from MongoDB memory.",
    schema: {
      limit: "number optional",
      category: "string optional",
    },
  },
  {
    name: "saveDecisionSimulation",
    description: "Save a complete decision simulation to MongoDB.",
    schema: {
      question: "string",
      context: "string",
      category: "string",
      horizon: "string",
      stakes: "low | medium | high",
      recommendation: "string",
      recommendationSummary: "string",
      confidence: "number 0-100",
      options: "array of { name, score, pros, cons, reasoning }",
      keyFactors: "string[]",
      tradeoffs: "string[]",
      risks: "string[]",
      assumptions: "string[]",
      experiments: "string[]",
      nextSteps: "string[]",
      regretCheck: "string",
      decisionRule: "string",
    },
  },
];

export async function simulateDecision(input: DecisionInput): Promise<DecisionResponse> {
  if (!hasConfiguredLlmApiKey()) {
    return fallbackDecisionResponse(input);
  }

  try {
    return await runDecisionAgentLoop(input);
  } catch (error) {
    console.error("[decisions] agent loop fallback", error);
    return fallbackDecisionResponse(input);
  }
}

async function runDecisionAgentLoop(input: DecisionInput): Promise<DecisionResponse> {
  const trace = ["Received decision question"];
  const toolCalls: DecisionResponse["toolCalls"] = [];
  const observations: Array<{ toolName: DecisionToolName; result: DecisionToolResult }> = [];
  const messages: AgentMessage[] = [
    {
      role: "system",
      content:
        "You are a Decision Simulator agent using a ReAct-style tool loop. Return only valid JSON. Do not reveal chain-of-thought. You must call listDecisionSimulations once before saving. You must call saveDecisionSimulation with the complete simulation before returning final.",
    },
    {
      role: "user",
      content: JSON.stringify({
        userInput: input,
        skill: {
          name: "Decision Simulator",
          description:
            "Model important personal decisions by comparing options, assumptions, risks, regret, experiments, and next steps.",
        },
        availableTools: decisionTools,
        instructions: [
          "First call listDecisionSimulations with limit 5 to inspect recent decision memory.",
          "Then create a simulation that is practical, non-generic, and bias-aware.",
          "If options are missing, infer 2-3 sensible options, including a reversible experiment or wait/collect-data option.",
          "Use scores as directional decision support, not certainty.",
          "Recommend the option with the best balance of expected value, reversibility, risk, and user constraints.",
          "Save the full simulation through saveDecisionSimulation before final.",
          "Final answer should be concise and mention that the simulation was saved.",
        ],
        responseSchemas: {
          toolCall: {
            type: "tool_call",
            toolName: "listDecisionSimulations | saveDecisionSimulation",
            arguments: "object matching selected tool schema",
            reason: "short reason",
          },
          final: {
            type: "final",
            assistantReply: "string",
          },
        },
      }),
    },
  ];

  for (let turn = 0; turn < maxTurns; turn += 1) {
    const action = await callDecisionModel(messages);
    const savedObservation = observations.find((observation) => observation.toolName === "saveDecisionSimulation");

    if (action.type === "final") {
      if (!savedObservation?.result.simulation) {
        messages.push({ role: "assistant", content: JSON.stringify(action) });
        messages.push({
          role: "user",
          content: JSON.stringify({
            type: "tool_required",
            instruction: "You must call saveDecisionSimulation before final.",
          }),
        });
        trace.push("Asked agent to save simulation before final");
        continue;
      }

      trace.push("Generated final decision response");
      return buildDecisionResponse(
        action.assistantReply,
        savedObservation.result.simulation,
        getRecentDecisions(observations),
        toolCalls,
        trace,
        "llm",
      );
    }

    const validationError = validateDecisionToolCall(action);
    if (validationError) {
      messages.push({ role: "assistant", content: JSON.stringify(action) });
      messages.push({
        role: "user",
        content: JSON.stringify({
          type: "tool_result",
          toolName: action.toolName,
          error: validationError,
        }),
      });
      trace.push("Rejected invalid decision tool call");
      continue;
    }

    const result = await callDecisionTool(action.toolName, normalizeDecisionToolArguments(action.toolName, action.arguments, input));
    observations.push({ toolName: action.toolName, result });
    toolCalls.push({
      name: action.toolName,
      source: result.source,
      summary: result.summary,
    });
    trace.push(action.toolName === "listDecisionSimulations" ? "Loaded decision memory" : "Saved decision simulation");

    messages.push({ role: "assistant", content: JSON.stringify(action) });
    messages.push({
      role: "user",
      content: JSON.stringify({
        type: "tool_result",
        toolName: action.toolName,
        result: sanitizeDecisionResult(result),
        instruction: "Return another tool_call if more work remains, otherwise return final.",
      }),
    });
  }

  trace.push("Stopped at loop limit");
  return fallbackDecisionResponse(input, trace);
}

async function callDecisionModel(messages: AgentMessage[]): Promise<AgentAction> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await callChatCompletion({
      temperature: 0.25,
      maxTokens: 900,
      responseFormat: { type: "json_object" },
      messages,
    });

    const action = parseDecisionAction(completion.content);
    if (action) {
      return action;
    }

    messages.push({
      role: "user",
      content: JSON.stringify({
        type: "format_error",
        instruction: "Return only valid JSON matching either the toolCall or final schema.",
      }),
    });
  }

  throw new Error("Decision model returned invalid JSON.");
}

function parseDecisionAction(content: string | undefined): AgentAction | null {
  if (!content) {
    return null;
  }

  const parsed = safeParseJson<Partial<AgentAction>>(content);
  if (!parsed || typeof parsed.type !== "string") {
    return null;
  }

  if (parsed.type === "final" && typeof parsed.assistantReply === "string") {
    return {
      type: "final",
      assistantReply: parsed.assistantReply,
    };
  }

  if (
    parsed.type === "tool_call" &&
    typeof parsed.toolName === "string" &&
    isDecisionToolName(parsed.toolName) &&
    parsed.arguments &&
    typeof parsed.arguments === "object" &&
    !Array.isArray(parsed.arguments)
  ) {
    return {
      type: "tool_call",
      toolName: parsed.toolName,
      arguments: parsed.arguments as Record<string, unknown>,
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
    };
  }

  return null;
}

async function callDecisionTool(toolName: DecisionToolName, payload: unknown): Promise<DecisionToolResult> {
  try {
    return await callMcpTool<DecisionToolResult>(toolName, payload, {
      timeoutMs: 5000,
      retries: 1,
    });
  } catch (error) {
    console.error("[decisions] MCP fallback", {
      toolName,
      message: error instanceof Error ? error.message : "unknown",
    });
    return {
      source: "fallback",
      confidence: 0.3,
      summary: `Could not execute ${toolName}.`,
      simulations: [],
    };
  }
}

function validateDecisionToolCall(action: Extract<AgentAction, { type: "tool_call" }>): string | null {
  if (action.toolName === "listDecisionSimulations") {
    const limit = action.arguments.limit;
    if (limit !== undefined && typeof limit !== "number") {
      return "listDecisionSimulations limit must be a number.";
    }
  }

  if (action.toolName === "saveDecisionSimulation") {
    if (typeof action.arguments.question !== "string") {
      return "saveDecisionSimulation requires question.";
    }

    if (typeof action.arguments.recommendation !== "string") {
      return "saveDecisionSimulation requires recommendation.";
    }

    if (action.arguments.options !== undefined && !Array.isArray(action.arguments.options)) {
      return "saveDecisionSimulation options must be an array.";
    }
  }

  return null;
}

function normalizeDecisionToolArguments(
  toolName: DecisionToolName,
  args: Record<string, unknown>,
  input: DecisionInput,
): Record<string, unknown> {
  if (toolName === "listDecisionSimulations") {
    return {
      limit: typeof args.limit === "number" ? args.limit : 5,
      ...(typeof args.category === "string" && args.category.trim() ? { category: args.category } : {}),
    };
  }

  return {
    ...buildBaseSimulation(input),
    ...args,
    question: typeof args.question === "string" ? args.question : input.question,
    context: typeof args.context === "string" ? args.context : input.context,
    horizon: typeof args.horizon === "string" ? args.horizon : input.horizon,
    stakes: args.stakes === "low" || args.stakes === "medium" || args.stakes === "high" ? args.stakes : input.stakes,
  };
}

function buildDecisionResponse(
  assistantReply: string,
  simulation: DecisionSimulation,
  recentDecisions: DecisionSimulation[],
  toolCalls: DecisionResponse["toolCalls"],
  trace: string[],
  answerGeneration: Source,
): DecisionResponse {
  const memorySource = toolCalls.find((tool) => tool.name === "listDecisionSimulations")?.source || "fallback";
  const saveSource = toolCalls.find((tool) => tool.name === "saveDecisionSimulation")?.source || "fallback";

  return {
    assistantReply,
    simulation,
    recentDecisions,
    toolCalls,
    agentTrace: [...trace, "Returned decision simulation"],
    metadata: {
      toolsUsed: ["decisionAgent", ...toolCalls.map((tool) => tool.name)],
      toolSources: {
        decisionMemory: memorySource,
        simulationStorage: saveSource,
        answerGeneration,
      },
    },
  };
}

async function fallbackDecisionResponse(input: DecisionInput, existingTrace: string[] = []): Promise<DecisionResponse> {
  const trace = existingTrace.length ? existingTrace : ["Received decision question", "Used fallback simulator"];
  const recentResult = await callDecisionTool("listDecisionSimulations", { limit: 5 });
  const baseSimulation = buildLocalSimulation(input);
  const saveResult = await callDecisionTool("saveDecisionSimulation", baseSimulation);
  const simulation = saveResult.simulation || withLocalMetadata(baseSimulation);
  const toolCalls: DecisionResponse["toolCalls"] = [
    {
      name: "listDecisionSimulations",
      source: recentResult.source,
      summary: recentResult.summary,
    },
    {
      name: "saveDecisionSimulation",
      source: saveResult.source,
      summary: saveResult.summary,
    },
  ];

  const storageLine = saveResult.simulation
    ? "I saved this simulation so you can compare future decisions against it."
    : "I could not reach decision storage, so I returned the simulation without saving it.";

  return buildDecisionResponse(
    `${simulation.recommendationSummary} ${storageLine}`,
    simulation,
    recentResult.simulations,
    toolCalls,
    [...trace, "Built fallback decision simulation"],
    "fallback",
  );
}

function buildLocalSimulation(input: DecisionInput): Omit<DecisionSimulation, "id" | "createdAt" | "updatedAt"> {
  const base = buildBaseSimulation(input);
  return {
    ...base,
    recommendation: base.options[0]?.name || "Run a small reversible test first",
    recommendationSummary:
      "The safest next move is to run a small, reversible test before committing fully.",
    confidence: input.stakes === "high" ? 58 : 68,
    keyFactors: ["Reversibility", "Upside", "Downside risk", "Time pressure"],
    tradeoffs: ["Moving faster gives clarity sooner, but increases the chance of missing hidden constraints."],
    risks: ["The decision may be based on incomplete information.", "Short-term emotion may outweigh long-term fit."],
    assumptions: ["Your current context is accurate.", "No major external constraint changes immediately."],
    experiments: ["Set a 7-day test with a clear success metric.", "Ask one trusted person to challenge your reasoning."],
    nextSteps: ["Write the decision deadline.", "Define what would make you reverse the choice.", "Pick the smallest next action."],
    regretCheck: "Which option would you still respect yourself for choosing six months from now?",
    decisionRule: "Choose the option only if the upside is meaningful and the downside can be contained.",
  };
}

function buildBaseSimulation(input: DecisionInput): Omit<DecisionSimulation, "id" | "createdAt" | "updatedAt"> {
  const optionNames = input.options.length ? input.options : ["Do it now", "Wait and gather more data", "Run a smaller trial"];
  return {
    question: input.question,
    context: input.context,
    category: inferCategory(input.question, input.context),
    horizon: input.horizon,
    stakes: input.stakes,
    recommendation: optionNames[0] || "Run a smaller trial",
    recommendationSummary: "",
    confidence: 60,
    options: optionNames.map((name, index) => ({
      name,
      score: Math.max(45, 72 - index * 7),
      pros: index === 0 ? ["Moves the decision forward"] : ["Keeps optionality"],
      cons: index === 0 ? ["May expose you to avoidable risk"] : ["Slower clarity"],
      reasoning: index === 0 ? "This option creates momentum." : "This option protects flexibility.",
    })),
    keyFactors: [],
    tradeoffs: [],
    risks: [],
    assumptions: [],
    experiments: [],
    nextSteps: [],
    regretCheck: "",
    decisionRule: "",
  };
}

function withLocalMetadata(
  simulation: Omit<DecisionSimulation, "id" | "createdAt" | "updatedAt">,
): DecisionSimulation {
  const now = new Date().toISOString();
  return {
    ...simulation,
    id: `local-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
}

function sanitizeDecisionResult(result: DecisionToolResult): Partial<DecisionToolResult> {
  return {
    source: result.source,
    confidence: result.confidence,
    summary: result.summary,
    count: result.count,
    simulation: result.simulation
      ? {
          ...result.simulation,
          context: truncate(result.simulation.context, 280),
        }
      : undefined,
    simulations: result.simulations.slice(0, 5).map((simulation) => ({
      ...simulation,
      context: truncate(simulation.context, 200),
    })),
  };
}

function getRecentDecisions(
  observations: Array<{ toolName: DecisionToolName; result: DecisionToolResult }>,
): DecisionSimulation[] {
  return observations.find((observation) => observation.toolName === "listDecisionSimulations")?.result.simulations || [];
}

function inferCategory(question: string, context: string): string {
  const text = `${question} ${context}`.toLowerCase();
  if (/\b(job|career|work|offer|interview|salary|business)\b/.test(text)) {
    return "career";
  }
  if (/\b(move|city|rent|house|home|travel)\b/.test(text)) {
    return "life";
  }
  if (/\b(course|study|learn|degree|school|college)\b/.test(text)) {
    return "learning";
  }
  if (/\b(relationship|friend|family|partner)\b/.test(text)) {
    return "relationship";
  }
  if (/\b(buy|purchase|money|invest)\b/.test(text)) {
    return "money";
  }

  return "life";
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function isDecisionToolName(value: string): value is DecisionToolName {
  return value === "listDecisionSimulations" || value === "saveDecisionSimulation";
}
