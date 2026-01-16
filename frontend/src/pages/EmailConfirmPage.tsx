import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth/AuthContext";

const schema = z.object({
  code: z.string().min(4),
});

type FormValues = z.infer<typeof schema>;

type Purpose = "login" | "register";

export default function EmailConfirmPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { confirmEmailCode, startEmailCode } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const email = searchParams.get("email") ?? "";
  const purpose = (searchParams.get("purpose") as Purpose) ?? "login";
  const displayName = searchParams.get("displayName") ?? undefined;

  const title = useMemo(() => {
    return purpose === "register" ? "Confirm your email" : "Enter your login code";
  }, [purpose]);

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
      setError("Invalid or expired code.");
    }
  });

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Missing email. Go back and start again.");
      return;
    }
    try {
      await startEmailCode({ email, purpose, displayName });
      setInfo("A new code was sent.");
    } catch (err) {
      setError("Unable to resend code.");
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16 md:flex-row">
      <div className="flex-1">
        <h1 className="font-display text-4xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">
          We sent a one-time code to <span className="font-semibold text-ink">{email || "your email"}</span>.
        </p>
      </div>
      <div className="w-full max-w-md rounded-3xl border border-black/5 bg-white/70 p-8 shadow-card">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Code</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              {...register("code")}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm tracking-[0.4em]"
            />
            {formState.errors.code && <p className="mt-1 text-xs text-coral">{formState.errors.code.message}</p>}
          </div>
          {error && <div className="rounded-2xl bg-coral/10 px-4 py-3 text-xs text-coral">{error}</div>}
          {info && <div className="rounded-2xl bg-moss/10 px-4 py-3 text-xs text-moss">{info}</div>}
          <button
            type="submit"
            className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-sand transition hover:bg-slate"
          >
            Verify & continue
          </button>
          <button
            type="button"
            onClick={handleResend}
            className="w-full rounded-full border border-ink/20 px-4 py-3 text-sm font-semibold text-ink"
          >
            Resend code
          </button>
        </form>
      </div>
    </div>
  );
}
