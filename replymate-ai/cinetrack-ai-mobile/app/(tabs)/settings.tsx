import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { getLlmPreference } from "../../storage/appStorage";
import { llmProviders } from "../../constants/llm";

const themeOptions = [
  { label: "System", value: "system" as const },
  { label: "Light", value: "light" as const },
  { label: "Dark", value: "dark" as const },
];

export default function SettingsScreen() {
  const { colors, mode, resolvedTheme, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [providerLabel, setProviderLabel] = useState("Loading...");
  const [modelLabel, setModelLabel] = useState("");

  useFocusEffect(
    useCallback(() => {
      getLlmPreference().then((pref) => {
        const provider = llmProviders.find((item) => item.id === pref.provider) || llmProviders[0];
        const model = provider.models.find((item) => item.value === pref.model);
        setProviderLabel(provider.label);
        setModelLabel(model?.label || pref.model);
      });
    }, []),
  );

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
    rowTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
    rowMeta: { color: colors.muted, fontSize: 12 },
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
    helper: { color: colors.muted, fontSize: 12, textTransform: "capitalize" },
  });
}

