import { hasConfiguredLlmApiKey, callChatCompletion } from "../services/llmService";
import { listWatchItems, WatchEntry } from "./watchAgent";

type Source = "static" | "llm" | "fallback";

export type CineTrackChatResponse = {
  assistantReply: string;
  intent: string;
  toolCalls: Array<{
    name: string;
    source: Source;
    summary: string;
  }>;
  todos: Array<{
    id: string;
    title: string;
    completed: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  agentTrace: string[];
  metadata: {
    toolsUsed: string[];
    toolSources: {
      classifyIntent: Source;
      todoSkill: Source;
      answerGeneration: Source;
    };
  };
};

export async function handleCineTrackChatMessage(message: string): Promise<CineTrackChatResponse> {
  const trace = ["Received CineTrack chat request"];
  const watchResult = await listWatchItems();
  const entries = watchResult.entries || [];
  trace.push(`Loaded ${entries.length} watch items`);

  if (!hasConfiguredLlmApiKey()) {
    return {
      assistantReply: fallbackCineAnswer(message, entries),
      intent: "cinetrack_chat",
      toolCalls: [
        {
          name: "listWatchEntries",
          source: watchResult.source || "fallback",
          summary: `Loaded ${entries.length} watch items`,
        },
      ],
      todos: [],
      agentTrace: [...trace, "Returned fallback CineTrack response"],
      metadata: {
        toolsUsed: ["listWatchEntries"],
        toolSources: {
          classifyIntent: "static",
          todoSkill: "static",
          answerGeneration: "fallback",
        },
      },
    };
  }

  try {
    const completion = await callChatCompletion({
      temperature: 0.35,
      maxTokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You are CineTrack AI assistant. You ONLY answer movie/series watch-library questions using provided CineTrack context. Never mention todos, tasks, or other tools. If data is missing, say exactly what is missing and ask for one precise follow-up.",
        },
        {
          role: "user",
          content: `User question:\n${message}\n\nCineTrack library context:\n${buildWatchContext(entries)}`,
        },
      ],
    });

    return {
      assistantReply: completion.content.trim(),
      intent: "cinetrack_chat",
      toolCalls: [
        {
          name: "listWatchEntries",
          source: watchResult.source || "fallback",
          summary: `Loaded ${entries.length} watch items`,
        },
      ],
      todos: [],
      agentTrace: [...trace, "Generated CineTrack answer with LLM"],
      metadata: {
        toolsUsed: ["listWatchEntries"],
        toolSources: {
          classifyIntent: "static",
          todoSkill: "static",
          answerGeneration: "llm",
        },
      },
    };
  } catch (error) {
    console.error("[cinetrack] llm fallback", error);
    return {
      assistantReply: fallbackCineAnswer(message, entries),
      intent: "cinetrack_chat",
      toolCalls: [
        {
          name: "listWatchEntries",
          source: watchResult.source || "fallback",
          summary: `Loaded ${entries.length} watch items`,
        },
      ],
      todos: [],
      agentTrace: [...trace, "Fell back to static CineTrack answer"],
      metadata: {
        toolsUsed: ["listWatchEntries"],
        toolSources: {
          classifyIntent: "static",
          todoSkill: "static",
          answerGeneration: "fallback",
        },
      },
    };
  }
}

function buildWatchContext(entries: WatchEntry[]): string {
  const detailedEntries = entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    type: entry.type,
    status: entry.status,
    favorite: Boolean(entry.favorite),
    releaseYear: entry.releaseYear,
    director: entry.director,
    leadActors: Array.isArray(entry.leadActors) ? entry.leadActors : [],
    budget: entry.budget,
    boxOffice: entry.boxOffice,
    posterUrl: entry.posterUrl,
    ratings: Array.isArray(entry.ratings) ? entry.ratings : [],
    availability: Array.isArray(entry.availability) ? entry.availability : [],
    externalDetails: Array.isArray(entry.externalDetails) ? entry.externalDetails : [],
    genres: extractGenres(entry),
    languages: extractLanguages(entry),
    imdb: imdbFromEntry(entry),
    synopsis: entry.synopsis,
    notes: entry.notes,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));

  return JSON.stringify(detailedEntries, null, 2);
}

function imdbFromEntry(entry: WatchEntry): string {
  const rating = (entry.ratings || []).find((item) => {
    const source = String(item.source || "").toLowerCase();
    return source === "imdb" || source === "internet movie database";
  });
  if (rating?.value) {
    return rating.value;
  }
  const detail = (entry.externalDetails || []).find((item) => String(item.label || "").toLowerCase().includes("imdb"));
  return detail?.value || "unknown";
}

function extractGenres(entry: WatchEntry): string[] {
  const detail = (entry.externalDetails || []).find((item) => String(item.label || "").trim().toLowerCase() === "genre");
  if (!detail?.value) {
    return [];
  }
  return detail.value.split(",").map((value) => value.trim()).filter(Boolean);
}

function extractLanguages(entry: WatchEntry): string[] {
  const detail = (entry.externalDetails || []).find((item) => {
    const label = String(item.label || "").trim().toLowerCase();
    return label === "language" || label === "languages" || label === "spoken languages";
  });
  if (!detail?.value) {
    return [];
  }
  return detail.value
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function fallbackCineAnswer(message: string, entries: WatchEntry[]): string {
  const lower = message.toLowerCase();
  if (/(how many|count|total)/.test(lower)) {
    return `You have ${entries.length} titles in your CineTrack library.`;
  }
  return "CineTrack AI is available, but detailed generation is temporarily unavailable. Try a specific question like IMDb filters, top genres, or planned picks.";
}
