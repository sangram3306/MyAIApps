import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, Image, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { useAuth } from "../../context/auth";

const profileRows = [
  { title: "My Account", subtitle: "Profile and personal details", icon: "person-outline", route: "/profile/account" },
  { title: "Settings", subtitle: "Appearance, AI and preferences", icon: "settings-outline", route: "/profile/settings" },
  { title: "Privacy & Security", subtitle: "Lock, privacy and app security", icon: "shield-checkmark-outline", route: "/profile/settings" },
  { title: "Export/Import Data", subtitle: "Download or restore app data", icon: "download-outline", route: "/profile/export" },
  { title: "Help & Support", subtitle: "Guides and support placeholder", icon: "help-circle-outline", route: "/profile/support" },
  { title: "About SP ONE", subtitle: "All-in-one AI companion", icon: "information-circle-outline", route: "/profile/about" },
] as const;

export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { user, signOut, updateProfileImage } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission required', 'Permission to access camera roll is required!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0 && result.assets[0].base64) {
      try {
        const base64Str = `data:${result.assets[0].mimeType || 'image/jpeg'};base64,${result.assets[0].base64}`;
        await updateProfileImage(base64Str);
      } catch (error) {
        Alert.alert('Error', 'Failed to upload profile image.');
      }
    }
  };

  return (
    <View style={styles.screen}>
      <MatrixBackground density={12} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.identityRow}>
          <Pressable style={styles.avatar} onPress={handlePickImage}>
            {user?.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFace}>
                <Ionicons name="person" color={colors.primary} size={25} />
              </View>
            )}
          </Pressable>
          <View style={styles.identityCopy}>
            <Text style={styles.name}>{user?.name || "User"}</Text>
            <Text style={styles.email}>{user?.email || "No email provided"}</Text>
          </View>
        </View>

        <Pressable 
          style={[styles.proCard, user?.plan !== "pro" && { backgroundColor: colors.surfaceGlass, borderColor: colors.border, shadowOpacity: 0 }]}
          onPress={() => router.push("/profile/subscription" as never)}
        >
          <View>
            <Text style={[styles.proTitle, user?.plan !== "pro" && { color: colors.amber }]}>{user?.plan === "pro" ? "Pro Plan" : "Basic Plan"}</Text>
            <Text style={styles.proSubtitle}>{user?.plan === "pro" ? "Active" : "Free Tier"}</Text>
            {user?.plan === "pro" ? (
              <Text style={styles.proMeta}>
                {user.proExpirationDate 
                  ? `Expires on ${new Date(user.proExpirationDate).toLocaleDateString()}` 
                  : "Unlimited Access"}
              </Text>
            ) : (
              <Text style={styles.proMeta}>Upgrade to Pro</Text>
            )}
          </View>
          <View style={[styles.crownBadge, user?.plan !== "pro" && { backgroundColor: "rgba(250,204,21,0.1)" }]}>
            {user?.plan === "pro" ? (
              <Ionicons name="sparkles" color={colors.amber} size={21} />
            ) : (
              <Ionicons name="star-outline" color={colors.amber} size={21} />
            )}
          </View>
        </Pressable>

        <View style={styles.rows}>
          {profileRows.slice(0, 4).map((row) => (
            <ProfileRow key={row.title} row={row} />
          ))}
        </View>

        <View style={styles.rows}>
          {profileRows.slice(4).map((row) => (
            <ProfileRow key={row.title} row={row} />
          ))}
        </View>

        <Pressable style={styles.logout} onPress={signOut}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ProfileRow({ row }: { row: (typeof profileRows)[number] }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, 0), [colors]);

  return (
    <Pressable
      onPress={() => row.route && router.push(row.route as never)}
      style={styles.row}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={row.icon} color={colors.textMuted} size={15} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{row.title}</Text>
        <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" color={colors.textMuted} size={15} />
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      gap: 13,
      paddingHorizontal: 20,
      paddingBottom: spacing.xl,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    identityRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      paddingTop: spacing.sm,
    },
    avatar: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 58,
      justifyContent: "center",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      width: 58,
    },
    avatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: radius.pill,
    },
    avatarFace: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderRadius: radius.pill,
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    identityCopy: {
      flex: 1,
      gap: 2,
    },
    name: {
      color: colors.text,
      fontSize: 19,
      fontWeight: "900",
    },
    email: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    proCard: {
      alignItems: "center",
      backgroundColor: "rgba(124,58,237,0.13)",
      borderColor: "rgba(124,58,237,0.55)",
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      shadowColor: colors.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 16,
    },
    proTitle: {
      color: colors.purple,
      fontSize: 15,
      fontWeight: "900",
    },
    proSubtitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
    proMeta: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    crownBadge: {
      alignItems: "center",
      backgroundColor: "rgba(250,204,21,0.12)",
      borderRadius: radius.pill,
      height: 36,
      justifyContent: "center",
      width: 36,
    },
    rows: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    row: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 42,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    rowIcon: {
      alignItems: "center",
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
    rowSubtitle: {
      color: colors.textMuted,
      fontSize: 10,
      lineHeight: 13,
    },
    logout: {
      alignItems: "center",
      borderColor: colors.danger,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      minHeight: 40,
      justifyContent: "center",
    },
    logoutText: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: "900",
    },
  });
}
