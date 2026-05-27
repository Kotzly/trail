import { i18n } from "#i18n";
import { cn } from "@ui/lib/utils";
import { Button } from "@ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@ui/components/ui/field";
import { Input } from "@ui/components/ui/input";
import { OAuthButton, OAuthStatus, type OAuthInFlight } from "@ui/components/oauth-button";

type I18nArg = Parameters<typeof i18n.t>[0];

type SignUpFormProps = Omit<React.ComponentProps<"div">, "onSubmit"> & {
  email: string;
  password: string;
  pending?: boolean;
  oauth?: OAuthInFlight | null;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onGoogle: () => void;
  onGithub: () => void;
  onSignIn: () => void;
};

export function SignUpForm({
  className,
  email,
  password,
  pending,
  oauth,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGoogle,
  onGithub,
  onSignIn,
  ...props
}: SignUpFormProps) {
  return (
    <div
      className={cn(
        "animate-in fade-in-0 slide-in-from-bottom-2 flex flex-col gap-6 duration-(--dur-medium) ease-(--ease-out)",
        className,
      )}
      {...props}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {i18n.t("login.signupForm.createAccount" as I18nArg)}
          </CardTitle>
          <CardDescription>
            {i18n.t("login.signupForm.createDescription" as I18nArg)}
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
                <OAuthButton
                  provider="google"
                  label={i18n.t("login.signupForm.signUpWithGoogle" as I18nArg)}
                  onClick={onGoogle}
                  pending={pending}
                  active={oauth?.provider === "google"}
                />
              </Field>
              <Field>
                <OAuthButton
                  provider="github"
                  label={i18n.t("login.signupForm.signUpWithGithub" as I18nArg)}
                  onClick={onGithub}
                  pending={pending}
                  active={oauth?.provider === "github"}
                />
                <OAuthStatus oauth={oauth} />
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                {i18n.t("login.form.orContinueWith" as I18nArg)}
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">
                  {i18n.t("login.form.emailLabel" as I18nArg)}
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder={i18n.t("login.form.emailPlaceholder" as I18nArg)}
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">
                  {i18n.t("login.form.passwordLabel" as I18nArg)}
                </FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  disabled={pending}
                />
                <FieldDescription>
                  {i18n.t("login.signupForm.passwordHint" as I18nArg)}
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={pending} className="press-feedback">
                  {i18n.t("login.signupForm.submit" as I18nArg)}
                </Button>
                <FieldDescription className="text-center">
                  {i18n.t("login.signupForm.haveAccount" as I18nArg)}{" "}
                  <Button
                    variant="link"
                    size="sm"
                    type="button"
                    onClick={onSignIn}
                    className="press-feedback h-auto px-0"
                  >
                    {i18n.t("login.signupForm.signIn" as I18nArg)}
                  </Button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        {i18n.t("login.signupForm.termsPrefix" as I18nArg)}{" "}
        <a href="https://gettrail.net/terms" target="_blank" rel="noreferrer">
          {i18n.t("login.form.termsOfService" as I18nArg)}
        </a>{" "}
        {i18n.t("login.form.and" as I18nArg)}{" "}
        <a href="https://gettrail.net/privacy" target="_blank" rel="noreferrer">
          {i18n.t("login.form.privacyPolicy" as I18nArg)}
        </a>
        .
      </FieldDescription>
    </div>
  );
}
