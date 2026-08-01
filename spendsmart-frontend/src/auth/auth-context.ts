import { createContext } from "react";

import type {
  AuthStatus,
  LoginCredentials,
  SignupDetails,
  User,
} from "./auth-types";

export type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  signup: (details: SignupDetails) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
