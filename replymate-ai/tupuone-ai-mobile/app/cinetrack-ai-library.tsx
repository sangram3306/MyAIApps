import { type ComponentProps, useCallback, useMemo, useState, useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import {
  deleteWatchItemFromApi,
  listWatchItemsFromApi,
  updateWatchDetailsFromApi,
  updateWatchStatusFromApi,
  WatchEntry,
  WatchStatus,
  WatchType,
} from "../services/api";
import { getBackendUrl } from "../storage/appStorage";

// ─── Constants ───────────────────────────────────────────────────────────────

const statusOptions: WatchStatus[] = ["planned", "started", "in_progress", "completed", "dropped"];
const statusFilters: Array<"all" | WatchStatus> = ["all", ...statusOptions];
const typeFilters: Array<"all" | WatchType> = ["all", "movie", "series"];

// ─── Types ───────────────────────────────────────────────────────────────────

type WatchInfoRow = {
  value: string;
  icon: ComponentProps<typeof Ionicons>["name"];
};

type WatchEditDraft = {
  title: string;
  type: WatchType;
  releaseYear: string;
  director: string;
  leadActors: string;
  budget: string;
  boxOffice: string;
  posterUrl: string;
  ratings: string;
  availability: string;
  synopsis: string;
  notes: string;
};

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CinetrackAiLibraryScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [backendUrl, setBackendUrl] = useState("");
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [activeTypeFilter, setActiveTypeFilter] = useState<"all" | WatchType>("all");
  const [activeStatusFilter, setActiveStatusFilter] = useState<"all" | WatchStatus>("all");
  const [activeGenreFilter, setActiveGenreFilter] = useState("all");
  const [activeSortFilter, setActiveSortFilter] = useState<"default" | "imdb" | "year">("default");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [selectedEntry, setSelectedEntry] = useState<WatchEntry | null>(null);
  const [activeAvailabilityRegion, setActiveAvailabilityRegion] = useState<"all" | string>("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editDraft, setEditDraft] = useState<WatchEditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const params = useLocalSearchParams<{ openTitle?: string }>();

  // ── Derived data ────────────────────────────────────────────────────────────
  const typedStatusEntries = entries.filter((entry) => {
    const typeMatch = activeTypeFilter === "all" || entry.type === activeTypeFilter;
    const statusMatch = activeStatusFilter === "all" || entry.status === activeStatusFilter;
    return typeMatch && statusMatch;
  });

  const genreOptions = uniqueGenres(typedStatusEntries);

  const genreFilteredEntries = typedStatusEntries.filter((entry) => {
    if (activeGenreFilter === "all") return true;
    const genres = genresForEntry(entry);
    return genres.some((g) => g.toLowerCase() === activeGenreFilter.toLowerCase());
  });

  const filteredEntries = [...genreFilteredEntries].sort((a, b) => {
    if (activeSortFilter === "imdb") {
      const delta = imdbRatingNumber(a.ratings) - imdbRatingNumber(b.ratings);
      return sortDirection === "asc" ? delta : -delta;
    }
    if (activeSortFilter === "year") {
      const delta = releaseYearNumber(a.releaseYear) - releaseYearNumber(b.releaseYear);
      return sortDirection === "asc" ? delta : -delta;
    }
    return 0;
  });

  const selectedAvailabilityRegions = selectedEntry
    ? availabilityRegionsFor(selectedEntry.availability)
    : [];
  const selectedAvailability = selectedEntry
    ? filterAvailability(selectedEntry.availability, activeAvailabilityRegion)
    : [];

  // ── Handlers ────────────────────────────────────────────────────────────────
  function openEntry(entry: WatchEntry) {
    const normalized = normalizeWatchEntry(entry);
    setSelectedEntry(normalized);
    setIsEditingDetails(false);
    setEditDraft(createEditDraft(normalized));
    setActiveAvailabilityRegion(defaultAvailabilityRegion(normalized.availability));
  }

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = await getBackendUrl();
      setBackendUrl(url);
      if (!url) {
        setError("CineTrack needs the backend URL to be configured in Settings.");
        return;
      }
      const result = await listWatchItemsFromApi({ backendUrl: url });
      setEntries(result.entries.map(normalizeWatchEntry));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load saved titles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEntries();
    }, [loadEntries]),
  );

  useEffect(() => {
    if (params.openTitle && entries.length > 0) {
      const entryToOpen = entries.find((e) => e.title === params.openTitle);
      if (entryToOpen && selectedEntry?.id !== entryToOpen.id) {
        openEntry(entryToOpen);
      }
    }
  }, [entries, params.openTitle]);

  async function handleFavoriteToggle(entry: WatchEntry) {
    if (!backendUrl) return;
    setUpdatingId(entry.id);
    try {
      const result = await updateWatchDetailsFromApi({
        backendUrl,
        id: entry.id,
        updates: { favorite: !entry.favorite },
      });
      setEntries(result.entries.map(normalizeWatchEntry));
      if (selectedEntry?.id === entry.id && result.entry) {
        setSelectedEntry(normalizeWatchEntry(result.entry));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update favourite.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleStatusChange(entry: WatchEntry, status: WatchStatus) {
    if (!backendUrl) return;
    setUpdatingId(entry.id);
    try {
      const result = await updateWatchStatusFromApi({ backendUrl, id: entry.id, status });
      setEntries(result.entries.map(normalizeWatchEntry));
      setSelectedEntry((current) =>
        current && current.id === entry.id
          ? normalizeWatchEntry({ ...current, status })
          : current,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(entry: WatchEntry) {
    if (!backendUrl) return;
    setUpdatingId(entry.id);
    try {
      const result = await deleteWatchItemFromApi({ backendUrl, id: entry.id });
      setEntries(result.entries.map(normalizeWatchEntry));
      setSelectedEntry(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete title.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveDetails() {
    if (!backendUrl || !selectedEntry || !editDraft) return;
    setSavingEdit(true);
    setError("");
    try {
      const updates: Parameters<typeof updateWatchDetailsFromApi>[0]["updates"] = {
        title: editDraft.title.trim(),
        type: editDraft.type,
        releaseYear: editDraft.releaseYear.trim(),
        director: editDraft.director.trim(),
        leadActors: parseList(editDraft.leadActors),
        budget: editDraft.budget.trim(),
        boxOffice: editDraft.boxOffice.trim(),
        posterUrl: editDraft.posterUrl.trim() || undefined,
        ratings: parseRatings(editDraft.ratings),
        synopsis: editDraft.synopsis.trim(),
        notes: editDraft.notes.trim(),
      };
      if (!selectedEntry.availability.length) {
        updates.availability = parseAvailability(editDraft.availability);
      }
      const result = await updateWatchDetailsFromApi({
        backendUrl,
        id: selectedEntry.id,
        updates,
      });
      setEntries(result.entries.map(normalizeWatchEntry));
      if (result.entry) {
        const normalized = normalizeWatchEntry(result.entry);
        setSelectedEntry(normalized);
        setEditDraft(createEditDraft(normalized));
        setActiveAvailabilityRegion(defaultAvailabilityRegion(normalized.availability));
      }
      setIsEditingDetails(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update details.");
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            tintColor={colors.primary}
            colors={[colors.primary]}
            onRefresh={loadEntries}
          />
        }
        stickyHeaderIndices={[0]}
      >
        {/* Sticky filter header */}
        <View style={styles.filterSticky}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="chevron-back" color={colors.text} size={18} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
            <View style={styles.headerMeta}>
              <View style={styles.heroBadge}>
                <Ionicons name="film-outline" color={colors.primary} size={11} />
                <Text style={styles.heroBadgeText}>Library</Text>
              </View>
              <Text style={styles.countBadge}>{filteredEntries.length} titles</Text>
            </View>
          </View>

          {/* Filter panel */}
          <LibraryFilters
            activeGenreFilter={activeGenreFilter}
            activeSortFilter={activeSortFilter}
            sortDirection={sortDirection}
            activeStatusFilter={activeStatusFilter}
            activeTypeFilter={activeTypeFilter}
            genreOptions={genreOptions}
            colors={colors}
            setActiveGenreFilter={setActiveGenreFilter}
            setActiveSortFilter={setActiveSortFilter}
            setSortDirection={setSortDirection}
            setActiveStatusFilter={setActiveStatusFilter}
            setActiveTypeFilter={setActiveTypeFilter}
            styles={styles}
          />
        </View>

        {/* States */}
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && filteredEntries.length === 0 && !error ? (
          <Text style={styles.empty}>No saved titles found.</Text>
        ) : null}

        {/* Library list */}
        <View style={styles.list}>
          {filteredEntries.map((entry) => (
            <Pressable key={entry.id} style={styles.card} onPress={() => openEntry(entry)}>
              <Poster entry={entry} styles={styles} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{entry.title}</Text>
                <Text style={styles.metaText}>
                  {entry.type} | {entry.releaseYear} | {entry.status.replace("_", " ")}
                </Text>
                <Text style={styles.ratingText}>IMDb: {getImdbRating(entry.ratings)}</Text>
              </View>
              {entry.favorite ? (
                <Ionicons name="heart" color={colors.danger} size={16} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* ── Detail modal ─────────────────────────────────────────────────────── */}
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
              <ScrollView
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                <Poster entry={selectedEntry} styles={styles} large />

                {/* Modal header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle} numberOfLines={2}>{selectedEntry.title}</Text>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => void handleFavoriteToggle(selectedEntry)}
                    disabled={updatingId === selectedEntry.id}
                  >
                    <Ionicons
                      name={selectedEntry.favorite ? "heart" : "heart-outline"}
                      color={selectedEntry.favorite ? colors.danger : colors.muted}
                      size={18}
                    />
                  </Pressable>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => {
                      setIsEditingDetails((v) => !v);
                      setEditDraft(createEditDraft(selectedEntry));
                    }}
                  >
                    <Ionicons
                      name={isEditingDetails ? "close-outline" : "create-outline"}
                      color={colors.text}
                      size={18}
                    />
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={() => setSelectedEntry(null)}>
                    <Ionicons name="close-outline" color={colors.text} size={18} />
                  </Pressable>
                </View>

                {/* Edit form OR detail view */}
                {isEditingDetails && editDraft ? (
                  <View style={styles.editForm}>
                    <EditField label="Title" value={editDraft.title} onChangeText={(v) => setEditDraft({ ...editDraft, title: v })} styles={styles} />
                    <View style={styles.typeTabsRow}>
                      <Pressable onPress={() => setEditDraft({ ...editDraft, type: "movie" })} style={[styles.statusChip, editDraft.type === "movie" && styles.statusChipActive]}>
                        <Text style={[styles.statusChipText, editDraft.type === "movie" && styles.statusChipTextActive]}>Movie</Text>
                      </Pressable>
                      <Pressable onPress={() => setEditDraft({ ...editDraft, type: "series" })} style={[styles.statusChip, editDraft.type === "series" && styles.statusChipActive]}>
                        <Text style={[styles.statusChipText, editDraft.type === "series" && styles.statusChipTextActive]}>Series</Text>
                      </Pressable>
                    </View>
                    <EditField label="Year" value={editDraft.releaseYear} onChangeText={(v) => setEditDraft({ ...editDraft, releaseYear: v })} styles={styles} />
                    <EditField label="Director" value={editDraft.director} onChangeText={(v) => setEditDraft({ ...editDraft, director: v })} styles={styles} />
                    <EditField label="Lead actors" value={editDraft.leadActors} onChangeText={(v) => setEditDraft({ ...editDraft, leadActors: v })} styles={styles} />
                    <EditField label="Budget" value={editDraft.budget} onChangeText={(v) => setEditDraft({ ...editDraft, budget: v })} styles={styles} />
                    <EditField label="Box office" value={editDraft.boxOffice} onChangeText={(v) => setEditDraft({ ...editDraft, boxOffice: v })} styles={styles} />
                    <EditField label="Poster URL" value={editDraft.posterUrl} onChangeText={(v) => setEditDraft({ ...editDraft, posterUrl: v })} styles={styles} />
                    <EditField label="Ratings" value={editDraft.ratings} onChangeText={(v) => setEditDraft({ ...editDraft, ratings: v })} multiline styles={styles} />
                    {!selectedEntry.availability.length ? (
                      <EditField label="Availability" value={editDraft.availability} onChangeText={(v) => setEditDraft({ ...editDraft, availability: v })} multiline styles={styles} />
                    ) : null}
                    <EditField label="Synopsis" value={editDraft.synopsis} onChangeText={(v) => setEditDraft({ ...editDraft, synopsis: v })} multiline styles={styles} />
                    <EditField label="Notes" value={editDraft.notes} onChangeText={(v) => setEditDraft({ ...editDraft, notes: v })} multiline styles={styles} />
                    <Pressable
                      style={[styles.saveButton, savingEdit && styles.disabled]}
                      onPress={handleSaveDetails}
                      disabled={savingEdit}
                    >
                      {savingEdit ? (
                        <ActivityIndicator color={colors.onPrimary} />
                      ) : (
                        <Text style={styles.saveText}>Save changes</Text>
                      )}
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={styles.metaText}>
                      {selectedEntry.type} | {selectedEntry.releaseYear}
                    </Text>
                    {watchInfoRowsFor(selectedEntry).map((item) => (
                      <View key={`${item.icon}-${item.value}`} style={styles.infoRow}>
                        <Ionicons name={item.icon} color={colors.muted} size={13} />
                        <Text style={styles.metaText}>{item.value}</Text>
                      </View>
                    ))}
                    <Text style={styles.ratingsText}>
                      {selectedEntry.ratings.length
                        ? selectedEntry.ratings.map((r) => `${r.source === "Internet Movie Database" ? "IMDb" : r.source} Rating: ${r.value}`).join(" | ")
                        : "IMDb Rating: Unknown"}
                    </Text>

                    {/* Where to watch */}
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

                    {selectedEntry.synopsis ? (
                      <Text style={styles.body}>{selectedEntry.synopsis}</Text>
                    ) : null}
                    {selectedEntry.notes ? (
                      <Text style={styles.metaText}>Notes: {selectedEntry.notes}</Text>
                    ) : null}
                  </>
                )}

                {/* Status chips */}
                <View style={styles.statusWrap}>
                  {statusOptions.map((status) => (
                    <Pressable
                      key={status}
                      onPress={() => void handleStatusChange(selectedEntry, status)}
                      style={[styles.statusChip, selectedEntry.status === status && styles.statusChipActive]}
                      disabled={updatingId === selectedEntry.id}
                    >
                      <Text style={[styles.statusChipText, selectedEntry.status === status && styles.statusChipTextActive]}>
                        {status.replace("_", " ")}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* Delete */}
                <Pressable
                  style={[styles.deleteButton, updatingId === selectedEntry.id && styles.disabled]}
                  onPress={() => void handleDelete(selectedEntry)}
                  disabled={updatingId === selectedEntry.id}
                >
                  {updatingId === selectedEntry.id ? (
                    <ActivityIndicator color={colors.danger} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" color={colors.danger} size={16} />
                      <Text style={styles.deleteText}>Delete</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Filter Panel Component ───────────────────────────────────────────────────

function LibraryFilters({
  activeGenreFilter,
  activeSortFilter,
  colors,
  sortDirection,
  activeStatusFilter,
  activeTypeFilter,
  genreOptions,
  setActiveGenreFilter,
  setActiveSortFilter,
  setSortDirection,
  setActiveStatusFilter,
  setActiveTypeFilter,
  styles,
}: {
  activeGenreFilter: string;
  activeSortFilter: "default" | "imdb" | "year";
  colors: ReturnType<typeof useAppTheme>["colors"];
  sortDirection: "asc" | "desc";
  activeStatusFilter: "all" | WatchStatus;
  activeTypeFilter: "all" | WatchType;
  genreOptions: string[];
  setActiveGenreFilter: (genre: string) => void;
  setActiveSortFilter: (sort: "default" | "imdb" | "year") => void;
  setSortDirection: (direction: "asc" | "desc") => void;
  setActiveStatusFilter: (status: "all" | WatchStatus) => void;
  setActiveTypeFilter: (type: "all" | WatchType) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const [openDropdown, setOpenDropdown] = useState<"type" | "status" | "genre" | "rating" | "year" | null>(null);

  const typeLabel = activeTypeFilter === "all" ? "All" : activeTypeFilter === "movie" ? "Movies" : "Series";
  const statusLabel = activeStatusFilter === "all" ? "All" : activeStatusFilter.replace("_", " ");
  const genreLabel = activeGenreFilter === "all" ? "All genres" : activeGenreFilter;
  const ratingLabel =
    activeSortFilter === "imdb"
      ? sortDirection === "asc"
        ? "Low → High"
        : "High → Low"
      : "Off";
  const yearLabel =
    activeSortFilter === "year"
      ? sortDirection === "asc"
        ? "Oldest first"
        : "Newest first"
      : "Off";

  function toggleDropdown(key: "type" | "status" | "genre" | "rating" | "year") {
    setOpenDropdown((current) => (current === key ? null : key));
  }

  return (
    <View style={styles.filterPanel}>
      <View style={styles.filterPillRow}>
        {/* Filters mega pill */}
        <View style={styles.filtersMegaPill}>
          <MiniDropdownPill
            colors={colors}
            label="Type"
            value={typeLabel}
            open={openDropdown === "type"}
            onPress={() => toggleDropdown("type")}
            styles={styles}
          />
          <MiniDropdownPill
            colors={colors}
            label="Status"
            value={statusLabel}
            open={openDropdown === "status"}
            onPress={() => toggleDropdown("status")}
            styles={styles}
          />
          <MiniDropdownPill
            colors={colors}
            label="Genre"
            value={genreLabel}
            open={openDropdown === "genre"}
            onPress={() => toggleDropdown("genre")}
            styles={styles}
          />
        </View>
        {/* Sort mega pill */}
        <View style={styles.sortMegaPill}>
          <MiniDropdownPill
            colors={colors}
            label="Rating"
            value={ratingLabel}
            open={openDropdown === "rating"}
            onPress={() => toggleDropdown("rating")}
            styles={styles}
          />
          <MiniDropdownPill
            colors={colors}
            label="Year"
            value={yearLabel}
            open={openDropdown === "year"}
            onPress={() => toggleDropdown("year")}
            styles={styles}
          />
        </View>
      </View>

      {/* Dropdown menus */}
      {openDropdown === "type" ? (
        <View style={styles.dropdownMenu}>
          {typeFilters.map((item) => (
            <DropdownOption
              key={item}
              label={item === "all" ? "All" : item === "movie" ? "Movies" : "Series"}
              active={activeTypeFilter === item}
              onPress={() => { setActiveTypeFilter(item); setOpenDropdown(null); }}
              colors={colors}
              styles={styles}
            />
          ))}
        </View>
      ) : null}

      {openDropdown === "status" ? (
        <View style={styles.dropdownMenu}>
          {statusFilters.map((item) => (
            <DropdownOption
              key={item}
              label={item === "all" ? "All" : item.replace("_", " ")}
              active={activeStatusFilter === item}
              onPress={() => { setActiveStatusFilter(item); setOpenDropdown(null); }}
              colors={colors}
              styles={styles}
            />
          ))}
        </View>
      ) : null}

      {openDropdown === "genre" ? (
        <View style={styles.dropdownMenu}>
          <DropdownOption
            label="All genres"
            active={activeGenreFilter === "all"}
            onPress={() => { setActiveGenreFilter("all"); setOpenDropdown(null); }}
            colors={colors}
            styles={styles}
          />
          {genreOptions.map((genre) => (
            <DropdownOption
              key={genre}
              label={genre}
              active={activeGenreFilter === genre}
              onPress={() => { setActiveGenreFilter(genre); setOpenDropdown(null); }}
              colors={colors}
              styles={styles}
            />
          ))}
        </View>
      ) : null}

      {openDropdown === "rating" ? (
        <View style={styles.dropdownMenu}>
          <DropdownOption colors={colors} label="Off" active={activeSortFilter !== "imdb"} onPress={() => { setActiveSortFilter("default"); setOpenDropdown(null); }} styles={styles} />
          <DropdownOption colors={colors} label="High to low" active={activeSortFilter === "imdb" && sortDirection === "desc"} onPress={() => { setActiveSortFilter("imdb"); setSortDirection("desc"); setOpenDropdown(null); }} styles={styles} />
          <DropdownOption colors={colors} label="Low to high" active={activeSortFilter === "imdb" && sortDirection === "asc"} onPress={() => { setActiveSortFilter("imdb"); setSortDirection("asc"); setOpenDropdown(null); }} styles={styles} />
        </View>
      ) : null}

      {openDropdown === "year" ? (
        <View style={styles.dropdownMenu}>
          <DropdownOption colors={colors} label="Off" active={activeSortFilter !== "year"} onPress={() => { setActiveSortFilter("default"); setOpenDropdown(null); }} styles={styles} />
          <DropdownOption colors={colors} label="Newest first" active={activeSortFilter === "year" && sortDirection === "desc"} onPress={() => { setActiveSortFilter("year"); setSortDirection("desc"); setOpenDropdown(null); }} styles={styles} />
          <DropdownOption colors={colors} label="Oldest first" active={activeSortFilter === "year" && sortDirection === "asc"} onPress={() => { setActiveSortFilter("year"); setSortDirection("asc"); setOpenDropdown(null); }} styles={styles} />
        </View>
      ) : null}
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniDropdownPill({
  colors,
  label,
  onPress,
  open,
  styles,
  value,
}: {
  colors: ReturnType<typeof useAppTheme>["colors"];
  label: string;
  onPress: () => void;
  open: boolean;
  styles: ReturnType<typeof createStyles>;
  value: string;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.miniDropdownPill, open && styles.miniDropdownPillActive]}>
      <View style={styles.miniDropdownCopy}>
        <Text style={[styles.miniDropdownLabel, open && styles.miniDropdownTextActive]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.miniDropdownValue, open && styles.miniDropdownTextActive]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Ionicons
        name={open ? "chevron-up" : "chevron-down"}
        color={open ? colors.primary : colors.muted}
        size={13}
      />
    </Pressable>
  );
}

function DropdownOption({
  active,
  colors,
  label,
  onPress,
  styles,
}: {
  active: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.dropdownOption, active && styles.dropdownOptionActive]}>
      <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>
        {label}
      </Text>
      {active ? <Ionicons name="checkmark" color={colors.primary} size={15} /> : null}
    </Pressable>
  );
}

function Poster({
  entry,
  styles,
  large = false,
}: {
  entry: WatchEntry;
  styles: ReturnType<typeof createStyles>;
  large?: boolean;
}) {
  if (entry.posterUrl) {
    return (
      <Image
        source={{ uri: entry.posterUrl }}
        style={large ? styles.posterLarge : styles.posterThumb}
      />
    );
  }
  return (
    <View style={large ? styles.posterLargeFallback : styles.posterFallback}>
      <Text style={large ? styles.posterLargeText : styles.posterText}>
        {initials(entry.title)}
      </Text>
    </View>
  );
}

function EditField({
  label,
  value,
  onChangeText,
  multiline,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  multiline?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.editInput, multiline && styles.editInputMultiline]}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function normalizeWatchEntry(entry: WatchEntry): WatchEntry {
  return {
    ...entry,
    leadActors: Array.isArray(entry.leadActors) ? entry.leadActors : [],
    ratings: Array.isArray(entry.ratings) ? entry.ratings : [],
    availability: Array.isArray(entry.availability) ? entry.availability : [],
    externalDetails: Array.isArray(entry.externalDetails) ? entry.externalDetails : [],
  };
}

/** Extract genres — SP One's WatchEntry has no `genres` field; fall back to externalDetails. */
function genresForEntry(entry: WatchEntry): string[] {
  const detailList = Array.isArray(entry.externalDetails) ? entry.externalDetails : [];
  const genreDetail = detailList.find(
    (d) => d.label.trim().toLowerCase() === "genre",
  );
  if (!genreDetail?.value) return [];
  return genreDetail.value.split(",").map((g) => g.trim()).filter(Boolean);
}

function uniqueGenres(entries: WatchEntry[]): string[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const genre of genresForEntry(entry)) {
      seen.add(genre.toLowerCase());
    }
  }
  return [...seen].sort((a, b) => a.localeCompare(b)).map(toTitleCase);
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => (part[0]?.toUpperCase() ?? "") + part.slice(1))
    .join(" ");
}

function getImdbRating(ratings: Array<{ source: string; value: string }> | undefined): string {
  const list = Array.isArray(ratings) ? ratings : [];
  const match = list.find((item) => {
    const src = item.source.trim().toLowerCase();
    return src === "imdb" || src === "internet movie database";
  });
  return match?.value || "Unknown";
}

function imdbRatingNumber(ratings: Array<{ source: string; value: string }> | undefined): number {
  const parsed = parseFloat(getImdbRating(ratings));
  return isFinite(parsed) ? parsed : -1;
}

function releaseYearNumber(releaseYear: string): number {
  const match = releaseYear.match(/(\d{4})/);
  if (!match) return -1;
  const parsed = parseInt(match[1], 10);
  return isFinite(parsed) ? parsed : -1;
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

function filterAvailability(
  items: WatchEntry["availability"],
  region: "all" | string,
): WatchEntry["availability"] {
  if (region === "all") return items;
  return items.filter((item) => item.region === region);
}

function parseAvailability(
  value: string,
): Array<{ provider: string; region: string; type: "stream" | "rent" | "buy" | "free" | "ads"; link?: string }> {
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [provider = "", region = "Unknown", rawType = "stream", link] = line
        .split("|")
        .map((part) => part.trim());
      return {
        provider,
        region: region.toUpperCase(),
        type: normalizeAvailabilityType(rawType),
        link: link || undefined,
      };
    })
    .filter((item) => item.provider)
    .slice(0, 40);
}

function normalizeAvailabilityType(value: string): "stream" | "rent" | "buy" | "free" | "ads" {
  if (["stream", "rent", "buy", "free", "ads"].includes(value)) {
    return value as "stream" | "rent" | "buy" | "free" | "ads";
  }
  return "stream";
}

function parseList(value: string): string[] {
  return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function parseRatings(value: string): Array<{ source: string; value: string }> {
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [source, ...rest] = line.split(":");
      return { source: source.trim(), value: rest.join(":").trim() || "Unknown" };
    })
    .filter((r) => r.source)
    .slice(0, 6);
}

function compactDetailParts(parts: Array<[string, string | undefined]>): string {
  return parts
    .filter(([, v]) => v && v !== "Unknown" && v !== "N/A")
    .map(([label, v]) => `${label}: ${v}`)
    .join(" | ");
}

function createEditDraft(entry: WatchEntry): WatchEditDraft {
  const n = normalizeWatchEntry(entry);
  return {
    title: n.title,
    type: n.type,
    releaseYear: n.releaseYear,
    director: n.director,
    leadActors: n.leadActors.join(", "),
    budget: n.budget,
    boxOffice: n.boxOffice,
    posterUrl: n.posterUrl || "",
    ratings: n.ratings.map((r) => `${r.source}: ${r.value}`).join("\n"),
    availability: n.availability
      .map((item) => `${item.provider} | ${item.region} | ${item.type}${item.link ? ` | ${item.link}` : ""}`)
      .join("\n"),
    synopsis: n.synopsis,
    notes: n.notes,
  };
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

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },

    // Top bar
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingBottom: spacing.sm,
    },
    backButton: { flexDirection: "row", alignItems: "center", gap: 2 },
    backText: { color: colors.text, fontWeight: "800", fontSize: 15 },
    headerMeta: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    heroBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
    },
    heroBadgeText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    countBadge: { color: colors.muted, fontSize: 12, fontWeight: "800" },

    // Sticky filter wrapper
    filterSticky: {
      backgroundColor: colors.background,
      paddingBottom: spacing.xs,
      zIndex: 20,
    },

    // Filter panel
    filterPanel: { gap: spacing.sm },
    filterPillRow: { gap: spacing.xs },
    filtersMegaPill: {
      minHeight: 58,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      padding: 6,
    },
    sortMegaPill: {
      minHeight: 58,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      backgroundColor: colors.surface,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      padding: 6,
    },
    miniDropdownPill: {
      flex: 1,
      minWidth: 0,
      minHeight: 46,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 5,
      paddingHorizontal: 8,
    },
    miniDropdownPillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    miniDropdownCopy: { flex: 1, minWidth: 0, gap: 2 },
    miniDropdownLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
    miniDropdownValue: { color: colors.text, fontSize: 12, fontWeight: "900" },
    miniDropdownTextActive: { color: colors.primary },
    dropdownMenu: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 11,
      backgroundColor: colors.surfaceElevated,
      overflow: "hidden",
    },
    dropdownOption: {
      minHeight: 42,
      paddingHorizontal: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
    },
    dropdownOptionActive: { backgroundColor: colors.primarySoft },
    dropdownOptionText: { color: colors.muted, fontSize: 13, fontWeight: "800", textTransform: "capitalize" },
    dropdownOptionTextActive: { color: colors.primary, fontWeight: "900" },

    // List
    list: { gap: spacing.sm },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: spacing.sm,
    },
    cardBody: { flex: 1, gap: 3 },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    metaText: { color: colors.muted, fontSize: 12, lineHeight: 18, textTransform: "capitalize" },
    ratingText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    ratingsText: { color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: "600" },

    // Poster
    posterThumb: { width: 52, height: 76, borderRadius: 8, backgroundColor: colors.surfaceElevated },
    posterFallback: {
      width: 52,
      height: 76,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      alignItems: "center",
      justifyContent: "center",
    },
    posterText: { color: colors.primary, fontSize: 14, fontWeight: "900" },
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

    // Modal
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

    // Availability
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

    // Status chips
    typeTabsRow: { flexDirection: "row", gap: spacing.xs },
    statusWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
    statusChip: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    statusChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    statusChipText: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
    statusChipTextActive: { color: colors.primary },

    // Body / synopsis
    body: { color: colors.text, fontSize: 13, lineHeight: 19 },

    // Delete
    deleteButton: {
      minHeight: 42,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 10,
      backgroundColor: colors.dangerSoft,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    deleteText: { color: colors.danger, fontWeight: "900" },

    // Edit form
    editForm: { gap: spacing.sm },
    editField: { gap: 5 },
    editLabel: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    editInput: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      color: colors.text,
      minHeight: 40,
      paddingHorizontal: spacing.sm,
    },
    editInputMultiline: { minHeight: 78, paddingTop: spacing.sm },
    saveButton: {
      minHeight: 44,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    saveText: { color: colors.onPrimary, fontWeight: "900" },

    // Misc
    disabled: { opacity: 0.65 },
    empty: { color: colors.muted, fontSize: 13 },
    error: {
      color: colors.danger,
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 12,
      padding: spacing.sm,
    },
  });
}
