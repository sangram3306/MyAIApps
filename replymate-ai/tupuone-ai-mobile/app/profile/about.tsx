import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import Constants from "expo-constants";

const CORE_FEATURES = [
  {
    title: "AI Companion",
    description: "Your intelligent, always-on chat assistant powered by top-tier language models.",
    icon: "sparkles",
    color: "#00FFC6", // primary
  },
  {
    title: "CineTrack Library",
    description: "Discover, curate, and track your movies with AI-driven insights and recommendations.",
    icon: "film",
    color: "#FF3366", // accent
  },
  {
    title: "Smart Finance",
    description: "Take control of your budget and expenses with automated categorization and analysis.",
    icon: "wallet",
    color: "#FFD700",
  },
  {
    title: "ReplyMate Intelligence",
    description: "Instantly draft, rewrite, and perfect your messages across any platform.",
    icon: "chatbubbles",
    color: "#B48EAD",
  },
] as const;

export default function AboutScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const appVersion = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <View style={styles.screen}>
      <MatrixBackground density={10} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" color={colors.textMuted} size={20} />
          </Pressable>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="infinite" color={colors.primary} size={64} />
          </View>
          <Text style={styles.appName}>SP ONE</Text>
          <Text style={styles.versionText}>Version {appVersion}</Text>
          <Text style={styles.motto}>
            "Empowering your daily life through intelligent, seamless AI."
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Core Features</Text>
        </View>

        <View style={styles.featuresContainer}>
          {CORE_FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={[styles.featureIconBox, { backgroundColor: `${feature.color}15` }]}>
                <Ionicons name={feature.icon as any} color={feature.color} size={24} />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.companyName}>SP International Co. ltd</Text>
          <Text style={styles.companySubtitle}>Designed with precision and intelligence.</Text>
          <Text style={styles.companySubtitle}>© {new Date().getFullYear()} All rights reserved</Text>
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
      paddingBottom: spacing.xxl,
      gap: 20,
      paddingHorizontal: 20,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      paddingTop: spacing.xs,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    heroSection: {
      alignItems: "center",
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    logoContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: "rgba(0,255,198,0.05)",
      borderColor: "rgba(0,255,198,0.2)",
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
    },
    appName: {
      color: colors.text,
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: 2,
    },
    versionText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "800",
      marginTop: spacing.xs,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    motto: {
      color: colors.textMuted,
      fontSize: 16,
      fontWeight: "500",
      fontStyle: "italic",
      textAlign: "center",
      marginTop: spacing.xl,
      lineHeight: 24,
      paddingHorizontal: spacing.lg,
    },
    sectionHeader: {
      marginTop: spacing.sm,
      marginBottom: -spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    featuresContainer: {
      gap: spacing.md,
    },
    featureCard: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
    },
    featureIconBox: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    featureTextContainer: {
      flex: 1,
    },
    featureTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 4,
    },
    featureDescription: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 18,
    },
    footer: {
      alignItems: "center",
      marginTop: spacing.xxl,
      gap: 4,
      opacity: 0.8,
    },
    companyName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    companySubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
  });
}
