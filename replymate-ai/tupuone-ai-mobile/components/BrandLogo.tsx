import { useMemo } from "react";
import { Image, Platform, StyleSheet, View } from "react-native";
import { Text } from "react-native";
import { useAppTheme } from "../context/app-theme";

type Props = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Image
        resizeMode="contain"
        source={require("../assets/brand/tupuz-logo.png")}
        style={[styles.logo, compact && styles.logoCompact]}
      />
      {!compact ? (
        <View style={styles.titleBlock}>
          <Image
            resizeMode="contain"
            source={require("../assets/brand/tupuz-title.png")}
            style={styles.title}
          />
          <Text style={styles.credit}>by Sangram</Text>
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

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    wrap: {
      alignItems: "center",
      flexDirection: "row",
      gap: 14,
      transform: [{ translateY: -14 }],
    },
    wrapCompact: {
      gap: 0,
    },
    logo: {
      height: 50,
      transform: [{ translateX: -10 }],
      width: 50,
    },
    logoCompact: {
      height: 42,
      width: 42,
    },
    title: {
      height: 84,
      width: 360,
    },
    titleBlock: {
      transform: [{ translateX: -70 }, { translateY: -16 }],
    },
    credit: {
      color: colors.muted,
      fontSize: 9,
      fontStyle: "italic",
      fontWeight: "700",
      marginTop: -34,
      textAlign: "center",
    },
  });
}
