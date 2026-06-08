export type ThemeMode = "system" | "light" | "dark";

export type ResolvedTheme = "light" | "dark";

export type ThemeColors = {
  background: string;
  backgroundDeep: string;
  backgroundGrid: string;
  surface: string;
  surfaceElevated: string;
  surfaceGlass: string;
  text: string;
  textMuted: string;
  muted: string;
  mutedSoft: string;
  primary: string;
  onPrimary: string;
  primaryDim: string;
  primarySoft: string;
  primaryBorder: string;
  secondary: string;
  purple: string;
  onSecondary: string;
  secondarySoft: string;
  cyan: string;
  cyanSoft: string;
  border: string;
  borderStrong: string;
  success: string;
  danger: string;
  dangerSoft: string;
  amber: string;
  ink: string;
};

export const darkColors: ThemeColors = {
  background: "#05070D",
  backgroundDeep: "#020409",
  backgroundGrid: "rgba(0,255,198,0.08)",
  surface: "#0C111A",
  surfaceElevated: "#111824",
  surfaceGlass: "rgba(17,24,36,0.82)",
  text: "#F8FAFC",
  textMuted: "#8A94A7",
  muted: "#8A94A7",
  mutedSoft: "#5F6878",
  primary: "#00FFC6",
  onPrimary: "#020409",
  primaryDim: "rgba(0,255,198,0.16)",
  primarySoft: "rgba(0,255,198,0.16)",
  primaryBorder: "rgba(0,255,198,0.35)",
  secondary: "#7C3AED",
  purple: "#7C3AED",
  onSecondary: "#FFFFFF",
  secondarySoft: "rgba(124,58,237,0.12)",
  cyan: "#00CFFF",
  cyanSoft: "rgba(0,207,255,0.10)",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(0,255,198,0.35)",
  success: "#00E676",
  danger: "#FF4D6D",
  dangerSoft: "rgba(255,77,109,0.14)",
  amber: "#FACC15",
  ink: "#020409",
};

export const lightColors: ThemeColors = {
  background: "#F7F1E8",
  backgroundDeep: "#EFE6D7",
  backgroundGrid: "rgba(8,117,92,0.08)",
  surface: "#FFFDF8",
  surfaceElevated: "#EEE5D8",
  surfaceGlass: "rgba(255,253,248,0.82)",
  text: "#19150F",
  textMuted: "#756A5B",
  muted: "#756A5B",
  mutedSoft: "#9B907F",
  primary: "#08755C",
  onPrimary: "#FFFFFF",
  primaryDim: "rgba(8,117,92,0.14)",
  primarySoft: "rgba(8,117,92,0.14)",
  primaryBorder: "rgba(8,117,92,0.30)",
  secondary: "#A6572E",
  purple: "#7C3AED",
  onSecondary: "#FFFFFF",
  secondarySoft: "rgba(166,87,46,0.12)",
  cyan: "#0E7490",
  cyanSoft: "rgba(14,116,144,0.12)",
  border: "rgba(25,21,15,0.11)",
  borderStrong: "rgba(8,117,92,0.30)",
  success: "#08755C",
  danger: "#B7334E",
  dangerSoft: "rgba(183,51,78,0.12)",
  amber: "#9C6418",
  ink: "#FFFDF8",
};

export const colors = darkColors;

export function getThemeColors(mode: ThemeMode, systemMode: ResolvedTheme = "dark"): ThemeColors {
  const resolved = mode === "system" ? systemMode : mode;
  return resolved === "light" ? lightColors : darkColors;
}

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  xxl: 36,
};

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const typography = {
  hero: 36,
  title: 30,
  page: 28,
  section: 18,
  card: 16,
  body: 14,
  caption: 12,
  micro: 10,
  weights: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "700" as const,
    bold: "800" as const,
    black: "900" as const,
  },
};

export const surfaces = {
  base: darkColors.background,
  deep: darkColors.backgroundDeep,
  card: darkColors.surface,
  elevated: darkColors.surfaceElevated,
  glass: darkColors.surfaceGlass,
};

export const borders = {
  subtle: darkColors.border,
  neon: darkColors.primaryBorder,
  danger: darkColors.danger,
};

export const shadows = {
  none: {
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  soft: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.24,
    shadowRadius: 24,
    elevation: 3,
  },
  active: {
    shadowColor: darkColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 4,
  },
};

export const glow = {
  primary: {
    shadowColor: darkColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 4,
  },
  purple: {
    shadowColor: darkColors.purple,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 3,
  },
  quiet: {
    shadowColor: darkColors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 1,
  },
};
