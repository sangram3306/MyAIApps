import { type ReactNode, useCallback, useMemo, useState, useEffect } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "./PremiumUI";
import { radius, spacing } from "../constants/theme";
import { defaultLlmPreference, LlmPreference, llmProviders } from "../constants/llm";
import { useAppTheme } from "../context/app-theme";
import { useAuth } from "../context/auth";
import {
  AppLockMode,
  DefaultTabId,
  ResponseCountPreference,
  clearAllLocalAppData,
  getAlwaysUseLlmChatPreference,
  getAppLockModePreference,
  getDefaultTabPreference,
  getLibraryAwareChatPreference,
  getLlmPreference,
  getRagEnabledPreference,
  getReplyResponseCountPreference,
  getRewriteResponseCountPreference,
  getSearchAutocompletePreference,
  getSmartContextEnabledPreference,
  getThemeModePreference,
  saveAlwaysUseLlmChatPreference,
  saveAppLockModePreference,
  saveDefaultTabPreference,
  saveLibraryAwareChatPreference,
  saveLlmPreference,
  saveRagEnabledPreference,
  saveReplyResponseCountPreference,
  saveRewriteResponseCountPreference,
  saveSearchAutocompletePreference,
  saveSmartContextEnabledPreference,
  saveThemeModePreference,
  getBackendUrl,
} from "../storage/appStorage";
import { deleteAccountFromApi } from "../services/api";

const defaultTabOptions: { label: string; value: DefaultTabId }[] = [
  { label: "Home", value: "home" },
  { label: "CineTrack", value: "movieTracker" },
  { label: "General Chat", value: "chat" },
  { label: "Expenses", value: "expenses" },
  { label: "Settings", value: "settings" },
];

const themeOptions = [
  { label: "System", value: "system" as const },
  { label: "Light", value: "light" as const },
  { label: "Dark", value: "dark" as const },
];

const appLockOptions: { label: string; value: AppLockMode }[] = [
  { label: "Off", value: "off" },
  { label: "Face ID", value: "faceId" },
  { label: "Fingerprint", value: "fingerprint" },
  { label: "Passcode", value: "passcode" },
];

const responseCountOptions: { label: string; value: `${ResponseCountPreference}` }[] = [
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
];

type DetailPanelId = "appearance" | "launch" | "writing" | "cinetrack" | "privacy" | "lock" | "searchBar" | null;

type RowTone = "primary" | "purple" | "danger";

export function SettingsContent({ onClose, defaultExpand }: { onClose?: () => void; defaultExpand?: DetailPanelId }) {
  const { colors, mode, resolvedTheme, setMode } = useAppTheme();
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);
  const [llmPreference, setLlmPreference] = useState<LlmPreference>(defaultLlmPreference);
  const [defaultTab, setDefaultTab] = useState<DefaultTabId>("home");
  const [appLockMode, setAppLockMode] = useState<AppLockMode>("off");
  const [replyResponseCount, setReplyResponseCount] = useState<`${ResponseCountPreference}`>("5");
  const [rewriteResponseCount, setRewriteResponseCount] = useState<`${ResponseCountPreference}`>("5");
  const [expandedPanel, setExpandedPanel] = useState<DetailPanelId>(defaultExpand || null);

  useEffect(() => {
    if (defaultExpand) {
      setExpandedPanel(defaultExpand);
    }
  }, [defaultExpand]);
  const [clearingData, setClearingData] = useState(false);
  const [searchAutocompleteEnabled, setSearchAutocompleteEnabled] = useState(true);
  // CineTrack preferences
  const [libraryAwareChat, setLibraryAwareChat] = useState(true);
  const [alwaysUseLlmChat, setAlwaysUseLlmChat] = useState(false);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [smartContextEnabled, setSmartContextEnabled] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const selectedProvider = llmProviders.find((provider) => provider.id === llmPreference.provider) || llmProviders[0];
  const selectedModel = selectedProvider.models.find((model) => model.value === llmPreference.model);

  useEffect(() => {
    Promise.all([
      getThemeModePreference(),
      getLlmPreference(),
      getDefaultTabPreference(),
      getAppLockModePreference(),
      getSearchAutocompletePreference(),
      getReplyResponseCountPreference(),
      getRewriteResponseCountPreference(),
      getLibraryAwareChatPreference(),
      getAlwaysUseLlmChatPreference(),
      getRagEnabledPreference(),
      getSmartContextEnabledPreference(),
    ]).then(([, llm, tab, lockMode, searchAuto, replyCount, rewriteCount, libAware, alwaysLlm, rag, smartCtx]) => {
      setLlmPreference(llm);
      setDefaultTab(tab);
      setAppLockMode(lockMode);
      setSearchAutocompleteEnabled(searchAuto);
      setReplyResponseCount(String(replyCount) as `${ResponseCountPreference}`);
      setRewriteResponseCount(String(rewriteCount) as `${ResponseCountPreference}`);
      setLibraryAwareChat(libAware);
      setAlwaysUseLlmChat(alwaysLlm);
      setRagEnabled(rag);
      setSmartContextEnabled(smartCtx);
    });

    return () => setExpandedPanel(null);
  }, []);

  function handleSearchAutocompleteChange(value: boolean) {
    setSearchAutocompleteEnabled(value);
    void saveSearchAutocompletePreference(value);
  }

  async function handleThemeChange(nextMode: "system" | "light" | "dark") {
    await setMode(nextMode);
  }

  async function handleDefaultTabChange(nextTab: DefaultTabId) {
    setDefaultTab(nextTab);
    await saveDefaultTabPreference(nextTab);
  }

  async function handleAppLockChange(nextMode: AppLockMode) {
    if (nextMode !== "off") {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Authenticate to enable App Lock",
          fallbackLabel: "Use Passcode",
          cancelLabel: "Cancel",
        });
        if (!result.success) {
          // If they cancel or fail, don't change the setting
          return;
        }
      } catch (e) {
        console.warn("Auth error when enabling lock:", e);
        Alert.alert("Error", "Could not enable app lock. Please ensure your device supports it.");
        return;
      }
    }
    setAppLockMode(nextMode);
    await saveAppLockModePreference(nextMode);
  }

  async function handleReplyResponseCountChange(nextValue: `${ResponseCountPreference}`) {
    setReplyResponseCount(nextValue);
    await saveReplyResponseCountPreference(Number(nextValue));
  }

  async function handleRewriteResponseCountChange(nextValue: `${ResponseCountPreference}`) {
    setRewriteResponseCount(nextValue);
    await saveRewriteResponseCountPreference(Number(nextValue));
  }

  async function handleClearAllData() {
    setClearingData(true);
    try {
      await clearAllLocalAppData();
      setLlmPreference(defaultLlmPreference);
      setDefaultTab("home");
      setAppLockMode("off");
      setReplyResponseCount("5");
      setRewriteResponseCount("5");
      setLibraryAwareChat(true);
      setAlwaysUseLlmChat(false);
      setRagEnabled(false);
      setSmartContextEnabled(false);
      await setMode("system");
      Alert.alert("Data cleared", "Local SP ONE data has been cleared.");
    } catch (error) {
      Alert.alert("Clear failed", error instanceof Error ? error.message : "Could not clear local data.");
    } finally {
      setClearingData(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              const url = await getBackendUrl();
              if (!url) throw new Error("Backend URL is not configured.");
              await deleteAccountFromApi({ backendUrl: url });
              Alert.alert("Account Deleted", "Your account has been permanently deleted.");
              await clearAllLocalAppData();
              signOut();
            } catch (error) {
              Alert.alert("Deletion failed", error instanceof Error ? error.message : "Could not delete account.");
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  }

  function handleLibraryAwareChatChange(value: boolean) {
    setLibraryAwareChat(value);
    void saveLibraryAwareChatPreference(value);
  }

  function handleAlwaysUseLlmChatChange(value: boolean) {
    setAlwaysUseLlmChat(value);
    void saveAlwaysUseLlmChatPreference(value);
    if (value) {
      setRagEnabled(false);
      void saveRagEnabledPreference(false);
      setSmartContextEnabled(false);
      void saveSmartContextEnabledPreference(false);
    }
  }

  function handleRagEnabledChange(value: boolean) {
    setRagEnabled(value);
    void saveRagEnabledPreference(value);
    if (value) {
      setAlwaysUseLlmChat(false);
      void saveAlwaysUseLlmChatPreference(false);
      setSmartContextEnabled(false);
      void saveSmartContextEnabledPreference(false);
    }
  }

  function handleSmartContextEnabledChange(value: boolean) {
    setSmartContextEnabled(value);
    void saveSmartContextEnabledPreference(value);
    if (value) {
      setAlwaysUseLlmChat(false);
      void saveAlwaysUseLlmChatPreference(false);
      setRagEnabled(false);
      void saveRagEnabledPreference(false);
    }
  }

  function togglePanel(panel: Exclude<DetailPanelId, null>) {
    setExpandedPanel((current) => (current === panel ? null : panel));
  }

  return (
    <View style={styles.screen}>
      <MatrixBackground density={10} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Manage your preferences</Text>
          </View>
          <Pressable onPress={() => { if (onClose) onClose(); else router.back(); }} style={styles.closeButton}>
            <Ionicons name="close" color={colors.textMuted} size={17} />
          </Pressable>
        </View>

        <SettingsGroup title="General" styles={styles}>
          <SettingRow
            icon="contrast-outline"
            title="Appearance"
            subtitle={`${capitalize(resolvedTheme)} mode`}
            active={expandedPanel === "appearance"}
            onPress={() => togglePanel("appearance")}
            styles={styles}
          />
          {expandedPanel === "appearance" ? (
            <DetailCard styles={styles}>
              <SegmentedControl options={themeOptions} value={mode} onChange={handleThemeChange} styles={styles} />
            </DetailCard>
          ) : null}

          <SettingRow
            icon="phone-portrait-outline"
            title="Launch Screen"
            subtitle={formatDefaultTab(defaultTab)}
            active={expandedPanel === "launch"}
            onPress={() => togglePanel("launch")}
            styles={styles}
          />
          {expandedPanel === "launch" ? (
            <DetailCard styles={styles}>
              <SegmentedControl options={defaultTabOptions} value={defaultTab} onChange={handleDefaultTabChange} styles={styles} />
            </DetailCard>
          ) : null}

          <SettingRow
            icon="search-outline"
            title="Search Bar"
            subtitle={searchAutocompleteEnabled ? "Suggestions ON" : "Suggestions OFF"}
            active={expandedPanel === "searchBar"}
            onPress={() => togglePanel("searchBar")}
            styles={styles}
          />
          {expandedPanel === "searchBar" ? (
            <DetailCard styles={styles}>
              <SwitchRow
                icon="options-outline"
                title="Autocomplete Suggestions"
                subtitle="Show tool and setting suggestions while typing"
                value={searchAutocompleteEnabled}
                onValueChange={handleSearchAutocompleteChange}
                styles={styles}
              />
            </DetailCard>
          ) : null}
        </SettingsGroup>

        <SettingsGroup title="AI" styles={styles}>
          <SettingRow
            icon="hardware-chip-outline"
            title="Model Provider"
            subtitle={`${selectedProvider.label} · ${selectedModel?.label || llmPreference.model}`}
            onPress={() => router.push("/llm-provider" as never)}
            styles={styles}
          />
          <SettingRow
            icon="create-outline"
            title="Writing Output"
            subtitle={`Reply ${replyResponseCount}, rewrite ${rewriteResponseCount}, grammar 1`}
            active={expandedPanel === "writing"}
            onPress={() => togglePanel("writing")}
            styles={styles}
          />
          {expandedPanel === "writing" ? (
            <DetailCard styles={styles}>
              <Text style={styles.detailLabel}>Reply count</Text>
              <SegmentedControl
                options={responseCountOptions}
                value={replyResponseCount}
                onChange={handleReplyResponseCountChange}
                styles={styles}
              />
              <Text style={styles.detailLabel}>Rewrite count</Text>
              <SegmentedControl
                options={responseCountOptions}
                value={rewriteResponseCount}
                onChange={handleRewriteResponseCountChange}
                styles={styles}
              />
              <Text style={styles.detailText}>Grammar always returns one corrected version.</Text>
            </DetailCard>
          ) : null}

          <SettingRow
            icon="film-outline"
            title="CineTrack"
            subtitle={`Library-aware ${libraryAwareChat ? "ON" : "OFF"} · Mode: ${ragEnabled ? "RAG" : smartContextEnabled ? "Smart Context" : alwaysUseLlmChat ? "LLM Always" : "Smart Default"}`}
            active={expandedPanel === "cinetrack"}
            onPress={() => togglePanel("cinetrack")}
            styles={styles}
          />
          {expandedPanel === "cinetrack" ? (
            <DetailCard styles={styles}>
              <SwitchRow
                icon="library-outline"
                title="Library-aware AI"
                subtitle="Use saved titles as context in CineTrack AI chat"
                value={libraryAwareChat}
                onValueChange={handleLibraryAwareChatChange}
                styles={styles}
              />
              <SwitchRow
                icon="sparkles-outline"
                title="Always use LLM"
                subtitle="Send full library to LLM for every query"
                value={alwaysUseLlmChat}
                onValueChange={handleAlwaysUseLlmChatChange}
                styles={styles}
              />
              <SwitchRow
                icon="search-outline"
                title="RAG Search"
                subtitle="Use vector embeddings to find top 10 relevant titles"
                value={ragEnabled}
                onValueChange={handleRagEnabledChange}
                styles={styles}
              />
              <SwitchRow
                icon="flash-outline"
                title="Smart Context"
                subtitle="Send taste summary + fast keyword filtering"
                value={smartContextEnabled}
                onValueChange={handleSmartContextEnabledChange}
                styles={styles}
              />
            </DetailCard>
          ) : null}
        </SettingsGroup>

        <SettingsGroup title="Security" styles={styles}>
          <SettingRow
            icon="lock-closed-outline"
            title="App Lock"
            subtitle={formatAppLockMode(appLockMode)}
            active={expandedPanel === "lock"}
            onPress={() => togglePanel("lock")}
            styles={styles}
          />
          {expandedPanel === "lock" ? (
            <DetailCard styles={styles}>
              <SegmentedControl options={appLockOptions} value={appLockMode} onChange={handleAppLockChange} styles={styles} />
            </DetailCard>
          ) : null}
        </SettingsGroup>

        <SettingsGroup title="Data" styles={styles}>
          <SettingRow
            icon="trash-outline"
            title={clearingData ? "Clearing Local Data" : "Clear Local Data"}
            subtitle="Free up storage"
            tone="danger"
            onPress={handleClearAllData}
            styles={styles}
          />
          <SettingRow
            icon="alert-circle-outline"
            title={isDeletingAccount ? "Deleting Account..." : "Delete Account"}
            subtitle="Permanently delete your account"
            tone="danger"
            onPress={isDeletingAccount ? () => {} : handleDeleteAccount}
            styles={styles}
          />
          <SettingRow
            icon="log-out-outline"
            title="Sign Out"
            subtitle="Sign out of SP ONE"
            tone="danger"
            onPress={signOut}
            styles={styles}
          />
        </SettingsGroup>
      </ScrollView>
    </View>
  );
}

function SettingsGroup({ title, children, styles }: { title: string; children: ReactNode; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.groupWrap}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  active = false,
  tone = "primary",
  onPress,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  active?: boolean;
  tone?: RowTone;
  onPress: () => void | Promise<void>;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  const iconColor = tone === "danger" ? colors.danger : tone === "purple" ? colors.purple : colors.primary;
  return (
    <Pressable onPress={() => void onPress()} style={[styles.row, active && styles.rowActive]}>
      <View style={[styles.rowIcon, tone === "danger" && styles.rowIconDanger, tone === "purple" && styles.rowIconPurple]}>
        <Ionicons name={icon} color={iconColor} size={17} />
      </View>
      <View style={styles.rowCopyWrap}>
        <Text style={[styles.rowTitle, tone === "danger" && styles.rowTitleDanger]} numberOfLines={1}>{title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" color={tone === "danger" ? colors.danger : colors.primaryBorder} size={17} />
    </Pressable>
  );
}

function DetailCard({ children, styles }: { children: ReactNode; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.detailCard}>{children}</View>;
}

function SwitchRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.switchRow}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} color={colors.primary} size={17} />
      </View>
      <View style={styles.rowCopyWrap}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primaryDim }}
        thumbColor={value ? colors.primary : colors.textMuted}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  styles,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void | Promise<void>;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.segmentRow}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => void onChange(option.value)}
            style={[styles.segmentPill, selected && styles.segmentPillSelected]}
          >
            <Text style={[styles.segmentText, selected && { color: colors.primary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function formatDefaultTab(value: DefaultTabId): string {
  return defaultTabOptions.find((option) => option.value === value)?.label || "Home";
}

function formatAppLockMode(value: AppLockMode): string {
  if (value === "faceId") return "Face ID";
  if (value === "fingerprint") return "Fingerprint";
  if (value === "passcode") return "Passcode";
  return "Off";
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      paddingBottom: spacing.xl,
      gap: 15,
      paddingHorizontal: 20,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    closeButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    groupWrap: {
      gap: 7,
    },
    groupTitle: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    groupCard: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: "hidden",
    },
    row: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 52,
      paddingHorizontal: spacing.sm,
      paddingVertical: 8,
    },
    rowActive: {
      backgroundColor: colors.primaryDim,
    },
    rowIcon: {
      alignItems: "center",
      backgroundColor: "rgba(0,255,198,0.07)",
      borderColor: colors.border,
      borderRadius: radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
      height: 31,
      justifyContent: "center",
      width: 31,
    },
    rowIconPurple: {
      backgroundColor: "rgba(124,58,237,0.10)",
    },
    rowIconDanger: {
      backgroundColor: colors.dangerSoft,
    },
    rowCopyWrap: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "900",
    },
    rowTitleDanger: {
      color: colors.danger,
    },
    rowSubtitle: {
      color: colors.textMuted,
      fontSize: 10.5,
      fontWeight: "600",
      lineHeight: 14,
    },
    detailCard: {
      backgroundColor: "rgba(2,4,9,0.54)",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.sm,
    },
    detailLabel: {
      color: colors.textMuted,
      fontSize: 10.5,
      fontWeight: "900",
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    detailText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
      lineHeight: 16,
    },
    segmentRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    segmentPill: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    segmentPillSelected: {
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
    },
    segmentText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
    },
    inlineButton: {
      alignItems: "center",
      alignSelf: "flex-start",
      borderColor: colors.primaryBorder,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    inlineButtonText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: "900",
    },
    switchRow: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 58,
      paddingHorizontal: spacing.sm,
      paddingVertical: 10,
    },
  });
}
