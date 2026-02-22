"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Lightbulb, MessageSquare, Send, Check } from "lucide-react";

type FeedbackType = "feature" | "feedback";
type Status = "idle" | "sending" | "sent" | "error";

const ease = [0.25, 0.1, 0.25, 1] as const;

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feature");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorText, setErrorText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reset = useCallback(() => {
    setMessage("");
    setContact("");
    setStatus("idle");
    setErrorText("");
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(reset, 300);
  }, [reset]);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || status === "sending") return;

    setStatus("sending");
    setErrorText("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          ...(contact.trim() && { contact: contact.trim() }),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      setStatus("sent");
      setTimeout(handleClose, 1800);
    } catch (err) {
      setStatus("error");
      setErrorText(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <>
      {/* Floating trigger */}
      <AnimatePresence>
        {!open && (
          <motion.button
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-[9990] flex items-center gap-2 rounded-full border border-border-strong bg-elevated/80 px-4 py-2.5 text-sm font-medium text-text-secondary backdrop-blur-xl transition-colors hover:text-text-primary hover:border-magenta/40 active:scale-[0.97]"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.3, ease }}
            aria-label="Send feedback"
          >
            <MessageCircle size={16} />
            <span className="hidden sm:inline">Feedback</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-[9991] bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={handleClose}
            />

            {/* Panel */}
            <motion.div
              className="fixed inset-0 z-[9992] flex items-end sm:items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="pointer-events-auto w-full max-w-md rounded-2xl border border-border-subtle bg-surface shadow-2xl shadow-black/50"
                initial={{ y: 40, opacity: 0, scale: 0.97 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 20, opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease }}
                role="dialog"
                aria-modal="true"
                aria-label="Send feedback"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
                  <h2 className="text-base font-semibold tracking-heading text-text-primary">
                    Send Feedback
                  </h2>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:text-text-primary hover:bg-elevated"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5">
                  {/* Type switcher */}
                  <div className="flex gap-2 rounded-xl bg-elevated p-1">
                    <TypeTab
                      active={type === "feature"}
                      onClick={() => setType("feature")}
                      icon={<Lightbulb size={14} />}
                      label="Request Feature"
                    />
                    <TypeTab
                      active={type === "feedback"}
                      onClick={() => setType("feedback")}
                      icon={<MessageSquare size={14} />}
                      label="Provide Feedback"
                    />
                  </div>

                  {/* Message */}
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      type === "feature"
                        ? "Describe the feature you'd like to see..."
                        : "Share your thoughts, suggestions, or issues..."
                    }
                    maxLength={1000}
                    required
                    rows={4}
                    className="mt-4 w-full resize-none rounded-xl border border-border-subtle bg-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-magenta/40 focus:outline-none"
                  />
                  <div className="mt-1 text-right text-xs text-text-tertiary tabular-nums">
                    {message.length}/1000
                  </div>

                  {/* Contact (optional) */}
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Email or Telegram for follow-up (optional)"
                    maxLength={100}
                    className="mt-2 w-full rounded-xl border border-border-subtle bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary transition-colors focus:border-magenta/40 focus:outline-none"
                  />

                  {/* Error */}
                  {status === "error" && errorText && (
                    <p className="mt-3 text-sm text-red-400">{errorText}</p>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={!message.trim() || status === "sending" || status === "sent"}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-all hover:shadow-[0_0_24px_rgba(212,22,108,0.25)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {status === "sending" ? (
                      <>
                        <Spinner />
                        Sending...
                      </>
                    ) : status === "sent" ? (
                      <>
                        <Check size={16} />
                        Sent!
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send {type === "feature" ? "Request" : "Feedback"}
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function TypeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "text-text-primary"
          : "text-text-tertiary hover:text-text-secondary"
      }`}
    >
      {active && (
        <motion.div
          className="absolute inset-0 rounded-lg bg-surface border border-border-subtle"
          layoutId="feedback-tab"
          transition={{ duration: 0.25, ease }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1.5">
        {icon}
        {label}
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
    >
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="28"
        strokeDashoffset="20"
      />
    </svg>
  );
}
