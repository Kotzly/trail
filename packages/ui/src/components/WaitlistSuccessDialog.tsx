"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckIcon, Cross2Icon, EnvelopeClosedIcon, StarIcon } from "@radix-ui/react-icons";
import { cn } from "../utils/cn";
import { Button } from "./Button";

export type WaitlistSuccessDialogProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  ctaLabel?: string;
  email?: string;
  className?: string;
};

const defaultTitle = "You're on the list!";
const defaultDescription = "We'll email you as soon as Trail opens for your browser.";
const defaultCtaLabel = "Got it";

export function WaitlistSuccessDialog({
  open,
  onClose,
  title = defaultTitle,
  description = defaultDescription,
  ctaLabel = defaultCtaLabel,
  email,
  className
}: WaitlistSuccessDialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();

  // Lock body scroll when open
  React.useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn("fixed inset-0 z-50 flex items-center justify-center px-6 py-10", className)}
        >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="trail-modal relative w-full max-w-md overflow-hidden"
        onClick={(event: React.MouseEvent) => event.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-ink-subtle transition hover:bg-surface-high hover:text-ink"
          aria-label="Close"
        >
          <Cross2Icon className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Success Icon */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckIcon className="h-8 w-8 text-green-600" />
          </div>

          {/* Badge */}
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <StarIcon className="h-3 w-3" />
            Early Access
          </div>

          {/* Title */}
          <h2
            id={titleId}
            className="mt-4 font-display text-2xl font-semibold text-ink"
          >
            {title}
          </h2>

          {/* Description */}
          <p
            id={descriptionId}
            className="mt-2 text-ink-muted"
          >
            {description}
          </p>

          {/* Email confirmation */}
          {email && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-stroke/40 bg-surface/50 px-4 py-2 text-sm text-ink">
              <EnvelopeClosedIcon className="h-4 w-4 text-ink-subtle" />
              {email}
            </div>
          )}

          {/* What to expect */}
          <div className="mt-6 rounded-2xl border border-stroke/30 bg-surface/50 p-4 text-left">
            <h3 className="text-sm font-medium text-ink">What happens next?</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-muted">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent/10 text-[10px] font-medium text-accent">
                  1
                </span>
                We&apos;ll review your request
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent/10 text-[10px] font-medium text-accent">
                  2
                </span>
                You&apos;ll get an email when it&apos;s your turn
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent/10 text-[10px] font-medium text-accent">
                  3
                </span>
                Priority access to beta features
              </li>
            </ul>
          </div>

          {/* CTA */}
          <div className="mt-6">
            <Button onClick={onClose} size="lg" className="w-full">
              {ctaLabel}
            </Button>
          </div>

          {/* Footer note */}
          <p className="mt-4 text-xs text-ink-subtle">
            No spam. One email when your download is ready.
          </p>
        </div>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
