import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, spacing } from "../../constants/theme";
import { getBackendUrl, saveBackendUrl } from "../../storage/appStorage";

export default function SettingsScreen() {
  const [backendUrl, setBackendUrl] = useState("");

  useEffect(() => {
    getBackendUrl().then(setBackendUrl);
  }, []);

  async function handleSave() {
    await saveBackendUrl(backendUrl);
    Alert.alert("Saved", "Backend URL saved.");
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Backend URL</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://your-render-service.onrender.com"
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={backendUrl}
          onChangeText={setBackendUrl}
        />
        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Backend URL</Text>
        </Pressable>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Setup guide</Text>
        <Text style={styles.infoText}>1. Run the backend locally or deploy it on Render.</Text>
        <Text style={styles.infoText}>2. Copy the backend URL, without a trailing slash.</Text>
        <Text style={styles.infoText}>3. Paste it above and save.</Text>
        <Text style={styles.infoText}>4. Go back Home and generate replies.</Text>
      </View>
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
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    padding: spacing.md,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 50,
    justifyContent: "center",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  infoCard: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  infoTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  infoText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
});
