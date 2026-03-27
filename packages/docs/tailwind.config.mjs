/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'nitro-orange': '#f97316',
        'nitro-dark': '#0a0e17',
      },
    },
  },
  plugins: [],
};
