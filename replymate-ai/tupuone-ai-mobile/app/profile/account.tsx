import { useMemo, useState, useEffect } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { useAuth } from "../../context/auth";

export default function AccountScreen() {
  const { colors } = useAppTheme();
  const { user, updateProfileDetails, resetPassword, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  async function handleSaveProfile() {
    if (!name.trim() || !email.trim()) {
      Alert.alert("Invalid Input", "Name and Email cannot be empty.");
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfileDetails(name.trim(), email.trim());
      Alert.alert("Success", "Profile updated successfully.");
    } catch (error) {
      Alert.alert("Update Failed", error instanceof Error ? error.message : "Could not update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleResetPassword() {
    if (newPassword.trim().length < 6) {
      Alert.alert("Invalid Password", "Password must be at least 6 characters long.");
      return;
    }

    setIsResettingPassword(true);
    try {
      await resetPassword(newPassword.trim());
      setNewPassword("");
      Alert.alert("Success", "Password reset successfully. Please sign in again with your new password.", [
        { text: "OK", onPress: () => void signOut() }
      ]);
    } catch (error) {
      Alert.alert("Reset Failed", error instanceof Error ? error.message : "Could not reset password.");
    } finally {
      setIsResettingPassword(false);
    }
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
            <Text style={styles.title}>My Account</Text>
            <Text style={styles.subtitle}>Update your personal details</Text>
          </View>
        </View>

        <SettingsGroup title="Profile Details" styles={styles}>
          <View style={styles.card}>
            <Field
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Your Name"
              styles={styles}
            />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              styles={styles}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Pressable
              onPress={() => void handleSaveProfile()}
              disabled={isSavingProfile}
              style={[styles.primaryButton, isSavingProfile && styles.primaryButtonDisabled]}
            >
              {isSavingProfile ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
        </SettingsGroup>

        <SettingsGroup title="Security" styles={styles}>
          <View style={styles.card}>
            <Field
              label="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter new password"
              styles={styles}
              secureTextEntry
            />
            <Text style={styles.hintText}>You will be signed out after resetting your password.</Text>
            <Pressable
              onPress={() => void handleResetPassword()}
              disabled={isResettingPassword}
              style={[styles.secondaryButton, isResettingPassword && styles.primaryButtonDisabled]}
            >
              {isResettingPassword ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.secondaryButtonText}>Reset Password</Text>
              )}
            </Pressable>
          </View>
        </SettingsGroup>
      </ScrollView>
    </View>
  );
}

function SettingsGroup({ title, children, styles }: { title: string; children: React.ReactNode; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.groupWrap}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  styles,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  styles: ReturnType<typeof createStyles>;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
      />
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
      paddingBottom: spacing.xl,
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
    groupWrap: {
      gap: 7,
    },
    groupTitle: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    groupCard: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    card: {
      gap: spacing.md,
      padding: spacing.md,
    },
    fieldBlock: {
      gap: 6,
    },
    fieldLabel: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.4,
    },
    fieldInput: {
      backgroundColor: "rgba(17,24,36,0.64)",
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.text,
      fontSize: 14,
      minHeight: 48,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    hintText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 16,
      marginTop: -4,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 48,
      marginTop: spacing.sm,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 14,
      fontWeight: "900",
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: "rgba(0,255,198,0.08)",
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 48,
      marginTop: spacing.sm,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
    },
  });
}
