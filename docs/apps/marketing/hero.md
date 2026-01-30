# Marketing: Hero

**Scope:** `apps/marketing/` — gettrail.net landing hero  
**Purpose:** Headline with rotating words, pill label, summary, primary/secondary CTAs, and trust line.

---

## File Map

| Role | Path |
|------|------|
| Component | `apps/marketing/app/components/MarketingHero.tsx` |
| Copy | `packages/content/src/marketing/en.ts` (marketingCopy.hero) |

---

## Interfaces

### Hero copy (from content)

```ts
hero: {
  pill: string;       // eyebrow label
  lead: string;       // static first line
  words: string[];    // rotating words
  summary: string;
  ctaPrimary: string;
  ctaSecondary: string;
}
```

---

## Design Patterns

1. **Word rotator**  
   `words` array; loop = `[...words, words[0]]`. Keyframes animate `translateY` so one word is visible at a time; segment = 100 / transitionCount; hold ~62%, bounce ~82%, then next. Animation name and duration derived from word count (e.g. `word-slide-${transitionCount}`, `${transitionCount * 2}s`).

2. **CSS keyframes in JS**  
   Keyframe strings built in component and injected via `<style dangerouslySetInnerHTML={{ __html: keyframes }} />`; CSS vars on `.word-rotator` set `--word-animation-name`, `--word-animation-duration`, `--word-animation-easing`.

3. **Background blurs**  
   Decorative divs with `bg-ink/5`, `blur-3xl`, `float-slow` / `float-slower` for subtle motion.

4. **CTAs**  
   Primary → `/downloads`; secondary → `/#showcase`. Classes: `cta-primary` for filled, border for secondary.

---

## AI Agent Notes

- Add/remove rotating words: change `hero.words` in content; keyframes and segment math update automatically.  
- Animation timing: adjust `holdFraction` (0.62), `bounceFraction` (0.82), `bounceOffset` (12).  
- Trust line: hero includes a small text row (e.g. “Used by …”); copy lives in same hero or marketing copy object.
