import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const { startEmailCode } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t("register.validation.email")),
        displayName: z.string().min(2, t("register.validation.name")),
      }),
    [i18n.language, t]
  );

  type FormValues = z.infer<typeof schema>;

  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setInfo(null);
    try {
      await startEmailCode({
        email: values.email,
        purpose: "register",
        displayName: values.displayName,
      });
      setInfo(t("register.errors.codeSent"));
      navigate(
        `/email-confirm?email=${encodeURIComponent(values.email)}&purpose=register&displayName=${encodeURIComponent(
          values.displayName
        )}`
      );
    } catch (err) {
      setError(t("register.errors.sendCodeFailed"));
    }
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16 md:flex-row">
      <div className="flex-1">
        <h1 className="font-display text-4xl font-semibold">{t("register.title")}</h1>
        <p className="mt-3 text-sm text-ink-subtle">{t("register.subtitle")}</p>
      </div>
      <div className="w-full max-w-md rounded-3xl border border-stroke/40 bg-surface/80 p-8 shadow-card">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {t("register.name")}
            </label>
            <input
              type="text"
              {...register("displayName")}
              className="mt-2 w-full rounded-2xl border border-stroke/60 bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-ink/40 focus:outline-none"
            />
            {formState.errors.displayName && (
              <p className="mt-1 text-xs text-ink">{formState.errors.displayName.message}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {t("register.email")}
            </label>
            <input
              type="email"
              {...register("email")}
              className="mt-2 w-full rounded-2xl border border-stroke/60 bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-ink/40 focus:outline-none"
            />
            {formState.errors.email && (
              <p className="mt-1 text-xs text-ink">{formState.errors.email.message}</p>
            )}
          </div>
          {error && <div className="rounded-2xl border border-ink/20 bg-ink/10 px-4 py-3 text-xs text-ink">{error}</div>}
          {info && <div className="rounded-2xl border border-stroke/40 bg-base/50 px-4 py-3 text-xs text-ink">{info}</div>}
          <button
            type="submit"
            className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-surface transition hover:bg-ink-muted"
          >
            {t("register.sendCode")}
          </button>
          <p className="text-center text-xs text-ink-subtle">
            {t("register.alreadyAccount")} <Link to="/login" className="font-semibold text-ink">{t("register.signIn")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
