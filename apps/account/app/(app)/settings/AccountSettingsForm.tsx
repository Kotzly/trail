"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  initialUpdateAccountActionState,
  updateAccountAction,
} from "./actions";

type AccountSettingsFormProps = {
  initialFirstName: string;
  initialLastName: string;
  initialEmail: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "saving..." : "save"}
    </Button>
  );
}

function FormField({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  );
}

export function AccountSettingsForm({
  initialFirstName,
  initialLastName,
  initialEmail,
}: AccountSettingsFormProps) {
  const [state, formAction] = useActionState(
    updateAccountAction,
    initialUpdateAccountActionState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="first name"
          name="firstName"
          defaultValue={initialFirstName}
          placeholder="Ivan"
          autoComplete="given-name"
        />
        <FormField
          label="last name"
          name="lastName"
          defaultValue={initialLastName}
          placeholder="Ivanov"
          autoComplete="family-name"
        />
      </div>

      <FormField
        label="email"
        name="email"
        type="email"
        defaultValue={initialEmail}
        placeholder="you@company.com"
        autoComplete="email"
      />

      <div className="flex items-center gap-3">
        <SubmitButton />

        {state.message ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={
              state.status === "error"
                ? "text-sm text-destructive"
                : "text-sm text-emerald-600"
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
