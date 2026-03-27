# Code Style Review — TASK_2026_056

## Score: 5/10

## Findings

### Critical (must fix)

- **Hardcoded hex colors in CSS classes and inline styles throughout**: Every `rgba(...)` and `#rrggbb` value in inline `style=""` attributes and in the `<style>` block bypasses the CSS custom properties system that was deliberately set up in `:root`. E.g., `line 127: color: #ff9f5f`, `line 139: color: #ffb078`, `line 319: color:#ffd6bf`, `line 327: color:#f8fafc`, `line 335: color:#a8bad8`, `line 374–387: color:#90a8cb`, `line 104: rgba(6,182,212,0.22)` in blob gradients — none of these use the defined `--nitro-*` variables. This makes theme updates a grep-and-pray exercise. If `--nitro-orange` changes, `#ff9f5f` and `#ffb078` remain stale without any compiler error. Fix: either define the missing tints as variables (`--nitro-orange-dim`, `--nitro-text-label`, etc.) or audit and reference what already exists.

- **Two completely separate code blocks rendering the same content**: Sections 6 and 9 both render a "Add User Authentication" task.md demo (lines 585–603 and lines 733–756) with slightly different content — the Section 6 block uses `npx nitro-fueled init` (no Google OAuth), while Section 9's block adds Google OAuth, rate limiting, and refresh tokens. A future editor will not know which one to keep in sync and will inevitably update one and not the other. If both must exist, they need to show different tasks, not the same task title with invisible content drift.

- **`nav` element queried without null guard, then used inside `updateNav` without re-check**: Line 855 does `const nav = document.getElementById('main-nav')` and line 857 does `if (window.scrollY > 40)` with `nav?.classList.add(...)`. The optional chain is correct here, but if `nav` is null, the `scroll` event listener still fires on every scroll. A null check before attaching the listener is the right fix: `if (!nav) return;` after the query.

- **`hamburgerBtn.setAttribute` called without null guard on line 871**: Line 870 uses `mobileMenu?.classList.toggle('open')` (safely optional), but line 871 calls `hamburgerBtn.setAttribute(...)` without the `?` operator. If `hamburgerBtn` is somehow null at runtime, this throws. Either use `hamburgerBtn?.setAttribute` or add an early return after the initial null check.

### Major (should fix)

- **`style=""` attributes on most visually complex elements make Tailwind the decoration layer, not the primary layer**: The hero badge (line 319), the H1 (line 327), the tagline `<p>` (line 335), the hero ambient blobs (lines 312–313), the pipeline stage pills (lines 359–367), and the section-4 top border (line 439) all carry inline `style=""` attributes with layout, color, typography, and animation values. These inline styles take precedence over Tailwind and cannot be overridden from a Tailwind utility without `!important`. The mixed approach means two mental models are required to understand what a single element actually looks like. The CSS `<style>` block is the right place for any value that cannot be expressed as a Tailwind utility; the inline attribute should be a last resort.

- **`font-weight: 850` is not a valid CSS value** (line 327, inline style on the H1). CSS `font-weight` accepts multiples of 100 from 100–900, or the keywords `bold`/`bolder`/`lighter`. `850` is silently clamped or ignored by browsers — the actual rendered weight depends on the browser's rounding behavior and whether the font supports variable axes. Use `900` if maximum weight is the intent.

- **Hero ambient blobs (lines 312–313) duplicate `.blob-a` / `.blob-b` classes defined in the `<style>` block**: The fixed-position full-page blobs (`.blob-a`, `.blob-b`) already exist and animate. The hero section adds two more blobs as `position:absolute` inside the section via inline styles — but they share no classes, meaning the same visual effect is implemented twice with different code paths. If you need different colors per-section, parameterize via a class modifier; don't maintain two parallel systems.

- **`animateCounter` runs immediately on page load regardless of whether the stats are in the viewport**: Lines 912–915 start all four counters on `DOMContentLoaded`. If the hero section is below the fold (unlikely on desktop, possible on very tall mobile viewports) or the page loads mid-scroll, the counters animate to completion before the user sees them. The counters should start when the `.hero-stat` elements intersect the viewport, which could share the same `IntersectionObserver` set up for fade-in sections.

- **Feature 6 card (lines 713–721) uses `yellow-400` Tailwind color class instead of a `--nitro-*` variable**: `bg-yellow-400/10` and `text-yellow-400` are the only Tailwind color tokens in the file that are not project-specific. Every other feature card uses `bg-[rgba(r,g,b,alpha)]` with the corresponding `text-nitro-*` class. This inconsistency means yellow is the only feature color that does not participate in a potential dark/light theme swap.

- **Section divider elements defined in CSS but never used in the HTML**: The `.section-divider` class is defined at line 162–166 but does not appear anywhere in the template. This is dead CSS.

- **`<line>` SVG elements used throughout** (e.g., lines 416, 427, 459, 492, 505, 506, 637, 638): The `<line>` element in SVG is deprecated in favor of `<path>`. While browsers continue to support it, the codebase already uses `<path>` and `<polyline>` for most icons. The inconsistency is minor in isolation but signals that some icons came from an older icon set copy-paste source.

- **`aria-expanded` attribute not toggled on initial state**: The hamburger button (line 273) initializes with `aria-expanded="false"`. This is correct. However, when the mobile menu is closed by clicking a nav link (lines 874–879), `hamburgerBtn` is accessed with an optional chain (`hamburgerBtn?.setAttribute`), but in the initial open toggle on line 871 it is accessed without one. The inconsistency will confuse the next developer reading the event handlers side-by-side.

### Minor (nice to have)

- **`px-10` used for section inner padding instead of `px-6` which is used in the nav and hero**: The nav and hero both use `px-6` for horizontal padding. Sections 3–11 use `px-10`. There is no comment or design spec reference explaining this difference. If it is intentional, a comment would clarify the intent.

- **`max-w-[1200px]` and `max-w-[1120px]` are both used**: The hero content wrapper (line 315) uses `max-w-[1120px]`; every other section uses `max-w-[1200px]`. The 80px difference is likely intentional for the hero text, but a named Tailwind token or comment would make the reasoning visible to future editors.

- **Comment style is inconsistent**: Section dividers use `<!-- ========== SECTION N: TITLE ========== -->` (lines 231, 309, 392, etc.), which is clear. But within sections, some subsections use `<!-- Card 1 -->`, `<!-- Step 1 -->` and others have no comment at all. Picking one style and applying it consistently reduces maintenance friction.

- **The `<style>` block mixes concerns**: The block contains a manual CSS reset, CSS custom properties, keyframe animations, component styles, and media queries — all in a single undifferentiated block. Grouping with section comments already exists partially (e.g., `/* Nav */`, `/* Blobs */`), but some sections are missing headers (e.g., the `.fade-in` staggered delay rules at lines 154–159 have no section comment separating them from the transition property above).

- **`el.textContent = target + suffix` in `animateCounter` (line 900) concatenates a number and string without explicit coercion**: The behavior is correct in JavaScript (string coercion is implicit), but `String(target) + suffix` or a template literal makes the intent explicit and avoids lint warnings in strict TypeScript contexts.

- **`{ passive: true }` on the scroll listener (line 863) is correct but the option is not used for the `IntersectionObserver` callbacks**: This is not a bug — `IntersectionObserver` does not have a passive option — but the comment explaining why `passive: true` was added to the scroll listener would help future maintainers understand the performance intent.

- **Inline `style="overflow:hidden"` on the hero `<section>` (line 310)** while the rest of the component uses Tailwind utilities. `overflow-hidden` is a valid Tailwind class and should be used here for consistency.

## Summary

The page is functionally complete and visually coherent, but it carries significant internal inconsistency between its CSS custom property system and the hardcoded hex/rgba values that shadow or ignore those variables. The mixed inline-style and Tailwind approach forces two parallel mental models for understanding visual output. The duplicated code block content and the counter animation timing gap are the most likely sources of future confusion or regression. Score reflects a working implementation with multiple maintainability gaps that will compound as the page evolves.
