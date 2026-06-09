import { useMemo } from "react";
import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { buildGrammarDiff } from "../utils/grammarDiff";

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  original: string;
  corrected: string;
};

export function GrammarFixCard({ original, corrected }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const segments = useMemo(() => buildGrammarDiff(original, corrected), [original, corrected]);

  async function handleCopy() {
    await Clipboard.setStringAsync(corrected);
    Alert.alert("Copied", "Corrected text copied to clipboard.");
  }

  async function handleShare() {
    await Share.share({ message: corrected });
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardGlow} />

      {/* Header badge */}
      <View style={styles.headerBadge}>
        <View style={styles.headerBadgeIcon}>
          <Ionicons name="checkmark-done" color={colors.primary} size={12} />
        </View>
        <Text style={styles.heading}>Corrected text</Text>
      </View>

      {/* Diff content */}
      <View style={styles.diffContainer}>
        <Text style={styles.reply}>
          {segments.map((segment, index) => (
            <Text key={`${segment.text}-${index}`} style={segment.changed ? styles.changedText : undefined}>
              {segment.text}
            </Text>
          ))}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Actions */}
      <View style={styles.actions}>
        <ActionButton icon="copy-outline" label="Copy" onPress={handleCopy} colors={colors} />
        <ActionButton icon="share-outline" label="Share" onPress={handleShare} colors={colors} />
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Ionicons name={icon} color={colors.primary} size={14} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderRadius: 20,
      borderWidth: 1,
      gap: spacing.sm,
      overflow: "hidden",
      padding: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.08,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 2 },
    },
    cardGlow: {
      backgroundColor: colors.primaryDim,
      borderRadius: 999,
      height: 80,
      opacity: 0.18,
      position: "absolute",
      left: -20,
      top: -30,
      width: 80,
    },
    headerBadge: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    headerBadgeIcon: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderRadius: 999,
      height: 20,
      justifyContent: "center",
      width: 20,
    },
    heading: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    diffContainer: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.sm + 2,
    },
    reply: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 26,
    },
    changedText: {
      backgroundColor: colors.primaryDim,
      color: colors.primary,
      fontWeight: "700",
    },
    divider: {
      backgroundColor: colors.border,
      height: StyleSheet.hairlineWidth,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    action: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.xs + 2,
    },
    actionText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
  });
}
