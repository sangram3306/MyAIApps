import { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";

const tools = [
  {
    title: "Smart Coach",
    subtitle: "Decode intent, emotion, and risk before you reply.",
    icon: "sparkles-outline",
    route: "/coach",
    tag: "Coach",
  },
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
  {
    title: "Watch Tracker",
    subtitle: "Log movies or series, enrich details with AI, and track status.",
    icon: "film-outline",
    route: "/watch-tracker",
    tag: "Movies",
  },
] as const;

export default function AiToolsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setVisible(true);
    }, []),
  );

  function closeMenu() {
    setVisible(false);
    router.replace("/(tabs)/index" as never);
  }

  function openTool(route: string) {
    setVisible(false);
    router.push(route as never);
  }

  return (
    <View style={styles.screen}>
      <Modal
        animationType="slide"
        onRequestClose={closeMenu}
        transparent
        visible={visible}
      >
        <View style={styles.overlay}>
          <Pressable onPress={closeMenu} style={styles.backdrop} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <View style={styles.badge}>
                <Ionicons name="ellipsis-horizontal-circle-outline" color={colors.primary} size={16} />
                <Text style={styles.badgeText}>More</Text>
              </View>
              <Text style={styles.title}>AI-powered tools</Text>
              <Text style={styles.subtitle}>
                Pick a focused tool from this quick access menu.
              </Text>
            </View>
            <ScrollView contentContainerStyle={styles.grid}>
              {tools.map((tool) => (
                <Pressable
                  key={tool.title}
                  onPress={() => openTool(tool.route)}
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
            </ScrollView>
            <View style={styles.footer}>
              <Pressable onPress={closeMenu} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    overlay: {
      backgroundColor: "rgba(6, 9, 14, 0.35)",
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      flex: 1,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopColor: colors.borderStrong,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderTopWidth: 1,
      maxHeight: "86%",
      minHeight: "60%",
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
    },
    handle: {
      alignSelf: "center",
      backgroundColor: colors.borderStrong,
      borderRadius: 999,
      height: 5,
      width: 54,
    },
    header: {
      gap: spacing.xs,
      paddingBottom: spacing.sm,
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
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21,
    },
    grid: {
      gap: spacing.md,
      paddingBottom: spacing.md,
    },
    toolCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 20,
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
    footer: {
      paddingBottom: spacing.md,
      paddingTop: spacing.xs,
    },
    closeButton: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 14,
      borderWidth: 1,
      minHeight: 46,
      justifyContent: "center",
    },
    closeButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
    },
  });
}
