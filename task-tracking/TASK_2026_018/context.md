# Context - TASK_2026_018

## Existing State Before Refactor

- Landing lived at `docs/nitro-fueled-overview.html` then moved to `landing/index.html`
- Hero used `#hero-network` canvas with node generation, link rendering, and mouse aura
- GSAP/ScrollTrigger already handled section reveal animations

## Why It Felt Generic

- Motion was non-directional and point-centric
- Visual semantics mapped to "AI graph" rather than "nitro energy"
- Orange accent existed, but core animation language was still network-template-like

## Constraints

- No heavy runtime dependencies beyond existing GSAP use
- Must remain readable and performant
- Must run as static assets
