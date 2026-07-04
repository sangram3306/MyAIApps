import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "../context/app-theme";
import { spacing } from "../constants/theme";
import { getBackendUrl } from "../storage/appStorage";
import { getExpenseExportFromApi, ExpenseItem } from "../services/api";

function formatAmount(amount: number, currency: string = "AED") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const CATEGORY_CONFIG: {
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

export default function DailySpendScreen() {
  const { monthYear } = useLocalSearchParams<{ monthYear: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const url = await getBackendUrl();
        if (!url) throw new Error("Backend URL not configured");

        const data = await getExpenseExportFromApi({ backendUrl: url });
        
        if (active && monthYear) {
          const [yearStr, monthStr] = monthYear.split("-");
          const targetYear = parseInt(yearStr, 10);
          const targetMonth = parseInt(monthStr, 10) - 1;

          const filtered = data.expenses.filter(ex => {
            const d = new Date(ex.date);
            return !Number.isNaN(d.getTime()) && d.getFullYear() === targetYear && d.getMonth() === targetMonth;
          });
          setExpenses(filtered);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => { active = false; };
  }, [monthYear]);

  // Derived graph data
  const chartData = useMemo(() => {
    if (!monthYear) return { points: [], maxValue: 1, currency: "AED" };
    
    const [yearStr, monthStr] = monthYear.split("-");
    const targetYear = parseInt(yearStr, 10);
    const targetMonth = parseInt(monthStr, 10) - 1;
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

    const grouped = expenses.reduce((acc, expense) => {
      const d = expense.date.split("T")[0]; 
      if (!acc[d]) acc[d] = { amount: 0, count: 0 };
      acc[d].amount += expense.amount;
      acc[d].count += 1;
      return acc;
    }, {} as Record<string, { amount: number, count: number }>);

    const points = [];
    let maxValue = 1;

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${yearStr}-${monthStr}-${String(i).padStart(2, "0")}`;
      const dayData = grouped[dateStr];
      const amount = dayData ? dayData.amount : 0;
      if (amount > maxValue) maxValue = amount;
      
      points.push({
        key: dateStr,
        label: String(i),
        amount,
        count: dayData ? dayData.count : 0,
      });
    }

    const currency = expenses[0]?.currency || "AED";

    return { points, maxValue, currency };
  }, [expenses, monthYear]);

  // Display specific transactions for the selected day
  const displayedExpenses = useMemo(() => {
    if (!selectedDate) return [];
    return expenses.filter(ex => ex.date.startsWith(selectedDate));
  }, [selectedDate, expenses]);

  // Auto select the latest day with expenses if none selected
  useEffect(() => {
    if (expenses.length > 0 && !selectedDate) {
      // Find latest date in expenses
      const dates = expenses.map(ex => ex.date.split("T")[0]).sort();
      setSelectedDate(dates[dates.length - 1]);
    }
  }, [expenses, selectedDate]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Daily Spend</Text>
          <Text style={styles.headerSubtitle}>{monthYear}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading data...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : expenses.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>No transactions this month.</Text>
          </View>
        ) : (
          <>
            <View style={styles.chartContainer}>
              <ScrollView
                horizontal
                contentContainerStyle={styles.chartRail}
                keyboardShouldPersistTaps="handled"
                showsHorizontalScrollIndicator={false}
              >
                {chartData.points.map((point) => {
                  const barHeight = Math.max(12, (point.amount / chartData.maxValue) * 132);
                  const hasValue = point.amount > 0;
                  const isSelected = selectedDate === point.key;

                  return (
                    <Pressable
                      key={point.key}
                      style={styles.chartColumn}
                      onPress={() => setSelectedDate(point.key)}
                    >
                      <Text style={[styles.chartValue, isSelected && { color: colors.primary }]}>
                        {formatAmount(point.amount, chartData.currency)}
                      </Text>
                      <View style={styles.chartTrack}>
                        <View
                          style={[
                            styles.chartBar,
                            { height: barHeight, opacity: hasValue ? (isSelected ? 1 : 0.6) : 0.15 },
                            isSelected && { backgroundColor: colors.primary }
                          ]}
                        />
                      </View>
                      <Text style={[styles.chartLabel, isSelected && { color: colors.primary }]}>{point.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.transactionsContainer}>
              <Text style={styles.transactionsHeader}>
                {selectedDate ? `Transactions on ${selectedDate}` : "Select a day"}
              </Text>
              
              {displayedExpenses.length === 0 ? (
                <View style={styles.emptyTransactions}>
                  <Text style={styles.stateText}>No spending on this day.</Text>
                </View>
              ) : (
                <View style={styles.recentList}>
                  {displayedExpenses.map((expense) => {
                    const categoryData = CATEGORY_CONFIG.find(
                      (c) => c.label.toLowerCase() === expense.category?.toLowerCase()
                    ) || CATEGORY_CONFIG[CATEGORY_CONFIG.length - 1];

                    return (
                      <View key={expense.id} style={styles.recentRow}>
                        <View style={[styles.categoryIconBox, { backgroundColor: `${categoryData.accent}25` }]}>
                          <Ionicons name={categoryData.icon} size={20} color={categoryData.accent} />
                        </View>
                        <View style={styles.recentCopy}>
                          <Text style={styles.recentTitle}>{expense.description}</Text>
                          <Text style={styles.recentMeta}>{expense.category} · {expense.date.split("T")[0]}</Text>
                        </View>
                        <Text style={styles.recentAmount}>{formatAmount(expense.amount, expense.currency)}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: any, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: Math.max(spacing.md, topInset),
      paddingBottom: spacing.md,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
    },
    headerTitleWrap: {
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    headerSubtitle: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    scrollContent: {
      padding: spacing.md,
      paddingBottom: Math.max(spacing.xl, bottomInset + spacing.md),
      gap: spacing.xl,
    },
    centerState: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.md,
    },
    stateText: {
      color: colors.muted,
      fontSize: 15,
    },
    errorText: {
      color: colors.red,
      fontSize: 15,
      textAlign: "center",
    },
    chartContainer: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    chartRail: {
      alignItems: "flex-end",
      gap: 12,
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.xs,
    },
    chartColumn: {
      alignItems: "center",
      gap: 6,
      width: 40,
    },
    chartValue: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: "700",
    },
    chartTrack: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      height: 132,
      justifyContent: "flex-end",
      width: 16,
    },
    chartBar: {
      backgroundColor: colors.cyan,
      borderRadius: 8,
      width: "100%",
    },
    chartLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "800",
    },
    transactionsContainer: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    transactionsHeader: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
      marginBottom: spacing.md,
    },
    emptyTransactions: {
      padding: spacing.lg,
      alignItems: "center",
    },
    recentList: {
      gap: spacing.sm,
    },
    recentRow: {
      alignItems: "center",
      borderTopColor: colors.border,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
      paddingTop: spacing.sm,
    },
    categoryIconBox: {
      alignItems: "center",
      justifyContent: "center",
      width: 40,
      height: 40,
      borderRadius: 12,
    },
    recentCopy: {
      flex: 1,
      gap: 2,
    },
    recentTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    recentMeta: {
      color: colors.muted,
      fontSize: 11,
    },
    recentAmount: {
      color: colors.amber,
      fontSize: 13,
      fontWeight: "900",
    },
  });
}
