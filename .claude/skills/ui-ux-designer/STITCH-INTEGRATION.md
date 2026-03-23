# Stitch MCP Integration - AI-Powered UI Screen Generation

## Overview

**Stitch** is an AI-powered UI design tool accessible via MCP (Model Context Protocol) that generates complete UI screens from text descriptions. It complements traditional design tools by enabling rapid prototyping and iteration.

### When to Use Stitch

**Use Stitch when:**

- Generating complete screen layouts quickly
- Iterating on UI concepts rapidly
- Creating multiple screen variations
- Prototyping responsive designs (mobile/desktop/tablet)
- Need visual mockups before coding

**Use traditional tools when:**

- Need pixel-perfect control (use Figma)
- Creating production-ready code (use your framework)
- Designing complex interactions (use Framer)
- Need design system management (use Figma/Storybook)

### Stitch vs Traditional Design Tools

| Capability        | Stitch         | Figma         | Framer         | Code          |
| ----------------- | -------------- | ------------- | -------------- | ------------- |
| **Speed**         | Instant        | Hours         | Hours          | Days          |
| **Iteration**     | Seconds        | Minutes       | Minutes        | Hours         |
| **Precision**     | Good           | Excellent     | Excellent      | Perfect       |
| **Interactivity** | Static         | Prototypes    | Full           | Full          |
| **Handoff**       | Visual spec    | Dev mode      | Code export    | Production    |

**Best Practice:** Use Stitch for rapid exploration, then refine in Figma or code.

---

## Availability Check

Before using Stitch, verify it's available in your MCP configuration.

### Checking Availability

```typescript
// Method 1: Try-catch approach
async function isStitchAvailable(): Promise<boolean> {
  try {
    await mcp_stitch_list_projects({ filter: 'view=owned' });
    return true;
  } catch (error) {
    return false;
  }
}

// Method 2: Type check (if in TypeScript context)
const stitchAvailable = typeof mcp_stitch_create_project !== 'undefined';
```

### Graceful Degradation

```typescript
if (await isStitchAvailable()) {
  // Use Stitch workflow
  console.log('Stitch available - using AI screen generation');
  // Proceed with Stitch integration
} else {
  // Fall back to traditional tools
  console.log('Stitch unavailable - using traditional asset generation');
  // Use ASSET-GENERATION.md workflows (Figma, Canva, etc.)
}
```

---

## Project Management

### Creating Projects

Projects organize related screens (e.g., all screens for a landing page, dashboard, or desktop app).

```typescript
// Create a new Stitch project
const project = await mcp_stitch_create_project({
  title: 'My Project Landing Page', // Optional but recommended
});

console.log(`Project created: ${project.id}`);
// Returns: { id: '3780309359108792857', ... }
```

### Project Naming Conventions

| Project Type      | Naming Pattern           | Example                         |
| ----------------- | ------------------------ | ------------------------------- |
| Landing page      | `[Product] Landing Page` | `Acme Landing Page`     |
| Dashboard         | `[Product] Dashboard UI` | `Agent Dashboard UI`            |
| Desktop app       | `[Product] Desktop App`  | `Acme Desktop App`      |
| Component library | `[Product] Components`   | `Design System Components`      |
| Feature flow      | `[Feature] User Flow`    | `Onboarding User Flow`          |

### Listing Projects

```typescript
// List your projects
const ownedProjects = await mcp_stitch_list_projects({
  filter: 'view=owned',
});

// List shared projects
const sharedProjects = await mcp_stitch_list_projects({
  filter: 'view=shared',
});
```

### Retrieving Project Details

```typescript
// Get project by name (format: "projects/{project_id}")
const project = await mcp_stitch_get_project({
  name: 'projects/3780309359108792857',
});
```

---

## Screen Generation Workflow

### Basic Screen Generation

```typescript
const screen = await mcp_stitch_generate_screen_from_text({
  projectId: '3780309359108792857',
  prompt:
    'Create a modern desktop app landing page hero section with headline, subheadline, and CTA button',
  deviceType: 'DESKTOP',
  modelId: 'GEMINI_3_FLASH',
});

console.log(`Screen generated: ${screen.id}`);
```

### Device Type Selection

| Device Type | Use Case            | Aspect Ratio     |
| ----------- | ------------------- | ---------------- |
| `MOBILE`    | Phone screens       | Portrait (9:16)  |
| `DESKTOP`   | Web applications    | Landscape (16:9) |
| `TABLET`    | Tablet interfaces   | Square-ish (4:3) |
| `AGNOSTIC`  | Responsive/flexible | Varies           |

**Recommendation:** Generate separate screens for mobile and desktop for responsive designs.

### Model Selection

| Model            | Speed  | Quality      | Use Case                       |
| ---------------- | ------ | ------------ | ------------------------------ |
| `GEMINI_3_FLASH` | Fast   | Good         | Rapid iteration, exploration   |
| `GEMINI_3_PRO`   | Slower | Excellent    | Final designs, complex layouts |

**Recommendation:** Use `FLASH` for iteration, `PRO` for final outputs.

### Handling Generation Response

```typescript
const result = await mcp_stitch_generate_screen_from_text({
  projectId: project.id,
  prompt: 'Dashboard with sidebar navigation and data cards',
  deviceType: 'DESKTOP',
  modelId: 'GEMINI_3_FLASH',
});

// Check output_components for suggestions
if (result.output_components) {
  console.log('Stitch suggestions:', result.output_components);

  // If suggestions present, user can accept one
  if (result.output_components.includes('Yes, make them all')) {
    // Regenerate with accepted suggestion
    const refined = await mcp_stitch_generate_screen_from_text({
      projectId: project.id,
      prompt: 'Yes, make them all',
      deviceType: 'DESKTOP',
      modelId: 'GEMINI_3_FLASH',
    });
  }
}
```

---

## Prompt Engineering for Stitch

### Prompt Structure

Use the **CLCD Formula** for Stitch prompts:

**C**omponents + **L**ayout + **C**olors + **D**etails

```
[What components] + [How they're arranged] + [Color scheme] + [Style details]
```

### Basic Prompt Template

```typescript
const prompt = `
Create a [screen type] for [use case].

Components:
- [Component 1]
- [Component 2]
- [Component 3]

Layout:
- [Arrangement description]

Colors:
- Background: [color/hex]
- Primary: [color/hex]
- Text: [color/hex]

Style:
- [Adjective 1], [Adjective 2], [Adjective 3]
`;
```

### Example: Landing Page Hero

```typescript
const heroPrompt = `
Create a landing page hero section for an AI-powered development tool.

Components:
- Main headline: "Build Software with AI Agents"
- Subheadline: "Multi-agent orchestration for modern development workflows"
- Primary CTA button: "Get Started Free"
- Secondary CTA button: "Watch Demo"
- Hero image placeholder (right side)

Layout:
- Split layout: text left (60%), image right (40%)
- Vertical center alignment
- Generous whitespace

Colors:
- Background: Deep black (#0a0a0a)
- Primary accent: [your accent color]
- Text: White (#ffffff)
- Subtle gradient overlay

Style:
- Premium, modern, minimal
- Clean typography with generous spacing
- Subtle shadow effects
- Professional and trustworthy
`;
```

### Incorporating Design System Tokens

```typescript
// Load your design system
const designSystem = readDesignSystem(); // From DESIGN-SYSTEM-BUILDER.md

const prompt = `
Create a dashboard header component.

Components:
- Logo (left)
- Navigation menu (center)
- User profile dropdown (right)

Colors (from design system):
- Background: ${designSystem.colors.backgrounds.primary}
- Text: ${designSystem.colors.text.primary}
- Accent: ${designSystem.colors.accents.primary}

Typography (from design system):
- Font family: ${designSystem.typography.body}
- Heading size: ${designSystem.typography.scale.h3}

Style:
- ${designSystem.aesthetic} aesthetic
- Minimal, clean, professional
`;
```

### Advanced Prompt Techniques

#### Specify Responsive Behavior

```typescript
const responsivePrompt = `
Create a pricing section with 3 tiers.

Desktop layout:
- 3 cards side-by-side
- Equal width columns
- Hover effects on cards

Mobile layout (if MOBILE device type):
- Stacked vertically
- Full-width cards
- Touch-friendly spacing
`;
```

#### Reference Existing Patterns

```typescript
const referencePrompt = `
Create a feature section similar to Stripe's homepage.

Style reference:
- Clean, minimal design
- Icon + text layout
- Subtle animations implied
- Grid of 4 features (2x2)

Colors:
- Light background (#f6f9fc)
- Dark text (#1a1a1a)
- Blue accents (#635bff)
`;
```

#### Specify Component States

```typescript
const statePrompt = `
Create a button component showing different states.

States to show:
- Default (blue background, white text)
- Hover (darker blue, slight scale)
- Active/Pressed (even darker, scale down)
- Disabled (gray, reduced opacity)

Layout: Show all 4 states horizontally
`;
```

---

## Design Iteration

### Iteration Strategy

```typescript
// 1. Initial generation (broad concept)
const v1 = await generateScreen({
  prompt: 'Modern dashboard with sidebar and data cards',
  modelId: 'GEMINI_3_FLASH', // Fast iteration
});

// 2. Review and identify improvements
// "Need more spacing, darker colors, add charts"

// 3. Refine with specific feedback
const v2 = await generateScreen({
  prompt: `
    Refine the previous dashboard:
    - Increase spacing between cards (24px gaps)
    - Use darker background (#0a0a0a instead of gray)
    - Add chart visualizations inside data cards
    - Make sidebar narrower (240px)
  `,
  modelId: 'GEMINI_3_FLASH',
});

// 4. Final polish with PRO model
const final = await generateScreen({
  prompt: 'Polish the dashboard with premium styling and subtle animations',
  modelId: 'GEMINI_3_PRO', // Higher quality
});
```

### Handling Stitch Suggestions

When Stitch returns `output_components` with suggestions:

```typescript
const result = await mcp_stitch_generate_screen_from_text({
  projectId: project.id,
  prompt: 'Create a contact form',
  deviceType: 'DESKTOP',
  modelId: 'GEMINI_3_FLASH',
});

if (result.output_components) {
  // Stitch might suggest: "Add validation states?" or "Include success message?"
  console.log('Suggestions:', result.output_components);

  // Accept suggestion by using it as next prompt
  const refined = await mcp_stitch_generate_screen_from_text({
    projectId: project.id,
    prompt: result.output_components, // Use suggestion as prompt
    deviceType: 'DESKTOP',
    modelId: 'GEMINI_3_FLASH',
  });
}
```

### Batch Generation

Generate multiple screens in parallel:

```typescript
const landingPageScreens = await Promise.all([
  generateScreen({ prompt: 'Hero section', deviceType: 'DESKTOP' }),
  generateScreen({ prompt: 'Features grid', deviceType: 'DESKTOP' }),
  generateScreen({ prompt: 'Pricing table', deviceType: 'DESKTOP' }),
  generateScreen({ prompt: 'Testimonials carousel', deviceType: 'DESKTOP' }),
  generateScreen({ prompt: 'Footer with links', deviceType: 'DESKTOP' }),
]);

console.log(`Generated ${landingPageScreens.length} screens`);
```

---

## Integration with Design System

### Workflow: Design System -> Stitch Prompts

```typescript
// 1. Create design system (DESIGN-SYSTEM-BUILDER.md)
const designSystem = {
  name: 'Project Design System',
  aesthetic: 'Premium AI development tool',
  colors: {
    backgrounds: { primary: '#0a0a0a', secondary: '#1a1a1a' },
    text: { primary: '#ffffff', secondary: '#a0a0a0' },
    accents: { primary: '#your-accent', secondary: '#secondary-accent' },
  },
  typography: {
    display: 'Your Display Font',
    body: 'Inter',
    scale: { h1: '48px/1.2', h2: '36px/1.3', body: '16px/1.6' },
  },
  effects: {
    shadows: ['0 2px 8px rgba(0,0,0,0.1)', '0 8px 24px rgba(0,0,0,0.2)'],
    borderRadius: { sm: '4px', md: '8px', lg: '16px' },
  },
};

// 2. Generate prompt template from design system
function createPromptFromDesignSystem(designSystem, screenDescription) {
  return `
Create ${screenDescription}.

Design System: ${designSystem.name}
Aesthetic: ${designSystem.aesthetic}

Colors:
- Background: ${designSystem.colors.backgrounds.primary}
- Text: ${designSystem.colors.text.primary}
- Accent: ${designSystem.colors.accents.primary}

Typography:
- Headlines: ${designSystem.typography.display}
- Body text: ${designSystem.typography.body}
- Sizes: ${JSON.stringify(designSystem.typography.scale)}

Effects:
- Border radius: ${designSystem.effects.borderRadius.md}
- Shadow: ${designSystem.effects.shadows[1]}

Style: Premium, modern, clean, professional
  `.trim();
}

// 3. Use template for generation
const screen = await mcp_stitch_generate_screen_from_text({
  projectId: project.id,
  prompt: createPromptFromDesignSystem(
    designSystem,
    'an agent workflow card with status, progress, and action buttons',
  ),
  deviceType: 'DESKTOP',
  modelId: 'GEMINI_3_FLASH',
});
```

### Ensuring Brand Consistency

```typescript
// Create a reusable brand prompt snippet
const brandPrompt = `
Brand: [Your Brand]
Aesthetic: Premium AI development tool
Colors: Deep black (#0a0a0a), accent highlights, white text
Typography: Display font for headlines, Inter for body
Style: Modern, professional, technical, trustworthy
`;

// Prepend to all prompts
const prompt = `
${brandPrompt}

Create a testimonial card with:
- User photo (circular)
- Quote text
- User name and title
- 5-star rating
`;
```

---

## Retrieving and Managing Screens

### Get Screen Details

```typescript
const screen = await mcp_stitch_get_screen({
  projectId: '3780309359108792857',
  screenId: '88805318abe84d16add098fae3add91e',
});

console.log('Screen details:', screen);
// Contains: design output, metadata, generation settings
```

### List All Screens in Project

```typescript
const screens = await mcp_stitch_list_screens({
  projectId: '3780309359108792857',
});

console.log(`Project has ${screens.length} screens`);

// Organize screens by type
const screensByType = screens.reduce((acc, screen) => {
  const type = screen.deviceType || 'UNKNOWN';
  acc[type] = acc[type] || [];
  acc[type].push(screen);
  return acc;
}, {});

console.log('Desktop screens:', screensByType.DESKTOP?.length || 0);
console.log('Mobile screens:', screensByType.MOBILE?.length || 0);
```

---

## Export and Handoff

### Documentation Format

```markdown
## Screen: [Screen Name]

**Generated**: [Date]
**Device Type**: [DESKTOP/MOBILE/TABLET]
**Model**: [GEMINI_3_FLASH/GEMINI_3_PRO]
**Project**: [Project Name]

### Prompt Used

\`\`\`
[Full prompt text]
\`\`\`

### Design Specifications

**Colors:**

- Background: [hex]
- Primary: [hex]
- Text: [hex]

**Typography:**

- Headlines: [font family, size]
- Body: [font family, size]

**Layout:**

- [Key layout details]

**Components:**

- [Component 1]: [Specifications]
- [Component 2]: [Specifications]

### Implementation Notes

- [ ] Responsive breakpoints needed
- [ ] Animations to implement
- [ ] Accessibility considerations
- [ ] Performance optimizations

### Files

- Stitch Screen ID: `[screen_id]`
- Project ID: `[project_id]`
```

### Developer Handoff Checklist

```markdown
## Developer Handoff: [Screen Name]

### Design Assets

- [ ] Stitch screen generated and reviewed
- [ ] Design system tokens documented
- [ ] Color values extracted
- [ ] Typography specifications noted
- [ ] Spacing/sizing measurements recorded

### Implementation Specs

- [ ] Component breakdown created
- [ ] Responsive behavior defined
- [ ] Interactive states specified
- [ ] Accessibility requirements listed
- [ ] Performance targets set

### Code Preparation

- [ ] Component structure planned
- [ ] CSS/styling approach decided
- [ ] Asset optimization completed
- [ ] Testing strategy defined
```

---

## Example Workflows

### Workflow 1: Landing Page Generation

```typescript
// 1. Create project
const project = await mcp_stitch_create_project({
  title: 'My Project Landing Page',
});

// 2. Define design system
const designSystem = {
  colors: { bg: '#0a0a0a', accent: '#your-accent', text: '#ffffff' },
  fonts: { display: 'Your Display Font', body: 'Inter' },
  aesthetic: 'Premium AI development tool',
};

// 3. Generate sections
const sections = {
  hero: await mcp_stitch_generate_screen_from_text({
    projectId: project.id,
    prompt: `
      Hero section for AI-powered development platform.
      Components: Headline, subheadline, CTA buttons, hero image
      Layout: Split (text left, image right)
      Colors: ${JSON.stringify(designSystem.colors)}
      Style: ${designSystem.aesthetic}
    `,
    deviceType: 'DESKTOP',
    modelId: 'GEMINI_3_PRO',
  }),

  features: await mcp_stitch_generate_screen_from_text({
    projectId: project.id,
    prompt: `
      Features grid with 6 features (3x2 grid).
      Each feature: Icon, title, description
      Colors: ${JSON.stringify(designSystem.colors)}
      Style: Clean, minimal, premium
    `,
    deviceType: 'DESKTOP',
    modelId: 'GEMINI_3_FLASH',
  }),

  pricing: await mcp_stitch_generate_screen_from_text({
    projectId: project.id,
    prompt: `
      Pricing table with 3 tiers (Starter, Professional, Enterprise).
      Highlight middle tier.
      Include: Price, features list, CTA button
      Colors: ${JSON.stringify(designSystem.colors)}
    `,
    deviceType: 'DESKTOP',
    modelId: 'GEMINI_3_PRO',
  }),
};

console.log('Landing page sections generated:', Object.keys(sections));
```

### Workflow 2: Desktop App Screens

```typescript
// Generate desktop app flow
const desktopFlow = {
  splash: await generateScreen('Splash screen with logo and tagline'),
  login: await generateScreen('Login form with email, password, social login buttons'),
  home: await generateScreen('Main dashboard with agent cards, search bar, sidebar navigation'),
  details: await generateScreen('Agent details with workflow status, logs, action buttons'),
  settings: await generateScreen('Settings panel with preferences, API keys, theme toggle'),
};

async function generateScreen(description) {
  return await mcp_stitch_generate_screen_from_text({
    projectId: project.id,
    prompt: `${description}. Desktop app style, clean, modern.`,
    deviceType: 'DESKTOP',
    modelId: 'GEMINI_3_FLASH',
  });
}
```

### Workflow 3: Component Library

```typescript
// Generate design system components
const components = [
  'Primary button (default, hover, active, disabled states)',
  'Secondary button (outline style)',
  'Input field (default, focus, error states)',
  'Card component with icon, title, description',
  'Navigation sidebar with sections and active state',
  'Footer with links and social icons',
];

const componentScreens = await Promise.all(
  components.map((comp) =>
    mcp_stitch_generate_screen_from_text({
      projectId: project.id,
      prompt: `Component: ${comp}. Show all variants. Design system colors: #0a0a0a, [accent], #ffffff`,
      deviceType: 'AGNOSTIC',
      modelId: 'GEMINI_3_PRO',
    }),
  ),
);
```

---

## Troubleshooting

### Common Issues

#### Issue: Generated design doesn't match brand

**Solution:**

- Include specific hex colors in prompt (not just "blue")
- Reference design system explicitly
- Use brand keywords consistently
- Provide example references

```typescript
// Vague
prompt: 'Create a button with brand colors';

// Specific
prompt: `
  Create a button.
  Background: [accent hex]
  Text: #0a0a0a (black)
  Border radius: 8px
  Padding: 12px 24px
  Font: Inter, 16px, 600 weight
`;
```

#### Issue: Layout not as expected

**Solution:**

- Be explicit about component arrangement
- Specify dimensions and spacing
- Use layout keywords (grid, flex, split, stacked)

```typescript
// Vague
prompt: 'Create a features section';

// Specific
prompt: `
  Create a features section.
  Layout: 3-column grid
  Gap between items: 32px
  Each feature: Icon (top), title, description (below)
  Vertical alignment: center
  Max width: 1200px
`;
```

#### Issue: Too many iterations needed

**Solution:**

- Start with detailed prompt (not vague)
- Use GEMINI_3_PRO for complex designs
- Reference existing screens for consistency
- Create prompt templates for repeated patterns

### Quality Improvement Tips

1. **Be specific about spacing**: "24px gap" not "some space"
2. **Provide exact colors**: "#d4af37" not "gold-ish"
3. **Specify typography**: "Inter, 16px, line-height 1.6" not "readable font"
4. **Define hierarchy**: "Large headline (48px), medium subheadline (24px)"
5. **Reference patterns**: "Similar to Stripe's pricing table"
6. **Include context**: "For AI development teams" helps Stitch understand audience

### When Stitch Isn't Working

If Stitch is unavailable or not producing good results:

1. **Check MCP connection**: Verify Stitch MCP server is running
2. **Fall back to traditional tools**: Use Figma, Framer, or code directly
3. **Use hybrid approach**: Stitch for exploration, Figma for refinement
4. **Document learnings**: Note what prompts worked/didn't for future reference

---

## Integration with Existing Workflow

### Complete UI/UX Design Workflow with Stitch

```
1. Niche Discovery (NICHE-DISCOVERY.md)
   |
2. Design System Creation (DESIGN-SYSTEM-BUILDER.md)
   |
3. Screen Generation (STITCH-INTEGRATION.md) <-- YOU ARE HERE
   |
4. Asset Generation (ASSET-GENERATION.md)
   |
5. Implementation (Developer handoff)
```

### When to Use Each Tool

| Stage           | Tool             | Purpose                   |
| --------------- | ---------------- | ------------------------- |
| **Exploration** | Stitch           | Rapid concept generation  |
| **Refinement**  | Figma            | Pixel-perfect adjustments |
| **Assets**      | Midjourney/Canva | Custom graphics           |
| **Prototyping** | Framer           | Interactive demos         |
| **Production**  | Code             | Final implementation      |

---

## Summary

Stitch MCP integration enables **AI-powered UI screen generation** within the ui-ux-designer skill workflow:

- **Rapid prototyping** - Generate screens in seconds
- **Design system integration** - Apply brand tokens in prompts
- **Multi-device support** - Mobile, desktop, tablet layouts
- **Iteration workflow** - Refine with follow-up prompts
- **Project organization** - Group related screens
- **Optional enhancement** - Gracefully degrades if unavailable

**Next Steps:**

1. Check Stitch availability in your environment
2. Create a test project
3. Generate your first screen
4. Iterate and refine
5. Document for developer handoff
