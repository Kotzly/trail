"use client";

import type { ReactNode } from "react";
import { Card, cn } from "@trail/ui";
import styles from "./SupportFlow.module.css";

export function StepBadge({ step, label }: { step: number; label: string }) {
  return (
    <div className={styles.stepBadge}>
      <span className={styles.stepBadgeDot}>{step}</span>
      <p className={styles.stepBadgeText}>{label}</p>
    </div>
  );
}

export function PanelCard({
  children,
  size = "md",
  className,
}: {
  children: ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "trail-panel",
        "reveal",
        size === "lg" ? styles.panelLarge : styles.panel,
        className,
      )}
    >
      {children}
    </Card>
  );
}

export function TriageCard({
  title,
  description,
  selected,
  onClick,
  tone = "default",
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  tone?: "default" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        styles.triageButton,
        tone === "default" ? styles.triageToneDefault : styles.triageToneMuted,
        selected ? styles.triageSelected : null,
      )}
    >
      <div className={styles.triageContent}>
        <div>
          <p className={styles.triageTitle}>{title}</p>
          <p className={styles.triageDescription}>{description}</p>
        </div>
        <span
          aria-hidden="true"
          className={cn(
            styles.triageArrow,
            selected ? styles.triageArrowSelected : null,
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className={styles.iconSm}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M9 18l6-6-6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </button>
  );
}

export function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className={styles.faqItem}>
      <summary className={styles.faqSummary}>
        <span className={styles.faqQuestion}>{question}</span>
        <span className={styles.faqIcon}>
          <svg
            viewBox="0 0 24 24"
            className={styles.iconSm}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M6 9l6 6 6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>
      <p className={styles.faqAnswer}>{answer}</p>
    </details>
  );
}

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(styles.fieldStack, className)}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

export function TextInputField({
  label,
  className,
  readOnly = false,
  ...props
}: {
  label: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label}>
      <input
        {...props}
        readOnly={readOnly}
        className={cn(
          "trail-input",
          readOnly ? styles.readonlyInput : null,
          className,
        )}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  className,
  ...props
}: {
  label: string;
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label}>
      <textarea {...props} className={cn(styles.textarea, className)} />
    </Field>
  );
}

export function SelectField({
  label,
  className,
  options,
  ...props
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label}>
      <select {...props} className={cn(styles.select, className)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function DetailsPanel({
  title,
  hint = "expand",
  children,
  className,
  contentClassName,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <details className={cn(styles.detailsBox, className)}>
      <summary className={styles.detailsSummary}>
        <span className={styles.detailsTitle}>{title}</span>
        <span className={styles.detailsHint}>{hint}</span>
      </summary>
      <div className={contentClassName}>{children}</div>
    </details>
  );
}

export function StatusNote({ children }: { children: ReactNode }) {
  return <p className={styles.helperText}>{children}</p>;
}
