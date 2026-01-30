# Marketing: Legal (Privacy & Terms)

**Scope:** `apps/marketing/` — gettrail.net  
**Purpose:** Privacy policy and Terms of Service pages rendered from a single markdown file; shared shell and layout.

---

## File Map

| Role | Path |
|------|------|
| Legal source (read + split markdown) | `apps/marketing/app/(legal)/legal-source.ts` |
| Legal page shell | `apps/marketing/app/(legal)/LegalPageShell.tsx` |
| Markdown renderer | `apps/marketing/app/(legal)/MarkdownBlocks.tsx` |
| Privacy page | `apps/marketing/app/(legal)/privacy/page.tsx` |
| Terms page | `apps/marketing/app/(legal)/terms/page.tsx` |
| Markdown file | Repo root: `trail_privacy_policy_terms_of_service.md` |

---

## Interfaces

### LegalDoc (legal-source.ts)

```ts
type LegalDoc = {
  title: string;
  lastUpdated: string | null;
  markdown: string;
};
```

### splitByH1

- Input: full markdown string.  
- Output: `Record<string, string>` — key = first H1 title in section, value = markdown for that section (including the H1 line).  
- Used to split root file into privacy vs terms sections by title.

---

## Design Patterns

1. **Single source file**  
   One markdown file at repo root; `readLegalMarkdown()` tries paths (cwd, cwd/../..). File is read with `readFile` (Node); `cache()` from React used if applicable for request dedup.

2. **Section by H1**  
   `splitByH1(markdown)` scans lines; on `# ` line, flushes previous section (key = previous H1 title) and starts new section. Final section flushed at end.

3. **Pages**  
   Privacy and Terms pages call legal-source to get the doc by key (e.g. “Privacy Policy”, “Terms of Service”); pass markdown to LegalPageShell + MarkdownBlocks.

4. **Rendering**  
   MarkdownBlocks renders markdown (e.g. via a markdown-to-React library or custom components); LegalPageShell provides layout, title, lastUpdated.

---

## AI Agent Notes

- Add new legal page: add route under `(legal)/`, add section key in legal-source (or map slug → H1 title), ensure root markdown has matching H1.  
- Last updated: parsed from markdown (e.g. “Last updated: …” line) or passed separately; LegalDoc.lastUpdated displayed in shell.  
- Do not edit generated files; legal-source and MarkdownBlocks are the source of truth for structure.
