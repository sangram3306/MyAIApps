import { useCallback, useMemo, useState } from "react";
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

export default function CoachScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [backendUrl, setBackendUrl] = useState("");
  const [message, setMessage] = useState("");
  const [relationshipContext, setRelationshipContext] = useState<RelationshipContext>("Friend");
  const [relationshipOpen, setRelationshipOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CoachAnalyzeResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      getBackendUrl().then((url) => {
        setBackendUrl(url);
        if (url) {
          setError("");
        }
      });
    }, []),
  );

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
      const analysis = await analyzeCoachFromApi({
        backendUrl,
        message: message.trim(),
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
          <View style={styles.headerTop}>
            <View style={styles.headerIcon}>
              <Ionicons name="sparkles-outline" color={colors.primary} size={18} />
            </View>
            <Text style={styles.eyebrow}>Smart Coaching</Text>
          </View>
          <Text style={styles.title}>Smart Reply Coach</Text>
          <Text style={styles.subtitle}>Decode intent, emotion, and risk before you reply.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Message text</Text>
          <TextInput
            multiline
            placeholder="Paste the message you received..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Relationship context</Text>
          <Pressable onPress={() => setRelationshipOpen((current) => !current)} style={styles.dropdown}>
            <View style={styles.dropdownCopy}>
              <Text style={styles.dropdownLabel}>Selected</Text>
              <Text style={styles.dropdownValue}>{relationshipContext}</Text>
            </View>
            <Ionicons name={relationshipOpen ? "chevron-up" : "chevron-down"} color={colors.textMuted} size={22} />
          </Pressable>
          {relationshipOpen ? (
            <View style={styles.dropdownMenu}>
              {relationshipOptions.map((option) => {
                const selected = option.value === relationshipContext;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      setRelationshipContext(option.value);
                      setRelationshipOpen(false);
                    }}
                    style={[styles.dropdownOption, selected && styles.dropdownOptionSelected]}
                  >
                    <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextSelected]}>
                      {option.label}
                    </Text>
                    {selected ? <Ionicons name="checkmark-circle" color={colors.primary} size={17} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={loading}
          onPress={handleAnalyze}
          style={[styles.button, loading && styles.buttonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <Text style={styles.buttonText}>Analyze</Text>
              <Ionicons name="arrow-forward" color={colors.onPrimary} size={17} />
            </>
          )}
        </Pressable>

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
      gap: spacing.md,
      flexGrow: 1,
      paddingHorizontal: 20,
      paddingBottom: spacing.xl * 1.5,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    header: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: 7,
      overflow: "hidden",
      padding: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.06,
      shadowRadius: 20,
      zIndex: 1,
    },
    headerTop: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    headerIcon: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      height: 36,
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      width: 36,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.6,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.7,
      lineHeight: 32,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 19,
    },
    card: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.04,
      shadowRadius: 16,
    },
    input: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      minHeight: 136,
      padding: spacing.md,
    },
    error: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.danger,
      lineHeight: 20,
      padding: spacing.sm,
    },
    button: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 18,
      flexDirection: "row",
      gap: spacing.xs,
      minHeight: 54,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    buttonDisabled: {
      opacity: 0.72,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 16,
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
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.sm + 2,
      flexBasis: "48%",
      flexGrow: 1,
      shadowColor: colors.primary,
      shadowOpacity: 0.05,
      shadowRadius: 12,
    },
    cardLabel: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
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
      borderColor: colors.primaryBorder,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.04,
      shadowRadius: 16,
    },
    cardTitle: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    dropdown: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      minHeight: 58,
      paddingHorizontal: spacing.md,
    },
    dropdownCopy: {
      flex: 1,
      gap: 4,
    },
    dropdownLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    dropdownValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    dropdownMenu: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: "hidden",
    },
    dropdownOption: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 44,
      paddingHorizontal: spacing.md,
    },
    dropdownOptionSelected: {
      backgroundColor: colors.primaryDim,
    },
    dropdownOptionText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "800",
    },
    dropdownOptionTextSelected: {
      color: colors.primary,
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
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderRadius: radius.pill,
      borderWidth: 1,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: 7,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    stepList: {
      gap: spacing.sm,
    },
    stepPill: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      paddingHorizontal: spacing.sm + 2,
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
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      padding: spacing.sm,
      gap: spacing.xs,
    },
    toolName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    toolSource: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    tipList: {
      gap: spacing.sm,
    },
    tipItem: {
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: 1,
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
