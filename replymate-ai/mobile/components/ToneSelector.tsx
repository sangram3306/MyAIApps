import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Tone, tones } from "../constants/tones";
import { colors, spacing } from "../constants/theme";

type Props = {
  selectedTone: Tone;
  onSelect: (tone: Tone) => void;
};

export function ToneSelector({ selectedTone, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {tones.map((tone) => {
        const selected = selectedTone === tone.value;
        return (
          <Pressable
            key={tone.value}
            onPress={() => onSelect(tone.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{tone.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
