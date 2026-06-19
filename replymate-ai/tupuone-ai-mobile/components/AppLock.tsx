import React, { useEffect, useState, useRef } from "react";
import { AppState, View, Text, StyleSheet, Pressable } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getAppLockModePreference } from "../storage/appStorage";
import { useAppTheme } from "../context/app-theme";
import { radius, spacing } from "../constants/theme";

export function AppLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const { colors } = useAppTheme();
  // Ref to prevent double-prompting when the biometric dialog triggers AppState changes
  const isAuthenticating = useRef(false);

  useEffect(() => {
    // Check initially when the app mounts
    checkLock();

    // Listen for app coming to the foreground
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        checkLock();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const checkLock = async () => {
    if (isAuthenticating.current) return;
    
    const lockMode = await getAppLockModePreference();
    if (lockMode !== "off" && lockMode !== null) {
      setIsLocked(true);
      promptAuthentication();
    }
  };

  const promptAuthentication = async () => {
    if (isAuthenticating.current) return;
    
    isAuthenticating.current = true;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // Even if they lack hardware or enrolment, we still call authenticateAsync
      // Expo will gracefully fall back or throw an error, which we catch.
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock SP ONE",
        fallbackLabel: "Use Passcode",
        cancelLabel: "Cancel",
      });

      if (result.success) {
        setIsLocked(false);
      }
    } catch (e) {
      console.warn("Authentication error:", e);
    } finally {
      isAuthenticating.current = false;
    }
  };

  if (isLocked) {
    return (
      <View style={[styles.lockedContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="lock-closed" size={64} color={colors.primary} />
        <Text style={[styles.lockedTitle, { color: colors.text }]}>App Locked</Text>
        <Text style={[styles.lockedSubtitle, { color: colors.textMuted }]}>
          Please authenticate to continue
        </Text>
        <Pressable 
          style={[styles.unlockButton, { backgroundColor: colors.primaryDim }]} 
          onPress={promptAuthentication}
        >
          <Text style={[styles.unlockButtonText, { color: colors.primary }]}>Unlock</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  lockedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999,
  },
  lockedTitle: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  lockedSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: spacing.xl,
  },
  unlockButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
  },
  unlockButtonText: {
    fontSize: 16,
    fontWeight: "900",
  },
});
