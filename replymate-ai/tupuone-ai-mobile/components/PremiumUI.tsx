import { type ReactNode, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { glow, radius, shadows, spacing, typography } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";

type IconName = keyof typeof Ionicons.glyphMap;

type ShellProps = {
  children: ReactNode;
  footer?: ReactNode;
  matrix?: boolean;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function ScreenShell({ children, footer, matrix = true, scroll = false, style, contentStyle }: ShellProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const content = (
    <View style={[styles.shellContent, contentStyle]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.shell, style]}>
      {matrix ? <MatrixBackground /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.shellScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
      {footer ? <View style={styles.shellFooter}>{footer}</View> : null}
    </View>
  );
}

export function MatrixBackground({ density = 12 }: { density?: number }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View pointerEvents="none" style={styles.matrixWrap}>
      <View style={styles.matrixGlowPrimary} />
      <View style={styles.matrixGlowSecondary} />
      {Array.from({ length: density }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.matrixColumn,
            {
              left: `${((index + 1) * 100) / (density + 1)}%`,
              opacity: index % 3 === 0 ? 0.045 : 0.024,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function PremiumCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.premiumCard, style]}>{children}</View>;
}

export function GlassCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.glassCard, style]}>{children}</View>;
}

export function NeonCard({ children, active = false, style }: { children: ReactNode; active?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.neonCard, active && styles.neonCardActive, style]}>{children}</View>;
}

export function SectionHeader({
  title,
  eyebrow,
  action,
  onActionPress,
}: {
  title: string;
  eyebrow?: string;
  action?: string;
  onActionPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        {eyebrow ? <Text style={styles.sectionEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <Pressable onPress={onActionPress} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function NeonButton({
  label,
  icon,
  onPress,
  disabled,
  subtle = false,
}: {
  label: string;
  icon?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  subtle?: boolean;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.neonButton, subtle && styles.neonButtonSubtle, disabled && styles.disabled]}
    >
      {icon ? <Ionicons name={icon} color={subtle ? colors.primary : colors.onPrimary} size={18} /> : null}
      <Text style={[styles.neonButtonText, subtle && styles.neonButtonTextSubtle]}>{label}</Text>
    </Pressable>
  );
}

export function GradientButton(props: Parameters<typeof NeonButton>[0]) {
  return <NeonButton {...props} subtle />;
}

export function Chip({ label, active = false }: { label: string; active?: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </View>
  );
}

export function PremiumInput(props: TextInputProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TextInput
      placeholderTextColor={colors.mutedSoft}
      {...props}
      style={[styles.premiumInput, props.style]}
    />
  );
}

export function ToolCard({
  icon,
  title,
  subtitle,
  badge,
  active = false,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  badge?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={[styles.toolCard, active && styles.toolCardActive]}>
      <View style={[styles.toolIcon, active && styles.toolIconActive]}>
        <Ionicons name={icon} color={colors.primary} size={20} />
      </View>
      <View style={styles.toolCopy}>
        <Text style={styles.toolTitle}>{title}</Text>
        <Text style={styles.toolSubtitle}>{subtitle}</Text>
      </View>
      {badge ? <Chip label={badge} active={active} /> : null}
      <Ionicons name="chevron-forward" color={colors.muted} size={17} />
    </Pressable>
  );
}

export function StatCard({ label, value, active = false }: { label: string; value: string; active?: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.statCard, active && styles.statCardActive]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function SettingsRow({
  icon,
  title,
  copy,
  destructive = false,
  onPress,
}: {
  icon: IconName;
  title: string;
  copy?: string;
  destructive?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={styles.settingsRow}>
      <View style={[styles.settingsIcon, destructive && styles.settingsIconDanger]}>
        <Ionicons name={icon} color={destructive ? colors.danger : colors.primary} size={18} />
      </View>
      <View style={styles.settingsCopy}>
        <Text style={[styles.settingsTitle, destructive && { color: colors.danger }]}>{title}</Text>
        {copy ? <Text style={styles.settingsSubtitle}>{copy}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" color={destructive ? colors.danger : colors.muted} size={17} />
    </Pressable>
  );
}

export type BottomNavItem = {
  id: string;
  label: string;
  icon: IconName;
  badge?: string | number;
};

export function BottomNav({
  items,
  activeId,
  onSelect,
  style,
}: {
  items: BottomNavItem[];
  activeId: string;
  onSelect?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.bottomNav, style]}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <Pressable key={item.id} onPress={() => onSelect?.(item.id)} style={styles.bottomNavItem}>
            <View style={[styles.bottomNavIcon, active && styles.bottomNavIconActive]}>
              <Ionicons name={item.icon} color={active ? colors.onPrimary : colors.muted} size={20} />
              {item.badge !== undefined ? (
                <View style={styles.bottomNavBadge}>
                  <Text style={styles.bottomNavBadgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.bottomNavLabel, active && styles.bottomNavLabelActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    shell: {
      backgroundColor: colors.background,
      flex: 1,
    },
    shellContent: {
      flex: 1,
      gap: spacing.md,
      padding: spacing.md,
    },
    shellScrollContent: {
      flexGrow: 1,
    },
    shellFooter: {
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      padding: spacing.sm,
    },
    matrixWrap: {
      ...StyleSheet.absoluteFill,
      overflow: "hidden",
    },
    matrixColumn: {
      backgroundColor: colors.backgroundGrid,
      height: "100%",
      position: "absolute",
      top: 0,
      width: 1,
    },
    matrixGlowPrimary: {
      backgroundColor: colors.primaryDim,
      borderRadius: radius.pill,
      height: 210,
      opacity: 0.06,
      position: "absolute",
      right: -90,
      top: -70,
      width: 210,
    },
    matrixGlowSecondary: {
      backgroundColor: colors.secondarySoft,
      borderRadius: radius.pill,
      bottom: 110,
      height: 180,
      left: -90,
      opacity: 0.04,
      position: "absolute",
      width: 180,
    },
    premiumCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.md,
      ...shadows.soft,
    },
    glassCard: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.md,
    },
    neonCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.md,
    },
    neonCardActive: {
      borderColor: colors.primaryBorder,
      ...glow.quiet,
    },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 32,
    },
    sectionCopy: {
      flex: 1,
      gap: spacing.xxs,
    },
    sectionEyebrow: {
      color: colors.primary,
      fontSize: typography.micro,
      fontWeight: typography.weights.black,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    sectionTitle: {
      color: colors.text,
      fontSize: typography.section,
      fontWeight: typography.weights.bold,
      letterSpacing: -0.2,
    },
    sectionAction: {
      justifyContent: "center",
      minHeight: 32,
      paddingHorizontal: spacing.xs,
    },
    sectionActionText: {
      color: colors.primary,
      fontSize: typography.caption,
      fontWeight: typography.weights.bold,
    },
    neonButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "center",
      minHeight: 46,
      paddingHorizontal: spacing.md,
      ...glow.primary,
    },
    neonButtonSubtle: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.primaryBorder,
      borderWidth: StyleSheet.hairlineWidth,
      ...shadows.none,
    },
    neonButtonText: {
      color: colors.onPrimary,
      fontSize: typography.body,
      fontWeight: typography.weights.black,
    },
    neonButtonTextSubtle: {
      color: colors.primary,
    },
    disabled: {
      opacity: 0.55,
    },
    chip: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
    },
    chipActive: {
      backgroundColor: colors.primaryDim,
      borderColor: colors.primaryBorder,
    },
    chipText: {
      color: colors.textMuted,
      fontSize: typography.micro,
      fontWeight: typography.weights.black,
      textTransform: "uppercase",
    },
    chipTextActive: {
      color: colors.primary,
    },
    premiumInput: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      color: colors.text,
      fontSize: typography.body,
      minHeight: 46,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    toolCard: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 68,
      padding: spacing.sm,
    },
    toolCardActive: {
      borderColor: colors.primaryBorder,
      ...glow.quiet,
    },
    toolIcon: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderRadius: radius.sm,
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    toolIconActive: {
      ...glow.primary,
    },
    toolCopy: {
      flex: 1,
      gap: spacing.xxs,
    },
    toolTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: typography.weights.bold,
    },
    toolSubtitle: {
      color: colors.textMuted,
      fontSize: typography.caption,
      lineHeight: 16,
    },
    statCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flex: 1,
      minHeight: 72,
      padding: spacing.sm,
    },
    statCardActive: {
      borderColor: colors.primaryBorder,
    },
    statValue: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: typography.weights.black,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: typography.caption,
      lineHeight: 15,
      marginTop: spacing.xxs,
    },
    settingsRow: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      minHeight: 56,
      padding: spacing.sm,
    },
    settingsIcon: {
      alignItems: "center",
      backgroundColor: colors.primaryDim,
      borderRadius: radius.sm,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    settingsIconDanger: {
      backgroundColor: colors.dangerSoft,
    },
    settingsCopy: {
      flex: 1,
      gap: spacing.xxs,
    },
    settingsTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: typography.weights.bold,
    },
    settingsSubtitle: {
      color: colors.textMuted,
      fontSize: typography.caption,
    },
    bottomNav: {
      alignItems: "center",
      backgroundColor: colors.backgroundDeep,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.xs,
      justifyContent: "space-around",
      minHeight: 64,
      padding: spacing.xs,
    },
    bottomNavItem: {
      alignItems: "center",
      flex: 1,
      gap: spacing.xxs,
      justifyContent: "center",
      minHeight: 52,
    },
    bottomNavIcon: {
      alignItems: "center",
      borderRadius: radius.pill,
      height: 30,
      justifyContent: "center",
      width: 30,
    },
    bottomNavIconActive: {
      backgroundColor: colors.primary,
      ...glow.primary,
    },
    bottomNavLabel: {
      color: colors.textMuted,
      fontSize: typography.micro,
      fontWeight: typography.weights.bold,
    },
    bottomNavLabelActive: {
      color: colors.primary,
    },
    bottomNavBadge: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
      minWidth: 16,
      paddingHorizontal: 3,
      position: "absolute",
      right: -5,
      top: -4,
    },
    bottomNavBadgeText: {
      color: colors.onPrimary,
      fontSize: 9,
      fontWeight: typography.weights.black,
    },
  });
}
