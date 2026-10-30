import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("library_user")); } catch { return null; }
  });
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem("library_token");
    localStorage.removeItem("library_user");
    setUser(null);
  }, []);

  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener("library:session-expired", onExpired);
    async function loadProfile() {
      const token = localStorage.getItem("library_token");
      if (!token) { setReady(true); return; }
      try {
        const { data } = await api.get("/auth/me");
        setUser(data);
        localStorage.setItem("library_user", JSON.stringify(data));
      } catch {
        logout();
      } finally {
        setReady(true);
      }
    }
    loadProfile();
    return () => window.removeEventListener("library:session-expired", onExpired);
  }, [logout]);

  const login = async (credentials) => {
    const { data } = await api.post("/auth/login", credentials);
    localStorage.setItem("library_token", data.token);
    localStorage.setItem("library_user", JSON.stringify(data.user));
    setUser(data.user);
  };
  const refreshUser = async () => {
    const { data } = await api.get("/auth/me");
    localStorage.setItem("library_user", JSON.stringify(data));
    setUser(data);
  };
  const value = useMemo(() => ({ user, ready, login, logout, refreshUser, setUser }), [user, ready, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
