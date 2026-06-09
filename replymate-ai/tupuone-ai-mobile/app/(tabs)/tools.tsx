import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";

const tools = [
  {
    title: "Smart Coach",
    subtitle: "Decode intent, emotion and risk before you reply.",
    icon: "sparkles-outline",
    route: "/tools/coach",
    badge: "Coach",
  },
  {
    title: "Decision Simulator",
    subtitle: "Compare choices, risks and outcomes.",
    icon: "git-compare-outline",
    route: "/decision-simulator",
    badge: "AI",
  },
  {
    title: "Personal Skill Tree",
    subtitle: "Build skills, complete quests and track progress.",
    icon: "analytics-outline",
    route: "/skill-tree",
    badge: "Skill",
  },
  {
    title: "Learning Roadmap",
    subtitle: "Plan your learning journey step by step.",
    icon: "map-outline",
    route: "/learning-roadmap",
    badge: "Roadmap",
  },
  {
    title: "Watch Tracker",
    subtitle: "Log movies and series, get AI insights and track status.",
    icon: "film-outline",
    route: "/watch-tracker",
    badge: "Movies",
  },
] as const;

export default function AiToolsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTools = tools.filter((tool) => {
    const target = `${tool.title} ${tool.subtitle} ${tool.badge}`.toLowerCase();
    return target.includes(normalizedQuery);
  });

  function openTool(route: string) {
    if (!route) {
      return;
    }
    router.push(route as never);
  }

  return (
    <View style={styles.screen}>
      <MatrixBackground density={12} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Tools</Text>
          <Text style={styles.subtitle}>Powerful AI tools for everyday life</Text>
        </View>

        <View style={styles.searchShell}>
          <Ionicons name="search" color={colors.textMuted} size={15} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tools..."
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" color={colors.textMuted} size={17} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.list}>
          {filteredTools.map((tool, index) => (
            <Pressable key={tool.title} onPress={() => openTool(tool.route)} style={[styles.toolCard, index === 0 && styles.toolCardActive]}>
              <View style={[styles.toolIcon, index === 0 && styles.toolIconActive]}>
                <Ionicons name={tool.icon} color={colors.primary} size={19} />
              </View>
              <View style={styles.toolCopy}>
                <Text style={styles.toolTitle}>{tool.title}</Text>
                <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{tool.badge}</Text>
              </View>
            </Pressable>
          ))}
          {!filteredTools.length ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No tools found</Text>
              <Text style={styles.emptyCopy}>Try a different search term.</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      gap: 13,
      paddingHorizontal: 20,
      paddingBottom: spacing.xl,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    header: {
      gap: 4,
      paddingTop: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: 25,
      fontWeight: "900",
      letterSpacing: -0.6,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
    searchShell: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 40,
      paddingHorizontal: spacing.sm,
    },
    searchInput: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      fontWeight: "700",
    },
    list: {
      gap: 9,
    },
    toolCard: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 90,
      paddingHorizontal: spacing.sm,
      paddingVertical: 9,
    },
    toolCardActive: {
      borderColor: colors.primaryBorder,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
    },
    toolIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    toolIconActive: {
      borderColor: colors.primaryBorder,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 13,
    },
    toolCopy: {
      flex: 1,
      gap: 3,
    },
    toolTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    toolSubtitle: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "700",
      lineHeight: 14,
    },
    badge: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    badgeText: {
      color: colors.primary,
      fontSize: 8,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    emptyState: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.xs,
      padding: spacing.md,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    emptyCopy: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
    },
  });
}
