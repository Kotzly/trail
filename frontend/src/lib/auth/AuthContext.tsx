import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { components } from "@/lib/api/types";
import { api, type AuthResponse, type LoginInput, type RegisterInput } from "@/lib/api/client";

export type User = components["schemas"]["User"];

type AuthStatus = "loading" | "authenticated" | "guest";

type AuthContextValue = {
  accessToken: string | null;
  user: User | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<AuthResponse>;
  register: (input: RegisterInput) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const applyAuth = useCallback((token: string, nextUser: User) => {
    setAccessToken(token);
    setUser(nextUser);
    setStatus("authenticated");
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await api.refresh();
      if (res.user) {
        applyAuth(res.accessToken, res.user);
      } else {
        setAccessToken(res.accessToken);
        setUser(null);
        setStatus("authenticated");
      }
    } catch {
      setAccessToken(null);
      setUser(null);
      setStatus("guest");
    }
  }, [applyAuth]);

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await api.login(input);
      applyAuth(res.accessToken, res.user);
      return res;
    },
    [applyAuth]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await api.register(input);
      applyAuth(res.accessToken, res.user);
      return res;
    },
    [applyAuth]
  );

  const logout = useCallback(async () => {
    await api.logout();
    setAccessToken(null);
    setUser(null);
    setStatus("guest");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      accessToken,
      user,
      status,
      login,
      register,
      logout,
      refresh,
    }),
    [accessToken, user, status, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("AuthContext missing");
  }
  return ctx;
}
