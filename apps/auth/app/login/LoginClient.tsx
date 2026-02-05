"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/src/auth-client";
import { LoginView } from "@trail/ui/auth";

const buildBridgeUrl = (returnTo: string) =>
  `/auth/bridge?returnTo=${encodeURIComponent(returnTo)}`;

const normalizeError = (error: unknown): string => {
  if (!error) {
    return "Something went wrong.";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? error);
  }

  return "Something went wrong.";
};

const resolveRedirectUrl = (data: unknown): string | null => {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const candidate = record.url ?? record.redirect;

  return typeof candidate === "string" ? candidate : null;
};

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const bridgeUrl = useMemo(() => buildBridgeUrl(returnTo), [returnTo]);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isPasswordSigningIn, setIsPasswordSigningIn] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(
    null,
  );

  const handleSendOtp = async () => {
    if (!email) {
      setError("enter an email to receive code");
      return;
    }

    setError(null);
    setStatus(null);
    setIsSending(true);

    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });

    setIsSending(false);

    if (sendError) {
      setError(normalizeError(sendError));
      return;
    }

    setStatus("code sent. check your email");
  };

  const handleSignIn = async () => {
    if (!email || !otp) {
      setError("enter email and code from email");
      return;
    }

    setError(null);
    setStatus(null);
    setIsSigningIn(true);

    const { error: signInError } = await authClient.signIn.emailOtp({
      email,
      otp,
    });

    setIsSigningIn(false);

    if (signInError) {
      console.warn("auth: sign-in email/password failed", {
        email,
        error: normalizeError(signInError),
      });
      setError(normalizeError(signInError));
      return;
    }

    router.push(bridgeUrl);
  };

  const handlePasswordSignIn = async () => {
    if (!email || !password) {
      setError("enter email and password");
      return;
    }

    setError(null);
    setStatus(null);
    setIsPasswordSigningIn(true);

    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
      callbackURL: bridgeUrl,
    });

    setIsPasswordSigningIn(false);

    if (signInError) {
      setError(normalizeError(signInError));
      return;
    }

    const redirectUrl = resolveRedirectUrl(data);

    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    router.push(bridgeUrl);
  };

  const handleSignUp = async () => {
    if (!name || !email || !password) {
      setError("enter name, email and password to sign up");
      return;
    }

    setError(null);
    setStatus(null);
    setIsSigningUp(true);

    const { data, error: signUpError } = await authClient.signUp.email({
      email,
      name,
      password,
    });

    setIsSigningUp(false);

    if (signUpError) {
      setError(normalizeError(signUpError));
      return;
    }

    const redirectUrl = resolveRedirectUrl(data);

    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    router.push(bridgeUrl);
  };

  const handleSocial = async (provider: "google" | "github") => {
    setError(null);
    setStatus(null);
    setOauthLoading(provider);

    const { data, error: socialError } = await authClient.signIn.social({
      provider,
      callbackURL: bridgeUrl,
    });

    setOauthLoading(null);

    if (socialError) {
      setError(normalizeError(socialError));
      return;
    }

    const redirectUrl = resolveRedirectUrl(data);

    if (redirectUrl) {
      window.location.assign(redirectUrl);
      return;
    }

    router.push(bridgeUrl);
  };

  return (
    <LoginView
      email={email}
      name={name}
      otp={otp}
      password={password}
      status={status}
      error={error}
      isSending={isSending}
      isSigningIn={isSigningIn}
      isPasswordSigningIn={isPasswordSigningIn}
      isSigningUp={isSigningUp}
      oauthLoading={oauthLoading}
      onEmailChange={setEmail}
      onNameChange={setName}
      onOtpChange={setOtp}
      onPasswordChange={setPassword}
      onSendOtp={handleSendOtp}
      onSignIn={handleSignIn}
      onPasswordSignIn={handlePasswordSignIn}
      onSignUp={handleSignUp}
      onSocial={handleSocial}
    />
  );
}
