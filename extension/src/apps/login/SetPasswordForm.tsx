import { i18n } from "#i18n";
import { Card, CardContent } from "@ui/components/ui/card";
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
  password: string;
  confirmPassword: string;
  pending?: boolean;
  confirmError?: string;
  onPasswordChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onSubmit: () => void;
};

export function SetPasswordForm({
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
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-password">
                {i18n.t("login.form.newPasswordLabel")}
              </FieldLabel>
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
              <FieldDescription>{i18n.t("login.form.passwordHint")}</FieldDescription>
            </Field>
            <Field data-invalid={confirmError ? true : undefined}>
              <FieldLabel htmlFor="confirm-password">
                {i18n.t("login.form.confirmPasswordLabel")}
              </FieldLabel>
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
              <Button type="submit" disabled={pending} className="press-feedback">
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending
                  ? i18n.t("login.form.submitUpdating")
                  : i18n.t("login.form.submitUpdatePassword")}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
