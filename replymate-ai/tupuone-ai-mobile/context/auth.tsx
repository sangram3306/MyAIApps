import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBackendUrl } from "../storage/appStorage";

interface User {
  name?: string;
  email: string;
  id: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  signUp: (name: string, email: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_STORAGE_KEY = "@replymate_jwt";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        if (token) {
          const backendUrl = await getBackendUrl();
          if (backendUrl) {
            const res = await fetch(`${backendUrl}/api/auth/me`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const data = await res.json();
              setUser(data.user);
            } else {
              // Token might be expired
              await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
            }
          }
        }
      } catch (error) {
        console.warn("Failed to load auth session", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, []);

  const signIn = async (email: string, password?: string) => {
    if (!email) throw new Error("Email is required");
    if (!password) throw new Error("Password is required");

    const backendUrl = await getBackendUrl();
    if (!backendUrl) throw new Error("Backend URL not configured");

    const res = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to sign in");
    }

    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(data.user);
  };

  const signUp = async (name: string, email: string, password?: string) => {
    if (!name) throw new Error("Name is required");
    if (!email) throw new Error("Email is required");
    if (!password) throw new Error("Password is required");

    const backendUrl = await getBackendUrl();
    if (!backendUrl) throw new Error("Backend URL not configured");

    const res = await fetch(`${backendUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to sign up");
    }

    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setUser(data.user);
  };

  const signOut = async () => {
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

