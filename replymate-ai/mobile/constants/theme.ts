export type ThemeMode = "system" | "light" | "dark";

export type ResolvedTheme = "light" | "dark";

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  muted: string;
  primary: string;
  primarySoft: string;
  secondary: string;
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
  background: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceElevated: "#EEF2F7",
  text: "#09111C",
  muted: "#5A6476",
  primary: "#0A8F6B",
  primarySoft: "rgba(10, 143, 107, 0.12)",
  secondary: "#5B5CE2",
  secondarySoft: "rgba(91, 92, 226, 0.12)",
  border: "rgba(9, 17, 28, 0.10)",
  borderStrong: "rgba(10, 143, 107, 0.28)",
  success: "#0A8F6B",
  danger: "#D83B5D",
  dangerSoft: "rgba(216, 59, 93, 0.12)",
  amber: "#B7791F",
  ink: "#F0F4F9",
};

export const darkColors: ThemeColors = {
  background: "#050506",
  surface: "#111318",
  surfaceElevated: "#181B22",
  text: "#F5F7FA",
  muted: "#8B93A7",
  primary: "#45F5C6",
  primarySoft: "rgba(69, 245, 198, 0.14)",
  secondary: "#8C7CFF",
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
