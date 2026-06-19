import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, Alert, TextInput, ActivityIndicator } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { useAuth } from "../../context/auth";

export default function PaymentScreen() {
  const { colors } = useAppTheme();
  const { subscribeWithCoupon } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom]);

  const [coupon, setCoupon] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<"card" | "apple">("apple");

  const price = process.env.EXPO_PUBLIC_SPONE_MONTHLY_SUB_PRO_PRICE || "39";

  const handleApplyCoupon = async () => {
    if (!coupon.trim()) {
      Alert.alert("Required", "Please enter a coupon code.");
      return;
    }

    setLoading(true);
    try {
      await subscribeWithCoupon(coupon.trim());
      Alert.alert(
        "Success", 
        "Coupon applied successfully! Welcome to SP ONE PRO.",
        [{ text: "Awesome", onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Invalid or expired coupon.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = () => {
    Alert.alert("Coming Soon", "Direct payments are not yet enabled in this build. Please use a coupon code.");
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" color={colors.textMuted} size={20} />
          </Pressable>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View>
              <Text style={styles.planName}>SP ONE PRO</Text>
              <Text style={styles.planDesc}>Monthly Subscription</Text>
            </View>
            <Text style={styles.planPrice}>${price}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          
          <Pressable 
            style={[styles.paymentOption, selectedMethod === "apple" && styles.paymentOptionSelected]}
            onPress={() => setSelectedMethod("apple")}
          >
            <View style={styles.paymentOptionLeft}>
              <Ionicons name="logo-apple" size={24} color={colors.text} />
              <Text style={styles.paymentOptionText}>Apple Pay</Text>
            </View>
            <View style={styles.radioOuter}>
              {selectedMethod === "apple" && <View style={styles.radioInner} />}
            </View>
          </Pressable>

          <Pressable 
            style={[styles.paymentOption, selectedMethod === "card" && styles.paymentOptionSelected]}
            onPress={() => setSelectedMethod("card")}
          >
            <View style={styles.paymentOptionLeft}>
              <Ionicons name="card" size={24} color={colors.text} />
              <Text style={styles.paymentOptionText}>Credit or Debit Card</Text>
            </View>
            <View style={styles.radioOuter}>
              {selectedMethod === "card" && <View style={styles.radioInner} />}
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Have a Coupon?</Text>
          <View style={styles.couponContainer}>
            <TextInput
              style={styles.couponInput}
              placeholder="Enter code"
              placeholderTextColor={colors.textMuted}
              value={coupon}
              onChangeText={setCoupon}
              autoCapitalize="characters"
              editable={!loading}
            />
            <Pressable style={styles.applyButton} onPress={handleApplyCoupon} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.applyText}>Apply</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable style={styles.checkoutButton} onPress={handleCheckout}>
          <Text style={styles.checkoutText}>Pay ${price}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: any, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      paddingBottom: spacing.xxl + 80,
      paddingHorizontal: 20,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: spacing.xl,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceGlass,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    summaryCard: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.xl,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    planName: {
      color: colors.amber,
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 4,
    },
    planDesc: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: "500",
    },
    planPrice: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "800",
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: spacing.md,
      marginLeft: 4,
    },
    paymentOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    paymentOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
    },
    paymentOptionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    paymentOptionText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.textMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    couponContainer: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    couponInput: {
      flex: 1,
      height: 50,
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.lg,
      color: colors.text,
      paddingHorizontal: spacing.md,
      fontSize: 16,
      fontWeight: "600",
    },
    applyButton: {
      height: 50,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.amber,
      borderRadius: radius.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    applyText: {
      color: "#000",
      fontSize: 15,
      fontWeight: "800",
    },
    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.surfaceGlass,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 20,
      paddingTop: spacing.md,
      paddingBottom: Math.max(spacing.md, bottomInset),
    },
    checkoutButton: {
      backgroundColor: colors.primary,
      height: 56,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    checkoutText: {
      color: "#000",
      fontSize: 16,
      fontWeight: "800",
    },
  });
}
