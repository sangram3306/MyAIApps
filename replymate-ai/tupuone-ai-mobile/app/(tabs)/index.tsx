import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BrandLogo } from "../../components/BrandLogo";
import { ChipSelector } from "../../components/ChipSelector";
import { EmptyState } from "../../components/EmptyState";
import { GrammarFixCard } from "../../components/GrammarFixCard";
import { ReplyCard } from "../../components/ReplyCard";
import { Role, replyRoles, rewriteRoles } from "../../constants/roles";
import { replyTones, rewriteStyles, Tone } from "../../constants/tones";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { fixGrammarFromApi, generateRepliesFromApi, rewriteMessageFromApi } from "../../services/api";
import {
  addHistoryItem,
  getBackendUrl,
  getQuickActionsPreference,
  getReplyResponseCountPreference,
  getRewriteResponseCountPreference,
  saveFavorite,
} from "../../storage/appStorage";

type Mode = "reply" | "rewrite" | "grammar";

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const quickActionStyles = useMemo(() => createQuickActionStyles(colors), [colors]);
  const [message, setMessage] = useState("");
  const [replyNote, setReplyNote] = useState("");
  const [tone, setTone] = useState<Tone>("none");
  const [role, setRole] = useState<Role>("none");
  const [mode, setMode] = useState<Mode>("reply");
  const [backendUrl, setBackendUrl] = useState("");
  const [quickActionsEnabled, setQuickActionsEnabled] = useState(true);
  const [replyResponseCount, setReplyResponseCount] = useState(5);
  const [rewriteResponseCount, setRewriteResponseCount] = useState(5);
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        getBackendUrl(),
        getQuickActionsPreference(),
        getReplyResponseCountPreference(),
        getRewriteResponseCountPreference(),
      ]).then(([url, enabled, replyCount, rewriteCount]) => {
        setBackendUrl(url);
        setQuickActionsEnabled(enabled);
        setReplyResponseCount(replyCount);
        setRewriteResponseCount(rewriteCount);
      });
    }, []),
  );

  useEffect(() => {
    if (backendUrl) {
      setError("");
    }
  }, [backendUrl]);

  async function handleGenerate() {
    if (!backendUrl) {
      setError("TupuChat could not find the built-in backend URL. Please restart the app.");
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
        id: Date.now().toString(),
        message: message.trim(),
        tone,
        role,
        note: mode === "reply" ? replyNote.trim() : undefined,
        replies: generated,
        createdAt: new Date().toISOString(),
      });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Please try again.";
      setError(`Could not reach TupuChat backend. ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFavorite(reply: string) {
    await saveFavorite({
      id: `${Date.now()}`,
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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <BrandLogo />
            <Image
              accessibilityLabel="SP One"
              resizeMode="contain"
              source={require("../../assets/brand/sp_one_label.png")}
              style={styles.headerLabel}
            />
            <Text style={styles.headerCredit}>by Sangram</Text>
          </View>
          <Text style={styles.subtitle}>Smart replies, rewrites, and grammar fixes.</Text>
        </View>

        {quickActionsEnabled ? (
          <View style={styles.quickActions}>
            <QuickAction
              label="Reply"
              onPress={() => {
                setMode("reply");
                setTone("none");
                setRole("none");
                setReplies([]);
              }}
              active={mode === "reply"}
              styles={quickActionStyles}
            />
            <QuickAction
              label="Rewrite"
              onPress={() => {
                setMode("rewrite");
                setTone("clearer");
                setRole("none");
                setReplies([]);
              }}
              active={mode === "rewrite"}
              styles={quickActionStyles}
            />
            <QuickAction
              label="Grammar"
              onPress={() => {
                setMode("grammar");
                setTone("none");
                setRole("none");
                setReplies([]);
              }}
              active={mode === "grammar"}
              styles={quickActionStyles}
            />
            <QuickAction
              label="Coach"
              onPress={() => router.push("/coach" as never)}
              styles={quickActionStyles}
            />
            <QuickAction
              label="Expenses"
              onPress={() => router.push("/expenses" as never)}
              styles={quickActionStyles}
            />
            <QuickAction
              label="Creator"
              onPress={() => router.push("/(tabs)/creator" as never)}
              styles={quickActionStyles}
            />
          </View>
        ) : null}

        <View style={styles.modeSwitch}>
          {(["reply", "rewrite", "grammar"] as Mode[]).map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                setMode(item);
                setTone(item === "rewrite" ? "clearer" : "none");
                setRole("none");
                setReplies([]);
              }}
              style={[styles.modeButton, mode === item && styles.modeButtonActive]}
            >
              <Text style={[styles.modeText, mode === item && styles.modeTextActive]}>
                {item === "reply" ? "Reply" : item === "rewrite" ? "Rewrite" : "Grammar"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputBlock}>
          <Text style={styles.label}>
            {mode === "reply"
              ? "Message to reply to"
              : mode === "rewrite"
                ? "Your message"
                : "Text to fix"}
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
          <>
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
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={loading}
          onPress={handleGenerate}
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onSecondary} />
          ) : (
            <Text style={styles.generateButtonText}>
              {mode === "reply"
                ? "Generate Replies"
                : mode === "rewrite"
                  ? "Rewrite Message"
                  : "Fix Grammar"}
            </Text>
          )}
        </Pressable>

        <View style={styles.results}>
          {replies.length > 0 ? (
            mode === "grammar" ? (
              replies.map((reply, index) => (
                <GrammarFixCard
                  key={`${reply}-${index}`}
                  original={message.trim()}
                  corrected={reply}
                />
              ))
            ) : (
              replies.map((reply, index) => (
                <ReplyCard
                  key={`${reply}-${index}`}
                  reply={reply}
                  onFavorite={() => handleFavorite(reply)}
                />
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
    </KeyboardAvoidingView>
  );
}

function QuickAction({
  label,
  onPress,
  styles,
  active = false,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createQuickActionStyles>;
  active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.action, active && styles.actionActive]}>
      <Text style={[styles.actionText, active && styles.actionTextActive]}>{label}</Text>
    </Pressable>
  );
}

function createQuickActionStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    action: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    actionActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    actionText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    actionTextActive: {
      color: colors.primary,
    },
  });
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    keyboard: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      gap: spacing.sm,
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.md,
      paddingTop: Math.max(spacing.md, topInset + spacing.sm),
    },
    header: {
      gap: 0,
    },
    headerTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "flex-start",
      minHeight: 72,
      position: "relative",
    },
    headerLabel: {
      height: 122,
      left: 0,
      position: "absolute",
      right: 0,
      top: -54,
      width: "100%",
    },
    headerCredit: {
      color: colors.muted,
      fontSize: 8,
      fontWeight: "700",
      left: 0,
      letterSpacing: 0,
      position: "absolute",
      right: 0,
      textAlign: "center",
      top: 14,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    quickActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    inputBlock: {
      gap: spacing.sm,
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
      minWidth: 160,
    },
    modeSwitch: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.xs,
    },
    modeButton: {
      alignItems: "center",
      borderRadius: 8,
      flex: 1,
      minHeight: 44,
      justifyContent: "center",
    },
    modeButtonActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderWidth: 1,
    },
    modeText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "800",
    },
    modeTextActive: {
      color: colors.primary,
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
      minHeight: 160,
      padding: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.16,
      shadowRadius: 18,
    },
    noteInput: {
      fontSize: 14,
      minHeight: 76,
      shadowOpacity: 0.08,
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
    generateButton: {
      alignItems: "center",
      backgroundColor: colors.secondary,
      borderRadius: 8,
      minHeight: 52,
      justifyContent: "center",
      padding: spacing.md,
      shadowColor: colors.secondary,
      shadowOpacity: 0.36,
      shadowRadius: 18,
    },
    generateButtonDisabled: {
      opacity: 0.7,
    },
    generateButtonText: {
      color: colors.onSecondary,
      fontSize: 16,
      fontWeight: "800",
    },
    results: {
      gap: spacing.md,
    },
  });
}
