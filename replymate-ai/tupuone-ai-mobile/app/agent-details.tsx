import { useMemo } from "react";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { ChatAgentEvent, ChatToolCall } from "../services/api";
import { getAgentDetails } from "../storage/agentDetailsStore";

type LoopStep = {
  title: string;
  subtitle: string;
  detail: string;
  kind: "user" | "llm" | "tool" | "mcp" | "final";
};

export default function AgentDetailsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const params = useLocalSearchParams<{ id?: string }>();
  const record = params.id ? getAgentDetails(params.id) : undefined;

  if (!record) {
    return (
      <View style={styles.emptyContainer}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.primary} size={18} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.emptyTitle}>Agent details unavailable</Text>
        <Text style={styles.emptyText}>
          This response detail is stored for the current app session. Please return to chat and open
          a recent response.
        </Text>
      </View>
    );
  }

  const steps = buildLoopSteps(
    record.userMessage,
    record.assistantReply,
    record.response.toolCalls,
    record.response.agentEvents || [],
  );
  const pills = buildPills(record.response.toolCalls, record.response.metadata.toolSources);

  return (
    <View style={styles.container}>
      <View style={styles.glowTop} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.primary} size={18} />
          <Text style={styles.backText}>Chat</Text>
        </Pressable>
        <Text style={styles.eyebrow}>Agent Diagnostics</Text>
        <Text style={styles.title}>AI Workflow</Text>
        <Text style={styles.subtitle}>
          User message enters the LLM, the LLM requests tools, MCP returns observations, then the
          LLM writes the final answer.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>User Message</Text>
          <Text style={styles.cardText}>{record.userMessage}</Text>
        </View>

        <View style={styles.loopCard}>
          <Text style={styles.sectionTitle}>Exact Agent Loop</Text>
          {steps.map((step, index) => {
            const stepKey = `${step.title}-${index}`;
            return (
              <View key={stepKey} style={styles.stepRow}>
                <View style={[styles.stepIcon, stepIconStyle(styles, step.kind)]}>
                  <Text style={styles.stepNumber}>{index + 1}</Text>
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                  <Text style={styles.stepDetail}>{step.detail}</Text>
                </View>
                {index < steps.length - 1 ? <View style={styles.stepLine} /> : null}
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Skills And Tools Used</Text>
          <View style={styles.pillGrid}>
            {pills.map((pill) => (
              <View key={`${pill.kind}-${pill.label}`} style={styles.pill}>
                <Text style={styles.pillKind}>{pill.kind}</Text>
                <Text style={styles.pillLabel}>{pill.label}</Text>
                {pill.usesDb ? <Text style={styles.dbBadge}>DB</Text> : null}
                <Text style={styles.pillSource}>{pill.source}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Final LLM Response</Text>
          <Text style={styles.cardText}>{record.assistantReply}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function buildLoopSteps(
  userMessage: string,
  assistantReply: string,
  toolCalls: ChatToolCall[],
  agentEvents: ChatAgentEvent[],
): LoopStep[] {
  if (agentEvents.length) {
    return buildEventLoopSteps(userMessage, assistantReply, agentEvents);
  }

  const steps: LoopStep[] = [
    {
      title: "User -> LLM",
      subtitle: "Prompt enters agent",
      detail: userMessage,
      kind: "user",
    },
    {
      title: "LLM evaluates skills and tools",
      subtitle: "Intent and next action",
      detail: toolCalls.length
        ? `LLM selected ${toolCalls.length} tool call${toolCalls.length === 1 ? "" : "s"}.`
        : "LLM decided no tool was needed.",
      kind: "llm",
    },
  ];

  toolCalls.forEach((tool, index) => {
    steps.push({
      title: `LLM -> Tool ${index + 1}`,
      subtitle: formatToolName(tool.name),
      detail: `Requested protected backend tool: ${tool.name}.`,
      kind: "tool",
    });
    steps.push({
      title: "Tool -> MCP Result",
      subtitle: `${tool.source.toUpperCase()}${isDatabaseTool(tool.name) ? " / MongoDB" : ""}`,
      detail: tool.summary,
      kind: "mcp",
    });
    steps.push({
      title: "MCP Result -> LLM",
      subtitle: "Observation returned",
      detail: "The tool result was sent back to the LLM before the next decision.",
      kind: "llm",
    });
  });

  steps.push({
    title: "LLM -> Final Response",
    subtitle: "Answer Generator",
    detail: assistantReply,
    kind: "final",
  });

  return steps;
}

function buildEventLoopSteps(
  userMessage: string,
  assistantReply: string,
  agentEvents: ChatAgentEvent[],
): LoopStep[] {
  const steps: LoopStep[] = [
    {
      title: "User -> LLM",
      subtitle: "Prompt enters agent",
      detail: userMessage,
      kind: "user",
    },
  ];

  agentEvents.forEach((event) => {
    if (event.type === "llm") {
      steps.push({
        title: "LLM Decision",
        subtitle: event.title,
        detail: summarizeEventResponse(event.response),
        kind: "llm",
      });
      return;
    }

    if (event.type === "tool") {
      steps.push({
        title: "Backend Tool Call",
        subtitle: event.title,
        detail: summarizeEventResponse(event.request),
        kind: "tool",
      });
      return;
    }

    if (event.type === "mcp") {
      steps.push({
        title: "MCP Tool Result",
        subtitle: event.title,
        detail: summarizeEventResponse(event.response),
        kind: "mcp",
      });
      steps.push({
        title: "MCP Result -> LLM",
        subtitle: "Observation returned",
        detail: "The sanitized tool result was sent back to the LLM.",
        kind: "llm",
      });
      return;
    }

    steps.push({
      title: "LLM -> Final Response",
      subtitle: event.title,
      detail: assistantReply,
      kind: "final",
    });
  });

  if (!agentEvents.some((event) => event.type === "final")) {
    steps.push({
      title: "LLM -> Final Response",
      subtitle: "Answer Generator",
      detail: assistantReply,
      kind: "final",
    });
  }

  return steps;
}

function summarizeEventResponse(value: unknown): string {
  if (!value || typeof value !== "object") {
    return String(value || "No response payload.");
  }

  const record = value as Record<string, unknown>;
  if (typeof record.summary === "string") {
    return record.summary;
  }

  if (typeof record.assistantReply === "string") {
    return record.assistantReply;
  }

  if (typeof record.toolName === "string") {
    return `Selected ${record.toolName}.`;
  }

  if (typeof record.status === "string") {
    return record.status;
  }

  return "Open request/response to inspect the payload.";
}

function buildPills(
  toolCalls: ChatToolCall[],
  toolSources: Record<string, "static" | "llm" | "fallback">,
) {
  return toolCalls.map((tool) => ({
    kind: isDatabaseTool(tool.name) ? "DB Tool" : "Tool",
    label: formatToolName(tool.name),
    usesDb: isDatabaseTool(tool.name),
    source: toolSources[tool.name] || tool.source,
  }));
}

function stepIconStyle(
  styles: ReturnType<typeof createStyles>,
  kind: LoopStep["kind"],
) {
  if (kind === "user") return styles.userIcon;
  if (kind === "llm") return styles.llmIcon;
  if (kind === "tool") return styles.toolIcon;
  if (kind === "mcp") return styles.mcpIcon;
  return styles.finalIcon;
}

function formatToolName(toolName: string): string {
  return toolName.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
}

function isDatabaseTool(toolName: string): boolean {
  return /todo|expense/i.test(toolName);
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      flex: 1,
      padding: spacing.md,
      paddingTop: Math.max(spacing.md, topInset),
    },
    glowTop: {
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 180,
      opacity: 0.18,
      position: "absolute",
      right: -60,
      top: -30,
      width: 180,
    },
    header: {
      gap: spacing.sm,
      paddingTop: 0,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      alignSelf: "flex-start",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    backText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
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
      fontSize: 30,
      fontWeight: "900",
    },
    subtitle: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
    },
    content: {
      gap: spacing.md,
      paddingBottom: spacing.xl,
      paddingTop: spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    cardLabel: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    cardText: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 22,
    },
    loopCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    stepRow: {
      gap: spacing.sm,
      paddingLeft: spacing.sm,
      position: "relative",
    },
    stepIcon: {
      alignItems: "center",
      borderRadius: 999,
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    userIcon: {
      backgroundColor: colors.primarySoft,
    },
    llmIcon: {
      backgroundColor: colors.secondarySoft,
    },
    toolIcon: {
      backgroundColor: colors.amber,
    },
    mcpIcon: {
      backgroundColor: colors.primarySoft,
    },
    finalIcon: {
      backgroundColor: colors.primary,
    },
    stepNumber: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
    },
    stepBody: {
      marginLeft: 40,
      marginTop: -28,
      gap: 4,
    },
    stepTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
    stepSubtitle: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    stepDetail: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    stepLine: {
      backgroundColor: colors.border,
      bottom: -8,
      left: 13,
      position: "absolute",
      top: 28,
      width: 1,
    },
    pillGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    pill: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      gap: 4,
      minWidth: "47%",
      padding: spacing.md,
    },
    pillKind: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    pillLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },
    dbBadge: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    pillSource: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    emptyContainer: {
      backgroundColor: colors.background,
      flex: 1,
      gap: spacing.md,
      justifyContent: "center",
      padding: spacing.md,
      paddingTop: Math.max(spacing.md, topInset),
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "900",
    },
    emptyText: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
    },
  });
}
