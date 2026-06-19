import { useMemo } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";

const SOCIAL_LINKS = [
  { id: "instagram", name: "Instagram", icon: "logo-instagram", url: "https://instagram.com" },
  { id: "x", name: "X (Twitter)", icon: "logo-twitter", url: "https://x.com" },
  { id: "youtube", name: "YouTube", icon: "logo-youtube", url: "https://youtube.com" },
  { id: "whatsapp", name: "WhatsApp", icon: "logo-whatsapp", url: "https://whatsapp.com" },
] as const;

export default function SupportScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  function handleOpenLink(url: string) {
    Linking.openURL(url).catch(() => {
      // Ignore errors for placeholders
    });
  }

  function handleEmail() {
    Linking.openURL("mailto:spcom@help.ae").catch(() => {
      // Ignore errors if no email client
    });
  }

  return (
    <View style={styles.screen}>
      <MatrixBackground density={10} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" color={colors.textMuted} size={20} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Help & Support</Text>
            <Text style={styles.subtitle}>Get in touch with us</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="headset-outline" color={colors.primary} size={48} />
          </View>
          <Text style={styles.description}>
            Need assistance? Reach out to our support team or follow us on our social channels for the latest updates.
          </Text>

          <Pressable onPress={handleEmail} style={styles.emailButton}>
            <Ionicons name="mail-outline" color={colors.onPrimary} size={20} />
            <View style={styles.emailTextContainer}>
              <Text style={styles.emailLabel}>Email Support</Text>
              <Text style={styles.emailValue}>spcom@help.ae</Text>
            </View>
            <Ionicons name="arrow-forward" color={colors.onPrimary} size={16} />
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Social Media</Text>
        </View>

        <View style={styles.socialCard}>
          {SOCIAL_LINKS.map((link, index) => (
            <View key={link.id}>
              <Pressable onPress={() => handleOpenLink(link.url)} style={styles.socialRow}>
                <View style={styles.socialIconContainer}>
                  <Ionicons name={link.icon as any} color={colors.text} size={20} />
                </View>
                <Text style={styles.socialName}>{link.name}</Text>
                <Ionicons name="open-outline" color={colors.textMuted} size={16} />
              </Pressable>
              {index < SOCIAL_LINKS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Ionicons name="business-outline" color={colors.textMuted} size={24} />
          <Text style={styles.companyName}>SP International Co. ltd</Text>
          <Text style={styles.companySubtitle}>All rights reserved</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      paddingBottom: spacing.xxl,
      gap: 20,
      paddingHorizontal: 20,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      paddingTop: spacing.xs,
      marginBottom: spacing.xs,
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
    headerCopy: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    card: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.lg,
    },
    iconContainer: {
      backgroundColor: "rgba(0,255,198,0.1)",
      padding: spacing.lg,
      borderRadius: radius.pill,
      marginBottom: spacing.xs,
    },
    description: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
      lineHeight: 22,
    },
    emailButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      flexDirection: "row",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      width: "100%",
      marginTop: spacing.sm,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    emailTextContainer: {
      flex: 1,
      marginLeft: spacing.md,
      gap: 2,
    },
    emailLabel: {
      color: "rgba(0,0,0,0.6)",
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    emailValue: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: "900",
    },
    sectionHeader: {
      marginTop: spacing.md,
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
    socialCard: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    socialRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.lg,
    },
    socialIconContainer: {
      width: 32,
      height: 32,
      borderRadius: radius.sm,
      backgroundColor: "rgba(255,255,255,0.05)",
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.md,
    },
    socialName: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginLeft: 64,
    },
    footer: {
      alignItems: "center",
      marginTop: spacing.xl,
      gap: spacing.xs,
      opacity: 0.6,
    },
    companyName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
      marginTop: spacing.xs,
    },
    companySubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
  });
}
