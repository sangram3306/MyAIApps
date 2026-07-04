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
import { ExpenseExportResponse, ExpenseItem, getExpenseExportFromApi, getExpenseIntelligenceFromApi, ExpenseIntelligenceResponse } from "../../services/api";

const summaryPeriods = ["month", "year"] as const;
type SummaryPeriod = (typeof summaryPeriods)[number];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

type SummaryPoint = {
  key: string;
  label: string;
  total: number;
  count: number;
};

export default function AnalyticsScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  
  const [backendUrl, setBackendUrl] = useState("");
  const [budgetTarget, setBudgetTarget] = useState<number | null>(null);
  const [budgetWarningThreshold, setBudgetWarningThreshold] = useState(80);
  
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [yearData, setYearData] = useState<ExpenseExportResponse | null>(null);
  const [yearLoading, setYearLoading] = useState(false);
  const [yearError, setYearError] = useState("");

  const [monthData, setMonthData] = useState<ExpenseIntelligenceResponse | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState("");

  const monthYearString = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, [currentDate]);

  const displayMonthString = useMemo(() => {
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [currentDate]);

  const fetchYearData = useCallback(async (url: string) => {
    setYearLoading(true);
    setYearError("");
    try {
      const res = await getExpenseExportFromApi({ backendUrl: url });
      setYearData(res);
    } catch (e) {
      setYearError(e instanceof Error ? e.message : "Error loading year data");
    } finally {
      setYearLoading(false);
    }
  }, []);

  const fetchMonthData = useCallback(async (url: string, periodStr: string) => {
    setMonthLoading(true);
    setMonthError("");
    try {
      const res = await getExpenseIntelligenceFromApi({ backendUrl: url, period: periodStr });
      setMonthData(res);
    } catch (e) {
      setMonthError(e instanceof Error ? e.message : "Error loading month data");
    } finally {
      setMonthLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        const [url, target, threshold] = await Promise.all([
          getBackendUrl(),
          getBudgetTargetPreference(),
          getBudgetWarningThresholdPreference(),
        ]);
        if (!active) return;
        setBackendUrl(url);
        setBudgetTarget(target);
        setBudgetWarningThreshold(threshold);
        
        if (summaryPeriod === "year" && !yearData) {
          fetchYearData(url);
        } else if (summaryPeriod === "month") {
          fetchMonthData(url, monthYearString);
        }
      }
      load();
      return () => { active = false; };
    }, [summaryPeriod, monthYearString, fetchMonthData, fetchYearData, yearData])
  );

  function prevMonth() {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }

  function nextMonth() {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }

  // Derived Year Data
  const yearSummaryData = useMemo(() => {
    const expenses = yearData?.expenses || [];
    const currency = commonCurrency(expenses);
    const points = buildMonthlyPoints(expenses);
    const total = points.reduce((sum, item) => sum + item.total, 0);
    const count = points.reduce((sum, item) => sum + item.count, 0);
    const average = points.length ? total / points.length : 0;
    return { points, total, average, count, currency };
  }, [yearData]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" color={colors.text} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Ionicons name="stats-chart-outline" color={colors.primary} size={16} />
          <Text style={styles.heroBadgeText}>Analytics & Insights</Text>
        </View>
        <Text style={styles.title}>Spending Analytics</Text>
        <Text style={styles.subtitle}>
          Review your spending patterns, AI insights, budget usage, and category trends.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.sectionHint}>
              {summaryPeriod === "month" ? "Specific Month" : "Current Year"}
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
                    {item === "month" ? "Month" : "Year"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {summaryPeriod === "month" && (
          <View style={styles.monthSelector}>
            <Pressable onPress={prevMonth} style={styles.monthArrow}>
              <Ionicons name="chevron-back" color={colors.primary} size={20} />
            </Pressable>
            <Text style={styles.monthSelectorText}>{displayMonthString}</Text>
            <Pressable onPress={nextMonth} style={styles.monthArrow}>
              <Ionicons name="chevron-forward" color={colors.primary} size={20} />
            </Pressable>
          </View>
        )}

        {summaryPeriod === "year" ? (
          // YEAR VIEW
          yearLoading ? (
            <View style={styles.stateRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Loading year data...</Text>
            </View>
          ) : yearError ? (
            <Text style={styles.errorText}>{yearError}</Text>
          ) : yearSummaryData.points.length ? (
            <>
              <View style={styles.summaryMetricsRow}>
                <SummaryMetricCard styles={styles} label="This year" value={formatAmount(yearSummaryData.total, yearSummaryData.currency)} />
                <SummaryMetricCard styles={styles} label="Avg / month" value={formatAmount(yearSummaryData.average, yearSummaryData.currency)} />
                <SummaryMetricCard styles={styles} label="Entries" value={`${yearSummaryData.count}`} />
              </View>

              <SummaryBarChart currency={yearSummaryData.currency} points={yearSummaryData.points} styles={styles} />
              
              {budgetTarget && budgetTarget > 0 ? (
                <View style={styles.budgetPanel}>
                  <View style={styles.budgetPanelHeader}>
                    <Text style={styles.panelTitle}>Budget progress (Yearly)</Text>
                    <Text style={styles.panelValue}>
                      {formatAmount(yearSummaryData.total, yearSummaryData.currency)} /{" "}
                      {formatAmount(budgetTarget * 12, yearSummaryData.currency)}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(100, (yearSummaryData.total / (budgetTarget * 12)) * 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              ) : null}

              {yearData?.byCategory?.length ? (
                <View style={styles.detailCard}>
                  <Text style={styles.panelTitle}>Top categories (Year)</Text>
                  <View style={styles.breakdownList}>
                    {yearData.byCategory.slice(0, 5).map((item) => (
                      <View key={item.category} style={styles.breakdownRow}>
                        <View style={styles.breakdownLabelWrap}>
                          <Text style={styles.breakdownLabel}>{item.category}</Text>
                          <Text style={styles.breakdownMeta}>{item.count} entries</Text>
                        </View>
                        <Text style={styles.breakdownValue}>{formatAmount(item.total, yearSummaryData.currency)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyText}>Add expenses to see yearly trends.</Text>
          )
        ) : (
          // MONTH VIEW
          monthLoading ? (
            <View style={styles.stateRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Analyzing month...</Text>
            </View>
          ) : monthError ? (
            <Text style={styles.errorText}>{monthError}</Text>
          ) : monthData ? (
            <>
              <View style={styles.summaryMetricsRow}>
                <SummaryMetricCard styles={styles} label="Spent" value={formatAmount(monthData.total, monthData.currency)} />
                <SummaryMetricCard styles={styles} label="Avg / entry" value={formatAmount(monthData.average, monthData.currency)} />
                <SummaryMetricCard styles={styles} label="Entries" value={`${monthData.count}`} />
              </View>

              {budgetTarget && budgetTarget > 0 ? (
                <View style={styles.budgetPanel}>
                  <View style={styles.budgetPanelHeader}>
                    <Text style={styles.panelTitle}>Budget progress</Text>
                    <Text style={styles.panelValue}>
                      {formatAmount(monthData.total, monthData.currency)} /{" "}
                      {formatAmount(budgetTarget, monthData.currency)}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(100, (monthData.total / budgetTarget) * 100)}%` },
                      ]}
                    />
                  </View>
                </View>
              ) : null}

              {monthData.intelligence && (
                <View style={styles.insightPanel}>
                  <View style={styles.insightHeaderRow}>
                    <Ionicons name="sparkles" color={colors.primary} size={18} />
                    <Text style={styles.insightHeaderTitle}>AI Coach</Text>
                  </View>
                  <Text style={styles.insightHeadline}>{monthData.intelligence.headline}</Text>
                  <Text style={styles.insightSummary}>{monthData.intelligence.summary}</Text>
                  
                  {monthData.intelligence.anomalies?.length > 0 && (
                    <View style={styles.insightSubSection}>
                      <Text style={styles.insightSubKicker}>Anomalies</Text>
                      {monthData.intelligence.anomalies.map((ano, i) => (
                        <Text key={i} style={styles.insightBullet}>• {ano}</Text>
                      ))}
                    </View>
                  )}
                  {monthData.intelligence.opportunities?.length > 0 && (
                    <View style={styles.insightSubSection}>
                      <Text style={styles.insightSubKicker}>Opportunities</Text>
                      {monthData.intelligence.opportunities.map((opp, i) => (
                        <Text key={i} style={styles.insightBullet}>• {opp}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {monthData.byCategory?.length ? (
                <View style={styles.detailCard}>
                  <Text style={styles.panelTitle}>Top categories</Text>
                  <View style={styles.breakdownList}>
                    {monthData.byCategory.slice(0, 5).map((item) => (
                      <View key={item.category} style={styles.breakdownRow}>
                        <View style={styles.breakdownLabelWrap}>
                          <Text style={styles.breakdownLabel}>{item.category}</Text>
                          <Text style={styles.breakdownMeta}>{item.count} entries</Text>
                        </View>
                        <Text style={styles.breakdownValue}>{formatAmount(item.total, monthData.currency)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {monthData.expenses?.length ? (
                <View style={styles.detailCard}>
                  <Text style={styles.panelTitle}>Transactions</Text>
                  <View style={styles.recentList}>
                    {monthData.expenses.map((expense) => (
                      <View key={expense.id} style={styles.recentRow}>
                        <View style={styles.recentCopy}>
                          <Text style={styles.recentTitle}>{expense.description}</Text>
                          <Text style={styles.recentMeta}>{expense.category} · {expense.date}</Text>
                        </View>
                        <Text style={styles.recentAmount}>{formatAmount(expense.amount, expense.currency)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.emptyText}>No transactions for this month.</Text>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>No data available for this month.</Text>
          )
        )}
      </View>
    </ScrollView>
  );
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
    const parsed = new Date(expense.date);
    if (Number.isNaN(parsed.getTime()) || parsed.getFullYear() !== currentYear) {
      continue;
    }
    const bucket = buckets[parsed.getMonth()];
    bucket.total += expense.amount || 0;
    bucket.count += 1;
  }
  return buckets;
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

function SummaryBarChart({
  styles,
  points,
  currency,
}: {
  styles: ReturnType<typeof createStyles>;
  points: SummaryPoint[];
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
                  styles.chartBarMonthly,
                  { height: barHeight, opacity: hasValue ? 1 : 0.35 },
                ]}
              />
            </View>
            <Text style={styles.chartLabel}>{point.label}</Text>
            <Text style={styles.chartCount}>
              {point.count}
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

function formatAmount(value: number | undefined, currency?: "AED" | "INR" | string): string {
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
    monthSelector: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.xs,
    },
    monthArrow: {
      padding: spacing.sm,
    },
    monthSelectorText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    summaryMetricsRow: {
      flexDirection: "row",
      gap: spacing.sm,
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
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    metricValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
      marginTop: 4,
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
    chartRail: {
      alignItems: "flex-end",
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    chartColumn: {
      alignItems: "center",
      gap: 6,
      width: 44,
    },
    chartValue: {
      color: colors.muted,
      fontSize: 9,
      fontWeight: "700",
    },
    chartTrack: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      height: 132,
      justifyContent: "flex-end",
      width: 16,
    },
    chartBar: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      width: "100%",
    },
    chartBarMonthly: {
      backgroundColor: colors.cyan,
    },
    chartLabel: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "800",
    },
    chartCount: {
      color: colors.muted,
      fontSize: 9,
    },
    stateRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      padding: spacing.md,
    },
    stateText: {
      color: colors.muted,
      fontSize: 14,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
      padding: spacing.md,
      textAlign: "center",
    },
    errorText: {
      color: colors.red,
      fontSize: 14,
      padding: spacing.md,
    },
    insightPanel: {
      backgroundColor: colors.primarySoft,
      borderRadius: 16,
      padding: spacing.md,
      gap: spacing.sm,
      borderColor: colors.primary,
      borderWidth: 1,
    },
    insightHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    insightHeaderTitle: {
      color: colors.primary,
      fontWeight: "800",
      fontSize: 14,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    insightHeadline: {
      color: colors.text,
      fontWeight: "900",
      fontSize: 18,
    },
    insightSummary: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    insightSubSection: {
      marginTop: spacing.xs,
      gap: 4,
    },
    insightSubKicker: {
      color: colors.primary,
      fontWeight: "700",
      fontSize: 12,
      textTransform: "uppercase",
    },
    insightBullet: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
