import { useMemo } from "react";
import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { buildGrammarDiff } from "../utils/grammarDiff";

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
      <Text style={styles.heading}>Corrected text</Text>
      <Text style={styles.reply}>
        {segments.map((segment, index) => (
          <Text key={`${segment.text}-${index}`} style={segment.changed ? styles.changedText : undefined}>
            {segment.text}
          </Text>
        ))}
      </Text>

      <View style={styles.actions}>
        <Action label="Copy" onPress={handleCopy} styles={styles} />
        <Action label="Share" onPress={handleShare} styles={styles} />
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
      borderRadius: 12,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.md,
      shadowColor: colors.primary,
      shadowOpacity: 0.12,
      shadowRadius: 20,
    },
    heading: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    reply: {
      color: colors.text,
      fontSize: 16,
      lineHeight: 26,
    },
    changedText: {
      backgroundColor: colors.primarySoft,
      color: colors.text,
      textDecorationColor: colors.primary,
      textDecorationLine: "underline",
      textDecorationStyle: "solid",
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
      borderRadius: 8,
      borderWidth: 1,
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
