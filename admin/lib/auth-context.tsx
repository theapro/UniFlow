"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { authApi } from "@/lib/api";
import type { User } from "@/types/auth.types";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = () => {
    const storedUser = authApi.getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }
  };

  useEffect(() => {
    // Check if user is already logged in
    refreshUser();
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login({ email, password });
    if (response.data.success) {
      const { token, user: userData } = response.data.data;
      authApi.storeAuth(token, userData);
      setUser(userData);
    } else {
      throw new Error(response.data.message || "Login failed");
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
    // Force redirect to login
    if (typeof window !== "undefined") {
      const pathParts = window.location.pathname.split("/");
      const lang = pathParts[1] || "en";
      window.location.href = `/${lang}/login`;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
