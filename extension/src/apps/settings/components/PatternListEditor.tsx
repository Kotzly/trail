import { useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@ui/components/ui/input-group";
import { FieldDescription } from "@ui/components/ui/field";
import { Empty, EmptyDescription } from "@ui/components/ui/empty";
import { Kbd } from "@ui/components/ui/kbd";
import { Icons } from "@ui/components/icons";

type PatternListEditorProps = {
  values: readonly string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  emptyText?: string;
  normalize?: (value: string) => string;
  disabled?: boolean;
};

const identity = (v: string) => v;

export function PatternListEditor({
  values,
  onChange,
  placeholder,
  addLabel = "Add",
  emptyText,
  normalize = identity,
  disabled = false,
}: PatternListEditorProps) {
  const [draft, setDraft] = useState("");
  const reduce = useReducedMotion();

  const commitAdd = () => {
    const cleaned = normalize(draft.trim());
    if (cleaned.length === 0) return;
    if (values.includes(cleaned)) {
      setDraft("");
      return;
    }
    onChange([...values, cleaned]);
    setDraft("");
  };

  const commitEdit = (index: number, raw: string) => {
    const cleaned = normalize(raw.trim());
    const current = values[index];
    if (cleaned === current) return;
    if (cleaned.length === 0) {
      onChange(values.filter((_, i) => i !== index));
      return;
    }
    const exists = values.some((v, i) => i !== index && v === cleaned);
    if (exists) {
      onChange(values.filter((_, i) => i !== index));
      return;
    }
    onChange(values.map((v, i) => (i === index ? cleaned : v)));
  };

  const remove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitAdd();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {values.length === 0 && emptyText ? (
        <Empty className="border-input border border-dashed py-6">
          <EmptyDescription>{emptyText}</EmptyDescription>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-1.5">
          <AnimatePresence initial={false}>
            {values.map((value, index) => (
              <motion.li
                key={`${value}-${index}`}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                style={{ animationDelay: `${Math.min(index, 5) * 40}ms` }}
              >
                <PatternRow
                  value={value}
                  disabled={disabled}
                  onCommit={(next) => commitEdit(index, next)}
                  onRemove={() => remove(index)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <InputGroup>
        <InputGroupInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleAddKey}
          placeholder={placeholder}
          disabled={disabled}
          spellCheck={false}
          className="text-xs"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            variant="default"
            aria-label={addLabel}
            onClick={commitAdd}
            disabled={disabled || draft.trim().length === 0}
            className="press-feedback"
          >
            <Icons.Plus />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription className="text-[0.7rem]">
        Press <Kbd>Enter</Kbd> or click <Icons.Plus className="inline size-3" /> to add.
      </FieldDescription>
    </div>
  );
}

type PatternRowProps = {
  value: string;
  disabled: boolean;
  onCommit: (next: string) => void;
  onRemove: () => void;
};

function PatternRow({ value, disabled, onCommit, onRemove }: PatternRowProps) {
  const [draft, setDraft] = useState(value);

  const flush = () => {
    if (draft !== value) onCommit(draft);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(value);
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  return (
    <InputGroup>
      <InputGroupInput
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={flush}
        onKeyDown={handleKey}
        disabled={disabled}
        spellCheck={false}
        className="text-xs"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={`Remove ${value}`}
          onClick={onRemove}
          disabled={disabled}
          className="press-feedback"
        >
          <Icons.X />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
