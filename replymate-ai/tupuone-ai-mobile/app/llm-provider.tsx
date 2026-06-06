import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { defaultLlmPreference, llmProviders } from "../constants/llm";
import type { LlmPreference, LlmProviderOption } from "../constants/llm";
import { getBackendUrl, getLlmPreference, saveLlmPreference } from "../storage/appStorage";
import { DeepSeekBalanceResponse, getDeepSeekBalanceFromApi, getLlmOptionsFromApi } from "../services/api";

export default function LlmProviderScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fallbackProviders = useMemo(
    () =>
      llmProviders.map((provider) =>
        provider.id === "openrouter" ? { ...provider, enabled: false } : provider,
      ),
    [],
  );
  const [llmPreference, setLlmPreference] = useState<LlmPreference>(defaultLlmPreference);
  const [backendUrl, setBackendUrl] = useState("");
  const [providerOptions, setProviderOptions] = useState<LlmProviderOption[]>(fallbackProviders);
  const [usage, setUsage] = useState<DeepSeekBalanceResponse | null>(null);
  const [usageError, setUsageError] = useState("");
  const [usageLoading, setUsageLoading] = useState(false);
  const selectedProvider =
    providerOptions.find((provider) => provider.id === llmPreference.provider) || providerOptions[0];
  const selectedModel = selectedProvider?.models.find((model) => model.value === llmPreference.model);
  const reasoningSupported = Boolean(selectedModel?.reasoningSupported);

  useFocusEffect(
    useCallback(() => {
      getLlmPreference().then(setLlmPreference);
      getBackendUrl().then(setBackendUrl);
    }, []),
  );

  const loadDeepSeekUsage = useCallback(async () => {
    if (!backendUrl || llmPreference.provider !== "deepseek") {
      return;
    }

    setUsageLoading(true);
    setUsageError("");
    try {
      const response = await getDeepSeekBalanceFromApi({ backendUrl });
      setUsage(response);
    } catch (error) {
      setUsage(null);
      setUsageError(error instanceof Error ? error.message : "Could not fetch DeepSeek usage.");
    } finally {
      setUsageLoading(false);
    }
  }, [backendUrl, llmPreference.provider]);

  useFocusEffect(
    useCallback(() => {
      void loadDeepSeekUsage();
    }, [loadDeepSeekUsage]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        if (!backendUrl) {
          return;
        }

        try {
          const response = await getLlmOptionsFromApi({ backendUrl });
          if (active && Array.isArray(response.providers) && response.providers.length > 0) {
            setProviderOptions(response.providers);
          }
        } catch {
          if (active) {
            setProviderOptions(fallbackProviders);
          }
        }
      })();

      return () => {
        active = false;
      };
    }, [backendUrl, fallbackProviders]),
  );

  async function handleProviderChange(providerId: LlmPreference["provider"]) {
    const provider = providerOptions.find((item) => item.id === providerId);
    if (!provider?.enabled || !provider.models[0]) {
      return;
    }

    const nextPreference = {
      provider: provider.id,
      model: provider.models[0].value,
      reasoningEnabled: false,
    };
    setLlmPreference(nextPreference);
    await saveLlmPreference(nextPreference);
    if (nextPreference.provider !== "deepseek") {
      setUsage(null);
      setUsageError("");
    }
  }

  async function handleModelChange(model: string) {
    const nextModel = selectedProvider?.models.find((item) => item.value === model);
    const nextPreference = {
      ...llmPreference,
      model,
      reasoningEnabled: Boolean(nextModel?.reasoningSupported && llmPreference.reasoningEnabled),
    };
    setLlmPreference(nextPreference);
    await saveLlmPreference(nextPreference);
  }

  async function handleReasoningChange(enabled: boolean) {
    if (!reasoningSupported) {
      return;
    }

    const nextPreference = {
      ...llmPreference,
      reasoningEnabled: enabled,
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
          {selectedProvider.id === "openrouter" && selectedModel ? (
            <View style={styles.reasoningRow}>
              <View style={styles.reasoningText}>
                <Text style={styles.modelLabel}>Reasoning</Text>
                <Text style={styles.reasoningCopy}>
                  {reasoningSupported
                    ? "Use reasoning-capable output for this model."
                    : "This model does not expose reasoning support."}
                </Text>
              </View>
              <Switch
                disabled={!reasoningSupported}
                value={Boolean(llmPreference.reasoningEnabled && reasoningSupported)}
                onValueChange={handleReasoningChange}
                trackColor={{ false: colors.border, true: colors.primarySoft }}
                thumbColor={llmPreference.reasoningEnabled ? colors.primary : colors.muted}
              />
            </View>
          ) : null}
        </View>
      </View>

      {llmPreference.provider === "deepseek" ? (
        <View style={styles.usageCard}>
          <View style={styles.usageHeader}>
            <View>
              <Text style={styles.modelLabel}>DeepSeek Usage</Text>
              <Text style={styles.usageStatus}>
                {usage?.isAvailable ? "Balance API available" : "Balance status"}
              </Text>
            </View>
            <Pressable onPress={loadDeepSeekUsage} disabled={usageLoading} style={styles.refreshButton}>
              {usageLoading ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons name="refresh" color={colors.primary} size={18} />
              )}
            </Pressable>
          </View>

          {usageError ? <Text style={styles.usageError}>{usageError}</Text> : null}

          {usage?.balances.length ? (
            <View style={styles.balanceList}>
              {usage.balances.map((balance, index) => (
                <View key={`${balance.currency}-${index}`} style={styles.balanceRow}>
                  <Text style={styles.balanceCurrency}>{balance.currency}</Text>
                  <View style={styles.balanceText}>
                    <Text style={styles.balanceTotal}>Total: {balance.totalBalance}</Text>
                    <Text style={styles.balanceMeta}>
                      Granted {balance.grantedBalance} · Top-up {balance.toppedUpBalance}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : !usageError && !usageLoading ? (
            <Text style={styles.usageCopy}>Tap refresh to load DeepSeek balance.</Text>
          ) : null}
        </View>
      ) : null}

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

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
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
      gap: spacing.xs,
      padding: spacing.md,
    },
    providerCardSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    providerCardDisabled: {
      opacity: 0.5,
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
      fontSize: 13,
      fontWeight: "700",
    },
    modelCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    modelLabel: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    modelValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    modelList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    reasoningRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      justifyContent: "space-between",
      marginTop: spacing.xs,
    },
    reasoningText: {
      flex: 1,
      gap: 4,
    },
    reasoningCopy: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    modelPill: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    modelPillSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    modelPillText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    modelPillTextSelected: {
      color: colors.primary,
    },
    usageCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    usageHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    refreshButton: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      borderWidth: 1,
      height: 42,
      justifyContent: "center",
      width: 42,
    },
    usageStatus: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "700",
    },
    usageError: {
      color: colors.danger,
      fontSize: 13,
      fontWeight: "700",
    },
    usageCopy: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 20,
    },
    balanceList: {
      gap: spacing.sm,
    },
    balanceRow: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
    },
    balanceCurrency: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "900",
      minWidth: 48,
    },
    balanceText: {
      flex: 1,
      gap: 4,
    },
    balanceTotal: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "800",
    },
    balanceMeta: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
    },
    noteCard: {
      alignItems: "flex-start",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.md,
      padding: spacing.md,
    },
    noteText: {
      flex: 1,
      gap: 4,
    },
    noteTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "900",
    },
    noteCopy: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
    },
  });
}
