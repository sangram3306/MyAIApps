import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../components/EmptyState";
import { ReplyCard } from "../components/ReplyCard";
import { MatrixBackground } from "../components/PremiumUI";
import { radius, spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { getFavorites, removeFavorite } from "../storage/appStorage";
import { FavoriteReply } from "../storage/types";

export default function FavoritesReplyScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [favorites, setFavorites] = useState<FavoriteReply[]>([]);

  const loadFavorites = useCallback(() => {
    getFavorites("reply").then(setFavorites);
  }, []);

  useFocusEffect(loadFavorites);

  async function handleRemove(id: string) {
    await removeFavorite(id, "reply");
    setFavorites((current) => current.filter((item) => item.id !== id));
    Alert.alert("Removed", "Saved reply removed.");
  }

  return (
    <View style={styles.screen}>
      <MatrixBackground density={10} />
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.primary} size={18} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Communication</Text>
            <Text style={styles.title}>Saved Replies</Text>
          </View>
          <View style={styles.countPill}>
            <Ionicons name="star" color={colors.amber} size={13} />
            <Text style={styles.countText}>{favorites.length}</Text>
          </View>
        </View>

        {favorites.length === 0 ? (
          <EmptyState
            title="No saved replies yet"
            message="Tap Save on any reply to keep it here."
            icon="star-outline"
          />
        ) : (
          favorites.map((favorite) => (
            <ReplyCard
              key={favorite.id}
              reply={favorite.reply}
              favoriteLabel="Remove"
              onFavorite={() => handleRemove(favorite.id)}
            />
          ))
        )}
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
      backgroundColor: colors.background,
      flexGrow: 1,
      gap: spacing.md,
      padding: spacing.md,
      paddingBottom: spacing.xl,
      paddingTop: Math.max(spacing.lg, topInset + spacing.sm),
    },
    backButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xxs,
      alignSelf: "flex-start",
      marginBottom: spacing.xs,
    },
    backText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "800",
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: spacing.xs,
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    countPill: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    countText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "900",
    },
  });
}
