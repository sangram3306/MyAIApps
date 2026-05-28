import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";

const tools = [
  {
    title: "Decision Simulator",
    subtitle: "Compare choices, risks, regret, experiments, and next steps.",
    icon: "git-compare-outline",
    route: "/decision-simulator",
    tag: "ReAct + DB",
  },
  {
    title: "Personal Skill Tree",
    subtitle: "Turn any skill into branches, quests, milestones, and proof-of-skill practice.",
    icon: "analytics-outline",
    route: "/skill-tree",
    tag: "Skill map",
  },
  {
    title: "Learning Roadmap",
    subtitle: "Build a project-first path with phases, checkpoints, and weekly practice.",
    icon: "map-outline",
    route: "/learning-roadmap",
    tag: "Roadmap",
  },
] as const;

export default function AiToolsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.badge}>
          <Ionicons name="sparkles-outline" color={colors.primary} size={16} />
          <Text style={styles.badgeText}>AI tools</Text>
        </View>
        <Text style={styles.title}>Useful agents, not just chat</Text>
        <Text style={styles.subtitle}>
          Focused tools powered by LLM reasoning, MCP tools, MongoDB memory, and agent loops.
        </Text>
      </View>

      <View style={styles.grid}>
        {tools.map((tool) => (
          <Pressable
            key={tool.title}
            onPress={() => router.push(tool.route as never)}
            style={styles.toolCard}
          >
            <View style={styles.toolTop}>
              <View style={styles.toolIcon}>
                <Ionicons name={tool.icon} color={colors.primary} size={22} />
              </View>
              <View style={styles.toolTag}>
                <Text style={styles.toolTagText}>{tool.tag}</Text>
              </View>
            </View>
            <Text style={styles.toolTitle}>{tool.title}</Text>
            <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
            <View style={styles.toolFooter}>
              <Text style={styles.openText}>Open tool</Text>
              <Ionicons name="chevron-forward" color={colors.primary} size={17} />
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      gap: spacing.lg,
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    hero: {
      gap: spacing.xs,
      paddingTop: spacing.md,
    },
    badge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    badgeText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -1,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 23,
    },
    grid: {
      gap: spacing.md,
    },
    toolCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    toolTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    toolIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 16,
      borderWidth: 1,
      height: 46,
      justifyContent: "center",
      width: 46,
    },
    toolTag: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    toolTagText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    toolTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "900",
    },
    toolSubtitle: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 20,
    },
    toolFooter: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
      paddingTop: spacing.xs,
    },
    openText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
    },
  });
}
