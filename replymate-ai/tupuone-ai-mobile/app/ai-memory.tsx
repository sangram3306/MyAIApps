import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { MatrixBackground } from "../components/PremiumUI";
import { radius, spacing, typography } from "../constants/theme";
import { useAppTheme } from "../context/app-theme";
import { getBackendUrl } from "../storage/appStorage";
import {
  MemoryItem,
  listMemoriesFromApi,
  deleteMemoryFromApi,
  clearAllMemoriesFromApi,
} from "../services/api";

export default function AiMemoryScreen() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true);
      const url = await getBackendUrl();
      if (!url) return;
      const data = await listMemoriesFromApi({ backendUrl: url });
      setMemories(data);
    } catch (error) {
      console.error("Failed to fetch memories:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMemories();
    }, [fetchMemories])
  );

  const handleDelete = async (id: string) => {
    try {
      const url = await getBackendUrl();
      if (!url) return;
      await deleteMemoryFromApi({ backendUrl: url, memoryId: id });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (error) {
      Alert.alert("Error", "Could not delete memory.");
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All Memories?",
      "This will permanently delete all remembered facts. The AI will start fresh.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              const url = await getBackendUrl();
              if (!url) return;
              await clearAllMemoriesFromApi({ backendUrl: url });
              setMemories([]);
              Alert.alert("Done", "All AI memories have been cleared.");
            } catch {
              Alert.alert("Error", "Could not clear memories.");
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.lg,
      paddingTop: Math.max(spacing.xl, insets.top + spacing.sm),
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surfaceGlass,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: typography.page,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    clearButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: colors.danger + "20",
    },
    clearText: {
      color: colors.danger,
      fontSize: typography.body,
      fontWeight: typography.weights.medium,
    },
    listContent: {
      padding: spacing.lg,
      paddingBottom: 100,
    },
    memoryCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    memoryTextContainer: {
      flex: 1,
      marginRight: spacing.md,
    },
    memoryFact: {
      fontSize: typography.body,
      color: colors.text,
      lineHeight: 22,
    },
    memoryCategory: {
      fontSize: typography.micro,
      color: colors.textSecondary,
      marginTop: spacing.xs,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    deleteButton: {
      padding: spacing.sm,
      backgroundColor: colors.surfaceGlass,
      borderRadius: radius.sm,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      marginTop: 40,
    },
    emptyTitle: {
      fontSize: typography.section,
      color: colors.text,
      fontWeight: typography.weights.semibold,
      marginTop: spacing.md,
    },
    emptyText: {
      fontSize: typography.body,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: spacing.sm,
      lineHeight: 22,
    },
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <MatrixBackground />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>AI Memory</Text>
        </View>
        {memories.length > 0 && (
          <Pressable style={styles.clearButton} onPress={handleClearAll}>
            <Text style={styles.clearText}>Clear All</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={memories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.memoryCard}>
            <View style={styles.memoryTextContainer}>
              <Text style={styles.memoryFact}>{item.fact}</Text>
              <Text style={styles.memoryCategory}>{item.category}</Text>
            </View>
            <Pressable
              style={styles.deleteButton}
              onPress={() => handleDelete(item.id)}
              hitSlop={10}
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="hardware-chip-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Memories Yet</Text>
              <Text style={styles.emptyText}>
                As you chat, Tupu chat will automatically learn and remember important facts about you to personalize future conversations.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
