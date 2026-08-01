import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/auth/use-auth";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { getApiErrorMessage } from "@/lib/api-error";

import { AuthField, PasswordField } from "./auth-field";
import { AuthPage } from "./auth-page";

type RegisterLocationState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

export function RegisterPage() {
  useDocumentTitle("Create account");

  const { signup } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as RegisterLocationState | null;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (password !== passwordConfirmation) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    if (new TextEncoder().encode(password).length > 72) {
      setErrorMessage("That password is too long. Please choose a shorter one.");
      return;
    }

    setIsSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      await signup({
        email: normalizedEmail,
        password,
        full_name: fullName.trim() || undefined,
      });
      navigate("/login", {
        replace: true,
        state: {
          accountCreated: true,
          email: normalizedEmail,
          from: locationState?.from,
        },
      });
    } catch (error) {
      setErrorMessage(
        getApiErrorMessage(
          error,
          "We couldn’t create your account. Check your connection and try again.",
        ),
      );
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPage
      eyebrow="Begin simply"
      title="A thoughtful home for everyday spending."
      description="Start with what you spend today. SpendSmart will help you keep the record clear and useful."
      note="No scores, no shame—just a steadier view of where your money goes."
    >
      <h2 className="text-2xl">Create your account</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Already have one?{" "}
        <Link
          className="font-medium text-moss hover:text-foreground"
          state={locationState?.from ? { from: locationState.from } : undefined}
          to="/login"
        >
          Log in
        </Link>
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        {errorMessage ? (
          <p className="border-l-2 border-destructive pl-4 text-sm leading-6 text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <AuthField
          autoComplete="name"
          id="register-name"
          label="Name"
          name="name"
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Optional"
          value={fullName}
        />
        <AuthField
          autoComplete="email"
          id="register-email"
          label="Email address"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <PasswordField
          autoComplete="new-password"
          hint="Use at least 8 characters."
          id="register-password"
          label="Password"
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          value={password}
        />
        <PasswordField
          autoComplete="new-password"
          id="register-password-confirmation"
          label="Confirm password"
          minLength={8}
          name="password-confirmation"
          onChange={(event) => setPasswordConfirmation(event.target.value)}
          required
          value={passwordConfirmation}
        />
        <Button className="h-11 w-full" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthPage>
  );
}
