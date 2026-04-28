import * as React from "react";

type MarkdownBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "hr" };

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

function renderEmailNodes(
  text: string,
  opts: { strong?: boolean; keyPrefix?: string },
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(emailPattern.source, "gi");
  const kp = opts.keyPrefix ?? "";

  while ((match = pattern.exec(text))) {
    const start = match.index;
    const email = match[0];
    if (start > lastIndex) {
      const chunk = text.slice(lastIndex, start);
      nodes.push(
        opts.strong ? <strong key={`${kp}${start}-t`}>{chunk}</strong> : chunk,
      );
    }

    nodes.push(
      <a
        key={`${kp}${start}-e`}
        href={`mailto:${email}`}
        className="text-[var(--landing-ember)] underline underline-offset-4 decoration-[rgba(248,211,100,0.4)] transition-colors hover:decoration-[var(--landing-ember)]"
      >
        {opts.strong ? <strong>{email}</strong> : email}
      </a>,
    );
    lastIndex = start + email.length;
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    nodes.push(
      opts.strong ? <strong key={`${kp}${lastIndex}-t`}>{tail}</strong> : tail,
    );
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
    nodes.push(...renderEmailNodes(part, { strong, keyPrefix: `${index}-` }));
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
    <article className="space-y-7">
      {blocks.map((block, index) => {
        if (block.type === "hr") {
          return (
            <hr
              key={`hr-${index}`}
              className="border-0 border-t border-[var(--landing-line)]"
            />
          );
        }

        if (block.type === "h2") {
          return (
            <h2
              key={`h2-${index}`}
              className="font-serif text-[var(--landing-ink)] pt-6"
              style={{
                fontSize: "clamp(24px, 2.4vw, 30px)",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              {renderInline(block.text)}
            </h2>
          );
        }

        if (block.type === "h3") {
          return (
            <h3
              key={`h3-${index}`}
              className="font-serif text-[var(--landing-ink)]"
              style={{
                fontSize: 18,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
              }}
            >
              {renderInline(block.text)}
            </h3>
          );
        }

        if (block.type === "ul") {
          return (
            <ul
              key={`ul-${index}`}
              className="flex flex-col gap-2.5"
              style={{ color: "rgba(246,239,225,0.78)" }}
            >
              {block.items.map((item, itemIndex) => (
                <li
                  key={`li-${index}-${itemIndex}`}
                  className="grid gap-x-3"
                  style={{
                    gridTemplateColumns: "auto 1fr",
                    fontSize: 15,
                    lineHeight: 1.65,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="select-none pt-px"
                    style={{
                      color: "var(--landing-ember)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    —
                  </span>
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p
            key={`p-${index}`}
            style={{
              fontSize: 15,
              lineHeight: 1.7,
              color: "rgba(246,239,225,0.78)",
              maxWidth: "70ch",
            }}
          >
            {renderInline(block.text)}
          </p>
        );
      })}
    </article>
  );
}
