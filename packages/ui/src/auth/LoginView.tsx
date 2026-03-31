"use client";

import type { FormEvent, RefObject } from "react";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Input } from "../components/Input";
import { Label } from "../components/Label";
import { TrailLogo } from "../components/TrailLogo";

export interface LoginViewProps {
  email: string;
  onEmailChange: (value: string) => void;
  onSubmitEmail: (e: FormEvent) => void;
  error: string | null;
  isLoading: boolean;
  emailSent: boolean;
  googleButtonRef: RefObject<HTMLDivElement | null>;
  gisLoaded: boolean;
}

export function LoginView({
  email,
  onEmailChange,
  onSubmitEmail,
  error,
  isLoading,
  emailSent,
  googleButtonRef,
  gisLoaded,
}: LoginViewProps) {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-3">
        <TrailLogo.Animated className="h-12 w-12" />
        <div className="text-center">
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            Sign in to Trail
          </h1>
          <p className="mt-1 text-sm text-ink/50">
            {emailSent
              ? "Check your inbox for the magic link"
              : "Use your email or Google account"}
          </p>
        </div>
      </div>

      <Card className="w-full space-y-5">
        {emailSent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <svg
                className="h-5 w-5 text-emerald-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>
            <p className="text-sm text-ink/70">
              We sent a link to <strong className="text-ink">{email}</strong>
            </p>
            <button
              type="button"
              onClick={() => onEmailChange("")}
              className="text-xs text-ink/40 underline underline-offset-2 hover:text-ink/60"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={onSubmitEmail} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="w-full"
              >
                {isLoading ? "Sending…" : "Continue with Email"}
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/60" />
              <span className="text-xs text-ink/30">or</span>
              <div className="h-px flex-1 bg-border/60" />
            </div>

            <div className="flex justify-center">
              <div
                ref={googleButtonRef}
                className={isLoading ? "pointer-events-none opacity-50" : ""}
              />
              {!gisLoaded && (
                <div className="h-10 w-[280px] animate-pulse rounded-full bg-surface-high" />
              )}
            </div>
          </>
        )}

        {error ? (
          <p role="alert" className="text-center text-sm text-red-500">
            {error}
          </p>
        ) : null}
      </Card>
    </div>
  );
}
