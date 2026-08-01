import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { getApiErrorMessage } from "@/lib/api-error";

import { AuthField, PasswordField } from "./auth-field";
import { AuthPage } from "./auth-page";

type LoginLocationState = {
  accountCreated?: boolean;
  email?: string;
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

function getSafeDestination(from: LoginLocationState["from"]) {
  const pathname = from?.pathname;

  if (
    !pathname ||
    !pathname.startsWith("/") ||
    pathname.startsWith("//") ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return "/dashboard";
  }

  return `${pathname}${from?.search ?? ""}${from?.hash ?? ""}`;
}

export function LoginPage() {
  useDocumentTitle("Log in");

  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as LoginLocationState | null;
  const [email, setEmail] = useState(
    typeof locationState?.email === "string" ? locationState.email : "",
  );
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login({ email: email.trim().toLowerCase(), password });
      navigate(getSafeDestination(locationState?.from), { replace: true });
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "We couldn’t log you in. Check your connection and try again.",
        ),
      );
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPage
      eyebrow="Welcome back"
      title="Pick up where your spending story left off."
      description="A clear record makes everyday choices easier to understand—without judgment or noise."
      note="Small expenses stop feeling mysterious when they have a place to land."
    >
      <h2 className="text-2xl">Log in</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        New to SpendSmart?{" "}
        <Link
          className="font-medium text-moss hover:text-foreground"
          state={locationState?.from ? { from: locationState.from } : undefined}
          to="/register"
        >
          Create an account
        </Link>
      </p>

      {locationState?.accountCreated ? (
        <p className="mt-6 border-l-2 border-moss pl-4 text-sm leading-6" role="status">
          Your account is ready. Log in to continue.
        </p>
      ) : null}

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        {errorMessage ? (
          <p className="border-l-2 border-destructive pl-4 text-sm leading-6 text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <AuthField
          autoComplete="email"
          id="login-email"
          label="Email address"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <PasswordField
          autoComplete="current-password"
          id="login-password"
          label="Password"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          value={password}
        />
        <Button className="h-11 w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthPage>
  );
}
