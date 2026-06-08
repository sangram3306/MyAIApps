import { useEffect } from "react";
import { router } from "expo-router";
import { getDefaultTabPreference } from "../storage/appStorage";

const tabRoutes: Record<string, string> = {
  home: "/(tabs)",
  chat: "/(tabs)/chat",
  tools: "/(tabs)/tools",
  expenses: "/(tabs)/expenses",
  profile: "/(tabs)/profile",
};

export default function Index() {
  useEffect(() => {
    let active = true;
    getDefaultTabPreference().then((tab) => {
      if (!active) {
        return;
      }

      router.replace((tabRoutes[tab] || "/(tabs)") as never);
    });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
