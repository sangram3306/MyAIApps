import { useMemo } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing, typography } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";

const quickActions = [
  {
    icon: "chatbox-ellipses-outline",
    title: "Smart Reply",
    subtitle: "Reply instantly",
    route: "/tools/reply",
    accent: "primary",
  },
  {
    icon: "create-outline",
    title: "Rewrite",
    subtitle: "Polish text",
    route: "/tools/rewrite",
    accent: "cyan",
  },
  {
    icon: "checkmark-done-outline",
    title: "Grammar",
    subtitle: "Fix mistakes",
    route: "/tools/grammar",
    accent: "primary",
  },
  {
    icon: "wallet-outline",
    title: "Expense Tracker",
    subtitle: "Track & analyze",
    route: "/(tabs)/expenses",
    accent: "purple",
  },
  {
    icon: "color-wand-outline",
    title: "Creator Studio",
    subtitle: "Repurpose content",
    route: "/(tabs)/creator",
    accent: "purple",
  },
  {
    icon: "sparkles-outline",
    title: "Smart Coach",
    subtitle: "Get guidance",
    route: "/tools/coach",
    accent: "cyan",
  },
] as const;

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  return (
    <View style={styles.screen}>
      <MatrixBackground density={14} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.heroShell}>
          <View style={styles.headerTop}>
            <Image
              accessibilityLabel="SP ONE"
              resizeMode="contain"
              source={require("../../assets/brand/sp_one_label.png")}
              style={styles.wordmark}
            />
            <Pressable
              accessibilityLabel="Open profile"
              onPress={() => router.push("/(tabs)/profile" as never)}
              style={styles.avatar}
            >
              <View style={styles.avatarInner}>
                <Ionicons name="person" color={colors.primary} size={16} />
              </View>
            </Pressable>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroKicker}>Good evening,</Text>
            <Text style={styles.heroTitle}>Sangram 👋</Text>
            <Text style={styles.subtitle}>What would you like to do today?</Text>
          </View>

          <Pressable onPress={() => router.push("/(tabs)/chat" as never)} style={styles.commandBar}>
            <TextInput
              editable={false}
              pointerEvents="none"
              placeholder="Ask anything or choose an action..."
              placeholderTextColor={colors.textMuted}
              style={styles.commandInput}
            />
            <View style={styles.commandIcon}>
              <Ionicons name="mic" color={colors.onPrimary} size={15} />
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Quick actions" />
          <View style={styles.quickGrid}>
            {quickActions.map((action) => (
              <QuickActionCard
                key={action.title}
                icon={action.icon}
                title={action.title}
                subtitle={action.subtitle}
                accent={action.accent}
                onPress={() => router.push(action.route as never)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Today at a glance" action="View analytics" />
          <View style={styles.statsRow}>
            <StatCard value="12" label="Tasks Completed" accent="primary" />
            <StatCard value="AED 2,450" label="Expenses Tracked" accent="primary" />
            <StatCard value="3" label="Tools Used" accent="purple" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, action }: { title: string; action?: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createSectionStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {action ? <Text style={styles.action}>{action}</Text> : null}
    </View>
  );
}

function QuickActionCard({
  icon,
  title,
  subtitle,
  accent,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accent: "primary" | "purple" | "cyan";
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createActionStyles(colors), [colors]);
  const accentStyles =
    accent === "purple"
      ? {
          card: styles.purpleCard,
          iconShell: styles.purpleIconShell,
          icon: styles.purpleIcon,
        }
      : accent === "cyan"
        ? {
            card: styles.cyanCard,
            iconShell: styles.cyanIconShell,
            icon: styles.cyanIcon,
          }
        : {
            card: styles.primaryCard,
            iconShell: styles.primaryIconShell,
            icon: styles.primaryIcon,
          };

  return (
    <Pressable onPress={onPress} style={[styles.card, accentStyles.card]}>
      <View style={styles.cardTop}>
        <View style={[styles.iconShell, accentStyles.iconShell]}>
          <Ionicons name={icon} color={accentStyles.icon.color} size={16} />
        </View>
        <Ionicons name="chevron-forward" color={colors.textMuted} size={16} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Pressable>
  );
}

function StatCard({ value, label, accent }: { value: string; label: string; accent: "primary" | "purple" }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStatStyles(colors), [colors]);
  const isPurple = accent === "purple";
  return (
    <View style={[styles.card, isPurple ? styles.purpleCard : styles.primaryCard]}>
      <Text style={[styles.value, isPurple && styles.purpleValue]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
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
      gap: 14,
      paddingBottom: spacing.xl,
      paddingHorizontal: 20,
      paddingTop: Math.max(12, topInset + spacing.xs),
    },
    heroShell: {
      gap: 12,
      overflow: "hidden",
      paddingBottom: 0,
    },
    headerTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 34,
    },
    wordmark: {
      height: 28,
      width: 154,
    },
    avatar: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 35,
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      width: 35,
    },
    avatarInner: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderRadius: radius.pill,
      height: 27,
      justifyContent: "center",
      width: 27,
    },
    heroCopy: {
      gap: 0,
      marginTop: 2,
    },
    heroKicker: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    heroTitle: {
      color: colors.text,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -1,
      marginTop: -5,
    },
    subtitle: {
      color: colors.cyan,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 16,
    },
    commandBar: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 42,
      paddingHorizontal: 10,
    },
    commandInput: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      fontWeight: "600",
    },
    commandIcon: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      height: 28,
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOpacity: 0.32,
      shadowRadius: 12,
      width: 28,
    },
    section: {
      gap: 7,
    },
    quickGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 9,
    },
    statsRow: {
      flexDirection: "row",
      gap: 8,
    },
  });
}

function createSectionStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    header: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 22,
    },
    title: {
      color: colors.primary,
      fontSize: typography.micro,
      fontWeight: "900",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    action: {
      color: colors.purple,
      fontSize: typography.micro,
      fontWeight: "800",
    },
  });
}

function createActionStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexBasis: "47%",
      flexGrow: 1,
      gap: 5,
      minHeight: 96,
      padding: 11,
    },
    primaryCard: {
      borderColor: colors.primaryBorder,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    purpleCard: {
      borderColor: colors.secondarySoft,
      shadowColor: colors.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    cyanCard: {
      borderColor: colors.cyanSoft,
      shadowColor: colors.cyan,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    cardTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    iconShell: {
      alignItems: "center",
      borderRadius: 9,
      height: 26,
      justifyContent: "center",
      width: 26,
    },
    primaryIconShell: {
      backgroundColor: colors.primaryDim,
    },
    purpleIconShell: {
      backgroundColor: colors.secondarySoft,
    },
    cyanIconShell: {
      backgroundColor: colors.cyanSoft,
    },
    primaryIcon: {
      color: colors.primary,
    },
    purpleIcon: {
      color: colors.purple,
    },
    cyanIcon: {
      color: colors.cyan,
    },
    title: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 10,
      lineHeight: 13,
    },
  });
}

function createStatStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      minHeight: 90,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    primaryCard: {
      borderColor: colors.primaryBorder,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
    },
    purpleCard: {
      borderColor: colors.secondarySoft,
      shadowColor: colors.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
    },
    value: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
    },
    purpleValue: {
      color: colors.purple,
    },
    label: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "600",
      lineHeight: 14,
      marginTop: 2,
    },
  });
}
