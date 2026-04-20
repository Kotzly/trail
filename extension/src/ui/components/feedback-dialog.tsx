import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/components/ui/dialog";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { Label } from "@ui/components/ui/label";
import { Textarea } from "@ui/components/ui/textarea";
import { useBoolean } from "@ui/hooks/use-boolean";
import { useLockFn } from "@ui/hooks/use-lock-fn";
import { toast } from "sonner";
import { i18n } from "#i18n";
import {
  captureBugReport,
  captureError,
  captureEvent,
  lastErrorEventId,
} from "@shared/lib/observability.js";
import { MARKETING_URLS } from "@shared/config/marketing-urls.js";

export type FeedbackKind = "bug" | "feature" | "support";

type FeedbackCopyKeys = {
  title: "feedback.bug.title" | "feedback.feature.title" | "feedback.support.title";
  description:
    | "feedback.bug.description"
    | "feedback.feature.description"
    | "feedback.support.description";
  placeholder:
    | "feedback.bug.placeholder"
    | "feedback.feature.placeholder"
    | "feedback.support.placeholder";
};

const COPY_KEYS: Record<FeedbackKind, FeedbackCopyKeys> = {
  bug: {
    title: "feedback.bug.title",
    description: "feedback.bug.description",
    placeholder: "feedback.bug.placeholder",
  },
  feature: {
    title: "feedback.feature.title",
    description: "feedback.feature.description",
    placeholder: "feedback.feature.placeholder",
  },
  support: {
    title: "feedback.support.title",
    description: "feedback.support.description",
    placeholder: "feedback.support.placeholder",
  },
};

const MAX_MESSAGE = 1000;
const MAX_CONTACT = 100;

const apiTypeFor = (kind: FeedbackKind): "feature" | "feedback" | "support" =>
  kind === "bug" ? "feedback" : kind;

async function postToMarketing(
  kind: FeedbackKind,
  message: string,
  contact: string,
): Promise<void> {
  const response = await fetch(MARKETING_URLS.feedbackApi, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: apiTypeFor(kind),
      message,
      contact: contact || undefined,
    }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed (${response.status})`);
  }
}

type FeedbackDialogProps = {
  kind: FeedbackKind | null;
  onOpenChange: (open: boolean) => void;
  /**
   * Explicit Sentry event id to attach (for the "bug" kind). When omitted,
   * falls back to `lastErrorEventId()`. Error boundaries should pass this so
   * the report is linked to the crash that triggered it, not to whatever
   * error happened afterwards.
   */
  associatedEventId?: string;
  /** Source tag attached to the Sentry feedback event. */
  source?: string;
};

export function FeedbackDialog({
  kind,
  onOpenChange,
  associatedEventId,
  source,
}: FeedbackDialogProps) {
  return (
    <Dialog open={kind !== null} onOpenChange={onOpenChange}>
      {kind ? (
        <DialogContent>
          <FeedbackForm
            key={kind}
            kind={kind}
            associatedEventId={associatedEventId}
            source={source}
            onClose={() => onOpenChange(false)}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function FeedbackForm({
  kind,
  associatedEventId,
  source,
  onClose,
}: {
  kind: FeedbackKind;
  associatedEventId?: string;
  source?: string;
  onClose: () => void;
}) {
  const copyKeys = COPY_KEYS[kind];
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, submittingActions] = useBoolean(false);

  const submit = useLockFn(async () => {
    const trimmedMessage = message.trim();
    const trimmedContact = contact.trim();
    if (trimmedMessage.length === 0) return;

    submittingActions.setTrue();
    try {
      let sentViaSentry = false;
      if (kind === "bug") {
        const eventId = captureBugReport({
          message: trimmedMessage,
          email: trimmedContact || undefined,
          associatedEventId: associatedEventId ?? lastErrorEventId(),
          tags: { source: source ?? "settings_about" },
        });
        sentViaSentry = eventId !== null;
      }

      if (!sentViaSentry) {
        await postToMarketing(kind, trimmedMessage, trimmedContact);
      }

      captureEvent("feedback_submitted", { kind });
      toast.success(i18n.t("feedback.toastSuccess"), {
        description: sentViaSentry
          ? i18n.t("feedback.toastSuccessSentry")
          : i18n.t("feedback.toastSuccessFallback"),
      });
      onClose();
    } catch (error) {
      captureError(error, { kind: "ui_feedback_submit", feedback_kind: kind });
      toast.error(i18n.t("feedback.toastFailure"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      submittingActions.setFalse();
    }
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>{i18n.t(copyKeys.title)}</DialogTitle>
        <DialogDescription>{i18n.t(copyKeys.description)}</DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="feedback-message" className="text-xs">
            {i18n.t("feedback.messageLabel")}
          </Label>
          <Textarea
            id="feedback-message"
            autoFocus
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={i18n.t(copyKeys.placeholder)}
            rows={5}
            maxLength={MAX_MESSAGE}
          />
          <span className="text-muted-foreground self-end text-[10px] tabular-nums">
            {message.length}/{MAX_MESSAGE}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="feedback-contact" className="text-xs">
            {i18n.t("feedback.contactLabel")}{" "}
            <span className="text-muted-foreground">{i18n.t("feedback.contactOptional")}</span>
          </Label>
          <Input
            id="feedback-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={i18n.t("feedback.contactPlaceholder")}
            maxLength={MAX_CONTACT}
          />
        </div>
      </form>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          {i18n.t("feedback.cancel")}
        </Button>
        <Button
          disabled={submitting || message.trim().length === 0}
          onClick={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {submitting ? i18n.t("feedback.sending") : i18n.t("feedback.send")}
        </Button>
      </DialogFooter>
    </>
  );
}
