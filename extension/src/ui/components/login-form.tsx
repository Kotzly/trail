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

type I18nArg = Parameters<typeof i18n.t>[0];

type LoginFormProps = Omit<React.ComponentProps<"div">, "onSubmit"> & {
  email: string;
  password: string;
  pending?: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onGoogle: () => void;
  onGithub: () => void;
  onForgot: () => void;
  onSignUp: () => void;
};

export function LoginForm({
  className,
  email,
  password,
  pending,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onGoogle,
  onGithub,
  onForgot,
  onSignUp,
  ...props
}: LoginFormProps) {
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
          <CardTitle className="text-xl">{i18n.t("login.form.welcomeBack" as I18nArg)}</CardTitle>
          <CardDescription>{i18n.t("login.form.signInDescription" as I18nArg)}</CardDescription>
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
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={onGoogle}
                    disabled={pending}
                    className="press-feedback"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path
                        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                        fill="currentColor"
                      />
                    </svg>
                    {i18n.t("login.form.loginWithGoogle" as I18nArg)}
                  </Button>
                  <Button
                    variant="outline"
                    type="button"
                    onClick={onGithub}
                    disabled={pending}
                    className="press-feedback"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path
                        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                        fill="currentColor"
                      />
                    </svg>
                    {i18n.t("login.form.loginWithGithub" as I18nArg)}
                  </Button>
                </div>
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
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">
                    {i18n.t("login.form.passwordLabel" as I18nArg)}
                  </FieldLabel>
                  <Button
                    variant="link"
                    size="sm"
                    type="button"
                    onClick={onForgot}
                    disabled={pending}
                    className="press-feedback ml-auto h-auto px-0"
                  >
                    {i18n.t("login.form.forgotPassword" as I18nArg)}
                  </Button>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Field>
                <Button type="submit" disabled={pending} className="press-feedback">
                  {i18n.t("login.form.login" as I18nArg)}
                </Button>
                <FieldDescription className="text-center">
                  {i18n.t("login.form.noAccount" as I18nArg)}{" "}
                  <Button
                    variant="link"
                    size="sm"
                    type="button"
                    onClick={onSignUp}
                    className="press-feedback h-auto px-0"
                  >
                    {i18n.t("login.form.signUp" as I18nArg)}
                  </Button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        {i18n.t("login.form.termsPrefix" as I18nArg)}{" "}
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
