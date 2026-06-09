import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "../../components/EmptyState";
import { ReplyCard } from "../../components/ReplyCard";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { getFavorites, removeFavorite } from "../../storage/appStorage";
import { FavoriteReply } from "../../storage/types";

export default function FavoritesScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [favorites, setFavorites] = useState<FavoriteReply[]>([]);

  const loadFavorites = useCallback(() => {
    getFavorites().then(setFavorites);
  }, []);

  useFocusEffect(loadFavorites);

  async function handleRemove(id: string) {
    await removeFavorite(id);
    setFavorites((current) => current.filter((item) => item.id !== id));
    Alert.alert("Removed", "Favorite removed.");
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Saved replies</Text>
      <Text style={styles.title}>Favorites</Text>

      {favorites.length === 0 ? (
        <EmptyState title="No favorites yet" message="Tap Save on any reply to keep it here." />
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
      paddingTop: Math.max(spacing.md, topInset),
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "800",
      marginBottom: spacing.sm,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
  });
}
