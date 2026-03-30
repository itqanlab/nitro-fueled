/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'nitro-orange': '#f97316',
        'nitro-dark': '#0a0e17',
        'nitro-bg': '#0a0e17',
        'nitro-bg-card': '#111827',
        'nitro-bg-card-hover': '#1a2332',
        'nitro-border': '#1e293b',
        'nitro-border-accent': '#334155',
        'nitro-text': '#e2e8f0',
        'nitro-text-dim': '#94a3b8',
        'nitro-text-bright': '#f8fafc',
        'nitro-blue': '#3b82f6',
        'nitro-green': '#22c55e',
        'nitro-purple': '#a855f7',
        'nitro-cyan': '#06b6d4',
        'nitro-yellow': '#eab308',
      },
    },
  },
  plugins: [],
};
