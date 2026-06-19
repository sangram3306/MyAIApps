import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_BACKEND_URL } from "../constants/api";
import { defaultLlmPreference, LlmPreference, llmProviders } from "../constants/llm";
import { ThemeMode } from "../constants/theme";
import { FavoriteReply, ReplyHistoryItem } from "./types";

export type AppLockMode = "off" | "faceId" | "fingerprint" | "passcode";

const keys = {
  history: "replymate.history",
  favorites: "replymate.favorites",
  llmPreference: "replymate.llmPreference",
  themeMode: "replymate.themeMode",
  defaultTab: "replymate.defaultTab",
  quickActionsEnabled: "replymate.quickActionsEnabled",
  oneHandedMode: "replymate.oneHandedMode",
  libraryAwareChat: "replymate.libraryAwareChat",
  alwaysUseLlmChat: "replymate.alwaysUseLlmChat",
  ragEnabled: "replymate.ragEnabled",
  smartContextEnabled: "replymate.smartContextEnabled",
  appLockMode: "replymate.appLockMode",
  budgetTarget: "replymate.expenses.budgetTarget",
  budgetWarningThreshold: "replymate.expenses.budgetWarningThreshold",
  autoCategorySuggestions: "replymate.expenses.autoCategorySuggestions",
  quickAddCategories: "replymate.expenses.quickAddCategories",
  watchJournals: "replymate.watch.journals",
};

export type WatchJournalEntry = {
  id: string;
  watchId?: string;
  title: string;
  mood: "loved" | "liked" | "mixed" | "disliked";
  notes: string;
  createdAt: string;
};

export type DefaultTabId = "home" | "library" | "favorites" | "add" | "ai" | "settings" | "coach" | "chat" | "expenses";

export type ExportPayload = {
  exportedAt: string;
  app: {
    llmPreference: LlmPreference;
    themeMode: ThemeMode;
    defaultTab: DefaultTabId;
    quickActionsEnabled: boolean;
    oneHandedMode: boolean;
    libraryAwareChat: boolean;
    alwaysUseLlmChat: boolean;
    ragEnabled: boolean;
    smartContextEnabled: boolean;
    appLockMode: AppLockMode;
    budgetTarget: number | null;
    budgetWarningThreshold: number;
    autoCategorySuggestions: boolean;
    quickAddCategories: string[];
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
  if (!provider || (!model && preference.provider !== "openrouter") || !preference.model?.trim()) {
    return defaultLlmPreference;
  }

  return {
    ...defaultLlmPreference,
    ...preference,
    reasoningEnabled: Boolean(preference.reasoningEnabled),
  };
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

export async function getOneHandedModePreference(): Promise<boolean> {
  return readJson<boolean>(keys.oneHandedMode, false);
}

export async function saveOneHandedModePreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(keys.oneHandedMode, JSON.stringify(enabled));
}

export async function getLibraryAwareChatPreference(): Promise<boolean> {
  return readJson<boolean>(keys.libraryAwareChat, true);
}

export async function saveLibraryAwareChatPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(keys.libraryAwareChat, JSON.stringify(enabled));
}

export async function getAlwaysUseLlmChatPreference(): Promise<boolean> {
  return readJson<boolean>(keys.alwaysUseLlmChat, false);
}

export async function saveAlwaysUseLlmChatPreference(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(keys.alwaysUseLlmChat, JSON.stringify(enabled));
}

export async function getRagEnabledPreference(): Promise<boolean> {
  return readJson<boolean>(keys.ragEnabled, false);
}

export async function saveRagEnabledPreference(value: boolean): Promise<void> {
  await AsyncStorage.setItem(keys.ragEnabled, JSON.stringify(value));
}

export async function getSmartContextEnabledPreference(): Promise<boolean> {
  return readJson<boolean>(keys.smartContextEnabled, false);
}

export async function saveSmartContextEnabledPreference(value: boolean): Promise<void> {
  await AsyncStorage.setItem(keys.smartContextEnabled, JSON.stringify(value));
}

export async function getAppLockModePreference(): Promise<AppLockMode> {
  return readJson<AppLockMode>(keys.appLockMode, "off");
}

export async function saveAppLockModePreference(mode: AppLockMode): Promise<void> {
  await AsyncStorage.setItem(keys.appLockMode, JSON.stringify(mode));
}

export async function getBudgetTargetPreference(): Promise<number | null> {
  return readJson<number | null>(keys.budgetTarget, null);
}

export async function saveBudgetTargetPreference(value: number | null): Promise<void> {
  await AsyncStorage.setItem(keys.budgetTarget, JSON.stringify(value));
}

export async function getBudgetWarningThresholdPreference(): Promise<number> {
  return readJson<number>(keys.budgetWarningThreshold, 80);
}

export async function saveBudgetWarningThresholdPreference(value: number): Promise<void> {
  await AsyncStorage.setItem(keys.budgetWarningThreshold, JSON.stringify(value));
}

export async function getAutoCategorySuggestionsPreference(): Promise<boolean> {
  return readJson<boolean>(keys.autoCategorySuggestions, true);
}

export async function saveAutoCategorySuggestionsPreference(value: boolean): Promise<void> {
  await AsyncStorage.setItem(keys.autoCategorySuggestions, JSON.stringify(value));
}

export async function getQuickAddCategoriesPreference(): Promise<string[]> {
  return readJson<string[]>(keys.quickAddCategories, ["Food", "Groceries", "Transport"]);
}

export async function saveQuickAddCategoriesPreference(values: string[]): Promise<void> {
  const normalized = values.map((item) => item.trim()).filter(Boolean);
  await AsyncStorage.setItem(keys.quickAddCategories, JSON.stringify(normalized));
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
  const [
    llmPreference,
    themeMode,
    defaultTab,
    quickActionsEnabled,
    oneHandedMode,
    libraryAwareChat,
    alwaysUseLlmChat,
    ragEnabled,
    smartContextEnabled,
    appLockMode,
    budgetTarget,
    budgetWarningThreshold,
    autoCategorySuggestions,
    quickAddCategories,
    history,
    favorites,
  ] =
    await Promise.all([
      getLlmPreference(),
      getThemeModePreference(),
      getDefaultTabPreference(),
      getQuickActionsPreference(),
      getOneHandedModePreference(),
      getLibraryAwareChatPreference(),
      getAlwaysUseLlmChatPreference(),
      getRagEnabledPreference(),
      getSmartContextEnabledPreference(),
      getAppLockModePreference(),
      getBudgetTargetPreference(),
      getBudgetWarningThresholdPreference(),
      getAutoCategorySuggestionsPreference(),
      getQuickAddCategoriesPreference(),
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
      oneHandedMode,
      libraryAwareChat,
      alwaysUseLlmChat,
      ragEnabled,
      smartContextEnabled,
      appLockMode,
      budgetTarget,
      budgetWarningThreshold,
      autoCategorySuggestions,
      quickAddCategories,
    },
    history,
    favorites,
  };
}

export async function clearAllLocalAppData(): Promise<void> {
  await Promise.all(
    Object.values(keys).map((key) => AsyncStorage.removeItem(key)),
  );
}

export async function getWatchJournals(): Promise<WatchJournalEntry[]> {
  return readJson<WatchJournalEntry[]>(keys.watchJournals, []);
}

export async function saveWatchJournal(entry: WatchJournalEntry): Promise<void> {
  const current = await getWatchJournals();
  await AsyncStorage.setItem(keys.watchJournals, JSON.stringify([entry, ...current].slice(0, 200)));
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
