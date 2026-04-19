import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/components/ui/card";
import { Button } from "@ui/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@ui/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@ui/components/ui/input-otp";
import { Spinner } from "@ui/components/ui/spinner";

type VerifyFormProps = {
  email: string;
  otp: string;
  pending?: boolean;
  otpError?: string;
  onOtpChange: (value: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  onChangeEmail: () => void;
};

export function VerifyForm({
  email,
  otp,
  pending,
  otpError,
  onOtpChange,
  onSubmit,
  onResend,
  onChangeEmail,
}: VerifyFormProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Confirm your email</CardTitle>
        <CardDescription>
          We sent a 6-digit code to <strong className="text-foreground">{email}</strong>
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
            <Field data-invalid={otpError ? true : undefined} className="items-center">
              <FieldLabel htmlFor="otp" className="sr-only">
                6-digit code
              </FieldLabel>
              <InputOTP
                id="otp"
                maxLength={6}
                value={otp}
                onChange={onOtpChange}
                autoFocus
                disabled={pending}
                aria-invalid={otpError ? true : undefined}
                containerClassName="gap-1"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="size-11 text-base" />
                  <InputOTPSlot index={1} className="size-11 text-base" />
                  <InputOTPSlot index={2} className="size-11 text-base" />
                  <InputOTPSlot index={3} className="size-11 text-base" />
                  <InputOTPSlot index={4} className="size-11 text-base" />
                  <InputOTPSlot index={5} className="size-11 text-base" />
                </InputOTPGroup>
              </InputOTP>
              {otpError ? <FieldError>{otpError}</FieldError> : null}
            </Field>
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? "Verifying…" : "Verify code"}
              </Button>
              <FieldDescription className="text-center">
                Didn't get it?{" "}
                <button
                  type="button"
                  onClick={onResend}
                  disabled={pending}
                  className="underline underline-offset-4 disabled:opacity-50"
                >
                  Resend code
                </button>
                {" · "}
                <button
                  type="button"
                  onClick={onChangeEmail}
                  className="underline underline-offset-4"
                >
                  Use a different email
                </button>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
