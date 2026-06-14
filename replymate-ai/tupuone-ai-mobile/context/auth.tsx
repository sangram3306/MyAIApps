import { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getBackendUrl } from "../storage/appStorage";

interface User {
  name?: string;
  email: string;
  id: string;
  profileImage?: string;
  plan?: "pro" | "basic";
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password?: string) => Promise<void>;
  signUp: (name: string, email: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfileImage: (base64Image: string) => Promise<void>;
  updateProfileDetails: (name: string, email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  unsubscribe: () => Promise<void>;
  subscribeWithCoupon: (coupon: string) => Promise<void>;
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

  const updateProfileImage = async (base64Image: string) => {
    const backendUrl = await getBackendUrl();
    if (!backendUrl) throw new Error("Backend URL not configured");
    
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${backendUrl}/api/auth/me/profile-image`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ profileImage: base64Image }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to update profile image");
    }

    setUser(data.user);
  };

  const updateProfileDetails = async (name: string, email: string) => {
    const backendUrl = await getBackendUrl();
    if (!backendUrl) throw new Error("Backend URL not configured");
    
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${backendUrl}/api/auth/me/profile`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name, email }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to update profile");
    }

    setUser(data.user);
  };

  const resetPassword = async (newPassword: string) => {
    const backendUrl = await getBackendUrl();
    if (!backendUrl) throw new Error("Backend URL not configured");
    
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${backendUrl}/api/auth/me/password`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ newPassword }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to reset password");
    }
  };

  const unsubscribe = async () => {
    const backendUrl = await getBackendUrl();
    if (!backendUrl) throw new Error("Backend URL not configured");
    
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${backendUrl}/api/auth/unsubscribe`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to unsubscribe");
    }

    setUser(data.user);
  };

  const subscribeWithCoupon = async (coupon: string) => {
    const backendUrl = await getBackendUrl();
    if (!backendUrl) throw new Error("Backend URL not configured");
    
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) throw new Error("Not authenticated");

    const res = await fetch(`${backendUrl}/api/auth/subscribe-coupon`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ coupon })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to subscribe with coupon");
    }

    setUser(data.user);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, updateProfileImage, updateProfileDetails, resetPassword, unsubscribe, subscribeWithCoupon }}>
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

