import { useMemo } from "react";
import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  reply: string;
  onFavorite?: () => void;
  favoriteLabel?: string;
};

export function ReplyCard({ reply, onFavorite, favoriteLabel = "Save" }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  async function handleCopy() {
    await Clipboard.setStringAsync(reply);
    Alert.alert("Copied", "Reply copied to clipboard.");
  }

  async function handleShare() {
    await Share.share({ message: reply });
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardGlow} />
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderIcon}>
          <Ionicons name="sparkles-outline" color={colors.primary} size={12} />
        </View>
        <Text style={styles.cardHeaderLabel}>AI Generated</Text>
      </View>
      <Text style={styles.reply}>{reply}</Text>
      <View style={styles.divider} />
      <View style={styles.actions}>
        <ActionButton icon="copy-outline" label="Copy" onPress={handleCopy} colors={colors} />
        <ActionButton icon="share-outline" label="Share" onPress={handleShare} colors={colors} />
        {onFavorite ? (
          <ActionButton icon="heart-outline" label={favoriteLabel} onPress={onFavorite} colors={colors} />
        ) : null}
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
      opacity: 0.2,
      position: "absolute",
      right: -20,
      top: -30,
      width: 80,
    },
    cardHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
    },
    cardHeaderIcon: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderRadius: 999,
      height: 20,
      justifyContent: "center",
      width: 20,
    },
    cardHeaderLabel: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    reply: {
      color: colors.text,
      fontSize: 15,
      lineHeight: 24,
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
      borderWidth: 1,
      borderRadius: 12,
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
