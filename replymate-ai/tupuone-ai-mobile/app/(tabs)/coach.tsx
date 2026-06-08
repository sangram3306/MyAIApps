import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChipSelector } from "../../components/ChipSelector";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { analyzeCoachFromApi, CoachAnalyzeResponse } from "../../services/api";
import { getBackendUrl } from "../../storage/appStorage";

const relationshipOptions = [
  { label: "Friend", value: "Friend" },
  { label: "Wife", value: "Wife" },
  { label: "Boss", value: "Boss" },
  { label: "Client", value: "Client" },
  { label: "Customer", value: "Customer" },
  { label: "Parent", value: "Parent" },
  { label: "Sibling", value: "Sibling" },
  { label: "Other", value: "Other" },
] as const;

type RelationshipContext = (typeof relationshipOptions)[number]["value"];

const agentSteps = [
  "Checked message intent",
  "Detected emotional context",
  "Checked relationship rules",
  "Assessed reply risk",
  "Generated reply strategy",
  "Checked final quality",
];

const coachingModes = [
  {
    title: "Clarify",
    copy: "Understand your thoughts better",
    icon: "glasses-outline",
    instruction: "Help me clarify the situation, intent, and emotional subtext before I reply.",
  },
  {
    title: "Decide",
    copy: "Evaluate options and risks",
    icon: "git-compare-outline",
    instruction: "Help me compare reply options, risks, and likely outcomes.",
  },
  {
    title: "Plan",
    copy: "Create actionable next steps",
    icon: "map-outline",
    instruction: "Help me create a clear response plan and next steps.",
  },
  {
    title: "Reflect",
    copy: "Review and improve",
    icon: "refresh-circle-outline",
    instruction: "Help me reflect on the situation and improve my reply thoughtfully.",
  },
] as const;

type CoachingMode = (typeof coachingModes)[number]["title"];

export default function CoachScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [backendUrl, setBackendUrl] = useState("");
  const [message, setMessage] = useState("");
  const [relationshipContext, setRelationshipContext] = useState<RelationshipContext>("Friend");
  const [selectedMode, setSelectedMode] = useState<CoachingMode>("Clarify");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CoachAnalyzeResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      getBackendUrl().then(setBackendUrl);
    }, []),
  );

  useEffect(() => {
    if (backendUrl) {
      setError("");
    }
  }, [backendUrl]);

  async function handleAnalyze() {
    if (!backendUrl) {
      setError("ReplyMate AI could not find the backend URL. Please restart the app.");
      return;
    }

    if (!message.trim()) {
      setError("Paste a message first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const mode = coachingModes.find((item) => item.title === selectedMode) || coachingModes[0];
      const analysis = await analyzeCoachFromApi({
        backendUrl,
        message: `[Smart Coach mode: ${mode.title}]\n${mode.instruction}\n\nMessage to analyze:\n${message.trim()}`,
        relationshipContext,
      });
      setResult(analysis);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Please try again.";
      setError(`Could not analyze the message. ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result?.recommendedReply) {
      return;
    }

    await Clipboard.setStringAsync(result.recommendedReply);
    await Share.share({ message: result.recommendedReply });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <MatrixBackground density={12} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles-outline" color={colors.primary} size={18} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Smart Coach</Text>
            <Text style={styles.subtitle}>Your personal clarity companion</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What&apos;s on your mind?</Text>
          <Text style={styles.cardHint}>Share anything. I&apos;ll help you think clearly and respond wisely.</Text>
          <TextInput
            multiline
            placeholder="Paste the message you received..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            disabled={loading}
            onPress={handleAnalyze}
            style={[styles.button, loading && styles.buttonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text style={styles.buttonText}>Start New Session</Text>
                <Ionicons name="arrow-forward" color={colors.primary} size={16} />
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Coaching Modes</Text>
          <Text style={styles.sectionMeta}>{selectedMode}</Text>
        </View>
        <View style={styles.modeGrid}>
          {coachingModes.map((mode) => {
            const selected = mode.title === selectedMode;
            return (
            <Pressable
              key={mode.title}
              onPress={() => setSelectedMode(mode.title)}
              style={[styles.modeCard, selected && styles.modeCardActive]}
            >
              <View style={[styles.modeIcon, selected && styles.modeIconActive]}>
                <Ionicons name={mode.icon as keyof typeof Ionicons.glyphMap} color={colors.primary} size={16} />
              </View>
              <View style={styles.modeCopy}>
                <Text style={styles.modeTitle}>{mode.title}</Text>
                <Text style={styles.modeSubtitle}>{mode.copy}</Text>
              </View>
              <Ionicons name={selected ? "checkmark-circle" : "chevron-forward"} color={selected ? colors.primary : colors.muted} size={16} />
            </Pressable>
          );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Relationship context</Text>
          <ChipSelector
            options={[...relationshipOptions]}
            selectedValue={relationshipContext}
            onSelect={setRelationshipContext}
          />
        </View>

        {result ? (
          <View style={styles.results}>
            <View style={styles.resultsGrid}>
              <ResultCard styles={styles} label="Intent" value={result.intent} />
              <ResultCard styles={styles} label="Emotion" value={result.emotion} />
              <ResultCard
                styles={styles}
                label="Risk Level"
                value={result.riskLevel}
                accent={riskAccent(result.riskLevel, colors)}
              />
              <ResultCard styles={styles} label="Suggested Tone" value={result.suggestedTone} />
            </View>

            <View style={styles.replyCard}>
              <Text style={styles.cardTitle}>Best Reply Strategy</Text>
              <Text style={styles.strategy}>{result.strategy}</Text>
            </View>

            <View style={styles.dualColumn}>
              <TipsCard styles={styles} title="Do Tips" items={result.doTips} />
              <TipsCard styles={styles} title="Don't Tips" items={result.dontTips} danger />
            </View>

            <View style={styles.replyCard}>
              <Text style={styles.cardTitle}>Recommended Reply</Text>
              <Text style={styles.reply}>{result.recommendedReply}</Text>
              <View style={styles.actionRow}>
                <Pressable style={styles.secondaryButton} onPress={handleCopy}>
                  <Text style={styles.secondaryButtonText}>Copy recommended reply</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => Share.share({ message: result.recommendedReply })}>
                  <Text style={styles.secondaryButtonText}>Share recommended reply</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.replyCard}>
              <Text style={styles.cardTitle}>Agent Steps</Text>
              <View style={styles.stepList}>
                {agentSteps.map((step) => (
                  <View key={step} style={styles.stepPill}>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.replyCard}>
              <Text style={styles.cardTitle}>Tool Calls</Text>
              <Text style={styles.toolSummary}>
                MCP tools used by the backend to analyze your message.
              </Text>
              <View style={styles.toolList}>
                {result.metadata.toolsUsed.map((tool) => (
                  <View key={tool} style={styles.toolRow}>
                    <Text style={styles.toolName}>{tool}</Text>
                    <Text style={styles.toolSource}>
                      {result.metadata.toolSources[tool as keyof typeof result.metadata.toolSources]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ResultCard({
  styles,
  label,
  value,
  accent,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.resultCard}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

function TipsCard({
  styles,
  title,
  items,
  danger = false,
}: {
  styles: ReturnType<typeof createStyles>;
  title: string;
  items: string[];
  danger?: boolean;
}) {
  return (
    <View style={styles.replyCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.tipList}>
        {items.map((item) => (
          <View key={item} style={[styles.tipItem, danger && styles.tipItemDanger]}>
            <Text style={[styles.tipText, danger && styles.tipTextDanger]}>• {item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function riskAccent(level: string, colors: ReturnType<typeof useAppTheme>["colors"]): string {
  if (level === "high") {
    return colors.danger;
  }

  if (level === "medium") {
    return colors.amber;
  }

  return colors.success;
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    keyboard: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      backgroundColor: colors.background,
      gap: 13,
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingBottom: spacing.xl * 1.5,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    header: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      paddingTop: spacing.sm,
      zIndex: 1,
    },
    headerIcon: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      height: 40,
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
      width: 40,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    subtitle: {
      color: colors.cyan,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
    card: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      padding: spacing.md,
    },
    label: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    input: {
      backgroundColor: "rgba(17,24,36,0.74)",
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.text,
      fontSize: 14,
      minHeight: 132,
      padding: spacing.sm,
    },
    error: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.danger,
      lineHeight: 20,
      padding: spacing.sm,
    },
    button: {
      alignItems: "center",
      backgroundColor: "rgba(0,255,198,0.08)",
      borderColor: colors.primary,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 44,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
    },
    buttonDisabled: {
      opacity: 0.75,
    },
    buttonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 2,
    },
    sectionTitle: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    sectionMeta: {
      color: colors.purple,
      fontSize: 11,
      fontWeight: "900",
    },
    results: {
      gap: spacing.md,
    },
    resultsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    dualColumn: {
      gap: spacing.md,
    },
    resultCard: {
      backgroundColor: "rgba(17,24,36,0.74)",
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.xs,
      padding: spacing.sm,
      flexBasis: "48%",
      flexGrow: 1,
    },
    cardLabel: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    cardValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      lineHeight: 22,
    },
    replyCard: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      padding: spacing.sm,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    cardHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    modeGrid: {
      gap: spacing.sm,
    },
    modeCard: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 54,
      padding: spacing.sm,
    },
    modeCardActive: {
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
    },
    modeIcon: {
      alignItems: "center",
      backgroundColor: "rgba(0,255,198,0.08)",
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    modeIconActive: {
      borderColor: colors.primaryBorder,
    },
    modeCopy: {
      flex: 1,
      gap: 2,
    },
    modeTitle: {
      color: colors.text,
      fontSize: 13.5,
      fontWeight: "900",
    },
    modeSubtitle: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
    strategy: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
    },
    reply: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
    },
    actionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    secondaryButton: {
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "800",
    },
    stepList: {
      gap: spacing.sm,
    },
    stepPill: {
      backgroundColor: "rgba(17,24,36,0.74)",
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    stepText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    toolSummary: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    toolList: {
      gap: spacing.sm,
    },
    toolRow: {
      backgroundColor: "rgba(17,24,36,0.74)",
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.sm,
      gap: spacing.xs,
    },
    toolName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    toolSource: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    tipList: {
      gap: spacing.sm,
    },
    tipItem: {
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.sm,
    },
    tipItemDanger: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
    },
    tipText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    tipTextDanger: {
      color: colors.danger,
    },
  });
}
