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
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import {
  getBackendUrl,
  getBudgetTargetPreference,
  getBudgetWarningThresholdPreference,
} from "../storage/appStorage";
import { ExpenseIntelligenceResponse, getExpenseIntelligenceFromApi } from "../services/api";

const periodOptions = [
  { label: "Monthly", value: "month" as const },
  { label: "Yearly", value: "year" as const },
  { label: "All time", value: "all" as const },
];

type Period = (typeof periodOptions)[number]["value"];

export default function ExpenseIntelligenceScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [backendUrl, setBackendUrl] = useState("");
  const [period, setPeriod] = useState<Period>("month");
  const [report, setReport] = useState<ExpenseIntelligenceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [budgetTarget, setBudgetTarget] = useState<number | null>(null);
  const [budgetWarningThreshold, setBudgetWarningThreshold] = useState(80);

  const refresh = useCallback(
    async (nextPeriod = period) => {
      if (!backendUrl) {
        setError("Expense intelligence needs the backend to be online.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const data = await getExpenseIntelligenceFromApi({
          backendUrl,
          period: nextPeriod,
        });
        setReport(data);
      } catch (caught) {
        setReport(null);
        setError(caught instanceof Error ? caught.message : "Could not load expense intelligence.");
      } finally {
        setLoading(false);
      }
    },
    [backendUrl, period],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      Promise.all([getBackendUrl(), getBudgetTargetPreference(), getBudgetWarningThresholdPreference()]).then(([url, target, threshold]) => {
        if (!active) {
          return;
        }

        setBackendUrl(url);
        setBudgetTarget(target);
        setBudgetWarningThreshold(threshold);
        setError("");
        setTimeout(() => {
          if (active) {
            void refresh(period);
          }
        }, 0);
      });

      return () => {
        active = false;
      };
    }, [period, refresh]),
  );

  const byCategory = report?.byCategory || [];
  const topCategories = byCategory.slice(0, 5);
  const spendingShare = topCategories.length && report?.total ? topCategories.map((item) => ({
    label: item.category,
    value: Math.round((item.total / report.total) * 100),
  })) : [];
  const budgetProgress =
    budgetTarget && budgetTarget > 0 && report ? Math.min(100, (report.total / budgetTarget) * 100) : null;
  const budgetRisk =
    budgetProgress === null
      ? "No budget target set"
      : budgetProgress >= 100
        ? "Budget exceeded"
        : budgetProgress >= budgetWarningThreshold
          ? "Warning threshold reached"
          : "Within budget range";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="chevron-back" color={colors.text} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Ionicons name="analytics-outline" color={colors.primary} size={16} />
          <Text style={styles.heroBadgeText}>Expense intelligence</Text>
        </View>
        <Text style={styles.title}>Smart spending insights</Text>
        <Text style={styles.subtitle}>
          This page uses your expense DB and AI to explain what changed, what to watch, and
          where you can save next.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Period</Text>
            <Text style={styles.sectionHint}>Switch the analysis window</Text>
          </View>
          <View style={styles.periodRow}>
            {periodOptions.map((item) => {
              const selected = item.value === period;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    setPeriod(item.value);
                    void refresh(item.value);
                  }}
                  style={[styles.periodPill, selected && styles.periodPillSelected]}
                >
                  <Text style={[styles.periodPillText, selected && styles.periodPillTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => void refresh(period)}
          style={[styles.refreshButton, loading && styles.refreshButtonDisabled]}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.refreshText}>Refresh insights</Text>}
        </Pressable>

        {loading ? (
          <View style={styles.stateRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.stateText}>Reading your spending patterns...</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : report ? (
          <>
            <View style={styles.metricRow}>
              <MetricCard styles={styles} label="Total" value={formatAmount(report.total, commonCurrency(report.expenses))} />
              <MetricCard styles={styles} label="Average" value={formatAmount(report.average, commonCurrency(report.expenses))} />
              <MetricCard styles={styles} label="Entries" value={`${report.count}`} />
            </View>

            {budgetProgress !== null ? (
              <View style={styles.riskCard}>
                <View style={styles.cardRow}>
                  <Ionicons
                    name={budgetProgress >= budgetWarningThreshold ? "warning-outline" : "shield-checkmark-outline"}
                    color={budgetProgress >= budgetWarningThreshold ? "#FBBF24" : colors.primary}
                    size={18}
                  />
                  <Text style={styles.panelTitle}>Budget alert</Text>
                </View>
                <Text style={styles.panelCopy}>
                  {budgetRisk} at {budgetProgress.toFixed(0)}% usage. Threshold is {budgetWarningThreshold}%.
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${budgetProgress}%`,
                        backgroundColor: budgetProgress >= budgetWarningThreshold ? "#FBBF24" : colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.riskCard}>
                <Text style={styles.panelTitle}>Budget alert</Text>
                <Text style={styles.panelCopy}>Set a budget target in Settings to enable risk alerts here.</Text>
              </View>
            )}

            <View style={styles.highlightCard}>
              <Text style={styles.panelTitle}>{report.intelligence.headline}</Text>
              <Text style={styles.panelCopy}>{report.intelligence.summary}</Text>
            </View>

            <InsightList title="Highlights" items={report.intelligence.highlights} styles={styles} />
            <InsightList title="Opportunities" items={report.intelligence.opportunities} styles={styles} />
            <InsightList title="Anomalies" items={report.intelligence.anomalies} styles={styles} />
            <InsightList title="Recurring patterns" items={report.intelligence.recurringPatterns} styles={styles} />

            {spendingShare.length ? (
              <View style={styles.card}>
                <Text style={styles.panelTitle}>Category share chart</Text>
                <Text style={styles.smallCopy}>How much each top category contributes to total spend.</Text>
                {spendingShare.map((item) => (
                  <View key={item.label} style={styles.barRow}>
                    <View style={styles.barHeader}>
                      <Text style={styles.categoryName}>{item.label}</Text>
                      <Text style={styles.categoryValue}>{item.value}%</Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.max(6, item.value)}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.forecastCard}>
              <View style={styles.cardRow}>
                <Ionicons name="trending-up-outline" color={colors.primary} size={18} />
                <Text style={styles.panelTitle}>Forecast</Text>
              </View>
              <Text style={styles.forecastAmount}>
                {formatAmount(report.intelligence.forecast.amount, commonCurrency(report.expenses))}
              </Text>
              <Text style={styles.panelCopy}>{report.intelligence.forecast.label}</Text>
              <Text style={styles.smallCopy}>{report.intelligence.forecast.rationale}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.panelTitle}>Top categories</Text>
              {topCategories.length ? (
                topCategories.map((item) => (
                  <View key={item.category} style={styles.categoryRow}>
                    <Text style={styles.categoryName}>{item.category}</Text>
                    <Text style={styles.categoryValue}>
                      {formatAmount(item.total, commonCurrency(report.expenses))} · {item.count}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={styles.smallCopy}>No category data yet.</Text>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No report yet</Text>
            <Text style={styles.smallCopy}>
              Tap refresh to analyze your spending patterns and get a practical summary.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function InsightList({
  title,
  items,
  styles,
}: {
  title: string;
  items: string[];
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.card}>
      <Text style={styles.panelTitle}>{title}</Text>
      {items.length ? (
        items.map((item, index) => (
          <View key={`${title}-${index}`} style={styles.insightRow}>
            <View style={styles.insightBullet}>
              <Ionicons name="sparkles-outline" color={colors.primary} size={12} />
            </View>
            <Text style={styles.insightText}>{item}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.smallCopy}>Nothing to show yet.</Text>
      )}
    </View>
  );
}

function MetricCard({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function commonCurrency(expenses: ExpenseIntelligenceResponse["expenses"]): "AED" | "INR" | undefined {
  const currencies = new Set(expenses.map((expense) => expense.currency || "AED"));
  return currencies.size === 1 ? (currencies.values().next().value as "AED" | "INR") : undefined;
}

function formatAmount(amount: number, currency?: "AED" | "INR"): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
  return currency ? `${currency} ${formatted}` : formatted;
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      gap: spacing.lg,
      padding: spacing.md,
      paddingBottom: spacing.xl,
      paddingTop: Math.max(spacing.md, topInset),
    },
    backButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: spacing.xs,
    },
    backText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    hero: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
      borderRadius: 24,
      borderWidth: 1,
      gap: spacing.sm,
      overflow: "hidden",
      padding: spacing.lg,
    },
    heroBadge: {
      alignSelf: "flex-start",
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    heroBadgeText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    subtitle: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.borderStrong,
      borderRadius: 24,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg,
    },
    sectionHeaderRow: {
      gap: spacing.md,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "800",
    },
    sectionHint: {
      color: colors.muted,
      fontSize: 12,
      marginTop: 2,
    },
    periodRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    periodPill: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    periodPillSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    periodPillText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    periodPillTextSelected: {
      color: colors.primary,
    },
    refreshButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: 16,
      minHeight: 52,
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    refreshButtonDisabled: {
      opacity: 0.7,
    },
    refreshText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: "800",
    },
    stateRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    stateText: {
      color: colors.muted,
      fontSize: 14,
    },
    errorText: {
      color: "#FCA5A5",
      fontSize: 14,
    },
    metricRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    metricCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
    metricLabel: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
    },
    metricValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    highlightCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
    panelTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    panelCopy: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
    smallCopy: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
    },
    forecastCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
    riskCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    cardRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    forecastAmount: {
      color: colors.primary,
      fontSize: 24,
      fontWeight: "900",
    },
    categoryRow: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: spacing.sm,
    },
    barRow: {
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    barHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    progressTrack: {
      backgroundColor: colors.border,
      borderRadius: 999,
      height: 8,
      overflow: "hidden",
      width: "100%",
    },
    progressFill: {
      backgroundColor: colors.primary,
      height: "100%",
    },
    categoryName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    categoryValue: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "600",
    },
    emptyState: {
      alignItems: "flex-start",
      gap: spacing.xs,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    insightRow: {
      flexDirection: "row",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    insightBullet: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderRadius: 999,
      height: 20,
      justifyContent: "center",
      marginTop: 2,
      width: 20,
    },
    insightText: {
      color: colors.text,
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
    },
  });
}
