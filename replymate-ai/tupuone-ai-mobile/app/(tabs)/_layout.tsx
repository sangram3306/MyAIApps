import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, View } from "react-native";
import { useAppTheme } from "../../context/app-theme";

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.backgroundDeep,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
        },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon name="home-outline" focused={focused} colors={colors} tone="primary" />,
        }}
      />
      <Tabs.Screen
        name="movie-tracker"
        options={{
          title: "CineTrack",
          tabBarIcon: ({ focused }) => <TabIcon name="film-outline" focused={focused} colors={colors} tone="primary" />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "General Chat",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="chatbox-ellipses-outline" focused={focused} colors={colors} tone="primary" />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ focused }) => <TabIcon name="wallet-outline" focused={focused} colors={colors} tone="primary" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => <TabIcon name="settings-outline" focused={focused} colors={colors} tone="primary" />,
        }}
      />
      <Tabs.Screen name="tools" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="decisions" options={{ href: null }} />
      <Tabs.Screen name="creator" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="coach" options={{ href: null }} />
      <Tabs.Screen name="summary" options={{ href: null }} />
    </Tabs>
  );
}

function TabIcon({
  name,
  focused,
  colors,
  tone = "primary",
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  colors: ReturnType<typeof useAppTheme>["colors"];
  tone?: "primary" | "purple" | "cyan";
}) {
  const accent = tone === "purple" ? colors.purple : tone === "cyan" ? colors.cyan : colors.primary;
  const soft =
    tone === "purple" ? colors.secondarySoft : tone === "cyan" ? colors.cyanSoft : colors.primaryDim;

  return (
    <View
      style={[
        styles.iconShell,
        {
          backgroundColor: focused ? soft : colors.surfaceElevated,
          borderColor: focused ? accent : colors.border,
          shadowColor: accent,
          shadowOpacity: focused ? 0.2 : 0,
        },
      ]}
    >
      <Ionicons name={name} color={focused ? accent : colors.muted} size={17} />
    </View>
  );
}

const styles = StyleSheet.create({
  iconShell: {
    alignItems: "center",
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
    height: 28,
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    width: 28,
  },
});
