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
  DecisionOption,
  DecisionSimulationResponse,
  simulateDecisionFromApi,
} from "../services/api";
import { getBackendUrl } from "../storage/appStorage";

const stakeOptions = ["low", "medium", "high"] as const;
const horizonOptions = ["this week", "this month", "next 3 months", "this year"] as const;

export default function DecisionSimulatorScreen({ showBackButton = true }: { showBackButton?: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [backendUrl, setBackendUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  const [rawOptions, setRawOptions] = useState("");
  const [horizon, setHorizon] = useState<(typeof horizonOptions)[number]>("next 3 months");
  const [stakes, setStakes] = useState<(typeof stakeOptions)[number]>("medium");
  const [result, setResult] = useState<DecisionSimulationResponse | null>(null);
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

  async function handleSimulate() {
    if (!backendUrl) {
      setError("Decision Simulator needs the backend to be online.");
      return;
    }

    if (!question.trim()) {
      setError("Write the decision you are trying to make first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await simulateDecisionFromApi({
        backendUrl,
        question: question.trim(),
        context: context.trim(),
        options: parseOptions(rawOptions),
        horizon,
        stakes,
      });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not simulate this decision.");
    } finally {
      setLoading(false);
    }
  }

  const simulation = result?.simulation;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {showBackButton ? (
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" color={colors.text} size={18} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="git-compare-outline" color={colors.primary} size={16} />
            <Text style={styles.heroBadgeText}>Decision simulator</Text>
          </View>
          <Text style={styles.title}>Think before you leap</Text>
          <Text style={styles.subtitle}>
            Compare options, expose hidden assumptions, run regret checks, and save the simulation
            to your decision memory.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Decision</Text>
          <TextInput
            multiline
            placeholder="e.g. Should I switch jobs, move cities, buy this course, or start this project?"
            placeholderTextColor={colors.muted}
            style={styles.questionInput}
            textAlignVertical="top"
            value={question}
            onChangeText={setQuestion}
          />

          <Text style={styles.fieldLabel}>Context</Text>
          <TextInput
            multiline
            placeholder="Add constraints, concerns, deadlines, people affected, or what makes this hard..."
            placeholderTextColor={colors.muted}
            style={styles.contextInput}
            textAlignVertical="top"
            value={context}
            onChangeText={setContext}
          />

          <Text style={styles.fieldLabel}>Known options</Text>
          <TextInput
            multiline
            placeholder="Optional. Add one per line, or comma separated."
            placeholderTextColor={colors.muted}
            style={styles.optionsInput}
            textAlignVertical="top"
            value={rawOptions}
            onChangeText={setRawOptions}
          />

          <View style={styles.choiceGrid}>
            <View style={styles.choiceBlock}>
              <Text style={styles.fieldLabel}>Time horizon</Text>
              <View style={styles.pillWrap}>
                {horizonOptions.map((item) => (
                  <ChoicePill
                    key={item}
                    label={item}
                    selected={horizon === item}
                    onPress={() => setHorizon(item)}
                    styles={styles}
                  />
                ))}
              </View>
            </View>

            <View style={styles.choiceBlock}>
              <Text style={styles.fieldLabel}>Stakes</Text>
              <View style={styles.pillWrap}>
                {stakeOptions.map((item) => (
                  <ChoicePill
                    key={item}
                    label={capitalize(item)}
                    selected={stakes === item}
                    onPress={() => setStakes(item)}
                    styles={styles}
                  />
                ))}
              </View>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={loading}
            onPress={handleSimulate}
            style={[styles.primaryButton, loading && styles.disabledButton]}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="sparkles-outline" color={colors.onPrimary} size={18} />
                <Text style={styles.primaryButtonText}>Simulate decision</Text>
              </>
            )}
          </Pressable>
        </View>

        {simulation ? (
          <View style={styles.results}>
            <View style={styles.recommendationCard}>
              <View style={styles.recommendationHeader}>
                <View style={styles.iconBox}>
                  <Ionicons name="compass-outline" color={colors.primary} size={20} />
                </View>
                <View style={styles.recommendationCopy}>
                  <Text style={styles.kicker}>Recommendation</Text>
                  <Text style={styles.recommendationTitle}>{simulation.recommendation}</Text>
                </View>
              </View>
              <Text style={styles.bodyText}>{simulation.recommendationSummary}</Text>
              <ScoreBar score={simulation.confidence} label="Confidence" styles={styles} />
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Option scorecard</Text>
              <View style={styles.optionList}>
                {simulation.options.map((option) => (
                  <OptionCard key={option.name} option={option} styles={styles} />
                ))}
              </View>
            </View>

            <InfoSection title="Key factors" items={simulation.keyFactors} icon="key-outline" styles={styles} />
            <InfoSection title="Tradeoffs" items={simulation.tradeoffs} icon="swap-horizontal-outline" styles={styles} />
            <InfoSection title="Risks" items={simulation.risks} icon="warning-outline" styles={styles} />
            <InfoSection title="Assumptions" items={simulation.assumptions} icon="bulb-outline" styles={styles} />
            <InfoSection title="Small experiments" items={simulation.experiments} icon="flask-outline" styles={styles} />
            <InfoSection title="Next steps" items={simulation.nextSteps} icon="checkmark-done-outline" styles={styles} />

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Regret check</Text>
              <Text style={styles.bodyText}>{simulation.regretCheck}</Text>
              <View style={styles.ruleBox}>
                <Text style={styles.kicker}>Decision rule</Text>
                <Text style={styles.bodyText}>{simulation.decisionRule}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Agent loop</Text>
              <View style={styles.toolWrap}>
                {result.toolCalls.map((tool) => (
                  <View key={`${tool.name}-${tool.summary}`} style={styles.toolPill}>
                    <Text style={styles.toolName}>{tool.name}</Text>
                    <Text style={styles.toolSource}>{tool.source}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.traceList}>
                {result.agentTrace.map((item) => (
                  <View key={item} style={styles.traceRow}>
                    <View style={styles.traceDot} />
                    <Text style={styles.traceText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="analytics-outline" color={colors.primary} size={24} />
            <Text style={styles.emptyTitle}>No simulation yet</Text>
            <Text style={styles.emptyCopy}>
              Add a decision and the agent will compare options, use memory, save the result, and
              give you a practical next move.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ChoicePill({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.choicePill, selected && styles.choicePillSelected]}>
      <Text style={[styles.choicePillText, selected && styles.choicePillTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function OptionCard({
  option,
  styles,
}: {
  option: DecisionOption;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.optionCard}>
      <View style={styles.optionHeader}>
        <Text style={styles.optionName}>{option.name}</Text>
        <Text style={styles.optionScore}>{option.score}/100</Text>
      </View>
      <ScoreBar score={option.score} label="Fit score" styles={styles} />
      {option.reasoning ? <Text style={styles.optionReasoning}>{option.reasoning}</Text> : null}
      <View style={styles.proConRow}>
        <MiniList title="Pros" items={option.pros} styles={styles} />
        <MiniList title="Cons" items={option.cons} styles={styles} />
      </View>
    </View>
  );
}

function InfoSection({
  title,
  items,
  icon,
  styles,
}: {
  title: string;
  items: string[];
  icon: keyof typeof Ionicons.glyphMap;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!items.length) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.iconBoxSmall}>
          <Ionicons name={icon} size={16} style={styles.iconTint} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.bulletList}>
        {items.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <View style={styles.bulletDot} />
            <Text style={styles.bodyText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MiniList({
  title,
  items,
  styles,
}: {
  title: string;
  items: string[];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.miniList}>
      <Text style={styles.miniTitle}>{title}</Text>
      {(items.length ? items : ["Not specified"]).slice(0, 3).map((item) => (
        <Text key={item} style={styles.miniItem}>
          {item}
        </Text>
      ))}
    </View>
  );
}

function ScoreBar({
  score,
  label,
  styles,
}: {
  score: number;
  label: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const width = `${Math.min(100, Math.max(0, score))}%` as const;
  return (
    <View style={styles.scoreBlock}>
      <View style={styles.scoreTop}>
        <Text style={styles.scoreLabel}>{label}</Text>
        <Text style={styles.scoreValue}>{score}%</Text>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width }]} />
      </View>
    </View>
  );
}

function parseOptions(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    keyboard: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      gap: spacing.md,
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    backButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: 2,
      paddingTop: spacing.sm,
      paddingVertical: 4,
    },
    backText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    hero: {
      gap: spacing.xs,
      paddingBottom: spacing.xs,
    },
    heroBadge: {
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
    heroBadgeText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -1,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 23,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    sectionHeaderRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    fieldLabel: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    questionInput: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderStrong,
      borderRadius: 18,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      lineHeight: 23,
      minHeight: 96,
      padding: spacing.md,
    },
    contextInput: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.text,
      fontSize: 14,
      lineHeight: 21,
      minHeight: 96,
      padding: spacing.md,
    },
    optionsInput: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.text,
      fontSize: 14,
      lineHeight: 21,
      minHeight: 72,
      padding: spacing.md,
    },
    choiceGrid: {
      gap: spacing.md,
    },
    choiceBlock: {
      gap: spacing.xs,
    },
    pillWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    choicePill: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    choicePillSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    choicePillText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
    },
    choicePillTextSelected: {
      color: colors.primary,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 18,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 54,
    },
    disabledButton: {
      opacity: 0.72,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "900",
    },
    error: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderRadius: 16,
      borderWidth: 1,
      color: colors.danger,
      lineHeight: 20,
      padding: spacing.md,
    },
    emptyCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.lg,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    emptyCopy: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
    },
    results: {
      gap: spacing.md,
    },
    recommendationCard: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 24,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    recommendationHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    recommendationCopy: {
      flex: 1,
      gap: 2,
    },
    kicker: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    recommendationTitle: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "900",
      lineHeight: 25,
    },
    iconBox: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
      borderRadius: 16,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    iconBoxSmall: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      borderWidth: 1,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    iconTint: {
      color: colors.primary,
    },
    bodyText: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      lineHeight: 21,
    },
    scoreBlock: {
      gap: spacing.xs,
    },
    scoreTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    scoreLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    scoreValue: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
    },
    scoreTrack: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 10,
      overflow: "hidden",
    },
    scoreFill: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: "100%",
    },
    optionList: {
      gap: spacing.sm,
    },
    optionCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    optionHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    optionName: {
      color: colors.text,
      flex: 1,
      fontSize: 15,
      fontWeight: "900",
    },
    optionScore: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
    },
    optionReasoning: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    proConRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    miniList: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      gap: 4,
      padding: spacing.sm,
    },
    miniTitle: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    miniItem: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    bulletList: {
      gap: spacing.sm,
    },
    bulletRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
    },
    bulletDot: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 7,
      marginTop: 7,
      width: 7,
    },
    ruleBox: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
    toolWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    toolPill: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    toolName: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
    },
    toolSource: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    traceList: {
      gap: spacing.xs,
    },
    traceRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    traceDot: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 6,
      width: 6,
    },
    traceText: {
      color: colors.muted,
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
    },
  });
}
