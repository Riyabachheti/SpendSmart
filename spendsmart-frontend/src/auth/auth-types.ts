export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
};

export type User = {
  id: number;
  email: string;
  full_name: string | null;
  created_at: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type SignupDetails = LoginCredentials & {
  full_name?: string;
};
