import { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";

type Props = {
  compact?: boolean;
};

export function BrandLogo({ compact = false }: Props) {
  const styles = useMemo(() => createStyles(), []);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Image
        resizeMode="contain"
        source={require("../assets/brand/SP_One_logo.png")}
        style={[styles.logo, compact && styles.logoCompact]}
      />
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    wrap: {
      alignItems: "flex-start",
      justifyContent: "flex-start",
      transform: [{ translateX: -10 }, { translateY: -24 }],
    },
    wrapCompact: {
      transform: [{ translateY: 0 }],
    },
    logo: {
      backgroundColor: "transparent",
      height: 74,
      width: 56,
    },
    logoCompact: {
      height: 74,
      width: 56,
    },
  });
}
