import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import {
  clearAuth,
  getStoredUser,
  getToken,
  storeAuth,
  type AuthUser,
} from "@/lib/auth";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    accountType: "Single Person" | "Family",
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (user: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getStoredUser);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Login failed");
    storeAuth(data.token, data.user);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
      accountType: "Single Person" | "Family",
    ) => {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, accountType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      storeAuth(data.token, data.user);
      setUser(data.user);
    },
    [],
  );

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${BASE_URL}/api/user/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const freshUser = await res.json();
    storeAuth(token, freshUser);
    setUser(freshUser);
  }, []);

  const updateUser = useCallback((updatedUser: AuthUser) => {
    const token = getToken();
    if (token) storeAuth(token, updatedUser);
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
