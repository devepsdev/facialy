/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import client, { refreshAccess, setAccessToken } from "../api/client";

const AuthContext = createContext(null);

export const ROLE_LABEL = { viewer: "Invitado", user: "Usuario", admin: "Administrador", superadmin: "Superadmin" };

/** Página de inicio según el rol. */
export const homeFor = (role) => (role === "user" ? "/me" : "/dashboard");

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const accept = useCallback((data) => {
    setAccessToken(data.access);
    setUser(data.user);
    return data.user;
  }, []);

  // Al cargar la app se intenta restaurar la sesión con la cookie del refresh token
  useEffect(() => {
    let alive = true;
    refreshAccess()
      .then((data) => alive && setUser(data.user))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener("facialy:unauthorized", onExpired);
    return () => window.removeEventListener("facialy:unauthorized", onExpired);
  }, []);

  const login = useCallback(async (username, password) => accept((await client.post("auth/login/", { username, password })).data), [accept]);
  const register = useCallback(async (payload) => accept((await client.post("auth/register/", payload)).data), [accept]);
  const loginAsGuest = useCallback(async () => accept((await client.post("auth/guest/")).data), [accept]);

  const logout = useCallback(async () => {
    try {
      await axios.post("/facialy/api/auth/logout/");
    } catch {
      /* se descarta la sesión local igualmente */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => {
    const role = user?.role;
    return {
      user, role, loading, login, register, loginAsGuest, logout,
      isAdmin: role === "admin" || role === "superadmin",
      isSuper: role === "superadmin",
      isViewer: role === "viewer",
      isUser: role === "user",
    };
  }, [user, loading, login, register, loginAsGuest, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
