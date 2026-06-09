import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { View } from "react-native";
import { AppThemeProvider, useAppTheme } from "../context/app-theme";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <RootNavigator />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { resolvedTheme, colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          backgroundColor: colors.background,
          height: insets.top,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
          zIndex: 9999,
        }}
      />
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
    </View>
  );
}
