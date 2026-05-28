import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../context/app-theme";

export default function TabsLayout() {
  const { colors } = useAppTheme();

  return (
    <Tabs
      tabBar={(props) => <ScrollableTabBar {...props} colors={colors} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.ink,
          borderTopColor: colors.border,
          height: 66,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="decisions"
        options={{
          title: "Decisions",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="git-compare-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="creator"
        options={{
          title: "Creator",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="color-wand-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          href: null,
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          href: null,
          title: "Favorites",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "Coach",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          href: null,
          title: "Summary",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

function ScrollableTabBar({
  state,
  descriptors,
  navigation,
  colors,
}: BottomTabBarProps & { colors: ReturnType<typeof useAppTheme>["colors"] }) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options as { href?: unknown } | undefined;
    return options?.href !== null;
  });

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBarContent}
      >
        {visibleRoutes.map((route) => {
          const index = state.routes.findIndex((item) => item.key === route.key);
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title || (route.name === "index" ? "Home" : route.name);
          const color = isFocused
            ? options.tabBarActiveTintColor || colors.primary
            : options.tabBarInactiveTintColor || colors.muted;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : undefined}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onLongPress={onLongPress}
              onPress={onPress}
              style={[styles.tabItem, isFocused && styles.tabItemActive]}
            >
              {options.tabBarIcon
                ? options.tabBarIcon({
                    focused: isFocused,
                    color,
                    size: 20,
                  })
                : null}
              <Text style={[styles.tabLabel, { color }]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    tabBar: {
      backgroundColor: colors.ink,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      paddingTop: 8,
    },
    tabBarContent: {
      gap: 8,
      paddingHorizontal: 10,
    },
    tabItem: {
      alignItems: "center",
      borderColor: "transparent",
      borderRadius: 18,
      borderWidth: 1,
      gap: 3,
      justifyContent: "center",
      minHeight: 52,
      minWidth: 82,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    tabItemActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.borderStrong,
    },
    tabLabel: {
      fontSize: 11,
      fontWeight: "800",
    },
  });
}
