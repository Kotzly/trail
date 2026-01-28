"use client";

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "./Button";
import type { ButtonProps } from "./Button";

export type WaitlistDialogProps = {
  triggerLabel: string;
  title?: string;
  description?: string;
  source?: string;
  action?: string;
  buttonVariant?: ButtonProps["variant"];
  buttonSize?: ButtonProps["size"];
  buttonClassName?: string;
};

const defaultTitle = "Join the waitlist";
const defaultDescription = "Leave your email and we will let you know when it is ready.";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistDialog({
  triggerLabel,
  title = defaultTitle,
  description = defaultDescription,
  source,
  action = "/api/waitlist",
  buttonVariant = "primary",
  buttonSize = "md",
  buttonClassName
}: WaitlistDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">(
    "idle"
  );
  const [error, setError] = React.useState<string | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const closeDialog = React.useCallback(() => {
    setOpen(false);
    setStatus("idle");
    setError(null);
    setEmail("");
  }, []);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    inputRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeDialog]);

  const submitEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!emailPattern.test(trimmedEmail)) {
      setError("Enter a valid email address.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setError(null);

    try {
      const response = await fetch(action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, source })
      });

      if (!response.ok) {
        setStatus("error");
        setError("Something went wrong. Try again in a moment.");
        return;
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError("Unable to submit right now. Try again soon.");
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant={buttonVariant}
        size={buttonSize}
        className={buttonClassName}
      >
        {triggerLabel}
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 py-10">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
            onClick={closeDialog}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="trail-modal relative w-full max-w-md"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="trail-eyebrow">waitlist</p>
                <h2 id={titleId} className="mt-3 font-display text-2xl font-semibold text-ink">
                  {title}
                </h2>
                <p id={descriptionId} className="trail-copy mt-2">
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="trail-pill transition hover:border-stroke hover:text-ink"
              >
                close
              </button>
            </div>

            {status === "success" ? (
              <div className="trail-card-compact mt-6 bg-surface/90 p-4 text-sm text-ink">
                <p className="font-medium">You are on the list.</p>
                <p className="trail-copy mt-2">
                  We will reach out as soon as downloads open up.
                </p>
                <div className="mt-4 flex justify-end">
                  <Button onClick={closeDialog} size="sm" variant="outline">
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitEmail} className="mt-6 space-y-4">
                <label className="trail-eyebrow block">Email</label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    ref={inputRef}
                    type="email"
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (status === "error") {
                        setStatus("idle");
                        setError(null);
                      }
                    }}
                    placeholder="you@company.com"
                    className={cn("trail-input")}
                    autoComplete="email"
                    disabled={status === "submitting"}
                  />
                  <Button
                    type="submit"
                    size="md"
                    className="w-full sm:w-auto"
                    disabled={status === "submitting"}
                  >
                    {status === "submitting" ? "Joining..." : "Join"}
                  </Button>
                </div>
                <p className="trail-copy text-xs">
                  No spam. One note when downloads open.
                </p>
                {status === "error" && error ? (
                  <p className="text-xs text-ink">{error}</p>
                ) : null}
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
