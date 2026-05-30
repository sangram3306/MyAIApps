import { type ComponentProps, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import {
  deleteWatchItemFromApi,
  getWatcherProfileFromApi,
  listWatchItemsFromApi,
  logWatchItemFromApi,
  updateWatchDetailsFromApi,
  updateWatchStatusFromApi,
  WatchEntry,
  WatchStatus,
  WatchType,
  WatcherProfileResponse,
} from "../services/api";
import { getBackendUrl } from "../storage/appStorage";

const statusOptions: WatchStatus[] = ["planned", "started", "in_progress", "completed", "dropped"];
const statusFilters: Array<"all" | WatchStatus> = ["all", ...statusOptions];
const typeFilters: Array<"all" | WatchType> = ["all", "movie", "series"];

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

type WatchInfoRow = {
  label?: string;
  value: string;
  icon: ComponentProps<typeof Ionicons>["name"];
};

export default function WatchTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [backendUrl, setBackendUrl] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<WatchStatus>("planned");
  const [favorite, setFavorite] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [entries, setEntries] = useState<WatchEntry[]>([]);
  const [source, setSource] = useState<"static" | "llm" | "fallback">("fallback");
  const [enrichmentSource, setEnrichmentSource] = useState<"static" | "llm" | "fallback">("fallback");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<WatchEntry | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editDraft, setEditDraft] = useState<WatchEditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [watcherProfile, setWatcherProfile] = useState<WatcherProfileResponse | null>(null);
  const [activeTypeFilter, setActiveTypeFilter] = useState<"all" | WatchType>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | WatchStatus>("all");
  const [activeAvailabilityRegion, setActiveAvailabilityRegion] = useState<"all" | string>("all");

  const typeScopedEntries = entries.filter(
    (entry) => activeTypeFilter === "all" || entry.type === activeTypeFilter,
  );
  const filteredEntries = typeScopedEntries.filter(
    (entry) => activeFilter === "all" || entry.status === activeFilter,
  );
  const selectedAvailabilityRegions = selectedEntry ? availabilityRegionsFor(selectedEntry.availability) : [];
  const selectedAvailability = selectedEntry
    ? filterAvailability(selectedEntry.availability, activeAvailabilityRegion)
    : [];

  const loadEntries = useCallback(async (url: string) => {
    if (!url) {
      return;
    }
    setLoading(true);
    try {
      const result = await listWatchItemsFromApi({ backendUrl: url });
      setEntries(result.entries);
      setSource(result.source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load watch tracker.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getBackendUrl().then((url) => {
        if (active) {
          setBackendUrl(url);
          void loadEntries(url);
        }
      });
      return () => {
        active = false;
      };
    }, [loadEntries]),
  );

  async function handleAdd() {
    if (!backendUrl) {
      setError("Watch Tracker needs the backend to be online.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a movie or series name first.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await logWatchItemFromApi({
        backendUrl,
        title: title.trim(),
        status,
        favorite,
        notes: notes.trim(),
      });
      setEntries(result.entries);
      setEnrichmentSource(result.metadata.toolSources.enrichment);
      setTitle("");
      setNotes("");
      setFavorite(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this title.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(id: string, nextStatus: WatchStatus) {
    if (!backendUrl) {
      return;
    }
    setUpdatingId(id);
    try {
      const result = await updateWatchStatusFromApi({ backendUrl, id, status: nextStatus });
      setEntries(result.entries);
      setSource(result.source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!backendUrl) {
      return;
    }
    setDeletingId(id);
    try {
      const result = await deleteWatchItemFromApi({ backendUrl, id });
      setEntries(result.entries);
      setSource(result.source);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete this item.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleFavoriteToggle(entry: WatchEntry) {
    if (!backendUrl) {
      return;
    }
    setUpdatingId(entry.id);
    setError("");
    try {
      const result = await updateWatchDetailsFromApi({
        backendUrl,
        id: entry.id,
        updates: { favorite: !Boolean(entry.favorite) },
      });
      setEntries(result.entries);
      setSource(result.source);
      if (selectedEntry?.id === entry.id && result.entry) {
        setSelectedEntry(result.entry);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update favorite.");
    } finally {
      setUpdatingId(null);
    }
  }

  function openEntry(entry: WatchEntry) {
    setSelectedEntry(entry);
    setIsEditingDetails(false);
    setActiveAvailabilityRegion(defaultAvailabilityRegion(entry.availability));
    setEditDraft(createEditDraft(entry));
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
      setSource(result.source);
      if (result.entry) {
        setSelectedEntry(result.entry);
        setEditDraft(createEditDraft(result.entry));
      }
      setIsEditingDetails(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update details.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleBuildWatcherProfile() {
    if (!backendUrl) {
      setError("Watch Tracker needs the backend to be online.");
      return;
    }
    setProfileLoading(true);
    setError("");
    try {
      const result = await getWatcherProfileFromApi({ backendUrl });
      setWatcherProfile(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not build watcher profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboard}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.text} size={18} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="film-outline" color={colors.primary} size={14} />
            <Text style={styles.heroBadgeText}>Cine tracker</Text>
          </View>
          <Text style={styles.title}>Watch tracker</Text>
          <Text style={styles.subtitle}>
            Log movies and series, enrich details with AI, and track your status from planned to completed.
          </Text>
          <View style={styles.heroMetrics}>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Saved</Text>
              <Text style={styles.metricValue}>{entries.length}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>List</Text>
              <Text style={styles.metricValue}>{source}</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>Enrichment</Text>
              <Text style={styles.metricValue}>{formatWatchSource(enrichmentSource)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.inputSectionTitle}>Add title</Text>
          <TextInput
            style={styles.input}
            placeholder="Movie or series name"
            placeholderTextColor={colors.muted}
            value={title}
            onChangeText={setTitle}
          />
          <Text style={styles.helperText}>Movie or series is detected automatically from OMDb when available.</Text>
          <View style={styles.dropdownBlock}>
            <Text style={styles.dropdownLabel}>Progress</Text>
            <Pressable
              onPress={() => setStatusDropdownOpen((value) => !value)}
              style={styles.dropdownTrigger}
            >
              <Text style={styles.dropdownValue}>{statusLabel(status)}</Text>
              <Ionicons name={statusDropdownOpen ? "chevron-up" : "chevron-down"} color={colors.muted} size={16} />
            </Pressable>
            {statusDropdownOpen ? (
              <View style={styles.dropdownMenu}>
                {statusOptions.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => {
                      setStatus(item);
                      setStatusDropdownOpen(false);
                    }}
                    style={[styles.dropdownOption, status === item && styles.dropdownOptionActive]}
                  >
                    <Text style={[styles.dropdownOptionText, status === item && styles.dropdownOptionTextActive]}>
                      {statusLabel(item)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="Optional personal notes"
            placeholderTextColor={colors.muted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <Pressable
            onPress={() => setFavorite((value) => !value)}
            style={[styles.favoriteDraftToggle, favorite && styles.favoriteDraftToggleActive]}
            accessibilityLabel={favorite ? "Remove favorite" : "Add favorite"}
          >
            <Ionicons name={favorite ? "heart" : "heart-outline"} size={16} color={favorite ? colors.danger : colors.muted} />
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable onPress={handleAdd} disabled={saving} style={[styles.primaryButton, saving && styles.disabled]}>
            {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryButtonText}>Add & enrich</Text>}
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Watcher profile</Text>
            <Pressable onPress={handleBuildWatcherProfile} disabled={profileLoading} style={styles.profileButton}>
              {profileLoading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" color={colors.primary} size={14} />
                  <Text style={styles.profileButtonText}>Analyze</Text>
                </>
              )}
            </Pressable>
          </View>
          {watcherProfile ? (
            <View style={styles.profileCard}>
              <Text style={styles.profileSource}>{formatWatchSource(watcherProfile.source)} | {watcherProfile.count} titles</Text>
              <Text style={styles.profileTitle}>{watcherProfile.profile.archetype}</Text>
              <Text style={styles.synopsis}>{watcherProfile.profile.summary}</Text>
              <ProfileList title="Traits" items={watcherProfile.profile.traits} styles={styles} />
              <ProfileList title="Patterns" items={watcherProfile.profile.patterns} styles={styles} />
              <ProfileList title="Suggestions" items={watcherProfile.profile.suggestions} styles={styles} />
            </View>
          ) : (
            <Text style={styles.metaText}>Generate a taste profile from your saved movies and series.</Text>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>Saved titles</Text>
              <Text style={styles.sectionCount}>({filteredEntries.length})</Text>
            </View>
            <Pressable
              onPress={() => router.push("/watch-favorites")}
              style={styles.favouritesCornerButton}
            >
              <Text style={styles.favouritesCornerText}>Favourites</Text>
            </Pressable>
          </View>
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
                  {item === "all" ? entries.length : entries.filter((entry) => entry.type === item).length}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.savedLayout}>
            <ScrollView
              style={styles.savedListPane}
              contentContainerStyle={styles.savedListContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {loading ? <ActivityIndicator color={colors.primary} /> : null}
              {!loading && entries.length === 0 ? <Text style={styles.metaText}>No items yet.</Text> : null}
              {!loading && entries.length > 0 && typeScopedEntries.length === 0 ? (
                <Text style={styles.metaText}>No {activeTypeFilter === "movie" ? "movies" : "series"} yet.</Text>
              ) : null}
              {!loading && typeScopedEntries.length > 0 && filteredEntries.length === 0 ? (
                <Text style={styles.metaText}>No items in this status for selected type.</Text>
              ) : null}
              {filteredEntries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <PosterThumb entry={entry} styles={styles} />
                    <Pressable style={{ flex: 1 }} onPress={() => openEntry(entry)}>
                      <Text style={styles.entryTitle}>{entry.title}</Text>
                      <View style={styles.entryMetaRow}>
                        <View style={styles.typePill}>
                          <Text style={styles.typePillText}>{entry.type}</Text>
                        </View>
                        <Text style={styles.dotSep}>•</Text>
                        <Text style={styles.metaText}>{entry.releaseYear}</Text>
                        <Text style={styles.dotSep}>•</Text>
                        <View style={[styles.statusPill, statusPillStyle(entry.status, colors)]}>
                          <Text style={styles.statusPillText}>{entry.status.replace("_", " ")}</Text>
                        </View>
                      </View>
                      <Text style={styles.ratingsText}>
                        IMDb: {getImdbRating(entry.ratings)}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={styles.filterRail}>
              {statusFilters.map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[
                    styles.filterRailItem,
                    activeFilter === filter && styles.filterRailItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterRailText,
                      activeFilter === filter && styles.filterRailTextActive,
                    ]}
                  >
                    {filter === "all" ? "All" : shortStatusLabel(filter)}
                  </Text>
                  <Text
                    style={[
                      styles.filterRailCount,
                      activeFilter === filter && styles.filterRailTextActive,
                    ]}
                  >
                    {filter === "all"
                      ? typeScopedEntries.length
                      : typeScopedEntries.filter((entry) => entry.status === filter).length}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
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
            <View style={styles.modalHandle} />
            {selectedEntry ? (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                <View style={styles.modalPosterWrap}>
                  <PosterLarge entry={selectedEntry} styles={styles} />
                </View>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedEntry.title}</Text>
                  <Pressable
                    onPress={() => {
                      void handleFavoriteToggle(selectedEntry);
                    }}
                    style={styles.iconBtn}
                    disabled={updatingId === selectedEntry.id}
                    accessibilityLabel={selectedEntry.favorite ? "Remove favorite" : "Add favorite"}
                  >
                    <Ionicons
                      name={selectedEntry.favorite ? "heart" : "heart-outline"}
                      color={selectedEntry.favorite ? colors.danger : colors.muted}
                      size={18}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setIsEditingDetails((value) => !value);
                      setEditDraft(createEditDraft(selectedEntry));
                    }}
                    style={styles.iconBtn}
                  >
                    <Ionicons name={isEditingDetails ? "close-outline" : "create-outline"} color={colors.text} size={18} />
                  </Pressable>
                  <Pressable onPress={() => setSelectedEntry(null)} style={styles.iconBtn}>
                    <Ionicons name="close-outline" color={colors.text} size={18} />
                  </Pressable>
                </View>

                {isEditingDetails && editDraft ? (
                  <View style={styles.editForm}>
                    <EditField label="Title" value={editDraft.title} onChangeText={(value) => setEditDraft({ ...editDraft, title: value })} styles={styles} />
                    <View style={styles.row}>
                      <Pressable onPress={() => setEditDraft({ ...editDraft, type: "movie" })} style={[styles.pill, editDraft.type === "movie" && styles.pillActive]}>
                        <Text style={[styles.pillText, editDraft.type === "movie" && styles.pillTextActive]}>Movie</Text>
                      </Pressable>
                      <Pressable onPress={() => setEditDraft({ ...editDraft, type: "series" })} style={[styles.pill, editDraft.type === "series" && styles.pillActive]}>
                        <Text style={[styles.pillText, editDraft.type === "series" && styles.pillTextActive]}>Series</Text>
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
                    <Pressable onPress={handleSaveDetails} style={[styles.primaryButton, savingEdit && styles.disabled]} disabled={savingEdit}>
                      {savingEdit ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryButtonText}>Save changes</Text>}
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={styles.metaText}>
                      {selectedEntry.type} | {selectedEntry.releaseYear}
                    </Text>
                    {watchInfoRowsFor(selectedEntry).map((item) => (
                      <View key={`${item.label || "detail"}-${item.value}`} style={styles.infoRow}>
                        <Ionicons name={item.icon} color={colors.muted} size={13} />
                        <Text style={styles.metaText}>
                          {item.label ? `${item.label}: ` : ""}
                          {item.value}
                        </Text>
                      </View>
                    ))}
                    <Text style={styles.ratingsText}>
                      Ratings: {selectedEntry.ratings.length ? selectedEntry.ratings.map((r) => `${r.source} ${r.value}`).join(" | ") : "Unknown"}
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
                  </>
                )}

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Favorite</Text>
                  <Pressable
                    onPress={() => {
                      void handleFavoriteToggle(selectedEntry);
                    }}
                    style={[styles.favoriteActionButton, Boolean(selectedEntry.favorite) && styles.favoriteActionButtonActive]}
                    disabled={updatingId === selectedEntry.id}
                  >
                    <Ionicons
                      name={Boolean(selectedEntry.favorite) ? "heart" : "heart-outline"}
                      color={Boolean(selectedEntry.favorite) ? colors.danger : colors.muted}
                      size={15}
                    />
                    <Text style={[styles.favoriteActionText, Boolean(selectedEntry.favorite) && styles.favoriteActionTextActive]}>
                      {Boolean(selectedEntry.favorite) ? "Favorited" : "Add to favorites"}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Progress</Text>
                  <View style={styles.rowWrap}>
                    {statusOptions.map((item) => (
                      <Pressable
                        key={`modal-${selectedEntry.id}-${item}`}
                        onPress={async () => {
                          await handleStatusChange(selectedEntry.id, item);
                          setSelectedEntry((current) =>
                            current && current.id === selectedEntry.id
                              ? { ...current, status: item }
                              : current,
                          );
                        }}
                        style={[styles.pillSmall, selectedEntry.status === item && styles.pillActive]}
                        disabled={updatingId === selectedEntry.id}
                      >
                        <Text style={[styles.pillSmallText, selectedEntry.status === item && styles.pillTextActive]}>
                          {item.replace("_", " ")}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {!isEditingDetails && selectedEntry.synopsis ? <Text style={styles.synopsis}>{selectedEntry.synopsis}</Text> : null}
                {!isEditingDetails && selectedEntry.notes ? <Text style={styles.notesText}>Notes: {selectedEntry.notes}</Text> : null}
                <Pressable
                  onPress={async () => {
                    await handleDelete(selectedEntry.id);
                    setSelectedEntry(null);
                  }}
                  style={[styles.deleteActionButton, deletingId === selectedEntry.id && styles.disabled]}
                  disabled={deletingId === selectedEntry.id}
                >
                  {deletingId === selectedEntry.id ? (
                    <ActivityIndicator color={colors.danger} />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" color={colors.danger} size={16} />
                      <Text style={styles.deleteActionText}>Delete from tracker</Text>
                    </>
                  )}
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function PosterThumb({ entry, styles }: { entry: WatchEntry; styles: ReturnType<typeof createStyles> }) {
  if (entry.posterUrl) {
    return <Image source={{ uri: entry.posterUrl }} style={styles.posterThumb} />;
  }
  return (
    <View style={styles.posterFallback}>
      <Text style={styles.posterFallbackText}>{initials(entry.title)}</Text>
    </View>
  );
}

function PosterLarge({ entry, styles }: { entry: WatchEntry; styles: ReturnType<typeof createStyles> }) {
  if (entry.posterUrl) {
    return <Image source={{ uri: entry.posterUrl }} style={styles.posterLarge} />;
  }
  return (
    <View style={styles.posterLargeFallback}>
      <Text style={styles.posterLargeFallbackText}>{initials(entry.title)}</Text>
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

function ProfileList({
  title,
  items,
  styles,
}: {
  title: string;
  items: string[];
  styles: ReturnType<typeof createStyles>;
}) {
  if (!items.length) {
    return null;
  }
  return (
    <View style={styles.profileList}>
      <Text style={styles.modalSectionTitle}>{title}</Text>
      {items.map((item) => (
        <Text key={`${title}-${item}`} style={styles.metaText}>- {item}</Text>
      ))}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    keyboard: { flex: 1, backgroundColor: colors.background },
    container: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    backButton: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
    backText: { color: colors.text, fontWeight: "800" },
    hero: { gap: spacing.xs },
    heroBadge: {
      alignItems: "center",
      alignSelf: "flex-start",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    heroBadgeText: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    title: { color: colors.text, fontSize: 30, fontWeight: "900" },
    subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    metaText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 20,
      padding: spacing.md,
      gap: spacing.sm,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    heroMetrics: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", marginTop: spacing.xs },
    metricPill: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
    metricValue: { color: colors.text, fontSize: 11, fontWeight: "900", textTransform: "capitalize" },
    inputSectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
    input: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, minHeight: 44, color: colors.text },
    helperText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
    notesInput: { minHeight: 72, paddingTop: spacing.sm },
    favoriteDraftToggle: {
      alignSelf: "flex-start",
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      width: 34,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceElevated,
    },
    favoriteDraftToggleActive: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
    },
    row: { flexDirection: "row", gap: spacing.sm },
    rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    dropdownBlock: { gap: 6 },
    dropdownLabel: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    dropdownTrigger: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 44,
      paddingHorizontal: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dropdownValue: { color: colors.text, fontSize: 13, fontWeight: "800" },
    dropdownMenu: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: 5,
      gap: 4,
    },
    dropdownOption: {
      borderRadius: 10,
      paddingHorizontal: spacing.sm,
      paddingVertical: 9,
    },
    dropdownOptionActive: { backgroundColor: colors.primarySoft },
    dropdownOptionText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
    dropdownOptionTextActive: { color: colors.primary },
    pill: { borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.surfaceElevated },
    pillSmall: { borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.surfaceElevated },
    pillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    pillText: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
    pillSmallText: { color: colors.muted, fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
    pillTextActive: { color: colors.primary },
    error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: 12, padding: spacing.sm },
    primaryButton: { backgroundColor: colors.primary, borderRadius: 14, minHeight: 46, alignItems: "center", justifyContent: "center" },
    primaryButtonText: { color: colors.onPrimary, fontWeight: "900" },
    profileButton: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 32,
    },
    profileButtonText: { color: colors.primary, fontSize: 12, fontWeight: "900" },
    profileCard: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      padding: spacing.sm,
      gap: spacing.xs,
    },
    profileSource: { color: colors.primary, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
    profileTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
    profileList: { gap: 3, marginTop: spacing.xs },
    disabled: { opacity: 0.65 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
    sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
    sectionCount: { color: colors.primary, fontSize: 13, fontWeight: "900" },
    favouritesCornerButton: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    favouritesCornerText: { color: colors.primary, fontSize: 12, fontWeight: "900" },
    typeTabsRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs },
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
    savedLayout: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
    savedListPane: { flex: 1, height: 347 },
    savedListContent: { gap: spacing.sm, paddingRight: 2 },
    filterRail: {
      width: 74,
      alignSelf: "flex-start",
      justifyContent: "flex-start",
      flexShrink: 0,
      gap: 7,
    },
    filterRailItem: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      height: 52,
      paddingVertical: 6,
      paddingHorizontal: 6,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      backgroundColor: colors.surfaceElevated,
    },
    filterRailItemActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    filterRailText: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    filterRailCount: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
    },
    filterRailTextActive: {
      color: colors.primary,
    },
    entryCard: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: spacing.sm,
      gap: 8,
      backgroundColor: colors.surfaceElevated,
    },
    entryHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    posterThumb: {
      width: 52,
      height: 76,
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
    },
    posterFallback: {
      width: 52,
      height: 76,
      borderRadius: 8,
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    posterFallbackText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
    },
    entryTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    entryMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" },
    dotSep: { color: colors.muted, fontSize: 12 },
    typePill: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    typePillText: { color: colors.text, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    statusPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderWidth: 1,
    },
    statusPillText: { color: colors.text, fontSize: 10, fontWeight: "800", textTransform: "capitalize" },
    infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    iconBtn: { borderColor: colors.border, borderWidth: 1, borderRadius: 10, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
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
    availabilityFilterChipActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    availabilityFilterText: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "900",
      textTransform: "uppercase",
    },
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
    detailsGrid: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: colors.surfaceElevated,
    },
    detailRow: {
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
      gap: 2,
    },
    detailLabel: { color: colors.primary, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
    detailValue: { color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "600" },
    synopsis: { color: colors.text, fontSize: 13, lineHeight: 19 },
    notesText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(4,8,14,0.45)",
      justifyContent: "flex-end",
    },
    modalDismiss: { flex: 1 },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderColor: colors.border,
      borderWidth: 1,
      padding: spacing.md,
      gap: spacing.sm,
      minHeight: "44%",
      maxHeight: "86%",
    },
    modalContent: { gap: spacing.sm, paddingBottom: spacing.md },
    modalPosterWrap: { alignItems: "center" },
    posterLarge: {
      width: 120,
      height: 178,
      borderRadius: 10,
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
    },
    posterLargeFallback: {
      width: 120,
      height: 178,
      borderRadius: 10,
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    posterLargeFallbackText: {
      color: colors.primary,
      fontSize: 24,
      fontWeight: "900",
    },
    modalHandle: {
      width: 56,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.borderStrong,
      alignSelf: "center",
      marginBottom: spacing.xs,
    },
    modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.sm },
    modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900", flex: 1 },
    modalSection: { gap: spacing.xs, marginTop: spacing.xs },
    modalSectionTitle: { color: colors.text, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
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
    editInputMultiline: {
      minHeight: 78,
      paddingTop: spacing.sm,
    },
    deleteActionButton: {
      marginTop: spacing.sm,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.xs,
      backgroundColor: colors.dangerSoft,
    },
    deleteActionText: { color: colors.danger, fontSize: 13, fontWeight: "900" },
    favoriteActionButton: {
      alignSelf: "flex-start",
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      minHeight: 34,
      paddingHorizontal: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.surfaceElevated,
    },
    favoriteActionButtonActive: {
      borderColor: colors.danger,
      backgroundColor: colors.dangerSoft,
    },
    favoriteActionText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    favoriteActionTextActive: { color: colors.danger },
  });
}

function formatWatchSource(source: "static" | "llm" | "fallback"): string {
  if (source === "static") {
    return "OMDb/Wikipedia MCP";
  }
  if (source === "llm") {
    return "LLM";
  }
  return "Fallback";
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

function compactDetailParts(parts: Array<[string, string | undefined]>): string {
  return parts
    .filter(([, value]) => value && value !== "Unknown" && value !== "N/A")
    .map(([label, value]) => `${label}: ${value}`)
    .join(" | ");
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

function getImdbRating(ratings: Array<{ source: string; value: string }>): string {
  const match = ratings.find((item) => {
    const normalized = item.source.trim().toLowerCase();
    return normalized === "imdb" || normalized === "internet movie database";
  });
  return match?.value || "Unknown";
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

function shortStatusLabel(status: WatchStatus): string {
  if (status === "in_progress") {
    return "In prog";
  }
  if (status === "completed") {
    return "Done";
  }
  if (status === "planned") {
    return "Plan";
  }
  if (status === "started") {
    return "Start";
  }
  return "Drop";
}

function statusLabel(status: WatchStatus): string {
  return status.replace("_", " ");
}

function statusPillStyle(status: WatchStatus, colors: ReturnType<typeof useAppTheme>["colors"]) {
  if (status === "completed") {
    return { borderColor: colors.primary, backgroundColor: colors.primarySoft };
  }
  if (status === "dropped") {
    return { borderColor: colors.danger, backgroundColor: colors.dangerSoft };
  }
  return { borderColor: colors.border, backgroundColor: colors.surface };
}
