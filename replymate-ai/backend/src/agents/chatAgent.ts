import { callChatCompletion, hasConfiguredLlmApiKey } from "../services/llmService";

type Source = "static" | "llm" | "fallback";

type AgentEvent = {
  id: string;
  title: string;
  type: "llm" | "tool" | "mcp" | "final";
  request: unknown;
  response: unknown;
};

export type ChatResponse = {
  assistantReply: string;
  intent: "general";
  toolCalls: Array<{
    name: string;
    source: Source;
    summary: string;
  }>;
  agentTrace: string[];
  agentEvents: AgentEvent[];
  metadata: {
    toolsUsed: string[];
    toolSources: Record<string, Source>;
  };
};

export async function handleChatMessage(message: string): Promise<ChatResponse> {
  const trimmedMessage = message.trim();
  const trace = ["Received chat message", "Routed to direct LLM chat"];

  if (!hasConfiguredLlmApiKey()) {
    return buildResponse({
      assistantReply:
        "SP ONE AI is ready to chat, but the selected LLM provider is not configured on the backend yet.",
      trace: [...trace, "Returned configuration fallback"],
      source: "fallback",
      agentEvents: [],
    });
  }

  const requestBody = {
    temperature: 0.55,
    max_tokens: 900,
    messages: [
      {
        role: "system" as const,
        content:
          "You are SP ONE AI, a helpful general-purpose assistant. Answer the user's message directly and naturally. Do not claim access to app data or tools from this chat. If the user asks to modify app data, explain briefly that this chat can answer generally but cannot perform that action.",
      },
      {
        role: "user" as const,
        content: trimmedMessage,
      },
    ],
  };

  try {
    const completion = await callChatCompletion({
      temperature: requestBody.temperature,
      maxTokens: requestBody.max_tokens,
      messages: requestBody.messages,
    });

    const agentEvents: AgentEvent[] = [
      {
        id: "llm-1",
        title: "Direct LLM chat",
        type: "llm",
        request: {
          url: `${completion.baseUrl.replace(/\/$/, "")}/chat/completions`,
          method: "POST",
          body: {
            ...requestBody,
            model: completion.model,
          },
          note: "Authorization header is intentionally hidden.",
        },
        response: {
          provider: completion.provider,
          model: completion.model,
          assistantReply: completion.content.trim(),
        },
      },
      {
        id: "final-1",
        title: "Returned LLM answer",
        type: "final",
        request: {
          userMessage: trimmedMessage,
        },
        response: {
          assistantReply: completion.content.trim(),
        },
      },
    ];

    return buildResponse({
      assistantReply: completion.content.trim(),
      trace: [...trace, "Generated direct LLM response"],
      source: "llm",
      agentEvents,
    });
  } catch (error) {
    console.error("[chat] direct LLM fallback", error);
    return buildResponse({
      assistantReply:
        "I could not reach the selected AI provider right now. Please try again in a moment.",
      trace: [...trace, "Returned provider error fallback"],
      source: "fallback",
      agentEvents: [],
    });
  }
}

function buildResponse({
  assistantReply,
  trace,
  source,
  agentEvents,
}: {
  assistantReply: string;
  trace: string[];
  source: Source;
  agentEvents: AgentEvent[];
}): ChatResponse {
  return {
    assistantReply,
    intent: "general",
    toolCalls: [],
    agentTrace: [...trace, "Returned response"],
    agentEvents,
    metadata: {
      toolsUsed: [source === "llm" ? "directLlmChat" : "directChatFallback"],
      toolSources: {
        answerGeneration: source,
      },
    },
  };
}
