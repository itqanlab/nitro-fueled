import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://itqanlab.github.io',
  base: process.env.GITHUB_ACTIONS === 'true' ? '/nitro-fueled' : '/',
  integrations: [
    starlight({
      title: 'Nitro-Fueled',
      description: 'Reusable AI development orchestration. Install into any project to get a full PM → Architect → Dev → QA pipeline with autonomous worker sessions.',
      defaultLocale: 'root',
      locales: {
        root: { label: 'English', lang: 'en' },
      },
      social: {
        github: 'https://github.com/itqanlab/nitro-fueled',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Overview', slug: 'getting-started' },
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'First Run', slug: 'getting-started/first-run' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { label: 'Overview', slug: 'concepts' },
            { label: 'Tasks', slug: 'concepts/tasks' },
            { label: 'Workers', slug: 'concepts/workers' },
            { label: 'Supervisor', slug: 'concepts/supervisor' },
          ],
        },
        {
          label: 'Task Format',
          items: [
            { label: 'Overview', slug: 'task-format' },
          ],
        },
        {
          label: 'Commands',
          items: [
            { label: 'All Commands', slug: 'commands' },
          ],
        },
        {
          label: 'Agents',
          items: [
            { label: 'Agent Reference', slug: 'agents' },
          ],
        },
        {
          label: 'Auto-Pilot',
          items: [
            { label: 'Auto-Pilot Guide', slug: 'auto-pilot' },
          ],
        },
        {
          label: 'Examples',
          items: [
            { label: 'New Project', slug: 'examples/new-project' },
            { label: 'Existing Project', slug: 'examples/existing-project' },
          ],
        },
      ],
    }),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
