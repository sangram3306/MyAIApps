import { useCallback, useEffect, useState } from "react";
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
import { useFocusEffect } from "expo-router";
import { BrandLogo, brandFont } from "../../components/BrandLogo";
import { EmptyState } from "../../components/EmptyState";
import { ReplyCard } from "../../components/ReplyCard";
import { ToneSelector } from "../../components/ToneSelector";
import { Tone } from "../../constants/tones";
import { colors, spacing } from "../../constants/theme";
import { generateRepliesFromApi, rewriteMessageFromApi } from "../../services/api";
import { addHistoryItem, getBackendUrl, saveFavorite } from "../../storage/appStorage";

export default function HomeScreen() {
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<Tone>("polite");
  const [mode, setMode] = useState<"reply" | "rewrite">("reply");
  const [backendUrl, setBackendUrl] = useState("");
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  async function handleGenerate() {
    if (!backendUrl) {
      setError("ReplyMate could not find the built-in backend URL. Please restart the app.");
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
              tone,
            })
          : await rewriteMessageFromApi({
              backendUrl,
              message: message.trim(),
              tone,
            });
      setReplies(generated);
      await addHistoryItem({
        id: Date.now().toString(),
        message: message.trim(),
        tone,
        replies: generated,
        createdAt: new Date().toISOString(),
      });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Please try again.";
      setError(`Could not reach ReplyMate backend. ${detail}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFavorite(reply: string) {
    await saveFavorite({
      id: `${Date.now()}`,
      reply,
      sourceMessage: message,
      tone,
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
          <BrandLogo />
          <Text style={styles.subtitle}>
            Generate a smart reply or rewrite your own message in a better style.
          </Text>
        </View>

        <View style={styles.modeSwitch}>
          <Pressable
            onPress={() => {
              setMode("reply");
              setReplies([]);
            }}
            style={[styles.modeButton, mode === "reply" && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, mode === "reply" && styles.modeTextActive]}>Reply</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMode("rewrite");
              setReplies([]);
            }}
            style={[styles.modeButton, mode === "rewrite" && styles.modeButtonActive]}
          >
            <Text style={[styles.modeText, mode === "rewrite" && styles.modeTextActive]}>
              Rewrite
            </Text>
          </Pressable>
        </View>

        <View style={styles.inputBlock}>
          <Text style={styles.label}>{mode === "reply" ? "Message to reply to" : "Your message"}</Text>
          <TextInput
            multiline
            placeholder={
              mode === "reply"
                ? "Paste the message you received..."
                : "Type the message you want to rewrite..."
            }
            placeholderTextColor={colors.muted}
            style={styles.input}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />
        </View>

        <View>
          <Text style={styles.label}>{mode === "reply" ? "Reply tone" : "Writing style"}</Text>
          <ToneSelector selectedTone={tone} onSelect={setTone} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          disabled={loading}
          onPress={handleGenerate}
          style={[styles.generateButton, loading && styles.generateButtonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.generateButtonText}>
              {mode === "reply" ? "Generate Replies" : "Rewrite Message"}
            </Text>
          )}
        </Pressable>

        <View style={styles.results}>
          {replies.length > 0 ? (
            replies.map((reply, index) => (
              <ReplyCard key={`${reply}-${index}`} reply={reply} onFavorite={() => handleFavorite(reply)} />
            ))
          ) : (
            <EmptyState
              title={mode === "reply" ? "No replies yet" : "No rewrites yet"}
              message={
                mode === "reply"
                  ? "Your generated replies will appear here."
                  : "Your rewritten message options will appear here."
              }
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    gap: spacing.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  title: {
    color: colors.text,
    fontFamily: brandFont,
    fontSize: 38,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
  },
  inputBlock: {
    gap: spacing.sm,
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
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  results: {
    gap: spacing.md,
  },
});
