import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth/AuthContext";
import { Link, useNavigate } from "react-router-dom";

const schema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { startEmailCode } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
      setInfo("We sent a verification code to your email.");
      navigate(
        `/email-confirm?email=${encodeURIComponent(values.email)}&purpose=register&displayName=${encodeURIComponent(
          values.displayName
        )}`
      );
    } catch (err) {
      setError("Unable to send verification code.");
    }
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-16 md:flex-row">
      <div className="flex-1">
        <h1 className="font-display text-4xl font-semibold">Create your Trail Cloud workspace</h1>
        <p className="mt-3 text-sm text-slate-600">
          Get the free plan and unlock upgrades whenever you are ready.
        </p>
      </div>
      <div className="w-full max-w-md rounded-3xl border border-black/5 bg-white/70 p-8 shadow-card">
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Name</label>
            <input
              type="text"
              {...register("displayName")}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm"
            />
            {formState.errors.displayName && (
              <p className="mt-1 text-xs text-coral">{formState.errors.displayName.message}</p>
            )}
          </div>
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
          {error && <div className="rounded-2xl bg-coral/10 px-4 py-3 text-xs text-coral">{error}</div>}
          {info && <div className="rounded-2xl bg-moss/10 px-4 py-3 text-xs text-moss">{info}</div>}
          <button
            type="submit"
            className="w-full rounded-full bg-ink px-4 py-3 text-sm font-semibold text-sand transition hover:bg-slate"
          >
            Send verification code
          </button>
          <p className="text-center text-xs text-slate-500">
            Already have an account? <Link to="/login" className="font-semibold text-ink">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
