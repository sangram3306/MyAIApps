import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing, typography } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { getBackendUrl } from "../../storage/appStorage";
import {
  ExpenseItem,
  getExpenseExportFromApi,
  listWatchItemsFromApi,
  WatchEntry,
} from "../../services/api";

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
  {
    icon: "git-branch-outline",
    title: "Decision Simulator",
    subtitle: "Compare choices",
    route: "/decision-simulator",
    accent: "primary",
  },
  {
    icon: "trending-up-outline",
    title: "Personal Skill Tree",
    subtitle: "Grow skills",
    route: "/skill-tree",
    accent: "cyan",
  },
  {
    icon: "book-outline",
    title: "Learning Roadmap",
    subtitle: "Plan learning",
    route: "/learning-roadmap",
    accent: "purple",
  },
] as const;

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [monthSpend, setMonthSpend] = useState<GlanceSpend | null>(null);
  const [watchPick, setWatchPick] = useState<WatchPick | null>(null);
  const [watchCandidates, setWatchCandidates] = useState<WatchPick[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadGlance() {
        try {
          const backendUrl = await getBackendUrl();
          const [expenseExport, watchList] = await Promise.all([
            getExpenseExportFromApi({ backendUrl }).catch(() => null),
            listWatchItemsFromApi({ backendUrl }).catch(() => null),
          ]);

          if (!active) {
            return;
          }

          setMonthSpend(expenseExport ? buildMonthSpend(expenseExport.expenses) : null);
          const candidates = watchList ? getStreamingCandidates(watchList.entries) : [];
          setWatchCandidates(candidates);
          setWatchPick(pickDailyTitle(candidates));
        } catch {
          if (active) {
            setMonthSpend(null);
            setWatchCandidates([]);
            setWatchPick(null);
          }
        }
      }

      void loadGlance();

      return () => {
        active = false;
      };
    }, []),
  );

  function handleRefreshWatchPick() {
    if (!watchCandidates.length) {
      return;
    }
    if (watchCandidates.length === 1) {
      setWatchPick(watchCandidates[0]);
      return;
    }
    let nextPick = watchPick;
    while (!nextPick || nextPick.title === watchPick?.title) {
      const randomIndex = Math.floor(Math.random() * watchCandidates.length);
      nextPick = watchCandidates[randomIndex];
    }
    setWatchPick(nextPick);
  }

  return (
    <View style={styles.screen}>
      <MatrixBackground density={14} />
      <View style={styles.container}>
        <View style={styles.heroShell}>
          <View style={styles.headerTop}>
            <View style={styles.brandBlock}>
              <View style={styles.wordmarkClip}>
                <Image
                  accessibilityLabel="SP ONE"
                  resizeMode="contain"
                  source={require("../../assets/brand/sp_one_label.png")}
                  style={styles.wordmark}
                />
              </View>
              <Text style={styles.brandCredit}>by Sangram</Text>
            </View>
            <Pressable
              accessibilityLabel="Open profile"
              onPress={() => router.push("/(tabs)/profile" as never)}
              style={styles.avatar}
            >
              <View style={styles.avatarInner}>
                <Ionicons name="person" color={colors.primary} size={13} />
              </View>
            </Pressable>
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
              <Ionicons name="arrow-forward" color={colors.onPrimary} size={15} />
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Tools" />
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
          <SectionHeader title="Today at a glance" />
          <View style={styles.glanceGrid}>
            <GlanceCard
              icon="wallet-outline"
              label="Spend this month"
              value={monthSpend ? formatAmount(monthSpend.total, monthSpend.currency) : "No spend yet"}
              accent="primary"
            />
            <GlanceCard
              icon="film-outline"
              label={watchPick?.providers.length ? watchPick.providers.join(" + ") : "Prime IN + Netflix IN"}
              value={watchPick?.title || "No planned pick yet"}
              accent="purple"
              onRefresh={watchCandidates.length > 1 ? handleRefreshWatchPick : undefined}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

type GlanceSpend = {
  total: number;
  currency: "AED" | "INR";
};

type WatchPick = {
  title: string;
  providers: string[];
};



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

function GlanceCard({
  icon,
  label,
  value,
  accent,
  onRefresh,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: "primary" | "purple";
  onRefresh?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createGlanceStyles(colors), [colors]);
  const isPurple = accent === "purple";

  return (
    <View style={[styles.card, isPurple ? styles.purpleCard : styles.primaryCard]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconShell, isPurple ? styles.purpleIconShell : styles.primaryIconShell]}>
          <Ionicons name={icon} color={isPurple ? colors.purple : colors.primary} size={15} />
        </View>
        {onRefresh ? (
          <Pressable hitSlop={12} onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" color={isPurple ? colors.purple : colors.primary} size={13} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
      <Text numberOfLines={2} style={[styles.value, isPurple && styles.purpleValue]}>
        {value}
      </Text>
    </View>
  );
}

function buildMonthSpend(expenses: ExpenseItem[]): GlanceSpend {
  const now = new Date();
  const monthExpenses = expenses.filter((expense) => {
    const parsed = parseExpenseDate(expense.date || expense.createdAt);
    return parsed.getFullYear() === now.getFullYear() && parsed.getMonth() === now.getMonth();
  });
  const currency = commonCurrency(monthExpenses) || "AED";
  const total = monthExpenses
    .filter((expense) => (expense.currency || "AED") === currency)
    .reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);

  return { total, currency };
}

function getStreamingCandidates(entries: WatchEntry[]): WatchPick[] {
  return entries
    .filter((entry) => entry.status === "planned")
    .map((entry) => ({
      title: entry.title,
      providers: streamingProvidersInIndia(entry.availability || []),
    }))
    .filter((item) => item.providers.length > 0);
}

function pickDailyTitle(candidates: WatchPick[]): WatchPick | null {
  if (!candidates.length) {
    return null;
  }
  const dateStr = new Date().toDateString(); // E.g., "Wed Jun 10 2026"
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % candidates.length;
  return candidates[index];
}

function streamingProvidersInIndia(availability: WatchEntry["availability"]): string[] {
  const providers = new Set<string>();

  for (const item of availability || []) {
    const provider = (item.provider || "").toLowerCase();
    const region = (item.region || "").toLowerCase();
    const isIndia = region === "in" || region.includes("india");
    const isStreaming = item.type === "stream" || item.type === "free" || item.type === "ads";

    if (!isIndia || !isStreaming) {
      continue;
    }

    if (provider.includes("netflix")) {
      providers.add("Netflix IN");
    }
    if (provider.includes("amazon") || provider.includes("prime")) {
      providers.add("Prime IN");
    }
  }

  return [...providers];
}

function parseExpenseDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function commonCurrency(expenses: ExpenseItem[]): "AED" | "INR" | null {
  const currencies = new Set(expenses.map((expense) => expense.currency || "AED"));
  if (currencies.size === 1) {
    return [...currencies][0] as "AED" | "INR";
  }
  return null;
}

function formatAmount(value: number, currency: "AED" | "INR"): string {
  return `${currency} ${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  })}`;
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
      paddingTop: Math.max(4, topInset),
    },
    heroShell: {
      gap: 5,
      overflow: "hidden",
      paddingBottom: 0,
    },
    headerTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      minHeight: 42,
      position: "relative",
      width: "100%",
    },
    brandBlock: {
      alignItems: "center",
      gap: 0,
      marginLeft: 72,
      top: -10,
    },
    wordmarkClip: {
      height: 42,
      overflow: "hidden",
      marginLeft: 0,
      width: 172,
    },
    wordmark: {
      height: 118,
      left: -106,
      position: "absolute",
      top: -44,
      width: 314,
    },
    brandCredit: {
      alignSelf: "flex-start",
      color: colors.textMuted,
      fontSize: 8,
      fontWeight: "700",
      letterSpacing: 0.6,
      marginLeft: 24,
      marginTop: -21,
    },
    avatar: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderRadius: radius.pill,
      borderWidth: 1,
      height: 28,
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      position: "absolute",
      left: 0,
      top: 0,
      width: 28,
    },
    avatarInner: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderRadius: radius.pill,
      height: 22,
      justifyContent: "center",
      width: 22,
    },
    heroCopy: {
      marginTop: 2,
      marginBottom: spacing.xs,
    },
    heroKicker: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "400",
    },
    heroTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: -0.4,
    },
    commandBar: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 42,
      marginTop: 20,
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
    glanceGrid: {
      flexDirection: "row",
      gap: 9,
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
      borderWidth: 1,
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
      borderColor: colors.purple + "59",
      shadowColor: colors.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    cyanCard: {
      borderColor: colors.cyan + "59",
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

function createGlanceStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      flex: 1,
      gap: 5,
      minHeight: 96,
      padding: 11,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      width: "100%",
    },
    refreshButton: {
      alignItems: "center",
      justifyContent: "center",
      padding: 2,
    },
    primaryCard: {
      borderColor: colors.primaryBorder,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
    },
    purpleCard: {
      borderColor: colors.purple + "59",
      shadowColor: colors.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
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
    label: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 13,
      textTransform: "uppercase",
    },
    value: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
      lineHeight: 18,
    },
    purpleValue: {
      color: colors.text,
    },
  });
}
