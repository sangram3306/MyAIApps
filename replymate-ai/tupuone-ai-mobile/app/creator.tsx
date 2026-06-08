import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../components/PremiumUI";
import { radius, spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import {
  CreatorDraft,
  CreatorRepurposeResponse,
  getCreatorDraftsFromApi,
  repurposeContentFromApi,
  updateCreatorDraftFromApi,
} from "../services/api";
import { getBackendUrl } from "../storage/appStorage";

const sourceTypes = ["idea", "note", "article", "thread", "meeting", "video"] as const;
const platformOptions = ["x", "linkedin", "instagram", "email", "thread"] as const;
const toneOptions = [
  "balanced",
  "professional",
  "friendly",
  "punchy",
  "educational",
  "persuasive",
  "bold",
] as const;

export default function CreatorScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [backendUrl, setBackendUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceType, setSourceType] = useState<(typeof sourceTypes)[number]>("note");
  const [audience, setAudience] = useState("general");
  const [goal, setGoal] = useState("repurpose into content");
  const [tone, setTone] = useState<(typeof toneOptions)[number]>("balanced");
  const [selectedPlatforms, setSelectedPlatforms] = useState<(typeof platformOptions)[number][]>([
    "x",
    "linkedin",
    "instagram",
    "email",
  ]);
  const [result, setResult] = useState<CreatorRepurposeResponse | null>(null);
  const [drafts, setDrafts] = useState<CreatorDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingDraft, setEditingDraft] = useState<CreatorDraft | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftHook, setDraftHook] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);

  const refreshDrafts = useCallback(
    async (url = backendUrl) => {
      if (!url) {
        return;
      }

      setDraftsLoading(true);
      try {
        const response = await getCreatorDraftsFromApi({ backendUrl: url });
        setDrafts(response.drafts);
      } catch {
        setDrafts([]);
      } finally {
        setDraftsLoading(false);
      }
    },
    [backendUrl],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      getBackendUrl().then((url) => {
        if (!active) {
          return;
        }

        setBackendUrl(url);
        void refreshDrafts(url);
      });

      return () => {
        active = false;
      };
    }, [refreshDrafts]),
  );

  function togglePlatform(value: (typeof platformOptions)[number]) {
    setSelectedPlatforms((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  async function handleRepurpose() {
    if (!backendUrl) {
      setError("Creator Studio needs the backend to be online.");
      return;
    }

    if (!sourceText.trim()) {
      setError("Paste something to repurpose first.");
      return;
    }

    if (!selectedPlatforms.length) {
      setError("Choose at least one platform.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await repurposeContentFromApi({
        backendUrl,
        sourceText: sourceText.trim(),
        sourceType,
        audience,
        goal,
        tone,
        platforms: selectedPlatforms,
      });
      setResult(response);
      await refreshDrafts(backendUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not repurpose content.");
    } finally {
      setLoading(false);
    }
  }

  async function handleShare(resultToShare: CreatorRepurposeResponse) {
    const payload = buildShareText(resultToShare);
    await Share.share({
      title: resultToShare.repurpose.title,
      message: payload,
    });
  }

  function startEditDraft(draft: CreatorDraft) {
    setEditingDraft(draft);
    setDraftTitle(draft.title);
    setDraftSummary(draft.summary);
    setDraftHook(draft.hook);
  }

  async function handleSaveDraftEdit() {
    if (!editingDraft || !backendUrl) {
      return;
    }

    setSavingDraft(true);
    try {
      await updateCreatorDraftFromApi({
        backendUrl,
        id: editingDraft.id,
        title: draftTitle.trim(),
        summary: draftSummary.trim(),
        hook: draftHook.trim(),
        platformOutputs: editingDraft.platformOutputs,
      });
      setEditingDraft(null);
      await refreshDrafts(backendUrl);
      Alert.alert("Saved", "Draft updated.");
    } catch (caught) {
      Alert.alert("Update failed", caught instanceof Error ? caught.message : "Could not update draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  const draftTrend = useMemo(() => {
    const byDate = new Map<string, number>();
    drafts.forEach((item) => {
      const key = item.createdAt.slice(0, 10);
      byDate.set(key, (byDate.get(key) || 0) + 1);
    });
    return [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, count]) => ({ date, count }));
  }, [drafts]);

  return (
    <View style={styles.screen}>
      <MatrixBackground density={12} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="color-wand-outline" color={colors.primary} size={20} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Creator Studio</Text>
            <Text style={styles.subtitle}>
              Repurpose content with the power of AI.
            </Text>
          </View>
        </View>

      <View style={styles.stepper}>
        {["Content", "Platform", "Tone", "Generate"].map((step, index) => (
          <View key={step} style={styles.stepperItem}>
            <View style={[styles.stepperDot, index === 0 && styles.stepperDotActive]}>
              <Text style={[styles.stepperDotText, index === 0 && styles.stepperDotTextActive]}>
                {index + 1}
              </Text>
            </View>
            <Text style={[styles.stepperText, index === 0 && styles.stepperTextActive]}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Add Your Content</Text>
        <Text style={styles.sectionHint}>Paste your notes, ideas, article, or meeting notes here.</Text>
        <TextInput
          multiline
          placeholder="Paste source material here..."
          placeholderTextColor={colors.muted}
          style={styles.sourceInput}
          textAlignVertical="top"
          value={sourceText}
          onChangeText={setSourceText}
        />
        <Text style={styles.characterCount}>{sourceText.length} / 5000</Text>

        <View style={styles.fieldRow}>
          <Field
            label="Audience"
            value={audience}
            onChangeText={setAudience}
            placeholder="e.g. startup founders"
            styles={styles}
          />
          <Field
            label="Goal"
            value={goal}
            onChangeText={setGoal}
            placeholder="e.g. drive signups"
            styles={styles}
          />
        </View>

        <View style={styles.pickerBlock}>
          <Text style={styles.sectionTitle}>Source type</Text>
          <View style={styles.chipWrap}>
            {sourceTypes.map((item) => (
              <SelectableChip
                key={item}
                label={capitalize(item)}
                selected={sourceType === item}
                onPress={() => setSourceType(item)}
                styles={styles}
              />
            ))}
          </View>
        </View>

        <View style={styles.pickerBlock}>
          <Text style={styles.sectionTitle}>Tone</Text>
          <View style={styles.chipWrap}>
            {toneOptions.map((item) => (
              <SelectableChip
                key={item}
                label={capitalize(item)}
                selected={tone === item}
                onPress={() => setTone(item)}
                styles={styles}
              />
            ))}
          </View>
        </View>

        <View style={styles.pickerBlock}>
          <Text style={styles.sectionTitle}>Platforms</Text>
          <Text style={styles.sectionHint}>Select one or more outputs to generate.</Text>
          <View style={styles.chipWrap}>
            {platformOptions.map((item) => (
              <SelectableChip
                key={item}
                label={platformLabel(item)}
                selected={selectedPlatforms.includes(item)}
                onPress={() => togglePlatform(item)}
                styles={styles}
              />
            ))}
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={() => void handleRepurpose()}
          disabled={loading}
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </Pressable>
      </View>

      {result ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.sectionTitle}>{result.repurpose.title}</Text>
              <Text style={styles.sectionHint}>{result.repurpose.summary}</Text>
            </View>
            <Pressable onPress={() => void handleShare(result)} style={styles.iconButton}>
              <Ionicons name="share-outline" color={colors.text} size={18} />
            </Pressable>
          </View>

          <View style={styles.callout}>
            <Text style={styles.calloutLabel}>Hook</Text>
            <Text style={styles.calloutText}>{result.repurpose.hook}</Text>
          </View>

          <View style={styles.listBlock}>
            <Text style={styles.sectionTitle}>Repurpose tips</Text>
            {result.repurpose.repurposeTips.map((item, index) => (
              <View key={`${item}-${index}`} style={styles.listRow}>
                <View style={styles.listBullet}>
                  <Ionicons name="sparkles-outline" color={colors.primary} size={12} />
                </View>
                <Text style={styles.listText}>{item}</Text>
              </View>
            ))}
          </View>

          {renderPlatformCard("X", result.repurpose.platformOutputs.x, styles, colors, handleShare, result)}
          {renderPlatformCard(
            "LinkedIn",
            result.repurpose.platformOutputs.linkedin,
            styles,
            colors,
            handleShare,
            result,
          )}
          {renderPlatformCard(
            "Instagram",
            result.repurpose.platformOutputs.instagram,
            styles,
            colors,
            handleShare,
            result,
          )}
          {renderPlatformCard("Email", result.repurpose.platformOutputs.email, styles, colors, handleShare, result)}
          {renderPlatformCard("Thread", result.repurpose.platformOutputs.thread, styles, colors, handleShare, result)}

          <View style={styles.saveState}>
            <Ionicons
              name={result.saved ? "checkmark-circle-outline" : "cloud-offline-outline"}
              color={result.saved ? colors.primary : colors.muted}
              size={18}
            />
            <Text style={styles.saveStateText}>
              {result.saved ? "Saved to your draft DB." : "Draft generated, but DB save was skipped."}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent drafts</Text>
            <Text style={styles.sectionHint}>
              {draftsLoading ? "Loading saved drafts..." : "Pulled from the DB-backed creator store."}
            </Text>
          </View>
          <Pressable onPress={() => void refreshDrafts(backendUrl)} style={styles.iconButton}>
            {draftsLoading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Ionicons name="refresh-outline" color={colors.text} size={18} />
            )}
          </Pressable>
        </View>

        {draftTrend.length ? (
          <View style={styles.chartCard}>
            <Text style={styles.sectionTitle}>Draft activity chart</Text>
            {draftTrend.map((item) => (
              <View key={item.date} style={styles.chartRow}>
                <Text style={styles.smallCopy}>{item.date.slice(5)}</Text>
                <View style={styles.chartTrack}>
                  <View style={[styles.chartFill, { width: `${Math.max(12, item.count * 24)}%` }]} />
                </View>
                <Text style={styles.smallCopy}>{item.count}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {drafts.length ? (
          drafts.slice(0, 5).map((item) => (
            <DraftCard key={item.id} draft={item} styles={styles} onEdit={() => startEditDraft(item)} />
          ))
        ) : (
          <Text style={styles.smallCopy}>No saved drafts yet. Generate one to store it in the DB.</Text>
        )}
      </View>

      </ScrollView>

      <Modal visible={Boolean(editingDraft)} transparent animationType="slide" onRequestClose={() => setEditingDraft(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropPress} onPress={() => setEditingDraft(null)} />
          <View style={styles.modalSheet}>
            <Text style={styles.sectionTitle}>Edit draft</Text>
            <Field
              label="Title"
              value={draftTitle}
              onChangeText={setDraftTitle}
              placeholder="Draft title"
              styles={styles}
            />
            <Field
              label="Summary"
              value={draftSummary}
              onChangeText={setDraftSummary}
              placeholder="Draft summary"
              styles={styles}
            />
            <Field
              label="Hook"
              value={draftHook}
              onChangeText={setDraftHook}
              placeholder="Draft hook"
              styles={styles}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setEditingDraft(null)}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primaryButton} onPress={() => void handleSaveDraftEdit()} disabled={savingDraft}>
                {savingDraft ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryButtonText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DraftCard({
  draft,
  styles,
  onEdit,
}: {
  draft: CreatorDraft;
  styles: ReturnType<typeof createStyles>;
  onEdit: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.draftCard}>
      <View style={styles.cardHeader}>
        <View style={styles.draftHeaderCopy}>
          <Text style={styles.draftTitle}>{draft.title}</Text>
          <Text style={styles.draftMeta}>
            {draft.sourceType} · {new Date(draft.createdAt).toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.draftBadge}>
          <Ionicons name="layers-outline" color={colors.primary} size={12} />
          <Text style={styles.draftBadgeText}>{draft.goal}</Text>
        </View>
      </View>
      <Text style={styles.smallCopy}>{draft.summary}</Text>
      <Text style={styles.draftHook}>{draft.hook}</Text>
      <Pressable style={styles.editButton} onPress={onEdit}>
        <Ionicons name="create-outline" color={colors.primary} size={14} />
        <Text style={styles.editButtonText}>Edit and save</Text>
      </Pressable>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function SelectableChip({
  label,
  selected,
  onPress,
  styles,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && {
          backgroundColor: colors.primarySoft,
          borderColor: colors.primary,
        },
      ]}
    >
      <Text style={[styles.chipText, selected && { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

function renderPlatformCard(
  label: string,
  value: any,
  styles: ReturnType<typeof createStyles>,
  colors: ReturnType<typeof useAppTheme>["colors"],
  onShare: (result: CreatorRepurposeResponse) => Promise<void>,
  result: CreatorRepurposeResponse,
) {
  if (!value) {
    return null;
  }

  let text = "";
  if (value.post) {
    text = value.post;
  } else if (value.caption) {
    text = value.caption;
  } else if (value.body) {
    text = value.body;
  } else if (value.headline && value.post) {
    text = `${value.headline}\n\n${value.post}`;
  } else if (Array.isArray(value.posts)) {
    text = [value.hook, ...value.posts].filter(Boolean).join("\n\n");
  }

  return (
    <View style={styles.platformCard}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.platformTitle}>{label}</Text>
          <Text style={styles.smallCopy}>
            {"thread" in value && value.thread ? `${value.thread.length} parts` : "Ready to post"}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            void onShare(result);
          }}
          style={styles.iconButton}
        >
          <Ionicons name="copy-outline" color={colors.text} size={18} />
        </Pressable>
      </View>
      <Text style={styles.platformText}>{text}</Text>
      {"hashtags" in value && value.hashtags?.length ? (
        <Text style={styles.smallCopy}>{value.hashtags.join(" ")}</Text>
      ) : null}
    </View>
  );
}

function platformLabel(value: (typeof platformOptions)[number]): string {
  if (value === "x") return "X";
  if (value === "linkedin") return "LinkedIn";
  if (value === "instagram") return "Instagram";
  if (value === "email") return "Email";
  return "Thread";
}

function buildShareText(result: CreatorRepurposeResponse): string {
  return [
    result.repurpose.title,
    result.repurpose.summary,
    result.repurpose.hook,
    ...Object.entries(result.repurpose.platformOutputs).map(([platform, value]) => {
      if (!value) return "";
      return `${platform.toUpperCase()}:\n${JSON.stringify(value, null, 2)}`;
    }),
  ]
    .filter(Boolean)
    .join("\n\n");
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      gap: 16,
      paddingBottom: spacing.xl,
      paddingHorizontal: 20,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    hero: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      paddingTop: spacing.sm,
    },
    heroIcon: {
      alignItems: "center",
      backgroundColor: colors.secondarySoft,
      borderColor: "rgba(124,58,237,0.34)",
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      height: 48,
      justifyContent: "center",
      shadowColor: colors.purple,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      width: 48,
    },
    heroCopy: {
      flex: 1,
      gap: 3,
    },
    title: {
      color: colors.text,
      fontSize: 23,
      fontWeight: "900",
      letterSpacing: -0.3,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
    stepper: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.sm,
    },
    stepperItem: {
      alignItems: "center",
      flex: 1,
      gap: 7,
    },
    stepperDot: {
      alignItems: "center",
      backgroundColor: "rgba(2,4,9,0.9)",
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 31,
      justifyContent: "center",
      width: 31,
    },
    stepperDotActive: {
      backgroundColor: colors.primaryDim,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
    },
    stepperDotText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "900",
    },
    stepperDotTextActive: {
      color: colors.primary,
    },
    stepperText: {
      color: colors.textMuted,
      fontSize: 10.5,
      fontWeight: "800",
      textAlign: "center",
    },
    stepperTextActive: {
      color: colors.primary,
    },
    card: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      padding: spacing.md,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
    sectionHint: {
      color: colors.textMuted,
      fontSize: 11.5,
      fontWeight: "600",
      lineHeight: 16,
      marginTop: 1,
    },
    sourceInput: {
      backgroundColor: "rgba(2,4,9,0.38)",
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
      minHeight: 158,
      padding: spacing.md,
    },
    characterCount: {
      alignSelf: "flex-end",
      color: colors.textMuted,
      fontSize: 10.5,
      fontWeight: "800",
      marginTop: -spacing.sm,
    },
    fieldRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    fieldBlock: {
      flex: 1,
      gap: 6,
    },
    fieldLabel: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.4,
    },
    fieldInput: {
      backgroundColor: "rgba(17,24,36,0.64)",
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.text,
      fontSize: 12.5,
      minHeight: 42,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    pickerBlock: {
      gap: 7,
    },
    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    chip: {
      backgroundColor: "rgba(17,24,36,0.7)",
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    chipText: {
      color: colors.textMuted,
      fontSize: 11.5,
      fontWeight: "900",
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: "rgba(0,255,198,0.08)",
      borderColor: colors.primary,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
    },
    primaryButtonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "900",
    },
    errorText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: "800",
    },
    cardHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "space-between",
    },
    iconButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    callout: {
      backgroundColor: "rgba(0,255,198,0.06)",
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.xs,
      padding: spacing.sm,
    },
    calloutLabel: {
      color: colors.primary,
      fontSize: 10.5,
      fontWeight: "900",
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    calloutText: {
      color: colors.text,
      fontSize: 12.5,
      lineHeight: 18,
    },
    listBlock: {
      gap: spacing.xs,
    },
    listRow: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    listBullet: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderRadius: radius.pill,
      height: 19,
      justifyContent: "center",
      marginTop: 1,
      width: 19,
    },
    listText: {
      color: colors.text,
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
    },
    platformCard: {
      backgroundColor: "rgba(17,24,36,0.68)",
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      padding: spacing.sm,
    },
    platformTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "900",
    },
    platformText: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 17,
    },
    saveState: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    saveStateText: {
      color: colors.textMuted,
      fontSize: 11.5,
      fontWeight: "700",
    },
    draftCard: {
      backgroundColor: "rgba(17,24,36,0.68)",
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.xs,
      padding: spacing.sm,
    },
    draftHeaderCopy: {
      flex: 1,
      gap: 2,
    },
    draftTitle: {
      color: colors.text,
      fontSize: 13.5,
      fontWeight: "900",
    },
    draftMeta: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
    },
    draftBadge: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderRadius: radius.pill,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
    },
    draftBadgeText: {
      color: colors.primary,
      fontSize: 10.5,
      fontWeight: "900",
    },
    draftHook: {
      color: colors.text,
      fontSize: 12,
      fontWeight: "700",
      lineHeight: 17,
    },
    smallCopy: {
      color: colors.textMuted,
      fontSize: 11.5,
      fontWeight: "600",
      lineHeight: 16,
    },
    chartCard: {
      backgroundColor: "rgba(2,4,9,0.35)",
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      padding: spacing.sm,
    },
    chartRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
    },
    chartTrack: {
      backgroundColor: colors.border,
      borderRadius: radius.pill,
      flex: 1,
      height: 6,
      overflow: "hidden",
    },
    chartFill: {
      backgroundColor: colors.primary,
      height: "100%",
    },
    editButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      borderColor: colors.primaryBorder,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.xs,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 6,
    },
    editButtonText: {
      color: colors.primary,
      fontSize: 11.5,
      fontWeight: "900",
    },
    modalBackdrop: {
      backgroundColor: "rgba(2,4,9,0.74)",
      flex: 1,
      justifyContent: "flex-end",
    },
    modalBackdropPress: {
      flex: 1,
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      gap: spacing.md,
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    modalActions: {
      flexDirection: "row",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing.md,
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
  });
}
