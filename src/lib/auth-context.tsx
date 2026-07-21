"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as api from "./api";
import type { User } from "./types";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

interface AuthState {
  user: User | null;
  token: string | null;
  // False until the localStorage read has happened on the client. RequireAuth
  // waits for this before deciding to redirect, so a logged-in user isn't
  // briefly bounced to /login while the token is still loading.
  isHydrated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Start "logged out" on both server and first client render so hydration
  // never mismatches; the real (possibly logged-in) state is applied in the
  // effect below, which only ever runs in the browser.
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isHydrated: false,
  });

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = token ? readStoredUser() : null;
    api.setAuthToken(token);
    setState({ token, user, isHydrated: true });
  }, []);

  const persist = useCallback((token: string | null, user: User | null) => {
    api.setAuthToken(token);
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
    setState({ token, user, isHydrated: true });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      persist(res.token, res.user);
    },
    [persist]
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const res = await api.register(email, password);
      persist(res.token, res.user);
    },
    [persist]
  );

  const logout = useCallback(() => {
    persist(null, null);
  }, [persist]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Reads the current auth state/actions. Must be used within <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
