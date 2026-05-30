import { useMemo } from "react";
import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";

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
      <Text style={styles.reply}>{reply}</Text>
      <View style={styles.actions}>
        <Action label="Copy" onPress={handleCopy} styles={styles} />
        <Action label="Share" onPress={handleShare} styles={styles} />
        {onFavorite ? (
          <Action label={favoriteLabel} onPress={onFavorite} styles={styles} />
        ) : null}
      </View>
    </View>
  );
}

function Action({
  label,
  onPress,
  styles,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.1,
      shadowRadius: 20,
    },
    reply: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 24,
    },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    action: {
      alignItems: "center",
      backgroundColor: colors.primarySoft,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    actionText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
