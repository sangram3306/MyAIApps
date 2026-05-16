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
import { EmptyState } from "../../components/EmptyState";
import { ReplyCard } from "../../components/ReplyCard";
import { ToneSelector } from "../../components/ToneSelector";
import { Tone } from "../../constants/tones";
import { colors, spacing } from "../../constants/theme";
import { generateRepliesFromApi } from "../../services/api";
import { addHistoryItem, getBackendUrl, saveFavorite } from "../../storage/appStorage";

export default function HomeScreen() {
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<Tone>("polite");
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
      setError("Add your backend URL in Settings before generating replies.");
      return;
    }

    if (!message.trim()) {
      setError("Paste a message first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const generated = await generateRepliesFromApi({
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
          <Text style={styles.title}>ReplyMate AI</Text>
          <Text style={styles.subtitle}>Paste any message and get five ready-to-send replies.</Text>
        </View>

        {!backendUrl ? (
          <EmptyState
            title="Backend setup needed"
            message="Open Settings and paste your local or Render backend URL. Your NVIDIA API key stays only on the backend."
          />
        ) : null}

        <View style={styles.inputBlock}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            multiline
            placeholder="Paste WhatsApp, SMS, email, or social message here..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />
        </View>

        <View>
          <Text style={styles.label}>Tone</Text>
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
            <Text style={styles.generateButtonText}>Generate Replies</Text>
          )}
        </Pressable>

        <View style={styles.results}>
          {replies.length > 0 ? (
            replies.map((reply, index) => (
              <ReplyCard key={`${reply}-${index}`} reply={reply} onFavorite={() => handleFavorite(reply)} />
            ))
          ) : (
            <EmptyState title="No replies yet" message="Your generated replies will appear here." />
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
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 23,
  },
  inputBlock: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 160,
    padding: spacing.md,
  },
  error: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.danger,
    lineHeight: 20,
    padding: spacing.md,
  },
  generateButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 52,
    justifyContent: "center",
    padding: spacing.md,
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  results: {
    gap: spacing.md,
  },
});
