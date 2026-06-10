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
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { listWatchItemsFromApi, sendChatMessageFromApi, WatchEntry } from "../services/api";
import { getAlwaysUseLlmChatPreference, getBackendUrl, getLibraryAwareChatPreference } from "../storage/appStorage";

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CinetrackAiWorkspaceScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const [backendUrl, setBackendUrl] = useState("");
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [libraryAware, setLibraryAware] = useState(true);
  const [alwaysUseLlm, setAlwaysUseLlm] = useState(false);
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
          const [watchResult, libAware, alwaysLlm] = await Promise.all([
            listWatchItemsFromApi({ backendUrl: url }),
            getLibraryAwareChatPreference(),
            getAlwaysUseLlmChatPreference(),
          ]);
          if (!active) return;
          setBackendUrl(url);
          setEntries(watchResult.entries);
          setLibraryAware(libAware);
          setAlwaysUseLlm(alwaysLlm);
        } catch (caught) {
          if (!active) return;
          setError(caught instanceof Error ? caught.message : "Could not load AI workspace data.");
        }
      }
      void load();
      return () => {
        active = false;
      };
    }, []),
  );

  const contextBlock = useMemo(() => buildContext(entries), [entries]);
  const favoriteTitles = entries.filter((item) => item.favorite).length;
  const statusText = `${entries.length} titles • ${favoriteTitles} favorites • Library-aware ${libraryAware ? "ON" : "OFF"}`;

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
      // ── Local fast-path answers (skip if alwaysUseLlm is ON) ───────────
      if (libraryAware && !alwaysUseLlm) {
        const genreCountResponse = buildLocalGenreCountAnswer(prompt, entries);
        if (genreCountResponse) { setResponse(genreCountResponse); return; }

        const genreResponse = buildLocalGenreStatsAnswer(prompt, entries);
        if (genreResponse) { setResponse(genreResponse); return; }

        const imdbResponse = buildLocalImdbFilterAnswer(prompt, entries);
        if (imdbResponse) { setResponse(imdbResponse); return; }

        const recommendationResponse = buildLocalRecommendationAnswer(prompt, entries);
        if (recommendationResponse) { setResponse(recommendationResponse); return; }

        const similarityResponse = buildLocalSimilarityAnswer(prompt, entries);
        if (similarityResponse) { setResponse(similarityResponse); return; }

        const statsResponse = buildLocalStatsAnswer(prompt, entries);
        if (statsResponse) { setResponse(statsResponse); return; }

        const localResponse = buildLocalAvailabilityAnswer(prompt, entries);
        if (localResponse) { setResponse(localResponse); return; }
      }

      // ── LLM fallback ────────────────────────────────────────────────────
      const guidedPrompt = `Answer this movie/watch question with practical suggestions:\n${prompt}`;
      const primaryMessage = libraryAware ? `${guidedPrompt}\n\n${contextBlock}` : guidedPrompt;

      let result;
      try {
        result = await sendChatMessageFromApi({ backendUrl: resolvedUrl, message: primaryMessage });
      } catch (caught) {
        const reason = caught instanceof Error ? caught.message : "";
        if (/invalid request/i.test(reason)) {
          result = await sendChatMessageFromApi({ backendUrl: resolvedUrl, message: prompt });
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.text} size={18} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.heroBadgeRow}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles-outline" color={colors.primary} size={12} />
          <Text style={styles.heroBadgeText}>AI Workspace</Text>
        </View>
      </View>

      <Text style={styles.title}>AI Workspace</Text>
      <Text style={styles.subtitle}>
        {statusText}
      </Text>

      {/* Universal Assistant card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Universal Assistant</Text>
        <Text style={styles.cardBody}>
          Ask anything: recommendations, similar titles, streaming availability, or custom movie queries.
        </Text>

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

        <Text style={styles.suggestionsLabel}>Suggestions</Text>
        <View style={styles.quickRow}>
          <Pressable
            style={styles.quickChip}
            onPress={() => setChatInput("What can I watch in Amazon Prime India today based on my taste?")}
          >
            <Text style={styles.quickText}>Prime IN</Text>
          </Pressable>
          <Pressable
            style={styles.quickChip}
            onPress={() => setChatInput("What can I watch in Netflix India today based on my taste?")}
          >
            <Text style={styles.quickText}>Netflix IN</Text>
          </Pressable>
          <Pressable
            style={styles.quickChip}
            onPress={() => setChatInput("Recommend 10 titles based on my favorites and genres.")}
          >
            <Text style={styles.quickText}>Recommend</Text>
          </Pressable>
          <Pressable
            style={styles.quickChip}
            onPress={() => setChatInput("Find titles similar to The Wire from my library and outside.")}
          >
            <Text style={styles.quickText}>Similar</Text>
          </Pressable>
        </View>
      </View>

      {/* States */}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Response */}
      {response ? (
        <View style={styles.responseCard}>
          <Text style={styles.responseTitle}>Agent response</Text>
          <Text style={styles.responseBody}>{response}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ─── Context builder ──────────────────────────────────────────────────────────

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
    languages: getLanguages(entry),
    synopsis: entry.synopsis,
    notes: entry.notes,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));
  return `CineTrack DB Context
Saved titles JSON:
${JSON.stringify(detailed.length ? detailed : [], null, 2)}

Use only this context. If data is missing in context, clearly say it is missing. Return concise but practical answers.`;
}

function getLanguages(entry: WatchEntry): string[] {
  const details = Array.isArray(entry.externalDetails) ? entry.externalDetails : [];
  const field = details.find((d) => {
    const label = String(d.label || "").trim().toLowerCase();
    return label === "language" || label === "languages" || label === "spoken languages";
  });
  if (!field?.value) return [];
  return String(field.value).split(",").map((v) => v.trim()).filter(Boolean);
}

// ─── Local fast-path intelligence ────────────────────────────────────────────

function buildLocalAvailabilityAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (!/(what can i watch|watch|available|availability)/.test(lower)) return null;

  const provider = lower.includes("prime") || lower.includes("amazon")
    ? "prime"
    : lower.includes("netflix")
      ? "netflix"
      : null;
  if (!provider) return null;

  const region = lower.includes("india") || /\bin\b/.test(lower) ? "IN" : null;
  if (!region) return null;

  const favorites = entries.filter((e) => e.favorite);
  const typeIntent = extractTypeIntent(lower);
  const favoriteGenres = new Set(
    favorites.flatMap((e) => extractGenres(e)).map((g) => g.toLowerCase()),
  );

  const matching = entries.filter((e) => {
    const nt = normalizeType(e.type);
    if (typeIntent === "movie" && nt !== "movie") return false;
    if (typeIntent === "series" && nt !== "series") return false;
    if (e.status !== "planned") return false;
    const items = Array.isArray(e.availability) ? e.availability : [];
    return items.some(
      (item) => item.provider.toLowerCase().includes(provider) && String(item.region || "").toUpperCase() === "IN",
    );
  });

  if (!matching.length) {
    return `I could not find planned titles in your library tagged for ${
      provider === "prime" ? "Amazon Prime" : "Netflix"
    } India yet. Add/update availability in Library details and keep status as Planned.`;
  }

  const scored = matching
    .map((e) => {
      const imdb = entryImdbScore(e);
      const genres = extractGenres(e).map((g) => g.toLowerCase());
      const genreScore = genres.some((g) => favoriteGenres.has(g)) ? 1 : 0;
      return { e, imdb, score: (e.favorite ? 1 : 0) * 4 + genreScore * 2 + imdb / 10 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const lines = scored.map(({ e, imdb }) => {
    const imdbLabel = imdb > 0 ? imdb.toFixed(1) : "NA";
    return `- ${e.title} (${e.releaseYear || "Unknown"}) • IMDb ${imdbLabel} • ${e.status.replace(/_/g, " ")}`;
  });

  return `From your library, here are good ${
    provider === "prime" ? "Amazon Prime India" : "Netflix India"
  } picks based on your favorites and genre patterns:\n${lines.join("\n")}`;
}

function buildLocalStatsAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (extractRequestedGenre(lower)) return null;
  const asksCount =
    /(how many|count|total|number of)/.test(lower) &&
    /(movie|movies|series|title|titles|planned|started|in progress|completed|dropped)/.test(lower);
  if (!asksCount) return null;

  const wantsMovies = /\bmovie\b|\bmovies\b/.test(lower);
  const wantsSeries = /\bseries\b/.test(lower);
  const onlyMovies = wantsMovies && !wantsSeries;
  const onlySeries = wantsSeries && !wantsMovies;

  let targetStatus: WatchEntry["status"] | "any" = "any";
  if (/\bplanned\b/.test(lower)) targetStatus = "planned";
  else if (/\bstarted\b/.test(lower)) targetStatus = "started";
  else if (/in progress|in_progress/.test(lower)) targetStatus = "in_progress";
  else if (/\bcompleted\b/.test(lower)) targetStatus = "completed";
  else if (/\bdropped\b/.test(lower)) targetStatus = "dropped";

  const filtered = entries.filter((e) => {
    if (targetStatus !== "any" && e.status !== targetStatus) return false;
    if (onlyMovies && e.type !== "movie") return false;
    if (onlySeries && e.type !== "series") return false;
    return true;
  });

  const movies = filtered.filter((e) => e.type === "movie").length;
  const series = filtered.filter((e) => e.type === "series").length;
  const scopeLabel = targetStatus === "any" ? "all statuses" : `${String(targetStatus).replace("_", " ")} status`;

  if (onlyMovies) return `You have ${movies} movie${movies === 1 ? "" : "s"} in ${scopeLabel}.`;
  if (onlySeries) return `You have ${series} series in ${scopeLabel}.`;
  return `You have ${filtered.length} titles in ${scopeLabel} (${movies} movies, ${series} series).`;
}

function buildLocalSimilarityAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (!/(similar|like|titles like|similar to)/.test(lower)) return null;

  const cleaned = query.trim();
  const quotedMatch = cleaned.match(/["']([^"']+)["']/);
  const toMatch =
    quotedMatch?.[1]?.trim() ||
    cleaned.match(/similar to\s+(.+?)(\s+from|\s+in|\s+and|$)/i)?.[1]?.trim() ||
    cleaned.match(/like\s+(.+?)(\s+from|\s+in|\s+and|$)/i)?.[1]?.trim() ||
    "";
  if (!toMatch) return null;

  const normalized = dedupeEntries(entries).map((e) => ({
    ...e,
    ratings: Array.isArray(e.ratings) ? e.ratings : [],
    externalDetails: Array.isArray(e.externalDetails) ? e.externalDetails : [],
  }));

  const target =
    normalized.find((e) => e.title.toLowerCase() === toMatch.toLowerCase()) ||
    normalized.find((e) => e.title.toLowerCase().includes(toMatch.toLowerCase()));
  if (!target) {
    return `I could not find "${toMatch}" in your library. Try exact title or add it first, then I can suggest close matches.`;
  }

  const targetGenres = new Set(extractGenres(target).map((g) => g.toLowerCase()));
  const targetType = target.type;
  const targetYear = releaseYearGuess(target.releaseYear);

  const matches = normalized
    .filter((e) => e.id !== target.id)
    .map((e) => {
      const sharedGenres = extractGenres(e).filter((g) => targetGenres.has(g.toLowerCase())).length;
      const sameType = e.type === targetType ? 1 : 0;
      const yearGap = Math.abs(releaseYearGuess(e.releaseYear) - targetYear);
      const yearScore = isFinite(yearGap) ? Math.max(0, 1 - yearGap / 15) : 0;
      const imdb = entryImdbScore(e);
      const score = sharedGenres * 3 + sameType * 2 + yearScore + (imdb > 0 ? imdb / 10 : 0) + (e.favorite ? 0.5 : 0);
      return { e, score, sharedGenres };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (!matches.length) return `I found "${target.title}" but could not find strong similar titles in your current library yet.`;

  const lines = matches.map(({ e, sharedGenres }) => {
    const imdb = entryImdbScore(e);
    const imdbLabel = imdb > 0 ? imdb.toFixed(1) : "NA";
    const shared = sharedGenres > 0 ? `${sharedGenres} shared genre${sharedGenres > 1 ? "s" : ""}` : "close type/year match";
    return `- ${e.title} (${e.releaseYear || "Unknown"}) • IMDb ${imdbLabel} • ${shared}`;
  });

  return `Closest matches to "${target.title}" from your library:\n${lines.join("\n")}`;
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
