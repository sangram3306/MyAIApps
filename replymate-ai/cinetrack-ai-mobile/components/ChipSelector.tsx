import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedOption = options.find((option) => option.value === selectedValue) || options[0];
  const filteredOptions = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    if (!lowered) {
      return options;
    }

    return options.filter((option) => option.label.toLowerCase().includes(lowered));
  }, [options, query]);

  return (
    <View style={styles.wrap}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.trigger}>
        <View style={styles.triggerCopy}>
          <Text style={styles.triggerLabel}>Selected</Text>
          <Text style={styles.triggerValue}>{selectedOption?.label || "Select an option"}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} color={colors.muted} size={18} />
      </Pressable>

      <Modal
        animationType="fade"
        transparent
        visible={open}
        onRequestClose={() => {
          setOpen(false);
          setQuery("");
          Keyboard.dismiss();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={styles.modalShell}
        >
          <Pressable
            onPress={() => {
              setOpen(false);
              setQuery("");
              Keyboard.dismiss();
            }}
            style={styles.backdrop}
          />

          <View pointerEvents="box-none" style={styles.panelWrap}>
            <View style={styles.panel}>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleBlock}>
                  <Text style={styles.triggerLabel}>Select option</Text>
                  <Text style={styles.triggerValue}>{selectedOption?.label || "Select an option"}</Text>
                </View>
                <Pressable
                  onPress={() => {
                    setOpen(false);
                    setQuery("");
                    Keyboard.dismiss();
                  }}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" color={colors.muted} size={18} />
                </Pressable>
              </View>

              <View style={styles.searchWrap}>
                <Ionicons name="search" color={colors.muted} size={16} />
                <TextInput
                  autoCorrect={false}
                  autoCapitalize="none"
                  autoFocus
                  placeholder="Search options"
                  placeholderTextColor={colors.muted}
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                />
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={styles.optionsScroll}
                contentContainerStyle={styles.options}
              >
                {filteredOptions.length ? (
                  filteredOptions.map((option) => {
                    const selected = selectedValue === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => {
                          onSelect(option.value);
                          setOpen(false);
                          setQuery("");
                          Keyboard.dismiss();
                        }}
                        style={[styles.optionRow, selected && styles.optionRowSelected]}
                      >
                        <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                          {option.label}
                        </Text>
                        {selected ? (
                          <Ionicons name="checkmark-circle" color={colors.primary} size={18} />
                        ) : null}
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No matching options</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    modalShell: {
      flex: 1,
      justifyContent: "flex-end",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
    },
    panelWrap: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      zIndex: 1,
    },
    trigger: {
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    triggerCopy: {
      flex: 1,
      gap: 2,
    },
    triggerLabel: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    triggerValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    panel: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderWidth: 1,
      gap: spacing.sm,
      maxHeight: "78%",
      padding: spacing.md,
    },
    sheetHeader: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    sheetTitleBlock: {
      flex: 1,
      gap: 2,
    },
    closeButton: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      height: 34,
      justifyContent: "center",
      width: 34,
    },
    searchWrap: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    searchInput: {
      color: colors.text,
      flex: 1,
      fontSize: 14,
      minHeight: 44,
    },
    optionsScroll: {
      maxHeight: "100%",
    },
    options: {
      gap: spacing.xs,
    },
    optionRow: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    optionRowSelected: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    optionText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    optionTextSelected: {
      color: colors.primary,
    },
    emptyText: {
      color: colors.muted,
      fontSize: 13,
      paddingVertical: spacing.sm,
      textAlign: "center",
    },
  });
}
