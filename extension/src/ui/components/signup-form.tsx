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
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Create account with Google or email</CardDescription>
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
                <Button variant="outline" type="button" onClick={onGoogle} disabled={pending}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  Sign up with Google
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="me@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  disabled={pending}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
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
                  At least 8 characters with uppercase, lowercase, a number, and a symbol.
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" disabled={pending}>
                  Create account
                </Button>
                <FieldDescription className="text-center">
                  Already have an account?{" "}
                  <button type="button" onClick={onSignIn} className="underline underline-offset-4">
                    Sign in
                  </button>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our{" "}
        <a href="https://gettrail.net/terms" target="_blank" rel="noreferrer">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="https://gettrail.net/privacy" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
        .
      </FieldDescription>
    </div>
  );
}
