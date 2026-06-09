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

const modeCopy: Record<WritingMode, { title: string; subtitle: string; button: string }> = {
  reply: {
    title: "Smart Reply",
    subtitle: "Craft thoughtful replies with tone, role and context.",
    button: "Generate Replies",
  },
  rewrite: {
    title: "Rewrite",
    subtitle: "Reshape your message for clarity, tone and intent.",
    button: "Rewrite Message",
  },
  grammar: {
    title: "Grammar",
    subtitle: "Fix grammar and polish the message without changing intent.",
    button: "Fix Grammar",
  },
};

function generateId(): string {
  return String(Date.now());
}

export function WritingToolScreen({ mode }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
        <MatrixBackground density={8} />
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" color={colors.primary} size={20} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>Communication</Text>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.subtitle}>{copy.subtitle}</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <View style={styles.inputBlock}>
              <Text style={styles.label}>
                {mode === "reply" ? "Message to reply to" : mode === "rewrite" ? "Your message" : "Text to fix"}
              </Text>
              <TextInput
                multiline
                placeholder={
                  mode === "reply"
                    ? "Paste the message you received..."
                    : mode === "rewrite"
                      ? "Type the message you want to rewrite..."
                      : "Type text with grammar mistakes..."
                }
                placeholderTextColor={colors.muted}
                style={styles.input}
                textAlignVertical="top"
                value={message}
                onChangeText={setMessage}
              />
            </View>

            {mode === "reply" ? (
              <View style={styles.inputBlock}>
                <Text style={styles.label}>Reply note</Text>
                <TextInput
                  multiline
                  placeholder="Add context or instructions for the reply..."
                  placeholderTextColor={colors.muted}
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
                  <Text style={styles.label}>{mode === "reply" ? "Reply tone" : "Writing style"}</Text>
                  <ChipSelector
                    options={mode === "reply" ? replyTones : rewriteStyles}
                    selectedValue={tone}
                    onSelect={setTone}
                  />
                </View>
                <View style={styles.selectorColumn}>
                  <Text style={styles.label}>Role</Text>
                  <ChipSelector
                    options={mode === "reply" ? replyRoles : rewriteRoles}
                    selectedValue={role}
                    onSelect={setRole}
                  />
                </View>
              </View>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              disabled={loading}
              onPress={handleGenerate}
              style={[styles.generateButton, loading && styles.generateButtonDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.generateButtonText}>{copy.button}</Text>
              )}
            </Pressable>
          </View>

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
              />
            )}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
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
      paddingBottom: spacing.xl,
      paddingTop: spacing.xl,
    },
    headerRow: {
      flexDirection: "row",
      gap: spacing.md,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    headerCopy: {
      flex: 1,
      gap: 4,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
    },
    panel: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.lg,
      padding: spacing.md,
    },
    inputBlock: {
      gap: spacing.sm,
    },
    label: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
    },
    input: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.text,
      fontSize: 16,
      minHeight: 158,
      padding: spacing.md,
    },
    noteInput: {
      fontSize: 14,
      minHeight: 78,
    },
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
    error: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.danger,
      lineHeight: 20,
      padding: spacing.md,
    },
    generateButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 18,
      justifyContent: "center",
      minHeight: 52,
      padding: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.28,
      shadowRadius: 18,
    },
    generateButtonDisabled: {
      opacity: 0.7,
    },
    generateButtonText: {
      color: colors.onPrimary,
      fontSize: 16,
      fontWeight: "900",
    },
    results: {
      gap: spacing.md,
    },
  });
}
