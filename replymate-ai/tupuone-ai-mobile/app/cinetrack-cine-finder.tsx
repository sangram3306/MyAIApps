import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Markdown from "react-native-markdown-display";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { listWatchItemsFromApi, searchWatchEntriesFromApi, sendChatMessageFromApi } from "../services/api";
import { getAlwaysUseLlmChatPreference, getBackendUrl, getLibraryAwareChatPreference, getRagEnabledPreference, getSmartContextEnabledPreference } from "../storage/appStorage";
import type { WatchEntry } from "../services/api";

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CinetrackCineFinderScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const [backendUrl, setBackendUrl] = useState("");
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [libraryAware, setLibraryAware] = useState(true);
  const [alwaysUseLlm, setAlwaysUseLlm] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [smartContextEnabled, setSmartContextEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState("");
  const [chatInput, setChatInput] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setError("");
        try {
          const url = await getBackendUrl();
          const [watchResult, libAware, alwaysLlm, rag, smartCtx] = await Promise.all([
            listWatchItemsFromApi({ backendUrl: url }),
            getLibraryAwareChatPreference(),
            getAlwaysUseLlmChatPreference(),
            getRagEnabledPreference(),
            getSmartContextEnabledPreference(),
          ]);
          if (!active) return;
          setBackendUrl(url);
          setEntries(watchResult.entries);
          setLibraryAware(libAware);
          setAlwaysUseLlm(alwaysLlm);
          setRagEnabled(rag);
          setSmartContextEnabled(smartCtx);
        } catch (caught) {
          if (!active) return;
          setError(caught instanceof Error ? caught.message : "Could not load Cine Finder AI data.");
        }
      }
      void load();
      return () => {
        active = false;
      };
    }, []),
  );

  const statusText = `${entries.length} titles • Library-aware ${libraryAware ? (ragEnabled ? "RAG" : smartContextEnabled ? "Smart" : alwaysUseLlm ? "LLM" : "Standard") : "OFF"}`;

  async function askAgent(question: string) {
    const prompt = question.trim();
    if (!prompt) {
      setError("Type a question first.");
      return;
    }
    let resolvedUrl = backendUrl;
    if (!resolvedUrl) {
      try {
        resolvedUrl = await getBackendUrl();
        setBackendUrl(resolvedUrl);
      } catch {
        setError("Backend URL not available.");
        return;
      }
    }

    setLoading(true);
    setError("");
    setResponse("");

    try {
      let primaryMessage = `Answer this movie/watch question with practical suggestions:\n${prompt}`;

      if (alwaysUseLlm && libraryAware) {
        const contextBlock = buildContext(entries);
        primaryMessage = `${primaryMessage}\n\n${contextBlock}`;
      } else if (ragEnabled) {
        try {
          const { entries: ragEntries } = await searchWatchEntriesFromApi({ backendUrl: resolvedUrl, query: prompt, limit: 10 });
          if (ragEntries.length > 0) {
            const contextBlock = buildCompactContext(ragEntries);
            primaryMessage = `${primaryMessage}\n\nFound these relevant titles in my library (via RAG vector search):\n${contextBlock}`;
          } else {
            primaryMessage = `${primaryMessage}\n\n(No strictly matching titles found via RAG search in my library)`;
          }
        } catch (ragError) {
          console.error("RAG search failed:", ragError);
          const contextBlock = buildCompactContext(filterEntriesByQuery(prompt, entries));
          primaryMessage = `${primaryMessage}\n\n(RAG failed, falling back to basic search)\nFound these relevant titles in my library:\n${contextBlock}`;
        }
      } else if (smartContextEnabled && libraryAware) {
        const summary = buildTasteSummary(entries);
        const filtered = filterEntriesByQuery(prompt, entries);
        const contextBlock = buildCompactContext(filtered);
        primaryMessage = `${primaryMessage}\n\nMy Taste Profile:\n${summary}\n\nRelevant titles from my library:\n${contextBlock}`;
      } else {
        if (libraryAware) {
          const genreCountResponse = buildLocalGenreCountAnswer(prompt, entries);
          if (genreCountResponse) { setResponse(genreCountResponse); setLoading(false); return; }
          const genreResponse = buildLocalGenreStatsAnswer(prompt, entries);
          if (genreResponse) { setResponse(genreResponse); setLoading(false); return; }
          const imdbResponse = buildLocalImdbFilterAnswer(prompt, entries);
          if (imdbResponse) { setResponse(imdbResponse); setLoading(false); return; }
          const recommendationResponse = buildLocalRecommendationAnswer(prompt, entries);
          if (recommendationResponse) { setResponse(recommendationResponse); setLoading(false); return; }
          const similarityResponse = buildLocalSimilarityAnswer(prompt, entries);
          if (similarityResponse) { setResponse(similarityResponse); setLoading(false); return; }
          const statsResponse = buildLocalStatsAnswer(prompt, entries);
          if (statsResponse) { setResponse(statsResponse); setLoading(false); return; }
          const localResponse = buildLocalAvailabilityAnswer(prompt, entries);
          if (localResponse) { setResponse(localResponse); setLoading(false); return; }
          
          const contextBlock = buildContext(entries);
          primaryMessage = `${primaryMessage}\n\n${contextBlock}`;
        }
      }

      let result;
      try {
        result = await sendChatMessageFromApi({ backendUrl: resolvedUrl, message: primaryMessage });
      } catch (caught) {
        const reason = caught instanceof Error ? caught.message : "";
        if (/invalid request/i.test(reason) || /token limit/i.test(reason) || /context length/i.test(reason)) {
          result = await sendChatMessageFromApi({ backendUrl: resolvedUrl, message: `Answer this movie/watch question with practical suggestions:\n${prompt}` });
        } else {
          throw caught;
        }
      }
      setResponse(result.assistantReply);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete AI request.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.text} size={18} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.heroBadgeRow}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles-outline" color={colors.primary} size={12} />
          <Text style={styles.heroBadgeText}>Cine Finder AI</Text>
        </View>
      </View>

      <Text style={styles.title}>Cine Finder AI</Text>
      <Text style={styles.subtitle}>{statusText}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Universal Assistant</Text>
        <Text style={styles.cardBody}>Ask anything: recommendations, similar titles, streaming availability, or custom movie queries.</Text>

        <TextInput
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Example: What can I watch in IN on Amazon Prime similar to Arrival?"
          placeholderTextColor={colors.muted}
          style={[styles.input, styles.textArea]}
          multiline
        />

        <Pressable
          style={[styles.actionBtn, loading && styles.disabled]}
          disabled={loading}
          onPress={() => void askAgent(chatInput)}
        >
          {loading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.actionText}>Ask Assistant</Text>
          )}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {response ? (
        <View style={styles.responseCard}>
          <Text style={styles.responseTitle}>Agent response</Text>
          <Markdown
            style={{
              body: styles.responseBody,
              paragraph: { marginTop: 0, marginBottom: 8 },
            }}
          >
            {response}
          </Markdown>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── Context builders ─────────────────────────────────────────────────────────

function buildContext(entries: WatchEntry[]): string {
  const detailed = entries.map((entry) => ({
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
    ratings: Array.isArray(entry.ratings) ? entry.ratings : [],
    availability: Array.isArray(entry.availability) ? entry.availability : [],
    externalDetails: Array.isArray(entry.externalDetails) ? entry.externalDetails : [],
    synopsis: entry.synopsis,
    notes: entry.notes,
  }));

  return `My personal watch library (in JSON format):
${JSON.stringify(detailed, null, 2)}

Instructions:
1. Only recommend titles from my library if they actually match the criteria.
2. If the user asks for new suggestions, you can recommend titles NOT in the library.
3. If my library lacks matching titles, say so explicitly, then provide outside suggestions.`;
}

function buildCompactContext(entries: WatchEntry[]): string {
  if (entries.length === 0) return "No matches in my library.";
  const lines = entries.map(e => {
    const genres = Array.isArray(e.externalDetails) 
      ? (e.externalDetails.find(d => String(d.label).toLowerCase() === "genre")?.value || "")
      : "";
    const cast = Array.isArray(e.leadActors) ? e.leadActors.slice(0, 3).join(", ") : "";
    return `- ${e.title} (${e.releaseYear}) | ${e.type} | ${genres} | Dir: ${e.director || "?"} | Cast: ${cast} | Status: ${e.status} ${e.favorite ? "⭐" : ""}`;
  });
  return lines.join("\n");
}

function filterEntriesByQuery(query: string, entries: WatchEntry[]): WatchEntry[] {
  const q = query.toLowerCase();
  const keywords = q.replace(/[^\w\s]/g, "").split(/\s+/).filter(w => w.length >= 3);
  
  if (keywords.length === 0) return entries.slice(0, 15);

  const scored = entries.map(entry => {
    let score = 0;
    const title = (entry.title || "").toLowerCase();
    const director = (entry.director || "").toLowerCase();
    const synopsis = (entry.synopsis || "").toLowerCase();
    const cast = Array.isArray(entry.leadActors) ? entry.leadActors.join(" ").toLowerCase() : "";
    const genres = Array.isArray(entry.externalDetails) 
      ? (entry.externalDetails.find(d => String(d.label).toLowerCase() === "genre")?.value || "").toLowerCase()
      : "";

    for (const kw of keywords) {
      if (title.includes(kw)) score += 10;
      if (director.includes(kw)) score += 5;
      if (cast.includes(kw)) score += 5;
      if (genres.includes(kw)) score += 3;
      if (synopsis.includes(kw)) score += 1;
    }
    if (score > 0) {
      if (entry.favorite) score += 2;
      if (entry.status === "completed") score += 1;
    }
    return { entry, score };
  });

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15)
    .map(x => x.entry);
}

function buildTasteSummary(entries: WatchEntry[]): string {
  if (entries.length === 0) return "No titles in library yet.";
  
  const total = entries.length;
  const completed = entries.filter(e => e.status === "completed").length;
  const favorites = entries.filter(e => e.favorite).length;
  
  const genreCounts: Record<string, number> = {};
  for (const e of entries) {
    if (Array.isArray(e.externalDetails)) {
      const gStr = e.externalDetails.find(d => String(d.label).toLowerCase() === "genre")?.value;
      if (gStr) {
        String(gStr).split(",").map(g => g.trim()).forEach(g => {
          if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
      }
    }
  }
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(x => x[0]);

  return `Library size: ${total} titles (${completed} completed, ${favorites} favorites). Top genres: ${topGenres.join(", ")}.`;
}

// ─── Local fast-path answers ──────────────────────────────────────────────────

function buildLocalAvailabilityAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (!/(what can i watch|watch|available|availability)/.test(lower)) return null;

  const provider = lower.includes("prime") || lower.includes("amazon") ? "prime" : lower.includes("netflix") ? "netflix" : null;
  if (!provider) return null;

  const region = lower.includes("india") || /\bin\b/.test(lower) ? "IN" : null;
  if (!region) return null;

  const matching = entries.filter((e) => {
    if (e.status !== "planned") return false;
    const items = Array.isArray(e.availability) ? e.availability : [];
    return items.some((item) => item.provider.toLowerCase().includes(provider) && String(item.region || "").toUpperCase() === "IN");
  });

  if (!matching.length) return `No planned titles for ${provider} India found.`;
  const lines = matching.slice(0, 8).map(e => `- ${e.title}`);
  return `Here are some ${provider} India titles in your library:\n${lines.join("\n")}`;
}

function buildLocalStatsAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  const asksCount = /(how many|count|total|number of)/.test(lower);
  if (!asksCount) return null;
  return `You have ${entries.length} total titles in your library.`;
}

function buildLocalSimilarityAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (!/(similar|like|titles like|similar to)/.test(lower)) return null;
  return null;
}

function buildLocalRecommendationAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (!/(recommend|suggest|what should i watch|what to watch|top picks)/.test(lower)) return null;

  const countMatch = lower.match(/(\d+)\s+(titles|movies|shows|series|recommendations?)/);
  const targetCount = countMatch ? Math.max(1, Math.min(20, parseInt(countMatch[1], 10))) : 10;
  const typeIntent = extractTypeIntent(lower);
  const ratingConstraint = extractImdbConstraint(lower);
  const statusIntent = extractStatusIntent(lower);

  const normalized = dedupeEntries(entries).map((e) => ({
    ...e,
    ratings: Array.isArray(e.ratings) ? e.ratings : [],
    externalDetails: Array.isArray(e.externalDetails) ? e.externalDetails : [],
  }));

  const favorites = normalized.filter((e) => e.favorite);
  const favoriteGenreSet = new Set(favorites.flatMap((e) => extractGenres(e)).map((g) => g.toLowerCase()));
  const watchedSet = new Set(
    normalized.filter((e) => e.status !== "planned").map((e) => e.title.trim().toLowerCase()),
  );

  const pool = normalized.filter((e) => {
    if (statusIntent !== "any" && e.status !== statusIntent) return false;
    const nt = normalizeType(e.type);
    if (typeIntent === "movie") return nt === "movie";
    if (typeIntent === "series") return nt === "series";
    return true;
  });

  if (!pool.length) return `No titles match your current recommendation filters.`;

  const ranked = pool
    .map((e) => {
      const imdb = entryImdbScore(e);
      if (ratingConstraint && !ratingConstraint.compare(imdb)) return null;
      const genres = extractGenres(e).map((g) => g.toLowerCase());
      const sharedGenres = genres.filter((g) => favoriteGenreSet.has(g)).length;
      const score = sharedGenres * 3 + (e.favorite ? 2 : 0) + (watchedSet.has(e.title.trim().toLowerCase()) ? 0 : 1) + (imdb > 0 ? imdb / 10 : 0);
      return { e, imdb, sharedGenres, score };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score)
    .slice(0, targetCount) as Array<{ e: WatchEntry; imdb: number; sharedGenres: number; score: number }>;

  if (!ranked.length) return `No planned titles match your recommendation filters.`;

  const lines = ranked.map(({ e, imdb, sharedGenres }, i) => {
    const imdbLabel = imdb > 0 ? imdb.toFixed(1) : "NA";
    const reason = sharedGenres > 0
      ? `${sharedGenres} shared favorite genre${sharedGenres > 1 ? "s" : ""}`
      : `status: ${String(e.status || "planned").replace(/_/g, " ")}`;
    return `${i + 1}. ${e.title} (${e.releaseYear || "Unknown"}) • IMDb ${imdbLabel} • ${reason}`;
  });

  const tasteMeta = favoriteGenreSet.size > 0
    ? `${favorites.length} favorites, ${favoriteGenreSet.size} inferred genre signals`
    : `${favorites.length} favorites, genre metadata not available`;

  return `Top ${ranked.length} picks from your planned library (${tasteMeta}):\n${lines.join("\n")}`;
}

function buildLocalImdbFilterAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (!/(imdb|rating)/.test(lower) || !/(more than|greater than|greater|above|>|at least|>=|less than|below|under|<|at most|<=)/.test(lower)) return null;

  const thresholdMatch =
    lower.match(/(?:more than|greater than|greater|above|at least|less than|below|under|at most)\s+(\d+(\.\d+)?)/) ||
    lower.match(/(>=|>|<=|<)\s*(\d+(\.\d+)?)/);
  if (!thresholdMatch) return null;

  const opToken = thresholdMatch[1];
  const valueToken = thresholdMatch[2] ?? thresholdMatch[1];
  const threshold = parseFloat(valueToken);
  if (!isFinite(threshold)) return null;

  const typeIntent = extractTypeIntent(lower);
  const statusIntent = extractStatusIntent(lower);

  const compare = (v: number) => {
    if (lower.includes("at least") || opToken === ">=") return v >= threshold;
    if (lower.includes("at most") || opToken === "<=") return v <= threshold;
    if (lower.includes("greater")) return v > threshold;
    if (lower.includes("less than") || lower.includes("below") || lower.includes("under") || opToken === "<") return v < threshold;
    return v > threshold;
  };

  const scored = dedupeEntries(entries)
    .map((e) => {
      const nt = normalizeType(e.type);
      if (typeIntent === "movie" && nt !== "movie") return null;
      if (typeIntent === "series" && nt !== "series") return null;
      if (statusIntent !== "any" && e.status !== statusIntent) return null;
      const imdb = entryImdbScore(e);
      if (!imdb || !compare(imdb)) return null;
      return { e, imdb };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.imdb || 0) - (a?.imdb || 0))
    .slice(0, 20) as Array<{ e: WatchEntry; imdb: number }>;

  if (!scored.length) return `No titles found matching your IMDb filter.`;

  const lines = scored.map(({ e, imdb }) => `- ${e.title} (${e.releaseYear || "Unknown"}) • IMDb ${imdb.toFixed(1)} • ${e.type}`);
  return `Found ${scored.length} title${scored.length > 1 ? "s" : ""} matching your IMDb filter:\n${lines.join("\n")}`;
}

function buildLocalGenreStatsAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (!/(genre|genres)/.test(lower) || !/(most|top|highest|count|distribution|breakdown|which)/.test(lower)) return null;

  const map = new Map<string, number>();
  for (const entry of entries) {
    for (const genre of extractGenres(entry)) {
      const key = genre.toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
  }
  if (!map.size) return "No genre metadata found in your library yet.";

  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const topCount = lower.includes("top 3") ? 3 : lower.includes("top 5") ? 5 : 1;
  const top = sorted.slice(0, topCount);

  if (topCount === 1) {
    const [genre, count] = top[0];
    return `Most common genre in your library is ${toTitle(genre)} (${count} titles).`;
  }
  const lines = top.map(([genre, count], i) => `${i + 1}. ${toTitle(genre)} (${count})`);
  return `Top ${top.length} genres in your library:\n${lines.join("\n")}`;
}

function buildLocalGenreCountAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  const asksCount = /(how many|count|number of|total|many)/.test(lower);
  const mentionsGenre = /(genre|genres|action|adventure|animation|biography|comedy|crime|documentary|drama|family|fantasy|history|horror|music|musical|mystery|romance|sci[- ]?fi|sport|thriller|war|western)/.test(lower);
  if (!asksCount || !mentionsGenre) return null;

  const typeIntent = extractTypeIntent(lower);
  const requestedGenre = extractRequestedGenre(lower);
  if (!requestedGenre) return null;

  const matched = entries.filter((e) => {
    const nt = normalizeType(e.type);
    if (typeIntent === "movie" && nt !== "movie") return false;
    if (typeIntent === "series" && nt !== "series") return false;
    return extractGenres(e).map((g) => g.toLowerCase()).includes(requestedGenre);
  });

  if (typeIntent === "movie") return `You have ${matched.length} ${toTitle(requestedGenre)} movie${matched.length === 1 ? "" : "s"} in your library.`;
  if (typeIntent === "series") return `You have ${matched.length} ${toTitle(requestedGenre)} series in your library.`;
  return `You have ${matched.length} ${toTitle(requestedGenre)} title${matched.length === 1 ? "" : "s"} in your library.`;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function extractGenres(entry: WatchEntry): string[] {
  const details = Array.isArray(entry.externalDetails) ? entry.externalDetails : [];
  const field = details.find((d) => String(d.label || "").trim().toLowerCase() === "genre");
  if (!field?.value) return [];
  return String(field.value).split(",").map((g) => g.trim()).filter(Boolean);
}

function getImdb(ratings: Array<{ source: string; value: string }>): string {
  const list = Array.isArray(ratings) ? ratings : [];
  const match = list.find((r) => {
    const src = String(r.source || "").trim().toLowerCase();
    return src === "imdb" || src === "internet movie database";
  });
  return match?.value || "unknown";
}

function entryImdbScore(entry: WatchEntry): number {
  const fromRatings = imdbToNumber(getImdb(Array.isArray(entry.ratings) ? entry.ratings : []));
  if (fromRatings > 0) return fromRatings;
  const details = Array.isArray(entry.externalDetails) ? entry.externalDetails : [];
  const field = details.find((d) => String(d.label || "").trim().toLowerCase().includes("imdb"));
  if (!field?.value) return 0;
  return imdbToNumber(field.value);
}

function imdbToNumber(value: string): number {
  const match = value.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) || 0 : 0;
}

function releaseYearGuess(value: string): number {
  const match = String(value || "").match(/(\d{4})/);
  return match ? parseInt(match[1], 10) : NaN;
}

function dedupeEntries(entries: WatchEntry[]): WatchEntry[] {
  const seen = new Set<string>();
  const result: WatchEntry[] = [];
  for (const e of entries) {
    const key = `${String(e.title || "").trim().toLowerCase()}|${String(e.releaseYear || "").trim()}|${normalizeType(e.type)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(e);
  }
  return result;
}

function extractTypeIntent(lower: string): "movie" | "series" | "all" {
  const wantsMovies = /\bmovie\b|\bmovies\b|\bfilm\b|\bfilms\b/.test(lower);
  const wantsSeries = /\bseries\b|\bshow\b|\bshows\b|\btv\b/.test(lower);
  if (wantsMovies && !wantsSeries) return "movie";
  if (wantsSeries && !wantsMovies) return "series";
  return "all";
}

function extractStatusIntent(lower: string): WatchEntry["status"] | "any" {
  if (/\bplanned\b/.test(lower)) return "planned";
  if (/\bstarted\b/.test(lower)) return "started";
  if (/\bin progress\b|\bin_progress\b|\bongoing\b/.test(lower)) return "in_progress";
  if (/\bcompleted\b|\bfinished\b|\bdone\b/.test(lower)) return "completed";
  if (/\bdropped\b|\babandoned\b/.test(lower)) return "dropped";
  return "any";
}

function normalizeType(value: string): "movie" | "series" | "unknown" {
  const v = String(value || "").trim().toLowerCase();
  if (v === "movie" || v === "film") return "movie";
  if (v === "series" || v === "show" || v === "tv") return "series";
  return "unknown";
}

function extractRequestedGenre(lower: string): string | null {
  const known = ["action","adventure","animation","biography","comedy","crime","documentary","drama","family","fantasy","history","horror","music","musical","mystery","romance","sci-fi","sport","thriller","war","western"];
  if (/\bsci[- ]?fi\b/.test(lower)) return "sci-fi";
  for (const genre of known) {
    if (new RegExp(`\\b${genre}\\b`, "i").test(lower)) return genre;
  }
  return null;
}

function extractImdbConstraint(lower: string): { label: string; compare: (v: number) => boolean } | null {
  if (!/(imdb|rating)/.test(lower)) return null;
  const match =
    lower.match(/(?:at least|more than|greater than|greater|above)\s*(\d+(\.\d+)?)/) ||
    lower.match(/(?:at most|less than|below|under)\s*(\d+(\.\d+)?)/) ||
    lower.match(/(>=|>|<=|<)\s*(\d+(\.\d+)?)/) ||
    lower.match(/(\d+(\.\d+)?)\s*\+/);
  if (!match) return null;
  const raw = parseFloat(match[2] || match[1]);
  if (!isFinite(raw)) return null;
  if (match[1] === "<" || match[1] === "<=" || /at most|less than|below|under/.test(lower)) {
    const inclusive = match[1] === "<=" || /at most/.test(lower);
    return { label: `${inclusive ? "<=" : "<"} ${raw}`, compare: (v) => inclusive ? v <= raw : v < raw };
  }
  const inclusive = match[1] === ">=" || /\+/.test(match[0]) || /at least/.test(lower);
  return { label: `${inclusive ? ">=" : ">"} ${raw}`, compare: (v) => inclusive ? v >= raw : v > raw };
}

function toTitle(value: string): string {
  return value.split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ");
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: {
      flexGrow: 1,
      padding: spacing.md,
      gap: spacing.md,
      paddingBottom: spacing.xl,
      paddingTop: Math.max(spacing.sm, topInset),
    },

    topBar: { flexDirection: "row", alignItems: "center" },
    backButton: { flexDirection: "row", alignItems: "center", gap: 2 },
    backText: { color: colors.text, fontWeight: "800", fontSize: 15 },

    heroBadgeRow: { flexDirection: "row" },
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    heroBadgeText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase",
    },

    title: { color: colors.text, fontSize: 30, fontWeight: "900" },
    subtitle: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: -spacing.xs },

    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.md,
      gap: spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    cardBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },

    input: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      color: colors.text,
      fontSize: 14,
      paddingHorizontal: spacing.sm,
      paddingVertical: 10,
    },
    textArea: { minHeight: 90, textAlignVertical: "top" },

    actionBtn: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: spacing.sm,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    actionText: { color: colors.primary, fontSize: 13, fontWeight: "900" },

    suggestionsLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    quickRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    quickChip: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    quickText: { color: colors.muted, fontSize: 11, fontWeight: "800" },

    responseCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: spacing.md,
      gap: spacing.xs,
    },
    responseTitle: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    responseBody: { color: colors.text, fontSize: 13, lineHeight: 20 },

    disabled: { opacity: 0.65 },
    error: {
      color: colors.danger,
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 12,
      padding: spacing.sm,
    },
  });
}
