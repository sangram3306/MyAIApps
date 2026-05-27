import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";

type Props = {
  title: string;
  message: string;
};

export function EmptyState({ title, message }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      padding: spacing.lg,
      shadowColor: colors.primary,
      shadowOpacity: 0.12,
      shadowRadius: 18,
    },
    title: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: spacing.xs,
      textAlign: "center",
    },
    message: {
      color: colors.muted,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
  });
}
