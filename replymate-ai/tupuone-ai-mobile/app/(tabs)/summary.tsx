import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { getBackendUrl, getBudgetTargetPreference, getBudgetWarningThresholdPreference } from "../../storage/appStorage";
import { ExpenseExportResponse, ExpenseItem, getExpenseExportFromApi } from "../../services/api";

const summaryPeriods = ["monthly", "yearly"] as const;
type SummaryPeriod = (typeof summaryPeriods)[number];

type SummaryPoint = {
  key: string;
  label: string;
  total: number;
  count: number;
};

type SummaryData = {
  points: SummaryPoint[];
  total: number;
  currentPeriodTotal: number;
  currentPeriodCount: number;
  average: number;
  count: number;
  currency?: "AED" | "INR";
};

export default function SpendingSummaryScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [backendUrl, setBackendUrl] = useState("");
  const [expenseExport, setExpenseExport] = useState<ExpenseExportResponse | null>(null);
  const [budgetTarget, setBudgetTarget] = useState<number | null>(null);
  const [budgetWarningThreshold, setBudgetWarningThreshold] = useState(80);
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const summaryData = useMemo(() => {
    const expenses = expenseExport?.expenses || [];
    return buildSummaryData(expenses, summaryPeriod);
  }, [expenseExport, summaryPeriod]);

  const categoryBreakdown = expenseExport?.byCategory || [];
  const topCategory = categoryBreakdown[0] || null;
  const recentExpenses = useMemo(() => {
    const expenses = expenseExport?.expenses || [];
    return [...expenses]
      .sort(
        (a, b) =>
          (parseExpenseDate(b.date)?.getTime() || 0) -
          (parseExpenseDate(a.date)?.getTime() || 0),
      )
      .slice(0, 5);
  }, [expenseExport]);
  const budgetProgress =
    budgetTarget && budgetTarget > 0 ? Math.min(100, (summaryData.total / budgetTarget) * 100) : null;
  const budgetStatus =
    budgetProgress === null
      ? "Set a budget target to track progress here."
      : budgetProgress >= budgetWarningThreshold
        ? `You are at ${budgetProgress.toFixed(0)}% of your target.`
        : `You have used ${budgetProgress.toFixed(0)}% of your budget target.`;

  const refreshSummary = useCallback(
    async (url = backendUrl, isActive = true) => {
      if (!url) {
        if (isActive) {
          setExpenseExport(null);
          setError("Expense summary is unavailable until the backend connects.");
        }
        return;
      }

      setLoading(true);
      setError("");

      try {
        const exportData = await getExpenseExportFromApi({ backendUrl: url });
        if (!isActive) {
          return;
        }

        setExpenseExport(exportData);
      } catch (caught) {
        if (!isActive) {
          return;
        }

        setExpenseExport(null);
        setError(caught instanceof Error ? caught.message : "Could not load the summary.");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    },
    [backendUrl],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        const [url, target, threshold] = await Promise.all([
          getBackendUrl(),
          getBudgetTargetPreference(),
          getBudgetWarningThresholdPreference(),
        ]);
        if (!active) {
          return;
        }

        setBackendUrl(url);
        setBudgetTarget(target);
        setBudgetWarningThreshold(threshold);
        await refreshSummary(url, true);
      }

      void load();

      return () => {
        active = false;
      };
    }, [refreshSummary]),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" color={colors.text} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Ionicons name="stats-chart-outline" color={colors.primary} size={16} />
          <Text style={styles.heroBadgeText}>Spending dashboard</Text>
        </View>
        <Text style={styles.title}>Spending Summary</Text>
        <Text style={styles.subtitle}>
          Review your monthly and yearly spending patterns, budget usage, category trends, and
          recent activity without crowding the expense entry flow.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.sectionHint}>
              {summaryPeriod === "monthly" ? "This year by month" : "Last 5 years"}
            </Text>
          </View>
          <View style={styles.summaryPills}>
            {summaryPeriods.map((item) => {
              const selected = item === summaryPeriod;
              return (
                <Pressable
                  key={item}
                  onPress={() => setSummaryPeriod(item)}
                  style={[styles.summaryPill, selected && styles.summaryPillSelected]}
                >
                  <Text style={[styles.summaryPillText, selected && styles.summaryPillTextSelected]}>
                    {item === "monthly" ? "Monthly" : "Yearly"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View style={styles.stateRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Loading summary...</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : summaryData.points.length ? (
          <>
            <View style={styles.summaryMetricsRow}>
              <SummaryMetricCard
                styles={styles}
                label={summaryPeriod === "monthly" ? "This month" : "This year"}
                value={formatAmount(summaryData.currentPeriodTotal, summaryData.currency)}
              />
              <SummaryMetricCard
                styles={styles}
                label={summaryPeriod === "monthly" ? "Avg / month" : "Avg / year"}
                value={formatAmount(summaryData.average, summaryData.currency)}
              />
              <SummaryMetricCard styles={styles} label="Entries" value={`${summaryData.currentPeriodCount}`} />
            </View>

            <View style={styles.insightGrid}>
              <InsightCard
                styles={styles}
                icon="pricetag-outline"
                title="Top category"
                copy={
                  topCategory
                    ? `${topCategory.category} · ${formatAmount(topCategory.total, summaryData.currency)}`
                    : "No category data yet"
                }
              />
              <InsightCard
                styles={styles}
                icon="speedometer-outline"
                title="Budget status"
                copy={budgetStatus}
              />
              <InsightCard
                styles={styles}
                icon="trending-up-outline"
                title="Peak period"
                copy={getPeakPeriodLabel(summaryData.points, summaryPeriod, summaryData.currency)}
              />
              <InsightCard
                styles={styles}
                icon="calculator-outline"
                title="Average per entry"
                copy={formatAmount(summaryData.count ? summaryData.total / summaryData.count : 0, summaryData.currency)}
              />
            </View>

            <SummaryBarChart
              currency={summaryData.currency}
              period={summaryPeriod}
              points={summaryData.points}
              styles={styles}
            />

            {budgetTarget && budgetTarget > 0 ? (
              <View style={styles.budgetPanel}>
                <View style={styles.budgetPanelHeader}>
                  <Text style={styles.panelTitle}>Budget progress</Text>
                  <Text style={styles.panelValue}>
                    {formatAmount(summaryData.total, summaryData.currency)} /{" "}
                    {formatAmount(budgetTarget, summaryData.currency)}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(100, budgetProgress || 0)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.panelCopy}>
                  Warning threshold: {budgetWarningThreshold}%
                </Text>
              </View>
            ) : null}

            {categoryBreakdown.length ? (
              <View style={styles.detailCard}>
                <Text style={styles.panelTitle}>Top categories</Text>
                <Text style={styles.panelCopy}>
                  Where most of your spending is going in the selected period.
                </Text>
                <View style={styles.breakdownList}>
                  {categoryBreakdown.slice(0, 5).map((item) => (
                    <View key={item.category} style={styles.breakdownRow}>
                      <View style={styles.breakdownLabelWrap}>
                        <Text style={styles.breakdownLabel}>{item.category}</Text>
                        <Text style={styles.breakdownMeta}>
                          {item.count} {item.count === 1 ? "entry" : "entries"}
                        </Text>
                      </View>
                      <Text style={styles.breakdownValue}>
                        {formatAmount(item.total, summaryData.currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {recentExpenses.length ? (
              <View style={styles.detailCard}>
                <Text style={styles.panelTitle}>Recent activity</Text>
                <Text style={styles.panelCopy}>Latest entries from your expense history.</Text>
                <View style={styles.recentList}>
                  {recentExpenses.map((expense) => (
                    <View key={expense.id} style={styles.recentRow}>
                      <View style={styles.recentCopy}>
                        <Text style={styles.recentTitle}>{expense.description}</Text>
                        <Text style={styles.recentMeta}>
                          {expense.category} · {expense.date}
                        </Text>
                      </View>
                      <Text style={styles.recentAmount}>
                        {formatAmount(expense.amount, expense.currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.emptyText}>Add a few expenses to see monthly and yearly trends.</Text>
        )}
      </View>
    </ScrollView>
  );
}

function buildSummaryData(expenses: ExpenseItem[], period: SummaryPeriod): SummaryData {
  const currency = commonCurrency(expenses);
  const points = period === "monthly" ? buildMonthlyPoints(expenses) : buildYearlyPoints(expenses);
  const total = points.reduce((sum, item) => sum + item.total, 0);
  const count = points.reduce((sum, item) => sum + item.count, 0);
  const average = points.length ? total / points.length : 0;

  // Compute current-period-only totals (current month or current year)
  let currentPeriodTotal = 0;
  let currentPeriodCount = 0;
  if (period === "monthly") {
    const currentMonthIndex = new Date().getMonth();
    const currentBucket = points[currentMonthIndex];
    if (currentBucket) {
      currentPeriodTotal = currentBucket.total;
      currentPeriodCount = currentBucket.count;
    }
  } else {
    const currentYearKey = String(new Date().getFullYear());
    const currentBucket = points.find((p) => p.key === currentYearKey);
    if (currentBucket) {
      currentPeriodTotal = currentBucket.total;
      currentPeriodCount = currentBucket.count;
    }
  }

  return { points, total, currentPeriodTotal, currentPeriodCount, average, count, currency };
}

function getPeakPeriodLabel(
  points: SummaryPoint[],
  period: SummaryPeriod,
  currency?: "AED" | "INR",
): string {
  const peak = [...points].sort((a, b) => b.total - a.total)[0];
  if (!peak || peak.total <= 0) {
    return "No spending yet";
  }

  return period === "monthly"
    ? `${peak.label} · ${formatAmount(peak.total, currency)}`
    : `${peak.label} · ${formatAmount(peak.total, currency)}`;
}

function buildMonthlyPoints(expenses: ExpenseItem[]): SummaryPoint[] {
  const currentYear = new Date().getFullYear();
  const buckets = Array.from({ length: 12 }, (_, month) => ({
    key: `${currentYear}-${String(month + 1).padStart(2, "0")}`,
    label: new Date(currentYear, month, 1).toLocaleString(undefined, { month: "short" }),
    total: 0,
    count: 0,
  }));

  for (const expense of expenses) {
    const parsed = parseExpenseDate(expense.date);
    if (!parsed || parsed.getFullYear() !== currentYear) {
      continue;
    }

    const bucket = buckets[parsed.getMonth()];
    bucket.total += expense.amount || 0;
    bucket.count += 1;
  }

  return buckets;
}

function buildYearlyPoints(expenses: ExpenseItem[]): SummaryPoint[] {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, index) => currentYear - (4 - index));
  const buckets = years.map((year) => ({
    key: String(year),
    label: String(year),
    total: 0,
    count: 0,
  }));
  const bucketMap = new Map(years.map((year, index) => [year, buckets[index]]));

  for (const expense of expenses) {
    const parsed = parseExpenseDate(expense.date);
    if (!parsed) {
      continue;
    }

    const bucket = bucketMap.get(parsed.getFullYear());
    if (!bucket) {
      continue;
    }

    bucket.total += expense.amount || 0;
    bucket.count += 1;
  }

  return buckets;
}

function parseExpenseDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function SummaryMetricCard({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function InsightCard({
  styles,
  icon,
  title,
  copy,
}: {
  styles: ReturnType<typeof createStyles>;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightIcon}>
        <Ionicons name={icon} color={colors.primary} size={18} />
      </View>
      <Text style={styles.insightTitle}>{title}</Text>
      <Text style={styles.insightCopy}>{copy}</Text>
    </View>
  );
}

function SummaryBarChart({
  styles,
  points,
  period,
  currency,
}: {
  styles: ReturnType<typeof createStyles>;
  points: SummaryPoint[];
  period: SummaryPeriod;
  currency?: "AED" | "INR";
}) {
  const maxValue = Math.max(...points.map((item) => item.total), 1);

  return (
    <ScrollView
      horizontal
      contentContainerStyle={styles.chartRail}
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
    >
      {points.map((point) => {
        const barHeight = Math.max(12, (point.total / maxValue) * 132);
        const hasValue = point.total > 0;

        return (
          <View key={point.key} style={styles.chartColumn}>
            <Text style={styles.chartValue}>{formatAmount(point.total, currency)}</Text>
            <View style={styles.chartTrack}>
              <View
                style={[
                  styles.chartBar,
                  period === "monthly" ? styles.chartBarMonthly : styles.chartBarYearly,
                  { height: barHeight, opacity: hasValue ? 1 : 0.35 },
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>{point.label}</Text>
            <Text style={styles.chartCount}>
              {point.count} {point.count === 1 ? "entry" : "entries"}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function commonCurrency(expenses: ExpenseItem[]): "AED" | "INR" | undefined {
  const currencies = new Set(expenses.map((expense) => expense.currency || "AED"));
  return currencies.size === 1 ? [...currencies][0] : undefined;
}

function formatAmount(value: number | undefined, currency?: "AED" | "INR"): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return currency ? `${currency} 0.00` : "0.00";
  }

  const formatted = value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      backgroundColor: colors.background,
      gap: spacing.md,
      padding: spacing.md,
      paddingBottom: spacing.xl,
      paddingTop: Math.max(spacing.md, topInset),
    },
    hero: {
      gap: spacing.sm,
      paddingTop: 0,
    },
    backButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: 2,
      paddingVertical: 4,
    },
    backText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    heroBadge: {
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
    heroBadgeText: {
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
      fontSize: 16,
      lineHeight: 24,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 22,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    sectionHeaderRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "900",
    },
    sectionHint: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    summaryPills: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    summaryPill: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    summaryPillSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    summaryPillText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.2,
      textTransform: "uppercase",
    },
    summaryPillTextSelected: {
      color: colors.onPrimary,
    },
    summaryMetricsRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    insightGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    insightCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flexGrow: 1,
      flexBasis: "48%",
      gap: 8,
      padding: spacing.md,
    },
    insightIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      borderWidth: 1,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    insightTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    insightCopy: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    budgetPanel: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    budgetPanelHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    progressTrack: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 10,
      overflow: "hidden",
    },
    progressFill: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: "100%",
    },
    detailCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    panelTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
    panelValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      textAlign: "right",
    },
    panelCopy: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    breakdownList: {
      gap: spacing.sm,
    },
    breakdownRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingVertical: 4,
    },
    breakdownLabelWrap: {
      flex: 1,
      gap: 2,
    },
    breakdownLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    breakdownMeta: {
      color: colors.muted,
      fontSize: 11,
    },
    breakdownValue: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
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
    metricCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderStrong,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      padding: spacing.md,
    },
    metricLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    metricValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: "900",
      marginTop: spacing.xs,
    },
    chartRail: {
      alignItems: "flex-end",
      gap: spacing.sm,
      paddingBottom: spacing.xs,
      paddingTop: spacing.xs,
    },
    chartColumn: {
      alignItems: "center",
      gap: 6,
      width: 64,
    },
    chartValue: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      textAlign: "center",
    },
    chartTrack: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 150,
      justifyContent: "flex-end",
      overflow: "hidden",
      padding: 4,
      width: 22,
    },
    chartBar: {
      borderRadius: 999,
      width: "100%",
    },
    chartBarMonthly: {
      backgroundColor: colors.primary,
    },
    chartBarYearly: {
      backgroundColor: colors.secondary,
    },
    chartLabel: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "800",
      textAlign: "center",
    },
    chartCount: {
      color: colors.muted,
      fontSize: 10,
      textAlign: "center",
    },
    stateRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 92,
    },
    stateText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "700",
    },
    emptyText: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 20,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 20,
    },
  });
}
