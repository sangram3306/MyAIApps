import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { colors, spacing } from "../constants/theme";
import { defaultLlmPreference, LlmPreference, llmProviders } from "../constants/llm";
import { getLlmPreference, saveLlmPreference } from "../storage/appStorage";

export default function LlmProviderScreen() {
  const [llmPreference, setLlmPreference] = useState<LlmPreference>(defaultLlmPreference);
  const selectedProvider =
    llmProviders.find((provider) => provider.id === llmPreference.provider) || llmProviders[0];

  useFocusEffect(
    useCallback(() => {
      getLlmPreference().then(setLlmPreference);
    }, []),
  );

  async function handleProviderChange(providerId: LlmPreference["provider"]) {
    const provider = llmProviders.find((item) => item.id === providerId);
    if (!provider?.enabled || !provider.models[0]) {
      return;
    }

    const nextPreference = {
      provider: provider.id,
      model: provider.models[0].value,
    };
    setLlmPreference(nextPreference);
    await saveLlmPreference(nextPreference);
  }

  async function handleModelChange(model: string) {
    const nextPreference = {
      ...llmPreference,
      model,
    };
    setLlmPreference(nextPreference);
    await saveLlmPreference(nextPreference);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" color={colors.primary} size={22} />
        </Pressable>
        <Text style={styles.eyebrow}>Model Control</Text>
        <Text style={styles.title}>LLM Provider</Text>
        <Text style={styles.subtitle}>
          Choose which backend AI provider and model ReplyMate should use. API keys stay on the
          backend only.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Platform</Text>
        <View style={styles.providerGrid}>
          {llmProviders.map((provider) => {
            const selected = provider.id === llmPreference.provider;
            return (
              <Pressable
                key={provider.id}
                disabled={!provider.enabled}
                onPress={() => handleProviderChange(provider.id)}
                style={[
                  styles.providerCard,
                  selected && styles.providerCardSelected,
                  !provider.enabled && styles.providerCardDisabled,
                ]}
              >
                <View style={styles.providerTopRow}>
                  <Text style={[styles.providerName, selected && styles.providerNameSelected]}>
                    {provider.label}
                  </Text>
                  {selected ? <Ionicons name="checkmark-circle" color={colors.primary} size={18} /> : null}
                </View>
                <Text style={styles.providerStatus}>
                  {provider.enabled ? (selected ? "Active" : "Available") : "Coming soon"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Model</Text>
        <View style={styles.modelCard}>
          <Text style={styles.modelLabel}>Selected model</Text>
          <Text style={styles.modelValue}>{llmPreference.model}</Text>
          <View style={styles.modelList}>
            {selectedProvider.models.map((model) => {
              const selected = model.value === llmPreference.model;
              return (
                <Pressable
                  key={model.value}
                  onPress={() => handleModelChange(model.value)}
                  style={[styles.modelPill, selected && styles.modelPillSelected]}
                >
                  <Text style={[styles.modelPillText, selected && styles.modelPillTextSelected]}>
                    {model.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.noteCard}>
        <Ionicons name="shield-checkmark-outline" color={colors.primary} size={22} />
        <View style={styles.noteText}>
          <Text style={styles.noteTitle}>Keys stay private</Text>
          <Text style={styles.noteCopy}>
            This screen stores only provider and model names. Provider API keys must be configured
            in backend environment variables.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    gap: spacing.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  providerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  providerCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: "48%",
    flexGrow: 1,
    gap: 5,
    padding: spacing.md,
  },
  providerCardSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
  },
  providerCardDisabled: {
    opacity: 0.46,
  },
  providerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  providerName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  providerNameSelected: {
    color: colors.primary,
  },
  providerStatus: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modelCard: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  modelLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  modelValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  modelList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  modelPill: {
    backgroundColor: "rgba(69, 245, 198, 0.06)",
    borderColor: "rgba(69, 245, 198, 0.18)",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  modelPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modelPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  modelPillTextSelected: {
    color: "#07110D",
  },
  noteCard: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  noteText: {
    flex: 1,
    gap: 3,
  },
  noteTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  noteCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
});
