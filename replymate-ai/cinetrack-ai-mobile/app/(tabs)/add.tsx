import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import {
  listWatchItemsFromApi,
  logWatchItemFromApi,
  resolveTitleFromApi,
  searchTitleCandidatesFromApi,
  TitleCandidate,
  WatchStatus,
  WatchType,
} from "../../services/api";
import { getBackendUrl } from "../../storage/appStorage";

const statusOptions: WatchStatus[] = ["planned", "started", "in_progress", "completed", "dropped"];

type Step = "search" | "picklist" | "ai_assist" | "confirm" | "add_form";

export default function AddTitleScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  // Unified flow state
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<TitleCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<TitleCandidate | null>(null);

  // AI Assist fields
  const [aiType, setAiType] = useState<WatchType>("movie");
  const [aiYear, setAiYear] = useState("");
  const [aiDirector, setAiDirector] = useState("");
  const [aiHint, setAiHint] = useState("");

  // Add form fields
  const [status, setStatus] = useState<WatchStatus>("planned");
  const [favorite, setFavorite] = useState(false);
  const [notes, setNotes] = useState("");

  // Loading states
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const resetFlow = useCallback(() => {
    setStep("search");
    setQuery("");
    setCandidates([]);
    setSelectedCandidate(null);
    setAiYear("");
    setAiDirector("");
    setAiHint("");
    setStatus("planned");
    setFavorite(false);
    setNotes("");
    setError("");
  }, []);

  async function handleSearch() {
    const q = query.trim();
    if (!q) {
      setError("Enter a movie or series title to search.");
      return;
    }
    setSearching(true);
    setError("");
    try {
      const backendUrl = await getBackendUrl();
      const result = await searchTitleCandidatesFromApi({ backendUrl, query: q });
      if (result.candidates.length === 0) {
        setError("No results found. Try AI Assist for a more precise search.");
        return;
      }
      setCandidates(result.candidates);
      setStep("picklist");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed. Try AI Assist.");
    } finally {
      setSearching(false);
    }
  }

  function handleSelectCandidate(candidate: TitleCandidate) {
    setSelectedCandidate(candidate);
    setStep("add_form");
  }

  async function handleAiResolve() {
    const q = query.trim();
    if (!q) {
      setError("Enter a title first.");
      return;
    }
    setResolving(true);
    setError("");
    try {
      const backendUrl = await getBackendUrl();
      const result = await resolveTitleFromApi({
        backendUrl,
        title: q,
        year: aiYear.trim() || undefined,
        type: aiType,
        director: aiDirector.trim() || undefined,
        hint: aiHint.trim() || undefined,
      });
      if (!result.imdbId || !result.candidate) {
        setError("AI couldn't resolve a unique match. Try the search picklist or add more hints.");
        return;
      }
      setSelectedCandidate(result.candidate);
      setStep("confirm");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI Assist failed. Check your connection.");
    } finally {
      setResolving(false);
    }
  }

  async function handleSave() {
    if (!selectedCandidate) return;
    setSaving(true);
    setError("");
    try {
      const backendUrl = await getBackendUrl();
      const current = await listWatchItemsFromApi({ backendUrl });
      const hasDuplicate = current.entries.some(
        (entry) => normalizeTitle(entry.title) === normalizeTitle(selectedCandidate.title),
      );
      if (hasDuplicate) {
        setError("This title already exists in your library.");
        return;
      }
      await logWatchItemFromApi({
        backendUrl,
        title: selectedCandidate.title,
        imdbId: selectedCandidate.imdbId,
        type: selectedCandidate.type,
        status,
        favorite,
        notes: notes.trim(),
      });
      Alert.alert("Added", `"${selectedCandidate.title}" saved and enriched.`);
      resetFlow();
      router.push("/(tabs)/library" as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this title.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.screenTitle}>Add title</Text>

        {/* ─── STEP 1: SEARCH ─── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Search movie or series</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. Dune, The Fly, Batman…"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={(v) => { setQuery(v); setError(""); }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <Pressable
              style={[styles.searchButton, searching && styles.disabled]}
              onPress={handleSearch}
              disabled={searching}
              accessibilityLabel="Search OMDB"
            >
              {searching
                ? <ActivityIndicator color={colors.onPrimary} size="small" />
                : <Ionicons name="search" color={colors.onPrimary} size={18} />}
            </Pressable>
          </View>

          <Pressable
            style={styles.aiAssistButton}
            onPress={() => {
              if (!query.trim()) {
                setError("Enter a title first, then tap AI Assist.");
                return;
              }
              setError("");
              setStep("ai_assist");
            }}
            accessibilityLabel="Open AI Assist for disambiguation"
          >
            <Ionicons name="sparkles" color={colors.primary} size={14} />
            <Text style={styles.aiAssistText}>AI Assist — narrow by year, director, or type</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {/* ─── SELECTED CANDIDATE PREVIEW ─── */}
        {selectedCandidate && step === "add_form" ? (
          <View style={styles.card}>
            <View style={styles.confirmedHeader}>
              <Ionicons name="checkmark-circle" color={colors.success} size={18} />
              <Text style={styles.confirmedLabel}>Selected title</Text>
              <Pressable onPress={() => { setSelectedCandidate(null); setStep("search"); }} style={styles.changeLink}>
                <Text style={styles.changeLinkText}>Change</Text>
              </Pressable>
            </View>
            <CandidateCard candidate={selectedCandidate} colors={colors} styles={styles} />
          </View>
        ) : null}

        {/* ─── ADD FORM (shown once candidate is chosen) ─── */}
        {step === "add_form" && selectedCandidate ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Progress</Text>
            <View style={styles.pillWrap}>
              {statusOptions.map((item) => (
                <Pressable
                  key={item}
                  style={[styles.pill, status === item && styles.pillActive]}
                  onPress={() => setStatus(item)}
                >
                  <Text style={[styles.pillText, status === item && styles.pillTextActive]}>
                    {item.replace("_", " ")}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Optional personal notes"
              placeholderTextColor={colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            <Pressable
              onPress={() => setFavorite((v) => !v)}
              style={[styles.iconButton, favorite && styles.iconButtonActive]}
              accessibilityLabel={favorite ? "Remove favorite" : "Add favorite"}
            >
              <Ionicons
                name={favorite ? "heart" : "heart-outline"}
                color={favorite ? colors.danger : colors.muted}
                size={18}
              />
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={saving}
              onPress={handleSave}
              style={[styles.primaryButton, saving && styles.disabled]}
            >
              {saving
                ? <ActivityIndicator color={colors.onPrimary} />
                : <Text style={styles.primaryText}>Add &amp; Enrich</Text>}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* ─── PICKLIST MODAL ─── */}
      <Modal
        animationType="slide"
        transparent
        visible={step === "picklist"}
        onRequestClose={() => setStep("search")}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setStep("search")} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select the right title</Text>
            <Text style={styles.modalSubtitle}>Results for "{query}"</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {candidates.map((candidate) => (
                <Pressable
                  key={candidate.imdbId}
                  style={styles.candidateRow}
                  onPress={() => handleSelectCandidate(candidate)}
                >
                  <CandidateCard candidate={candidate} colors={colors} styles={styles} compact />
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.aiAssistButton} onPress={() => { setStep("ai_assist"); }}>
              <Ionicons name="sparkles" color={colors.primary} size={14} />
              <Text style={styles.aiAssistText}>Not here? Try AI Assist</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ─── AI ASSIST MODAL ─── */}
      <Modal
        animationType="slide"
        transparent
        visible={step === "ai_assist" || step === "confirm"}
        onRequestClose={() => setStep("search")}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setStep("search")} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {step === "confirm" && selectedCandidate ? (
              <>
                <View style={styles.confirmedHeader}>
                  <Ionicons name="sparkles" color={colors.primary} size={16} />
                  <Text style={styles.modalTitle}>AI resolved this title</Text>
                </View>
                <CandidateCard candidate={selectedCandidate} colors={colors} styles={styles} />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.confirmButtons}>
                  <Pressable style={styles.outlineButton} onPress={() => setStep("ai_assist")}>
                    <Text style={styles.outlineButtonText}>Try again</Text>
                  </Pressable>
                  <Pressable style={styles.primaryButton} onPress={() => setStep("add_form")}>
                    <Text style={styles.primaryText}>Confirm &amp; continue</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>AI Assist</Text>
                <Text style={styles.modalSubtitle}>
                  Help the AI identify the exact title "{query}"
                </Text>

                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.typeRow}>
                  {(["movie", "series"] as WatchType[]).map((t) => (
                    <Pressable
                      key={t}
                      style={[styles.pill, aiType === t && styles.pillActive]}
                      onPress={() => setAiType(t)}
                    >
                      <Text style={[styles.pillText, aiType === t && styles.pillTextActive]}>
                        {t === "movie" ? "Movie" : "Series"}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Year of release (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 1986"
                  placeholderTextColor={colors.muted}
                  value={aiYear}
                  onChangeText={setAiYear}
                  keyboardType="numeric"
                  maxLength={4}
                />

                <Text style={styles.fieldLabel}>Director (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. David Cronenberg"
                  placeholderTextColor={colors.muted}
                  value={aiDirector}
                  onChangeText={setAiDirector}
                />

                <Text style={styles.fieldLabel}>Extra hint (optional)</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="e.g. remake, animated, sequel, the one with Jeff Goldblum…"
                  placeholderTextColor={colors.muted}
                  value={aiHint}
                  onChangeText={setAiHint}
                  multiline
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  style={[styles.primaryButton, resolving && styles.disabled]}
                  onPress={handleAiResolve}
                  disabled={resolving}
                >
                  {resolving
                    ? <ActivityIndicator color={colors.onPrimary} />
                    : (
                      <View style={styles.aiButtonInner}>
                        <Ionicons name="sparkles" color={colors.onPrimary} size={15} />
                        <Text style={styles.primaryText}>Resolve with AI</Text>
                      </View>
                    )}
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function CandidateCard({
  candidate,
  colors,
  styles,
  compact = false,
}: {
  candidate: TitleCandidate;
  colors: ReturnType<typeof useAppTheme>["colors"];
  styles: ReturnType<typeof createStyles>;
  compact?: boolean;
}) {
  return (
    <View style={compact ? styles.candidateCompact : styles.candidateFull}>
      {candidate.poster ? (
        <Image source={{ uri: candidate.poster }} style={compact ? styles.posterSmall : styles.posterMedium} resizeMode="cover" />
      ) : (
        <View style={[compact ? styles.posterSmall : styles.posterMedium, styles.posterPlaceholder]}>
          <Ionicons name="film-outline" color={colors.muted} size={compact ? 20 : 28} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.candidateTitle} numberOfLines={2}>{candidate.title}</Text>
        <View style={styles.candidateMeta}>
          <View style={[styles.typeBadge, candidate.type === "series" && styles.typeBadgeSeries]}>
            <Text style={styles.typeBadgeText}>{candidate.type}</Text>
          </View>
          <Text style={styles.candidateYear}>{candidate.year}</Text>
          <Text style={styles.candidateImdbId}>{candidate.imdbId}</Text>
        </View>
      </View>
    </View>
  );
}

function normalizeTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      backgroundColor: colors.background,
      padding: spacing.md,
      gap: spacing.md,
      paddingBottom: spacing.xl,
    },
    screenTitle: { color: colors.text, fontSize: 30, fontWeight: "900" },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.md,
      gap: spacing.sm,
    },
    sectionLabel: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    searchRow: { flexDirection: "row", gap: spacing.xs, alignItems: "center" },
    searchInput: {
      flex: 1,
      minHeight: 46,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      color: colors.text,
      paddingHorizontal: spacing.md,
      fontSize: 15,
    },
    searchButton: {
      width: 46,
      height: 46,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    aiAssistButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 6,
    },
    aiAssistText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    input: {
      minHeight: 44,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      color: colors.text,
      paddingHorizontal: spacing.md,
      fontSize: 15,
    },
    notesInput: { minHeight: 80, paddingTop: spacing.sm },
    pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    typeRow: { flexDirection: "row", gap: spacing.xs },
    pill: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      backgroundColor: colors.surfaceElevated,
    },
    pillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    pillText: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
    pillTextActive: { color: colors.primary },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: 999,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    iconButtonActive: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
    primaryButton: {
      minHeight: 46,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    primaryText: { color: colors.onPrimary, fontWeight: "900", fontSize: 15 },
    outlineButton: {
      minHeight: 46,
      borderRadius: 12,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      flex: 1,
    },
    outlineButtonText: { color: colors.text, fontWeight: "700" },
    confirmButtons: { flexDirection: "row", gap: spacing.sm },
    disabled: { opacity: 0.6 },
    error: {
      color: colors.danger,
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 12,
      padding: spacing.sm,
      fontSize: 13,
    },
    confirmedHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    confirmedLabel: { color: colors.success, fontWeight: "700", flex: 1, fontSize: 13 },
    changeLink: { paddingHorizontal: 4 },
    changeLinkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
    fieldLabel: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 2,
    },
    // Modals
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    modalDismiss: { flex: 1 },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.md,
      paddingBottom: 36,
      gap: spacing.sm,
      maxHeight: "90%",
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: spacing.xs,
    },
    modalTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
    modalSubtitle: { color: colors.muted, fontSize: 13 },
    aiButtonInner: { flexDirection: "row", alignItems: "center", gap: 6 },
    // Candidates
    candidateRow: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingVertical: spacing.sm,
    },
    candidateFull: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
    },
    candidateCompact: {
      flexDirection: "row",
      gap: spacing.sm,
      alignItems: "flex-start",
    },
    posterSmall: {
      width: 48,
      height: 68,
      borderRadius: 6,
      backgroundColor: colors.surfaceElevated,
    },
    posterMedium: {
      width: 64,
      height: 92,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
    },
    posterPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
    },
    candidateTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      flexWrap: "wrap",
    },
    candidateMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    typeBadge: {
      backgroundColor: colors.primarySoft,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    typeBadgeSeries: {
      backgroundColor: colors.surfaceElevated,
    },
    typeBadgeText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    candidateYear: { color: colors.muted, fontSize: 13 },
    candidateImdbId: { color: colors.muted, fontSize: 11 },
  });
}
