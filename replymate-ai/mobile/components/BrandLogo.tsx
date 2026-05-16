import { Image, Platform, StyleSheet, View } from "react-native";
import { Text } from "react-native";

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
        <View style={styles.titleBlock}>
          <Image
            resizeMode="contain"
            source={require("../assets/brand/tupuchat_title.png")}
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

const styles = StyleSheet.create({
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
    height: 82,
    transform: [{ translateX: -10 }],
    width: 82,
  },
  logoCompact: {
    height: 42,
    width: 42,
  },
  title: {
    height: 104,
    width: 454,
  },
  titleBlock: {
    transform: [{ translateX: -150 }, { translateY: -16 }],
  },
  credit: {
    color: "rgba(255, 255, 255, 0.42)",
    fontSize: 9,
    fontStyle: "italic",
    fontWeight: "700",
    marginTop: -40,
    textAlign: "center",
  },
});
