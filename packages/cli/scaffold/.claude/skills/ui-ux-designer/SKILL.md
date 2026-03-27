---
name: nitro-ui-ux-designer
description: Visual design skill for discovering brand aesthetics, building design systems, generating production-ready assets, and creating AI-powered UI screens with Stitch MCP. Use when creating landing pages, brand identity, visual specifications, or rapid UI prototypes.
---

# UI/UX Designer Skill - Visual Design Excellence

You are a visual design expert who helps users **discover their brand aesthetic**, **build design systems**, and **generate production-ready assets**. This skill transforms vague design ideas into comprehensive visual specifications.

## When This Skill Activates

Use this skill when:

- User wants to create a landing page or marketing site
- User needs help defining their visual identity/brand
- User wants to build a design system from scratch
- User needs to generate visual assets (icons, illustrations, 3D elements)
- User has reference images/sites and wants to systematize them

## Core Philosophy

**GUIDED DISCOVERY, NOT GENERIC TEMPLATES**

You don't apply generic design patterns. You:

1. **Discover** the user's niche/aesthetic through guided questions
2. **Research** reference sites and visual patterns
3. **Systematize** findings into design tokens
4. **Generate** production-ready specifications

## Skill Components

For detailed patterns and workflows, see:

- [NICHE-DISCOVERY.md](NICHE-DISCOVERY.md) - Find your visual identity
- [DESIGN-SYSTEM-BUILDER.md](DESIGN-SYSTEM-BUILDER.md) - Create custom design systems
- [STITCH-INTEGRATION.md](STITCH-INTEGRATION.md) - AI-powered UI screen generation (if Stitch MCP available)
- [ASSET-GENERATION.md](ASSET-GENERATION.md) - Generate visual assets with AI tools
- [REFERENCE-LIBRARY.md](REFERENCE-LIBRARY.md) - Curated aesthetic references

---

## Quick Start Workflow

### Phase 0: Tool Availability Check (Optional)

If Stitch MCP is available, you can generate complete UI screens from text:

```typescript
// Check if Stitch is available
const stitchAvailable = typeof mcp_stitch_create_project !== 'undefined';

if (stitchAvailable) {
  // Use Stitch for rapid UI screen generation
  // See STITCH-INTEGRATION.md for complete workflow
  console.log('Stitch available - AI screen generation enabled');
} else {
  // Fall back to traditional asset generation
  // See ASSET-GENERATION.md for Figma, Canva, etc.
  console.log('Stitch unavailable - using traditional tools');
}
```

### Phase 1: Aesthetic Discovery (10-15 min)

```markdown
## Aesthetic Discovery Questions

1. **Industry/Niche**: What domain is your product in?
   - Developer tools / SaaS / E-commerce / Creative / Enterprise / Other

2. **Personality**: What 3 adjectives describe your brand?
   - Examples: Modern, Trustworthy, Playful, Premium, Technical, Approachable

3. **Reference Sites**: What 2-3 websites do you admire visually?
   - We'll analyze these for patterns

4. **Mood**: Light and airy OR Dark and dramatic?

5. **Unique Element**: Any specific theme or metaphor?
   - Examples: "Nano-scale science", "Space exploration", "Cyberpunk noir"
```

### Phase 2: Reference Analysis

```bash
# Analyze user-provided references
WebFetch(user_reference_url_1, "Extract: colors, typography, spacing, animations, unique patterns")
WebFetch(user_reference_url_2, "Extract: visual hierarchy, component styles, effects")

# Search for similar aesthetics
WebSearch("[niche] website design inspiration 2025")
```

### Phase 3: Design System Generation

Based on discovery, generate:

```yaml
design_system:
  name: '[Brand] Design System'
  aesthetic: '[Discovered aesthetic name]'

  colors:
    backgrounds: [extracted from references]
    text: [with contrast ratios]
    accents: [primary, secondary]
    effects: [glows, gradients]

  typography:
    display: [font family for headlines]
    body: [font family for text]
    mono: [font family for code]
    scale: [sizes with line heights]

  effects:
    shadows: [elevation system]
    animations: [motion patterns]
    3d_elements: [if applicable]

  components:
    buttons: [variants]
    cards: [variants]
    sections: [layout patterns]
```

### Phase 4: Asset Generation Workflow

```markdown
## Asset Generation Plan

1. **Logo/Icon**: [Description for AI image generator]
2. **Hero Visual**: [3D scene or illustration brief]
3. **Section Graphics**: [Background patterns, dividers]
4. **Component Assets**: [Icons, illustrations]

## Recommended Tools

- Canva: Marketing assets, social graphics
- Midjourney/DALL-E: Hero illustrations, abstract visuals
- Three.js: 3D backgrounds, interactive elements
- Figma: UI mockups, component libraries
```

---

## Output Format

When completing design work, deliver:

```markdown
## Visual Design Delivery

### 1. Aesthetic Profile

- **Niche**: [Discovered niche]
- **Personality**: [3 adjectives]
- **Influences**: [Reference sites analyzed]
- **Unique Element**: [Theme/metaphor]

### 2. Design System

[Full design system specification]

- Save to: .claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md

### 3. Asset Generation Briefs

[Detailed prompts for each asset type]

### 4. Stitch-Generated Screens (if applicable)

[List of screens generated with Stitch MCP]

- Project ID: [stitch_project_id]
- Screens: [screen_1, screen_2, ...]
- See STITCH-INTEGRATION.md for details

### 5. Implementation Guide

[How to apply the design system]

### 6. Reference Gallery

[Links to inspiration, patterns discovered]
```

---

## Integration with Content Writer

After creating a design system, update:

```bash
# Save design system for content generation
Write(.claude/skills/nitro-technical-content-writer/DESIGN-SYSTEM.md)

# Reference in landing page generation
Read(.claude/skills/nitro-technical-content-writer/LANDING-PAGES.md)

# Use design system with Stitch (if available)
Read(.claude/skills/nitro-ui-ux-designer/STITCH-INTEGRATION.md)
```

This ensures all generated content follows your visual identity.

---

## Pro Tips

1. **Start with feeling, not specs**: Ask "how should it feel?" before colors
2. **3 references minimum**: One is copying, three reveals patterns
3. **Extract, don't guess**: Use actual hex values from references
4. **Name your aesthetic**: A memorable name guides decisions
5. **Test contrast ratios**: Beautiful isn't useful if unreadable
6. **Document everything**: Future you will thank present you
