import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";

import { getAccessToken, setAccessToken } from "@/auth/access-token";
import { notifySessionExpired } from "@/auth/session-events";
import type { TokenResponse } from "@/auth/auth-types";

const clientOptions = {
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
};

const refreshClient = axios.create(clientOptions);

export const apiClient = axios.create(clientOptions);

type RetriableRequest = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<string> | null = null;

const nonRefreshableRoutes = new Set([
  "/auth/login",
  "/auth/signup",
  "/auth/refresh",
  "/auth/logout",
]);

function isRefreshableRequest(config: RetriableRequest) {
  const requestPath = config.url?.split("?")[0];
  return requestPath !== undefined && !nonRefreshableRoutes.has(requestPath);
}

export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<TokenResponse>("/auth/refresh")
      .then((response) => {
        const nextAccessToken = response.data.access_token;
        setAccessToken(nextAccessToken);
        return nextAccessToken;
      })
      .catch(async (error: unknown) => {
        setAccessToken(null);
        await notifySessionExpired();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const accessToken = getAccessToken();

  if (accessToken && !config.headers.has("Authorization")) {
    config.headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetriableRequest | undefined;

    if (
      error.response?.status !== 401 ||
      !request ||
      request._retry ||
      !isRefreshableRequest(request)
    ) {
      throw error;
    }

    request._retry = true;
    const nextAccessToken = await refreshAccessToken();
    request.headers.set("Authorization", `Bearer ${nextAccessToken}`);

    return apiClient(request);
  },
);
