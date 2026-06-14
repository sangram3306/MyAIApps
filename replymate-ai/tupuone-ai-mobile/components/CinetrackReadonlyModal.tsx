import { useState, useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, Image } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { spacing, radius } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { WatchEntry } from "../services/api";

type WatchInfoRow = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getImdbRating(ratings: Array<{ source: string; value: string }> | undefined): string {
  const list = Array.isArray(ratings) ? ratings : [];
  const match = list.find((item) => {
    const src = item.source.trim().toLowerCase();
    return src === "imdb" || src === "internet movie database";
  });
  return match?.value || "Unknown";
}

function watchInfoRowsFor(entry: WatchEntry): WatchInfoRow[] {
  const details = new Map(
    (entry.externalDetails || [])
      .filter((d) => !["title", "year", "plot", "type", "imdb id"].includes(d.label.trim().toLowerCase()))
      .map((d) => [d.label.trim().toLowerCase(), d.value.trim()]),
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
    { value: compactDetailParts([["Cast", Array.isArray(entry.leadActors) ? entry.leadActors.join(", ") : ""]]), icon: "people-outline" },
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
  if (!items || !Array.isArray(items)) return [];
  return Array.from(new Set(items.map((item) => item.region).filter(Boolean))).sort();
}

function defaultAvailabilityRegion(items: WatchEntry["availability"]): "all" | string {
  if (!items || !Array.isArray(items)) return "all";
  return items.some((item) => item.region === "IN") ? "IN" : "all";
}

function filterAvailability(
  items: WatchEntry["availability"],
  region: "all" | string,
): WatchEntry["availability"] {
  if (!items || !Array.isArray(items)) return [];
  if (region === "all") return items;
  return items.filter((item) => item.region === region);
}

function compactDetailParts(parts: Array<[string, string | undefined]>): string {
  return parts
    .filter(([, v]) => v && v !== "Unknown" && v !== "N/A")
    .map(([label, v]) => `${label}: ${v}`)
    .join(" | ");
}

function initials(title: string): string {
  return (
    title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

// ─── Components ───────────────────────────────────────────────────────────────

function Poster({
  entry,
  styles,
}: {
  entry: WatchEntry;
  styles: ReturnType<typeof createModalStyles>;
}) {
  if (entry.posterUrl) {
    return <Image source={{ uri: entry.posterUrl }} style={styles.posterLarge} />;
  }
  return (
    <View style={styles.posterLargeFallback}>
      <Text style={styles.posterLargeText}>{initials(entry.title)}</Text>
    </View>
  );
}

export function CinetrackReadonlyModal({
  entry,
  onClose,
}: {
  entry: WatchEntry | null;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createModalStyles(colors), [colors]);
  const [activeAvailabilityRegion, setActiveAvailabilityRegion] = useState<"all" | string>("all");

  useMemo(() => {
    if (entry) {
      setActiveAvailabilityRegion(defaultAvailabilityRegion(entry.availability));
    }
  }, [entry]);

  if (!entry) return null;

  const selectedAvailabilityRegions = availabilityRegionsFor(entry.availability);
  const selectedAvailability = filterAvailability(entry.availability, activeAvailabilityRegion);

  return (
    <Modal animationType="slide" transparent visible={true} onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <Pressable style={styles.modalDismiss} onPress={onClose} />
        <View style={styles.modalSheet}>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Poster entry={entry} styles={styles} />

            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>
                {entry.title}
              </Text>
              <Pressable style={styles.iconBtn} onPress={onClose}>
                <Ionicons name="close-outline" color={colors.text} size={18} />
              </Pressable>
            </View>

            <Text style={styles.metaText}>
              {entry.type} | {entry.releaseYear}
            </Text>
            {watchInfoRowsFor(entry).map((item) => (
              <View key={`${item.icon}-${item.value}`} style={styles.infoRow}>
                <Ionicons name={item.icon} color={colors.muted} size={13} />
                <Text style={styles.metaText}>{item.value}</Text>
              </View>
            ))}
            <Text style={styles.ratingsText}>
              {Array.isArray(entry.ratings) && entry.ratings.length
                ? entry.ratings.map((r) => `${r.source === "Internet Movie Database" ? "IMDb" : r.source} Rating: ${r.value}`).join(" | ")
                : "IMDb Rating: Unknown"}
            </Text>

            {/* Where to watch */}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionTitle}>Where to watch</Text>
              {Array.isArray(entry.availability) && entry.availability.length ? (
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
                        <View
                          key={`${item.provider}-${item.region}-${item.type}`}
                          style={styles.availabilityPill}
                        >
                          <Text style={styles.availabilityProvider}>{item.provider}</Text>
                          <Text style={styles.availabilityMeta}>
                            {item.region} | {item.type}
                          </Text>
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

            {entry.synopsis ? <Text style={styles.body}>{entry.synopsis}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createModalStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    posterLarge: { alignSelf: "center", width: 136, height: 202, borderRadius: 10, backgroundColor: colors.surfaceElevated },
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

    modalBackdrop: { flex: 1, backgroundColor: "rgba(4,8,14,0.45)", justifyContent: "flex-end" },
    modalDismiss: { flex: 1 },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderColor: colors.border,
      borderWidth: 1,
      maxHeight: "86%",
      padding: spacing.md,
    },
    modalContent: { gap: spacing.sm, paddingBottom: spacing.md },
    modalHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900", flex: 1 },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    modalSection: { gap: spacing.xs, marginTop: spacing.xs },
    modalSectionTitle: { color: colors.text, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },

    metaText: { color: colors.muted, fontSize: 12, lineHeight: 18, textTransform: "capitalize" },
    ratingsText: { color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: "600" },

    availabilityFilterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    availabilityFilterChip: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    availabilityFilterChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    availabilityFilterText: { color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
    availabilityFilterTextActive: { color: colors.primary },
    availabilityWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    availabilityPill: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      gap: 2,
    },
    availabilityProvider: { color: colors.text, fontSize: 12, fontWeight: "800" },
    availabilityMeta: { color: colors.primary, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },

    body: { color: colors.text, fontSize: 13, lineHeight: 19 },
  });
}
