import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login, startEmailCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
      setError("Invalid credentials. Try again.");
    }
  });

  const handleSendCode = async () => {
    setError(null);
    setInfo(null);
    const email = getValues("email");
    const parsed = schema.pick({ email: true }).safeParse({ email });
    if (!parsed.success) {
      setError("Enter a valid email to receive a code.");
      return;
    }
    try {
      await startEmailCode({ email, purpose: "login" });
      setInfo("Code sent. Check your email.");
      navigate(`/email-confirm?email=${encodeURIComponent(email)}&purpose=login`);
    } catch (err) {
      setError("Unable to send code. Try again.");
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16 md:flex-row">
      <div className="flex-1">
        <h1 className="font-display text-4xl font-semibold">Welcome back</h1>
        <p className="mt-3 text-sm text-slate-600">
          Sign in to manage your subscriptions, billing portal, and synced Trail workspaces.
        </p>
      </div>
      <div className="w-full max-w-md rounded-3xl border border-black/5 bg-white/70 p-8 shadow-card">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Email</label>
            <input
              type="email"
              {...register("email")}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            />
            {formState.errors.email && (
              <p className="mt-1 text-xs text-coral">{formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Password</label>
            <input
              type="password"
              {...register("password")}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            />
            {formState.errors.password && (
              <p className="mt-1 text-xs text-coral">{formState.errors.password.message}</p>
            )}
          </div>
          {error && <div className="rounded-2xl bg-coral/10 px-4 py-3 text-xs text-coral">{error}</div>}
          {info && <div className="rounded-2xl bg-moss/10 px-4 py-3 text-xs text-moss">{info}</div>}
          <button
            type="submit"
            className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-sand transition hover:bg-slate"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={handleSendCode}
            className="w-full rounded-full border border-ink/20 px-4 py-3 text-sm font-semibold text-ink"
          >
            Send email code
          </button>
          <p className="text-center text-xs text-slate-500">
            No account? <Link to="/register" className="font-semibold text-ink">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
