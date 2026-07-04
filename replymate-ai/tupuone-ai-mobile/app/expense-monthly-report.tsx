import { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../components/PremiumUI";
import { radius, spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { getBackendUrl } from "../storage/appStorage";
import {
  ExpenseIntelligenceResponse,
  getExpenseIntelligenceFromApi,
} from "../services/api";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

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

export default function ExpenseMonthlyReportScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ExpenseIntelligenceResponse | null>(null);

  const monthYearString = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [currentDate]);

  const displayMonthString = useMemo(() => {
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate]);

  useEffect(() => {
    let isActive = true;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const backendUrl = await getBackendUrl();
        if (!backendUrl) throw new Error("Backend URL not set");
        const res = await getExpenseIntelligenceFromApi({
          backendUrl,
          period: monthYearString
        });
        if (isActive) setData(res);
      } catch (e) {
        if (isActive) setError(e instanceof Error ? e.message : "Error loading data");
      } finally {
        if (isActive) setLoading(false);
      }
    }
    loadData();
    return () => { isActive = false; };
  }, [monthYearString]);

  function prevMonth() {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }

  function nextMonth() {
    setCurrentDate(prev => {
      const now = new Date();
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      if (d.getFullYear() > now.getFullYear() || (d.getFullYear() === now.getFullYear() && d.getMonth() > now.getMonth())) {
        return prev;
      }
      return d;
    });
  }

  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth();
  }, [currentDate]);

  const currency = data?.expenses && data.expenses.length > 0 ? data.expenses[0].currency : "AED";

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "modal",
        }}
      />
      <MatrixBackground density={12} />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Month Picker */}
        <View style={styles.monthPicker}>
          <Pressable onPress={prevMonth} style={styles.monthNav}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>
          <Text style={styles.monthText}>{displayMonthString}</Text>
          <Pressable onPress={nextMonth} style={styles.monthNav} disabled={isCurrentMonth}>
            <Ionicons name="chevron-forward" size={24} color={isCurrentMonth ? colors.muted : colors.primary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : data ? (
          <>
            {/* Total Summary */}
            <View style={styles.card}>
              <Text style={styles.totalLabel}>Total Spent</Text>
              <Text style={styles.totalAmount}>
                {currency} {data.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={styles.totalCount}>{data.count} transactions</Text>
            </View>

            {/* AI Intelligence */}
            {data.intelligence && (
              <View style={[styles.card, { borderColor: colors.primaryBorder, borderWidth: 1 }]}>
                <View style={styles.aiHeader}>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                  <Text style={styles.aiTitle}>AI Analysis</Text>
                </View>
                <Text style={styles.aiHeadline}>{data.intelligence.headline}</Text>
                <Text style={styles.aiRationale}>{data.intelligence.rationale}</Text>
              </View>
            )}

            {/* Category Breakdown */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>By Category</Text>
              {data.byCategory.length === 0 ? (
                <Text style={styles.emptyText}>No spending this month.</Text>
              ) : (
                data.byCategory.map((cat, idx) => {
                  const catMeta = baseCategories.find(c => c.label.toLowerCase() === cat.category.toLowerCase()) || baseCategories.find(c => c.label === "Other")!;
                  const percent = Math.min(100, Math.round((cat.total / data.total) * 100));
                  return (
                    <View key={idx} style={styles.categoryRow}>
                      <View style={styles.categoryHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Ionicons name={catMeta.icon} size={16} color={catMeta.accent} />
                          <Text style={styles.categoryLabel}>{cat.category}</Text>
                        </View>
                        <Text style={styles.categoryAmount}>{currency} {cat.total.toLocaleString()}</Text>
                      </View>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${percent}%`, backgroundColor: catMeta.accent }]} />
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* Transactions List */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Transactions</Text>
              {data.expenses.length === 0 ? (
                <Text style={styles.emptyText}>No transactions to display.</Text>
              ) : (
                data.expenses.map((exp, idx) => {
                  const catMeta = baseCategories.find(c => c.label.toLowerCase() === exp.category.toLowerCase()) || baseCategories.find(c => c.label === "Other")!;
                  return (
                    <View key={idx} style={styles.transactionItem}>
                      <View style={[styles.transactionIcon, { backgroundColor: catMeta.accent + "33" }]}>
                        <Ionicons name={catMeta.icon} size={18} color={catMeta.accent} />
                      </View>
                      <View style={styles.transactionMain}>
                        <Text style={styles.transactionDesc} numberOfLines={1}>{exp.description}</Text>
                        <Text style={styles.transactionDate}>{exp.date}</Text>
                      </View>
                      <Text style={styles.transactionAmount}>
                        {exp.currency} {exp.amount.toLocaleString()}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    content: {
      padding: spacing.lg,
      gap: spacing.lg,
      paddingBottom: spacing.xxl,
    },
    monthPicker: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceGlass,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    monthNav: {
      padding: spacing.sm,
    },
    monthText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    loadingContainer: {
      padding: spacing.xxl,
      alignItems: "center",
    },
    errorContainer: {
      backgroundColor: colors.red + "22",
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.red + "66",
    },
    errorText: {
      color: colors.red,
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.surfaceGlass,
      borderRadius: radius.xl,
      padding: spacing.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    totalLabel: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    totalAmount: {
      color: colors.text,
      fontSize: 36,
      fontWeight: "900",
    },
    totalCount: {
      color: colors.cyan,
      fontSize: 14,
      fontWeight: "700",
    },
    aiHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    aiTitle: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    aiHeadline: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      lineHeight: 22,
    },
    aiRationale: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: spacing.sm,
    },
    categoryRow: {
      marginBottom: spacing.md,
    },
    categoryHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    categoryLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    categoryAmount: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "600",
    },
    progressBarBg: {
      height: 6,
      backgroundColor: colors.border,
      borderRadius: radius.full,
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      borderRadius: radius.full,
    },
    transactionItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    transactionIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    transactionMain: {
      flex: 1,
    },
    transactionDesc: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
      marginBottom: 2,
    },
    transactionDate: {
      color: colors.muted,
      fontSize: 12,
    },
    transactionAmount: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    emptyText: {
      color: colors.muted,
      textAlign: "center",
      padding: spacing.lg,
      fontStyle: "italic",
    },
  });
}
