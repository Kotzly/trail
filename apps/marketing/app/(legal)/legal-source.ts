import { readFile } from "fs/promises";
import path from "path";
import { cache } from "react";

type LegalDoc = {
  title: string;
  lastUpdated: string | null;
  markdown: string;
};

function findLegalFileCandidates(): string[] {
  const filename = "trail_privacy_policy_terms_of_service.md";
  return [
    path.resolve(process.cwd(), filename),
    path.resolve(process.cwd(), "..", "..", filename),
  ];
}

async function readLegalMarkdown(): Promise<string> {
  const candidates = findLegalFileCandidates();
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `missing_${"trail_privacy_policy_terms_of_service.md"}:${String(lastError)}`,
  );
}

function splitByH1(markdown: string): Record<string, string> {
  const lines = markdown.split(/\r?\n/);
  const sections: Record<string, string> = {};

  let currentTitle: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentTitle) return;
    sections[currentTitle] = buffer.join("\n").trim();
    buffer = [];
  };

  for (const line of lines) {
    const match = /^#\s+(.+)$/.exec(line);
    if (match) {
      flush();
      currentTitle = match[1].trim();
      continue;
    }

    if (currentTitle) {
      buffer.push(line);
    }
  }

  flush();
  return sections;
}

function extractLastUpdated(markdown: string): {
  lastUpdated: string | null;
  markdown: string;
} {
  const lines = markdown.split(/\r?\n/);
  const output: string[] = [];
  let lastUpdated: string | null = null;
  const pattern = /^_Last updated:\s*(.+?)_\s*$/;

  for (const line of lines) {
    const match = pattern.exec(line.trim());
    if (match && !lastUpdated) {
      lastUpdated = match[1].trim();
      continue;
    }
    output.push(line);
  }

  const cleanedLines = output
    .map((line) => line.trimEnd())
    .filter((line, index, array) => {
      if (line.trim() !== "---") return true;
      const isFirst = index === 0;
      const isLast = index === array.length - 1;
      return !(isFirst || isLast);
    });

  return { lastUpdated, markdown: cleanedLines.join("\n").trim() };
}

export const getLegalDoc = cache(
  async (title: "Privacy Policy" | "Terms of Service"): Promise<LegalDoc> => {
    const markdown = await readLegalMarkdown();
    const sections = splitByH1(markdown);
    const section = sections[title];
    if (!section) {
      throw new Error(`missing_legal_section:${title}`);
    }

    const extracted = extractLastUpdated(section);
    return {
      title,
      lastUpdated: extracted.lastUpdated,
      markdown: extracted.markdown,
    };
  },
);
