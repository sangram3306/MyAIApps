import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { BrandLogo, brandFont } from "../../components/BrandLogo";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import {
  buildLocalExportPayload,
  getBackendUrl,
  getDefaultTabPreference,
  getQuickActionsPreference,
  saveDefaultTabPreference,
  saveQuickActionsPreference,
  DefaultTabId,
} from "../../storage/appStorage";
import { defaultLlmPreference, LlmPreference, llmProviders } from "../../constants/llm";
import { getLlmPreference } from "../../storage/appStorage";

const defaultTabOptions: Array<{ label: string; value: DefaultTabId }> = [
  { label: "Home", value: "home" },
  { label: "Coach", value: "coach" },
  { label: "Chat", value: "chat" },
  { label: "Expenses", value: "expenses" },
  { label: "Settings", value: "settings" },
];

export default function SettingsScreen() {
  const { colors, mode, resolvedTheme, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [llmPreference, setLlmPreference] = useState<LlmPreference>(defaultLlmPreference);
  const [quickActionsEnabled, setQuickActionsEnabled] = useState(true);
  const [defaultTab, setDefaultTab] = useState<DefaultTabId>("home");
  const [backendUrl, setBackendUrl] = useState("");
  const [exporting, setExporting] = useState(false);

  const selectedProvider =
    llmProviders.find((provider) => provider.id === llmPreference.provider) || llmProviders[0];
  const selectedModel = selectedProvider.models.find((model) => model.value === llmPreference.model);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        getLlmPreference(),
        getDefaultTabPreference(),
        getQuickActionsPreference(),
        getBackendUrl(),
      ]).then(([llm, tab, quickActions, url]) => {
        setLlmPreference(llm);
        setQuickActionsEnabled(quickActions);
        setDefaultTab(tab);
        setBackendUrl(url);
      });
    }, []),
  );

  async function handleThemeChange(nextMode: "system" | "light" | "dark") {
    await setMode(nextMode);
  }

  async function handleQuickActionsChange(nextValue: boolean) {
    setQuickActionsEnabled(nextValue);
    await saveQuickActionsPreference(nextValue);
  }

  async function handleDefaultTabChange(nextTab: DefaultTabId) {
    setDefaultTab(nextTab);
    await saveDefaultTabPreference(nextTab);
  }

  async function handleExportData() {
    setExporting(true);
    try {
      const localExport = await buildLocalExportPayload();

      let backendExport: unknown = null;
      if (backendUrl) {
        try {
          const response = await fetch(`${backendUrl}/api/expenses/export`);
          backendExport = await response.json();
        } catch {
          backendExport = { error: "Expense export unavailable right now." };
        }
      }

      const payload = {
        exportedAt: new Date().toISOString(),
        local: localExport,
        backend: {
          expenses: backendExport,
        },
      };

      await Share.share({
        title: "ReplyMate AI export",
        message: JSON.stringify(payload, null, 2),
      });
    } catch (error) {
      Alert.alert("Export failed", error instanceof Error ? error.message : "Could not export data.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Control room</Text>
        <View style={styles.titleRow}>
          <BrandLogo compact />
          <Text style={styles.title}>Settings</Text>
        </View>
        <Text style={styles.subtitle}>
          Tune the app’s reply flow, coach behavior, privacy, expense tools, data, and appearance.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusText}>
          <Text style={styles.cardTitle}>AI backend online</Text>
          <Text style={styles.cardCopy}>
            Messages are generated through the secure cloud backend. Provider API keys are never
            stored in the app.
          </Text>
        </View>
      </View>

      <Section title="Reply" styles={styles}>
        <SettingToggle
          icon="flash-outline"
          title="Quick actions on home screen"
          copy="Show shortcut chips for mode switches and fast navigation on the home tab."
          value={quickActionsEnabled}
          onValueChange={handleQuickActionsChange}
          styles={styles}
        />
      </Section>

      <Section title="Coach" styles={styles}>
        <SettingLink
          icon="sparkles-outline"
          title="Open coach"
          copy="Jump directly to the coach tab for message analysis."
          onPress={() => router.push("/coach" as never)}
          styles={styles}
        />
      </Section>

      <Section title="Privacy" styles={styles}>
        <InfoTile
          title="Private by design"
          copy="Secrets stay on the backend and local data stays on-device."
          styles={styles}
        />
      </Section>

      <Section title="Expenses" styles={styles}>
        <SettingLink
          icon="wallet-outline"
          title="Open expenses"
          copy="Go straight to the expense tracker and AI insights."
          onPress={() => router.push("/expenses" as never)}
          styles={styles}
        />
      </Section>

      <Section title="Data" styles={styles}>
        <SettingButton
          icon="download-outline"
          title={exporting ? "Exporting..." : "Export data"}
          copy="Share history, favorites, settings, and backend expense data as JSON."
          onPress={handleExportData}
          disabled={exporting}
          styles={styles}
        />
      </Section>

      <Section title="Appearance" styles={styles}>
        <SettingSegment
          title="Theme"
          copy="Choose how the app should follow your device and color preference."
          options={[
            { label: "System", value: "system" as const },
            { label: "Light", value: "light" as const },
            { label: "Dark", value: "dark" as const },
          ]}
          value={mode}
          onChange={handleThemeChange}
          styles={styles}
        />

        <SettingSegment
          title="Default tab on launch"
          copy="Pick which tab opens first when the app starts."
          options={defaultTabOptions}
          value={defaultTab}
          onChange={handleDefaultTabChange}
          styles={styles}
        />
      </Section>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>LLM Provider</Text>
        <SettingLink
          icon="hardware-chip-outline"
          title="Provider settings"
          copy={`${selectedProvider.label} · ${selectedModel?.label || llmPreference.model}`}
          onPress={() => router.push("/llm-provider" as never)}
          styles={styles}
        />
      </View>

      <View style={styles.grid}>
        <InfoTile title="History ready" copy="Recent generations are saved locally." styles={styles} />
        <InfoTile title="Favorites" copy="Keep your best replies one tap away." styles={styles} />
        <InfoTile
          title="Theme aware"
          copy={`Current appearance: ${resolvedTheme}.`}
          styles={styles}
        />
      </View>
    </ScrollView>
  );
}

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SettingLink({
  icon,
  title,
  copy,
  onPress,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={styles.linkCard}>
      <View style={styles.linkIcon}>
        <Ionicons name={icon} color={colors.primary} size={22} />
      </View>
      <View style={styles.linkText}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkCopy}>{copy}</Text>
      </View>
      <Ionicons name="chevron-forward" color={colors.muted} size={20} />
    </Pressable>
  );
}

function SettingButton({
  icon,
  title,
  copy,
  onPress,
  disabled,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.linkCard, disabled && styles.linkCardDisabled]}
    >
      <View style={styles.linkIcon}>
        <Ionicons name={icon} color={colors.primary} size={22} />
      </View>
      <View style={styles.linkText}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkCopy}>{copy}</Text>
      </View>
      <Ionicons name="chevron-forward" color={colors.muted} size={20} />
    </Pressable>
  );
}

function SettingToggle({
  icon,
  title,
  copy,
  value,
  onValueChange,
  styles,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.toggleCard}>
      <View style={styles.linkIcon}>
        <Ionicons name={icon} color={colors.primary} size={22} />
      </View>
      <View style={styles.linkText}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkCopy}>{copy}</Text>
      </View>
      <Switch
        trackColor={{ false: colors.border, true: colors.primarySoft }}
        thumbColor={value ? colors.primary : colors.surface}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function SettingSegment<T extends string>({
  title,
  copy,
  options,
  value,
  onChange,
  styles,
}: {
  title: string;
  copy: string;
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void | Promise<void>;
  styles: ReturnType<typeof createStyles>;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.segmentCard}>
      <View style={styles.segmentHeader}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkCopy}>{copy}</Text>
      </View>
      <View style={styles.segmentRow}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => void onChange(option.value)}
              style={[styles.segmentPill, selected && styles.segmentPillSelected]}
            >
              <Text style={[styles.segmentText, selected && { color: colors.primary }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function InfoTile({
  title,
  copy,
  styles,
}: {
  title: string;
  copy: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileCopy}>{copy}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      backgroundColor: colors.background,
      flexGrow: 1,
      gap: spacing.lg,
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    header: {
      gap: spacing.sm,
      paddingTop: spacing.sm,
    },
    titleRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
    },
    eyebrow: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    title: {
      color: colors.text,
      fontFamily: brandFont,
      fontSize: 34,
      fontWeight: "900",
    },
    subtitle: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 22,
    },
    statusCard: {
      alignItems: "flex-start",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.borderStrong,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.lg,
      shadowColor: colors.primary,
      shadowOpacity: 0.22,
      shadowRadius: 24,
    },
    statusText: {
      flex: 1,
      gap: spacing.xs,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    cardCopy: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21,
    },
    grid: {
      gap: spacing.md,
    },
    section: {
      gap: spacing.sm,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "900",
    },
    linkCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
    },
    linkCardDisabled: {
      opacity: 0.65,
    },
    toggleCard: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
    },
    linkIcon: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      borderWidth: 1,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    linkText: {
      flex: 1,
      gap: 3,
    },
    linkTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    linkCopy: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    segmentCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    segmentHeader: {
      gap: 3,
    },
    segmentRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    segmentPill: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    segmentPillSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    segmentText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "800",
    },
    tile: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    tileTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    tileCopy: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
  });
}
