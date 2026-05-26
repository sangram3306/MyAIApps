import { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { useFocusEffect } from "expo-router";
import { colors, spacing } from "../../constants/theme";
import { getBackendUrl } from "../../storage/appStorage";
import {
  createExpenseFromApi,
  ExpenseItem,
  ExpenseMessageResponse,
  sendExpenseMessageFromApi,
} from "../../services/api";

const categories: Array<{
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}> = [
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

const insightPrompts = [
  "Summarize all expenses",
  "Summarize food expenses",
  "Which category is highest?",
];

export default function ExpensesScreen() {
  const [backendUrl, setBackendUrl] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"AED" | "INR">("AED");
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [insightPrompt, setInsightPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExpenseMessageResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      getBackendUrl().then(setBackendUrl);
    }, []),
  );

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
      setResult(response);
      setAmount("");
      setNote("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyze(value?: string) {
    const nextPrompt = (value ?? insightPrompt).trim();

    if (!backendUrl) {
      setError("ReplyMate AI could not find the backend URL. Please restart the app.");
      return;
    }

    if (!nextPrompt) {
      setError("Ask for an expense summary or insight.");
      return;
    }

    setAnalyzing(true);
    setError("");
    setInsightPrompt(nextPrompt);

    try {
      const response = await sendExpenseMessageFromApi({
        backendUrl,
        message: nextPrompt,
      });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Expense insights are temporarily unavailable.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      style={styles.keyboard}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.glowPrimary} />
        <View style={styles.glowAmber} />

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="wallet-outline" color={colors.primary} size={28} />
          </View>
          <Text style={styles.eyebrow}>AI Finance Skill</Text>
          <Text style={styles.title}>Expense Tracker</Text>
          <Text style={styles.subtitle}>
            Save expenses with clean categories, then ask AI to summarize patterns from your DB.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Save Expense</Text>
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
            {categories.map((item) => {
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
                      color={selected ? "#07110D" : item.accent}
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
              <ActivityIndicator color="#07110D" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" color="#07110D" size={19} />
                <Text style={styles.primaryButtonText}>Save Expense</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>AI Insights</Text>
            <Text style={styles.sectionHint}>LLM + MCP tools</Text>
          </View>

          <TextInput
            multiline
            placeholder="Ask: summarize food expenses, show this month's spending..."
            placeholderTextColor={colors.muted}
            style={styles.insightInput}
            textAlignVertical="top"
            value={insightPrompt}
            onChangeText={setInsightPrompt}
          />

          <View style={styles.quickRow}>
            {insightPrompts.map((prompt) => (
              <Pressable
                key={prompt}
                disabled={analyzing}
                onPress={() => handleAnalyze(prompt)}
                style={styles.quickPill}
              >
                <Text style={styles.quickText}>{prompt}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            disabled={analyzing}
            onPress={() => handleAnalyze()}
            style={[styles.secondaryButton, analyzing && styles.disabledButton]}
          >
            {analyzing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="sparkles-outline" color={colors.primary} size={18} />
                <Text style={styles.secondaryButtonText}>Generate Insight</Text>
              </>
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.results}>
            <View style={styles.insightCard}>
              <Text style={styles.sectionKicker}>Latest Result</Text>
              <Text style={styles.answer}>{result.assistantReply}</Text>
            </View>

            <View style={styles.metricsRow}>
              <MetricCard label="Total" value={formatTotal(result)} />
              <MetricCard label="Records" value={`${result.expenses.length}`} />
            </View>

            {result.toolCalls.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Skills & Tools</Text>
                <View style={styles.pillWrap}>
                  {result.metadata.toolSources.answerGeneration === "llm" ? (
                    <View style={styles.toolPill}>
                      <Text style={styles.pillType}>Skill</Text>
                      <Text style={styles.pillName}>Expense Insights</Text>
                      <Text style={styles.pillSource}>LLM</Text>
                    </View>
                  ) : null}
                  {result.toolCalls.map((tool, index) => (
                    <View key={`${tool.name}-${index}`} style={styles.toolPill}>
                      <Text style={styles.pillType}>Tool</Text>
                      <Text style={styles.pillName}>{labelForTool(tool.name)}</Text>
                      <Text style={styles.dbBadge}>DB</Text>
                      <Text style={styles.pillSource}>{tool.source}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {result.byCategory?.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Category Breakdown</Text>
                {result.byCategory.map((item) => (
                  <View key={item.category} style={styles.categoryRow}>
                    <Text style={styles.categoryName}>{item.category}</Text>
                    <Text style={styles.categoryValue}>
                      {formatAmount(item.total, commonCurrency(result.expenses))} · {item.count}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {result.expenses.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Recent Expenses</Text>
                {result.expenses.slice(0, 8).map((expense, index) => (
                  <ExpenseRow key={expense.id} expense={expense} index={index} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ExpenseRow({ expense, index }: { expense: ExpenseItem; index: number }) {
  return (
    <View style={styles.expenseRow}>
      <View style={styles.expenseNumber}>
        <Text style={styles.expenseNumberText}>{index + 1}</Text>
      </View>
      <View style={styles.expenseMain}>
        <Text style={styles.expenseDescription}>{expense.description}</Text>
        <Text style={styles.expenseMeta}>
          {expense.category} · {expense.date}
        </Text>
      </View>
      <Text style={styles.expenseAmount}>{formatAmount(expense.amount, expense.currency || "AED")}</Text>
    </View>
  );
}

function labelForTool(toolName: string): string {
  const labels: Record<string, string> = {
    createExpense: "Create Expense",
    listExpenses: "List Expenses",
    expenseSummary: "Expense Summary",
    deleteExpense: "Delete Expense",
  };
  return labels[toolName] || toolName;
}

function formatTotal(result: ExpenseMessageResponse): string {
  return formatAmount(result.total, commonCurrency(result.expenses));
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

const styles = StyleSheet.create({
  keyboard: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  glowPrimary: {
    backgroundColor: "rgba(69, 245, 198, 0.18)",
    borderRadius: 999,
    height: 180,
    position: "absolute",
    right: -70,
    top: -50,
    width: 180,
  },
  glowAmber: {
    backgroundColor: "rgba(255, 209, 102, 0.10)",
    borderRadius: 999,
    height: 220,
    left: -120,
    position: "absolute",
    top: 260,
    width: 220,
  },
  hero: {
    gap: spacing.xs,
    paddingTop: spacing.lg,
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    borderWidth: 1,
    height: 54,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 54,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
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
    backgroundColor: "rgba(17, 19, 24, 0.94)",
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  sectionHeader: {
    gap: 2,
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
  amountShell: {
    backgroundColor: "rgba(24, 27, 34, 0.94)",
    borderColor: "rgba(69, 245, 198, 0.24)",
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  amountEntryRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  amountLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  currencySwitch: {
    backgroundColor: "rgba(5, 5, 6, 0.62)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    padding: 3,
  },
  currencyOption: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  currencyOptionSelected: {
    backgroundColor: colors.primary,
  },
  currencyText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "900",
  },
  currencyTextSelected: {
    color: "#07110D",
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
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  categoryHeaderValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  categoryRail: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingRight: spacing.md,
    paddingVertical: 2,
  },
  categoryCard: {
    alignItems: "center",
    backgroundColor: "rgba(24, 27, 34, 0.82)",
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 92,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    width: 92,
  },
  categoryCardSelected: {
    backgroundColor: "rgba(69, 245, 198, 0.10)",
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  categoryIcon: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  categoryCardText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    textAlign: "center",
  },
  categoryCardTextSelected: {
    color: colors.primary,
  },
  noteInput: {
    backgroundColor: "rgba(24, 27, 34, 0.94)",
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  insightInput: {
    backgroundColor: "rgba(24, 27, 34, 0.94)",
    borderColor: "rgba(69, 245, 198, 0.24)",
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
    backgroundColor: "rgba(69, 245, 198, 0.08)",
    borderColor: "rgba(69, 245, 198, 0.22)",
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
    backgroundColor: colors.primary,
    borderRadius: 18,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 54,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(69, 245, 198, 0.08)",
    borderColor: "rgba(69, 245, 198, 0.28)",
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
    color: "#07110D",
    fontSize: 16,
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
    borderRadius: 16,
    borderWidth: 1,
    color: colors.danger,
    lineHeight: 20,
    padding: spacing.md,
  },
  results: {
    gap: spacing.md,
  },
  insightCard: {
    backgroundColor: "rgba(69, 245, 198, 0.09)",
    borderColor: "rgba(69, 245, 198, 0.30)",
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
    backgroundColor: "rgba(69, 245, 198, 0.07)",
    borderColor: "rgba(69, 245, 198, 0.22)",
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
    backgroundColor: "rgba(69, 245, 198, 0.13)",
    borderColor: "rgba(69, 245, 198, 0.25)",
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
