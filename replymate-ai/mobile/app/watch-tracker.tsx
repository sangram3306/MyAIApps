import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
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
const statusFilters: Array<"all" | WatchStatus> = ["all", ...statusOptions];
const typeFilters: Array<"all" | WatchType> = ["all", "movie", "series"];

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
  const [selectedEntry, setSelectedEntry] = useState<WatchEntry | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<"all" | WatchType>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | WatchStatus>("all");

  const typeScopedEntries = entries.filter(
    (entry) => activeTypeFilter === "all" || entry.type === activeTypeFilter,
  );
  const filteredEntries = typeScopedEntries.filter(
    (entry) => activeFilter === "all" || entry.status === activeFilter,
  );

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
          <View style={styles.heroBadge}>
            <Ionicons name="film-outline" color={colors.primary} size={14} />
            <Text style={styles.heroBadgeText}>Cine tracker</Text>
          </View>
          <Text style={styles.title}>Watch tracker</Text>
          <Text style={styles.subtitle}>
            Log movies and series, enrich details with AI, and track your status from planned to completed.
          </Text>
          <View style={styles.heroMetrics}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Saved</Text>
              <Text style={styles.metricValue}>{entries.length}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>List</Text>
              <Text style={styles.metricValue}>{source}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Enrichment</Text>
              <Text style={styles.metricValue}>{formatWatchSource(enrichmentSource)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.inputSectionTitle}>Add title</Text>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved titles</Text>
            <Text style={styles.sectionCount}>{filteredEntries.length}</Text>
          </View>
          <View style={styles.typeTabsRow}>
            {typeFilters.map((item) => (
              <Pressable
                key={item}
                onPress={() => setActiveTypeFilter(item)}
                style={[styles.typeTab, activeTypeFilter === item && styles.typeTabActive]}
              >
                <Text style={[styles.typeTabText, activeTypeFilter === item && styles.typeTabTextActive]}>
                  {item === "all" ? "All" : item === "movie" ? "Movies" : "Series"}
                </Text>
                <Text style={[styles.typeTabCount, activeTypeFilter === item && styles.typeTabTextActive]}>
                  {item === "all" ? entries.length : entries.filter((entry) => entry.type === item).length}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.savedLayout}>
            <ScrollView
              style={styles.savedListPane}
              contentContainerStyle={styles.savedListContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {loading ? <ActivityIndicator color={colors.primary} /> : null}
              {!loading && entries.length === 0 ? <Text style={styles.metaText}>No items yet.</Text> : null}
              {!loading && entries.length > 0 && typeScopedEntries.length === 0 ? (
                <Text style={styles.metaText}>No {activeTypeFilter === "movie" ? "movies" : "series"} yet.</Text>
              ) : null}
              {!loading && typeScopedEntries.length > 0 && filteredEntries.length === 0 ? (
                <Text style={styles.metaText}>No items in this status for selected type.</Text>
              ) : null}
              {filteredEntries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <PosterThumb entry={entry} styles={styles} />
                    <Pressable style={{ flex: 1 }} onPress={() => setSelectedEntry(entry)}>
                      <Text style={styles.entryTitle}>{entry.title}</Text>
                      <View style={styles.entryMetaRow}>
                        <View style={styles.typePill}>
                          <Text style={styles.typePillText}>{entry.type}</Text>
                        </View>
                        <Text style={styles.dotSep}>•</Text>
                        <Text style={styles.metaText}>{entry.releaseYear}</Text>
                        <Text style={styles.dotSep}>•</Text>
                        <View style={[styles.statusPill, statusPillStyle(entry.status, colors)]}>
                          <Text style={styles.statusPillText}>{entry.status.replace("_", " ")}</Text>
                        </View>
                      </View>
                      <Text style={styles.ratingsText}>
                        IMDb: {getImdbRating(entry.ratings)}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.filterRail}>
              {statusFilters.map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[
                    styles.filterRailItem,
                    activeFilter === filter && styles.filterRailItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterRailText,
                      activeFilter === filter && styles.filterRailTextActive,
                    ]}
                  >
                    {filter === "all" ? "All" : shortStatusLabel(filter)}
                  </Text>
                  <Text
                    style={[
                      styles.filterRailCount,
                      activeFilter === filter && styles.filterRailTextActive,
                    ]}
                  >
                    {filter === "all"
                      ? typeScopedEntries.length
                      : typeScopedEntries.filter((entry) => entry.status === filter).length}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(selectedEntry)}
        onRequestClose={() => setSelectedEntry(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setSelectedEntry(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selectedEntry ? (
              <>
                <View style={styles.modalPosterWrap}>
                  <PosterLarge entry={selectedEntry} styles={styles} />
                </View>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedEntry.title}</Text>
                  <Pressable onPress={() => setSelectedEntry(null)} style={styles.iconBtn}>
                    <Ionicons name="close-outline" color={colors.text} size={18} />
                  </Pressable>
                </View>
                <Text style={styles.metaText}>
                  {selectedEntry.type} | {selectedEntry.releaseYear}
                </Text>
                <View style={styles.infoRow}>
                  <Ionicons name="videocam-outline" color={colors.muted} size={13} />
                  <Text style={styles.metaText}>Director: {selectedEntry.director}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="people-outline" color={colors.muted} size={13} />
                  <Text style={styles.metaText}>Lead: {selectedEntry.leadActors.join(", ") || "Unknown"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="cash-outline" color={colors.muted} size={13} />
                  <Text style={styles.metaText}>Budget: {selectedEntry.budget} | Box office: {selectedEntry.boxOffice}</Text>
                </View>
                <Text style={styles.ratingsText}>
                  Ratings: {selectedEntry.ratings.length ? selectedEntry.ratings.map((r) => `${r.source} ${r.value}`).join(" | ") : "Unknown"}
                </Text>
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Progress</Text>
                  <View style={styles.rowWrap}>
                    {statusOptions.map((item) => (
                      <Pressable
                        key={`modal-${selectedEntry.id}-${item}`}
                        onPress={async () => {
                          await handleStatusChange(selectedEntry.id, item);
                          setSelectedEntry((current) =>
                            current && current.id === selectedEntry.id
                              ? { ...current, status: item }
                              : current,
                          );
                        }}
                        style={[styles.pillSmall, selectedEntry.status === item && styles.pillActive]}
                        disabled={updatingId === selectedEntry.id}
                      >
                        <Text style={[styles.pillSmallText, selectedEntry.status === item && styles.pillTextActive]}>
                          {item.replace("_", " ")}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {selectedEntry.synopsis ? <Text style={styles.synopsis}>{selectedEntry.synopsis}</Text> : null}
                {selectedEntry.notes ? <Text style={styles.notesText}>Notes: {selectedEntry.notes}</Text> : null}
                <Pressable
                  onPress={async () => {
                    await handleDelete(selectedEntry.id);
                    setSelectedEntry(null);
                  }}
                  style={[styles.deleteActionButton, deletingId === selectedEntry.id && styles.disabled]}
                  disabled={deletingId === selectedEntry.id}
                >
                  {deletingId === selectedEntry.id ? (
                    <ActivityIndicator color={colors.danger} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" color={colors.danger} size={16} />
                      <Text style={styles.deleteActionText}>Delete from tracker</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function PosterThumb({ entry, styles }: { entry: WatchEntry; styles: ReturnType<typeof createStyles> }) {
  if (entry.posterUrl) {
    return <Image source={{ uri: entry.posterUrl }} style={styles.posterThumb} />;
  }
  return (
    <View style={styles.posterFallback}>
      <Text style={styles.posterFallbackText}>{initials(entry.title)}</Text>
    </View>
  );
}

function PosterLarge({ entry, styles }: { entry: WatchEntry; styles: ReturnType<typeof createStyles> }) {
  if (entry.posterUrl) {
    return <Image source={{ uri: entry.posterUrl }} style={styles.posterLarge} />;
  }
  return (
    <View style={styles.posterLargeFallback}>
      <Text style={styles.posterLargeFallbackText}>{initials(entry.title)}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    keyboard: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    backButton: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
    backText: { color: colors.text, fontWeight: "800" },
    hero: { gap: spacing.xs },
    heroBadge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
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
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    metaText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 20,
      padding: spacing.md,
      gap: spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    heroMetrics: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", marginTop: spacing.xs },
    metricPill: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
    metricValue: { color: colors.text, fontSize: 11, fontWeight: "900", textTransform: "capitalize" },
    inputSectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
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
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
    sectionCount: { color: colors.primary, fontSize: 13, fontWeight: "900" },
    typeTabsRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
    typeTab: {
      flex: 1,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      paddingVertical: 8,
      paddingHorizontal: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    typeTabActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    typeTabText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
    },
    typeTabCount: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
    },
    typeTabTextActive: {
      color: colors.primary,
    },
    savedLayout: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
    savedListPane: { flex: 1, height: 347 },
    savedListContent: { gap: spacing.sm, paddingRight: 2 },
    filterRail: {
      width: 74,
      alignSelf: "flex-start",
      justifyContent: "flex-start",
      flexShrink: 0,
      gap: 7,
    },
    filterRailItem: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      height: 52,
      paddingVertical: 6,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      backgroundColor: colors.surfaceElevated,
    },
    filterRailItemActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    filterRailText: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    filterRailCount: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
    },
    filterRailTextActive: {
      color: colors.primary,
    },
    entryCard: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.sm,
      gap: 8,
      backgroundColor: colors.surfaceElevated,
    },
    entryHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    posterThumb: {
      width: 52,
      height: 76,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    posterFallback: {
      width: 52,
      height: 76,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    posterFallbackText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
    },
    entryTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    entryMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" },
    dotSep: { color: colors.muted, fontSize: 12 },
    typePill: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    typePillText: { color: colors.text, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
    },
    statusPillText: { color: colors.text, fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    iconBtn: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
    ratingsText: { color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: "600" },
    synopsis: { color: colors.text, fontSize: 13, lineHeight: 19 },
    notesText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(4,8,14,0.45)",
      justifyContent: "flex-end",
    },
    modalDismiss: { flex: 1 },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderColor: colors.border,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.sm,
      minHeight: "44%",
    },
    modalPosterWrap: { alignItems: "center" },
    posterLarge: {
      width: 120,
      height: 178,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
    },
    posterLargeFallback: {
      width: 120,
      height: 178,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    posterLargeFallbackText: {
      color: colors.primary,
      fontSize: 24,
      fontWeight: "900",
    },
    modalHandle: {
      width: 56,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.borderStrong,
      alignSelf: "center",
      marginBottom: spacing.xs,
    },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
    modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900", flex: 1 },
    modalSection: { gap: spacing.xs, marginTop: spacing.xs },
    modalSectionTitle: { color: colors.text, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
    deleteActionButton: {
      marginTop: spacing.sm,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.xs,
      backgroundColor: colors.dangerSoft,
    },
    deleteActionText: { color: colors.danger, fontSize: 13, fontWeight: "900" },
  });
}

function formatWatchSource(source: "static" | "llm" | "fallback"): string {
  if (source === "static") {
    return "OMDb/Wikipedia MCP";
  }
  if (source === "llm") {
    return "LLM";
  }
  return "Fallback";
}

function getImdbRating(ratings: Array<{ source: string; value: string }>): string {
  const match = ratings.find((item) => {
    const normalized = item.source.trim().toLowerCase();
    return normalized === "imdb" || normalized === "internet movie database";
  });
  return match?.value || "Unknown";
}

function initials(title: string): string {
  const letters = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return letters || "?";
}

function shortStatusLabel(status: WatchStatus): string {
  if (status === "in_progress") {
    return "In prog";
  }
  if (status === "completed") {
    return "Done";
  }
  if (status === "planned") {
    return "Plan";
  }
  if (status === "started") {
    return "Start";
  }
  return "Drop";
}

function statusPillStyle(status: WatchStatus, colors: ReturnType<typeof useAppTheme>["colors"]) {
  if (status === "completed") {
    return { borderColor: colors.primary, backgroundColor: colors.primarySoft };
  }
  if (status === "dropped") {
    return { borderColor: colors.danger, backgroundColor: colors.dangerSoft };
  }
  return { borderColor: colors.border, backgroundColor: colors.surface };
}
