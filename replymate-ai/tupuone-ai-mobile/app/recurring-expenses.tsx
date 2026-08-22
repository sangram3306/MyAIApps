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
  updateRecurringExpenseFromApi,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState("");
  const [addCurrency, setAddCurrency] = useState<"AED" | "INR">("AED");
  const [addCategory, setAddCategory] = useState("Food");
  const [addDescription, setAddDescription] = useState("");
  const [addFrequency, setAddFrequency] = useState<typeof frequencyOptions[number]>("monthly");
  const [addStartDate, setAddStartDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
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
      if (editingId) {
        await updateRecurringExpenseFromApi({
          backendUrl,
          id: editingId,
          amount: numericAmount,
          currency: addCurrency,
          category: addCategory.toLowerCase(),
          description: desc,
          frequency: addFrequency,
          nextDueDate: addStartDate.toISOString().slice(0, 10), // updating start date alters next due date
        });
      } else {
        await createRecurringExpenseFromApi({
          backendUrl,
          amount: numericAmount,
          currency: addCurrency,
          category: addCategory.toLowerCase(),
          description: desc,
          frequency: addFrequency,
          startDate: addStartDate.toISOString().slice(0, 10),
        });
      }

      setIsAdding(false);
      setEditingId(null);
      setAddAmount("");
      setAddDescription("");
      setAddStartDate(new Date());
      setShowDatePicker(false);
      loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to save recurring expense.");
    } finally {
      setAddSaving(false);
    }
  };

  const handleEdit = (item: RecurringExpense) => {
    setEditingId(item.id);
    setAddAmount(item.amount.toString());
    setAddCurrency(item.currency);
    const catLabel = baseCategories.find(c => c.label.toLowerCase() === item.category.toLowerCase())?.label || "Food";
    setAddCategory(catLabel);
    setAddDescription(item.description);
    setAddFrequency(item.frequency);
    setAddStartDate(new Date(item.nextDueDate));
    setIsAdding(true);
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
      style={[styles.container, { width: "100%" }]}
    >
      <MatrixBackground density={12} />
      
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Subscriptions</Text>
          <Text style={styles.headerSubtitle}>Manage recurring expenses</Text>
        </View>
      </View>

      <ScrollView 
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconRow}>
            <View style={styles.summaryIconBox}>
              <Ionicons name="repeat" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryLabel}>Monthly Fixed Costs</Text>
              <Text style={styles.summaryAmount}>
                {loading ? "..." : `AED ${calculateMonthlyFixed().toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
              </Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryFooter}>
            <View style={styles.summaryStatChip}>
              <Text style={styles.summaryStatValue}>{recurringExpenses.length}</Text>
              <Text style={styles.summaryStatLabel}>Active</Text>
            </View>
            <View style={styles.summaryStatDot} />
            <View style={styles.summaryStatChip}>
              <Text style={styles.summaryStatValue}>
                {recurringExpenses.filter(i => i.nextDueDate <= new Date().toISOString().slice(0, 10)).length}
              </Text>
              <Text style={styles.summaryStatLabel}>Due</Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {!isAdding && (
          <Pressable style={styles.addButton} onPress={() => {
            setEditingId(null);
            setAddAmount("");
            setAddDescription("");
            setAddStartDate(new Date());
            setIsAdding(true);
          }}>
            <View style={styles.addIconCircle}>
              <Ionicons name="add" size={18} color={colors.primary} />
            </View>
            <Text style={styles.addButtonText}>Add Subscription</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        )}

        {isAdding && (
          <View style={styles.addCard}>
            <View style={styles.addHeader}>
              <Text style={styles.addTitle}>{editingId ? "Edit Subscription" : "New Subscription"}</Text>
              <Pressable onPress={() => { setIsAdding(false); setEditingId(null); }} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.muted} />
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
              <Text style={styles.inputLabel}>Start Date</Text>
              <Pressable
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(!showDatePicker)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.datePickerText}>
                  {addStartDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </Text>
                <Ionicons name={showDatePicker ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
              </Pressable>
              {showDatePicker && (
                <View style={styles.dateGrid}>
                  <View style={styles.dateRow}>
                    <Pressable
                      style={styles.dateArrowBtn}
                      onPress={() => setAddStartDate(prev => {
                        const d = new Date(prev);
                        d.setMonth(d.getMonth() - 1);
                        return d;
                      })}
                    >
                      <Ionicons name="chevron-back" size={18} color={colors.text} />
                    </Pressable>
                    <Text style={styles.dateMonthLabel}>
                      {addStartDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </Text>
                    <Pressable
                      style={styles.dateArrowBtn}
                      onPress={() => setAddStartDate(prev => {
                        const d = new Date(prev);
                        d.setMonth(d.getMonth() + 1);
                        return d;
                      })}
                    >
                      <Ionicons name="chevron-forward" size={18} color={colors.text} />
                    </Pressable>
                  </View>
                  <View style={styles.dateDaysGrid}>
                    {Array.from({ length: new Date(addStartDate.getFullYear(), addStartDate.getMonth() + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                      const isSelected = addStartDate.getDate() === day;
                      return (
                        <Pressable
                          key={day}
                          style={[styles.dateDayCell, isSelected && styles.dateDayCellActive]}
                          onPress={() => {
                            const d = new Date(addStartDate);
                            d.setDate(day);
                            setAddStartDate(d);
                          }}
                        >
                          <Text style={[styles.dateDayText, isSelected && styles.dateDayTextActive]}>{day}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
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
            <View style={styles.emptyCard}>
              <Ionicons name="wallet-outline" size={36} color={colors.muted} />
              <Text style={styles.emptyTitle}>No subscriptions yet</Text>
              <Text style={styles.emptyHint}>Add your first recurring expense to track fixed costs automatically.</Text>
            </View>
          ) : (
            recurringExpenses.map(item => {
              const isDue = item.nextDueDate <= new Date().toISOString().slice(0, 10);
              const catInfo = baseCategories.find(c => c.label.toLowerCase() === item.category.toLowerCase()) || baseCategories.find(c => c.label === "Other");
              const isActionLoading = actionLoading[item.id];
              const accent = catInfo?.accent || colors.primary;

              return (
                <View key={item.id} style={[styles.itemCard, isDue && styles.itemCardDue]}>
                  <View style={styles.itemHeaderRow}>
                    <View style={styles.itemInfo}>
                      <View style={[styles.iconBox, { backgroundColor: accent + "22" }]}>
                        <Ionicons name={(catInfo?.icon as any) || "pricetag"} size={18} color={accent} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                        <Text style={styles.itemMeta}>
                          {item.frequency.charAt(0).toUpperCase() + item.frequency.slice(1)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.amountBadge, { backgroundColor: accent + "18" }]}>
                      <Text style={[styles.amountBadgeText, { color: accent }]}>
                        {item.currency} {item.amount}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.itemFooterRow}>
                    <View style={styles.dueBox}>
                      <Ionicons name="calendar-outline" size={14} color={isDue ? colors.amber : colors.muted} />
                      <Text style={[styles.dueText, isDue && styles.dueTextUrgent]}>
                        {isDue ? "Due now" : item.nextDueDate}
                      </Text>
                    </View>
                    <View style={styles.itemActions}>
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
                      <Pressable
                        style={styles.deleteBtn}
                        onPress={() => handleEdit(item)}
                        disabled={isActionLoading}
                      >
                        <Ionicons name="pencil-outline" size={16} color={colors.primary + "CC"} />
                      </Pressable>
                      <Pressable
                        style={styles.deleteBtn}
                        onPress={() => handleDelete(item.id)}
                        disabled={isActionLoading}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.red + "88"} />
                      </Pressable>
                    </View>
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
      paddingBottom: 12,
      paddingHorizontal: spacing.screen,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background + "E6",
    },
    backButton: {
      marginRight: 14,
      padding: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    },
    headerSubtitle: {
      fontSize: 13,
      color: colors.muted,
      marginTop: 2,
    },
    content: {
      padding: spacing.screen,
      paddingBottom: 60,
    },

    // ── Hero Summary ──────────────────────────────────
    summaryCard: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.primary + "33",
      borderRadius: 16,
      padding: 16,
      marginBottom: 14,
    },
    summaryIconRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    summaryIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.primary + "1A",
      alignItems: "center",
      justifyContent: "center",
    },
    summaryLabel: {
      fontSize: 13,
      color: colors.muted,
      marginBottom: 2,
    },
    summaryAmount: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.primary,
    },
    summaryDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    summaryFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
    },
    summaryStatChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    summaryStatValue: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.text,
    },
    summaryStatLabel: {
      fontSize: 13,
      color: colors.muted,
    },
    summaryStatDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.muted,
    },

    // ── Error ─────────────────────────────────────────
    errorContainer: {
      backgroundColor: colors.red + "22",
      padding: 12,
      borderRadius: 8,
      marginBottom: 14,
    },
    errorText: {
      color: colors.red,
      fontSize: 14,
    },

    // ── Add Button ────────────────────────────────────
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      marginBottom: 14,
      gap: 12,
    },
    addIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.primary + "1A",
      alignItems: "center",
      justifyContent: "center",
    },
    addButtonText: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "600",
    },

    // ── Add Card / Form ──────────────────────────────
    addCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 16,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    addTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.text,
    },
    closeBtn: {
      padding: 4,
    },
    inputGroup: {
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: 13,
      color: colors.muted,
      fontWeight: "500",
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
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
      backgroundColor: colors.primary,
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
      marginRight: 8,
      gap: 6,
    },
    categoryCardActive: {
      backgroundColor: colors.text,
    },
    categoryCardText: {
      fontSize: 13,
      color: colors.text,
    },
    categoryCardTextActive: {
      color: colors.background,
      fontWeight: "600",
    },
    saveButton: {
      backgroundColor: colors.primary,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 4,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: "600",
    },

    // ── List Section ──────────────────────────────────
    listSection: {
      marginTop: 6,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 12,
    },
    emptyCard: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 30,
      alignItems: "center",
      gap: 8,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
    },
    emptyHint: {
      fontSize: 14,
      color: colors.muted,
      textAlign: "center",
      lineHeight: 20,
    },

    // ── Subscription Cards ────────────────────────────
    itemCard: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemCardDue: {
      borderColor: colors.amber + "66",
    },
    itemHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    itemInfo: {
      flexDirection: "row",
      gap: 10,
      flex: 1,
      alignItems: "center",
      marginRight: 10,
    },
    iconBox: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    itemDesc: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 2,
    },
    itemMeta: {
      fontSize: 12,
      color: colors.muted,
    },
    amountBadge: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
      maxWidth: "40%",
    },
    amountBadgeText: {
      fontSize: 13,
      fontWeight: "700",
    },
    deleteBtn: {
      padding: 6,
    },
    itemFooterRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
    },
    itemActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    dueBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      flexShrink: 1,
      marginRight: 10,
    },
    dueText: {
      fontSize: 12,
      color: colors.muted,
    },
    dueTextUrgent: {
      color: colors.amber,
      fontWeight: "600",
    },
    logBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 10,
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

    // ── Date Picker ───────────────────────────────────
    datePickerButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      gap: 10,
    },
    datePickerText: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
    },
    dateGrid: {
      marginTop: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
    },
    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    dateArrowBtn: {
      padding: 6,
    },
    dateMonthLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
    },
    dateDaysGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
    },
    dateDayCell: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceElevated,
    },
    dateDayCellActive: {
      backgroundColor: colors.primary,
    },
    dateDayText: {
      fontSize: 13,
      color: colors.text,
    },
    dateDayTextActive: {
      color: colors.background,
      fontWeight: "700",
    },
  });
}

