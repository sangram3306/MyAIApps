import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
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
  const { resolvedTheme } = useAppTheme();

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style={resolvedTheme === "dark" ? "light" : "dark"} />
    </>
  );
}
