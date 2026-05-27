import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_BACKEND_URL } from "../constants/api";
import { defaultLlmPreference, LlmPreference, llmProviders } from "../constants/llm";
import { ThemeMode } from "../constants/theme";
import { FavoriteReply, ReplyHistoryItem } from "./types";

const keys = {
  history: "replymate.history",
  favorites: "replymate.favorites",
  llmPreference: "replymate.llmPreference",
  themeMode: "replymate.themeMode",
  defaultTab: "replymate.defaultTab",
  quickActionsEnabled: "replymate.quickActionsEnabled",
};

export type DefaultTabId = "home" | "coach" | "chat" | "expenses" | "settings";

export type ExportPayload = {
  exportedAt: string;
  app: {
    llmPreference: LlmPreference;
    themeMode: ThemeMode;
    defaultTab: DefaultTabId;
    quickActionsEnabled: boolean;
  };
  history: ReplyHistoryItem[];
  favorites: FavoriteReply[];
};

export async function getBackendUrl(): Promise<string> {
  return DEFAULT_BACKEND_URL;
}

export async function getLlmPreference(): Promise<LlmPreference> {
  const preference = await readJson<LlmPreference>(keys.llmPreference, defaultLlmPreference);
  const provider = llmProviders.find((item) => item.id === preference.provider && item.enabled);
  const model = provider?.models.find((item) => item.value === preference.model);
  if (!provider || !model) {
    return defaultLlmPreference;
  }

  return preference;
}

export async function saveLlmPreference(preference: LlmPreference): Promise<void> {
  await AsyncStorage.setItem(keys.llmPreference, JSON.stringify(preference));
}

export async function getThemeModePreference(): Promise<ThemeMode> {
  return readJson<ThemeMode>(keys.themeMode, "system");
}

export async function saveThemeModePreference(mode: ThemeMode): Promise<void> {
  await AsyncStorage.setItem(keys.themeMode, JSON.stringify(mode));
}

export async function getDefaultTabPreference(): Promise<DefaultTabId> {
  return readJson<DefaultTabId>(keys.defaultTab, "home");
}

export async function saveDefaultTabPreference(tab: DefaultTabId): Promise<void> {
  await AsyncStorage.setItem(keys.defaultTab, JSON.stringify(tab));
}

export async function getQuickActionsPreference(): Promise<boolean> {
  return readJson<boolean>(keys.quickActionsEnabled, true);
}

export async function saveQuickActionsPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(keys.quickActionsEnabled, JSON.stringify(enabled));
}

export async function getHistory(): Promise<ReplyHistoryItem[]> {
  return readJson<ReplyHistoryItem[]>(keys.history, []);
}

export async function addHistoryItem(item: ReplyHistoryItem): Promise<void> {
  const current = await getHistory();
  await AsyncStorage.setItem(keys.history, JSON.stringify([item, ...current].slice(0, 50)));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(keys.history);
}

export async function getFavorites(): Promise<FavoriteReply[]> {
  return readJson<FavoriteReply[]>(keys.favorites, []);
}

export async function saveFavorite(item: FavoriteReply): Promise<void> {
  const current = await getFavorites();
  if (current.some((favorite) => favorite.reply === item.reply)) {
    return;
  }
  await AsyncStorage.setItem(keys.favorites, JSON.stringify([item, ...current]));
}

export async function removeFavorite(id: string): Promise<void> {
  const current = await getFavorites();
  await AsyncStorage.setItem(
    keys.favorites,
    JSON.stringify(current.filter((item) => item.id !== id)),
  );
}

export async function buildLocalExportPayload(): Promise<ExportPayload> {
  const [llmPreference, themeMode, defaultTab, quickActionsEnabled, history, favorites] =
    await Promise.all([
      getLlmPreference(),
      getThemeModePreference(),
      getDefaultTabPreference(),
      getQuickActionsPreference(),
      getHistory(),
      getFavorites(),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    app: {
      llmPreference,
      themeMode,
      defaultTab,
      quickActionsEnabled,
    },
    history,
    favorites,
  };
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
