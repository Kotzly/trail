import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTranslation } from "react-i18next";

type Purpose = "login" | "register";

export default function EmailConfirmPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { confirmEmailCode, startEmailCode } = useAuth();
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const email = searchParams.get("email") ?? "";
  const purpose = (searchParams.get("purpose") as Purpose) ?? "login";
  const displayName = searchParams.get("displayName") ?? undefined;

  const schema = useMemo(
    () =>
      z.object({
        code: z.string().min(4, t("emailConfirm.validation.code")),
      }),
    [i18n.language, t]
  );

  type FormValues = z.infer<typeof schema>;

  const title = useMemo(() => {
    return purpose === "register" ? t("emailConfirm.titleRegister") : t("emailConfirm.titleLogin");
  }, [purpose, t]);

  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setInfo(null);
    try {
      await confirmEmailCode({
        email,
        code: values.code,
        purpose,
        displayName,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(t("emailConfirm.errors.invalidOrExpired"));
    }
  });

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError(t("emailConfirm.errors.missingEmail"));
      return;
    }
    try {
      await startEmailCode({ email, purpose, displayName });
      setInfo(t("emailConfirm.info.resent"));
    } catch (err) {
      setError(t("emailConfirm.errors.resendFailed"));
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16 md:flex-row">
      <div className="flex-1">
        <h1 className="font-display text-4xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-ink-subtle">
          {t("emailConfirm.subtitle", { email: email || t("emailConfirm.yourEmail") })}
        </p>
      </div>
      <div className="w-full max-w-md rounded-3xl border border-stroke/40 bg-surface/80 p-8 shadow-card">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {t("emailConfirm.code")}
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              {...register("code")}
              className="mt-2 w-full rounded-2xl border border-stroke/60 bg-surface px-4 py-3 text-sm tracking-[0.4em] text-ink focus:border-ink/40 focus:outline-none"
            />
            {formState.errors.code && <p className="mt-1 text-xs text-ink">{formState.errors.code.message}</p>}
          </div>
          {error && <div className="rounded-2xl border border-ink/20 bg-ink/10 px-4 py-3 text-xs text-ink">{error}</div>}
          {info && <div className="rounded-2xl border border-stroke/40 bg-base/50 px-4 py-3 text-xs text-ink">{info}</div>}
          <button
            type="submit"
            className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-surface transition hover:bg-ink-muted"
          >
            {t("emailConfirm.verify")}
          </button>
          <button
            type="button"
            onClick={handleResend}
            className="w-full rounded-full border border-stroke/60 px-4 py-3 text-sm font-semibold text-ink transition hover:border-stroke"
          >
            {t("emailConfirm.resend")}
          </button>
        </form>
      </div>
    </div>
  );
}
