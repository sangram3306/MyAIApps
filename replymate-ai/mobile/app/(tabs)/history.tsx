import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { EmptyState } from "../../components/EmptyState";
import { ReplyCard } from "../../components/ReplyCard";
import { colors, spacing } from "../../constants/theme";
import { clearHistory, getHistory, saveFavorite } from "../../storage/appStorage";
import { ReplyHistoryItem } from "../../storage/types";

export default function HistoryScreen() {
  const [items, setItems] = useState<ReplyHistoryItem[]>([]);

  const loadHistory = useCallback(() => {
    getHistory().then(setItems);
  }, []);

  useFocusEffect(loadHistory);

  async function handleClear() {
    await clearHistory();
    setItems([]);
  }

  async function handleFavorite(item: ReplyHistoryItem, reply: string) {
    await saveFavorite({
      id: `${Date.now()}`,
      reply,
      sourceMessage: item.message,
      tone: item.tone,
      createdAt: new Date().toISOString(),
    });
    Alert.alert("Saved", "Reply added to favorites.");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>History</Text>
        {items.length > 0 ? (
          <Pressable onPress={handleClear} style={styles.clearButton}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 ? (
        <EmptyState
          title="No history yet"
          message="Generated replies are saved here automatically."
        />
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.group}>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleString()}</Text>
            <Text style={styles.message} numberOfLines={3}>
              {item.message}
            </Text>
            <Text style={styles.tone}>Tone: {item.tone}</Text>
            <View style={styles.replies}>
              {item.replies.map((reply, index) => (
                <ReplyCard
                  key={`${item.id}-${index}`}
                  reply={reply}
                  onFavorite={() => handleFavorite(item, reply)}
                />
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    gap: spacing.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  clearButton: {
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  clearText: {
    color: colors.danger,
    fontWeight: "800",
  },
  group: {
    backgroundColor: "#EEF6FF",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  message: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  tone: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  replies: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
