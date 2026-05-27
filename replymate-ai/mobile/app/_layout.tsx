import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppThemeProvider, useAppTheme } from "../context/app-theme";

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <RootNavigator />
    </AppThemeProvider>
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
