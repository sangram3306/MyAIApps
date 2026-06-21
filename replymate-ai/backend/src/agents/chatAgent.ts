import { safeParseJson } from "../utils/safeJson";
import { callChatCompletion, hasConfiguredLlmApiKey } from "../services/llmService";

type ChatIntent = "general";
type Source = "static" | "llm" | "fallback";

export type ChatResponse = {
  assistantReply: string;
  intent: ChatIntent;
  toolCalls: Array<{
    name: string;
    source: Source;
    summary: string;
  }>;
  agentTrace: string[];
  agentEvents: AgentEvent[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      classifyIntent: Source;
      answerGeneration: Source;
    };
  };
};

type AgentEvent = {
  id: string;
  title: string;
  type: "llm" | "tool" | "mcp" | "final";
  request: unknown;
  response: unknown;
};

type AgentFinal = {
  type: "final";
  assistantReply: string;
};

type AgentAction = AgentFinal;

type AgentMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AgentModelResult = {
  action: AgentAction;
  request: unknown;
  response: unknown;
};

export async function handleChatMessage(message: string): Promise<ChatResponse> {
  if (!hasConfiguredLlmApiKey()) {
    return runStaticFallback(message, "fallback");
  }

  try {
    return await runAgentLoop(message);
  } catch (error) {
    console.error("[chat] agent loop fallback", error);
    return runStaticFallback(message, "fallback");
  }
}

async function runAgentLoop(message: string): Promise<ChatResponse> {
  const trace = ["Checked chat message"];
  const agentEvents: AgentEvent[] = [];
  const messages: AgentMessage[] = [
    {
      role: "system",
      content:
        "You are ReplyMate AI Chat. Return only valid JSON. Do not include private chain-of-thought.",
    },
    {
      role: "user",
      content: JSON.stringify({
        userMessage: message,
        responseSchemas: {
          final: {
            type: "final",
            assistantReply: "string",
          },
        },
      }),
    },
  ];

  const modelResult = await callAgentModel(messages);
  const action = modelResult.action;
  agentEvents.push({
    id: `llm-1`,
    title: "LLM selected next action",
    type: "final",
    request: modelResult.request,
    response: modelResult.response,
  });

  trace.push("Answered directly");
  return buildAgentResponse({
    assistantReply: action.assistantReply,
    intent: "general",
    toolCalls: [],
    trace,
    agentEvents,
    answerSource: "llm",
  });
}

async function callAgentModel(messages: AgentMessage[]): Promise<AgentModelResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const requestBody = {
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: "json_object" as const },
      messages: messages.map((item) => ({
        role: item.role,
        content: item.content,
      })),
    };
    const completion = await callChatCompletion({
      temperature: requestBody.temperature,
      maxTokens: requestBody.max_tokens,
      responseFormat: requestBody.response_format,
      messages: requestBody.messages,
    });
    const content = completion.content;
    const action = parseAgentAction(content);
    if (action) {
      return {
        action,
        request: {
          url: `${completion.baseUrl}/chat/completions`,
          method: "POST",
          body: sanitizeLlmRequestBody({ ...requestBody, model: completion.model }),
          note: "Authorization header is intentionally hidden.",
        },
        response: {
          rawContent: content,
          parsed: action,
        },
      };
    }

    messages.push({
      role: "user",
      content: JSON.stringify({
        type: "format_error",
        instruction: "Return only valid JSON matching the final schema.",
      }),
    });
  }

  throw new Error("Agent model returned invalid JSON.");
}

function parseAgentAction(content: string | undefined): AgentAction | null {
  const parsed = safeParseJson<AgentAction>(content || "");
  if (parsed && parsed.type === "final" && typeof parsed.assistantReply === "string") {
    return parsed;
  }
  return null;
}

function buildAgentResponse({
  assistantReply,
  intent,
  toolCalls,
  trace,
  agentEvents,
  answerSource,
}: {
  assistantReply: string;
  intent: ChatIntent;
  toolCalls: ChatResponse["toolCalls"];
  trace: string[];
  agentEvents: AgentEvent[];
  answerSource: Source;
}): ChatResponse {
  return {
    assistantReply,
    intent,
    toolCalls,
    agentTrace: trace,
    agentEvents,
    metadata: {
      toolsUsed: [
        "chatAgent",
        answerSource !== "llm" && "fallbackAgent",
        ...toolCalls.map((tool) => tool.name),
      ].filter((val): val is string => Boolean(val)),
      toolSources: {
        classifyIntent: "llm",
        answerGeneration: answerSource,
      },
    },
  };
}

async function runStaticFallback(message: string, source: Source): Promise<ChatResponse> {
  return {
    assistantReply: "I am a simple chat agent now. I answer general questions.",
    intent: "general",
    toolCalls: [],
    agentTrace: ["Checked chat message", "Returned fallback answer"],
    agentEvents: [],
    metadata: {
      toolsUsed: ["fallbackAgent"],
      toolSources: {
        classifyIntent: source,
        answerGeneration: source,
      },
    },
  };
}

function sanitizeLlmRequestBody(requestBody: {
  model?: string;
  messages?: Array<{ content?: string }>;
}) {
  return {
    ...requestBody,
    messages: requestBody.messages?.map((message) => ({
      ...message,
      content:
        typeof message.content === "string" && message.content.length > 500
          ? `${message.content.substring(0, 500)}... (truncated)`
          : message.content,
    })),
  };
}
