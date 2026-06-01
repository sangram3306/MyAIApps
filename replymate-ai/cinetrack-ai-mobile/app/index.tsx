import { useEffect } from "react";
import { router } from "expo-router";
import { getDefaultTabPreference } from "../storage/appStorage";

const tabRoutes: Record<string, string> = {
  home: "/(tabs)/library",
  library: "/(tabs)/library",
  favorites: "/(tabs)/favorites",
  add: "/(tabs)/add",
  ai: "/(tabs)/ai",
  settings: "/(tabs)/settings",
};

export default function Index() {
  useEffect(() => {
    let active = true;
    getDefaultTabPreference().then((tab) => {
      if (!active) {
        return;
      }

      router.replace((tabRoutes[tab] || "/(tabs)/library") as never);
    });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
