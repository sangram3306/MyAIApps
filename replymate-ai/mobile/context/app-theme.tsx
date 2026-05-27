import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import {
  getThemeColors,
  ResolvedTheme,
  ThemeColors,
  ThemeMode,
} from "../constants/theme";
import {
  getThemeModePreference,
  saveThemeModePreference,
} from "../storage/appStorage";

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    getThemeModePreference()
      .then((savedMode) => {
        if (active) {
          setModeState(savedMode);
        }
      })
      .finally(() => {
        if (active) {
          setHydrated(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const resolvedTheme: ResolvedTheme =
    mode === "system" ? (systemScheme === "light" ? "light" : "dark") : mode;

  const colors = useMemo(() => getThemeColors(mode, resolvedTheme), [mode, resolvedTheme]);

  async function setMode(nextMode: ThemeMode) {
    setModeState(nextMode);
    await saveThemeModePreference(nextMode);
  }

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      colors,
      setMode,
      hydrated,
    }),
    [colors, hydrated, mode, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useAppTheme must be used inside AppThemeProvider.");
  }

  return value;
}
