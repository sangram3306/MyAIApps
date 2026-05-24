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
  ExpenseItem,
  ExpenseMessageResponse,
  sendExpenseMessageFromApi,
} from "../../services/api";

const quickActions = [
  "I spent 45 on groceries",
  "Show this month's spending",
  "Summarize food expenses",
];

export default function ExpensesScreen() {
  const [backendUrl, setBackendUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExpenseMessageResponse | null>(null);

  useFocusEffect(
    useCallback(() => {
      getBackendUrl().then(setBackendUrl);
    }, []),
  );

  async function handleAnalyze(value?: string) {
    const nextMessage = (value ?? message).trim();

    if (!backendUrl) {
      setError("ReplyMate AI could not find the backend URL. Please restart the app.");
      return;
    }

    if (!nextMessage) {
      setError("Tell me what you spent or ask for an expense insight.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage(nextMessage);

    try {
      const response = await sendExpenseMessageFromApi({
        backendUrl,
        message: nextMessage,
      });
      setResult(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Expense Tracker is temporarily unavailable.");
    } finally {
      setLoading(false);
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
            Log spending in natural language and let the agent pull insights from your DB.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>What should I track?</Text>
          <TextInput
            multiline
            placeholder="Example: I spent 120 on dinner yesterday and 35 on fuel today"
            placeholderTextColor={colors.muted}
            style={styles.input}
            textAlignVertical="top"
            value={message}
            onChangeText={setMessage}
          />

          <View style={styles.quickRow}>
            {quickActions.map((action) => (
              <Pressable
                key={action}
                disabled={loading}
                onPress={() => handleAnalyze(action)}
                style={styles.quickPill}
              >
                <Text style={styles.quickText}>{action}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            disabled={loading}
            onPress={() => handleAnalyze()}
            style={[styles.primaryButton, loading && styles.disabledButton]}
          >
            {loading ? (
              <ActivityIndicator color="#07110D" />
            ) : (
              <>
                <Ionicons name="sparkles-outline" color="#07110D" size={18} />
                <Text style={styles.primaryButtonText}>Analyze Spending</Text>
              </>
            )}
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {result ? (
          <View style={styles.results}>
            <View style={styles.insightCard}>
              <Text style={styles.sectionKicker}>AI Insight</Text>
              <Text style={styles.answer}>{result.assistantReply}</Text>
            </View>

            <View style={styles.metricsRow}>
              <MetricCard label="Total" value={formatAmount(result.total)} />
              <MetricCard label="Records" value={`${result.expenses.length}`} />
            </View>

            {result.toolCalls.length ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Skills & Tools</Text>
                <View style={styles.pillWrap}>
                  <View style={styles.toolPill}>
                    <Text style={styles.pillType}>Skill</Text>
                    <Text style={styles.pillName}>Expense Tracker</Text>
                    <Text style={styles.pillSource}>LLM</Text>
                  </View>
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
                {result.byCategory.map((category) => (
                  <View key={category.category} style={styles.categoryRow}>
                    <Text style={styles.categoryName}>{category.category}</Text>
                    <Text style={styles.categoryValue}>
                      {formatAmount(category.total)} · {category.count}
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
      <Text style={styles.expenseAmount}>{formatAmount(expense.amount)}</Text>
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

function formatAmount(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0.00";
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
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
  label: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  input: {
    backgroundColor: "rgba(24, 27, 34, 0.94)",
    borderColor: "rgba(69, 245, 198, 0.24)",
    borderRadius: 18,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    lineHeight: 23,
    minHeight: 118,
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
  disabledButton: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: "#07110D",
    fontSize: 16,
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
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
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
