import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { spacing } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";

type Option<T extends string> = {
  label: string;
  value: T;
};

type Props<T extends string> = {
  options: Array<Option<T>>;
  selectedValue: T;
  onSelect: (value: T) => void;
};

export function ChipSelector<T extends string>({ options, selectedValue, onSelect }: Props<T>) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((option) => {
        const selected = selectedValue === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onSelect(option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    row: {
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    chip: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    chipText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    chipTextSelected: {
      color: colors.primary,
    },
  });
}
