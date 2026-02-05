import * as React from "react";

type MarkdownBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "hr" };

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function renderEmailNodes(text: string, opts: { strong?: boolean }): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(emailPattern.source, "gi");

  while ((match = pattern.exec(text))) {
    const start = match.index;
    const email = match[0];
    if (start > lastIndex) {
      const chunk = text.slice(lastIndex, start);
      nodes.push(opts.strong ? <strong key={`${start}-t`}>{chunk}</strong> : chunk);
    }

    nodes.push(
      <a
        key={`${start}-e`}
        href={`mailto:${email}`}
        className="font-semibold text-ink underline underline-offset-4"
      >
        {opts.strong ? <strong>{email}</strong> : email}
      </a>
    );
    lastIndex = start + email.length;
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    nodes.push(opts.strong ? <strong key={`${lastIndex}-t`}>{tail}</strong> : tail);
  }

  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const trimmed = text.trim();
  const italicMatch = /^_(.+)_$/.exec(trimmed);
  if (italicMatch) {
    return <em>{renderInline(italicMatch[1])}</em>;
  }

  const parts = text.split("**");
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, index) => {
    const strong = index % 2 === 1;
    if (!part) return;
    nodes.push(...renderEmailNodes(part, { strong }));
  });

  return nodes.length === 1 ? nodes[0] : nodes;
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];

  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    const text = paragraph.join(" ").trim();
    paragraph = [];
    if (text) {
      blocks.push({ type: "p", text });
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "ul", items: listItems });
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line === "---") {
      flushParagraph();
      flushList();
      blocks.push({ type: "hr" });
      continue;
    }

    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h2", text: h2[1].trim() });
      continue;
    }

    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      flushParagraph();
      flushList();
      blocks.push({ type: "h3", text: h3[1].trim() });
      continue;
    }

    const li = /^-\s+(.+)$/.exec(line);
    if (li) {
      flushParagraph();
      listItems.push(li[1].trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

export function MarkdownBlocks({ markdown }: { markdown: string }) {
  const blocks = parseMarkdown(markdown);

  return (
    <article className="space-y-8">
      {blocks.map((block, index) => {
        if (block.type === "hr") {
          return <hr key={`hr-${index}`} className="border-stroke/50" />;
        }

        if (block.type === "h2") {
          return (
            <h2
              key={`h2-${index}`}
              className="font-display text-xl font-semibold tracking-tight text-ink md:text-2xl"
            >
              {renderInline(block.text)}
            </h2>
          );
        }

        if (block.type === "h3") {
          return (
            <h3
              key={`h3-${index}`}
              className="font-display text-base font-semibold tracking-tight text-ink md:text-lg"
            >
              {renderInline(block.text)}
            </h3>
          );
        }

        if (block.type === "ul") {
          return (
            <ul
              key={`ul-${index}`}
              className="list-disc space-y-2 pl-5 text-sm leading-7 text-ink-muted"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`li-${index}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={`p-${index}`}
            className="text-sm leading-7 text-ink-muted"
          >
            {renderInline(block.text)}
          </p>
        );
      })}
    </article>
  );
}
