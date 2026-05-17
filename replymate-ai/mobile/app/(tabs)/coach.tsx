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
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Smart coaching</Text>
          <Text style={styles.title}>Smart Reply Coach</Text>
          <Text style={styles.subtitle}>
            Get a safer, smarter reply strategy for friends, family, and work conversations.
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
            <ResultCard label="Intent" value={result.intent} />
            <ResultCard label="Emotion" value={result.emotion} />
            <ResultCard label="Risk Level" value={result.riskLevel} accent={riskAccent(result.riskLevel)} />
            <ResultCard label="Suggested Tone" value={result.suggestedTone} />
            <ResultCard label="Best Reply Strategy" value={result.strategy} />

            <TipsCard title="Do Tips" items={result.doTips} />
            <TipsCard title="Don't Tips" items={result.dontTips} danger />

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
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  label: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 150,
    padding: spacing.md,
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.danger,
    lineHeight: 20,
    padding: spacing.md,
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 52,
    justifyContent: "center",
    padding: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: "#08110D",
    fontSize: 16,
    fontWeight: "900",
  },
  results: {
    gap: spacing.md,
  },
  resultCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
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
  },
  replyCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
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
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: 8,
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
  },
  tipList: {
    gap: spacing.sm,
  },
  tipItem: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: 8,
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
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
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
});
