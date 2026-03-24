# Implementation Plan - TASK_2026_018

## Design Direction Chosen

**Directional nitro flow-field streak system** with layered heat/cool glows and pointer-driven pressure turbulence.

Rationale:
- Replaces graph semantics with acceleration semantics
- Provides visual identity tied to product name
- Allows premium, controlled intensity without cartoony motifs

## Planned Work Batches

1. Hero composition/art direction (HTML/CSS)
- Add hero content wrapper and decorative heat layers
- Improve badge/title/cards material treatment
- Rebalance spacing and focus around headline readability

2. Canvas engine replacement (JS)
- Remove old node-link model
- Implement stream entities with directional flow sampling
- Render luminous streaks + trailing persistence + ripple pressure

3. Interaction and accessibility
- Pointer turbulence (twist + push)
- Reduced-motion static fallback
- Resize-aware canvas scaling and density capping

4. Final integration
- Keep GSAP reveal behavior
- Retarget hero selectors after markup adjustments
- Move landing assets into `landing/` and keep local references correct
