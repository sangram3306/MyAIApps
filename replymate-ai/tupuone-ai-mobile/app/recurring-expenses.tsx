import { useCallback, useMemo, useState } from "react";
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
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { MatrixBackground } from "../components/PremiumUI";
import {
  createRecurringExpenseFromApi,
  deleteRecurringExpenseFromApi,
  listRecurringExpensesFromApi,
  logRecurringExpenseFromApi,
  RecurringExpense,
} from "../services/api";
import { getBackendUrl } from "../storage/appStorage";
import { baseCategories } from "../constants/categories";

const frequencyOptions = ["daily", "weekly", "monthly", "yearly"] as const;

export default function RecurringExpensesScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [backendUrl, setBackendUrl] = useState("");
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isAdding, setIsAdding] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addCurrency, setAddCurrency] = useState<"AED" | "INR">("AED");
  const [addCategory, setAddCategory] = useState("Food");
  const [addDescription, setAddDescription] = useState("");
  const [addFrequency, setAddFrequency] = useState<typeof frequencyOptions[number]>("monthly");
  const [addSaving, setAddSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const url = await getBackendUrl();
      if (!url) {
        setError("Backend URL not found. Please restart the app.");
        return;
      }
      setBackendUrl(url);

      const response = await listRecurringExpensesFromApi({ backendUrl: url, activeOnly: true });
      setRecurringExpenses(response.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recurring expenses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSaveRecurring = async () => {
    if (!backendUrl) return;

    const numericAmount = Number(addAmount.replace(/,/g, "."));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount greater than zero.");
      return;
    }

    const desc = addDescription.trim() || addCategory;

    setAddSaving(true);
    try {
      await createRecurringExpenseFromApi({
        backendUrl,
        amount: numericAmount,
        currency: addCurrency,
        category: addCategory.toLowerCase(),
        description: desc,
        frequency: addFrequency,
      });

      setIsAdding(false);
      setAddAmount("");
      setAddDescription("");
      loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save recurring expense.");
    } finally {
      setAddSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!backendUrl) return;

    Alert.alert(
      "Delete Recurring Expense",
      "Are you sure you want to stop tracking this recurring expense? Past logs will not be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setActionLoading(prev => ({ ...prev, [id]: true }));
            try {
              await deleteRecurringExpenseFromApi({ backendUrl, id });
              setRecurringExpenses(prev => prev.filter(item => item.id !== id));
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Failed to delete.");
            } finally {
              setActionLoading(prev => ({ ...prev, [id]: false }));
            }
          },
        },
      ]
    );
  };

  const handleLogNow = async (id: string) => {
    if (!backendUrl) return;

    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await logRecurringExpenseFromApi({ backendUrl, id });
      Alert.alert("Success", "Expense logged successfully.");
      loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to log expense.");
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const calculateMonthlyFixed = () => {
    return recurringExpenses.reduce((sum, item) => {
      if (!item.isActive) return sum;
      let monthlyAmount = item.amount;
      if (item.frequency === "daily") monthlyAmount = item.amount * 30;
      if (item.frequency === "weekly") monthlyAmount = item.amount * 4.33;
      if (item.frequency === "yearly") monthlyAmount = item.amount / 12;
      return sum + monthlyAmount;
    }, 0);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
      style={styles.container}
    >
      <MatrixBackground density={12} />
      
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Recurring Expenses</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Fixed Costs (Estimated Monthly)</Text>
          <Text style={styles.summaryAmount}>
            {loading ? "..." : `AED ${calculateMonthlyFixed().toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!isAdding && (
          <Pressable style={styles.addButton} onPress={() => setIsAdding(true)}>
            <Ionicons name="add" size={20} color={colors.background} />
            <Text style={styles.addButtonText}>Add Recurring Expense</Text>
          </Pressable>
        )}

        {isAdding && (
          <View style={styles.addCard}>
            <View style={styles.addHeader}>
              <Text style={styles.addTitle}>New Recurring Expense</Text>
              <Pressable onPress={() => setIsAdding(false)}>
                <Ionicons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount</Text>
              <View style={styles.amountRow}>
                <TextInput
                  style={styles.amountInput}
                  value={addAmount}
                  onChangeText={setAddAmount}
                  placeholder="0.00"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                />
                <View style={styles.currencyToggle}>
                  {(["AED", "INR"] as const).map(curr => (
                    <Pressable
                      key={curr}
                      style={[styles.currencyOption, addCurrency === curr && styles.currencyOptionActive]}
                      onPress={() => setAddCurrency(curr)}
                    >
                      <Text style={[styles.currencyText, addCurrency === curr && styles.currencyTextActive]}>
                        {curr}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.textInput}
                value={addDescription}
                onChangeText={setAddDescription}
                placeholder="e.g. Netflix, Gym, Rent"
                placeholderTextColor={colors.muted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Frequency</Text>
              <View style={styles.frequencyRow}>
                {frequencyOptions.map(freq => (
                  <Pressable
                    key={freq}
                    style={[styles.frequencyPill, addFrequency === freq && styles.frequencyPillActive]}
                    onPress={() => setAddFrequency(freq)}
                  >
                    <Text style={[styles.frequencyText, addFrequency === freq && styles.frequencyTextActive]}>
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {baseCategories.map(cat => (
                  <Pressable
                    key={cat.label}
                    style={[
                      styles.categoryCard,
                      addCategory === cat.label && styles.categoryCardActive,
                      addCategory === cat.label && { borderColor: cat.accent }
                    ]}
                    onPress={() => setAddCategory(cat.label)}
                  >
                    <Ionicons name={cat.icon as any} size={16} color={addCategory === cat.label ? colors.onPrimary : cat.accent} />
                    <Text style={[styles.categoryCardText, addCategory === cat.label && styles.categoryCardTextActive]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <Pressable
              style={[styles.saveButton, addSaving && styles.saveButtonDisabled]}
              onPress={handleSaveRecurring}
              disabled={addSaving}
            >
              {addSaving ? <ActivityIndicator color={colors.background} /> : <Text style={styles.saveButtonText}>Save Subscription</Text>}
            </Pressable>
          </View>
        )}

        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Active Subscriptions</Text>
          
          {loading && !recurringExpenses.length ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
          ) : recurringExpenses.length === 0 ? (
            <Text style={styles.emptyText}>No active recurring expenses.</Text>
          ) : (
            recurringExpenses.map(item => {
              const isDue = item.nextDueDate <= new Date().toISOString().slice(0, 10);
              const catInfo = baseCategories.find(c => c.label.toLowerCase() === item.category.toLowerCase()) || baseCategories.find(c => c.label === "Other");
              const isActionLoading = actionLoading[item.id];

              return (
                <View key={item.id} style={styles.itemCard}>
                  <View style={styles.itemHeaderRow}>
                    <View style={styles.itemInfo}>
                      <View style={[styles.iconBox, { backgroundColor: (catInfo?.accent || colors.primary) + "22" }]}>
                        <Ionicons name={(catInfo?.icon as any) || "pricetag"} size={18} color={catInfo?.accent || colors.primary} />
                      </View>
                      <View>
                        <Text style={styles.itemDesc}>{item.description}</Text>
                        <Text style={styles.itemMeta}>
                          {item.currency} {item.amount} • {item.frequency}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(item.id)}
                      disabled={isActionLoading}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.red} />
                    </Pressable>
                  </View>
                  
                  <View style={styles.itemFooterRow}>
                    <View style={styles.dueBox}>
                      <Ionicons name="calendar-outline" size={14} color={isDue ? colors.amber : colors.muted} />
                      <Text style={[styles.dueText, isDue && styles.dueTextUrgent]}>
                        Next: {item.nextDueDate} {isDue && "(Due)"}
                      </Text>
                    </View>
                    <Pressable
                      style={[styles.logBtn, isDue && styles.logBtnDue, isActionLoading && styles.logBtnDisabled]}
                      onPress={() => handleLogNow(item.id)}
                      disabled={isActionLoading}
                    >
                      {isActionLoading ? (
                        <ActivityIndicator size="small" color={isDue ? colors.background : colors.primary} />
                      ) : (
                        <Text style={[styles.logBtnText, isDue && styles.logBtnTextDue]}>Log Now</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: any, topInset: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingTop: topInset + 10,
      paddingBottom: 15,
      paddingHorizontal: spacing.screen,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background + "E6",
    },
    backButton: {
      marginRight: 15,
      padding: 5,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    },
    content: {
      padding: spacing.screen,
      paddingBottom: 100,
    },
    summaryCard: {
      backgroundColor: colors.primary + "1A",
      borderWidth: 1,
      borderColor: colors.primary + "33",
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: 14,
      color: colors.text,
      opacity: 0.8,
      marginBottom: 8,
    },
    summaryAmount: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.primary,
    },
    errorContainer: {
      backgroundColor: colors.red + "22",
      padding: 12,
      borderRadius: 8,
      marginBottom: 20,
    },
    errorText: {
      color: colors.red,
      fontSize: 14,
    },
    addButton: {
      backgroundColor: colors.text,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
    },
    addButtonText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 8,
    },
    addCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    addTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
    },
    inputGroup: {
      marginBottom: 20,
    },
    inputLabel: {
      fontSize: 14,
      color: colors.text,
      opacity: 0.7,
      marginBottom: 8,
    },
    amountRow: {
      flexDirection: "row",
      gap: 10,
    },
    amountInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      color: colors.text,
    },
    currencyToggle: {
      flexDirection: "row",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      overflow: "hidden",
    },
    currencyOption: {
      paddingHorizontal: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    currencyOptionActive: {
      backgroundColor: colors.text,
    },
    currencyText: {
      fontSize: 14,
      color: colors.muted,
      fontWeight: "600",
    },
    currencyTextActive: {
      color: colors.background,
    },
    textInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 16,
      color: colors.text,
    },
    frequencyRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    frequencyPill: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    frequencyPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    frequencyText: {
      fontSize: 14,
      color: colors.muted,
    },
    frequencyTextActive: {
      color: colors.background,
      fontWeight: "600",
    },
    categoryScroll: {
      flexGrow: 0,
    },
    categoryCard: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 10,
      gap: 6,
    },
    categoryCardActive: {
      backgroundColor: colors.text,
    },
    categoryCardText: {
      fontSize: 14,
      color: colors.text,
    },
    categoryCardTextActive: {
      color: colors.background,
      fontWeight: "600",
    },
    saveButton: {
      backgroundColor: colors.text,
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 10,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "600",
    },
    listSection: {
      marginTop: 10,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 15,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 15,
      textAlign: "center",
      marginTop: 20,
    },
    itemCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 15,
    },
    itemInfo: {
      flexDirection: "row",
      gap: 12,
      flex: 1,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    itemDesc: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    itemMeta: {
      fontSize: 13,
      color: colors.muted,
    },
    deleteBtn: {
      padding: 8,
    },
    itemFooterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    dueBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    dueText: {
      fontSize: 13,
      color: colors.muted,
    },
    dueTextUrgent: {
      color: colors.amber,
      fontWeight: "600",
    },
    logBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: colors.primary + "22",
    },
    logBtnDue: {
      backgroundColor: colors.amber,
    },
    logBtnDisabled: {
      opacity: 0.5,
    },
    logBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.primary,
    },
    logBtnTextDue: {
      color: colors.background,
    },
  });
}
