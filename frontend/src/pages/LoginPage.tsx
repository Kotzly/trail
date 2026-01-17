import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login, startEmailCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        email: z.string().email(t("login.validation.email")),
        password: z.string().min(8, t("login.validation.password")),
      }),
    [i18n.language, t]
  );

  type FormValues = z.infer<typeof schema>;

  const portalSessionId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("portalSessionId") ?? undefined;
  }, [location.search]);

  const { register, handleSubmit, formState, getValues } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setInfo(null);
    try {
      await login({
        email: values.email,
        password: values.password,
        portalSessionId,
      });
      navigate("/dashboard");
    } catch (err) {
      setError(t("login.errors.invalidCredentials"));
    }
  });

  const handleSendCode = async () => {
    setError(null);
    setInfo(null);
    const email = getValues("email");
    const parsed = schema.pick({ email: true }).safeParse({ email });
    if (!parsed.success) {
      setError(t("login.errors.invalidEmail"));
      return;
    }
    try {
      await startEmailCode({ email, purpose: "login" });
      setInfo(t("login.errors.codeSent"));
      navigate(`/email-confirm?email=${encodeURIComponent(email)}&purpose=login`);
    } catch (err) {
      setError(t("login.errors.sendCodeFailed"));
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16 md:flex-row">
      <div className="flex-1">
        <h1 className="font-display text-4xl font-semibold">{t("login.title")}</h1>
        <p className="mt-3 text-sm text-ink-subtle">{t("login.subtitle")}</p>
      </div>
      <div className="w-full max-w-md rounded-3xl border border-stroke/40 bg-surface/80 p-8 shadow-card">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {t("login.email")}
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
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {t("login.password")}
            </label>
            <input
              type="password"
              {...register("password")}
              className="mt-2 w-full rounded-2xl border border-stroke/60 bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-subtle focus:border-ink/40 focus:outline-none"
            />
            {formState.errors.password && (
              <p className="mt-1 text-xs text-ink">{formState.errors.password.message}</p>
            )}
          </div>
          {error && <div className="rounded-2xl border border-ink/20 bg-ink/10 px-4 py-3 text-xs text-ink">{error}</div>}
          {info && <div className="rounded-2xl border border-stroke/40 bg-base/50 px-4 py-3 text-xs text-ink">{info}</div>}
          <button
            type="submit"
            className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-surface transition hover:bg-ink-muted"
          >
            {t("login.signIn")}
          </button>
          <button
            type="button"
            onClick={handleSendCode}
            className="w-full rounded-full border border-stroke/60 px-4 py-3 text-sm font-semibold text-ink transition hover:border-stroke"
          >
            {t("login.sendCode")}
          </button>
          <p className="text-center text-xs text-ink-subtle">
            {t("login.noAccount")} <Link to="/register" className="font-semibold text-ink">{t("login.createAccount")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
