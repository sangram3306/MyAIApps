import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_BACKEND_URL } from "../constants/api";
import { defaultLlmPreference, LlmPreference, llmProviders } from "../constants/llm";
import { FavoriteReply, ReplyHistoryItem } from "./types";

const keys = {
  history: "replymate.history",
  favorites: "replymate.favorites",
  llmPreference: "replymate.llmPreference",
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
