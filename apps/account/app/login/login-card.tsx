"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createSupabaseBrowserClient } from "@/src/lib/supabase/client";
import { cn } from "@/lib/utils";

interface LoginCardProps {
  returnTo?: string;
}

export function LoginCard({ returnTo }: LoginCardProps) {
  const t = useTranslations("login");
  const [email, setEmail] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  function getCallbackUrl() {
    const url = new URL("/auth/callback", window.location.origin);
    if (returnTo) url.searchParams.set("next", returnTo);
    return url.toString();
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getCallbackUrl(),
        },
      });
      if (error) throw error;
    } catch {
      toast.error(t("googleFailed"));
      setGoogleLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error(t("emailRequired"));
      return;
    }
    setMagicLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: getCallbackUrl(),
        },
      });
      if (error) throw error;
      setMagicSent(true);
    } catch {
      toast.error(t("magicLinkFailed"));
    } finally {
      setMagicLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-xl border-border/60">
      <CardHeader className="items-center text-center pb-2">
        {/* Trail logo */}
        <div className="mb-4 flex items-center justify-center">
          <picture>
            <source
              srcSet="/brand/trail-fork-dark.svg"
              media="(prefers-color-scheme: dark)"
            />
            <img
              src="/brand/trail-fork-light.svg"
              alt="Trail"
              width={40}
              height={40}
              className="h-10 w-10"
            />
          </picture>
        </div>
        <CardTitle className="text-xl font-semibold tracking-tight">
          {t("title")}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {t("tagline")}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Google OAuth */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || magicLoading}
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {t("continueWithGoogle")}
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">{t("or")}</span>
          <Separator className="flex-1" />
        </div>

        {/* Magic link */}
        {magicSent ? (
          <div className="rounded-lg bg-muted/60 border border-border/50 px-4 py-5 text-center space-y-1">
            <Mail className="mx-auto h-6 w-6 text-primary" />
            <p className="text-sm font-medium">{t("checkEmail")}</p>
            <p className="text-xs text-muted-foreground">
              {t("magicLinkSentBody")}{" "}
              <span className="font-medium text-foreground">{email}</span>
            </p>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors mt-1"
              onClick={() => {
                setMagicSent(false);
                setEmail("");
              }}
            >
              {t("useDifferentEmail")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm">
                {t("emailLabel")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={magicLoading || googleLoading}
                autoComplete="email"
                className={cn("h-10")}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={magicLoading || googleLoading || !email.trim()}
            >
              {magicLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {t("sendMagicLink")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
