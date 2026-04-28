import { i18n } from "#i18n";
import { cn } from "@ui/lib/utils";
import { Button } from "@ui/components/ui/button";
import { Card, CardContent } from "@ui/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@ui/components/ui/field";
import { Input } from "@ui/components/ui/input";
import { GoogleMark } from "@ui/components/google-mark";

type SignUpFormProps = Omit<React.ComponentProps<"div">, "onSubmit"> & {
  email: string;
  password: string;
  pending?: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onGoogle: () => void;
  onSignIn: () => void;
};

export function SignUpForm({
  className,
  email,
  password,
  pending,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGoogle,
  onSignIn,
  ...props
}: SignUpFormProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
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
                <Button
                  variant="outline"
                  type="button"
                  onClick={onGoogle}
                  disabled={pending}
                  className="press-feedback"
                >
                  <GoogleMark />
                  {i18n.t("login.form.continueWithGoogle")}
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                {i18n.t("login.form.or")}
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">{i18n.t("login.form.emailLabel")}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder={i18n.t("login.form.emailPlaceholder")}
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{i18n.t("login.form.passwordLabel")}</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  disabled={pending}
                />
                <FieldDescription>{i18n.t("login.form.passwordHint")}</FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={pending} className="press-feedback">
                  {i18n.t("login.form.submitSignUp")}
                </Button>
                <FieldDescription className="text-center">
                  {i18n.t("login.form.haveAccount")}{" "}
                  <Button
                    variant="link"
                    size="sm"
                    type="button"
                    onClick={onSignIn}
                    className="h-auto px-0"
                  >
                    {i18n.t("login.form.switchToSignIn")}
                  </Button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-2 text-center">
        {i18n.t("login.actions.termsPrefix")}{" "}
        <a href="https://gettrail.net/terms" target="_blank" rel="noreferrer">
          {i18n.t("login.actions.termsOfService")}
        </a>{" "}
        {i18n.t("login.actions.and")}{" "}
        <a href="https://gettrail.net/privacy" target="_blank" rel="noreferrer">
          {i18n.t("login.actions.privacyPolicy")}
        </a>
        .
      </FieldDescription>
    </div>
  );
}
