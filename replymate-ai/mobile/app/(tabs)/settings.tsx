import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { BrandLogo, brandFont } from "../../components/BrandLogo";
import { colors, spacing } from "../../constants/theme";
import { defaultLlmPreference, LlmPreference, llmProviders } from "../../constants/llm";
import { getLlmPreference } from "../../storage/appStorage";

export default function SettingsScreen() {
  const [llmPreference, setLlmPreference] = useState<LlmPreference>(defaultLlmPreference);
  const selectedProvider =
    llmProviders.find((provider) => provider.id === llmPreference.provider) || llmProviders[0];
  const selectedModel = selectedProvider.models.find((model) => model.value === llmPreference.model);

  useFocusEffect(
    useCallback(() => {
      getLlmPreference().then(setLlmPreference);
    }, []),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Control room</Text>
        <View style={styles.titleRow}>
          <BrandLogo compact />
          <Text style={styles.title}>Settings</Text>
        </View>
        <Text style={styles.subtitle}>
          TupuChat is connected to the production reply engine automatically.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusText}>
          <Text style={styles.cardTitle}>AI backend online</Text>
          <Text style={styles.cardCopy}>
            Messages are generated through the secure cloud backend. Provider API keys are never
            stored in the Android app.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Options</Text>
        <SettingsLink
          icon="hardware-chip-outline"
          title="LLM Provider"
          copy={`${selectedProvider.label} · ${selectedModel?.label || llmPreference.model}`}
          onPress={() => router.push("/llm-provider" as never)}
        />
        <SettingsLink
          icon="time-outline"
          title="History"
          copy="Review recent generations and save useful replies."
          onPress={() => router.push("/history" as never)}
        />
        <SettingsLink
          icon="heart-outline"
          title="Favorites"
          copy="Open your saved replies and remove anything you no longer need."
          onPress={() => router.push("/favorites" as never)}
        />
      </View>

      <View style={styles.grid}>
        <InfoTile title="Private by design" copy="Secrets stay on the backend." />
        <InfoTile title="History ready" copy="Recent generations are saved locally." />
        <InfoTile title="Favorites" copy="Keep your best replies one tap away." />
      </View>
    </ScrollView>
  );
}

function SettingsLink({
  icon,
  title,
  copy,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  copy: string;
  onPress: () => void;
}) {
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

function InfoTile({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileCopy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
