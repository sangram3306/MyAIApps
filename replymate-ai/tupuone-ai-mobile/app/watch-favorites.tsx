import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { listWatchItemsFromApi, WatchEntry } from "../services/api";
import { getBackendUrl } from "../storage/appStorage";

const typeFilters: Array<"all" | "movie" | "series"> = ["all", "movie", "series"];

export default function WatchFavoritesScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [favorites, setFavorites] = useState<WatchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<WatchEntry | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<"all" | "movie" | "series">("all");
  const filteredFavorites = favorites.filter(
    (entry) => activeTypeFilter === "all" || entry.type === activeTypeFilter,
  );

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const backendUrl = await getBackendUrl();
      if (!backendUrl) {
        setError("Watch Tracker needs the backend to be online.");
        return;
      }
      const result = await listWatchItemsFromApi({ backendUrl });
      setFavorites(normalizeWatchEntries(result.entries).filter((entry) => Boolean(entry.favorite)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load favorites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFavorites();
    }, [loadFavorites]),
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.text} size={18} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Favorites</Text>
          <View style={styles.countPill}>
            <Ionicons name="heart" color={colors.danger} size={13} />
            <Text style={styles.countText}>{favorites.length}</Text>
          </View>
        </View>

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && !error && favorites.length === 0 ? (
          <Text style={styles.metaText}>No favorites yet.</Text>
        ) : null}

        {!loading && favorites.length > 0 ? (
          <View style={styles.typeTabsRow}>
            {typeFilters.map((item) => (
              <Pressable
                key={item}
                onPress={() => setActiveTypeFilter(item)}
                style={[styles.typeTab, activeTypeFilter === item && styles.typeTabActive]}
              >
                <Text style={[styles.typeTabText, activeTypeFilter === item && styles.typeTabTextActive]}>
                  {item === "all" ? "All" : item === "movie" ? "Movies" : "Series"}
                </Text>
                <Text style={[styles.typeTabCount, activeTypeFilter === item && styles.typeTabTextActive]}>
                  {item === "all" ? favorites.length : favorites.filter((entry) => entry.type === item).length}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {!loading && favorites.length > 0 ? (
          <View style={styles.list}>
            {filteredFavorites.map((entry) => (
              <Pressable key={entry.id} style={styles.card} onPress={() => setSelectedEntry(entry)}>
                <View style={styles.cardRow}>
                  <PosterBlock entry={entry} styles={styles} />
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{entry.title}</Text>
                    <Text style={styles.metaText}>
                      {entry.type} • {entry.releaseYear} • {entry.status.replace("_", " ")}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
        {!loading && favorites.length > 0 && filteredFavorites.length === 0 ? (
          <Text style={styles.metaText}>
            No {activeTypeFilter === "movie" ? "movie" : "series"} favorites yet.
          </Text>
        ) : null}
      </ScrollView>
      <Modal
        animationType="slide"
        transparent
        visible={Boolean(selectedEntry)}
        onRequestClose={() => setSelectedEntry(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setSelectedEntry(null)} />
          <View style={styles.modalSheet}>
            {selectedEntry ? (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                <PosterBlock entry={selectedEntry} styles={styles} large />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedEntry.title}</Text>
                  <Pressable onPress={() => setSelectedEntry(null)} style={styles.closeBtn}>
                    <Ionicons name="close-outline" color={colors.text} size={18} />
                  </Pressable>
                </View>
                <Text style={styles.metaText}>
                  {selectedEntry.type} • {selectedEntry.releaseYear} • {selectedEntry.status.replace("_", " ")}
                </Text>
                {selectedEntry.director && selectedEntry.director !== "Unknown" ? (
                  <Text style={styles.metaText}>Director: {selectedEntry.director}</Text>
                ) : null}
                {normalizeStringList(selectedEntry.leadActors).length ? (
                  <Text style={styles.metaText}>Cast: {normalizeStringList(selectedEntry.leadActors).join(", ")}</Text>
                ) : null}
                {selectedEntry.synopsis ? <Text style={styles.synopsis}>{selectedEntry.synopsis}</Text> : null}
                {selectedEntry.notes ? <Text style={styles.metaText}>Notes: {selectedEntry.notes}</Text> : null}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PosterBlock({
  entry,
  styles,
  large = false,
}: {
  entry: WatchEntry;
  styles: ReturnType<typeof createStyles>;
  large?: boolean;
}) {
  if (entry.posterUrl) {
    return <Image source={{ uri: entry.posterUrl }} style={large ? styles.posterLarge : styles.posterCard} />;
  }
  return (
    <View style={large ? styles.posterLargeFallback : styles.posterCardFallback}>
      <Text style={large ? styles.posterLargeText : styles.posterCardText}>{initials(entry.title)}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl, paddingTop: Math.max(spacing.md, topInset) },
    backButton: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
    backText: { color: colors.text, fontWeight: "800" },
    headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { color: colors.text, fontSize: 28, fontWeight: "900" },
    countPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      backgroundColor: colors.surfaceElevated,
    },
    countText: { color: colors.text, fontSize: 12, fontWeight: "900" },
    typeTabsRow: { flexDirection: "row", gap: spacing.xs },
    typeTab: {
      flex: 1,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      paddingVertical: 8,
      paddingHorizontal: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    typeTabActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    typeTabText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
    },
    typeTabCount: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
    },
    typeTabTextActive: {
      color: colors.primary,
    },
    list: { gap: spacing.sm },
    card: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      gap: 4,
    },
    cardRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    cardBody: { flex: 1, gap: 2 },
    posterCard: {
      width: 52,
      height: 76,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    posterCardFallback: {
      width: 52,
      height: 76,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    posterCardText: { color: colors.primary, fontSize: 14, fontWeight: "900" },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(4,8,14,0.45)", justifyContent: "flex-end" },
    modalDismiss: { flex: 1 },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderColor: colors.border,
      borderWidth: 1,
      minHeight: "44%",
      maxHeight: "86%",
      padding: spacing.md,
    },
    modalContent: { gap: spacing.sm, paddingBottom: spacing.md },
    posterLarge: {
      width: "100%",
      height: 380,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    posterLargeFallback: {
      width: "100%",
      height: 380,
      borderRadius: 12,
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    posterLargeText: { color: colors.primary, fontSize: 40, fontWeight: "900" },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
    modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900", flex: 1 },
    closeBtn: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    synopsis: { color: colors.text, fontSize: 13, lineHeight: 19 },
    metaText: { color: colors.muted, fontSize: 12, lineHeight: 18, textTransform: "capitalize" },
    error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: 12, padding: spacing.sm },
  });
}

function normalizeWatchEntries(entries: WatchEntry[] | undefined): WatchEntry[] {
  return Array.isArray(entries) ? entries.map(normalizeWatchEntry) : [];
}

function normalizeWatchEntry(entry: WatchEntry): WatchEntry {
  return {
    ...entry,
    availability: Array.isArray(entry.availability) ? entry.availability : [],
    externalDetails: Array.isArray(entry.externalDetails) ? entry.externalDetails : [],
    leadActors: normalizeStringList(entry.leadActors),
    ratings: Array.isArray(entry.ratings) ? entry.ratings : [],
  };
}

function normalizeStringList(items: string[] | undefined): string[] {
  return Array.isArray(items) ? items : [];
}

function initials(title: string): string {
  const letters = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return letters || "?";
}
