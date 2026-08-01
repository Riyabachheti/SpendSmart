import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";

type AuthFieldProps = ComponentProps<"input"> & {
  id: string;
  label: string;
  hint?: string;
};

export function AuthField({ id, label, hint, ...inputProps }: AuthFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label className="mb-2 block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Input
        aria-describedby={hintId}
        className="h-11 bg-card px-3.5"
        id={id}
        {...inputProps}
      />
      {hint ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordField({ id, label, hint, ...inputProps }: AuthFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label className="mb-2 block text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <Input
          aria-describedby={hintId}
          className="h-11 bg-card px-3.5 pr-16"
          id={id}
          type={isVisible ? "text" : "password"}
          {...inputProps}
        />
        <button
          aria-label={`${isVisible ? "Hide" : "Show"} ${label.toLowerCase()}`}
          className="absolute inset-y-0 right-0 cursor-pointer px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setIsVisible((visible) => !visible)}
          type="button"
        >
          {isVisible ? "Hide" : "Show"}
        </button>
      </div>
      {hint ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
