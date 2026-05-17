import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useFocusEffect } from "expo-router";
import { ChipSelector } from "../../components/ChipSelector";
import { colors, spacing } from "../../constants/theme";
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
  const [backendUrl, setBackendUrl] = useState("");
  const [message, setMessage] = useState("");
  const [relationshipContext, setRelationshipContext] = useState<RelationshipContext>("Friend");
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
    Alert.alert("Copied", "Recommended reply copied to clipboard.");
  }

  async function handleShare() {
    if (!result?.recommendedReply) {
      return;
    }

    await Share.share({ message: result.recommendedReply });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.matrixGlowTop} />
        <View style={styles.matrixGlowBottom} />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Smart coaching</Text>
          <Text style={styles.title}>Smart Reply Coach</Text>
          <Text style={styles.subtitle}>
            Decode intent, emotion, and risk through a neon matrix command center.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Message text</Text>
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
          <Text style={styles.label}>Relationship context</Text>
          <ChipSelector
            options={[...relationshipOptions]}
            selectedValue={relationshipContext}
            onSelect={setRelationshipContext}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={loading}
          onPress={handleAnalyze}
          style={[styles.button, loading && styles.buttonDisabled]}
        >
          {loading ? <ActivityIndicator color="#08110D" /> : <Text style={styles.buttonText}>Analyze</Text>}
        </Pressable>

        {result ? (
          <View style={styles.results}>
            <View style={styles.resultsGrid}>
              <ResultCard label="Intent" value={result.intent} />
              <ResultCard label="Emotion" value={result.emotion} />
              <ResultCard label="Risk Level" value={result.riskLevel} accent={riskAccent(result.riskLevel)} />
              <ResultCard label="Suggested Tone" value={result.suggestedTone} />
            </View>

            <View style={styles.replyCard}>
              <Text style={styles.cardTitle}>Best Reply Strategy</Text>
              <Text style={styles.strategy}>{result.strategy}</Text>
            </View>

            <View style={styles.dualColumn}>
              <TipsCard title="Do Tips" items={result.doTips} />
              <TipsCard title="Don't Tips" items={result.dontTips} danger />
            </View>

            <View style={styles.replyCard}>
              <Text style={styles.cardTitle}>Recommended Reply</Text>
              <Text style={styles.reply}>{result.recommendedReply}</Text>
              <View style={styles.actionRow}>
                <Pressable style={styles.secondaryButton} onPress={handleCopy}>
                  <Text style={styles.secondaryButtonText}>Copy recommended reply</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={handleShare}>
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
  label,
  value,
  accent,
}: {
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
  title,
  items,
  danger = false,
}: {
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

function riskAccent(level: string): string {
  if (level === "high") {
    return colors.danger;
  }

  if (level === "medium") {
    return colors.amber;
  }

  return colors.success;
}

const styles = StyleSheet.create({
  keyboard: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    gap: spacing.lg,
    flexGrow: 1,
    padding: spacing.md,
    paddingBottom: spacing.xl * 1.5,
  },
  matrixGlowTop: {
    backgroundColor: "rgba(69, 245, 198, 0.16)",
    borderRadius: 999,
    height: 180,
    opacity: 0.4,
    position: "absolute",
    right: -70,
    top: -40,
    width: 180,
  },
  matrixGlowBottom: {
    backgroundColor: "rgba(69, 245, 198, 0.08)",
    borderRadius: 999,
    bottom: 260,
    height: 240,
    left: -120,
    opacity: 0.32,
    position: "absolute",
    width: 240,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
    zIndex: 1,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 420,
  },
  card: {
    backgroundColor: "rgba(17, 19, 24, 0.96)",
    borderColor: "rgba(69, 245, 198, 0.18)",
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
  label: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 160,
    padding: spacing.md,
    lineHeight: 22,
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
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    minHeight: 56,
    justifyContent: "center",
    padding: spacing.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: "#08110D",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 0.5,
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
    backgroundColor: "rgba(24, 27, 34, 0.96)",
    borderColor: "rgba(69, 245, 198, 0.16)",
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
    flexBasis: "48%",
    flexGrow: 1,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 14,
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
    lineHeight: 24,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  strategy: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
  },
  replyCard: {
    backgroundColor: "rgba(24, 27, 34, 0.96)",
    borderColor: "rgba(69, 245, 198, 0.16)",
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  reply: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(69, 245, 198, 0.08)",
    borderColor: "rgba(69, 245, 198, 0.20)",
    borderRadius: 14,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  tipList: {
    gap: spacing.sm,
  },
  tipItem: {
    backgroundColor: "rgba(69, 245, 198, 0.08)",
    borderColor: "rgba(69, 245, 198, 0.18)",
    borderRadius: 14,
    borderWidth: 1,
    padding: spacing.sm,
  },
  tipItemDanger: {
    backgroundColor: colors.dangerSoft,
  },
  tipText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  tipTextDanger: {
    color: colors.text,
  },
  stepList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  stepPill: {
    backgroundColor: "rgba(69, 245, 198, 0.08)",
    borderColor: "rgba(69, 245, 198, 0.38)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  toolSummary: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  toolList: {
    gap: spacing.sm,
  },
  toolRow: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "rgba(69, 245, 198, 0.16)",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toolName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  toolSource: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
