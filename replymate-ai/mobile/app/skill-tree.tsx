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
  buildSkillTreeFromApi,
  getSkillTreeHistoryFromApi,
  SkillTreeResponse,
} from "../services/api";
import { getBackendUrl } from "../storage/appStorage";

export default function SkillTreeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [backendUrl, setBackendUrl] = useState("");
  const [skillName, setSkillName] = useState("");
  const [currentLevel, setCurrentLevel] = useState("beginner");
  const [targetLevel, setTargetLevel] = useState("confident");
  const [timeBudget, setTimeBudget] = useState("3 hours/week");
  const [focusAreas, setFocusAreas] = useState("");
  const [result, setResult] = useState<SkillTreeResponse | null>(null);
  const [historyTrees, setHistoryTrees] = useState<SkillTreeResponse["recentSkillTrees"]>([]);
  const [historySource, setHistorySource] = useState<"static" | "llm" | "fallback">("fallback");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async (url: string) => {
    if (!url) {
      return;
    }

    setHistoryLoading(true);
    try {
      const history = await getSkillTreeHistoryFromApi({ backendUrl: url });
      setHistoryTrees(history.skillTrees);
      setHistorySource(history.source);
    } catch {
      setHistoryTrees([]);
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
      setError("Skill Tree needs the backend to be online.");
      return;
    }

    if (!skillName.trim()) {
      setError("Enter a skill first.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const response = await buildSkillTreeFromApi({
        backendUrl,
        skillName: skillName.trim(),
        currentLevel: currentLevel.trim(),
        targetLevel: targetLevel.trim(),
        timeBudget: timeBudget.trim(),
        focusAreas: parseList(focusAreas),
      });
      setResult(response);
      await loadHistory(backendUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build this skill tree.");
    } finally {
      setLoading(false);
    }
  }

  const tree = result?.skillTree;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboard}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.text} size={18} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons name="analytics-outline" color={colors.primary} size={16} />
            <Text style={styles.badgeText}>Personal skill tree</Text>
          </View>
          <Text style={styles.title}>Turn a skill into quests</Text>
          <Text style={styles.subtitle}>
            Build a Mongo-backed skill map with branches, practice nodes, milestones, and weekly quests.
          </Text>
        </View>

        <View style={styles.card}>
          <Field label="Skill" value={skillName} onChangeText={setSkillName} placeholder="e.g. Public speaking" styles={styles} />
          <View style={styles.fieldRow}>
            <Field label="Current level" value={currentLevel} onChangeText={setCurrentLevel} placeholder="beginner" styles={styles} />
            <Field label="Target level" value={targetLevel} onChangeText={setTargetLevel} placeholder="confident" styles={styles} />
          </View>
          <Field label="Time budget" value={timeBudget} onChangeText={setTimeBudget} placeholder="3 hours/week" styles={styles} />
          <Field
            label="Focus areas"
            value={focusAreas}
            onChangeText={setFocusAreas}
            placeholder="Optional: storytelling, confidence, delivery"
            styles={styles}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable disabled={loading} onPress={handleBuild} style={[styles.primaryButton, loading && styles.disabledButton]}>
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="sparkles-outline" color={colors.onPrimary} size={18} />
                <Text style={styles.primaryButtonText}>Build skill tree</Text>
              </>
            )}
          </Pressable>
        </View>

        {tree ? (
          <View style={styles.results}>
            <View style={styles.heroCard}>
              <Text style={styles.kicker}>{result.saved ? "Saved to DB" : "Generated"}</Text>
              <Text style={styles.resultTitle}>{tree.skillName}</Text>
              <Text style={styles.bodyText}>{tree.overview}</Text>
              {result.saveSummary ? <Text style={styles.saveSummary}>{result.saveSummary}</Text> : null}
            </View>

            {tree.branches.map((branch) => (
              <View key={branch.name} style={styles.card}>
                <Text style={styles.sectionTitle}>{branch.name}</Text>
                <Text style={styles.mutedText}>{branch.description}</Text>
                <View style={styles.nodeList}>
                  {branch.nodes.map((node) => (
                    <View key={`${branch.name}-${node.title}`} style={styles.nodeCard}>
                      <View style={styles.nodeHeader}>
                        <Text style={styles.nodeTitle}>{node.title}</Text>
                        <Text style={styles.nodeMeta}>{node.difficulty} | {node.estimatedHours}h</Text>
                      </View>
                      <Text style={styles.bodyText}>{node.whyItMatters}</Text>
                      <Text style={styles.mutedText}>Practice: {node.practice}</Text>
                      <Text style={styles.mutedText}>Proof: {node.proofOfSkill}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            <ListCard title="Weekly quests" items={tree.weeklyQuests} styles={styles} />
            <ListCard title="Milestones" items={tree.milestones} styles={styles} />
            <ListCard title="Routine" items={tree.recommendedRoutine} styles={styles} />
            <TraceCard toolCalls={result.toolCalls} agentTrace={result.agentTrace} styles={styles} />
          </View>
        ) : (
          <EmptyPreview styles={styles} />
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Saved skill trees</Text>
          {historyLoading ? <Text style={styles.mutedText}>Loading history...</Text> : null}
          {!historyLoading && historyTrees.length === 0 ? (
            <Text style={styles.mutedText}>
              No saved skill trees yet. If generation works but nothing appears here, your MongoDB
              connection for learning tools may be unavailable.
            </Text>
          ) : null}
          {historyTrees.slice(0, 6).map((savedTree) => (
            <Pressable
              key={savedTree.id}
              onPress={() => {
                setResult((current) => {
                  if (!current) {
                    return {
                      assistantReply: `${savedTree.skillName} loaded from history.`,
                      skillTree: savedTree,
                      recentSkillTrees: historyTrees,
                      saved: true,
                      toolCalls: [],
                      agentTrace: [],
                    };
                  }

                  return {
                    ...current,
                    skillTree: savedTree,
                    recentSkillTrees: historyTrees,
                    saved: true,
                  };
                });
              }}
              style={styles.historyItem}
            >
              <View style={styles.historyCopy}>
                <Text style={styles.historyTitle}>{savedTree.skillName}</Text>
                <Text style={styles.historyMeta}>
                  {savedTree.currentLevel} to {savedTree.targetLevel} | {savedTree.branches.length} branches
                </Text>
                <Text style={styles.historyDate}>{formatDate(savedTree.updatedAt || savedTree.createdAt)}</Text>
              </View>
              <Ionicons name="chevron-forward" color={colors.muted} size={16} />
            </Pressable>
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
  toolCalls: SkillTreeResponse["toolCalls"];
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

function EmptyPreview({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No skill tree yet</Text>
      <Text style={styles.mutedText}>Your branches, practice nodes, milestones, and proof-of-skill quests will appear here.</Text>
    </View>
  );
}

function parseList(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    keyboard: { backgroundColor: colors.background, flex: 1 },
    container: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
    placeholder: { color: colors.muted },
    backButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, paddingTop: spacing.sm },
    backText: { color: colors.text, fontSize: 14, fontWeight: "800" },
    hero: { gap: spacing.xs },
    badge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    badgeText: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
    title: { color: colors.text, fontSize: 34, fontWeight: "900", letterSpacing: -1 },
    subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: spacing.md, padding: spacing.md },
    heroCard: { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong, borderRadius: 24, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
    field: { gap: spacing.xs },
    fieldRow: { flexDirection: "row", gap: spacing.sm },
    label: { color: colors.primary, fontSize: 12, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
    input: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, flex: 1, fontSize: 14, minHeight: 46, paddingHorizontal: spacing.md },
    primaryButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 18, flexDirection: "row", gap: spacing.xs, justifyContent: "center", minHeight: 54 },
    disabledButton: { opacity: 0.72 },
    primaryButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "900" },
    error: { backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderRadius: 16, borderWidth: 1, color: colors.danger, lineHeight: 20, padding: spacing.md },
    results: { gap: spacing.md },
    kicker: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 0.9, textTransform: "uppercase" },
    resultTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
    saveSummary: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
    bodyText: { color: colors.text, flex: 1, fontSize: 14, lineHeight: 21 },
    mutedText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    nodeList: { gap: spacing.sm },
    nodeCard: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
    nodeHeader: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
    nodeTitle: { color: colors.text, flex: 1, fontSize: 15, fontWeight: "900" },
    nodeMeta: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    bulletRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
    dot: { backgroundColor: colors.primary, borderRadius: 999, height: 7, marginTop: 7, width: 7 },
    toolWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    toolPill: { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    toolName: { color: colors.text, fontSize: 11, fontWeight: "900" },
    toolSource: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    emptyCard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
    historyItem: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.sm,
    },
    historyCopy: {
      flex: 1,
      gap: 2,
    },
    historyTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    historyMeta: {
      color: colors.muted,
      fontSize: 12,
    },
    historyDate: {
      color: colors.muted,
      fontSize: 11,
    },
    historySource: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
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
