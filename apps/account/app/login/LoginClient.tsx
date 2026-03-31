"use client";

import { useEffect, useRef, useState, useCallback, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";
import { LoginView } from "@trail/ui/auth";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: () => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const gisReady = useRef(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);

  // --- Email magic link ---
  const handleSubmitEmail = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);

      const supabase = createSupabaseBrowserClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      if (returnTo) {
        redirectTo.searchParams.set("next", returnTo);
      }

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo.toString() },
      });

      setIsLoading(false);

      if (otpError) {
        setError(otpError.message);
        return;
      }

      setEmailSent(true);
    },
    [email, returnTo],
  );

  // --- Google sign-in ---
  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      setError(null);
      setIsLoading(true);

      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
      });

      if (authError) {
        setIsLoading(false);
        setError(authError.message);
        return;
      }

      router.push(returnTo ?? "/trails");
    },
    [router, returnTo],
  );

  useEffect(() => {
    if (gisReady.current) return;
    gisReady.current = true;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
        ux_mode: "popup",
      });
      setGisLoaded(true);
    };
    document.head.appendChild(script);
  }, [handleCredentialResponse]);

  useEffect(() => {
    if (!gisLoaded || !buttonRef.current) return;
    window.google?.accounts.id.renderButton(buttonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width: 280,
    });
  }, [gisLoaded]);

  // Reset form when user clicks "use different email"
  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    if (emailSent) {
      setEmailSent(false);
      setError(null);
    }
  }, [emailSent]);

  return (
    <LoginView
      email={email}
      onEmailChange={handleEmailChange}
      onSubmitEmail={handleSubmitEmail}
      error={error}
      isLoading={isLoading}
      emailSent={emailSent}
      googleButtonRef={buttonRef}
      gisLoaded={gisLoaded}
    />
  );
}
