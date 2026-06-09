import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { ChipSelector } from "./ChipSelector";
import { EmptyState } from "./EmptyState";
import { GrammarFixCard } from "./GrammarFixCard";
import { MatrixBackground } from "./PremiumUI";
import { ReplyCard } from "./ReplyCard";
import { Role, replyRoles, rewriteRoles } from "../constants/roles";
import { replyTones, rewriteStyles, Tone } from "../constants/tones";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { fixGrammarFromApi, generateRepliesFromApi, rewriteMessageFromApi } from "../services/api";
import {
  addHistoryItem,
  getBackendUrl,
  getReplyResponseCountPreference,
  getRewriteResponseCountPreference,
  saveFavorite,
} from "../storage/appStorage";

type WritingMode = "reply" | "rewrite" | "grammar";

type Props = {
  mode: WritingMode;
};

type IconName = keyof typeof Ionicons.glyphMap;

const modeCopy: Record<WritingMode, { title: string; subtitle: string; button: string; icon: IconName; eyebrow: string }> = {
  reply: {
    title: "Smart Reply",
    subtitle: "Craft thoughtful replies with tone, role and context.",
    button: "Generate Replies",
    icon: "chatbubbles-outline",
    eyebrow: "Communication",
  },
  rewrite: {
    title: "Rewrite",
    subtitle: "Reshape your message for clarity, tone and intent.",
    button: "Rewrite Message",
    icon: "create-outline",
    eyebrow: "Transformation",
  },
  grammar: {
    title: "Grammar",
    subtitle: "Fix grammar and polish the message without changing intent.",
    button: "Fix Grammar",
    icon: "text-outline",
    eyebrow: "Refinement",
  },
};

function generateId(): string {
  return String(Date.now());
}

export function WritingToolScreen({ mode }: Props) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const copy = modeCopy[mode];
  const [message, setMessage] = useState("");
  const [replyNote, setReplyNote] = useState("");
  const [tone, setTone] = useState<Tone>(mode === "rewrite" ? "clearer" : "none");
  const [role, setRole] = useState<Role>("none");
  const [backendUrl, setBackendUrl] = useState("");
  const [replyResponseCount, setReplyResponseCount] = useState(5);
  const [rewriteResponseCount, setRewriteResponseCount] = useState(5);
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        getBackendUrl(),
        getReplyResponseCountPreference(),
        getRewriteResponseCountPreference(),
      ]).then(([url, replyCount, rewriteCount]) => {
        setBackendUrl(url);
        setReplyResponseCount(replyCount);
        setRewriteResponseCount(rewriteCount);
      });
    }, []),
  );

  async function handleGenerate() {
    if (!backendUrl) {
      setError("SP ONE could not find the built-in backend URL. Please restart the app.");
      return;
    }

    if (!message.trim()) {
      setError("Paste a message first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const generated =
        mode === "reply"
          ? await generateRepliesFromApi({
              backendUrl,
              message: message.trim(),
              note: replyNote.trim(),
              tone,
              role,
              responseCount: replyResponseCount,
            })
          : mode === "rewrite"
            ? await rewriteMessageFromApi({
                backendUrl,
                message: message.trim(),
                tone,
                role,
                responseCount: rewriteResponseCount,
              })
            : await fixGrammarFromApi({
                backendUrl,
                message: message.trim(),
                tone,
              });

      setReplies(generated);
      await addHistoryItem({
        id: generateId(),
        message: message.trim(),
        tone,
        role,
        note: mode === "reply" ? replyNote.trim() : undefined,
        replies: generated,
        createdAt: new Date().toISOString(),
      });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Please try again.";
      setError(`Could not reach SP ONE backend. ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFavorite(reply: string) {
    await saveFavorite({
      id: generateId(),
      reply,
      sourceMessage: message,
      note: mode === "reply" ? replyNote.trim() : undefined,
      tone,
      role,
      createdAt: new Date().toISOString(),
    });
    Alert.alert("Saved", "Reply added to favorites.");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <View style={styles.screen}>
        <MatrixBackground density={10} />

        {/* Ambient glow orbs */}
        <View pointerEvents="none" style={styles.glowOrb1} />
        <View pointerEvents="none" style={styles.glowOrb2} />

        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" color={colors.primary} size={18} />
            </Pressable>
            <View style={styles.headerCopy}>
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowDot} />
                <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
              </View>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.subtitle}>{copy.subtitle}</Text>
            </View>
            <View style={styles.heroIconContainer}>
              <Ionicons name={copy.icon} color={colors.primary} size={22} />
            </View>
          </View>

          {/* Main input panel */}
          <View style={styles.panel}>
            <View style={styles.panelGlow} />

            <View style={styles.inputBlock}>
              <View style={styles.labelRow}>
                <Ionicons
                  name={mode === "reply" ? "mail-outline" : mode === "rewrite" ? "document-text-outline" : "checkmark-done-outline"}
                  color={colors.primary}
                  size={14}
                />
                <Text style={styles.label}>
                  {mode === "reply" ? "Message to reply to" : mode === "rewrite" ? "Your message" : "Text to fix"}
                </Text>
              </View>
              <TextInput
                multiline
                placeholder={
                  mode === "reply"
                    ? "Paste the message you received..."
                    : mode === "rewrite"
                      ? "Type the message you want to rewrite..."
                      : "Type text with grammar mistakes..."
                }
                placeholderTextColor={colors.mutedSoft}
                style={styles.input}
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
              />
            </View>

            {mode === "reply" ? (
              <View style={styles.inputBlock}>
                <View style={styles.labelRow}>
                  <Ionicons name="bulb-outline" color={colors.primary} size={14} />
                  <Text style={styles.label}>Reply note</Text>
                </View>
                <TextInput
                  multiline
                  placeholder="Add context or instructions for the reply..."
                  placeholderTextColor={colors.mutedSoft}
                  style={[styles.input, styles.noteInput]}
                  textAlignVertical="top"
                  value={replyNote}
                  onChangeText={setReplyNote}
                />
              </View>
            ) : null}

            {mode !== "grammar" ? (
              <View style={styles.selectorRow}>
                <View style={styles.selectorColumn}>
                  <View style={styles.labelRow}>
                    <Ionicons name="color-palette-outline" color={colors.primary} size={14} />
                    <Text style={styles.label}>{mode === "reply" ? "Reply tone" : "Writing style"}</Text>
                  </View>
                  <ChipSelector
                    options={mode === "reply" ? replyTones : rewriteStyles}
                    selectedValue={tone}
                    onSelect={setTone}
                  />
                </View>
                <View style={styles.selectorColumn}>
                  <View style={styles.labelRow}>
                    <Ionicons name="person-outline" color={colors.primary} size={14} />
                    <Text style={styles.label}>Role</Text>
                  </View>
                  <ChipSelector
                    options={mode === "reply" ? replyRoles : rewriteRoles}
                    selectedValue={role}
                    onSelect={setRole}
                  />
                </View>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="warning-outline" color={colors.danger} size={16} />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              disabled={loading}
              onPress={handleGenerate}
              style={[styles.primaryButton, loading && styles.disabledButton]}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" color={colors.onPrimary} size={18} />
                  <Text style={styles.primaryButtonText}>{copy.button}</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Results section */}
          {replies.length > 0 ? (
            <View style={styles.resultsHeader}>
              <View style={styles.resultsHeaderDot} />
              <Text style={styles.resultsHeaderText}>
                {mode === "grammar" ? "Corrections" : `${replies.length} ${replies.length === 1 ? "result" : "results"} generated`}
              </Text>
            </View>
          ) : null}

          <View style={styles.results}>
            {replies.length > 0 ? (
              mode === "grammar" ? (
                replies.map((reply, index) => (
                  <GrammarFixCard key={`${reply}-${index}`} original={message.trim()} corrected={reply} />
                ))
              ) : (
                replies.map((reply, index) => (
                  <ReplyCard key={`${reply}-${index}`} reply={reply} onFavorite={() => handleFavorite(reply)} />
                ))
              )
            ) : (
              <EmptyState
                title={
                  mode === "reply"
                    ? "No replies yet"
                    : mode === "rewrite"
                      ? "No rewrites yet"
                      : "No grammar fix yet"
                }
                message={
                  mode === "reply"
                    ? "Your generated replies will appear here."
                    : mode === "rewrite"
                      ? "Your rewritten message options will appear here."
                      : "Your corrected message will appear here."
                }
                icon={mode === "reply" ? "chatbubbles-outline" : mode === "rewrite" ? "create-outline" : "text-outline"}
              />
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    keyboard: {
      backgroundColor: colors.background,
      flex: 1,
    },
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      gap: spacing.lg,
      padding: spacing.md,
      paddingBottom: spacing.xl + 20,
      paddingTop: Math.max(spacing.md, topInset),
    },

    /* Ambient glow orbs */
    glowOrb1: {
      backgroundColor: colors.primaryDim,
      borderRadius: 999,
      height: 220,
      opacity: 0.12,
      position: "absolute",
      right: -80,
      top: -40,
      width: 220,
    },
    glowOrb2: {
      backgroundColor: colors.secondarySoft,
      borderRadius: 999,
      bottom: 180,
      height: 160,
      left: -70,
      opacity: 0.08,
      position: "absolute",
      width: 160,
    },

    /* Header */
    headerRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderRadius: 14,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42,
      shadowColor: colors.primary,
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    headerCopy: {
      flex: 1,
      gap: 6,
    },
    eyebrowRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    eyebrowDot: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 6,
      width: 6,
      shadowColor: colors.primary,
      shadowOpacity: 0.7,
      shadowRadius: 4,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    heroIconContainer: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
      borderRadius: 16,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
      shadowColor: colors.primary,
      shadowOpacity: 0.2,
      shadowRadius: 14,
    },

    /* Panel */
    panel: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderRadius: 24,
      borderWidth: 1,
      gap: spacing.lg,
      overflow: "hidden",
      padding: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.06,
      shadowRadius: 24,
    },
    panelGlow: {
      backgroundColor: colors.primaryDim,
      borderRadius: 999,
      height: 120,
      left: "50%",
      marginLeft: -60,
      opacity: 0.14,
      position: "absolute",
      top: -60,
      width: 120,
    },

    /* Input */
    inputBlock: {
      gap: spacing.sm,
    },
    labelRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    label: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    input: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      minHeight: 140,
      padding: spacing.md,
      lineHeight: 22,
    },
    noteInput: {
      fontSize: 14,
      minHeight: 78,
    },

    /* Selectors */
    selectorRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.md,
    },
    selectorColumn: {
      flexBasis: 0,
      flexGrow: 1,
      gap: spacing.sm,
      minWidth: 150,
    },

    /* Error */
    errorContainer: {
      alignItems: "center",
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    error: {
      color: colors.danger,
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 19,
    },

    /* Generate button */
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 18,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 54,
    },
    disabledButton: { opacity: 0.72 },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "900",
    },

    /* Results */
    resultsHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
    },
    resultsHeaderDot: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 5,
      width: 5,
      shadowColor: colors.primary,
      shadowOpacity: 0.6,
      shadowRadius: 3,
    },
    resultsHeaderText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    results: {
      gap: spacing.md,
    },
  });
}
