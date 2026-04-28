import { i18n } from "#i18n";
import { Card, CardContent } from "@ui/components/ui/card";
import { Button } from "@ui/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@ui/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@ui/components/ui/input-otp";
import { Spinner } from "@ui/components/ui/spinner";

const SLOT_CLASS =
  "size-12 text-base transition-[box-shadow,border-color] duration-(--dur-fast) ease-(--ease-out)";

type VerifyFormProps = {
  otp: string;
  pending?: boolean;
  otpError?: string;
  onOtpChange: (value: string) => void;
  onSubmit: () => void;
  onResend: () => void;
  onChangeEmail: () => void;
};

export function VerifyForm({
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
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <FieldGroup>
            <Field data-invalid={otpError ? true : undefined}>
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
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className={SLOT_CLASS} />
                  <InputOTPSlot index={1} className={SLOT_CLASS} />
                  <InputOTPSlot index={2} className={SLOT_CLASS} />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className={SLOT_CLASS} />
                  <InputOTPSlot index={4} className={SLOT_CLASS} />
                  <InputOTPSlot index={5} className={SLOT_CLASS} />
                </InputOTPGroup>
              </InputOTP>
              {otpError ? <FieldError>{otpError}</FieldError> : null}
            </Field>
            <Field>
              <Button type="submit" disabled={pending} className="press-feedback">
                {pending ? <Spinner data-icon="inline-start" /> : null}
                {pending ? i18n.t("login.verify.submitting") : i18n.t("login.verify.submit")}
              </Button>
            </Field>
            <Field>
              <div className="flex flex-col items-center gap-2 text-sm">
                <span className="text-muted-foreground">{i18n.t("login.verify.didntGetIt")}</span>
                <div className="flex items-center gap-3">
                  <Button
                    variant="link"
                    size="sm"
                    type="button"
                    onClick={onResend}
                    disabled={pending}
                    className="h-auto px-0"
                  >
                    {i18n.t("login.verify.resendCode")}
                  </Button>
                  <span className="text-muted-foreground/50" aria-hidden>
                    ·
                  </span>
                  <Button
                    variant="link"
                    size="sm"
                    type="button"
                    onClick={onChangeEmail}
                    className="h-auto px-0"
                  >
                    {i18n.t("login.verify.useDifferentEmail")}
                  </Button>
                </div>
              </div>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
