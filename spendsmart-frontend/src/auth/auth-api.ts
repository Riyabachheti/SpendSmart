import { apiClient, refreshAccessToken } from "@/lib/api-client";

import type {
  LoginCredentials,
  SignupDetails,
  TokenResponse,
  User,
} from "./auth-types";

export async function signup(details: SignupDetails) {
  const response = await apiClient.post<User>("/auth/signup", details);
  return response.data;
}

export async function login(credentials: LoginCredentials) {
  const response = await apiClient.post<TokenResponse>("/auth/login", credentials);
  return response.data;
}

export async function getCurrentUser(accessToken?: string) {
  const response = await apiClient.get<User>("/auth/me", {
    headers: accessToken
      ? { Authorization: `Bearer ${accessToken}` }
      : undefined,
  });
  return response.data;
}

export async function restoreSession() {
  const accessToken = await refreshAccessToken();
  const user = await getCurrentUser();
  return { accessToken, user };
}

export async function endCurrentSession() {
  await apiClient.post("/auth/logout");
}

export async function endAllSessions() {
  await apiClient.post("/auth/logout-all");
}
