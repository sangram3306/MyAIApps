import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import * as ExpoClipboard from "expo-clipboard";
import Ionicons from "@expo/vector-icons/Ionicons";
import Markdown from "react-native-markdown-display";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing, typography } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { getBackendUrl, getChatContextLengthPreference } from "../../storage/appStorage";
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
  isError?: boolean;
};

const SUGGESTED_PROMPTS = [
  { icon: "bulb-outline" as const, text: "Help me brainstorm ideas" },
  { icon: "create-outline" as const, text: "Write a professional email" },
  { icon: "book-outline" as const, text: "Explain a topic simply" },
  { icon: "calendar-outline" as const, text: "Help me plan my week" },
];

function generateId(): string {
  return String(Date.now());
}

// ── Typing indicator dots animation ──────────────────────────────────────
function TypingIndicator({ colors }: { colors: ReturnType<typeof useAppTheme>["colors"] }) {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ]),
      );
    const anim = Animated.parallel([animate(dot1, 0), animate(dot2, 150), animate(dot3, 300)]);
    anim.start();
    return () => anim.stop();
  }, [dot1, dot2, dot3]);

  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: colors.surfaceGlass,
        borderColor: colors.primaryBorder,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: 12,
        shadowColor: colors.cyan,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
      }}
    >
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.primary,
            opacity: dot,
          }}
        />
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const markdownStyles = useMemo(() => createMarkdownStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView | null>(null);
  const [backendUrl, setBackendUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySessions, setHistorySessions] = useState<ChatSession[]>([]);
  const [activeBubbleMenu, setActiveBubbleMenu] = useState<string | null>(null);
  const [contextLength, setContextLength] = useState(5);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sendDebounceRef = useRef(false);
  const params = useLocalSearchParams<{ query?: string }>();

  useFocusEffect(
    useCallback(() => {
      getBackendUrl().then(setBackendUrl);
      loadHistorySessions();
      getChatContextLengthPreference().then((val) => {
        // The preference is stored as a percentage-like value (1-100),
        // map it to a reasonable message count (1-20)
        const mapped = Math.max(1, Math.min(20, Math.round(val / 5)));
        setContextLength(mapped);
      });
    }, []),
  );

  async function loadHistorySessions() {
    const sessions = await listChatSessions();
    setHistorySessions(sessions);
  }

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  useEffect(() => {
    if (params.query) {
      const q = params.query;
      router.setParams({ query: undefined } as any);
      handleSend(q);
    }
  }, [params.query]);

  async function handleSend(value?: string) {
    // Debounce rapid sends
    if (sendDebounceRef.current) return;
    sendDebounceRef.current = true;
    setTimeout(() => { sendDebounceRef.current = false; }, 600);

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
      // Use user-configured context length instead of hardcoded 5
      const validMessages = messages
        .filter((m) => !m.id.includes("error") && !m.content.includes("I could not process that message right now"))
        .slice(-contextLength)
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
        
        // Use AI-generated title if available, otherwise truncate first user message
        const fallbackTitle = updatedMessages.find(m => m.role === "user")?.content || "New Chat";
        const titleSnippet = result.suggestedTitle || (fallbackTitle.length > 40 ? fallbackTitle.substring(0, 40) + "..." : fallbackTitle);
        
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
          isError: true,
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

  function handleRetry(item: ChatBubble) {
    // Find the user message that preceded this assistant message
    const msgIndex = messages.findIndex((m) => m.id === item.id);
    const userMsg = item.userMessage || (msgIndex > 0 ? messages[msgIndex - 1]?.content : null);
    if (!userMsg) return;

    // Remove the error/assistant bubble and re-send
    setMessages((current) => current.filter((m) => m.id !== item.id));
    handleSend(userMsg);
  }

  function handleCopy(text: string) {
    ExpoClipboard.setStringAsync(text);
    setActiveBubbleMenu(null);
  }

  async function handleShare(text: string) {
    setActiveBubbleMenu(null);
    try {
      await Share.share({ message: text });
    } catch {
      // user cancelled
    }
  }

  function handleDeleteMessage(id: string) {
    setMessages((current) => current.filter((m) => m.id !== id));
    setActiveBubbleMenu(null);
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
                Tupu <Text style={styles.threadTitleAccent}>chat</Text>
              </Text>
              <Text style={styles.threadSubtitle}>Your AI assistant for thinking, writing and planning.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={styles.historyBtn} onPress={() => router.push("/ai-memory" as never)}>
                <Ionicons name="hardware-chip-outline" color={colors.text} size={20} />
              </Pressable>
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
              <>
                {messages.map((item) => (
                  <Pressable
                    key={item.id}
                    onLongPress={() => setActiveBubbleMenu(activeBubbleMenu === item.id ? null : item.id)}
                    onPress={() => activeBubbleMenu ? setActiveBubbleMenu(null) : undefined}
                    style={[
                      styles.bubble,
                      item.role === "user" ? styles.userBubble : styles.assistantBubble,
                      item.isError && styles.errorBubble,
                    ]}
                  >
                    {item.role === "assistant" ? (
                      <Markdown style={markdownStyles}>{item.content}</Markdown>
                    ) : (
                      <Text style={styles.bubbleText}>{item.content}</Text>
                    )}

                    {/* Action buttons row */}
                    {item.role === "assistant" && (
                      <View style={styles.bubbleActions}>
                        {item.metadata ? (
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
                        <View style={{ flex: 1 }} />
                        <Pressable onPress={() => handleCopy(item.content)} style={styles.bubbleActionBtn} hitSlop={8}>
                          <Ionicons name="copy-outline" color={colors.muted} size={14} />
                        </Pressable>
                        <Pressable onPress={() => handleShare(item.content)} style={styles.bubbleActionBtn} hitSlop={8}>
                          <Ionicons name="share-outline" color={colors.muted} size={14} />
                        </Pressable>
                        {item.isError && (
                          <Pressable onPress={() => handleRetry(item)} style={styles.retryBtn} hitSlop={8}>
                            <Ionicons name="refresh-outline" color={colors.amber} size={14} />
                            <Text style={[styles.detailsLinkTitle, { color: colors.amber }]}>Retry</Text>
                          </Pressable>
                        )}
                      </View>
                    )}

                    {/* Long-press context menu */}
                    {activeBubbleMenu === item.id && (
                      <View style={styles.contextMenu}>
                        <Pressable style={styles.contextMenuItem} onPress={() => handleCopy(item.content)}>
                          <Ionicons name="copy-outline" color={colors.text} size={16} />
                          <Text style={styles.contextMenuText}>Copy</Text>
                        </Pressable>
                        <Pressable style={styles.contextMenuItem} onPress={() => handleShare(item.content)}>
                          <Ionicons name="share-outline" color={colors.text} size={16} />
                          <Text style={styles.contextMenuText}>Share</Text>
                        </Pressable>
                        {item.role === "assistant" && (
                          <Pressable style={styles.contextMenuItem} onPress={() => handleRetry(item)}>
                            <Ionicons name="refresh-outline" color={colors.text} size={16} />
                            <Text style={styles.contextMenuText}>Retry</Text>
                          </Pressable>
                        )}
                        <Pressable style={styles.contextMenuItem} onPress={() => handleDeleteMessage(item.id)}>
                          <Ionicons name="trash-outline" color={colors.danger} size={16} />
                          <Text style={[styles.contextMenuText, { color: colors.danger }]}>Delete</Text>
                        </Pressable>
                      </View>
                    )}
                  </Pressable>
                ))}

                {/* Typing indicator */}
                {loading && <TypingIndicator colors={colors} />}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyHint}>
                  <Ionicons name="sparkles" color={colors.primary} size={28} style={{ alignSelf: "center", marginBottom: spacing.sm }} />
                  <Text style={styles.emptyHintTitle}>What can I help you with?</Text>
                  <Text style={styles.emptyHintCopy}>Ask Tupu chat anything — brainstorm, write, plan, or just explore ideas.</Text>
                </View>
                <View style={styles.promptChips}>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <Pressable
                      key={prompt.text}
                      style={styles.promptChip}
                      onPress={() => handleSend(prompt.text)}
                    >
                      <Ionicons name={prompt.icon} color={colors.primary} size={16} />
                      <Text style={styles.promptChipText} numberOfLines={1}>{prompt.text}</Text>
                    </Pressable>
                  ))}
                </View>
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
          <Text style={styles.disclaimer}>Tupu chat can make mistakes. Verify important info.</Text>
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

function createMarkdownStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return {
    body: { color: colors.text, fontSize: 14, lineHeight: 20 },
    heading1: { color: colors.text, fontSize: 20, fontWeight: "900" as const, marginBottom: 6, marginTop: 8 },
    heading2: { color: colors.text, fontSize: 17, fontWeight: "800" as const, marginBottom: 4, marginTop: 6 },
    heading3: { color: colors.text, fontSize: 15, fontWeight: "700" as const, marginBottom: 4, marginTop: 4 },
    strong: { fontWeight: "700" as const, color: colors.text },
    em: { fontStyle: "italic" as const, color: colors.text },
    link: { color: colors.primary, textDecorationLine: "underline" as const },
    blockquote: {
      backgroundColor: colors.surfaceElevated,
      borderLeftColor: colors.primary,
      borderLeftWidth: 3,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      marginVertical: spacing.xs,
    },
    code_inline: {
      backgroundColor: colors.surfaceElevated,
      color: colors.primary,
      fontSize: 13,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    },
    code_block: {
      backgroundColor: colors.surfaceElevated,
      color: colors.text,
      fontSize: 13,
      padding: spacing.sm,
      borderRadius: radius.sm,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      marginVertical: spacing.xs,
    },
    fence: {
      backgroundColor: colors.surfaceElevated,
      color: colors.text,
      fontSize: 13,
      padding: spacing.sm,
      borderRadius: radius.sm,
      fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
      marginVertical: spacing.xs,
    },
    bullet_list: { marginVertical: spacing.xs },
    ordered_list: { marginVertical: spacing.xs },
    list_item: { marginVertical: 2 },
    paragraph: { marginVertical: 2 },
    hr: { backgroundColor: colors.border, height: 1, marginVertical: spacing.sm },
    table: { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
    thead: { backgroundColor: colors.surfaceElevated },
    th: { color: colors.text, fontWeight: "700" as const, padding: 6 },
    td: { color: colors.text, padding: 6 },
    tr: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  };
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
    errorBubble: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
    },
    bubbleText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    bubbleActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    bubbleActionBtn: {
      padding: 4,
      borderRadius: radius.xs,
    },
    retryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: "rgba(250,204,21,0.14)",
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
    },
    contextMenu: {
      position: "absolute",
      top: -4,
      right: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.sm,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      paddingVertical: spacing.xs,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
      zIndex: 100,
      minWidth: 130,
    },
    contextMenuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    contextMenuText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "600",
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
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      gap: spacing.lg,
    },
    emptyHint: {
      alignSelf: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.lg,
      width: "100%",
    },
    emptyHintTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      textAlign: "center",
    },
    emptyHintCopy: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 18,
      marginTop: 6,
      textAlign: "center",
    },
    promptChips: {
      gap: spacing.sm,
    },
    promptChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    promptChipText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
      flex: 1,
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
