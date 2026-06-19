import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import {
  DefaultTabId,
  getAlwaysUseLlmChatPreference,
  getDefaultTabPreference,
  getLibraryAwareChatPreference,
  getLlmPreference,
  getOneHandedModePreference,
  getRagEnabledPreference,
  getSmartContextEnabledPreference,
  saveAlwaysUseLlmChatPreference,
  saveDefaultTabPreference,
  saveLibraryAwareChatPreference,
  saveOneHandedModePreference,
  saveRagEnabledPreference,
  saveSmartContextEnabledPreference,
} from "../../storage/appStorage";
import { llmProviders } from "../../constants/llm";

const themeOptions = [
  { label: "System", value: "system" as const },
  { label: "Light", value: "light" as const },
  { label: "Dark", value: "dark" as const },
];
const launchOptions: Array<{ label: string; value: DefaultTabId }> = [
  { label: "Library", value: "library" },
  { label: "Favorites", value: "favorites" },
  { label: "Add", value: "add" },
  { label: "AI", value: "ai" },
  { label: "Settings", value: "settings" },
];

export default function SettingsScreen() {
  const { colors, mode, resolvedTheme, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [providerLabel, setProviderLabel] = useState("Loading...");
  const [modelLabel, setModelLabel] = useState("");
  const [oneHandedMode, setOneHandedMode] = useState(false);
  const [libraryAwareChat, setLibraryAwareChat] = useState(true);
  const [alwaysUseLlmChat, setAlwaysUseLlmChat] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [smartContextEnabled, setSmartContextEnabled] = useState(false);
  const [defaultLaunchTab, setDefaultLaunchTab] = useState<DefaultTabId>("library");

  useFocusEffect(
    useCallback(() => {
      getLlmPreference().then((pref) => {
        const provider = llmProviders.find((item) => item.id === pref.provider) || llmProviders[0];
        const model = provider.models.find((item) => item.value === pref.model);
        setProviderLabel(provider.label);
        setModelLabel(model?.label || pref.model);
      });
      getOneHandedModePreference().then(setOneHandedMode);
      getLibraryAwareChatPreference().then(setLibraryAwareChat);
      getAlwaysUseLlmChatPreference().then(setAlwaysUseLlmChat);
      getRagEnabledPreference().then(setRagEnabled);
      getSmartContextEnabledPreference().then(setSmartContextEnabled);
      getDefaultTabPreference().then((tab) => {
        setDefaultLaunchTab(tab === "home" ? "library" : tab);
      });
    }, []),
  );

  function handleOneHandedModeChange(enabled: boolean) {
    setOneHandedMode(enabled);
    void saveOneHandedModePreference(enabled);
  }

  function handleDefaultLaunchTabChange(tab: DefaultTabId) {
    setDefaultLaunchTab(tab);
    void saveDefaultTabPreference(tab);
  }

  function handleLibraryAwareChatChange(enabled: boolean) {
    setLibraryAwareChat(enabled);
    void saveLibraryAwareChatPreference(enabled);
  }

  function handleAlwaysUseLlmChatChange(enabled: boolean) {
    setAlwaysUseLlmChat(enabled);
    void saveAlwaysUseLlmChatPreference(enabled);
    if (enabled) {
      setRagEnabled(false);
      void saveRagEnabledPreference(false);
      setSmartContextEnabled(false);
      void saveSmartContextEnabledPreference(false);
    }
  }

  function handleRagEnabledChange(enabled: boolean) {
    setRagEnabled(enabled);
    void saveRagEnabledPreference(enabled);
    if (enabled) {
      setAlwaysUseLlmChat(false);
      void saveAlwaysUseLlmChatPreference(false);
      setSmartContextEnabled(false);
      void saveSmartContextEnabledPreference(false);
    }
  }

  function handleSmartContextEnabledChange(enabled: boolean) {
    setSmartContextEnabled(enabled);
    void saveSmartContextEnabledPreference(enabled);
    if (enabled) {
      setAlwaysUseLlmChat(false);
      void saveAlwaysUseLlmChatPreference(false);
      setRagEnabled(false);
      void saveRagEnabledPreference(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.label}>LLM selector</Text>
        <Pressable style={styles.rowButton} onPress={() => router.push("/llm-provider" as never)}>
          <View style={styles.rowMain}>
            <Ionicons name="hardware-chip-outline" color={colors.primary} size={16} />
            <View>
              <Text style={styles.rowTitle}>{providerLabel}</Text>
              <Text style={styles.rowMeta}>{modelLabel}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" color={colors.muted} size={16} />
        </Pressable>

        <Text style={styles.label}>Theme</Text>
        <View style={styles.segmentRow}>
          {themeOptions.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => void setMode(option.value)}
              style={[
                styles.segmentButton,
                mode === option.value && styles.segmentButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === option.value && styles.segmentTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.helper}>Current: {resolvedTheme}</Text>

        <Text style={styles.label}>Default screen on launch</Text>
        <View style={styles.wrapRow}>
          {launchOptions.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => handleDefaultLaunchTabChange(option.value)}
              style={[styles.tagButton, defaultLaunchTab === option.value && styles.tagButtonActive]}
            >
              <Text style={[styles.tagText, defaultLaunchTab === option.value && styles.tagTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Reachability</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchMain}>
            <Ionicons name="phone-portrait-outline" color={colors.secondary} size={16} />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>One-handed mode</Text>
              <Text style={styles.rowMeta}>Move Library filters to the bottom.</Text>
            </View>
          </View>
          <View style={styles.switchWrap}>
            <Switch
              value={oneHandedMode}
              onValueChange={handleOneHandedModeChange}
              trackColor={{ false: colors.borderStrong, true: colors.secondarySoft }}
              thumbColor={oneHandedMode ? colors.secondary : colors.muted}
            />
          </View>
        </View>

        <Text style={styles.label}>AI chat</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchMain}>
            <Ionicons name="library-outline" color={colors.primary} size={16} />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Library-aware</Text>
              <Text style={styles.rowMeta}>Use your saved titles as context in AI chat.</Text>
            </View>
          </View>
          <View style={styles.switchWrap}>
            <Switch
              value={libraryAwareChat}
              onValueChange={handleLibraryAwareChatChange}
              trackColor={{ false: colors.borderStrong, true: colors.primarySoft }}
              thumbColor={libraryAwareChat ? colors.primary : colors.muted}
            />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchMain}>
            <Ionicons name="sparkles-outline" color={colors.primary} size={16} />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Always use LLM</Text>
              <Text style={styles.rowMeta}>Send full library to LLM for every query.</Text>
            </View>
          </View>
          <View style={styles.switchWrap}>
            <Switch
              value={alwaysUseLlmChat}
              onValueChange={handleAlwaysUseLlmChatChange}
              trackColor={{ false: colors.borderStrong, true: colors.primarySoft }}
              thumbColor={alwaysUseLlmChat ? colors.primary : colors.muted}
            />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchMain}>
            <Ionicons name="search-outline" color={colors.primary} size={16} />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>RAG Search</Text>
              <Text style={styles.rowMeta}>Use vector embeddings to find top 10 relevant titles.</Text>
            </View>
          </View>
          <View style={styles.switchWrap}>
            <Switch
              value={ragEnabled}
              onValueChange={handleRagEnabledChange}
              trackColor={{ false: colors.borderStrong, true: colors.primarySoft }}
              thumbColor={ragEnabled ? colors.primary : colors.muted}
            />
          </View>
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchMain}>
            <Ionicons name="flash-outline" color={colors.primary} size={16} />
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Smart Context</Text>
              <Text style={styles.rowMeta}>Send taste summary + fast keyword filtering.</Text>
            </View>
          </View>
          <View style={styles.switchWrap}>
            <Switch
              value={smartContextEnabled}
              onValueChange={handleSmartContextEnabledChange}
              trackColor={{ false: colors.borderStrong, true: colors.primarySoft }}
              thumbColor={smartContextEnabled ? colors.primary : colors.muted}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 18,
      padding: spacing.md,
      gap: spacing.sm,
    },
    title: { color: colors.text, fontSize: 24, fontWeight: "900" },
    label: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase",
      marginTop: spacing.xs,
    },
    rowButton: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 52,
      paddingHorizontal: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surfaceElevated,
    },
    rowMain: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    switchMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minWidth: 0 },
    rowCopy: { flex: 1, gap: 2, minWidth: 0 },
    rowTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
    rowMeta: { color: colors.muted, fontSize: 12 },
    switchWrap: { flexShrink: 0, alignItems: "flex-end" },
    switchRow: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      minHeight: 58,
      paddingHorizontal: spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
    },
    segmentRow: {
      flexDirection: "row",
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      overflow: "hidden",
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 10,
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
    },
    segmentButtonActive: {
      backgroundColor: colors.primarySoft,
    },
    segmentText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
    segmentTextActive: { color: colors.primary, fontWeight: "900" },
    wrapRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    tagButton: {
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 999,
      minHeight: 34,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceElevated,
    },
    tagButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    tagText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    tagTextActive: { color: colors.primary, fontWeight: "900" },
    helper: { color: colors.muted, fontSize: 12, textTransform: "capitalize" },
  });
}
