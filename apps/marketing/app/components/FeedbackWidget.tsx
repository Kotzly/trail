"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X } from "lucide-react";

type FeedbackType = "feature" | "feedback" | "support";

const ease = [0.23, 1, 0.32, 1] as const;

const TYPE_LABELS: Record<FeedbackType, string> = {
  feature: "Request",
  feedback: "Feedback",
  support: "Support",
};

const PLACEHOLDERS: Record<FeedbackType, string> = {
  feature: "Describe the feature you'd like to see…",
  support: "Describe your issue or question…",
  feedback: "Share your thoughts, suggestions, or issues…",
};

// Optimistic submit: flip to "Sent" the moment the user clicks, fire
// the request in the background, and swallow any failure to console.
// Mirrors the project's "no toast for background sync" principle and
// the brief's "no spinners where state can update immediately."
function postFeedback(payload: {
  type: FeedbackType;
  message: string;
  contact?: string;
}): void {
  void fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) console.warn(`feedback ${res.status}`);
    })
    .catch((err) => {
      console.warn("feedback send failed", err);
    });
}

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feature");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const reset = useCallback(() => {
    setMessage("");
    setContact("");
    setSent(false);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Restore focus to the trigger so keyboard users land back on a
    // sensible focal point after the modal closes.
    setTimeout(() => triggerRef.current?.focus(), 0);
    setTimeout(reset, 300);
  }, [reset]);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [open]);

  // Escape close + Tab focus trap — keeps keyboard users inside the modal
  // while it's open and lets them exit cleanly with Esc.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
        return;
      }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && active === last) {
        first.focus();
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  useEffect(() => {
    function onOpenFeedback(e: Event) {
      const detail = (e as CustomEvent<{ type?: FeedbackType }>).detail;
      if (detail?.type) setType(detail.type);
      setOpen(true);
    }
    window.addEventListener("open-feedback", onOpenFeedback);
    return () => window.removeEventListener("open-feedback", onOpenFeedback);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || sent) return;
    postFeedback({
      type,
      message: trimmed,
      ...(contact.trim() ? { contact: contact.trim() } : {}),
    });
    setSent(true);
    setTimeout(handleClose, 1400);
  }

  return (
    <>
      {/* Floating trigger */}
      <AnimatePresence>
        {!open && (
          <motion.button
            ref={triggerRef}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-[9990] flex items-center gap-2 rounded-full px-4 py-2.5 font-mono uppercase transition-colors duration-200"
            style={{
              fontSize: 11,
              letterSpacing: "0.16em",
              color: "rgba(246,239,225,0.7)",
              background: "rgba(20, 17, 12, 0.92)",
              border: "1px solid var(--landing-line-strong)",
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease }}
            aria-label="Send feedback"
          >
            <MessageCircle size={13} aria-hidden />
            <span className="hidden sm:inline">Feedback</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-[9991] bg-[rgba(10,9,8,0.7)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleClose}
            />

            <motion.div
              className="pointer-events-none fixed inset-0 z-[9992] flex items-end justify-center p-4 sm:items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <motion.div
                ref={dialogRef}
                className="pointer-events-auto w-full max-w-md overflow-hidden rounded-[14px]"
                style={{
                  background: "#0c0a08",
                  border: "1px solid var(--landing-line-strong)",
                  boxShadow:
                    "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(248,211,100,0.04)",
                }}
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 16, opacity: 0 }}
                transition={{ duration: 0.28, ease }}
                role="dialog"
                aria-modal="true"
                aria-label="Send feedback"
              >
                <div className="flex items-center justify-between border-b border-[var(--landing-line)] px-5 py-4">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.22em",
                        color: "var(--landing-ember)",
                      }}
                    >
                      {type === "support" ? "Note" : "Send"}
                    </span>
                    <h2
                      className="font-serif text-[var(--landing-ink)]"
                      style={{
                        fontSize: 20,
                        fontWeight: 500,
                        letterSpacing: "-0.015em",
                        lineHeight: 1.1,
                      }}
                    >
                      {type === "support"
                        ? "Tell us what broke."
                        : type === "feature"
                          ? "Ask us to build something."
                          : "Tell us how it feels."}
                    </h2>
                  </div>
                  <button
                    onClick={handleClose}
                    className="grid h-8 w-8 place-items-center rounded text-[rgba(246,239,225,0.55)] transition-colors hover:text-[var(--landing-ink)]"
                    aria-label="Close"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5">
                  <div
                    className="grid grid-cols-3"
                    style={{
                      gap: 1,
                      background: "var(--landing-line)",
                      border: "1px solid var(--landing-line)",
                    }}
                  >
                    {(Object.keys(TYPE_LABELS) as FeedbackType[]).map((t) => (
                      <TypeTab
                        key={t}
                        active={type === t}
                        onClick={() => setType(t)}
                        label={TYPE_LABELS[t]}
                      />
                    ))}
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={PLACEHOLDERS[type]}
                    maxLength={1000}
                    required
                    rows={5}
                    className="mt-4 w-full resize-none bg-transparent px-0 py-3 text-[15px] text-[var(--landing-ink)] placeholder:text-[rgba(246,239,225,0.35)] outline-none"
                    style={{
                      borderBottom: "1px solid var(--landing-line)",
                      lineHeight: 1.5,
                    }}
                  />
                  <div className="flex items-center justify-end pt-1.5">
                    <span
                      className="font-mono tabular-nums"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        color: "rgba(246,239,225,0.4)",
                      }}
                    >
                      {message.length} / 1000
                    </span>
                  </div>

                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Email or Telegram for follow-up — optional"
                    maxLength={100}
                    className="mt-4 w-full bg-transparent py-2.5 text-[13px] text-[var(--landing-ink)] placeholder:text-[rgba(246,239,225,0.35)] outline-none"
                    style={{
                      borderBottom: "1px solid var(--landing-line)",
                    }}
                  />

                  <button
                    type="submit"
                    disabled={!message.trim() || sent}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--landing-ink)] px-5 py-3 text-[14px] font-semibold text-[#0a0908] transition-transform duration-200 ease-out hover:-translate-y-px active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
                  >
                    {sent
                      ? "Sent — thank you"
                      : `Send ${type === "feature" ? "request" : type === "support" ? "note" : "feedback"}`}
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
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono uppercase transition-colors duration-200"
      style={{
        fontSize: 10.5,
        letterSpacing: "0.18em",
        padding: "10px 8px",
        background: active ? "rgba(248,211,100,0.06)" : "var(--landing-bg)",
        color: active ? "var(--landing-ember)" : "rgba(246,239,225,0.55)",
      }}
    >
      {label}
    </button>
  );
}
