import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import {
  getAutoCategorySuggestionsPreference,
  getBackendUrl,
  getBudgetTargetPreference,
  getBudgetWarningThresholdPreference,
  getQuickAddCategoriesPreference,
} from "../../storage/appStorage";
import { createExpenseFromApi } from "../../services/api";

const baseCategories: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}[] = [
  { label: "Food", icon: "restaurant-outline", accent: "#FFD166" },
  { label: "Groceries", icon: "basket-outline", accent: "#45F5C6" },
  { label: "Transport", icon: "car-outline", accent: "#7DD3FC" },
  { label: "Shopping", icon: "bag-outline", accent: "#F0ABFC" },
  { label: "Bills", icon: "receipt-outline", accent: "#FCA5A5" },
  { label: "Rent", icon: "home-outline", accent: "#C4B5FD" },
  { label: "Health", icon: "medkit-outline", accent: "#86EFAC" },
  { label: "Entertainment", icon: "game-controller-outline", accent: "#FDBA74" },
  { label: "Travel", icon: "airplane-outline", accent: "#93C5FD" },
  { label: "Education", icon: "school-outline", accent: "#A7F3D0" },
  { label: "Other", icon: "apps-outline", accent: "#CBD5E1" },
];

const categoryLookup: Record<string, string> = {
  food: "Food",
  groceries: "Groceries",
  grocery: "Groceries",
  transport: "Transport",
  taxi: "Transport",
  ride: "Transport",
  shopping: "Shopping",
  bills: "Bills",
  bill: "Bills",
  rent: "Rent",
  health: "Health",
  medicine: "Health",
  doctor: "Health",
  entertainment: "Entertainment",
  movie: "Entertainment",
  travel: "Travel",
  flight: "Travel",
  education: "Education",
  school: "Education",
};

export default function ExpensesScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [backendUrl, setBackendUrl] = useState("");
  const [budgetTarget, setBudgetTarget] = useState<number | null>(null);
  const [budgetWarningThreshold, setBudgetWarningThreshold] = useState(80);
  const [autoCategorySuggestions, setAutoCategorySuggestions] = useState(true);
  const [quickAddCategories, setQuickAddCategories] = useState<string[]>([
    "Food",
    "Groceries",
    "Transport",
  ]);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"AED" | "INR">("AED");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadData() {
        const [url, target, threshold, autoCategory, quickAdds] = await Promise.all([
          getBackendUrl(),
          getBudgetTargetPreference(),
          getBudgetWarningThresholdPreference(),
          getAutoCategorySuggestionsPreference(),
          getQuickAddCategoriesPreference(),
        ]);

        if (!isActive) {
          return;
        }

        setBackendUrl(url);
        setBudgetTarget(target);
        setBudgetWarningThreshold(threshold);
        setAutoCategorySuggestions(autoCategory);
        setQuickAddCategories(quickAdds);
      }

      void loadData();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const orderedCategories = useMemo(() => {
    const preferred = quickAddCategories
      .map((item) => item.trim())
      .filter(Boolean);
    const preferredSet = new Set(preferred.map((item) => item.toLowerCase()));
    const baseByLabel = new Map(baseCategories.map((item) => [item.label.toLowerCase(), item]));
    const featured = preferred.map((label) => {
      const matched = baseByLabel.get(label.toLowerCase());
      return (
        matched || {
          label,
          icon: "pricetag-outline" as const,
          accent: colors.secondary,
        }
      );
    });
    const rest = baseCategories.filter((item) => !preferredSet.has(item.label.toLowerCase()));
    return [...featured, ...rest];
  }, [colors.secondary, quickAddCategories]);

  useEffect(() => {
    if (!autoCategorySuggestions || !note.trim()) {
      return;
    }

    const inferred = inferCategory(note, quickAddCategories);
    if (inferred && inferred !== category) {
      setCategory(inferred);
    }
  }, [autoCategorySuggestions, category, note, quickAddCategories]);

  async function handleSaveExpense() {
    if (!backendUrl) {
      setError("ReplyMate AI could not find the backend URL. Please restart the app.");
      return;
    }

    const numericAmount = Number(amount.replace(/,/g, "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await createExpenseFromApi({
        backendUrl,
        amount: numericAmount,
        currency,
        category: category.toLowerCase(),
        description: note.trim() || category,
      });
      setAmount("");
      setNote("");
      warnIfOverBudget(response.total, budgetTarget, budgetWarningThreshold);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      style={styles.keyboard}
    >
      <MatrixBackground density={12} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="wallet-outline" color={colors.primary} size={22} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Expense Tracker</Text>
            <Text style={styles.subtitle}>
              Track, analyze and optimize your spending.
            </Text>
          </View>
        </View>

        <View style={styles.monthCard}>
          <View style={styles.monthTop}>
            <View>
              <Text style={styles.monthLabel}>This month</Text>
              <Text style={styles.monthAmount}>AED 2,450.75</Text>
              <Text style={styles.monthDelta}>↗ 18% vs last month</Text>
            </View>
            <View style={styles.ringOuter}>
              <View style={styles.ringAccent} />
              <View style={styles.ringInner} />
            </View>
          </View>

          <View style={styles.monthActions}>
            <Pressable
              onPress={() => router.push("/spending-summary" as never)}
              style={styles.linkRowCompact}
            >
              <View style={styles.linkRowLeft}>
                <Ionicons name="git-network-outline" color={colors.primary} size={15} />
                <Text style={styles.linkTitleCompact}>Spending Summary</Text>
              </View>
              <Ionicons name="chevron-forward" color={colors.primary} size={16} />
            </Pressable>

            <Pressable
              onPress={() => router.push("/expense-intelligence" as never)}
              style={styles.linkRowCompact}
            >
              <View style={styles.linkRowLeft}>
                <Ionicons name="git-network-outline" color={colors.primary} size={15} />
                <Text style={styles.linkTitleCompact}>Expense Intelligence</Text>
              </View>
              <Ionicons name="chevron-forward" color={colors.primary} size={16} />
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Add Expense</Text>
          </View>

          <View style={styles.amountShell}>
            <Text style={styles.amountLabel}>Amount</Text>
            <View style={styles.amountEntryRow}>
              <TextInput
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
              />
              <View style={styles.currencySwitch}>
                {(["AED", "INR"] as const).map((item) => {
                  const selected = item === currency;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setCurrency(item)}
                      style={[styles.currencyOption, selected && styles.currencyOptionSelected]}
                    >
                      <Text style={[styles.currencyText, selected && styles.currencyTextSelected]}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.categoryHeader}>
            <Text style={styles.categoryHeaderLabel}>Category</Text>
            <Text style={styles.categoryHeaderValue}>{category}</Text>
          </View>

          <ScrollView
            horizontal
            contentContainerStyle={styles.categoryRail}
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            {orderedCategories.map((item) => {
              const selected = item.label === category;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => setCategory(item.label)}
                  style={[
                    styles.categoryCard,
                    selected && styles.categoryCardSelected,
                    selected && { borderColor: item.accent },
                  ]}
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: `${item.accent}1F`, borderColor: `${item.accent}66` },
                      selected && { backgroundColor: item.accent },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      color={selected ? colors.onPrimary : item.accent}
                      size={21}
                    />
                  </View>
                  <Text style={[styles.categoryCardText, selected && styles.categoryCardTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <TextInput
            placeholder="Optional note, e.g. lunch with friends"
            placeholderTextColor={colors.muted}
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
          />

          <Pressable
            disabled={saving}
            onPress={handleSaveExpense}
            style={[styles.primaryButton, saving && styles.disabledButton]}
          >
            {saving ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Ionicons name="add-circle-outline" color={colors.text} size={17} />
                <Text style={styles.primaryButtonText}>Save Expense</Text>
              </>
            )}
          </Pressable>
            {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function inferCategory(text: string, quickAdds: string[]): string | null {
  const lowered = text.toLowerCase();
  for (const quickAdd of quickAdds) {
    if (lowered.includes(quickAdd.toLowerCase())) {
      return quickAdd;
    }
  }

  for (const [needle, category] of Object.entries(categoryLookup)) {
    if (lowered.includes(needle)) {
      return category;
    }
  }

  return null;
}

function warnIfOverBudget(total: number | undefined, budgetTarget: number | null, threshold: number) {
  if (typeof total !== "number" || budgetTarget === null || budgetTarget <= 0) {
    return;
  }

  const thresholdValue = budgetTarget * (threshold / 100);
  if (total >= thresholdValue) {
    Alert.alert(
      "Budget warning",
      `You have reached ${threshold}% of your budget target.`,
    );
  }
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    keyboard: {
      backgroundColor: colors.background,
      flex: 1,
    },
    content: {
      gap: 13,
      paddingHorizontal: 20,
      paddingBottom: spacing.xl,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    hero: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      paddingTop: spacing.sm,
    },
    heroIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.primaryBorder,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 42,
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      width: 42,
    },
    heroCopy: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    subtitle: {
      color: colors.cyan,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
      maxWidth: 220,
    },
    monthCard: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      padding: spacing.sm,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    monthTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    monthLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    monthAmount: {
      color: colors.text,
      fontSize: 23,
      fontWeight: "900",
      letterSpacing: -0.5,
      marginTop: spacing.xs,
    },
    monthDelta: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      marginTop: spacing.xs,
    },
    ringOuter: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderColor: colors.purple,
      borderRadius: radius.pill,
      borderRightColor: colors.cyan,
      borderTopColor: colors.purple,
      borderWidth: 12,
      height: 70,
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.26,
      shadowRadius: 18,
      width: 70,
    },
    ringAccent: {
      backgroundColor: colors.background,
      borderRadius: radius.pill,
      height: 34,
      position: "absolute",
      width: 34,
    },
    ringInner: {
      backgroundColor: colors.surface,
      borderRadius: radius.pill,
      height: 30,
      width: 30,
    },
    card: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      padding: spacing.sm,
    },
    sectionHeader: {
      gap: 2,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
    sectionHint: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    monthActions: {
      gap: 7,
    },
    linkRowCompact: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 35,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    linkRowLeft: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    linkTitleCompact: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
    },
    amountShell: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    amountEntryRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    amountLabel: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    currencySwitch: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      padding: 3,
    },
    currencyOption: {
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    currencyOptionSelected: {
      backgroundColor: colors.primary,
    },
    currencyText: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: "900",
    },
    currencyTextSelected: {
      color: colors.onPrimary,
    },
    amountInput: {
      color: colors.text,
      flex: 1,
      fontSize: 24,
      fontWeight: "900",
      minHeight: 34,
      padding: 0,
    },
    categoryHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: -spacing.xs,
    },
    categoryHeaderLabel: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    categoryHeaderValue: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
    },
    categoryRail: {
      flexDirection: "row",
      gap: spacing.xs,
      paddingRight: spacing.md,
      paddingVertical: 1,
    },
    categoryCard: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: 3,
      justifyContent: "center",
      minHeight: 64,
      paddingHorizontal: 6,
      paddingVertical: 6,
      width: 62,
    },
    categoryCardSelected: {
      backgroundColor: colors.primarySoft,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 11,
    },
    categoryIcon: {
      alignItems: "center",
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      height: 30,
      justifyContent: "center",
      width: 30,
    },
    categoryCardText: {
      color: colors.text,
      fontSize: 9,
      fontWeight: "900",
      textAlign: "center",
    },
    categoryCardTextSelected: {
      color: colors.primary,
    },
    noteInput: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.text,
      fontSize: 12,
      minHeight: 40,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
  insightInput: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 88,
    padding: spacing.md,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  quickPill: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quickText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primaryDim,
    borderColor: colors.cyan,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 42,
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.34,
    shadowRadius: 14,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 52,
  },
  disabledButton: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  error: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.danger,
    lineHeight: 20,
    padding: spacing.sm,
  },
  results: {
    gap: spacing.md,
  },
  insightCard: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionKicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  answer: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 26,
  },
  metricsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  metricCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  toolPill: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillType: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  pillName: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  pillSource: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  dbBadge: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.primary,
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  categoryRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
  },
  categoryName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  categoryValue: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
  expenseRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  expenseNumber: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  expenseNumberText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  expenseMain: {
    flex: 1,
    gap: 2,
  },
  expenseDescription: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  expenseMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  expenseAmount: {
    color: colors.amber,
    fontSize: 14,
    fontWeight: "900",
  },
  });
}
