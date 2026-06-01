import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { logWatchItemFromApi, WatchStatus } from "../../services/api";
import { getBackendUrl } from "../../storage/appStorage";

const statusOptions: WatchStatus[] = ["planned", "started", "in_progress", "completed", "dropped"];

export default function AddTitleScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<WatchStatus>("planned");
  const [favorite, setFavorite] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!title.trim()) {
      setError("Enter a movie or series name first.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const backendUrl = await getBackendUrl();
      await logWatchItemFromApi({
        backendUrl,
        title: title.trim(),
        status,
        favorite,
        notes: notes.trim(),
      });
      setTitle("");
      setNotes("");
      setFavorite(false);
      setStatus("planned");
      Alert.alert("Added", "Title saved and enriched.");
      router.push("/(tabs)/library" as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this title.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Add title</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Movie or series</Text>
        <TextInput
          style={styles.input}
          placeholder="Title"
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Progress</Text>
        <View style={styles.pillWrap}>
          {statusOptions.map((item) => (
            <Pressable key={item} style={[styles.pill, status === item && styles.pillActive]} onPress={() => setStatus(item)}>
              <Text style={[styles.pillText, status === item && styles.pillTextActive]}>{item.replace("_", " ")}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          placeholder="Optional notes"
          placeholderTextColor={colors.muted}
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Pressable
          onPress={() => setFavorite((value) => !value)}
          style={[styles.iconButton, favorite && styles.iconButtonActive]}
          accessibilityLabel={favorite ? "Remove favorite" : "Add favorite"}
        >
          <Ionicons name={favorite ? "heart" : "heart-outline"} color={favorite ? colors.danger : colors.muted} size={18} />
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={saving} onPress={handleAdd} style={[styles.primaryButton, saving && styles.disabled]}>
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>Add & enrich</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    container: { flexGrow: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
    title: { color: colors.text, fontSize: 30, fontWeight: "900" },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: spacing.md, gap: spacing.sm },
    label: { color: colors.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    input: { minHeight: 44, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, borderRadius: 10, color: colors.text, paddingHorizontal: spacing.md },
    notesInput: { minHeight: 84, paddingTop: spacing.sm },
    pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    pill: { borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 6, backgroundColor: colors.surfaceElevated },
    pillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
    pillText: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
    pillTextActive: { color: colors.primary },
    iconButton: { width: 38, height: 38, borderRadius: 999, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surfaceElevated, alignItems: "center", justifyContent: "center" },
    iconButtonActive: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
    primaryButton: { minHeight: 46, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    primaryText: { color: colors.onPrimary, fontWeight: "900" },
    disabled: { opacity: 0.65 },
    error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderColor: colors.danger, borderWidth: 1, borderRadius: 12, padding: spacing.sm },
  });
}
