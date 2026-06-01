import { type ComponentProps, useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { listWatchItemsFromApi, WatchEntry } from "../services/api";
import { getBackendUrl } from "../storage/appStorage";

const typeFilters: Array<"all" | "movie" | "series"> = ["all", "movie", "series"];

type WatchInfoRow = {
  value: string;
  icon: ComponentProps<typeof Ionicons>["name"];
};

export default function WatchFavoritesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [favorites, setFavorites] = useState<WatchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<WatchEntry | null>(null);
  const [activeAvailabilityRegion, setActiveAvailabilityRegion] = useState<"all" | string>("all");
  const [activeTypeFilter, setActiveTypeFilter] = useState<"all" | "movie" | "series">("all");
  const filteredFavorites = favorites.filter(
    (entry) => activeTypeFilter === "all" || entry.type === activeTypeFilter,
  );
  const selectedAvailabilityRegions = selectedEntry ? availabilityRegionsFor(selectedEntry.availability) : [];
  const selectedAvailability = selectedEntry
    ? filterAvailability(selectedEntry.availability, activeAvailabilityRegion)
    : [];

  function openEntry(entry: WatchEntry) {
    setSelectedEntry(entry);
    setActiveAvailabilityRegion(defaultAvailabilityRegion(entry.availability));
  }

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
      setFavorites(result.entries.filter((entry) => Boolean(entry.favorite)));
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
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            tintColor={colors.primary}
            colors={[colors.primary]}
            onRefresh={() => {
              void loadFavorites();
            }}
          />
        }
      >
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
              <Pressable key={entry.id} style={styles.card} onPress={() => openEntry(entry)}>
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
                {watchInfoRowsFor(selectedEntry).map((item) => (
                  <View key={`${item.icon}-${item.value}`} style={styles.infoRow}>
                    <Ionicons name={item.icon} color={colors.muted} size={13} />
                    <Text style={styles.metaText}>{item.value}</Text>
                  </View>
                ))}
                <Text style={styles.ratingsText}>
                  Ratings: {selectedEntry.ratings.length ? selectedEntry.ratings.map((rating) => `${rating.source} ${rating.value}`).join(" | ") : "Unknown"}
                </Text>
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Where to watch</Text>
                  {selectedEntry.availability.length ? (
                    <>
                      <View style={styles.availabilityFilterRow}>
                        {["all", ...selectedAvailabilityRegions].map((region) => (
                          <Pressable
                            key={region}
                            onPress={() => setActiveAvailabilityRegion(region)}
                            style={[
                              styles.availabilityFilterChip,
                              activeAvailabilityRegion === region && styles.availabilityFilterChipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.availabilityFilterText,
                                activeAvailabilityRegion === region && styles.availabilityFilterTextActive,
                              ]}
                            >
                              {region === "all" ? "All" : region}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      {selectedAvailability.length ? (
                        <View style={styles.availabilityWrap}>
                          {selectedAvailability.map((item) => (
                            <View key={`${item.provider}-${item.region}-${item.type}`} style={styles.availabilityPill}>
                              <Text style={styles.availabilityProvider}>{item.provider}</Text>
                              <Text style={styles.availabilityMeta}>{item.region} | {item.type}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.metaText}>No providers found for this country.</Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.metaText}>No streaming availability found for selected regions.</Text>
                  )}
                </View>
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

function watchInfoRowsFor(entry: WatchEntry): WatchInfoRow[] {
  const details = new Map(
    (entry.externalDetails || [])
      .filter((detail) => !["title", "year", "plot", "type", "imdb id"].includes(detail.label.trim().toLowerCase()))
      .map((detail) => [detail.label.trim().toLowerCase(), detail.value.trim()]),
  );
  const rows: WatchInfoRow[] = [
    {
      value: compactDetailParts([
        ["Released", details.get("released") || entry.releaseYear],
        ["Runtime", details.get("runtime")],
        ["Rated", details.get("rated")],
      ]),
      icon: "calendar-outline",
    },
    { value: compactDetailParts([["Genre", details.get("genre")]]), icon: "pricetag-outline" },
    {
      value: compactDetailParts([
        ["Director", entry.director],
        ["Writer", details.get("writer")],
      ]),
      icon: "videocam-outline",
    },
    { value: compactDetailParts([["Cast", entry.leadActors.join(", ")]]), icon: "people-outline" },
    {
      value: compactDetailParts([
        ["Language", details.get("language")],
        ["Country", details.get("country")],
      ]),
      icon: "globe-outline",
    },
    {
      value: compactDetailParts([
        ["Awards", details.get("awards")],
        ["Metascore", details.get("metascore")],
        ["IMDb votes", details.get("imdb votes")],
      ]),
      icon: "trophy-outline",
    },
    {
      value: compactDetailParts([
        ["Budget", entry.budget],
        ["Box office", entry.boxOffice],
      ]),
      icon: "cash-outline",
    },
    {
      value: compactDetailParts([
        ["Production", details.get("production")],
        ["Website", details.get("website")],
      ]),
      icon: "business-outline",
    },
    { value: compactDetailParts([["Total seasons", details.get("total seasons")]]), icon: "albums-outline" },
  ];

  return rows.filter((row) => row.value && row.value !== "Unknown" && row.value !== "N/A").slice(0, 16);
}

function availabilityRegionsFor(items: WatchEntry["availability"]): string[] {
  return Array.from(new Set(items.map((item) => item.region).filter(Boolean))).sort();
}

function defaultAvailabilityRegion(items: WatchEntry["availability"]): "all" | string {
  return items.some((item) => item.region === "IN") ? "IN" : "all";
}

function filterAvailability(items: WatchEntry["availability"], region: "all" | string): WatchEntry["availability"] {
  if (region === "all") {
    return items;
  }
  return items.filter((item) => item.region === region);
}

function compactDetailParts(parts: Array<[string, string | undefined]>): string {
  return parts
    .filter(([, value]) => value && value !== "Unknown" && value !== "N/A")
    .map(([label, value]) => `${label}: ${value}`)
    .join(" | ");
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
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
      alignSelf: "center",
      width: 136,
      height: 202,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
    },
    posterLargeFallback: {
      alignSelf: "center",
      width: 136,
      height: 202,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    posterLargeText: { color: colors.primary, fontSize: 28, fontWeight: "900" },
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
    infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    modalSection: { gap: spacing.xs, marginTop: spacing.xs },
    modalSectionTitle: { color: colors.text, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
    ratingsText: { color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: "600" },
    availabilityFilterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    availabilityFilterChip: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 5 },
    availabilityFilterChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    availabilityFilterText: { color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
    availabilityFilterTextActive: { color: colors.primary },
    availabilityWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    availabilityPill: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 6, gap: 2 },
    availabilityProvider: { color: colors.text, fontSize: 12, fontWeight: "800" },
    availabilityMeta: { color: colors.primary, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    synopsis: { color: colors.text, fontSize: 13, lineHeight: 19 },
    metaText: { color: colors.muted, fontSize: 12, lineHeight: 18, textTransform: "capitalize" },
    error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: 12, padding: spacing.sm },
  });
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
