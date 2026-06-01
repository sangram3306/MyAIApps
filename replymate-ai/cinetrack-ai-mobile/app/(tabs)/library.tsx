import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useNavigation } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import {
  deleteWatchItemFromApi,
  listWatchItemsFromApi,
  updateWatchDetailsFromApi,
  updateWatchStatusFromApi,
  WatchEntry,
  WatchStatus,
  WatchType,
} from "../../services/api";
import { getBackendUrl, getOneHandedModePreference, saveWatchJournal, WatchJournalEntry } from "../../storage/appStorage";

const statusOptions: WatchStatus[] = ["planned", "started", "in_progress", "completed", "dropped"];
const statusFilters: Array<"all" | WatchStatus> = ["all", ...statusOptions];
const typeFilters: Array<"all" | WatchType> = ["all", "movie", "series"];

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

type JournalMood = WatchJournalEntry["mood"];
const journalMoods: JournalMood[] = ["loved", "liked", "mixed", "disliked"];

export default function LibraryScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
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
  const [oneHandedMode, setOneHandedMode] = useState(false);
  const [journalPromptEntry, setJournalPromptEntry] = useState<WatchEntry | null>(null);
  const [journalMood, setJournalMood] = useState<JournalMood>("liked");
  const [journalNotes, setJournalNotes] = useState("");

  const typedStatusEntries = entries.filter((entry) => {
    const typeMatch = activeTypeFilter === "all" || entry.type === activeTypeFilter;
    const statusMatch = activeStatusFilter === "all" || entry.status === activeStatusFilter;
    return typeMatch && statusMatch;
  });
  const genreOptions = uniqueGenres(typedStatusEntries);
  const genreFilteredEntries = typedStatusEntries.filter((entry) => {
    if (activeGenreFilter === "all") {
      return true;
    }
    const genres = genresForEntry(entry);
    return genres.some((genre) => genre.toLowerCase() === activeGenreFilter.toLowerCase());
  });
  const filteredEntries = [...genreFilteredEntries].sort((left, right) => {
    if (activeSortFilter === "imdb") {
      const delta = imdbRatingNumber(left.ratings) - imdbRatingNumber(right.ratings);
      return sortDirection === "asc" ? delta : -delta;
    }
    if (activeSortFilter === "year") {
      const delta = releaseYearNumber(left.releaseYear) - releaseYearNumber(right.releaseYear);
      return sortDirection === "asc" ? delta : -delta;
    }
    return 0;
  });
  const selectedAvailabilityRegions = selectedEntry ? availabilityRegionsFor(selectedEntry.availability) : [];
  const selectedAvailability = selectedEntry
    ? filterAvailability(selectedEntry.availability, activeAvailabilityRegion)
    : [];

  function openEntry(entry: WatchEntry) {
    setSelectedEntry(entry);
    setIsEditingDetails(false);
    setEditDraft(createEditDraft(entry));
    setActiveAvailabilityRegion(defaultAvailabilityRegion(entry.availability));
  }

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = await getBackendUrl();
      setBackendUrl(url);
      const result = await listWatchItemsFromApi({ backendUrl: url });
      setEntries(result.entries);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load saved titles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadEntries();
      void getOneHandedModePreference().then(setOneHandedMode);
    }, [loadEntries]),
  );

  useEffect(() => {
    navigation.setOptions({
      tabBarBadge: filteredEntries.length ? filteredEntries.length : undefined,
      tabBarBadgeStyle: {
        backgroundColor: colors.primary,
        color: colors.onPrimary,
        fontSize: 10,
        fontWeight: "900",
      },
    });
  }, [colors.onPrimary, colors.primary, filteredEntries.length, navigation]);

  async function handleFavoriteToggle(entry: WatchEntry) {
    if (!backendUrl) {
      return;
    }
    setUpdatingId(entry.id);
    try {
      const result = await updateWatchDetailsFromApi({
        backendUrl,
        id: entry.id,
        updates: { favorite: !entry.favorite },
      });
      setEntries(result.entries);
      if (selectedEntry?.id === entry.id && result.entry) {
        setSelectedEntry(result.entry);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update favorite.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleStatusChange(entry: WatchEntry, status: WatchStatus) {
    if (!backendUrl) {
      return;
    }
    setUpdatingId(entry.id);
    try {
      const result = await updateWatchStatusFromApi({ backendUrl, id: entry.id, status });
      setEntries(result.entries);
      setSelectedEntry((current) => current && current.id === entry.id ? { ...current, status } : current);
      if (status === "completed" && entry.status !== "completed") {
        setJournalPromptEntry({ ...entry, status: "completed" });
        setJournalMood("liked");
        setJournalNotes("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveCompletionJournal() {
    if (!journalPromptEntry || !journalNotes.trim()) {
      setError("Please add a quick journal note.");
      return;
    }
    await saveWatchJournal({
      id: `${Date.now()}`,
      watchId: journalPromptEntry.id,
      title: journalPromptEntry.title,
      mood: journalMood,
      notes: journalNotes.trim(),
      createdAt: new Date().toISOString(),
    });
    setJournalPromptEntry(null);
    setJournalNotes("");
  }

  async function handleDelete(entry: WatchEntry) {
    if (!backendUrl) {
      return;
    }
    setUpdatingId(entry.id);
    try {
      const result = await deleteWatchItemFromApi({ backendUrl, id: entry.id });
      setEntries(result.entries);
      setSelectedEntry(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete title.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSaveDetails() {
    if (!backendUrl || !selectedEntry || !editDraft) {
      return;
    }

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
      setEntries(result.entries);
      if (result.entry) {
        setSelectedEntry(result.entry);
        setEditDraft(createEditDraft(result.entry));
        setActiveAvailabilityRegion(defaultAvailabilityRegion(result.entry.availability));
      }
      setIsEditingDetails(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update details.");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.container, oneHandedMode && styles.containerOneHanded]}
        refreshControl={<RefreshControl refreshing={loading} tintColor={colors.primary} colors={[colors.primary]} onRefresh={loadEntries} />}
        stickyHeaderIndices={!oneHandedMode ? [0] : undefined}
      >
        <View style={!oneHandedMode ? styles.filterSticky : undefined}>
          {!oneHandedMode ? (
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
          ) : null}
        </View>

        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && filteredEntries.length === 0 ? <Text style={styles.empty}>No saved titles found.</Text> : null}

        <View style={styles.list}>
          {filteredEntries.map((entry) => (
            <Pressable key={entry.id} style={styles.card} onPress={() => openEntry(entry)}>
              <Poster entry={entry} styles={styles} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{entry.title}</Text>
                <Text style={styles.metaText}>{entry.type} | {entry.releaseYear} | {entry.status.replace("_", " ")}</Text>
                <Text style={styles.ratingText}>IMDb: {getImdbRating(entry.ratings)}</Text>
              </View>
              {entry.favorite ? <Ionicons name="heart" color={colors.danger} size={16} /> : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {oneHandedMode ? (
        <View style={styles.bottomFilterDock}>
          <LibraryFilters
            activeGenreFilter={activeGenreFilter}
            activeSortFilter={activeSortFilter}
            sortDirection={sortDirection}
            activeStatusFilter={activeStatusFilter}
            activeTypeFilter={activeTypeFilter}
            compact
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
      ) : null}

      <Modal animationType="slide" transparent visible={Boolean(selectedEntry)} onRequestClose={() => setSelectedEntry(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setSelectedEntry(null)} />
          <View style={styles.modalSheet}>
            {selectedEntry ? (
              <ScrollView contentContainerStyle={styles.modalContent}>
                <Poster entry={selectedEntry} styles={styles} large />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedEntry.title}</Text>
                  <Pressable style={styles.iconBtn} onPress={() => void handleFavoriteToggle(selectedEntry)} disabled={updatingId === selectedEntry.id}>
                    <Ionicons name={selectedEntry.favorite ? "heart" : "heart-outline"} color={selectedEntry.favorite ? colors.danger : colors.muted} size={18} />
                  </Pressable>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => {
                      setIsEditingDetails((value) => !value);
                      setEditDraft(createEditDraft(selectedEntry));
                    }}
                  >
                    <Ionicons name={isEditingDetails ? "close-outline" : "create-outline"} color={colors.text} size={18} />
                  </Pressable>
                  <Pressable style={styles.iconBtn} onPress={() => setSelectedEntry(null)}>
                    <Ionicons name="close-outline" color={colors.text} size={18} />
                  </Pressable>
                </View>
                {isEditingDetails && editDraft ? (
                  <View style={styles.editForm}>
                    <EditField label="Title" value={editDraft.title} onChangeText={(value) => setEditDraft({ ...editDraft, title: value })} styles={styles} />
                    <View style={styles.typeTabsRow}>
                      <Pressable onPress={() => setEditDraft({ ...editDraft, type: "movie" })} style={[styles.statusChip, editDraft.type === "movie" && styles.statusChipActive]}>
                        <Text style={[styles.statusChipText, editDraft.type === "movie" && styles.statusChipTextActive]}>Movie</Text>
                      </Pressable>
                      <Pressable onPress={() => setEditDraft({ ...editDraft, type: "series" })} style={[styles.statusChip, editDraft.type === "series" && styles.statusChipActive]}>
                        <Text style={[styles.statusChipText, editDraft.type === "series" && styles.statusChipTextActive]}>Series</Text>
                      </Pressable>
                    </View>
                    <EditField label="Year" value={editDraft.releaseYear} onChangeText={(value) => setEditDraft({ ...editDraft, releaseYear: value })} styles={styles} />
                    <EditField label="Director" value={editDraft.director} onChangeText={(value) => setEditDraft({ ...editDraft, director: value })} styles={styles} />
                    <EditField label="Lead actors" value={editDraft.leadActors} onChangeText={(value) => setEditDraft({ ...editDraft, leadActors: value })} styles={styles} />
                    <EditField label="Budget" value={editDraft.budget} onChangeText={(value) => setEditDraft({ ...editDraft, budget: value })} styles={styles} />
                    <EditField label="Box office" value={editDraft.boxOffice} onChangeText={(value) => setEditDraft({ ...editDraft, boxOffice: value })} styles={styles} />
                    <EditField label="Poster URL" value={editDraft.posterUrl} onChangeText={(value) => setEditDraft({ ...editDraft, posterUrl: value })} styles={styles} />
                    <EditField label="Ratings" value={editDraft.ratings} onChangeText={(value) => setEditDraft({ ...editDraft, ratings: value })} multiline styles={styles} />
                    {!selectedEntry.availability.length ? (
                      <EditField label="Availability" value={editDraft.availability} onChangeText={(value) => setEditDraft({ ...editDraft, availability: value })} multiline styles={styles} />
                    ) : null}
                    <EditField label="Synopsis" value={editDraft.synopsis} onChangeText={(value) => setEditDraft({ ...editDraft, synopsis: value })} multiline styles={styles} />
                    <EditField label="Notes" value={editDraft.notes} onChangeText={(value) => setEditDraft({ ...editDraft, notes: value })} multiline styles={styles} />
                    <Pressable style={[styles.saveButton, savingEdit && styles.disabled]} onPress={handleSaveDetails} disabled={savingEdit}>
                      {savingEdit ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.saveText}>Save changes</Text>}
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={styles.metaText}>{selectedEntry.type} | {selectedEntry.releaseYear}</Text>
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
                    {selectedEntry.synopsis ? <Text style={styles.body}>{selectedEntry.synopsis}</Text> : null}
                    {selectedEntry.notes ? <Text style={styles.metaText}>Notes: {selectedEntry.notes}</Text> : null}
                  </>
                )}
                <View style={styles.statusWrap}>
                  {statusOptions.map((status) => (
                    <Pressable key={status} onPress={() => void handleStatusChange(selectedEntry, status)} style={[styles.statusChip, selectedEntry.status === status && styles.statusChipActive]}>
                      <Text style={[styles.statusChipText, selectedEntry.status === status && styles.statusChipTextActive]}>{status.replace("_", " ")}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={styles.deleteButton} onPress={() => void handleDelete(selectedEntry)} disabled={updatingId === selectedEntry.id}>
                  <Ionicons name="trash-outline" color={colors.danger} size={16} />
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={Boolean(journalPromptEntry)} onRequestClose={() => setJournalPromptEntry(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setJournalPromptEntry(null)} />
          <View style={styles.journalSheet}>
            <Text style={styles.modalTitle}>Post-watch journal</Text>
            <Text style={styles.metaText}>{journalPromptEntry?.title}</Text>
            <View style={styles.statusWrap}>
              {journalMoods.map((item) => (
                <Pressable key={item} onPress={() => setJournalMood(item)} style={[styles.statusChip, journalMood === item && styles.statusChipActive]}>
                  <Text style={[styles.statusChipText, journalMood === item && styles.statusChipTextActive]}>{item}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={journalNotes}
              onChangeText={setJournalNotes}
              placeholder="Quick reflection about this watch..."
              placeholderTextColor={colors.muted}
              style={styles.journalInput}
              multiline
            />
            <View style={styles.journalActions}>
              <Pressable style={styles.cancelButton} onPress={() => setJournalPromptEntry(null)}>
                <Text style={styles.cancelText}>Skip</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={() => void handleSaveCompletionJournal()}>
                <Text style={styles.saveText}>Save journal</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Poster({ entry, styles, large = false }: { entry: WatchEntry; styles: ReturnType<typeof createStyles>; large?: boolean }) {
  if (entry.posterUrl) {
    return <Image source={{ uri: entry.posterUrl }} style={large ? styles.posterLarge : styles.posterThumb} />;
  }
  return (
    <View style={large ? styles.posterLargeFallback : styles.posterFallback}>
      <Text style={large ? styles.posterLargeText : styles.posterText}>{initials(entry.title)}</Text>
    </View>
  );
}

function LibraryFilters({
  activeGenreFilter,
  activeSortFilter,
  colors,
  sortDirection,
  activeStatusFilter,
  activeTypeFilter,
  compact = false,
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
  compact?: boolean;
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
  const ratingLabel = activeSortFilter === "imdb" ? (sortDirection === "asc" ? "Low to high" : "High to low") : "Off";
  const yearLabel = activeSortFilter === "year" ? (sortDirection === "asc" ? "Oldest first" : "Newest first") : "Off";

  if (compact) {
    return (
      <View style={styles.compactFilterColumn}>
        <View style={[styles.compactFilterPill, styles.compactFilterPillType]}>
          {typeFilters.map((item) => (
            <Pressable key={item} onPress={() => setActiveTypeFilter(item)} style={[styles.compactFilterChip, activeTypeFilter === item && styles.compactTypeChipActive]}>
              <Text style={[styles.compactFilterText, activeTypeFilter === item && styles.compactTypeTextActive]}>{item === "all" ? "All" : item === "movie" ? "Movies" : "Series"}</Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.compactFilterPill, styles.compactFilterPillProgress]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.compactProgressList}>
            {statusFilters.map((item) => (
              <Pressable key={item} onPress={() => setActiveStatusFilter(item)} style={[styles.compactFilterChip, activeStatusFilter === item && styles.compactProgressChipActive]}>
                <Text style={[styles.compactFilterText, activeStatusFilter === item && styles.compactProgressTextActive]}>{compactStatusLabel(item)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  }

  function toggleDropdown(dropdown: "type" | "status" | "genre" | "rating" | "year") {
    setOpenDropdown((current) => current === dropdown ? null : dropdown);
  }

  return (
    <View style={styles.filterPanel}>
      <View style={styles.filterPillRow}>
        <View style={styles.filtersMegaPill}>
          <MiniDropdownPill colors={colors} label="Type" value={typeLabel} open={openDropdown === "type"} onPress={() => toggleDropdown("type")} styles={styles} />
          <MiniDropdownPill colors={colors} label="Status" value={statusLabel} open={openDropdown === "status"} onPress={() => toggleDropdown("status")} styles={styles} />
          <MiniDropdownPill colors={colors} label="Genre" value={genreLabel} open={openDropdown === "genre"} onPress={() => toggleDropdown("genre")} styles={styles} />
        </View>
        <View style={styles.sortMegaPill}>
          <MiniDropdownPill colors={colors} label="Rating" value={ratingLabel} open={openDropdown === "rating"} onPress={() => toggleDropdown("rating")} styles={styles} />
          <MiniDropdownPill colors={colors} label="Year" value={yearLabel} open={openDropdown === "year"} onPress={() => toggleDropdown("year")} styles={styles} />
        </View>
      </View>

      {openDropdown === "type" ? (
        <View style={styles.dropdownMenu}>
          {typeFilters.map((item) => (
            <DropdownOption
              key={item}
              label={item === "all" ? "All" : item === "movie" ? "Movies" : "Series"}
              active={activeTypeFilter === item}
              onPress={() => {
                setActiveTypeFilter(item);
                setOpenDropdown(null);
              }}
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
              onPress={() => {
                setActiveStatusFilter(item);
                setOpenDropdown(null);
              }}
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
            onPress={() => {
              setActiveGenreFilter("all");
              setOpenDropdown(null);
            }}
            colors={colors}
            styles={styles}
          />
          {genreOptions.map((genre) => (
            <DropdownOption
              key={genre}
              label={genre}
              active={activeGenreFilter === genre}
              onPress={() => {
                setActiveGenreFilter(genre);
                setOpenDropdown(null);
              }}
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
      <Ionicons name={open ? "chevron-up" : "chevron-down"} color={open ? colors.primary : colors.muted} size={13} />
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
      <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>{label}</Text>
      {active ? <Ionicons name="checkmark" color={colors.primary} size={15} /> : null}
    </Pressable>
  );
}

function compactStatusLabel(status: "all" | WatchStatus): string {
  if (status === "all") {
    return "All";
  }
  if (status === "planned") {
    return "Plan";
  }
  if (status === "completed") {
    return "Done";
  }
  if (status === "dropped") {
    return "Drop";
  }
  if (status === "in_progress") {
    return "Doing";
  }
  return status;
}

function genresForEntry(entry: WatchEntry): string[] {
  const genreDetail = (entry.externalDetails || []).find((detail) => detail.label.trim().toLowerCase() === "genre");
  if (!genreDetail?.value) {
    return [];
  }
  return genreDetail.value.split(",").map((item) => item.trim()).filter(Boolean);
}

function uniqueGenres(entries: WatchEntry[]): string[] {
  const seen = new Set<string>();
  for (const entry of entries) {
    for (const genre of genresForEntry(entry)) {
      const key = genre.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
      }
    }
  }

  return [...seen].sort((left, right) => left.localeCompare(right)).map((genre) => toTitleCase(genre));
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function imdbRatingNumber(ratings: Array<{ source: string; value: string }>): number {
  const imdb = getImdbRating(ratings);
  const parsed = Number.parseFloat(imdb);
  return Number.isFinite(parsed) ? parsed : -1;
}

function releaseYearNumber(releaseYear: string): number {
  const match = releaseYear.match(/(\d{4})/);
  if (!match) {
    return -1;
  }
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : -1;
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
  onChangeText: (value: string) => void;
  multiline?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.editInput, multiline && styles.editInputMultiline]}
      />
    </View>
  );
}

function createEditDraft(entry: WatchEntry): WatchEditDraft {
  return {
    title: entry.title,
    type: entry.type,
    releaseYear: entry.releaseYear,
    director: entry.director,
    leadActors: entry.leadActors.join(", "),
    budget: entry.budget,
    boxOffice: entry.boxOffice,
    posterUrl: entry.posterUrl || "",
    ratings: entry.ratings.map((rating) => `${rating.source}: ${rating.value}`).join("\n"),
    availability: entry.availability.map((item) => `${item.provider} | ${item.region} | ${item.type}${item.link ? ` | ${item.link}` : ""}`).join("\n"),
    synopsis: entry.synopsis,
    notes: entry.notes,
  };
}

function getImdbRating(ratings: Array<{ source: string; value: string }>): string {
  const match = ratings.find((item) => {
    const normalized = item.source.trim().toLowerCase();
    return normalized === "imdb" || normalized === "internet movie database";
  });
  return match?.value || "Unknown";
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

function parseAvailability(value: string): Array<{ provider: string; region: string; type: "stream" | "rent" | "buy" | "free" | "ads"; link?: string }> {
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [provider = "", region = "Unknown", rawType = "stream", link] = line.split("|").map((part) => part.trim());
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
  if (value === "stream" || value === "rent" || value === "buy" || value === "free" || value === "ads") {
    return value;
  }
  return "stream";
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function parseRatings(value: string): Array<{ source: string; value: string }> {
  return value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [source, ...rest] = line.split(":");
      return {
        source: source.trim(),
        value: rest.join(":").trim() || "Unknown",
      };
    })
    .filter((rating) => rating.source)
    .slice(0, 6);
}

function compactDetailParts(parts: Array<[string, string | undefined]>): string {
  return parts
    .filter(([, value]) => value && value !== "Unknown" && value !== "N/A")
    .map(([label, value]) => `${label}: ${value}`)
    .join(" | ");
}

function initials(title: string): string {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    containerOneHanded: { paddingBottom: spacing.xl, paddingRight: 88 },
    headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
    title: { color: colors.text, fontSize: 30, fontWeight: "900" },
    countText: { color: colors.primary, fontSize: 15, fontWeight: "900" },
    typeTabsRow: { flexDirection: "row", gap: spacing.xs },
    typeTab: { flex: 1, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
    typeTabActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    typeTabText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    typeTabTextActive: { color: colors.primary },
    statusRow: { gap: spacing.xs },
    statusChip: { borderColor: colors.border, borderWidth: 1, borderRadius: 999, backgroundColor: colors.surfaceElevated, paddingHorizontal: spacing.sm, paddingVertical: 6 },
    statusChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    statusChipText: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
    statusChipTextActive: { color: colors.primary },
    genreRow: { gap: spacing.xs },
    sortRow: { flexDirection: "row", gap: spacing.xs },
    sortChip: {
      flex: 1,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      minHeight: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    sortChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    sortChipText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    sortChipTextActive: { color: colors.primary, fontWeight: "900" },
    filterSticky: {
      backgroundColor: colors.background,
      paddingBottom: spacing.xs,
      zIndex: 20,
    },
    filterPanel: {
      gap: spacing.sm,
    },
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
    miniDropdownPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    miniDropdownCopy: { flex: 1, minWidth: 0, gap: 2 },
    miniDropdownLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", textTransform: "uppercase" },
    miniDropdownValue: { color: colors.text, fontSize: 12, fontWeight: "900" },
    miniDropdownTextActive: { color: colors.primary },
    topControlPill: {
      flex: 0.75,
      minHeight: 46,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "space-between",
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: spacing.sm,
    },
    topControlPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    topControlInner: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, minWidth: 0 },
    topControlText: { color: colors.muted, fontSize: 12, fontWeight: "900" },
    topControlTextActive: { color: colors.primary },
    dropdownPanel: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      backgroundColor: colors.surface,
      padding: spacing.xs,
      gap: spacing.xs,
    },
    dropdownRow: {
      minHeight: 48,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 11,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    dropdownLabel: { color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
    dropdownValue: { color: colors.text, fontSize: 14, fontWeight: "900", textTransform: "capitalize" },
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
    filterSection: { gap: spacing.xs },
    filterSectionLabel: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    filterSegmentedRow: {
      flexDirection: "row",
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: colors.surfaceElevated,
    },
    filterSegmentTab: {
      flex: 1,
      minHeight: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRightColor: colors.border,
      borderRightWidth: 1,
    },
    filterSegmentTabActive: {
      backgroundColor: colors.primarySoft,
    },
    filterSegmentText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
    filterSegmentTextActive: { color: colors.primary, fontWeight: "900" },
    filterActionRow: { flexDirection: "row", gap: spacing.xs },
    filterActionButton: {
      flex: 1,
      minHeight: 42,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      backgroundColor: colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 7,
      paddingHorizontal: spacing.sm,
    },
    filterActionButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    filterActionText: { color: colors.muted, fontSize: 12, fontWeight: "900" },
    filterActionTextActive: { color: colors.primary },
    filterChipRow: { gap: spacing.xs },
    filterChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    filterChip: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    filterChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    filterChipText: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
    filterChipTextActive: { color: colors.primary, fontWeight: "900" },
    filterSheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "flex-end" },
    filterSheetDismiss: { flex: 1 },
    filterSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderColor: colors.border,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.md,
      maxHeight: "76%",
    },
    filterSheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    filterSheetTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
    filterSheetClose: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderColor: colors.border,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceElevated,
    },
    filterSortRow: { flexDirection: "row", gap: spacing.xs },
    sortSheet: {
      paddingBottom: spacing.lg,
    },
    filterSortGrid: { gap: spacing.sm },
    filterSortChip: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 52,
      backgroundColor: colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    filterSortChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    filterSortInner: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    filterSortText: { color: colors.muted, fontSize: 14, fontWeight: "800" },
    filterSortTextActive: { color: colors.primary, fontWeight: "900" },
    bottomFilterDock: {
      position: "absolute",
      right: spacing.xs,
      bottom: 84,
      width: 82,
      maxHeight: 380,
    },
    compactFilterColumn: { gap: 8, alignItems: "stretch", paddingVertical: 2 },
    compactFilterPill: {
      gap: 5,
      padding: 5,
      borderRadius: 14,
      borderWidth: 1,
      shadowColor: colors.text,
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: -3, height: 5 },
      elevation: 7,
    },
    compactFilterPillType: {
      borderColor: colors.borderStrong,
      backgroundColor: colors.primarySoft,
    },
    compactFilterPillProgress: {
      borderColor: colors.secondary,
      backgroundColor: colors.secondarySoft,
    },
    compactProgressList: { gap: 5, paddingBottom: 2 },
    compactFilterChip: {
      minHeight: 28,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
    },
    compactFilterText: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
    compactTypeChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    compactTypeTextActive: { color: colors.primary, fontWeight: "900" },
    compactProgressChipActive: { borderColor: colors.secondary, backgroundColor: colors.secondarySoft },
    compactProgressTextActive: { color: colors.secondary, fontWeight: "900" },
    list: { gap: spacing.sm },
    card: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.sm },
    cardBody: { flex: 1, gap: 3 },
    cardTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    metaText: { color: colors.muted, fontSize: 12, lineHeight: 18, textTransform: "capitalize" },
    ratingText: { color: colors.text, fontSize: 12, fontWeight: "700" },
    ratingsText: { color: colors.text, fontSize: 12, lineHeight: 18, fontWeight: "600" },
    posterThumb: { width: 52, height: 76, borderRadius: 8, backgroundColor: colors.surfaceElevated },
    posterFallback: { width: 52, height: 76, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
    posterText: { color: colors.primary, fontSize: 14, fontWeight: "900" },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(4,8,14,0.45)", justifyContent: "flex-end" },
    modalDismiss: { flex: 1 },
    modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderColor: colors.border, borderWidth: 1, maxHeight: "86%", padding: spacing.md },
    journalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderColor: colors.border, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
    modalContent: { gap: spacing.sm, paddingBottom: spacing.md },
    posterLarge: { alignSelf: "center", width: 136, height: 202, borderRadius: 10, backgroundColor: colors.surfaceElevated },
    posterLargeFallback: { alignSelf: "center", width: 136, height: 202, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
    posterLargeText: { color: colors.primary, fontSize: 28, fontWeight: "900" },
    modalHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900", flex: 1 },
    iconBtn: { width: 34, height: 34, borderRadius: 10, borderColor: colors.border, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    modalSection: { gap: spacing.xs, marginTop: spacing.xs },
    modalSectionTitle: { color: colors.text, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
    availabilityFilterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    availabilityFilterChip: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 5 },
    availabilityFilterChipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    availabilityFilterText: { color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
    availabilityFilterTextActive: { color: colors.primary },
    availabilityWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    availabilityPill: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 6, gap: 2 },
    availabilityProvider: { color: colors.text, fontSize: 12, fontWeight: "800" },
    availabilityMeta: { color: colors.primary, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    statusWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    body: { color: colors.text, fontSize: 13, lineHeight: 19 },
    deleteButton: { minHeight: 42, borderColor: colors.danger, borderWidth: 1, borderRadius: 10, backgroundColor: colors.dangerSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs },
    deleteText: { color: colors.danger, fontWeight: "900" },
    editForm: { gap: spacing.sm },
    editField: { gap: 5 },
    editLabel: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    editInput: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: 10, color: colors.text, minHeight: 40, paddingHorizontal: spacing.sm },
    editInputMultiline: { minHeight: 78, paddingTop: spacing.sm },
    saveButton: { minHeight: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    saveText: { color: colors.onPrimary, fontWeight: "900" },
    journalInput: {
      minHeight: 92,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
      color: colors.text,
      textAlignVertical: "top",
      fontSize: 13,
    },
    journalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
    cancelButton: {
      minHeight: 44,
      borderRadius: 10,
      borderColor: colors.border,
      borderWidth: 1,
      backgroundColor: colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
    },
    cancelText: { color: colors.muted, fontWeight: "800", fontSize: 12 },
    disabled: { opacity: 0.65 },
    empty: { color: colors.muted, fontSize: 13 },
    error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: 12, padding: spacing.sm },
  });
}
