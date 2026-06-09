import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_BACKEND_URL } from "../constants/api";
import { defaultLlmPreference, LlmPreference, llmProviders } from "../constants/llm";
import { ThemeMode } from "../constants/theme";
import { FavoriteReply, ReplyHistoryItem } from "./types";

export type AppLockMode = "off" | "faceId" | "fingerprint" | "passcode";
export type ResponseCountPreference = 1 | 2 | 3 | 4 | 5;

const keys = {
  history: "replymate.history",
  favorites: "replymate.favorites",
  llmPreference: "replymate.llmPreference",
  themeMode: "replymate.themeMode",
  defaultTab: "replymate.defaultTab",
  quickActionsEnabled: "replymate.quickActionsEnabled",
  appLockMode: "replymate.appLockMode",
  replyResponseCount: "replymate.replyResponseCount",
  rewriteResponseCount: "replymate.rewriteResponseCount",
  budgetTarget: "replymate.expenses.budgetTarget",
  budgetWarningThreshold: "replymate.expenses.budgetWarningThreshold",
  autoCategorySuggestions: "replymate.expenses.autoCategorySuggestions",
  quickAddCategories: "replymate.expenses.quickAddCategories",
};

export type DefaultTabId = "home" | "movieTracker" | "chat" | "expenses" | "settings";

export type ExportPayload = {
  exportedAt: string;
  app: {
    llmPreference: LlmPreference;
    themeMode: ThemeMode;
    defaultTab: DefaultTabId;
    quickActionsEnabled: boolean;
    appLockMode: AppLockMode;
    replyResponseCount: ResponseCountPreference;
    rewriteResponseCount: ResponseCountPreference;
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
  const stored = await readJson<string>(keys.defaultTab, "home");
  if (stored === "coach" || stored === "tools") {
    return "chat";
  }
  if (stored === "profile") {
    return "settings";
  }
  if (["home", "movieTracker", "chat", "expenses", "settings"].includes(stored)) {
    return stored as DefaultTabId;
  }
  return "home";
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

export async function getAppLockModePreference(): Promise<AppLockMode> {
  return readJson<AppLockMode>(keys.appLockMode, "off");
}

export async function saveAppLockModePreference(mode: AppLockMode): Promise<void> {
  await AsyncStorage.setItem(keys.appLockMode, JSON.stringify(mode));
}

export async function getReplyResponseCountPreference(): Promise<ResponseCountPreference> {
  return normalizeResponseCount(await readJson<number>(keys.replyResponseCount, 5));
}

export async function saveReplyResponseCountPreference(value: number): Promise<void> {
  await AsyncStorage.setItem(keys.replyResponseCount, JSON.stringify(normalizeResponseCount(value)));
}

export async function getRewriteResponseCountPreference(): Promise<ResponseCountPreference> {
  return normalizeResponseCount(await readJson<number>(keys.rewriteResponseCount, 5));
}

export async function saveRewriteResponseCountPreference(value: number): Promise<void> {
  await AsyncStorage.setItem(keys.rewriteResponseCount, JSON.stringify(normalizeResponseCount(value)));
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
    appLockMode,
    replyResponseCount,
    rewriteResponseCount,
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
      getAppLockModePreference(),
      getReplyResponseCountPreference(),
      getRewriteResponseCountPreference(),
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
      appLockMode,
      replyResponseCount,
      rewriteResponseCount,
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

function normalizeResponseCount(value: number): ResponseCountPreference {
  if (!Number.isFinite(value)) {
    return 5;
  }

  const normalized = Math.min(5, Math.max(1, Math.trunc(value)));
  return normalized as ResponseCountPreference;
}
