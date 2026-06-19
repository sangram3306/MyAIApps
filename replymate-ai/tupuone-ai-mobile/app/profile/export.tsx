import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MatrixBackground } from "../../components/PremiumUI";
import { radius, spacing } from "../../constants/theme";
import { useAppTheme } from "../../context/app-theme";
import { useAuth } from "../../context/auth";
import { buildLocalExportPayload, importLocalPayload, ExportPayload } from "../../storage/appStorage";

export default function ExportScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const localData = await buildLocalExportPayload();
      const exportData = {
        user,
        ...localData,
      };

      const payloadString = JSON.stringify(exportData, null, 2);
      
      const fileName = `sp-one-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(fileUri, payloadString, { encoding: FileSystem.EncodingType.UTF8 });

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on your device.");
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "Save SP ONE Backup",
      });
    } catch (error) {
      Alert.alert("Export Failed", error instanceof Error ? error.message : "Could not export data.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImport() {
    setIsImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return; // User canceled
      }

      const fileUri = result.assets[0].uri;
      const fileContents = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.UTF8 });

      if (!fileContents) {
        throw new Error("The selected file is empty.");
      }

      let parsedPayload: ExportPayload;
      try {
        parsedPayload = JSON.parse(fileContents);
      } catch {
        throw new Error("File does not contain valid JSON data.");
      }

      if (!parsedPayload.app || !parsedPayload.exportedAt) {
        throw new Error("JSON data does not match the required SP ONE export format.");
      }

      await importLocalPayload(parsedPayload);
      Alert.alert("Success", "Your data has been imported successfully!");
    } catch (error) {
      Alert.alert("Import Failed", error instanceof Error ? error.message : "Could not import data.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <MatrixBackground density={10} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" color={colors.textMuted} size={20} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Data Management</Text>
            <Text style={styles.subtitle}>Export or import your app data</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="download-outline" color={colors.primary} size={48} />
          </View>
          <Text style={styles.description}>
            You can export all your personal data, including your profile details, app preferences, chat history, and favorites.
          </Text>
          <Text style={styles.warning}>
            The exported data will be in JSON format. Be careful when sharing this data as it contains your personal information.
          </Text>

          <Pressable
            onPress={() => void handleExport()}
            disabled={isExporting || isImporting}
            style={[styles.primaryButton, (isExporting || isImporting) && styles.buttonDisabled]}
          >
            {isExporting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="share-outline" color={colors.onPrimary} size={18} />
                <Text style={styles.primaryButtonText}>Export Data</Text>
              </>
            )}
          </Pressable>

          <View style={styles.divider} />

          <Text style={styles.description}>
            Have a previously exported JSON backup file? Select it below to safely restore your preferences, chat history, and favorites.
          </Text>

          <Pressable
            onPress={() => void handleImport()}
            disabled={isExporting || isImporting}
            style={[styles.secondaryButton, (isExporting || isImporting) && styles.buttonDisabled]}
          >
            {isImporting ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="document-text-outline" color={colors.primary} size={18} />
                <Text style={styles.secondaryButtonText}>Import from File</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"], topInset: number) {
  return StyleSheet.create({
    screen: {
      backgroundColor: colors.background,
      flex: 1,
    },
    container: {
      paddingBottom: spacing.xl,
      gap: 20,
      paddingHorizontal: 20,
      paddingTop: Math.max(spacing.md, topInset + spacing.xs),
    },
    headerRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      paddingTop: spacing.xs,
      marginBottom: spacing.xs,
    },
    backButton: {
      alignItems: "center",
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      height: 38,
      justifyContent: "center",
      width: 38,
    },
    headerCopy: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
    },
    card: {
      backgroundColor: colors.surfaceGlass,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      padding: spacing.xl,
      alignItems: "center",
      gap: spacing.lg,
    },
    iconContainer: {
      backgroundColor: "rgba(0,255,198,0.1)",
      padding: spacing.lg,
      borderRadius: radius.pill,
      marginBottom: spacing.sm,
    },
    description: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
      lineHeight: 22,
    },
    warning: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 18,
      backgroundColor: "rgba(255,68,68,0.1)",
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.danger,
    },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 48,
      width: "100%",
      marginTop: spacing.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: colors.onPrimary,
      fontSize: 15,
      fontWeight: "900",
    },
    secondaryButton: {
      alignItems: "center",
      backgroundColor: "rgba(0,255,198,0.08)",
      borderColor: colors.primaryBorder,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 48,
      width: "100%",
      marginTop: spacing.xs,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: "900",
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      width: "100%",
      marginVertical: spacing.md,
    },
  });
}
