import { Image, Platform, StyleSheet, View } from "react-native";

type Props = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Image
        resizeMode="contain"
        source={require("../assets/brand/tupuchat_logo.png")}
        style={[styles.logo, compact && styles.logoCompact]}
      />
      {!compact ? (
        <Image
          resizeMode="contain"
          source={require("../assets/brand/tupuchat_title.png")}
          style={styles.title}
        />
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
    gap: 14,
  },
  wrapCompact: {
    gap: 0,
  },
  logo: {
    height: 64,
    transform: [{ translateX: -10 }],
    width: 64,
  },
  logoCompact: {
    height: 42,
    width: 42,
  },
  title: {
    height: 84,
    transform: [{ translateX: -84 }],
    width: 366,
  },
});
