import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Platform, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppTheme } from "../context/app-theme";

interface VoiceMicButtonProps {
  /** Called with the latest transcript text (interim or final). */
  onTranscript: (text: string) => void;
  /** Optional: size of the outer button (default 38). */
  size?: number;
  /** Optional: disable the button. */
  disabled?: boolean;
}

// Safely attempt to load native module without throwing when running inside Expo Go
let NativeSpeechRecognition: any = null;
try {
  const mod = require("expo-speech-recognition");
  if (mod && mod.ExpoSpeechRecognitionModule) {
    NativeSpeechRecognition = mod.ExpoSpeechRecognitionModule;
  }
} catch {
  NativeSpeechRecognition = null;
}

/**
 * A resilient mic button that uses on-device speech recognition.
 * Shows a pulsing ring animation while actively listening.
 * Falls back gracefully when running inside standard Expo Go.
 */
export function VoiceMicButton({
  onTranscript,
  size = 38,
  disabled = false,
}: VoiceMicButtonProps) {
  const { colors } = useAppTheme();
  const [isListening, setIsListening] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const webRecognitionRef = useRef<any>(null);

  // ── Pulse animation ────────────────────────────────────────────────────
  useEffect(() => {
    if (isListening) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 700,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }

    return () => {
      pulseLoop.current?.stop();
    };
  }, [isListening, pulseAnim]);

  // ── Native Speech recognition event listeners ─────────────────────────
  useEffect(() => {
    if (!NativeSpeechRecognition || typeof NativeSpeechRecognition.addListener !== "function") {
      return;
    }

    const subResult = NativeSpeechRecognition.addListener("result", (event: any) => {
      const transcript = event?.results?.[0]?.transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    });

    const subEnd = NativeSpeechRecognition.addListener("end", () => {
      setIsListening(false);
    });

    const subError = NativeSpeechRecognition.addListener("error", (event: any) => {
      console.warn("[VoiceMicButton] Speech recognition error:", event?.error);
      setIsListening(false);
    });

    return () => {
      subResult?.remove?.();
      subEnd?.remove?.();
      subError?.remove?.();
    };
  }, [onTranscript]);

  // ── Toggle recording ──────────────────────────────────────────────────
  const toggleListening = useCallback(async () => {
    // 1. If currently listening, stop it
    if (isListening) {
      if (NativeSpeechRecognition) {
        try {
          await NativeSpeechRecognition.stop();
        } catch {
          // ignore
        }
      } else if (webRecognitionRef.current) {
        try {
          webRecognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    // 2. Web Speech API fallback (if running in web browser)
    if (Platform.OS === "web") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        Alert.alert("Not Supported", "Speech recognition is not supported in this browser.");
        return;
      }
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcript = event.results[current][0].transcript;
          if (transcript) {
            onTranscript(transcript);
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.start();
        webRecognitionRef.current = recognition;
        setIsListening(true);
        return;
      } catch (e) {
        console.warn("[VoiceMicButton] Web speech error:", e);
        return;
      }
    }

    // 3. Native Speech Recognition
    if (!NativeSpeechRecognition) {
      Alert.alert(
        "Development Build Required",
        "Voice speech recognition uses native OS binaries that require a Development Build (or standalone APK). Expo Go does not include custom native modules.\n\nTo use voice input on your phone, build with:\nnpx expo run:android\nor\neas build -p android --profile preview",
        [{ text: "Got it" }]
      );
      return;
    }

    try {
      const perm = await NativeSpeechRecognition.requestPermissionsAsync?.();
      if (perm && !perm.granted) {
        Alert.alert(
          "Permission Required",
          "Please allow microphone and speech recognition access in Settings to use voice input."
        );
        return;
      }

      await NativeSpeechRecognition.start({
        lang: "en-US",
        interimResults: true,
      });
      setIsListening(true);
    } catch (err) {
      console.warn("[VoiceMicButton] Failed to start speech recognition:", err);
      Alert.alert("Voice Input Error", "Could not start speech recognition. Please try again.");
    }
  }, [isListening, onTranscript]);

  return (
    <Pressable
      onPress={toggleListening}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={isListening ? "Stop voice input" : "Start voice input"}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isListening ? colors.danger : colors.surfaceGlass,
          borderColor: isListening ? colors.danger : colors.border,
        },
        disabled && styles.disabled,
      ]}
    >
      {isListening ? (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: colors.danger,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      ) : null}
      <Ionicons
        name={isListening ? "mic" : "mic-outline"}
        size={size * 0.47}
        color={isListening ? "#fff" : colors.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    overflow: "visible",
  },
  disabled: {
    opacity: 0.4,
  },
  pulseRing: {
    borderWidth: 2,
    position: "absolute",
    opacity: 0.4,
  },
});
