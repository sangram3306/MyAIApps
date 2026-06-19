import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing, typography } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { useAuth } from "../../context/auth";
import { getBackendUrl, getSearchAutocompletePreference } from "../../storage/appStorage";
import {
  ExpenseItem,
  getExpenseExportFromApi,
  listWatchItemsFromApi,
  WatchEntry,
} from "../../services/api";
import { CinetrackReadonlyModal } from "../../components/CinetrackReadonlyModal";
import { SettingsSidebar } from "../../components/SettingsSidebar";

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

interface SearchItem {
  type: "tool" | "setting";
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  keywords: string[];
}

const SEARCH_INDEX: SearchItem[] = [
  {
    type: "tool",
    title: "Smart Reply",
    subtitle: "Instantly draft replies using AI",
    icon: "chatbox-ellipses-outline",
    route: "/tools/reply",
    keywords: ["reply", "chat", "message", "write", "draft"],
  },
  {
    type: "tool",
    title: "Rewrite Polish",
    subtitle: "Polish your writing tone and structure",
    icon: "create-outline",
    route: "/tools/rewrite",
    keywords: ["rewrite", "polish", "edit", "write", "tone"],
  },
  {
    type: "tool",
    title: "Fix Grammar",
    subtitle: "Correct grammar and spelling issues",
    icon: "checkmark-done-outline",
    route: "/tools/grammar",
    keywords: ["grammar", "spell", "fix", "correct", "english"],
  },
  {
    type: "tool",
    title: "Creator Studio",
    subtitle: "Repurpose content across social channels",
    icon: "color-wand-outline",
    route: "/(tabs)/creator",
    keywords: ["creator", "platform", "repurpose", "social", "studio"],
  },
  {
    type: "tool",
    title: "Smart Coach",
    subtitle: "Relationship guidance and advice",
    icon: "sparkles-outline",
    route: "/tools/coach",
    keywords: ["coach", "relationship", "advise", "smart"],
  },
  {
    type: "tool",
    title: "Decision Simulator",
    subtitle: "Compare choices and simulate outcomes",
    icon: "git-branch-outline",
    route: "/decision-simulator",
    keywords: ["decision", "simulate", "compare", "choice"],
  },
  {
    type: "tool",
    title: "Personal Skill Tree",
    subtitle: "Grow skills and track progression",
    icon: "trending-up-outline",
    route: "/skill-tree",
    keywords: ["skill", "grow", "tree", "learn", "track"],
  },
  {
    type: "tool",
    title: "Learning Roadmap",
    subtitle: "Structured roadmap to master topics",
    icon: "book-outline",
    route: "/learning-roadmap",
    keywords: ["learning", "roadmap", "plan", "master", "topic"],
  },
  {
    type: "tool",
    title: "Expense Intelligence",
    subtitle: "Manage and analyze your budgets",
    icon: "wallet-outline",
    route: "/(tabs)/expenses",
    keywords: ["expense", "budget", "wallet", "spend", "money"],
  },
  {
    type: "tool",
    title: "CineTrack AI Library",
    subtitle: "Track movies, series and check watch favorites",
    icon: "film-outline",
    route: "/cinetrack-ai-library",
    keywords: ["movie", "show", "series", "watch", "film", "cinetrack"],
  },
  {
    type: "setting",
    title: "Appearance Settings",
    subtitle: "Change theme (Light, Dark, System)",
    icon: "contrast-outline",
    route: "/profile/settings?expand=appearance",
    keywords: ["theme", "appearance", "dark", "light", "system", "colors"],
  },
  {
    type: "setting",
    title: "Launch Screen Settings",
    subtitle: "Choose default starting tab of the app",
    icon: "phone-portrait-outline",
    route: "/profile/settings?expand=launch",
    keywords: ["launch", "start", "tab", "default", "screen"],
  },
  {
    type: "setting",
    title: "Model Provider Settings",
    subtitle: "Choose AI models (Gemini, OpenAI, OpenRouter)",
    icon: "hardware-chip-outline",
    route: "/llm-provider",
    keywords: ["model", "provider", "ai", "llm", "api", "gemini", "openai"],
  },
  {
    type: "setting",
    title: "Writing Output Settings",
    subtitle: "Set reply and rewrite response variations count",
    icon: "create-outline",
    route: "/profile/settings?expand=writing",
    keywords: ["writing", "output", "count", "reply", "rewrite", "variation"],
  },
  {
    type: "setting",
    title: "CineTrack Preferences",
    subtitle: "Configure Library-aware AI & LLM chat bypass",
    icon: "film-outline",
    route: "/profile/settings?expand=cinetrack",
    keywords: ["cinetrack", "movie", "settings", "preference", "context"],
  },
  {
    type: "setting",
    title: "App Lock Settings",
    subtitle: "Enable Biometrics (Face ID, Fingerprint, Passcode)",
    icon: "lock-closed-outline",
    route: "/profile/settings?expand=lock",
    keywords: ["lock", "app", "faceid", "fingerprint", "passcode", "security"],
  },

  {
    type: "setting",
    title: "About SP ONE",
    subtitle: "About page and credits",
    icon: "information-circle-outline",
    route: "/profile/about",
    keywords: ["about", "spone", "credit", "version"],
  },
  {
    type: "setting",
    title: "Subscriptions & Payment",
    subtitle: "Manage subscription plans and pro features",
    icon: "card-outline",
    route: "/profile/subscription",
    keywords: ["subscription", "payment", "pro", "plan", "coupon", "billing"],
  },
  {
    type: "setting",
    title: "Support & Help Desk",
    subtitle: "Contact support or read help files",
    icon: "help-circle-outline",
    route: "/profile/support",
    keywords: ["support", "help", "contact", "desk", "feedback"],
  },
];

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [monthSpend, setMonthSpend] = useState<GlanceSpend | null>(null);
  const [watchPick, setWatchPick] = useState<WatchPick | null>(null);
  const [watchCandidates, setWatchCandidates] = useState<WatchPick[]>([]);
  const [selectedWatchEntry, setSelectedWatchEntry] = useState<WatchEntry | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchAutocompleteEnabled, setSearchAutocompleteEnabled] = useState(true);

  const searchResults = useMemo(() => {
    if (!searchAutocompleteEnabled) return [];
    const q = searchText.trim().toLowerCase();
    if (!q) return [];
    return SEARCH_INDEX.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q))
    ).slice(0, 5);
  }, [searchText, searchAutocompleteEnabled]);

  const handleSearchSubmit = () => {
    const query = searchText.trim();
    setSearchText("");
    router.push({
      pathname: "/(tabs)/chat",
      params: query ? { query } : undefined,
    } as any);
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;

      getSearchAutocompletePreference().then((val) => {
        if (active) {
          setSearchAutocompleteEnabled(val);
        }
      });

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
            <Pressable
              accessibilityLabel="Open settings"
              onPress={() => setIsSidebarOpen(true)}
              style={styles.menuButton}
            >
              <Ionicons name="menu-outline" color={colors.text} size={28} />
            </Pressable>
            <View style={styles.brandBlock}>
              <View style={styles.wordmarkClip}>
                <Image
                  accessibilityLabel="SP ONE"
                  resizeMode="contain"
                  source={require("../../assets/brand/sp_one_label.png")}
                  style={styles.wordmark}
                  /></View>
              <Text style={styles.brandCredit}>by Sangram</Text>
            </View>
            <Pressable
              accessibilityLabel="Open profile"
              onPress={() => router.push("/(tabs)/profile" as never)}
              style={styles.avatar}
            >
              {user?.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarInner}>
                  <Ionicons name="person" color={colors.primary} size={13} />
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.commandBar}>
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                placeholder={searchAutocompleteEnabled ? "Ask anything or choose an action..." : "Ask anything..."}
                placeholderTextColor={colors.textMuted}
                style={styles.commandInput}
                onSubmitEditing={handleSearchSubmit}
              />
              <Pressable
                onPress={handleSearchSubmit}
                style={styles.commandIcon}
                accessibilityLabel="Send to chat"
              >
                <Ionicons name="arrow-forward" color={colors.onPrimary} size={15} />
              </Pressable>
            </View>

            {searchResults.length > 0 ? (
              <View style={styles.dropdownShell}>
                {searchResults.map((item) => (
                  <Pressable
                    key={item.route}
                    onPress={() => {
                      setSearchText("");
                      router.push(item.route as any);
                    }}
                    style={styles.dropdownItem}
                  >
                    <View style={[styles.dropdownIconShell, item.type === "setting" && styles.dropdownIconShellPurple]}>
                      <Ionicons name={item.icon} color={item.type === "setting" ? colors.purple : colors.primary} size={14} />
                    </View>
                    <View style={styles.dropdownTextWrap}>
                      <Text style={styles.dropdownItemTitle}>{item.title}</Text>
                      <Text style={styles.dropdownItemSubtitle}>{item.subtitle}</Text>
                    </View>
                    <Ionicons name="chevron-forward" color={colors.primaryBorder} size={14} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
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
              onPress={() => {
                if (watchPick?.entry) {
                  setSelectedWatchEntry(watchPick.entry);
                }
              }}
            />
          </View>
        </View>
      </View>
      <CinetrackReadonlyModal 
        entry={selectedWatchEntry} 
        onClose={() => setSelectedWatchEntry(null)} 
      />
      <SettingsSidebar visible={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
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
  entry?: WatchEntry;
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
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  accent: "primary" | "purple";
  onRefresh?: () => void;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createGlanceStyles(colors), [colors]);
  const isPurple = accent === "purple";

  return (
    <Pressable onPress={onPress} style={[styles.card, isPurple ? styles.purpleCard : styles.primaryCard]}>
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
    </Pressable>
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
      entry,
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
      paddingBottom: 0,
      zIndex: 10,
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
    menuButton: {
      alignItems: "center",
      justifyContent: "center",
      position: "absolute",
      left: 0,
      top: 0,
      height: 28,
      width: 28,
      zIndex: 10,
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
      right: 0,
      top: 0,
      width: 28,
    },
    avatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: radius.pill,
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
    searchContainer: {
      marginTop: 20,
      position: "relative",
      zIndex: 100,
      width: "100%",
    },
    dropdownShell: {
      position: "absolute",
      top: 48,
      left: 0,
      right: 0,
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: "hidden",
      zIndex: 1000,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 15,
      elevation: 8,
    },
    dropdownItem: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 48,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
    },
    dropdownIconShell: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderRadius: radius.sm,
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    dropdownIconShellPurple: {
      backgroundColor: colors.secondarySoft,
    },
    dropdownTextWrap: {
      flex: 1,
      gap: 1,
    },
    dropdownItemTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
    dropdownItemSubtitle: {
      color: colors.textMuted,
      fontSize: 10,
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
