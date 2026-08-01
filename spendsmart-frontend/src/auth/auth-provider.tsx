import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { queryClient } from "@/lib/query-client";

import { setAccessToken } from "./access-token";
import {
  endAllSessions,
  endCurrentSession,
  getCurrentUser,
  login as loginRequest,
  restoreSession,
  signup,
} from "./auth-api";
import { AuthContext } from "./auth-context";
import type {
  AuthStatus,
  LoginCredentials,
  User,
} from "./auth-types";
import { registerSessionExpiredHandler } from "./session-events";

export function AuthProvider({ children }: PropsWithChildren) {
  const userIdRef = useRef<number | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  const clearUserCache = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
  }, []);

  const clearLocalSession = useCallback(async () => {
    setAccessToken(null);
    userIdRef.current = null;
    setUser(null);
    setStatus("anonymous");
    await clearUserCache();
  }, [clearUserCache]);

  const applySession = useCallback(
    async (accessToken: string, nextUser: User) => {
      const isAccountChange =
        userIdRef.current !== null && userIdRef.current !== nextUser.id;

      if (isAccountChange) {
        setAccessToken(null);
        await clearUserCache();
      }

      setAccessToken(accessToken);
      userIdRef.current = nextUser.id;
      setUser(nextUser);
      setStatus("authenticated");
    },
    [clearUserCache],
  );

  useEffect(() => registerSessionExpiredHandler(clearLocalSession), [clearLocalSession]);

  useEffect(() => {
    let isActive = true;

    void restoreSession()
      .then(({ accessToken, user: restoredUser }) => {
        if (isActive) {
          return applySession(accessToken, restoredUser);
        }
      })
      .catch(() => {
        if (isActive) {
          return clearLocalSession();
        }
      });

    return () => {
      isActive = false;
    };
  }, [applySession, clearLocalSession]);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const token = await loginRequest(credentials);

      try {
        const authenticatedUser = await getCurrentUser(token.access_token);
        await applySession(token.access_token, authenticatedUser);
        return authenticatedUser;
      } catch (error) {
        await clearLocalSession();
        throw error;
      }
    },
    [applySession, clearLocalSession],
  );

  const logout = useCallback(async () => {
    try {
      await endCurrentSession();
    } finally {
      await clearLocalSession();
    }
  }, [clearLocalSession]);

  const logoutAll = useCallback(async () => {
    try {
      await endAllSessions();
    } finally {
      await clearLocalSession();
    }
  }, [clearLocalSession]);

  const value = useMemo(
    () => ({
      status,
      user,
      isAuthenticated: status === "authenticated",
      login,
      signup,
      logout,
      logoutAll,
    }),
    [login, logout, logoutAll, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
