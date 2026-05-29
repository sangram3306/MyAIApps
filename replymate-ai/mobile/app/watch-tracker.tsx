import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import {
  deleteWatchItemFromApi,
  listWatchItemsFromApi,
  logWatchItemFromApi,
  updateWatchStatusFromApi,
  WatchEntry,
  WatchStatus,
  WatchType,
} from "../services/api";
import { getBackendUrl } from "../storage/appStorage";

const statusOptions: WatchStatus[] = ["planned", "started", "in_progress", "completed", "dropped"];

export default function WatchTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [backendUrl, setBackendUrl] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<WatchType>("movie");
  const [status, setStatus] = useState<WatchStatus>("planned");
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [source, setSource] = useState<"static" | "llm" | "fallback">("fallback");
  const [enrichmentSource, setEnrichmentSource] = useState<"static" | "llm" | "fallback">("fallback");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadEntries = useCallback(async (url: string) => {
    if (!url) {
      return;
    }
    setLoading(true);
    try {
      const result = await listWatchItemsFromApi({ backendUrl: url });
      setEntries(result.entries);
      setSource(result.source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load watch tracker.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getBackendUrl().then((url) => {
        if (active) {
          setBackendUrl(url);
          void loadEntries(url);
        }
      });
      return () => {
        active = false;
      };
    }, [loadEntries]),
  );

  async function handleAdd() {
    if (!backendUrl) {
      setError("Watch Tracker needs the backend to be online.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a movie or series name first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await logWatchItemFromApi({
        backendUrl,
        title: title.trim(),
        type,
        status,
        notes: notes.trim(),
      });
      setEntries(result.entries);
      setEnrichmentSource(result.metadata.toolSources.enrichment);
      setTitle("");
      setNotes("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this title.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, nextStatus: WatchStatus) {
    if (!backendUrl) {
      return;
    }
    setUpdatingId(id);
    try {
      const result = await updateWatchStatusFromApi({ backendUrl, id, status: nextStatus });
      setEntries(result.entries);
      setSource(result.source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!backendUrl) {
      return;
    }
    setDeletingId(id);
    try {
      const result = await deleteWatchItemFromApi({ backendUrl, id });
      setEntries(result.entries);
      setSource(result.source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this item.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboard}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.text} size={18} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.title}>Watch tracker</Text>
          <Text style={styles.subtitle}>
            Log movies and series, enrich details with AI, and track your status from planned to completed.
          </Text>
          <Text style={styles.metaText}>List source: {source} | Last enrichment: {enrichmentSource}</Text>
        </View>

        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Movie or series name"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
          />
          <View style={styles.row}>
            <Pressable onPress={() => setType("movie")} style={[styles.pill, type === "movie" && styles.pillActive]}>
              <Text style={[styles.pillText, type === "movie" && styles.pillTextActive]}>Movie</Text>
            </Pressable>
            <Pressable onPress={() => setType("series")} style={[styles.pill, type === "series" && styles.pillActive]}>
              <Text style={[styles.pillText, type === "series" && styles.pillTextActive]}>Series</Text>
            </Pressable>
          </View>
          <View style={styles.rowWrap}>
            {statusOptions.map((item) => (
              <Pressable key={item} onPress={() => setStatus(item)} style={[styles.pill, status === item && styles.pillActive]}>
                <Text style={[styles.pillText, status === item && styles.pillTextActive]}>{item.replace("_", " ")}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Optional personal notes"
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={handleAdd} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
            {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryButtonText}>Add & enrich</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Saved titles</Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          {!loading && entries.length === 0 ? <Text style={styles.metaText}>No items yet.</Text> : null}
          {entries.map((entry) => (
            <View key={entry.id} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryTitle}>{entry.title}</Text>
                  <Text style={styles.metaText}>{entry.type} | {entry.releaseYear} | {entry.status.replace("_", " ")}</Text>
                </View>
                <Pressable onPress={() => void handleDelete(entry.id)} style={styles.iconBtn} disabled={deletingId === entry.id}>
                  {deletingId === entry.id ? <ActivityIndicator color={colors.danger} size="small" /> : <Ionicons name="trash-outline" color={colors.danger} size={16} />}
                </Pressable>
              </View>
              <Text style={styles.metaText}>Director: {entry.director}</Text>
              <Text style={styles.metaText}>Lead: {entry.leadActors.join(", ") || "Unknown"}</Text>
              <Text style={styles.metaText}>Budget: {entry.budget} | Box office: {entry.boxOffice}</Text>
              <Text style={styles.metaText}>
                Ratings: {entry.ratings.length ? entry.ratings.map((r) => `${r.source} ${r.value}`).join(" | ") : "Unknown"}
              </Text>
              {entry.synopsis ? <Text style={styles.synopsis}>{entry.synopsis}</Text> : null}
              <View style={styles.rowWrap}>
                {statusOptions.map((item) => (
                  <Pressable
                    key={`${entry.id}-${item}`}
                    onPress={() => void handleStatusChange(entry.id, item)}
                    style={[styles.pillSmall, entry.status === item && styles.pillActive]}
                    disabled={updatingId === entry.id}
                  >
                    <Text style={[styles.pillSmallText, entry.status === item && styles.pillTextActive]}>
                      {item.replace("_", " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    keyboard: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    backButton: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
    backText: { color: colors.text, fontWeight: "800" },
    hero: { gap: spacing.xs },
    title: { color: colors.text, fontSize: 30, fontWeight: "900" },
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    metaText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 18, padding: spacing.md, gap: spacing.sm },
    input: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, minHeight: 44, color: colors.text },
    notesInput: { minHeight: 72, paddingTop: spacing.sm },
    row: { flexDirection: "row", gap: spacing.sm },
    rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    pill: { borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.surfaceElevated },
    pillSmall: { borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.surfaceElevated },
    pillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    pillText: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
    pillSmallText: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
    pillTextActive: { color: colors.primary },
    error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: 12, padding: spacing.sm },
    primaryButton: { backgroundColor: colors.primary, borderRadius: 14, minHeight: 46, alignItems: "center", justifyContent: "center" },
    primaryButtonText: { color: colors.onPrimary, fontWeight: "900" },
    disabled: { opacity: 0.65 },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
    entryCard: { borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.sm, gap: 6, backgroundColor: colors.surfaceElevated },
    entryHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    entryTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    iconBtn: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    synopsis: { color: colors.text, fontSize: 13, lineHeight: 19 },
  });
}

