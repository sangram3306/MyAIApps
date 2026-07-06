import { callChatCompletion, hasConfiguredLlmApiKey } from "../services/llmService";
import {
  getMemories,
  saveMemory,
  deleteMemoryByFact,
  formatMemoriesForPrompt,
} from "../services/memoryService";

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
  suggestedTitle?: string;
  intent: "general";
  toolCalls: Array<{
    name: string;
    source: Source;
    summary: string;
  }>;
  agentTrace: string[];
  agentEvents: AgentEvent[];
  attachments?: Array<{
    filename: string;
    mimeType: string;
    base64: string;
  }>;
  metadata: {
    toolsUsed: string[];
    toolSources: Record<string, Source>;
  };
};

export async function handleChatMessage(
  message: string,
  userId: string,
  history?: { role: "user" | "assistant"; content: string }[],
  userName?: string
): Promise<ChatResponse> {
  const trimmedMessage = message.trim();
  const trace = ["Received chat message", "Routed to direct LLM chat"];

  if (!hasConfiguredLlmApiKey()) {
    return buildResponse({
      assistantReply:
        "Tupu chat is ready to chat, but the selected LLM provider is not configured on the backend yet.",
      trace: [...trace, "Returned configuration fallback"],
      source: "fallback",
      agentEvents: [],
    });
  }

  // ── Load memories from database ──────────────────────────────────────
  let memories: any[] = [];
  try {
    memories = await getMemories(userId);
    trace.push(`Loaded ${memories.length} memories`);
  } catch {
    memories = [];
    trace.push("Failed to load memories, continuing without them");
  }

  const memoryBlock = formatMemoriesForPrompt(memories);

  // ── Build system prompt with injected memories ───────────────────────
  const systemPrompt =
    "You are Tupu chat, a highly capable, general-purpose AI assistant with broad knowledge. " +
    (userName ? `You are talking to ${userName}. ` : "") +
    "Answer the user's message directly and naturally based on your general knowledge. " +
    "If the user asks about live or real-time data (like current weather) that you cannot access, politely explain that you don't have real-time information. " +
    "If the user asks to modify app data, explain briefly that you cannot perform that action. " +
    memoryBlock;

  // ── Only use the last 5 messages for short-term context ──────────────
  const recentHistory = (history || []).slice(-5).map((msg) => ({
    role: msg.role,
    content: msg.content,
  }));

  const requestBody = {
    temperature: 0.55,
    max_tokens: 4096,
    messages: [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      ...recentHistory,
      {
        role: "user" as const,
        content: trimmedMessage,
      },
    ],
  };

  try {
    const tools = [];
    if (process.env.MCP_SERVER_URL) {
      tools.push(
        {
          type: "function" as const,
          function: {
            name: "generatePdfReport",
            description: "Generates a PDF document and returns it. CRITICAL: ONLY use this when the user EXPLICITLY asks for a PDF report or summary. NEVER use this tool if the user is just saying hello or asking a general question.",
            parameters: {
              type: "object",
              properties: {
                markdownData: { type: "string", description: "The markdown string to render into the PDF." },
                recipientEmail: { type: "string", description: "CRITICAL: LEAVE EMPTY unless the user explicitly types 'email it to me' or provides an email. DO NOT proactively send emails." },
                subject: { type: "string", description: "Leave empty unless emailing." },
                bodyText: { type: "string", description: "Leave empty unless emailing." }
              },
              required: ["markdownData"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "generateExcelReport",
            description: "Generates an Excel spreadsheet and returns it. CRITICAL: ONLY use this when the user EXPLICITLY asks for an Excel or spreadsheet report. NEVER use this tool if the user is just saying hello or asking a general question.",
            parameters: {
              type: "object",
              properties: {
                jsonData: { type: "string", description: "A VALID JSON array of objects representing rows and columns. Example: '[{\"Name\":\"Project A\"}]'." },
                recipientEmail: { type: "string", description: "CRITICAL: LEAVE EMPTY unless the user explicitly types 'email it to me' or provides an email. DO NOT proactively send emails." },
                subject: { type: "string", description: "Leave empty unless emailing." },
                bodyText: { type: "string", description: "Leave empty unless emailing." }
              },
              required: ["jsonData"]
            }
          }
        }
      );
    }

    let completion = await callChatCompletion({
      temperature: requestBody.temperature,
      maxTokens: requestBody.max_tokens,
      messages: requestBody.messages,
      tools: tools.length > 0 ? tools : undefined,
    });

    let assistantReply = completion.content;
    let agentEvents: AgentEvent[] = [];
    let responseAttachments: NonNullable<ChatResponse["attachments"]> = [];

    // Handle tool call interception
    if (completion.toolCalls && completion.toolCalls.length > 0) {
      trace.push(`Intercepted tool call: ${completion.toolCalls[0].function.name}`);
      
      const toolCall = completion.toolCalls[0];
      const validTools = ["generatePdfReport", "generateExcelReport"];
      
      if (validTools.includes(toolCall.function.name) && process.env.MCP_SERVER_URL) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          
          if (toolCall.function.name === "generateExcelReport" && typeof args.jsonData === "string") {
            try { args.jsonData = JSON.parse(args.jsonData); } catch (e) { /* ignore */ }
          }

          const mcpResponse = await fetch(`${process.env.MCP_SERVER_URL.replace(/\/$/, "")}/tools/${toolCall.function.name}`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              ...(process.env.MCP_SHARED_SECRET ? { "MCP_SHARED_SECRET": process.env.MCP_SHARED_SECRET } : {})
            },
            body: JSON.stringify(args)
          });
          
          const mcpResult = await mcpResponse.json();
          
          // If the tool returned a file, add it to attachments and remove base64 from the trace
          if (mcpResult.base64) {
            responseAttachments.push({
              filename: mcpResult.filename,
              mimeType: mcpResult.mimeType,
              base64: mcpResult.base64
            });
            trace.push(`MCP tool call returned a file: ${mcpResult.filename}`);
            mcpResult.base64 = "[BASE64_DATA_REMOVED_FOR_LLM]";
          } else {
            trace.push(`MCP tool call returned: ${JSON.stringify(mcpResult)}`);
          }

          // Fetch follow-up completion to summarize the result to the user
          const followupMessages = [
            ...requestBody.messages,
            { role: "assistant" as const, content: `I am executing ${toolCall.function.name}...` },
            { role: "user" as const, content: `System: The tool call completed with result: ${JSON.stringify(mcpResult)}. Please tell the user.` }
          ];

          completion = await callChatCompletion({
            temperature: requestBody.temperature,
            maxTokens: requestBody.max_tokens,
            messages: followupMessages,
          });

          assistantReply = completion.content;
        } catch (err) {
          trace.push(`Failed to execute tool: ${err}`);
          assistantReply = "I tried to generate the report, but encountered an internal error. Please try again later.";
        }
      }
    }

    agentEvents = [
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
          assistantReply: assistantReply.trim(),
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
          assistantReply: assistantReply.trim(),
        },
      },
    ];

    // ── Background: Extract memories from this exchange ──────────────
    extractAndSaveMemories(userId, trimmedMessage, assistantReply.trim()).catch(
      (err) => console.error("[chat] memory extraction failed (non-blocking):", err)
    );
    trace.push("Triggered background memory extraction");

    // ── Generate session title for new conversations ──────────────────
    let suggestedTitle: string | undefined;
    if (!history || history.length === 0) {
      try {
        suggestedTitle = await generateSessionTitle(trimmedMessage, assistantReply.trim());
        trace.push(`Generated session title: "${suggestedTitle}"`);
      } catch (err) {
        console.error("[chat] title generation failed (non-blocking):", err);
      }
    }

    return buildResponse({
      assistantReply: assistantReply.trim(),
      suggestedTitle,
      trace: [...trace, "Generated final response"],
      source: "llm",
      agentEvents,
      attachments: responseAttachments.length > 0 ? responseAttachments : undefined,
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

/**
 * Lightweight background call to the LLM to extract memorable facts from a
 * user↔assistant exchange. Runs non-blocking — failures don't affect the
 * chat response.
 */
async function extractAndSaveMemories(
  userId: string,
  userMessage: string,
  assistantReply: string
): Promise<void> {
  if (!hasConfiguredLlmApiKey()) return;

  const extractionPrompt = `You are a memory extraction system. Analyze the following conversation exchange and extract any facts worth remembering about the user for future conversations.

Rules:
- Only extract concrete, lasting facts (name, preferences, projects, relationships, skills, goals).
- Do NOT extract routine greetings, transient questions (weather, time), or one-off requests.
- If nothing is worth remembering, respond with exactly: []
- Respond ONLY with a JSON array of objects. No markdown, no explanation.
- Each object must have: "action" ("save" or "delete"), "fact" (string), "category" ("preference" | "personal" | "project" | "context")
- Use "delete" when the user corrects or negates a previous fact (e.g., "Actually my name is not John").

User: ${userMessage}
Assistant: ${assistantReply}

Respond with ONLY the JSON array:`;

  try {
    const result = await callChatCompletion({
      temperature: 0.1,
      maxTokens: 400,
      messages: [
        { role: "system", content: "You extract structured facts from conversations. Respond with only valid JSON arrays." },
        { role: "user", content: extractionPrompt },
      ],
    });

    const raw = result.content.trim();
    // Handle "[]" or empty case
    if (raw === "[]" || !raw) {
      return;
    }

    // Parse the JSON — strip markdown fences if the LLM wraps them
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    let actions: Array<{
      action: "save" | "delete";
      fact: string;
      category?: "preference" | "personal" | "project" | "context";
    }>;

    try {
      actions = JSON.parse(cleaned);
    } catch {
      console.warn("[memoryExtraction] Could not parse LLM response as JSON:", cleaned);
      return;
    }

    if (!Array.isArray(actions)) return;

    for (const item of actions) {
      if (!item.fact || typeof item.fact !== "string") continue;

      if (item.action === "delete") {
        await deleteMemoryByFact(userId, item.fact);
      } else {
        await saveMemory(userId, item.fact, item.category || "context", userMessage.slice(0, 60));
      }
    }

    if (actions.length > 0) {
      console.log(`[memoryExtraction] Processed ${actions.length} memory action(s)`);
    }
  } catch (err) {
    // Non-critical — swallow errors
    console.error("[memoryExtraction] LLM call failed:", err);
  }
}

function buildResponse({
  assistantReply,
  suggestedTitle,
  trace,
  source,
  agentEvents,
  attachments,
}: {
  assistantReply: string;
  suggestedTitle?: string;
  trace: string[];
  source: Source;
  agentEvents: AgentEvent[];
  attachments?: ChatResponse["attachments"];
}): ChatResponse {
  return {
    assistantReply,
    ...(suggestedTitle ? { suggestedTitle } : {}),
    intent: "general",
    toolCalls: [],
    agentTrace: [...trace, "Returned response"],
    agentEvents,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
    metadata: {
      toolsUsed: [source === "llm" ? "directLlmChat" : "directChatFallback"],
      toolSources: {
        answerGeneration: source,
      },
    },
  };
}

/**
 * Generate a short descriptive title for a chat session from the first exchange.
 */
async function generateSessionTitle(
  userMessage: string,
  assistantReply: string
): Promise<string> {
  const result = await callChatCompletion({
    temperature: 0.3,
    maxTokens: 30,
    messages: [
      {
        role: "system",
        content:
          "Generate a very short title (3-6 words max) for this chat conversation. " +
          "Return ONLY the title text, no quotes, no punctuation at the end, no explanation.",
      },
      {
        role: "user",
        content: `User: ${userMessage.slice(0, 200)}\nAssistant: ${assistantReply.slice(0, 200)}`,
      },
    ],
  });

  const title = result.content.trim().replace(/^["']|["']$/g, "");
  return title.length > 50 ? title.slice(0, 47) + "..." : title;
}
