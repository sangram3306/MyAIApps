import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../constants/theme";

type Props = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.mark}>
        <View style={styles.core}>
          <Feather name="message-circle" color={colors.ink} size={24} />
        </View>
        <View style={styles.spark}>
          <Feather name="zap" color={colors.secondary} size={12} />
        </View>
      </View>

      {!compact ? (
        <View style={styles.wordBlock}>
          <Text style={styles.wordmark}>
            Reply<Text style={styles.wordmarkSoft}>Mate</Text>
          </Text>
          <Text style={styles.tag}>AI message composer</Text>
        </View>
      ) : null}
    </View>
  );
}

export const brandFont = Platform.select({
  ios: "AvenirNext-DemiBold",
  android: "sans-serif-medium",
  default: "System",
});

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  wrapCompact: {
    gap: 0,
  },
  mark: {
    alignItems: "center",
    backgroundColor: colors.secondary,
    borderColor: "rgba(255, 255, 255, 0.22)",
    borderRadius: 8,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    shadowColor: colors.secondary,
    shadowOpacity: 0.42,
    shadowRadius: 20,
    width: 56,
  },
  core: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.76)",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  spark: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    position: "absolute",
    right: -5,
    top: -5,
    width: 22,
  },
  wordBlock: {
    gap: 2,
  },
  wordmark: {
    color: colors.text,
    fontFamily: brandFont,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0,
    lineHeight: 40,
  },
  wordmarkSoft: {
    color: colors.secondary,
  },
  tag: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
});
