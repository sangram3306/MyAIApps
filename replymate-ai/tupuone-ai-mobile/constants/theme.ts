export type ThemeMode = "system" | "light" | "dark";

export type ResolvedTheme = "light" | "dark";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  secondary: string;
  onSecondary: string;
  secondarySoft: string;
  border: string;
  borderStrong: string;
  success: string;
  danger: string;
  dangerSoft: string;
  amber: string;
  ink: string;
};

export const lightColors: ThemeColors = {
  background: "#F7F1E8",
  surface: "#FFFDF8",
  surfaceElevated: "#EEE5D8",
  text: "#19150F",
  muted: "#756A5B",
  primary: "#08755C",
  onPrimary: "#FFFFFF",
  primarySoft: "rgba(8, 117, 92, 0.12)",
  secondary: "#A6572E",
  onSecondary: "#FFFFFF",
  secondarySoft: "rgba(166, 87, 46, 0.12)",
  border: "rgba(25, 21, 15, 0.11)",
  borderStrong: "rgba(8, 117, 92, 0.30)",
  success: "#08755C",
  danger: "#B7334E",
  dangerSoft: "rgba(183, 51, 78, 0.12)",
  amber: "#9C6418",
  ink: "#FFFDF8",
};

export const darkColors: ThemeColors = {
  background: "#050506",
  surface: "#111318",
  surfaceElevated: "#181B22",
  text: "#F5F7FA",
  muted: "#8B93A7",
  primary: "#45F5C6",
  onPrimary: "#07110D",
  primarySoft: "rgba(69, 245, 198, 0.14)",
  secondary: "#8C7CFF",
  onSecondary: "#FFFFFF",
  secondarySoft: "rgba(140, 124, 255, 0.16)",
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(69, 245, 198, 0.36)",
  success: "#45F5C6",
  danger: "#FF5C7A",
  dangerSoft: "rgba(255, 92, 122, 0.14)",
  amber: "#FFD166",
  ink: "#090A0D",
};

export const colors = darkColors;

export function getThemeColors(mode: ThemeMode, systemMode: ResolvedTheme = "dark"): ThemeColors {
  const resolved = mode === "system" ? systemMode : mode;
  return resolved === "light" ? lightColors : darkColors;
}

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};
