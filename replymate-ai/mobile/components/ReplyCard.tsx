import type { ReactNode } from "react";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
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
        <Action icon={<Feather name="copy" size={17} color={colors.primary} />} label="Copy" onPress={handleCopy} />
        <Action icon={<Feather name="send" size={17} color={colors.secondary} />} label="Share" onPress={handleShare} />
        {onFavorite ? (
          <Action
            icon={<Feather name="heart" size={17} color={colors.primary} />}
            label={favoriteLabel}
            onPress={onFavorite}
          />
        ) : null}
      </View>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.action} onPress={onPress}>
      {icon}
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
