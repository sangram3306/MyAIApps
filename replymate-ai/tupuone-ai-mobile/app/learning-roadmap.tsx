import { useCallback, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { MatrixBackground } from "../components/PremiumUI";
import {
  buildLearningRoadmapFromApi,
  deleteLearningRoadmapFromApi,
  getLearningRoadmapHistoryFromApi,
  saveLearningRoadmapFromApi,
  LearningRoadmapResponse,
} from "../services/api";
import { getBackendUrl } from "../storage/appStorage";

export default function LearningRoadmapScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [backendUrl, setBackendUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("learn the fundamentals");
  const [currentLevel, setCurrentLevel] = useState("beginner");
  const [timeline, setTimeline] = useState("8 weeks");
  const [timePerWeek, setTimePerWeek] = useState("3 hours/week");
  const [result, setResult] = useState<LearningRoadmapResponse | null>(null);
  const [historyRoadmaps, setHistoryRoadmaps] = useState<LearningRoadmapResponse["recentRoadmaps"]>([]);
  const [historySource, setHistorySource] = useState<"static" | "llm" | "fallback">("fallback");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const scrollRef = useRef<ScrollView | null>(null);

  const loadHistory = useCallback(async (url: string) => {
    if (!url) {
      return;
    }

    setHistoryLoading(true);
    try {
      const history = await getLearningRoadmapHistoryFromApi({ backendUrl: url });
      setHistoryRoadmaps(history.roadmaps);
      setHistorySource(history.source);
    } catch {
      setHistoryRoadmaps([]);
      setHistorySource("fallback");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getBackendUrl().then((url) => {
        if (active) {
          setBackendUrl(url);
          void loadHistory(url);
        }
      });
      return () => {
        active = false;
      };
    }, [loadHistory]),
  );

  async function handleBuild() {
    if (!backendUrl) {
      setError("Roadmap Builder needs the backend to be online.");
      return;
    }

    if (!topic.trim()) {
      setError("Enter a topic first.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await buildLearningRoadmapFromApi({
        backendUrl,
        topic: topic.trim(),
        goal: goal.trim(),
        currentLevel: currentLevel.trim(),
        timeline: timeline.trim(),
        timePerWeek: timePerWeek.trim(),
      });
      setResult(response);
      await loadHistory(backendUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build this roadmap.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveCurrentRoadmap() {
    if (!backendUrl) {
      setError("Roadmap Builder needs the backend to be online.");
      return;
    }

    if (!result?.roadmap) {
      setError("Generate or open a roadmap first.");
      return;
    }

    setSaveLoading(true);
    setError("");
    try {
      const saved = await saveLearningRoadmapFromApi({
        backendUrl,
        roadmap: result.roadmap,
      });
      setResult((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          saved: saved.saved,
          saveSummary: saved.summary,
          roadmap: saved.roadmap || current.roadmap,
        };
      });
      await loadHistory(backendUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this learning roadmap.");
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleDeleteRoadmap(id: string) {
    if (!backendUrl) {
      setError("Roadmap Builder needs the backend to be online.");
      return;
    }

    setDeletingId(id);
    setError("");
    try {
      await deleteLearningRoadmapFromApi({ backendUrl, id });
      setHistoryRoadmaps((items) => items.filter((item) => item.id !== id));
      setResult((current) => {
        if (!current || current.roadmap.id !== id) {
          return current;
        }
        return null;
      });
      await loadHistory(backendUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this learning roadmap.");
    } finally {
      setDeletingId(null);
    }
  }

  const roadmap = result?.roadmap;
  const planGenerationSource = result?.metadata?.toolSources.planGeneration;
  const isLlmGeneration = planGenerationSource === "llm";
  const isSavedHistoryGeneration = planGenerationSource === "static";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <MatrixBackground density={10} />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
      >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.text} size={18} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons name="map-outline" color={colors.primary} size={16} />
            <Text style={styles.badgeText}>Learning roadmap</Text>
          </View>
          <Text style={styles.title}>Build a path, not a pile</Text>
          <Text style={styles.subtitle}>
            Create a project-first roadmap with phases, checkpoints, practice loops, and next actions.
          </Text>
        </View>

        <View style={styles.card}>
          <Field label="Topic" value={topic} onChangeText={setTopic} placeholder="e.g. Backend development" styles={styles} />
          <Field label="Goal" value={goal} onChangeText={setGoal} placeholder="build APIs confidently" styles={styles} />
          <View style={styles.fieldRow}>
            <Field label="Level" value={currentLevel} onChangeText={setCurrentLevel} placeholder="beginner" styles={styles} />
            <Field label="Timeline" value={timeline} onChangeText={setTimeline} placeholder="8 weeks" styles={styles} />
          </View>
          <Field label="Time per week" value={timePerWeek} onChangeText={setTimePerWeek} placeholder="3 hours/week" styles={styles} />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable disabled={loading} onPress={handleBuild} style={[styles.primaryButton, loading && styles.disabledButton]}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="sparkles-outline" color={colors.onPrimary} size={18} />
                <Text style={styles.primaryButtonText}>Build roadmap</Text>
              </>
            )}
          </Pressable>
        </View>

        {roadmap ? (
          <View style={styles.results}>
            <View style={styles.heroCard}>
              <Text style={styles.kicker}>{result.saved ? "Saved to DB" : "Generated"}</Text>
              <View style={styles.sourcePill}>
                <Ionicons
                  name={isLlmGeneration ? "flash-outline" : isSavedHistoryGeneration ? "archive-outline" : "warning-outline"}
                  color={isLlmGeneration ? colors.primary : isSavedHistoryGeneration ? colors.text : colors.danger}
                  size={14}
                />
                <Text style={styles.sourceText}>
                  {isLlmGeneration
                    ? "Generation source: LLM"
                    : isSavedHistoryGeneration
                      ? "Generation source: Saved history"
                      : "Generation source: Fallback (LLM unavailable/failed)"}
                </Text>
              </View>
              <Text style={styles.resultTitle}>{roadmap.topic}</Text>
              <Text style={styles.bodyText}>{roadmap.overview}</Text>
              {result.saveSummary ? <Text style={styles.saveSummary}>{result.saveSummary}</Text> : null}
              <View style={styles.inlineActions}>
                <Pressable
                  disabled={saveLoading}
                  onPress={handleSaveCurrentRoadmap}
                  style={[styles.secondaryButton, saveLoading && styles.disabledButton]}
                >
                  {saveLoading ? <ActivityIndicator color={colors.text} /> : <Ionicons name="save-outline" color={colors.text} size={16} />}
                  <Text style={styles.secondaryButtonText}>Save this roadmap</Text>
                </Pressable>
              </View>
            </View>

            {roadmap.phases.map((phase) => (
              <View key={phase.title} style={styles.card}>
                <View style={styles.phaseHeader}>
                  <Text style={styles.sectionTitle}>{phase.title}</Text>
                  <Text style={styles.phaseDuration}>{phase.duration}</Text>
                </View>
                <Text style={styles.bodyText}>{phase.outcome}</Text>
                <MiniList title="Lessons" items={phase.lessons} styles={styles} />
                <MiniList title="Projects" items={phase.projects} styles={styles} />
                <MiniList title="Checkpoints" items={phase.checkpoints} styles={styles} />
                <MiniList title="Resources" items={phase.resources} styles={styles} />
              </View>
            ))}

            <ListCard title="Weekly plan" items={roadmap.weeklyPlan} styles={styles} />
            <ListCard title="Practice loop" items={roadmap.practiceLoop} styles={styles} />
            <ListCard title="Pitfalls" items={roadmap.pitfalls} styles={styles} />
            <ListCard title="Success metrics" items={roadmap.successMetrics} styles={styles} />
            <ListCard title="Next actions" items={roadmap.nextActions} styles={styles} />
            <TraceCard toolCalls={result.toolCalls} agentTrace={result.agentTrace} styles={styles} />
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No roadmap yet</Text>
            <Text style={styles.mutedText}>Your learning phases, projects, checkpoints, and weekly plan will appear here.</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Saved roadmaps</Text>
          {historyLoading ? <Text style={styles.mutedText}>Loading history...</Text> : null}
          {!historyLoading && historyRoadmaps.length === 0 ? (
            <Text style={styles.mutedText}>No saved roadmaps yet.</Text>
          ) : null}
          {historyRoadmaps.slice(0, 6).map((savedRoadmap) => (
            <View key={savedRoadmap.id} style={styles.historyItem}>
              <Pressable
                onPress={() => {
                  setResult((current) => {
                    if (!current) {
                      return {
                        assistantReply: `${savedRoadmap.topic} loaded from history.`,
                        roadmap: savedRoadmap,
                        recentRoadmaps: historyRoadmaps,
                        saved: true,
                        saveSummary: "Loaded from saved history.",
                        metadata: { toolSources: { planGeneration: "static" } },
                        toolCalls: [],
                        agentTrace: [],
                      };
                    }

                    return {
                      ...current,
                      roadmap: savedRoadmap,
                      recentRoadmaps: historyRoadmaps,
                      saved: true,
                      saveSummary: "Loaded from saved history.",
                      metadata: { toolSources: { planGeneration: "static" } },
                    };
                  });
                  scrollRef.current?.scrollTo({ y: 0, animated: true });
                }}
                style={styles.historyMainPress}
              >
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle}>{savedRoadmap.topic}</Text>
                  <Text style={styles.historyMeta}>
                    {savedRoadmap.currentLevel} | {savedRoadmap.timeline} | {savedRoadmap.phases.length} phases
                  </Text>
                  <Text style={styles.historyDate}>{formatDate(savedRoadmap.updatedAt || savedRoadmap.createdAt)}</Text>
                </View>
                <Ionicons name="chevron-forward" color={colors.muted} size={16} />
              </Pressable>
              <Pressable
                disabled={deletingId === savedRoadmap.id}
                onPress={() => void handleDeleteRoadmap(savedRoadmap.id)}
                style={[styles.deleteButton, deletingId === savedRoadmap.id && styles.disabledButton]}
              >
                {deletingId === savedRoadmap.id ? (
                  <ActivityIndicator color={colors.danger} size="small" />
                ) : (
                  <Ionicons name="trash-outline" color={colors.danger} size={16} />
                )}
              </Pressable>
            </View>
          ))}
          <Text style={styles.historySource}>History source: {historySource}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={styles.placeholder.color}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function MiniList({ title, items, styles }: { title: string; items: string[]; styles: ReturnType<typeof createStyles> }) {
  if (!items.length) {
    return null;
  }
  return (
    <View style={styles.miniBlock}>
      <Text style={styles.kicker}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.mutedText}>- {item}</Text>
      ))}
    </View>
  );
}

function ListCard({ title, items, styles }: { title: string; items: string[]; styles: ReturnType<typeof createStyles> }) {
  if (!items.length) {
    return null;
  }
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.dot} />
          <Text style={styles.bodyText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function TraceCard({
  toolCalls,
  agentTrace,
  styles,
}: {
  toolCalls: LearningRoadmapResponse["toolCalls"];
  agentTrace: string[];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Agent loop</Text>
      <View style={styles.toolWrap}>
        {toolCalls.map((tool) => (
          <View key={`${tool.name}-${tool.summary}`} style={styles.toolPill}>
            <Text style={styles.toolName}>{tool.name}</Text>
            <Text style={styles.toolSource}>{tool.source}</Text>
          </View>
        ))}
      </View>
      {agentTrace.map((item) => (
        <Text key={item} style={styles.mutedText}>- {item}</Text>
      ))}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    keyboard: { backgroundColor: colors.background, flex: 1 },
    container: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl, paddingTop: Math.max(spacing.md, topInset) },
    placeholder: { color: colors.muted },
    backButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, paddingTop: 0 },
    backText: { color: colors.text, fontSize: 14, fontWeight: "800" },
    hero: { gap: spacing.xs },
    badge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
    },
    badgeText: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
    title: { color: colors.text, fontSize: 34, fontWeight: "900", letterSpacing: -1 },
    subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
    card: { backgroundColor: colors.surfaceGlass, borderColor: colors.primaryBorder, borderRadius: 22, borderWidth: 1, gap: spacing.md, padding: spacing.md, shadowColor: colors.primary, shadowOpacity: 0.04, shadowRadius: 16 },
    heroCard: { backgroundColor: colors.surfaceGlass, borderColor: colors.primaryBorder, borderRadius: 24, borderWidth: 1, gap: spacing.sm, padding: spacing.md, shadowColor: colors.primary, shadowOpacity: 0.05, shadowRadius: 16 },
    sourcePill: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    sourceText: { color: colors.text, fontSize: 11, fontWeight: "700" },
    inlineActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
    field: { flex: 1, gap: spacing.xs },
    fieldRow: { flexDirection: "row", gap: spacing.sm },
    label: { color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
    input: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, flex: 1, fontSize: 14, minHeight: 46, paddingHorizontal: spacing.md },
    primaryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 18, flexDirection: "row", gap: spacing.xs, justifyContent: "center", minHeight: 54 },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      minHeight: 40,
      paddingHorizontal: spacing.sm,
    },
    secondaryButtonText: { color: colors.text, fontSize: 13, fontWeight: "800" },
    disabledButton: { opacity: 0.72 },
    primaryButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "900" },
    error: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderRadius: 16, borderWidth: 1, color: colors.danger, lineHeight: 20, padding: spacing.md },
    results: { gap: spacing.md },
    kicker: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase" },
    resultTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
    saveSummary: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    sectionTitle: { color: colors.text, flex: 1, fontSize: 17, fontWeight: "900" },
    bodyText: { color: colors.text, flex: 1, fontSize: 14, lineHeight: 21 },
    mutedText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    phaseHeader: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
    phaseDuration: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    miniBlock: { backgroundColor: colors.surfaceElevated, borderColor: colors.primaryBorder, borderRadius: 16, borderWidth: 1, gap: 4, padding: spacing.md },
    bulletRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
    dot: { backgroundColor: colors.primary, borderRadius: 999, height: 7, marginTop: 7, width: 7, shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 3 },
    toolWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    toolPill: { backgroundColor: colors.primaryDim, borderColor: colors.primaryBorder, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    toolName: { color: colors.text, fontSize: 11, fontWeight: "900" },
    toolSource: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    emptyCard: { alignItems: "center", backgroundColor: colors.surfaceGlass, borderColor: colors.primaryBorder, borderRadius: 22, borderWidth: 1, gap: spacing.sm, padding: spacing.lg, shadowColor: colors.primary, shadowOpacity: 0.04, shadowRadius: 16 },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
    historyItem: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.sm,
    },
    historyMainPress: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: spacing.sm,
    },
    historyCopy: { flex: 1, gap: 2 },
    historyTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
    historyMeta: { color: colors.muted, fontSize: 12 },
    historyDate: { color: colors.muted, fontSize: 11 },
    historySource: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    deleteButton: {
      alignItems: "center",
      borderColor: colors.danger,
      borderRadius: 10,
      borderWidth: 1,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
  });
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
