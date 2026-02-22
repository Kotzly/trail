import type { ReactNode } from "react";

export function parseHeadline(text: string): ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <span key={i} className="font-serif italic">
          {part.slice(1, -1)}
        </span>
      );
    }
    return part;
  });
}
