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
                  {i18n.t("login.signupForm.signUpWithGoogle" as I18nArg)}
                </Button>
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
