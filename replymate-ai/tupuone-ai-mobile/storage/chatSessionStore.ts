import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatMessageResponse } from "../services/api";

export type ChatSessionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  userMessage?: string;
  toolCalls?: ChatMessageResponse["toolCalls"];
  agentTrace?: string[];
  metadata?: ChatMessageResponse["metadata"];
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatSessionMessage[];
};

const keys = {
  chatSessions: "replymate.chatSessions",
};

export async function listChatSessions(): Promise<ChatSession[]> {
  try {
    const raw = await AsyncStorage.getItem(keys.chatSessions);
    if (!raw) return [];
    const sessions: ChatSession[] = JSON.parse(raw);
    return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error("Failed to list chat sessions:", error);
    return [];
  }
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  try {
    const sessions = await listChatSessions();
    const index = sessions.findIndex((s) => s.id === session.id);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    await AsyncStorage.setItem(keys.chatSessions, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to save chat session:", error);
  }
}

export async function deleteChatSession(id: string): Promise<void> {
  try {
    const sessions = await listChatSessions();
    const updated = sessions.filter((s) => s.id !== id);
    await AsyncStorage.setItem(keys.chatSessions, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to delete chat session:", error);
  }
}
