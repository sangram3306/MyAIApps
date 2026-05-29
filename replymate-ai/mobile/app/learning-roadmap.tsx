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
import { buildLearningRoadmapFromApi, LearningRoadmapResponse } from "../services/api";
import { getBackendUrl } from "../storage/appStorage";

export default function LearningRoadmapScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [backendUrl, setBackendUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [goal, setGoal] = useState("learn the fundamentals");
  const [currentLevel, setCurrentLevel] = useState("beginner");
  const [timeline, setTimeline] = useState("8 weeks");
  const [timePerWeek, setTimePerWeek] = useState("3 hours/week");
  const [result, setResult] = useState<LearningRoadmapResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getBackendUrl().then((url) => {
        if (active) {
          setBackendUrl(url);
        }
      });
      return () => {
        active = false;
      };
    }, []),
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build this roadmap.");
    } finally {
      setLoading(false);
    }
  }

  const roadmap = result?.roadmap;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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
                  name={result.metadata?.toolSources.planGeneration === "llm" ? "flash-outline" : "warning-outline"}
                  color={result.metadata?.toolSources.planGeneration === "llm" ? colors.primary : colors.danger}
                  size={14}
                />
                <Text style={styles.sourceText}>
                  {result.metadata?.toolSources.planGeneration === "llm"
                    ? "Generation source: LLM"
                    : "Generation source: Fallback (LLM unavailable/failed)"}
                </Text>
              </View>
              <Text style={styles.resultTitle}>{roadmap.topic}</Text>
              <Text style={styles.bodyText}>{roadmap.overview}</Text>
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

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    keyboard: { backgroundColor: colors.background, flex: 1 },
    container: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl },
    placeholder: { color: colors.muted },
    backButton: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 2, paddingTop: spacing.sm },
    backText: { color: colors.text, fontSize: 14, fontWeight: "800" },
    hero: { gap: spacing.xs },
    badge: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderColor: colors.borderStrong, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 6 },
    badgeText: { color: colors.primary, fontSize: 11, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
    title: { color: colors.text, fontSize: 34, fontWeight: "900", letterSpacing: -1 },
    subtitle: { color: colors.muted, fontSize: 15, lineHeight: 23 },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: spacing.md, padding: spacing.md },
    heroCard: { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong, borderRadius: 24, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
    sourcePill: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    sourceText: { color: colors.text, fontSize: 11, fontWeight: "700" },
    field: { flex: 1, gap: spacing.xs },
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
    sectionTitle: { color: colors.text, flex: 1, fontSize: 17, fontWeight: "900" },
    bodyText: { color: colors.text, flex: 1, fontSize: 14, lineHeight: 21 },
    mutedText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
    phaseHeader: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
    phaseDuration: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    miniBlock: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 4, padding: spacing.md },
    bulletRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm },
    dot: { backgroundColor: colors.primary, borderRadius: 999, height: 7, marginTop: 7, width: 7 },
    toolWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    toolPill: { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
    toolName: { color: colors.text, fontSize: 11, fontWeight: "900" },
    toolSource: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    emptyCard: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 22, borderWidth: 1, gap: spacing.sm, padding: spacing.lg },
    emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  });
}
