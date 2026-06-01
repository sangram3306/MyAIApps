import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { listWatchItemsFromApi, sendChatMessageFromApi, WatchEntry } from "../../services/api";
import { getBackendUrl, getLibraryAwareChatPreference } from "../../storage/appStorage";

export default function AiWorkspaceScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [backendUrl, setBackendUrl] = useState("");
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [libraryAware, setLibraryAware] = useState(true);
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
          if (!active) return;
          setBackendUrl(url);
          setEntries(watchResult.entries);
          setLibraryAware(preference);
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

  async function askAgent(prompt: string) {
    if (!backendUrl) {
      setError("Backend URL not available.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await sendChatMessageFromApi({
        backendUrl,
        message: libraryAware ? `${prompt}\n\n${contextBlock}` : prompt,
      });
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
        <Pressable style={styles.actionBtn} disabled={loading} onPress={() => askAgent(`Answer this movie/watch question with practical suggestions:\n${chatInput.trim()}`)}>
          <Text style={styles.actionText}>Ask Assistant</Text>
        </Pressable>
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
  const compactTitles = entries
    .slice(0, 150)
    .map((entry) => {
      const genres = Array.isArray(entry.genres) ? entry.genres.join(", ") : "";
      const ratings = Array.isArray(entry.ratings) ? entry.ratings : [];
      const availabilityItems = Array.isArray(entry.availability) ? entry.availability : [];
      const imdb = getImdb(ratings);
      const availability = availabilityItems
        .slice(0, 4)
        .map((item) => `${item.provider} (${item.region}, ${item.type})`)
        .join("; ");
      return `${entry.title} | ${entry.type} | ${entry.releaseYear} | ${entry.status} | imdb:${imdb} | genres:${genres || "unknown"} | favorite:${Boolean(entry.favorite)} | availability:${availability || "unknown"}`;
    })
    .join("\n");
  return `CineTrack DB Context
Saved titles:
${compactTitles || "none"}

Return concise but practical answers.`;
}

function getImdb(ratings: WatchEntry["ratings"] | Array<{ source: string; value: string }>): string {
  const imdb = ratings.find((item) => item.source.toLowerCase() === "imdb");
  return imdb?.value || "unknown";
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
