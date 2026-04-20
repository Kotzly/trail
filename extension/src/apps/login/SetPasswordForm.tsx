import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Button } from "@ui/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@ui/components/ui/field";
import { Input } from "@ui/components/ui/input";
import { Spinner } from "@ui/components/ui/spinner";

type SetPasswordFormProps = {
  email: string;
  password: string;
  confirmPassword: string;
  pending?: boolean;
  confirmError?: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onSubmit: () => void;
};

export function SetPasswordForm({
  email,
  password,
  confirmPassword,
  pending,
  confirmError,
  onPasswordChange,
  onConfirmChange,
  onSubmit,
}: SetPasswordFormProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>
          Signed in as <strong className="text-foreground">{email}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                disabled={pending}
                autoFocus
              />
              <FieldDescription>Letters and numbers, at least 8 characters.</FieldDescription>
            </Field>
            <Field data-invalid={confirmError ? true : undefined}>
              <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => onConfirmChange(e.target.value)}
                aria-invalid={confirmError ? true : undefined}
                disabled={pending}
              />
              {confirmError ? <FieldError>{confirmError}</FieldError> : null}
            </Field>
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? "Updating…" : "Update password"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
