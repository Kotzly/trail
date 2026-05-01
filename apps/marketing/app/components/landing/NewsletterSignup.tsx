"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";

type State = "idle" | "submitting" | "success" | "error";

export function NewsletterSignup() {
  const t = useTranslations("newsletter");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<State>("idle");

  async function submit() {
    if (state === "submitting" || state === "success") return;
    const trimmed = email.trim();
    if (!trimmed) return;

    setState("submitting");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, website }),
      });
      setState(res.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 10,
          letterSpacing: "0.2em",
          color: "rgba(246,239,225,0.4)",
        }}
      >
        {t("heading")}
      </div>

      {state === "success" ? (
        <p
          className="text-[var(--landing-ink)]"
          style={{ fontSize: 13, lineHeight: 1.5 }}
        >
          {t("success")}
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-2.5"
        >
          {/* Honeypot — invisible to users, irresistible to bots */}
          <Input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="pointer-events-none absolute -z-10 h-0 w-0 border-0 p-0 opacity-0"
          />

          <div className="flex items-center gap-1 border-b border-[var(--landing-line)] focus-within:border-[var(--landing-line-strong)] transition-colors">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("placeholder")}
              aria-label={t("heading")}
              disabled={state === "submitting"}
              maxLength={254}
              className="h-auto rounded-none border-0 bg-transparent px-0 py-2 text-[13px] text-[var(--landing-ink)] placeholder:text-[rgba(246,239,225,0.35)] focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-50 md:text-[13px]"
            />
            <Button
              type="submit"
              size="icon"
              variant="ghost"
              disabled={state === "submitting" || !email.trim()}
              className="h-8 w-8 shrink-0 rounded-md text-[var(--landing-ember)] hover:bg-[rgba(248,211,100,0.06)] hover:text-[var(--landing-ember)] disabled:opacity-30"
              aria-label={t("submit")}
            >
              <ArrowRight aria-hidden />
            </Button>
          </div>

          <p
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: "rgba(246,239,225,0.42)",
            }}
          >
            {state === "error" ? t("error") : t("consent")}
          </p>
        </form>
      )}
    </div>
  );
}
