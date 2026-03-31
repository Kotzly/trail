"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";
import { LoginView } from "@trail/ui/auth";

const GOOGLE_CLIENT_ID =
  "903791543680-6bq7j4fn3h33tghrluh4vqpk386r1425.apps.googleusercontent.com";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const gisLoaded = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
    if (gisLoaded.current) return;
    gisLoaded.current = true;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
    };
    document.head.appendChild(script);
  }, [handleCredentialResponse]);

  const handleContinueWithGoogle = () => {
    if (window.google) {
      window.google.accounts.id.prompt();
    }
  };

  return (
    <LoginView
      error={error}
      isLoading={isLoading}
      onContinueWithGoogle={handleContinueWithGoogle}
    />
  );
}
