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
import { useFocusEffect } from "expo-router";
import { colors, spacing } from "../../constants/theme";
import { getBackendUrl } from "../../storage/appStorage";
import { ChatMessageResponse, sendChatMessageFromApi } from "../../services/api";

type ChatBubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
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

      const assistantBubble: ChatBubble = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        content: result.assistantReply,
        toolCalls: result.toolCalls,
        todos: result.todos,
        agentTrace: result.agentTrace,
        metadata: result.metadata,
      };

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
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboard}
    >
      <View style={styles.container}>
        <View style={styles.matrixGlowTop} />
        <View style={styles.matrixGlowBottom} />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>AI chat</Text>
          <Text style={styles.title}>Chat</Text>
          <Text style={styles.subtitle}>
            A clean space for general questions, writing help, planning, and quick thinking.
          </Text>
        </View>

        <View style={styles.thread}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.threadContent}
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
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailTitle}>Skill / Tool Used</Text>
                    <View style={styles.toolList}>
                      {getSkillRows(item).map((tool) => (
                        <View key={`${item.id}-${tool.name}`} style={styles.toolRow}>
                          <View style={styles.toolTextGroup}>
                            <Text style={styles.toolName}>{tool.name}</Text>
                            {tool.summary ? <Text style={styles.toolSummary}>{tool.summary}</Text> : null}
                          </View>
                          <Text style={styles.toolSource}>{tool.source}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {item.role === "assistant" && item.agentTrace?.length ? (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailTitle}>Agent Steps</Text>
                    <View style={styles.stepList}>
                      {item.agentTrace.map((step) => (
                        <View key={`${item.id}-${step}`} style={styles.stepPill}>
                          <Text style={styles.stepText}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {item.role === "assistant" && item.todos?.length ? (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailTitle}>Todo Snapshot</Text>
                    <View style={styles.todoList}>
                      {item.todos.slice(0, 5).map((todo) => (
                        <View key={todo.id} style={styles.todoRow}>
                          <View style={[styles.todoDot, todo.completed && styles.todoDotDone]} />
                          <Text style={styles.todoText}>
                            {todo.title}
                            {todo.completed ? " (done)" : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.composer}>
          <TextInput
            multiline
            placeholder="Ask anything..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />

          <Pressable
            disabled={loading}
            onPress={() => handleSend()}
            style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#08110D" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function getSkillRows(item: ChatBubble): Array<{
  name: string;
  source: "static" | "llm" | "fallback";
  summary?: string;
}> {
  if (!item.metadata) {
    return [];
  }

  const rows = [
    {
      name: "Intent Router",
      source: item.metadata.toolSources.classifyIntent,
      summary: "Classified the message request.",
    },
  ];

  if (item.toolCalls?.length) {
    item.toolCalls.forEach((tool) => {
      rows.push({
        name: formatToolName(tool.name),
        source: tool.source,
        summary: tool.summary,
      });
    });
  }

  rows.push({
    name: "Answer Generator",
    source: item.metadata.toolSources.answerGeneration,
    summary: "Prepared the final chat response.",
  });

  return rows;
}

function formatToolName(name: string): string {
  const labels: Record<string, string> = {
    createTodo: "Todo Skill: Create",
    listTodos: "Todo Skill: List",
    completeTodo: "Todo Skill: Complete",
    deleteTodo: "Todo Skill: Delete",
    updateTodo: "Todo Skill: Update",
  };

  return labels[name] || name;
}

const styles = StyleSheet.create({
  keyboard: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    padding: spacing.md,
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
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 440,
  },
  thread: {
    backgroundColor: "rgba(17, 19, 24, 0.88)",
    borderColor: "rgba(69, 245, 198, 0.18)",
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    overflow: "hidden",
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    zIndex: 1,
  },
  threadContent: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  bubble: {
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(69, 245, 198, 0.10)",
    borderColor: "rgba(69, 245, 198, 0.28)",
    width: "92%",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(24, 27, 34, 0.98)",
    borderColor: "rgba(69, 245, 198, 0.16)",
    width: "92%",
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
  detailBlock: {
    gap: spacing.sm,
  },
  detailTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  toolList: {
    gap: spacing.sm,
  },
  toolRow: {
    alignItems: "center",
    backgroundColor: "rgba(69, 245, 198, 0.06)",
    borderColor: "rgba(69, 245, 198, 0.16)",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toolTextGroup: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.sm,
  },
  toolName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  toolSummary: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  toolSource: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  stepList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  stepPill: {
    backgroundColor: "rgba(69, 245, 198, 0.06)",
    borderColor: "rgba(69, 245, 198, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  stepText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  todoList: {
    gap: spacing.sm,
  },
  todoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  todoDot: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  todoDotDone: {
    backgroundColor: colors.muted,
  },
  todoText: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
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
    gap: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 92,
    padding: spacing.md,
    lineHeight: 22,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 52,
    padding: spacing.md,
  },
  sendButtonDisabled: {
    opacity: 0.75,
  },
  sendButtonText: {
    color: "#08110D",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
});
