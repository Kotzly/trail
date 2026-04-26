import { i18n } from "#i18n";
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
        <CardTitle className="text-xl">{i18n.t("login.verify.title")}</CardTitle>
        <CardDescription>
          {i18n.t("login.verify.descriptionPrefix")}{" "}
          <strong className="text-foreground">{email}</strong>
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
                {i18n.t("login.verify.codeLabel")}
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
                  <InputOTPSlot
                    index={0}
                    className="size-11 text-base transition-[box-shadow,border-color] duration-(--dur-fast) ease-(--ease-out)"
                  />
                  <InputOTPSlot
                    index={1}
                    className="size-11 text-base transition-[box-shadow,border-color] duration-(--dur-fast) ease-(--ease-out)"
                  />
                  <InputOTPSlot
                    index={2}
                    className="size-11 text-base transition-[box-shadow,border-color] duration-(--dur-fast) ease-(--ease-out)"
                  />
                  <InputOTPSlot
                    index={3}
                    className="size-11 text-base transition-[box-shadow,border-color] duration-(--dur-fast) ease-(--ease-out)"
                  />
                  <InputOTPSlot
                    index={4}
                    className="size-11 text-base transition-[box-shadow,border-color] duration-(--dur-fast) ease-(--ease-out)"
                  />
                  <InputOTPSlot
                    index={5}
                    className="size-11 text-base transition-[box-shadow,border-color] duration-(--dur-fast) ease-(--ease-out)"
                  />
                </InputOTPGroup>
              </InputOTP>
              {otpError ? <FieldError>{otpError}</FieldError> : null}
            </Field>
            <Field>
              <Button type="submit" disabled={pending} className="press-feedback">
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? i18n.t("login.verify.verifying") : i18n.t("login.verify.verifyCode")}
              </Button>
              <FieldDescription className="text-center">
                {i18n.t("login.verify.didntGetIt")}{" "}
                <Button
                  variant="link"
                  size="sm"
                  type="button"
                  onClick={onResend}
                  disabled={pending}
                  className="press-feedback h-auto px-0"
                >
                  {i18n.t("login.verify.resendCode")}
                </Button>
                {" · "}
                <Button
                  variant="link"
                  size="sm"
                  type="button"
                  onClick={onChangeEmail}
                  className="press-feedback h-auto px-0"
                >
                  {i18n.t("login.verify.useDifferentEmail")}
                </Button>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
