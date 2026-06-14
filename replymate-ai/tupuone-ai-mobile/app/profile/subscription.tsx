import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, Alert } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { useAuth } from "../../context/auth";
import Constants from "expo-constants";

const PRO_FEATURES = [
  {
    title: "DeepSeek V4 Pro Access",
    description: "Unlock the full potential of DeepSeek V4 and OpenRouter Paid models.",
    icon: "sparkles",
    color: "#00FFC6", // primary
  },
  {
    title: "Unlimited Advanced Reasoning",
    description: "Get smarter, deeper answers without any usage caps or daily limits.",
    icon: "brain",
    color: "#FF3366", // accent
  },
  {
    title: "Priority Customer Support",
    description: "Skip the queue and get your issues resolved faster by our dedicated team.",
    icon: "headset",
    color: "#FFD700",
  },
  {
    title: "Early Access to New Features",
    description: "Be the first to experience cutting-edge tools and capabilities before anyone else.",
    icon: "rocket",
    color: "#B48EAD",
  },
] as const;

export default function SubscriptionScreen() {
  const { colors } = useAppTheme();
  const { user, unsubscribe } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top, insets.bottom), [colors, insets.top, insets.bottom]);

  const price = process.env.EXPO_PUBLIC_SPONE_MONTHLY_SUB_PRO_PRICE || "39";

  const handleSubscribe = () => {
    router.push("/profile/payment" as never);
  };

  const handleUnsubscribe = () => {
    Alert.alert(
      "Unsubscribe",
      "Are you sure you want to cancel your Pro subscription? You will lose access to premium AI models.",
      [
        { text: "Keep Pro", style: "cancel" },
        { 
          text: "Unsubscribe", 
          style: "destructive", 
          onPress: async () => {
            try {
              await unsubscribe();
              Alert.alert("Success", "You have been unsubscribed from SP ONE PRO.");
              router.back();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to unsubscribe.");
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <MatrixBackground density={15} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" color={colors.textMuted} size={20} />
          </Pressable>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.crownContainer}>
            <Ionicons name="star" color={colors.amber} size={50} />
          </View>
          <Text style={styles.appName}>SP ONE PRO</Text>
          <Text style={styles.motto}>
            Upgrade your experience and unleash unlimited possibilities with our premium AI models.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Everything in Pro</Text>
        </View>

        <View style={styles.featuresContainer}>
          {PRO_FEATURES.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <View style={[styles.featureIconBox, { backgroundColor: `${feature.color}15` }]}>
                <Ionicons name={feature.icon as any} color={feature.color} size={24} />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceLabel}>Monthly Plan</Text>
          <Text style={styles.priceText}>
            <Text style={styles.currencySymbol}>$</Text>{price}
            <Text style={styles.billingPeriod}> /mo</Text>
          </Text>
        </View>
        {user?.plan === "pro" ? (
          <Pressable style={[styles.subscribeButton, { backgroundColor: colors.danger }]} onPress={handleUnsubscribe}>
            <Text style={[styles.subscribeText, { color: "#FFF" }]}>Unsubscribe</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.subscribeButton} onPress={handleSubscribe}>
            <Text style={styles.subscribeText}>Upgrade Now</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number, bottomInset: number) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      paddingBottom: spacing.xxxl + 80, // Space for bottom bar
      gap: 20,
      paddingHorizontal: 20,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      paddingTop: spacing.xs,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    heroSection: {
      alignItems: "center",
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    crownContainer: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: "rgba(250,204,21,0.1)",
      borderColor: "rgba(250,204,21,0.3)",
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.md,
      shadowColor: colors.amber,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
    },
    appName: {
      color: colors.amber,
      fontSize: 32,
      fontWeight: "900",
      letterSpacing: 2,
    },
    motto: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "500",
      textAlign: "center",
      marginTop: spacing.sm,
      lineHeight: 22,
      paddingHorizontal: spacing.sm,
    },
    sectionHeader: {
      marginTop: spacing.sm,
      marginBottom: -spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    sectionTitle: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    featuresContainer: {
      gap: spacing.md,
    },
    featureCard: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.lg,
      flexDirection: "row",
      alignItems: "center",
    },
    featureIconBox: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    featureTextContainer: {
      flex: 1,
    },
    featureTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
      marginBottom: 4,
    },
    featureDescription: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 18,
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    priceContainer: {
      flex: 1,
    },
    priceLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    priceText: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
    },
    currencySymbol: {
      fontSize: 18,
      color: colors.textMuted,
      marginRight: 2,
    },
    billingPeriod: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: "600",
    },
    subscribeButton: {
      backgroundColor: colors.amber,
      paddingHorizontal: spacing.xl,
      paddingVertical: 14,
      borderRadius: radius.full,
      shadowColor: colors.amber,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    subscribeText: {
      color: "#000",
      fontSize: 15,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
  });
}
