import { useCallback, useEffect, useRef, useState } from "react";
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
import { colors, spacing } from "../../constants/theme";
import { getBackendUrl } from "../../storage/appStorage";
import { saveAgentDetails } from "../../storage/agentDetailsStore";
import { ChatMessageResponse, sendChatMessageFromApi } from "../../services/api";

type ChatBubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
  userMessage?: string;
  toolCalls?: ChatMessageResponse["toolCalls"];
  todos?: ChatMessageResponse["todos"];
  agentTrace?: string[];
  metadata?: ChatMessageResponse["metadata"];
};

export default function ChatScreen() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [backendUrl, setBackendUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask me anything. I can help you think, write, plan, explain, or refine an idea.",
      toolCalls: [],
      todos: [],
      agentTrace: ["Ready for chat"],
      metadata: {
        toolsUsed: [],
        toolSources: {
          classifyIntent: "static",
          todoSkill: "static",
          answerGeneration: "static",
        },
      },
    },
  ]);

  useFocusEffect(
    useCallback(() => {
      getBackendUrl().then(setBackendUrl);
    }, []),
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  async function handleSend(value?: string) {
    const nextMessage = (value ?? message).trim();

    if (!backendUrl) {
      setError("ReplyMate AI could not find the backend URL. Please restart the app.");
      return;
    }

    if (!nextMessage) {
      setError("Type a message first.");
      return;
    }

    const userBubble: ChatBubble = {
      id: `${Date.now()}-user`,
      role: "user",
      content: nextMessage,
    };

    setMessages((current) => [...current, userBubble]);
    setMessage("");
    setLoading(true);
    setError("");

    try {
      const result = await sendChatMessageFromApi({
        backendUrl,
        message: nextMessage,
      });

      const assistantId = `${Date.now()}-assistant`;
      const assistantBubble: ChatBubble = {
        id: assistantId,
        role: "assistant",
        content: result.assistantReply,
        userMessage: nextMessage,
        toolCalls: result.toolCalls,
        todos: result.todos,
        agentTrace: result.agentTrace,
        metadata: result.metadata,
      };

      saveAgentDetails({
        id: assistantId,
        userMessage: nextMessage,
        assistantReply: result.assistantReply,
        response: result,
        createdAt: new Date().toISOString(),
      });

      setMessages((current) => [...current, assistantBubble]);
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "Please try again.";
      setError(detail);
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant-error`,
          role: "assistant",
          content: "I could not process that message right now. Please try again shortly.",
          toolCalls: [],
          todos: [],
          agentTrace: ["Request failed"],
          metadata: {
            toolsUsed: [],
            toolSources: {
              classifyIntent: "fallback",
              todoSkill: "fallback",
              answerGeneration: "fallback",
            },
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      style={styles.keyboard}
    >
      <View style={styles.container}>
        <View style={styles.matrixGlowTop} />
        <View style={styles.matrixGlowBottom} />

        <View style={styles.thread}>
          <View style={styles.threadHeader}>
            <Text style={styles.threadTitle}>Chat</Text>
            <Text style={styles.threadSubtitle}>ReplyMate AI</Text>
          </View>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.threadContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {messages.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.bubble,
                  item.role === "user" ? styles.userBubble : styles.assistantBubble,
                ]}
              >
                <Text style={styles.bubbleRole}>{item.role === "user" ? "You" : "ReplyMate AI"}</Text>
                <Text style={styles.bubbleText}>{item.content}</Text>

                {item.role === "assistant" && item.metadata && item.id !== "welcome" ? (
                  <Pressable
                    onPress={() =>
                      router.push(`/agent-details?id=${encodeURIComponent(item.id)}` as never)
                    }
                    style={styles.detailsLink}
                  >
                    <View>
                      <Text style={styles.detailsLinkTitle}>View Execution Flow</Text>
                      <Text style={styles.detailsLinkSubtitle}>
                        LLM decisions, tool calls, MCP results, and final answer
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" color={colors.primary} size={18} />
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.composer}>
          <View style={styles.composerShell}>
            <TextInput
              multiline
              placeholder="Ask anything..."
              placeholderTextColor={colors.muted}
              style={styles.input}
              textAlignVertical="center"
              value={message}
              onChangeText={setMessage}
            />

            <Pressable
              disabled={loading}
              onPress={() => handleSend()}
              style={[styles.sendButton, loading && styles.sendButtonDisabled]}
              accessibilityLabel="Send message"
            >
              {loading ? (
                <ActivityIndicator color="#08110D" />
              ) : (
                <Ionicons name="arrow-up" color="#08110D" size={22} />
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
    padding: spacing.sm,
    paddingBottom: spacing.md,
  },
  matrixGlowTop: {
    backgroundColor: "rgba(69, 245, 198, 0.16)",
    borderRadius: 999,
    height: 170,
    opacity: 0.38,
    position: "absolute",
    right: -70,
    top: -40,
    width: 170,
  },
  matrixGlowBottom: {
    backgroundColor: "rgba(69, 245, 198, 0.08)",
    borderRadius: 999,
    bottom: 120,
    height: 220,
    left: -110,
    opacity: 0.24,
    position: "absolute",
    width: 220,
  },
  thread: {
    backgroundColor: "rgba(12, 14, 18, 0.94)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 0,
    borderWidth: 1,
    flex: 1,
    marginHorizontal: -spacing.sm,
    marginTop: -spacing.sm,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    zIndex: 1,
  },
  threadHeader: {
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    borderBottomWidth: 1,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.md,
  },
  threadTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  threadSubtitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  threadContent: {
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(69, 245, 198, 0.10)",
    borderColor: "rgba(69, 245, 198, 0.28)",
    maxWidth: "88%",
    minWidth: "34%",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(24, 27, 34, 0.98)",
    borderColor: "rgba(69, 245, 198, 0.16)",
    maxWidth: "92%",
    minWidth: "44%",
  },
  bubbleRole: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  bubbleText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  detailsLink: {
    alignItems: "center",
    backgroundColor: "rgba(69, 245, 198, 0.06)",
    borderColor: "rgba(69, 245, 198, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailsLinkTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailsLinkSubtitle: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "700",
    marginTop: 2,
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
  composer: {
    paddingBottom: Platform.OS === "android" ? spacing.xs : 0,
    paddingTop: spacing.xs,
  },
  composerShell: {
    alignItems: "flex-end",
    backgroundColor: "rgba(24, 27, 34, 0.98)",
    borderColor: "rgba(69, 245, 198, 0.26)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 58,
    padding: spacing.xs,
    shadowColor: colors.primary,
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  input: {
    backgroundColor: "transparent",
    color: colors.text,
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    lineHeight: 22,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  sendButtonDisabled: {
    opacity: 0.75,
  },
});
