import { useCallback, useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { getBackendUrl, getBudgetTargetPreference, saveBudgetTargetPreference, getYearlyBudgetTargetPreference, saveYearlyBudgetTargetPreference, getBudgetWarningThresholdPreference } from "../../storage/appStorage";
import { ExpenseExportResponse, ExpenseItem, getExpenseExportFromApi, getExpenseIntelligenceFromApi, ExpenseIntelligenceResponse } from "../../services/api";

const summaryPeriods = ["month", "year"] as const;
type SummaryPeriod = (typeof summaryPeriods)[number];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

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
  const [yearlyBudgetTarget, setYearlyBudgetTarget] = useState<number | null>(null);
  const [budgetWarningThreshold, setBudgetWarningThreshold] = useState(80);
  
  const [summaryPeriod, setSummaryPeriod] = useState<SummaryPeriod>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [isEditingMonthlyBudget, setIsEditingMonthlyBudget] = useState(false);
  const [monthlyBudgetInput, setMonthlyBudgetInput] = useState("");
  
  const [isEditingYearlyBudget, setIsEditingYearlyBudget] = useState(false);
  const [yearlyBudgetInput, setYearlyBudgetInput] = useState("");
  
  // We use yearData (the full export) to derive local stats instantly.
  const [yearData, setYearData] = useState<ExpenseExportResponse | null>(null);
  const [yearLoading, setYearLoading] = useState(false);
  const [yearError, setYearError] = useState("");

  const [aiCoachData, setAiCoachData] = useState<ExpenseIntelligenceResponse | null>(null);
  const [aiCoachLoading, setAiCoachLoading] = useState(false);
  const [aiCoachError, setAiCoachError] = useState("");

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

  const fetchAiCoach = useCallback(async () => {
    setAiCoachLoading(true);
    setAiCoachError("");
    try {
      const res = await getExpenseIntelligenceFromApi({ backendUrl, period: monthYearString });
      setAiCoachData(res);
    } catch (e) {
      setAiCoachError(e instanceof Error ? e.message : "Error loading AI Coach insights");
    } finally {
      setAiCoachLoading(false);
    }
  }, [backendUrl, monthYearString]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        const [url, target, yearlyTarget, threshold] = await Promise.all([
          getBackendUrl(),
          getBudgetTargetPreference(),
          getYearlyBudgetTargetPreference(),
          getBudgetWarningThresholdPreference(),
        ]);
        if (!active) return;
        setBackendUrl(url);
        setBudgetTarget(target);
        setYearlyBudgetTarget(yearlyTarget);
        setBudgetWarningThreshold(threshold);
        
        if (!yearData) {
          fetchYearData(url);
        }
      }
      load();
      return () => { active = false; };
    }, [fetchYearData, yearData])
  );

  // Reset AI coach data when month changes
  useEffect(() => {
    setAiCoachData(null);
    setAiCoachError("");
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
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }

  function prevYear() {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setFullYear(d.getFullYear() - 1);
      return d;
    });
  }

  function nextYear() {
    setCurrentDate(prev => {
      const d = new Date(prev);
      d.setFullYear(d.getFullYear() + 1);
      return d;
    });
  }

  async function handleSaveYearlyBudget() {
    const numericAmount = Number(yearlyBudgetInput.replace(/,/g, "."));
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setIsEditingYearlyBudget(false);
      return;
    }
    const targetToSave = numericAmount === 0 ? null : numericAmount;
    await saveYearlyBudgetTargetPreference(targetToSave);
    setYearlyBudgetTarget(targetToSave);
    setIsEditingYearlyBudget(false);
  }

  async function handleSaveMonthlyBudget() {
    const numericAmount = Number(monthlyBudgetInput.replace(/,/g, "."));
    if (!Number.isFinite(numericAmount) || numericAmount < 0) {
      setIsEditingMonthlyBudget(false);
      return;
    }
    const targetToSave = numericAmount === 0 ? null : numericAmount;
    await saveBudgetTargetPreference(targetToSave);
    setBudgetTarget(targetToSave);
    setIsEditingMonthlyBudget(false);
  }

  // We keep this for future internal logic if needed or it can be removed
  const dailySpendings = useMemo(() => {
    if (!monthSummaryData?.expenses?.length) return [];
    
    const grouped = monthSummaryData.expenses.reduce((acc, expense) => {
      const d = expense.date; 
      if (!acc[d]) acc[d] = { amount: 0, currency: expense.currency };
      acc[d].amount += expense.amount;
      return acc;
    }, {} as Record<string, { amount: number, currency: string }>);

    return Object.entries(grouped)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [monthSummaryData?.expenses]);

  const yearSummaryData = useMemo(() => {
    const expenses = yearData?.expenses || [];
    const currency = commonCurrency(expenses);
    const points = buildMonthlyPoints(expenses, currentDate.getFullYear());
    const total = points.reduce((sum, item) => sum + item.total, 0);
    const count = points.reduce((sum, item) => sum + item.count, 0);
    const average = points.length ? total / points.length : 0;
    
    // Peak period
    const peak = [...points].sort((a, b) => b.total - a.total)[0];
    const peakLabel = peak && peak.total > 0 ? `${peak.label} · ${formatAmount(peak.total, currency)}` : "No spending yet";
    
    return { points, total, average, count, currency, peakLabel };
  }, [yearData, currentDate]);

  // Derived Month Data
  const monthSummaryData = useMemo(() => {
    const allExpenses = yearData?.expenses || [];
    const monthExpenses = allExpenses.filter((e) => e.date.startsWith(monthYearString));
    
    const total = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const count = monthExpenses.length;
    const average = count > 0 ? total / count : 0;
    const currency = commonCurrency(monthExpenses);
    
    const cats: Record<string, { total: number; count: number }> = {};
    for (const e of monthExpenses) {
      const cat = e.category || "Uncategorized";
      if (!cats[cat]) cats[cat] = { total: 0, count: 0 };
      cats[cat].total += e.amount || 0;
      cats[cat].count += 1;
    }
    const byCategory = Object.entries(cats)
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.total - a.total);
      
    return { expenses: monthExpenses, total, count, average, currency, byCategory };
  }, [yearData, monthYearString]);

  return (
      <ScrollView 
        style={styles.screen} 
        contentContainerStyle={styles.container}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
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

        <View style={styles.monthSelector}>
          <Pressable onPress={summaryPeriod === "month" ? prevMonth : prevYear} style={styles.monthArrow}>
            <Ionicons name="chevron-back" color={colors.primary} size={20} />
          </Pressable>
          <Text style={styles.monthSelectorText}>
            {summaryPeriod === "month" ? displayMonthString : currentDate.getFullYear().toString()}
          </Text>
          <Pressable onPress={summaryPeriod === "month" ? nextMonth : nextYear} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" color={colors.primary} size={20} />
          </Pressable>
        </View>

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
                <SummaryMetricCard styles={styles} colors={colors} icon="calendar" label="This year" value={formatAmount(yearSummaryData.total, yearSummaryData.currency)} />
                <SummaryMetricCard styles={styles} colors={colors} icon="trending-up" label="Peak Period" value={yearSummaryData.peakLabel} />
                <SummaryMetricCard styles={styles} colors={colors} icon="pie-chart" label="Avg / month" value={formatAmount(yearSummaryData.average, yearSummaryData.currency)} />
              </View>

              <View style={styles.budgetPanel}>
                <View style={styles.budgetPanelHeader}>
                  <Text style={styles.panelTitle}>🎯 Yearly Target</Text>
                  {isEditingYearlyBudget ? (
                    <View style={styles.budgetEditRow}>
                      <TextInput
                        style={styles.budgetInput}
                        value={yearlyBudgetInput}
                        onChangeText={setYearlyBudgetInput}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={colors.muted}
                        autoFocus
                        onBlur={handleSaveYearlyBudget}
                        onSubmitEditing={handleSaveYearlyBudget}
                      />
                      <Pressable onPress={handleSaveYearlyBudget} style={styles.budgetSaveBtn}>
                        <Text style={styles.budgetSaveText}>Save</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.budgetPanelValueWrap}
                      onPress={() => {
                        setYearlyBudgetInput(yearlyBudgetTarget ? String(yearlyBudgetTarget) : "");
                        setIsEditingYearlyBudget(true);
                      }}
                    >
                      <Text style={styles.panelValue}>
                        {formatAmount(yearSummaryData.total, yearSummaryData.currency)} /{" "}
                        {yearlyBudgetTarget ? formatAmount(yearlyBudgetTarget, yearSummaryData.currency) : "Set Target"}
                      </Text>
                      <Ionicons name="pencil" size={12} color={colors.primary} />
                    </Pressable>
                  )}
                </View>
                {yearlyBudgetTarget && yearlyBudgetTarget > 0 ? (
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(100, (yearSummaryData.total / yearlyBudgetTarget) * 100)}%` },
                      ]}
                    />
                  </View>
                ) : null}
              </View>

              <SummaryBarChart currency={yearSummaryData.currency} points={yearSummaryData.points} styles={styles} />

              {yearData?.byCategory?.length ? (
                <View style={styles.detailCard}>
                  <Text style={styles.panelTitle}>🔥 Top categories (Year)</Text>
                  <View style={styles.breakdownList}>
                    {yearData.byCategory.slice(0, 5).map((item) => {
                      const categoryData = CATEGORY_CONFIG.find(
                        (c) => c.label.toLowerCase() === item.category.toLowerCase()
                      ) || CATEGORY_CONFIG[CATEGORY_CONFIG.length - 1];

                      return (
                        <View key={item.category} style={styles.breakdownRow}>
                          <View style={[styles.categoryIconBox, { backgroundColor: `${categoryData.accent}25` }]}>
                            <Ionicons name={categoryData.icon} size={18} color={categoryData.accent} />
                          </View>
                          <View style={styles.breakdownLabelWrap}>
                            <Text style={styles.breakdownLabel}>{item.category}</Text>
                            <Text style={styles.breakdownMeta}>{item.count} entries</Text>
                          </View>
                          <Text style={styles.breakdownValue}>{formatAmount(item.total, yearSummaryData.currency)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.emptyText}>Add expenses to see yearly trends.</Text>
          )
        ) : (
          // MONTH VIEW
          yearLoading ? (
            <View style={styles.stateRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.stateText}>Loading data...</Text>
            </View>
          ) : yearError ? (
            <Text style={styles.errorText}>{yearError}</Text>
          ) : monthSummaryData.count > 0 ? (
            <>
              <View style={styles.summaryMetricsRow}>
                <SummaryMetricCard styles={styles} colors={colors} icon="wallet" label="Spent" value={formatAmount(monthSummaryData.total, monthSummaryData.currency)} />
                <SummaryMetricCard styles={styles} colors={colors} icon="calculator" label="Avg / entry" value={formatAmount(monthSummaryData.average, monthSummaryData.currency)} />
                <SummaryMetricCard styles={styles} colors={colors} icon="list" label="Entries" value={`${monthSummaryData.count}`} />
              </View>

              <View style={styles.budgetPanel}>
                <View style={styles.budgetPanelHeader}>
                  <Text style={styles.panelTitle}>🎯 Monthly Budget</Text>
                  {isEditingMonthlyBudget ? (
                    <View style={styles.budgetEditRow}>
                      <TextInput
                        style={styles.budgetInput}
                        value={monthlyBudgetInput}
                        onChangeText={setMonthlyBudgetInput}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor={colors.muted}
                        autoFocus
                        onBlur={handleSaveMonthlyBudget}
                        onSubmitEditing={handleSaveMonthlyBudget}
                      />
                      <Pressable onPress={handleSaveMonthlyBudget} style={styles.budgetSaveBtn}>
                        <Text style={styles.budgetSaveText}>Save</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      style={styles.budgetPanelValueWrap}
                      onPress={() => {
                        setMonthlyBudgetInput(budgetTarget ? String(budgetTarget) : "");
                        setIsEditingMonthlyBudget(true);
                      }}
                    >
                      <Text style={styles.panelValue}>
                        {formatAmount(monthSummaryData.total, monthSummaryData.currency)} /{" "}
                        {budgetTarget ? formatAmount(budgetTarget, monthSummaryData.currency) : "Set Target"}
                      </Text>
                      <Ionicons name="pencil" size={12} color={colors.primary} />
                    </Pressable>
                  )}
                </View>
                {budgetTarget && budgetTarget > 0 ? (
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(100, (monthSummaryData.total / budgetTarget) * 100)}%` },
                      ]}
                    />
                  </View>
                ) : null}
              </View>

              <View style={styles.insightPanel}>
                {aiCoachLoading || aiCoachError || aiCoachData?.intelligence ? (
                  <View style={styles.insightHeaderRow}>
                    <Ionicons name="sparkles" color={colors.primary} size={18} />
                    <Text style={styles.insightHeaderTitle}>AI Coach</Text>
                  </View>
                ) : null}
                
                {aiCoachLoading ? (
                  <View style={styles.aiCoachLoadingState}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.aiCoachLoadingText}>Analyzing your spending patterns...</Text>
                  </View>
                ) : aiCoachError ? (
                  <Text style={styles.errorText}>{aiCoachError}</Text>
                ) : aiCoachData?.intelligence ? (
                  <>
                    <Text style={styles.insightHeadline}>{aiCoachData.intelligence.headline}</Text>
                    <Text style={styles.insightSummary}>{aiCoachData.intelligence.summary}</Text>
                    
                    {aiCoachData.intelligence.anomalies?.length > 0 && (
                      <View style={styles.insightSubSection}>
                        <Text style={styles.insightSubKicker}>Anomalies</Text>
                        {aiCoachData.intelligence.anomalies.map((ano, i) => (
                          <Text key={i} style={styles.insightBullet}>• {ano}</Text>
                        ))}
                      </View>
                    )}
                    {aiCoachData.intelligence.opportunities?.length > 0 && (
                      <View style={styles.insightSubSection}>
                        <Text style={styles.insightSubKicker}>Opportunities</Text>
                        {aiCoachData.intelligence.opportunities.map((opp, i) => (
                          <Text key={i} style={styles.insightBullet}>• {opp}</Text>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <Pressable 
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} 
                    onPress={fetchAiCoach}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Ionicons name="sparkles" color={colors.primary} size={18} />
                      <Text style={styles.insightHeaderTitle}>Generate AI Insights</Text>
                    </View>
                    <Ionicons name="chevron-forward" color={colors.primary} size={18} />
                  </Pressable>
                )}
              </View>

              {monthSummaryData.byCategory.length > 0 && (
                <View style={styles.detailCard}>
                  <Text style={styles.panelTitle}>📊 Top categories</Text>
                  <View style={styles.breakdownList}>
                    {monthSummaryData.byCategory.slice(0, 5).map((item) => {
                      const categoryData = CATEGORY_CONFIG.find(
                        (c) => c.label.toLowerCase() === item.category.toLowerCase()
                      ) || CATEGORY_CONFIG[CATEGORY_CONFIG.length - 1];

                      return (
                        <View key={item.category} style={styles.breakdownRow}>
                          <View style={[styles.categoryIconBox, { backgroundColor: `${categoryData.accent}25` }]}>
                            <Ionicons name={categoryData.icon} size={18} color={categoryData.accent} />
                          </View>
                          <View style={styles.breakdownLabelWrap}>
                            <Text style={styles.breakdownLabel}>{item.category}</Text>
                            <Text style={styles.breakdownMeta}>{item.count} entries</Text>
                          </View>
                          <Text style={styles.breakdownValue}>{formatAmount(item.total, monthSummaryData.currency)}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}

              {monthSummaryData.expenses.length > 0 && (
                <View style={styles.detailCard}>
                  <Pressable 
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    onPress={() => router.push(`/daily-spend?monthYear=${monthYearString}`)}
                  >
                    <Text style={styles.panelTitle}>📅 Daily Spend</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.primary} />
                  </Pressable>
                </View>
              )}

              {monthSummaryData.expenses.length > 0 && (
                <View style={styles.detailCard}>
                  <Text style={styles.panelTitle}>💳 Transactions</Text>
                  <View style={styles.recentList}>
                    {monthSummaryData.expenses.map((expense) => (
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

function buildMonthlyPoints(expenses: ExpenseItem[], currentYear: number): SummaryPoint[] {
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
  colors,
  label,
  value,
  icon,
}: {
  styles: ReturnType<typeof createStyles>;
  colors: any; // Using any or importing the exact type if preferred
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        {icon && <Ionicons name={icon} size={13} color={colors.primary} />}
        <Text 
          style={[styles.metricLabel, { flexShrink: 1 }]} 
          numberOfLines={1} 
          adjustsFontSizeToFit
        >
          {label}
        </Text>
      </View>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
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
      alignItems: "center",
      gap: spacing.sm,
    },
    budgetPanelValueWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    budgetEditRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    budgetInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
      minWidth: 80,
      textAlign: "right",
    },
    budgetSaveBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    budgetSaveText: {
      color: colors.onPrimary,
      fontSize: 12,
      fontWeight: "700",
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
    categoryIconBox: {
      alignItems: "center",
      justifyContent: "center",
      width: 36,
      height: 36,
      borderRadius: 10,
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
    aiCoachLoadingState: {
      alignItems: "center",
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    aiCoachLoadingText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    aiCoachPromptState: {
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    aiCoachPromptText: {
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    aiCoachButton: {
      backgroundColor: colors.primary,
      alignSelf: "flex-start",
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: 12,
      marginTop: spacing.xs,
    },
    aiCoachButtonText: {
      color: colors.onPrimary,
      fontWeight: "800",
      fontSize: 13,
    },
  });
}
