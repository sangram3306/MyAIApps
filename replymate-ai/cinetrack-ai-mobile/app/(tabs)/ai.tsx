import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { listWatchItemsFromApi, sendChatMessageFromApi, WatchEntry } from "../../services/api";
import { getAlwaysUseLlmChatPreference, getBackendUrl, getLibraryAwareChatPreference } from "../../storage/appStorage";

export default function AiWorkspaceScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [backendUrl, setBackendUrl] = useState("");
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [libraryAware, setLibraryAware] = useState(true);
  const [alwaysUseLlmChat, setAlwaysUseLlmChat] = useState(false);
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
          const [watchResult, preference] = await Promise.all([
            listWatchItemsFromApi({ backendUrl: url }),
            getLibraryAwareChatPreference(),
          ]);
          const alwaysUseLlm = await getAlwaysUseLlmChatPreference();
          if (!active) return;
          setBackendUrl(url);
          setEntries(watchResult.entries);
          setLibraryAware(preference);
          setAlwaysUseLlmChat(alwaysUseLlm);
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

  async function askAgent(question: string) {
    const prompt = question.trim();
    if (!prompt) {
      setError("Type a question first.");
      return;
    }
    let resolvedBackendUrl = backendUrl;
    if (!resolvedBackendUrl) {
      try {
        resolvedBackendUrl = await getBackendUrl();
        setBackendUrl(resolvedBackendUrl);
      } catch {
        setError("Backend URL not available.");
        return;
      }
    }
    setLoading(true);
    setError("");
    try {
      if (libraryAware && !alwaysUseLlmChat) {
        const genreCountResponse = buildLocalGenreCountAnswer(prompt, entries);
        if (genreCountResponse) {
          setResponse(genreCountResponse);
          return;
        }
        const genreResponse = buildLocalGenreStatsAnswer(prompt, entries);
        if (genreResponse) {
          setResponse(genreResponse);
          return;
        }
        const imdbResponse = buildLocalImdbFilterAnswer(prompt, entries);
        if (imdbResponse) {
          setResponse(imdbResponse);
          return;
        }
        const recommendationResponse = buildLocalRecommendationAnswer(prompt, entries);
        if (recommendationResponse) {
          setResponse(recommendationResponse);
          return;
        }
        const similarityResponse = buildLocalSimilarityAnswer(prompt, entries);
        if (similarityResponse) {
          setResponse(similarityResponse);
          return;
        }
        const statsResponse = buildLocalStatsAnswer(prompt, entries);
        if (statsResponse) {
          setResponse(statsResponse);
          return;
        }
        const localResponse = buildLocalAvailabilityAnswer(prompt, entries);
        if (localResponse) {
          setResponse(localResponse);
          return;
        }
      }
      const guidedPrompt = `Answer this movie/watch question with practical suggestions:\n${prompt}`;
      const primaryMessage = libraryAware ? `${guidedPrompt}\n\n${contextBlock}` : guidedPrompt;
      let result;
      try {
        result = await sendChatMessageFromApi({
          backendUrl: resolvedBackendUrl,
          message: primaryMessage,
        });
      } catch (caught) {
        const reason = caught instanceof Error ? caught.message : "";
        if (libraryAware && /invalid request/i.test(reason)) {
          result = await sendChatMessageFromApi({
            backendUrl: resolvedBackendUrl,
            message: prompt,
          });
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>AI Workspace</Text>
      <Text style={styles.subtitle}>
        {entries.length} titles • {favoriteTitles} favorites • {libraryAware ? "Library-aware ON" : "Library-aware OFF"}
      </Text>
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
        <Pressable style={styles.actionBtn} disabled={loading} onPress={() => askAgent(chatInput)}>
          <Text style={styles.actionText}>Ask Assistant</Text>
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
          <Pressable style={styles.quickChip} onPress={() => setChatInput("Recommend 10 titles based on my favorites and genres.")}>
            <Text style={styles.quickText}>Recommend</Text>
          </Pressable>
          <Pressable style={styles.quickChip} onPress={() => setChatInput("Find titles similar to The Wire from my library and outside.")}>
            <Text style={styles.quickText}>Similar</Text>
          </Pressable>
        </View>
      </View>

      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {response ? (
        <View style={styles.responseCard}>
          <Text style={styles.responseTitle}>Agent response</Text>
          <Text style={styles.responseBody}>{response}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function buildContext(entries: WatchEntry[]): string {
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
    genres: Array.isArray(entry.genres) ? entry.genres : [],
    languages: getLanguages(entry),
    synopsis: entry.synopsis,
    notes: entry.notes,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));
  return `CineTrack DB Context
Saved titles JSON:
${JSON.stringify(detailedEntries.length ? detailedEntries : [], null, 2)}

Use only this context. If data is missing in context, clearly say it is missing. Return concise but practical answers.`;
}

function getImdb(ratings: WatchEntry["ratings"] | Array<{ source: string; value: string }>): string {
  const normalized = Array.isArray(ratings) ? ratings : [];
  const imdb = normalized.find((item) => {
    const source = String(item.source || "").trim().toLowerCase();
    return source === "imdb" || source === "internet movie database";
  });
  return imdb?.value || "unknown";
}

function getLanguages(entry: WatchEntry): string[] {
  const externalDetails = Array.isArray(entry.externalDetails) ? entry.externalDetails : [];
  const languageDetail = externalDetails.find((detail) => {
    const label = String(detail.label || "").trim().toLowerCase();
    return label === "language" || label === "languages" || label === "spoken languages";
  });
  if (!languageDetail?.value) {
    return [];
  }
  return String(languageDetail.value)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildLocalAvailabilityAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  const asksWatch = /(what can i watch|watch|available|availability)/.test(lower);
  if (!asksWatch) {
    return null;
  }

  const provider =
    lower.includes("prime") || lower.includes("amazon")
      ? "prime"
      : lower.includes("netflix")
        ? "netflix"
        : null;
  if (!provider) {
    return null;
  }

  const region = lower.includes("india") || /\bin\b/.test(lower) ? "IN" : null;
  if (!region) {
    return null;
  }

  const favorites = entries.filter((entry) => entry.favorite);
  const typeIntent = extractTypeIntent(lower);
  const favoriteGenres = new Set(
    favorites.flatMap((entry) => (Array.isArray(entry.genres) ? entry.genres : [])).map((genre) => genre.toLowerCase()),
  );

  const matching = entries.filter((entry) => {
    const normalizedType = normalizeType(entry.type);
    if (typeIntent === "movie" && normalizedType !== "movie") {
      return false;
    }
    if (typeIntent === "series" && normalizedType !== "series") {
      return false;
    }
    if (entry.status !== "planned") {
      return false;
    }
    const items = Array.isArray(entry.availability) ? entry.availability : [];
    return items.some((item) => {
      const providerMatch = item.provider.toLowerCase().includes(provider);
      const regionMatch = String(item.region || "").toUpperCase() === "IN";
      return providerMatch && regionMatch;
    });
  });

  if (!matching.length) {
    return `I could not find planned titles in your library tagged for ${
      provider === "prime" ? "Amazon Prime" : "Netflix"
    } India yet. Add/update availability in Library details and keep status as Planned.`;
  }

  const scored = matching
    .map((entry) => {
      const imdb = entryImdbScore(entry);
      const genres = (Array.isArray(entry.genres) ? entry.genres : []).map((genre) => genre.toLowerCase());
      const genreScore = genres.some((genre) => favoriteGenres.has(genre)) ? 1 : 0;
      const favoriteScore = entry.favorite ? 1 : 0;
      return { entry, imdb, score: favoriteScore * 4 + genreScore * 2 + imdb / 10 };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  const lines = scored.map(({ entry, imdb }) => {
    const imdbLabel = imdb > 0 ? imdb.toFixed(1) : "NA";
    const status = String(entry.status || "planned").replace(/_/g, " ");
    return `- ${entry.title} (${entry.releaseYear || "Unknown"}) • IMDb ${imdbLabel} • ${status}`;
  });

  return `From your library, here are good ${
    provider === "prime" ? "Amazon Prime India" : "Netflix India"
  } picks based on your favorites and genre patterns:\n${lines.join("\n")}`;
}

function buildLocalStatsAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (extractRequestedGenre(lower)) {
    return null;
  }
  const asksCount =
    /(how many|count|total|number of)/.test(lower) &&
    /(movie|movies|series|title|titles|planned|started|in progress|completed|dropped)/.test(lower);
  if (!asksCount) {
    return null;
  }

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

  const filtered = entries.filter((entry) => {
    if (targetStatus !== "any" && entry.status !== targetStatus) {
      return false;
    }
    if (onlyMovies && entry.type !== "movie") {
      return false;
    }
    if (onlySeries && entry.type !== "series") {
      return false;
    }
    return true;
  });

  const movies = filtered.filter((entry) => entry.type === "movie").length;
  const series = filtered.filter((entry) => entry.type === "series").length;
  const scopeLabel =
    targetStatus === "any" ? "all statuses" : `${String(targetStatus).replace("_", " ")} status`;

  if (onlyMovies) {
    return `You have ${movies} movie${movies === 1 ? "" : "s"} in ${scopeLabel}.`;
  }
  if (onlySeries) {
    return `You have ${series} series in ${scopeLabel}.`;
  }
  return `You have ${filtered.length} titles in ${scopeLabel} (${movies} movies, ${series} series).`;
}

function buildLocalSimilarityAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (!/(similar|like|titles like|similar to)/.test(lower)) {
    return null;
  }

  const cleaned = query.trim();
  const quotedMatch = cleaned.match(/["']([^"']+)["']/);
  const toMatch = quotedMatch?.[1]?.trim()
    || cleaned.match(/similar to\s+(.+?)(\s+from|\s+in|\s+and|$)/i)?.[1]?.trim()
    || cleaned.match(/like\s+(.+?)(\s+from|\s+in|\s+and|$)/i)?.[1]?.trim()
    || "";
  if (!toMatch) {
    return null;
  }

  const normalizedEntries = dedupeEntries(entries).map((entry) => ({
    ...entry,
    genres: Array.isArray(entry.genres) ? entry.genres : [],
    ratings: Array.isArray(entry.ratings) ? entry.ratings : [],
    externalDetails: Array.isArray(entry.externalDetails) ? entry.externalDetails : [],
  }));

  const target = normalizedEntries.find((entry) => entry.title.toLowerCase() === toMatch.toLowerCase())
    || normalizedEntries.find((entry) => entry.title.toLowerCase().includes(toMatch.toLowerCase()));
  if (!target) {
    return `I could not find "${toMatch}" in your library. Try exact title or add it first, then I can suggest close matches.`;
  }

  const targetGenres = new Set(target.genres.map((genre) => genre.toLowerCase()));
  const targetType = target.type;
  const targetYear = releaseYearGuess(target.releaseYear);

  const matches = normalizedEntries
    .filter((entry) => entry.id !== target.id)
    .map((entry) => {
      const sharedGenres = entry.genres.filter((genre) => targetGenres.has(genre.toLowerCase())).length;
      const sameType = entry.type === targetType ? 1 : 0;
      const yearGap = Math.abs(releaseYearGuess(entry.releaseYear) - targetYear);
      const yearScore = Number.isFinite(yearGap) ? Math.max(0, 1 - yearGap / 15) : 0;
      const imdb = entryImdbScore(entry);
      const imdbScore = imdb > 0 ? imdb / 10 : 0;
      const favoriteScore = entry.favorite ? 0.5 : 0;
      const score = sharedGenres * 3 + sameType * 2 + yearScore + imdbScore + favoriteScore;
      return { entry, score, sharedGenres };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  if (!matches.length) {
    return `I found "${target.title}" but could not find strong similar titles in your current library yet.`;
  }

  const lines = matches.map(({ entry, sharedGenres }) => {
    const imdb = entryImdbScore(entry);
    const imdbLabel = imdb > 0 ? imdb.toFixed(1) : "NA";
    const sharedLabel = sharedGenres > 0 ? `${sharedGenres} shared genre${sharedGenres > 1 ? "s" : ""}` : "close type/year match";
    return `- ${entry.title} (${entry.releaseYear || "Unknown"}) • IMDb ${imdbLabel} • ${sharedLabel}`;
  });

  return `Closest matches to "${target.title}" from your library:\n${lines.join("\n")}`;
}

function buildLocalRecommendationAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  const asksRecommendations = /(recommend|suggest|what should i watch|what to watch|top picks)/.test(lower);
  if (!asksRecommendations) {
    return null;
  }

  const targetCountMatch = lower.match(/(\d+)\s+(titles|movies|shows|series|recommendations?)/);
  const targetCount = targetCountMatch ? Math.max(1, Math.min(20, Number.parseInt(targetCountMatch[1], 10))) : 10;
  const typeIntent = extractTypeIntent(lower);
  const ratingConstraint = extractImdbConstraint(lower);
  const statusIntent = extractStatusIntent(lower);

  const normalizedEntries = dedupeEntries(entries).map((entry) => ({
    ...entry,
    genres: Array.isArray(entry.genres) ? entry.genres : [],
    ratings: Array.isArray(entry.ratings) ? entry.ratings : [],
    externalDetails: Array.isArray(entry.externalDetails) ? entry.externalDetails : [],
  }));

  const favorites = normalizedEntries.filter((entry) => entry.favorite);
  const favoriteGenreSet = new Set(
    favorites.flatMap((entry) => entry.genres.map((genre) => genre.toLowerCase())),
  );
  const watchedSet = new Set(
    normalizedEntries
      .filter((entry) => entry.status !== "planned")
      .map((entry) => entry.title.trim().toLowerCase()),
  );

  const candidatePool = normalizedEntries.filter((entry) => {
    if (statusIntent !== "any" && entry.status !== statusIntent) {
      return false;
    }
    const normalizedType = normalizeType(entry.type);
    if (typeIntent === "movie") {
      return normalizedType === "movie";
    }
    if (typeIntent === "series") {
      return normalizedType === "series";
    }
    return true;
  });
  if (!candidatePool.length) {
    return statusIntent !== "any"
      ? `No titles found with status "${statusIntent.replace("_", " ")}" for your current filters.`
      : "No titles match your current recommendation filters.";
  }

  const ranked = candidatePool
    .map((entry) => {
      const imdb = entryImdbScore(entry);
      if (ratingConstraint && !ratingConstraint.compare(imdb)) {
        return null;
      }
      const genres = entry.genres.map((genre) => genre.toLowerCase());
      const sharedGenres = genres.filter((genre) => favoriteGenreSet.has(genre)).length;
      const favoriteBoost = entry.favorite ? 2 : 0;
      const unseenBoost = watchedSet.has(entry.title.trim().toLowerCase()) ? 0 : 1;
      const score = sharedGenres * 3 + favoriteBoost + unseenBoost + (imdb > 0 ? imdb / 10 : 0);
      return { entry, imdb, sharedGenres, score };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, targetCount) as Array<{ entry: WatchEntry; imdb: number; sharedGenres: number; score: number }>;

  if (!ranked.length) {
    if (ratingConstraint) {
      return `No planned ${typeIntent === "movie" ? "movies" : typeIntent === "series" ? "series" : "titles"} match IMDb ${ratingConstraint.label}.`;
    }
    return "No planned titles match your recommendation filters.";
  }

  const lines = ranked.map(({ entry, imdb, sharedGenres }, index) => {
    const imdbLabel = imdb > 0 ? imdb.toFixed(1) : "NA";
    const reason = sharedGenres > 0
      ? `${sharedGenres} shared favorite genre${sharedGenres > 1 ? "s" : ""}`
      : `status match: ${String(entry.status || "planned").replace(/_/g, " ")}`;
    return `${index + 1}. ${entry.title} (${entry.releaseYear || "Unknown"}) • IMDb ${imdbLabel} • ${reason}`;
  });

  const favoritesUsed = favorites.length;
  const genresUsed = favoriteGenreSet.size;
  const tasteMeta =
    genresUsed > 0
      ? `${favoritesUsed} favorites, ${genresUsed} inferred genre signals`
      : `${favoritesUsed} favorites, genre metadata not available`;
  return `Top ${ranked.length} picks from your planned library based on your taste (${tasteMeta}):\n${lines.join("\n")}`;
}

function buildLocalImdbFilterAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  if (!/(imdb|rating)/.test(lower) || !/(more than|greater than|greater|above|>|at least|>=|less than|below|under|<|at most|<=)/.test(lower)) {
    return null;
  }

  const thresholdMatch =
    lower.match(/(?:more than|greater than|greater|above|at least|less than|below|under|at most)\s+(\d+(\.\d+)?)/)
    || lower.match(/(>=|>|<=|<)\s*(\d+(\.\d+)?)/);
  if (!thresholdMatch) {
    return null;
  }

  const opToken = thresholdMatch[1];
  const valueToken = thresholdMatch[2] ?? thresholdMatch[1];
  const threshold = Number.parseFloat(valueToken);
  if (!Number.isFinite(threshold)) {
    return null;
  }

  const typeIntent = extractTypeIntent(lower);
  const statusIntent = extractStatusIntent(lower);

  const compare = (value: number) => {
    if (lower.includes("at least") || opToken === ">=") return value >= threshold;
    if (lower.includes("at most") || opToken === "<=") return value <= threshold;
    if (lower.includes("greater")) return value > threshold;
    if (lower.includes("less than") || lower.includes("below") || lower.includes("under") || opToken === "<") return value < threshold;
    return value > threshold;
  };

  const scored = dedupeEntries(entries)
    .map((entry) => {
      const normalizedType = normalizeType(entry.type);
      if (typeIntent === "movie" && normalizedType !== "movie") return null;
      if (typeIntent === "series" && normalizedType !== "series") return null;
      if (statusIntent !== "any" && entry.status !== statusIntent) return null;
      const imdb = entryImdbScore(entry);
      if (!imdb || !compare(imdb)) return null;
      return { entry, imdb };
    })
    .filter(Boolean)
    .sort((a, b) => (b?.imdb || 0) - (a?.imdb || 0))
    .slice(0, 20) as Array<{ entry: WatchEntry; imdb: number }>;

  if (!scored.length) {
    return `No titles found matching IMDb ${lower.includes("less than") || lower.includes("below") || lower.includes("under") || opToken === "<" || opToken === "<=" ? "<=" : ">="} ${threshold}.`;
  }

  const lines = scored.map(({ entry, imdb }) => `- ${entry.title} (${entry.releaseYear || "Unknown"}) • IMDb ${imdb.toFixed(1)} • ${entry.type}`);
  return `Found ${scored.length} title${scored.length > 1 ? "s" : ""} matching your IMDb filter:\n${lines.join("\n")}`;
}

function buildLocalGenreStatsAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  const asksGenreStats =
    /(genre|genres)/.test(lower) &&
    /(most|top|highest|count|distribution|breakdown|which)/.test(lower);
  if (!asksGenreStats) {
    return null;
  }

  const map = new Map<string, number>();
  for (const entry of entries) {
    const genres = extractGenres(entry);
    for (const genre of genres) {
      const key = genre.toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
  }

  if (!map.size) {
    return "No genre metadata found in your library yet.";
  }

  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const topCount = lower.includes("top 3") ? 3 : lower.includes("top 5") ? 5 : 1;
  const top = sorted.slice(0, topCount);

  if (topCount === 1) {
    const [genre, count] = top[0];
    return `Most common genre in your library is ${toTitle(genre)} (${count} titles).`;
  }

  const lines = top.map(([genre, count], index) => `${index + 1}. ${toTitle(genre)} (${count})`);
  return `Top ${top.length} genres in your library:\n${lines.join("\n")}`;
}

function buildLocalGenreCountAnswer(query: string, entries: WatchEntry[]): string | null {
  const lower = query.toLowerCase();
  const asksCount = /(how many|count|number of|total|many)/.test(lower);
  const mentionsGenre = /(genre|genres|action|adventure|animation|biography|comedy|crime|documentary|drama|family|fantasy|history|horror|music|musical|mystery|romance|sci[- ]?fi|sport|thriller|war|western)/.test(lower);
  if (!asksCount || !mentionsGenre) {
    return null;
  }

  const typeIntent = extractTypeIntent(lower);
  const requestedGenre = extractRequestedGenre(lower);
  if (!requestedGenre) {
    return null;
  }

  const matched = entries.filter((entry) => {
    const normalizedType = normalizeType(entry.type);
    if (typeIntent === "movie" && normalizedType !== "movie") return false;
    if (typeIntent === "series" && normalizedType !== "series") return false;
    const genres = extractGenres(entry).map((genre) => genre.toLowerCase());
    return genres.includes(requestedGenre);
  });

  if (typeIntent === "movie") {
    return `You have ${matched.length} ${toTitle(requestedGenre)} movie${matched.length === 1 ? "" : "s"} in your library.`;
  }
  if (typeIntent === "series") {
    return `You have ${matched.length} ${toTitle(requestedGenre)} series in your library.`;
  }
  return `You have ${matched.length} ${toTitle(requestedGenre)} title${matched.length === 1 ? "" : "s"} in your library.`;
}

function releaseYearGuess(value: string): number {
  const match = String(value || "").match(/(\d{4})/);
  return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

function imdbToNumber(value: string): number {
  const match = value.match(/(\d+(\.\d+)?)/);
  if (!match) {
    return 0;
  }
  return Number.parseFloat(match[1]) || 0;
}

function entryImdbScore(entry: WatchEntry): number {
  const ratingValue = getImdb(Array.isArray(entry.ratings) ? entry.ratings : []);
  const fromRatings = imdbToNumber(ratingValue);
  if (fromRatings > 0) {
    return fromRatings;
  }

  const details = Array.isArray(entry.externalDetails) ? entry.externalDetails : [];
  const imdbDetail = details.find((detail) => {
    const label = String(detail.label || "").trim().toLowerCase();
    return label.includes("imdb");
  });
  if (!imdbDetail?.value) {
    return 0;
  }
  return imdbToNumber(imdbDetail.value);
}

function extractGenres(entry: WatchEntry): string[] {
  const direct = Array.isArray(entry.genres) ? entry.genres.map((item) => String(item).trim()).filter(Boolean) : [];
  if (direct.length) {
    return direct;
  }
  const details = Array.isArray(entry.externalDetails) ? entry.externalDetails : [];
  const genreField = details.find((item) => String(item.label || "").trim().toLowerCase() === "genre");
  if (!genreField?.value) {
    return [];
  }
  return String(genreField.value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toTitle(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function extractRequestedGenre(lowerQuery: string): string | null {
  const knownGenres = [
    "action",
    "adventure",
    "animation",
    "biography",
    "comedy",
    "crime",
    "documentary",
    "drama",
    "family",
    "fantasy",
    "history",
    "horror",
    "music",
    "musical",
    "mystery",
    "romance",
    "sci-fi",
    "sport",
    "thriller",
    "war",
    "western",
  ];

  if (/\bsci[- ]?fi\b/.test(lowerQuery)) {
    return "sci-fi";
  }

  for (const genre of knownGenres) {
    const pattern = new RegExp(`\\b${genre}\\b`, "i");
    if (pattern.test(lowerQuery)) {
      return genre;
    }
  }
  return null;
}

function extractImdbConstraint(lowerQuery: string): { label: string; compare: (value: number) => boolean } | null {
  if (!/(imdb|rating)/.test(lowerQuery)) {
    return null;
  }
  const match =
    lowerQuery.match(/(?:at least|more than|greater than|greater|above)\s*(\d+(\.\d+)?)/)
    || lowerQuery.match(/(?:at most|less than|below|under)\s*(\d+(\.\d+)?)/)
    || lowerQuery.match(/(>=|>|<=|<)\s*(\d+(\.\d+)?)/)
    || lowerQuery.match(/(\d+(\.\d+)?)\s*\+/);
  if (!match) {
    return null;
  }

  const raw = Number.parseFloat(match[2] || match[1]);
  if (!Number.isFinite(raw)) {
    return null;
  }

  if (match[1] === "<" || match[1] === "<=" || /at most|less than|below|under/.test(lowerQuery)) {
    const inclusive = match[1] === "<=" || /at most/.test(lowerQuery);
    return {
      label: `${inclusive ? "<=" : "<"} ${raw}`,
      compare: (value) => inclusive ? value <= raw : value < raw,
    };
  }

  const inclusive = match[1] === ">=" || /\+/.test(match[0]) || /at least/.test(lowerQuery);
  return {
    label: `${inclusive ? ">=" : ">"} ${raw}`,
    compare: (value) => inclusive ? value >= raw : value > raw,
  };
}

function extractStatusIntent(lowerQuery: string): WatchEntry["status"] | "any" {
  if (/\bplanned\b/.test(lowerQuery)) return "planned";
  if (/\bstarted\b/.test(lowerQuery)) return "started";
  if (/\bin progress\b|\bin_progress\b|\bongoing\b/.test(lowerQuery)) return "in_progress";
  if (/\bcompleted\b|\bfinished\b|\bdone\b/.test(lowerQuery)) return "completed";
  if (/\bdropped\b|\babandoned\b/.test(lowerQuery)) return "dropped";
  return "any";
}

function extractTypeIntent(lowerQuery: string): "movie" | "series" | "all" {
  const wantsMovies = /\bmovie\b|\bmovies\b|\bfilm\b|\bfilms\b/.test(lowerQuery);
  const wantsSeries = /\bseries\b|\bshow\b|\bshows\b|\btv\b/.test(lowerQuery);
  if (wantsMovies && !wantsSeries) {
    return "movie";
  }
  if (wantsSeries && !wantsMovies) {
    return "series";
  }
  return "all";
}

function normalizeType(value: string): "movie" | "series" | "unknown" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "movie" || normalized === "film") {
    return "movie";
  }
  if (normalized === "series" || normalized === "show" || normalized === "tv") {
    return "series";
  }
  return "unknown";
}

function dedupeEntries(entries: WatchEntry[]): WatchEntry[] {
  const seen = new Set<string>();
  const result: WatchEntry[] = [];
  for (const entry of entries) {
    const key = `${String(entry.title || "").trim().toLowerCase()}|${String(entry.releaseYear || "").trim()}|${normalizeType(entry.type)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    container: { flexGrow: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    title: { color: colors.text, fontSize: 30, fontWeight: "900" },
    subtitle: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.md, gap: spacing.sm },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    cardBody: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    input: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: 12, color: colors.text, fontSize: 14, paddingHorizontal: spacing.sm, paddingVertical: 10 },
    textArea: { minHeight: 90, textAlignVertical: "top" },
    actionBtn: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 10, alignItems: "center", justifyContent: "center", flex: 1 },
    actionText: { color: colors.primary, fontSize: 12, fontWeight: "900" },
    suggestionsLabel: { color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
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
    responseCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.md, gap: spacing.xs },
    responseTitle: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    responseBody: { color: colors.text, fontSize: 13, lineHeight: 20 },
    error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: 12, padding: spacing.sm },
  });
}
