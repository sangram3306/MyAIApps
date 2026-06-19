import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, StyleSheet, View } from "react-native";
import { SettingsContent } from "./SettingsContent";

const { width } = Dimensions.get("window");
const SIDEBAR_WIDTH = width * 0.85;

export function SettingsSidebar({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [isRendered, setIsRendered] = useState(visible);
  const [slideAnim] = useState(() => new Animated.Value(-SIDEBAR_WIDTH));
  const [fadeAnim] = useState(() => new Animated.Value(0));

  if (visible && !isRendered) {
    setIsRendered(true);
  }

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else if (isRendered) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 250, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setIsRendered(false);
      });
    }
  }, [visible, isRendered, slideAnim, fadeAnim]);

  if (!isRendered) return null;

  return (
    <Modal visible={true} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} pointerEvents="none" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          <SettingsContent onClose={onClose} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.5)" },
  dismissArea: { flex: 1 },
  sidebar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
});
