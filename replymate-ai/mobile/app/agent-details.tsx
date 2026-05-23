import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../constants/theme";
import { ChatToolCall } from "../services/api";
import { getAgentDetails } from "../storage/agentDetailsStore";

type LoopStep = {
  title: string;
  subtitle: string;
  detail: string;
  kind: "user" | "llm" | "tool" | "mcp" | "final";
};

export default function AgentDetailsScreen() {
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
          This response detail is stored for the current app session. Please return to chat and open a recent response.
        </Text>
      </View>
    );
  }

  const steps = buildLoopSteps(record.userMessage, record.assistantReply, record.response.toolCalls);
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
        <Text style={styles.title}>ReAct Tool Loop</Text>
        <Text style={styles.subtitle}>
          User message enters the LLM, the LLM requests tools, MCP returns observations, then the LLM writes the final answer.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>User Message</Text>
          <Text style={styles.cardText}>{record.userMessage}</Text>
        </View>

        <View style={styles.loopCard}>
          <Text style={styles.sectionTitle}>Exact Agent Loop</Text>
          {steps.map((step, index) => (
            <View key={`${step.title}-${index}`} style={styles.stepRow}>
              <View style={[styles.stepIcon, styles[`${step.kind}Icon`]]}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                <Text style={styles.stepDetail}>{step.detail}</Text>
              </View>
              {index < steps.length - 1 ? <View style={styles.stepLine} /> : null}
            </View>
          ))}
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

function buildLoopSteps(userMessage: string, assistantReply: string, toolCalls: ChatToolCall[]): LoopStep[] {
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

function buildPills(
  toolCalls: ChatToolCall[],
  sources: {
    classifyIntent: "static" | "llm" | "fallback";
    todoSkill: "static" | "llm" | "fallback";
    answerGeneration: "static" | "llm" | "fallback";
  },
): Array<{
  kind: "Skill" | "Tool";
  label: string;
  source: "static" | "llm" | "fallback";
  usesDb?: boolean;
}> {
  return [
    {
      kind: "Skill",
      label: "LLM Tool Planner",
      source: sources.classifyIntent,
    },
    ...toolCalls.map((tool) => ({
      kind: "Tool" as const,
      label: formatToolName(tool.name),
      source: tool.source,
      usesDb: isDatabaseTool(tool.name),
    })),
    {
      kind: "Skill",
      label: "Final Answer Generator",
      source: sources.answerGeneration,
    },
  ];
}

function formatToolName(name: string): string {
  const labels: Record<string, string> = {
    createTodo: "Create Todo",
    listTodos: "List Todos",
    completeTodo: "Complete Todo",
    deleteTodo: "Delete Todo",
    updateTodo: "Update Todo",
  };

  return labels[name] || name;
}

function isDatabaseTool(name: string): boolean {
  return ["createTodo", "listTodos", "completeTodo", "deleteTodo", "updateTodo"].includes(name);
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  emptyContainer: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
  },
  glowTop: {
    backgroundColor: "rgba(69, 245, 198, 0.14)",
    borderRadius: 999,
    height: 220,
    position: "absolute",
    right: -110,
    top: -70,
    width: 220,
  },
  header: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 4,
    paddingVertical: spacing.xs,
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
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: "rgba(24, 27, 34, 0.96)",
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  loopCard: {
    backgroundColor: "rgba(24, 27, 34, 0.96)",
    borderColor: "rgba(69, 245, 198, 0.18)",
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  cardLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: spacing.md,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  stepRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
    position: "relative",
  },
  stepIcon: {
    alignItems: "center",
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  userIcon: {
    backgroundColor: "rgba(140, 124, 255, 0.22)",
  },
  llmIcon: {
    backgroundColor: "rgba(69, 245, 198, 0.18)",
  },
  toolIcon: {
    backgroundColor: "rgba(255, 209, 102, 0.18)",
  },
  mcpIcon: {
    backgroundColor: "rgba(69, 245, 198, 0.12)",
  },
  finalIcon: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
  },
  stepNumber: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "900",
  },
  stepBody: {
    flex: 1,
    gap: 3,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  stepSubtitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  stepDetail: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  stepLine: {
    backgroundColor: "rgba(69, 245, 198, 0.18)",
    bottom: -spacing.md,
    left: 14,
    position: "absolute",
    top: 32,
    width: 1,
  },
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  pill: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderColor: "rgba(69, 245, 198, 0.20)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  pillKind: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  pillLabel: {
    color: colors.text,
    fontSize: 10,
    fontWeight: "800",
  },
  dbBadge: {
    backgroundColor: "rgba(69, 245, 198, 0.12)",
    borderColor: "rgba(69, 245, 198, 0.24)",
    borderRadius: 999,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 8,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pillSource: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
  },
});
