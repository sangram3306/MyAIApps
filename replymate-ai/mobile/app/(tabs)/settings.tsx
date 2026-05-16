import { Feather } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { BrandLogo, brandFont } from "../../components/BrandLogo";
import { colors, spacing } from "../../constants/theme";

export default function SettingsScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
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
        <View style={styles.statusIcon}>
          <Feather name="zap" color={colors.primary} size={22} />
        </View>
        <View style={styles.statusText}>
          <Text style={styles.cardTitle}>AI backend online</Text>
          <Text style={styles.cardCopy}>
            Messages are generated through the secure cloud backend. No NVIDIA API key is stored in
            the Android app.
          </Text>
        </View>
      </View>

      <View style={styles.grid}>
        <InfoTile icon="shield" title="Private by design" copy="Secrets stay on the backend." />
        <InfoTile icon="clock" title="History ready" copy="Recent generations are saved locally." />
        <InfoTile icon="heart" title="Favorites" copy="Keep your best replies one tap away." />
      </View>
    </ScrollView>
  );
}

function InfoTile({
  icon,
  title,
  copy,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  copy: string;
}) {
  return (
    <View style={styles.tile}>
      <Feather name={icon} color={colors.secondary} size={20} />
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileCopy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
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
  statusIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    width: 46,
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
