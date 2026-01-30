# Marketing: Testimonials Carousel

**Scope:** `apps/marketing/` — gettrail.net  
**Purpose:** Auto-scrolling testimonials strip; respects reduced motion; pause on hover/focus.

---

## File Map

| Role | Path |
|------|------|
| Component | `apps/marketing/app/components/TestimonialsCarousel.tsx` |
| Copy | `packages/content/src/marketing/en.ts` (marketingCopy.testimonials) |

---

## Interfaces

### Testimonial (from content package)

```ts
// marketingCopy.testimonials: array of:
{
  name: string;
  role: string;
  quote: string;
  image: string;  // path to image, e.g. /assets/people/olivia.jpg
}
```

---

## Design Patterns

1. **Infinite scroll**  
   Track is `[...testimonials, ...testimonials]`; scroll position advanced by `SPEED` (0.4 px/frame) in requestAnimationFrame. When `scrollLeft >= scrollWidth / 2`, reset `scrollLeft = 0` for seamless loop.

2. **Reduced motion**  
   `useReducedMotion()` uses `window.matchMedia('(prefers-reduced-motion: reduce)')`; when true, animation loop is not started (no auto-scroll).

3. **Pause on interact**  
   `isPaused` state set true on `onMouseEnter` / `onFocusCapture`, false on `onMouseLeave` / `onBlurCapture`; step() only advances offset when `!isPaused`.

4. **Accessibility**  
   `role="region"`, `aria-roledescription="carousel"`, `aria-label="Trail testimonials"`, `aria-live="off"`; `tabIndex={0}` for focus.

---

## Layout

- Section with heading “Testimonials” and subheading; track is flex with `gap-6`, `overflow-x-auto`, horizontal scroll; cards `min-w-[260px]` (sm/lg larger). Scrollbar hidden via Tailwind (`[-ms-overflow-style:none] [scrollbar-width:none]`).

---

## AI Agent Notes

- Change speed: adjust `SPEED` (px per frame).  
- Add testimonial: add entry to `marketingCopy.testimonials` in content package; ensure `image` path exists in `public/assets/people/`.  
- If you add prev/next buttons, tie them to scroll delta instead of index to keep loop logic intact.
