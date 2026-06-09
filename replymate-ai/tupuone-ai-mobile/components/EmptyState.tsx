import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  title: string;
  message: string;
  icon?: IconName;
};

export function EmptyState({ title, message, icon }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.glowOrb} />

      {icon ? (
        <View style={styles.iconContainer}>
          <Ionicons name={icon} color={colors.primary} size={28} />
        </View>
      ) : null}

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      <View style={styles.pulseRow}>
        <View style={styles.pulseDot} />
        <Text style={styles.pulseText}>Waiting for input</Text>
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.primaryBorder,
      borderRadius: 22,
      borderWidth: 1,
      gap: spacing.sm,
      overflow: "hidden",
      padding: spacing.lg + 4,
      shadowColor: colors.primary,
      shadowOpacity: 0.06,
      shadowRadius: 20,
    },
    glowOrb: {
      backgroundColor: colors.primaryDim,
      borderRadius: 999,
      height: 100,
      opacity: 0.15,
      position: "absolute",
      right: -30,
      top: -40,
      width: 100,
    },
    iconContainer: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
      borderRadius: 999,
      borderWidth: 1,
      height: 56,
      justifyContent: "center",
      marginBottom: spacing.xs,
      width: 56,
      shadowColor: colors.primary,
      shadowOpacity: 0.18,
      shadowRadius: 14,
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "800",
      textAlign: "center",
    },
    message: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
    },
    pulseRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 6,
      marginTop: spacing.xs,
    },
    pulseDot: {
      backgroundColor: colors.primary,
      borderRadius: 999,
      height: 5,
      width: 5,
      opacity: 0.6,
      shadowColor: colors.primary,
      shadowOpacity: 0.6,
      shadowRadius: 4,
    },
    pulseText: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
  });
}
