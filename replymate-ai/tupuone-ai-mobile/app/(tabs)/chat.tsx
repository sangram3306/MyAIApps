import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Modal,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing, typography } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { getBackendUrl } from "../../storage/appStorage";
import { saveAgentDetails } from "../../storage/agentDetailsStore";
import { ChatMessageResponse, sendChatMessageFromApi } from "../../services/api";
import { ChatSession, listChatSessions, saveChatSession, deleteChatSession } from "../../storage/chatSessionStore";

type ChatBubble = {
  id: string;
  role: "user" | "assistant";
  content: string;
  userMessage?: string;
  toolCalls?: ChatMessageResponse["toolCalls"];
  agentTrace?: string[];
  metadata?: ChatMessageResponse["metadata"];
};

function generateId(): string {
  return String(Date.now());
}

export default function ChatScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const scrollRef = useRef<ScrollView | null>(null);
  const [backendUrl, setBackendUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const params = useLocalSearchParams<{ query?: string }>();

  useFocusEffect(
    useCallback(() => {
      getBackendUrl().then(setBackendUrl);
      loadHistorySessions();
    }, []),
  );

  async function loadHistorySessions() {
    const sessions = await listChatSessions();
    setHistorySessions(sessions);
  }

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  useEffect(() => {
    if (params.query) {
      const q = params.query;
      router.setParams({ query: undefined } as any);
      handleSend(q);
    }
  }, [params.query]);

  async function handleSend(value?: string) {
    const nextMessage = (value ?? message).trim();

    let activeUrl = backendUrl;
    if (!activeUrl) {
      try {
        activeUrl = await getBackendUrl();
        setBackendUrl(activeUrl);
      } catch (err) {
        // ignore
      }
    }

    if (!activeUrl) {
      setError("ReplyMate AI could not find the backend URL. Please restart the app.");
      return;
    }

    if (!nextMessage) {
      setError("Type a message first.");
      return;
    }

    const userBubble: ChatBubble = {
      id: `${generateId()}-user`,
      role: "user",
      content: nextMessage,
    };

    setMessages((current) => [...current, userBubble]);
    setMessage("");
    setLoading(true);
    setError("");

    abortControllerRef.current = new AbortController();

    function buildHistoryPayload() {
      // Only send last 5 messages — long-term context is handled by
      // the backend's entity extraction memory system.
      const validMessages = messages
        .filter((m) => !m.id.includes("error") && !m.content.includes("I could not process that message right now"))
        .slice(-5)
        .map((m) => ({ role: m.role, content: m.content }));
      return validMessages.length > 0 ? validMessages : undefined;
    }

    try {
      const result = await sendChatMessageFromApi({
        backendUrl: activeUrl,
        message: nextMessage,
        signal: abortControllerRef.current.signal,
        history: buildHistoryPayload(),
      });

      const assistantId = `${generateId()}-assistant`;
      const assistantBubble: ChatBubble = {
        id: assistantId,
        role: "assistant",
        content: result.assistantReply,
        userMessage: nextMessage,
        toolCalls: result.toolCalls,
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

      setMessages((current) => {
        const updatedMessages = [...current, assistantBubble];
        
        // Save session
        const sessionId = currentSessionId || `session-${Date.now()}`;
        if (!currentSessionId) setCurrentSessionId(sessionId);
        
        const sessionTitle = updatedMessages.find(m => m.role === "user")?.content || "New Chat";
        const titleSnippet = sessionTitle.length > 40 ? sessionTitle.substring(0, 40) + "..." : sessionTitle;
        
        saveChatSession({
          id: sessionId,
          title: titleSnippet,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: updatedMessages
        }).then(loadHistorySessions);

        return updatedMessages;
      });
    } catch (caught: any) {
      if (caught.name === "AbortError") {
        setMessages((current) => current.filter((m) => m.id !== userBubble.id));
        setMessage(nextMessage);
        return;
      }
      const detail = caught instanceof Error ? caught.message : "Please try again.";
      setError(detail);
      setMessages((current) => [
        ...current,
        {
          id: `${generateId()}-assistant-error`,
          role: "assistant",
          content: "I could not process that message right now. Please try again shortly.",
          toolCalls: [],
          agentTrace: ["Request failed"],
          metadata: {
            toolsUsed: [],
            toolSources: {
              answerGeneration: "fallback",
            },
          },
        },
      ]);
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
    }
  }

  function handleStop() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
      style={styles.keyboard}
    >
      <View style={styles.container}>
        <MatrixBackground density={13} />

        <View style={styles.thread}>
          <View style={styles.threadHeader}>
            <View style={styles.aiBadge}>
              <Ionicons name="logo-electron" color={colors.purple} size={19} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.threadTitle}>
                SP ONE <Text style={styles.threadTitleAccent}>AI</Text>
              </Text>
              <Text style={styles.threadSubtitle}>Your AI assistant for thinking, writing and planning.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={styles.historyBtn} onPress={() => setShowHistory(true)}>
                <Ionicons name="time-outline" color={colors.text} size={20} />
              </Pressable>
              <Pressable style={styles.historyBtn} onPress={() => { setCurrentSessionId(null); setMessages([]); }}>
                <Ionicons name="create-outline" color={colors.text} size={20} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.threadContent}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {messages.length ? (
              messages.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.bubble,
                    item.role === "user" ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  <Text style={styles.bubbleText}>{item.content}</Text>

                  {item.role === "assistant" && item.metadata ? (
                    <Pressable
                      onPress={() =>
                        router.push(`/agent-details?id=${encodeURIComponent(item.id)}` as never)
                      }
                      style={styles.detailsLink}
                    >
                      <Text style={styles.detailsLinkTitle}>View flow</Text>
                      <Ionicons name="chevron-forward" color={colors.primary} size={15} />
                    </Pressable>
                  ) : null}
                </View>
              ))
            ) : (
              <View style={styles.emptyHint}>
                <Text style={styles.emptyHintTitle}>Start with a question</Text>
                <Text style={styles.emptyHintCopy}>Ask SP ONE AI anything.</Text>
              </View>
            )}
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
              onPress={() => (loading ? handleStop() : handleSend())}
              style={[styles.sendButton]}
              accessibilityLabel={loading ? "Stop generating" : "Send message"}
            >
              {loading ? (
                <Ionicons name="stop" color="#08110D" size={18} />
              ) : (
                <Ionicons name="arrow-up" color="#08110D" size={22} />
              )}
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>SP ONE can make mistakes. Verify important info.</Text>
        </View>
      </View>
      <Modal visible={showHistory} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowHistory(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chat History</Text>
              <Pressable style={styles.iconBtn} onPress={() => setShowHistory(false)}>
                <Ionicons name="close" color={colors.text} size={20} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.xl, gap: spacing.sm }}>
              {historySessions.length === 0 ? (
                <Text style={{ color: colors.muted, textAlign: 'center', marginTop: spacing.xl }}>No previous chats found.</Text>
              ) : (
                historySessions.map((session) => (
                  <View key={session.id} style={styles.sessionCard}>
                    <Pressable
                      style={{ flex: 1 }}
                      onPress={() => {
                        setCurrentSessionId(session.id);
                        setMessages(session.messages);
                        setShowHistory(false);
                      }}
                    >
                      <Text style={styles.sessionTitle} numberOfLines={1}>{session.title}</Text>
                      <Text style={styles.sessionDate}>{new Date(session.updatedAt).toLocaleDateString()}</Text>
                    </Pressable>
                    <Pressable
                      style={{ padding: spacing.sm }}
                      onPress={() => {
                        deleteChatSession(session.id).then(() => {
                          loadHistorySessions();
                          if (currentSessionId === session.id) {
                            setCurrentSessionId(null);
                            setMessages([]);
                          }
                        });
                      }}
                    >
                      <Ionicons name="trash-outline" color={colors.danger} size={18} />
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    keyboard: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      backgroundColor: colors.background,
      flex: 1,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    thread: {
      backgroundColor: "transparent",
      flex: 1,
      gap: spacing.md,
      zIndex: 1,
    },
    threadHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      paddingHorizontal: spacing.xs,
      paddingTop: spacing.sm,
    },
    historyBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceGlass,
      alignItems: "center",
      justifyContent: "center",
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
    },
    aiBadge: {
      alignItems: "center",
      backgroundColor: colors.secondarySoft,
      borderColor: "rgba(124,58,237,0.42)",
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 38,
      justifyContent: "center",
      shadowColor: colors.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.24,
      shadowRadius: 16,
      width: 38,
    },
    threadTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
      letterSpacing: 0.5,
    },
    threadTitleAccent: {
      color: colors.primary,
    },
    threadSubtitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 15,
      marginTop: 3,
    },

    threadContent: {
      flexGrow: 1,
      gap: spacing.sm,
      justifyContent: "flex-end",
      paddingHorizontal: spacing.xs,
      paddingTop: spacing.xs,
      paddingBottom: spacing.md,
    },
    bubble: {
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    userBubble: {
      alignSelf: "flex-end",
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
      maxWidth: "86%",
      minWidth: "34%",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
    },
    assistantBubble: {
      alignSelf: "flex-start",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      maxWidth: "88%",
      minWidth: "44%",
      shadowColor: colors.cyan,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
    },
    bubbleText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    detailsLink: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.primaryDim,
      borderRadius: radius.pill,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    detailsLinkTitle: {
      color: colors.primary,
      fontSize: typography.micro,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    emptyHint: {
      alignSelf: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.md,
      width: "100%",
    },
    emptyHintTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      textAlign: "center",
    },
    emptyHintCopy: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 16,
      marginTop: 4,
      textAlign: "center",
    },
    error: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.danger,
      lineHeight: 20,
      padding: spacing.sm,
      zIndex: 1,
    },
    composer: {
      gap: 3,
      paddingBottom: Platform.OS === "android" ? spacing.xs : 0,
      paddingTop: spacing.xs,
      zIndex: 1,
    },
    composerShell: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 48,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
    },
    input: {
      backgroundColor: "transparent",
      color: colors.text,
      flex: 1,
      fontSize: 14,
      maxHeight: 110,
      minHeight: 36,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xs,
      lineHeight: 20,
    },
    sendButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      height: 38,
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 14,
      width: 38,
    },
    sendButtonDisabled: {
      opacity: 0.75,
    },
    disclaimer: {
      color: colors.mutedSoft,
      fontSize: 10,
      fontWeight: "700",
      textAlign: "center",
    },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(4,8,14,0.45)", justifyContent: "flex-end" },
    modalDismiss: { flex: 1 },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      maxHeight: "80%",
      minHeight: "50%",
      padding: spacing.md,
    },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
    modalTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
    iconBtn: { padding: 4 },
    sessionCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      padding: spacing.md,
      borderRadius: radius.md,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: spacing.sm,
    },
    sessionTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
    sessionDate: { color: colors.muted, fontSize: 12, marginTop: 4 },
  });
}
