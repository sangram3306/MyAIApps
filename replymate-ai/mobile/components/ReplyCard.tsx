import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../constants/theme";

type Props = {
  reply: string;
  onFavorite?: () => void;
  favoriteLabel?: string;
};

export function ReplyCard({ reply, onFavorite, favoriteLabel = "Save" }: Props) {
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
        <Action label="Copy" onPress={handleCopy} />
        <Action label="Share" onPress={handleShare} />
        {onFavorite ? (
          <Action label={favoriteLabel} onPress={onFavorite} />
        ) : null}
      </View>
    </View>
  );
}

function Action({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
