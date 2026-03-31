# Asset Generation - Create Visual Assets with AI

## Purpose

This guide documents workflows for generating production-ready visual assets using AI tools. Learn to craft effective prompts and workflows for different asset types.

---

## Tool Selection Matrix

| Asset Type               | Best Tool                 | Why                               |
| ------------------------ | ------------------------- | --------------------------------- |
| **Complete UI screens**  | Stitch MCP (if available) | AI-powered, instant generation    |
| **Hero illustrations**   | Midjourney, DALL-E 3      | Complex scenes, unique art styles |
| **Icons**                | Midjourney + refinement   | Consistent style sets             |
| **3D elements**          | Three.js, Spline          | Interactive, animated             |
| **Marketing graphics**   | Canva                     | Templates, quick iterations       |
| **UI mockups**           | Figma, Framer             | Developer handoff, precision      |
| **Backgrounds/patterns** | Midjourney                | Unique, tileable                  |
| **Product screenshots**  | Screen Studio, CleanShot  | Polished presentations            |

---

## Prompting Framework

### The SCSM Formula

**S**ubject + **C**ontext + **S**tyle + **M**odifiers

```
[What you want] + [Environment/Setting] + [Art style/Aesthetic] + [Technical specs]
```

### Example Breakdown

```
Subject:     "A glowing circuit board pattern"
Context:     "forming the shape of a house with digital agents inside"
Style:       "cyberpunk tech aesthetic, premium dark theme"
Modifiers:   "--ar 16:9 --v 6 --style raw"

Full prompt: "A glowing circuit board pattern forming the shape of a house
              with digital agents inside, cyberpunk tech aesthetic,
              premium dark theme, deep black background (#0a0a0a),
              accent glow effects, minimalist --ar 16:9 --v 6 --style raw"
```

---

## Asset Type Workflows

### 1. Hero Section Visuals

**Goal**: Create the main visual element for your landing page hero

#### Prompt Template

```markdown
## Hero Visual Brief

**Concept**: [Core visual idea]
**Aesthetic**: [Your design system aesthetic]
**Colors**:

- Background: [hex]
- Accent: [hex]
- Secondary: [hex]
  **Mood**: [Descriptive words]
  **Composition**: [Layout guidance]
  **Technical**: [Aspect ratio, quality settings]
```

#### Example: Developer Tool Hero

```
Prompt: "Abstract 3D visualization of interconnected AI agents as glowing nodes,
         connected by flowing data streams, floating in deep black void,
         surrounded by subtle particle effects, futuristic technology aesthetic,
         premium dark theme, cinematic lighting, volumetric fog, 8k quality,
         deep black background, accent color glow effects,
         subtle ambient glow --ar 16:9 --v 6 --s 250"
```

#### Iteration Process

1. **Generate 4 variations** with base prompt
2. **Pick best direction**, note what works
3. **Refine prompt** with specific improvements
4. **Upscale** winning image
5. **Post-process** (adjust colors to match design system)

---

### 2. Icon Sets

**Goal**: Create consistent icon set for features/navigation

#### Consistency Techniques

```markdown
## Icon Generation Rules

1. **Same prompt structure** for all icons
2. **Same style keywords** every time
3. **Same modifiers** (--v, --s, --style)
4. **Same color reference** in every prompt
5. **Generate in batches** for consistency
```

#### Icon Prompt Template

```
"[Object] icon, [style] design, [color] on [background],
 minimal, geometric, consistent stroke width, centered composition,
 [your aesthetic keywords], clean edges, scalable --ar 1:1 --v 6"
```

#### Example: Feature Icons

```
Base style: "minimal line icon, accent color strokes on transparent,
             geometric, tech aesthetic, 2px stroke weight"

Icons:
- "Agent orchestration icon, [base style] --ar 1:1"
- "Code brackets icon, [base style] --ar 1:1"
- "Lightning bolt icon, [base style] --ar 1:1"
- "Cube/3D box icon, [base style] --ar 1:1"
```

---

### 3. Background Patterns

**Goal**: Create tileable patterns or abstract backgrounds

#### Pattern Types

| Type              | Use Case              | Prompt Keywords                |
| ----------------- | --------------------- | ------------------------------ |
| **Tileable**      | Repeating backgrounds | "seamless pattern", "tileable" |
| **Hero gradient** | Section backgrounds   | "gradient", "fade to black"    |
| **Texture**       | Subtle overlays       | "noise texture", "grain"       |
| **Geometric**     | Tech aesthetics       | "geometric pattern", "grid"    |

#### Example: Tech Pattern

```
"Seamless tileable pattern of subtle circuit board traces and node connections,
 very dark gray (#1a1a1a) on black (#0a0a0a), extremely subtle,
 barely visible, minimal, abstract, tech aesthetic --tile --v 6"
```

---

### 4. 3D Elements (Three.js/Spline)

**Goal**: Create interactive 3D elements for web

#### When to Use 3D

- Hero section backgrounds with parallax
- Interactive product showcases
- Animated accents (floating shapes)
- Loading/transition animations

#### Three.js Asset Specs

```yaml
sphere_hero:
  geometry: SphereGeometry(1, 64, 64)
  material:
    type: MeshStandardMaterial
    metalness: 1.0
    roughness: 0.2
    color: '[accent color]'
  effects:
    - UnrealBloomPass
    - Particle halo
  animation:
    - Slow rotation (0.001 rad/frame)
    - Mouse parallax

particle_system:
  count: 500
  size: 0.02
  color: '[accent color]'
  opacity: 0.6
  animation:
    - Random drift
    - Opacity pulse
```

#### Handoff Format

```typescript
// 3D Element Specification
export const heroSphereConfig = {
  geometry: {
    type: 'sphere',
    radius: 1,
    segments: 64,
  },
  material: {
    type: 'standard',
    metalness: 1.0,
    roughness: 0.2,
    color: '#accent',
  },
  effects: ['bloom', 'particles'],
  animation: {
    rotation: { y: 0.001 },
    parallax: { sensitivity: 0.5 },
  },
};
```

---

### 5. Marketing Graphics (Canva)

**Goal**: Create social media, presentations, promotional materials

#### Canva Workflow

```typescript
// 1. Search for templates
mcp__Canva__search_designs({
  query: 'developer tool landing dark theme',
  ownership: 'any',
});

// 2. Generate custom designs
mcp__Canva__generate_design({
  design_type: 'presentation',
  query: `
    Product showcase presentation for AI development tool.
    Dark theme background, accent color highlights.
    Clean typography, generous whitespace.
    Include: hero slide, features grid, code examples, CTA.
    Style: Premium tech, minimal.
  `,
});

// 3. Export production assets
mcp__Canva__export_design({
  design_id: 'selected_design_id',
  format: { type: 'png', width: 1920, height: 1080 },
});
```

---

### 6. UI Screens (Stitch MCP)

**Goal**: Generate complete UI screens from text descriptions

> **Stitch MCP Integration**
>
> If Stitch MCP is available in your environment, you can generate complete UI screens instantly.
> See [STITCH-INTEGRATION.md](STITCH-INTEGRATION.md) for the complete guide.

#### When to Use Stitch

**Use Stitch when:**

- Need complete screen layouts quickly
- Iterating on UI concepts rapidly
- Generating multiple screen variations
- Creating responsive designs (mobile/desktop/tablet)
- Prototyping before coding

**Use Figma/Framer when:**

- Need pixel-perfect control
- Creating production-ready design files
- Complex interactions and animations
- Design system management

#### Quick Stitch Workflow

```typescript
// 1. Check availability
const stitchAvailable = typeof mcp_stitch_create_project !== 'undefined';

if (!stitchAvailable) {
  console.log('Stitch unavailable - use Figma or Framer instead');
  // Fall back to traditional tools
}

// 2. Create project
const project = await mcp_stitch_create_project({
  title: 'Landing Page Designs',
});

// 3. Generate screen with design system
const screen = await mcp_stitch_generate_screen_from_text({
  projectId: project.id,
  prompt: `
    Create a modern landing page hero section for an AI development tool.

    Components:
    - Headline: "Build Software with AI Agents"
    - Subheadline: "Multi-agent orchestration for modern development teams"
    - Primary CTA: "Get Started Free"
    - Secondary CTA: "Watch Demo"
    - Hero image placeholder (right side)

    Layout:
    - Split layout (60% text, 40% image)
    - Vertical center alignment
    - Generous whitespace

    Colors:
    - Background: Deep black (#0a0a0a)
    - Primary accent: [your accent color]
    - Text: White (#ffffff)

    Style:
    - Premium, modern, minimal
    - Clean typography
    - Professional and trustworthy
  `,
  deviceType: 'DESKTOP',
  modelId: 'GEMINI_3_FLASH', // Use FLASH for iteration, PRO for final
});

console.log('Screen generated:', screen.id);
```

#### Stitch Prompt Template

Use the **CLCD Formula**: Components + Layout + Colors + Details

```typescript
const stitchPrompt = `
Create a [screen type] for [use case].

Components:
- [Component 1]
- [Component 2]
- [Component 3]

Layout:
- [Arrangement description]
- [Spacing details]

Colors:
- Background: [hex]
- Primary: [hex]
- Text: [hex]

Style:
- [Adjective 1], [Adjective 2], [Adjective 3]
`;
```

#### Integration with Design System

```typescript
// Load design system
const designSystem = {
  colors: { bg: '#0a0a0a', accent: '#your-accent', text: '#ffffff' },
  fonts: { display: 'Your Display Font', body: 'Inter' },
  aesthetic: 'Your aesthetic description',
};

// Apply to Stitch prompt
const prompt = `
Create a pricing section with 3 tiers.

Design System:
- Background: ${designSystem.colors.bg}
- Accent: ${designSystem.colors.accent}
- Text: ${designSystem.colors.text}
- Display font: ${designSystem.fonts.display}
- Body font: ${designSystem.fonts.body}

Aesthetic: ${designSystem.aesthetic}

Layout: 3 cards side-by-side, equal width
Style: Premium, clean, modern
`;
```

#### For Complete Stitch Documentation

See [STITCH-INTEGRATION.md](STITCH-INTEGRATION.md) for:

- Project management
- Advanced prompt engineering
- Iteration strategies
- Batch generation
- Design system integration
- Export and handoff workflows
- Troubleshooting tips

---

## Post-Processing Workflow

### Color Correction

After generating assets, ensure colors match your design system:

1. **Open in editor** (Photoshop, Figma, or GIMP)
2. **Sample generated colors** with eyedropper
3. **Adjust to exact tokens** using Hue/Saturation
4. **Verify contrast** still meets WCAG

### Format Optimization

| Asset Type           | Format | Optimization           |
| -------------------- | ------ | ---------------------- |
| Photos/illustrations | WebP   | 80-90% quality         |
| Icons                | SVG    | Minified               |
| UI elements          | PNG    | Transparent, optimized |
| Patterns             | WebP   | Tileable, small size   |
| 3D previews          | WebP   | Fallback for no-JS     |

### Size Guidelines

```yaml
hero_images:
  desktop: 1920x1080 or wider
  tablet: 1024x768
  mobile: 640x480

icons:
  small: 24x24
  medium: 48x48
  large: 96x96
  export: SVG (scalable)

social:
  og_image: 1200x630
  twitter: 1200x600
  instagram: 1080x1080
```

---

## Prompt Library

### Developer Tool Aesthetic

```
Base keywords: "developer tool, modern tech, dark theme, clean interface,
               code-inspired patterns, subtle glow effects, geometric patterns,
               minimal, professional"
```

### Clean Enterprise

```
Base keywords: "clean minimal design, white background, soft shadows,
               professional, enterprise, subtle gradients, generous whitespace,
               modern typography, indigo accents, trustworthy"
```

### Gradient Modern

```
Base keywords: "modern gradient, purple to blue to teal, dark background,
               glass morphism, blur effects, futuristic, sleek, dynamic,
               neon glow, tech-forward"
```

---

## Asset Documentation Template

For each generated asset, document:

```markdown
## Asset: [Name]

**Type**: [Hero/Icon/Background/etc.]
**Tool**: [Midjourney/DALL-E/Canva/etc.]
**File**: [filename.ext]

### Generation Details

**Prompt**:
```

[Full prompt used]

```

**Settings**: [--v 6 --ar 16:9 --s 250]
**Iterations**: [Number of attempts]

### Post-Processing
- [ ] Color corrected to design system
- [ ] Optimized for web
- [ ] Multiple sizes exported

### Usage
- **Location**: [Where this asset is used]
- **Fallback**: [Alternative if asset fails to load]

### Files
- Original: `/assets/originals/[name]-original.png`
- Web: `/assets/web/[name].webp`
- Mobile: `/assets/mobile/[name]-mobile.webp`
```

---

## Quality Checklist

Before using generated assets:

- [ ] Colors match design system tokens (within 5% variance)
- [ ] Contrast meets accessibility requirements
- [ ] Resolution sufficient for intended display size
- [ ] File size optimized for web (<500KB for heroes)
- [ ] Fallback/alt text defined
- [ ] Asset documented in inventory
- [ ] License/usage rights confirmed (for AI-generated)
