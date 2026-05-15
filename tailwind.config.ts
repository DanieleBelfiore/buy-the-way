import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: 'var(--cream)',
        'cream-soft': 'var(--cream-soft)',
        offwhite: 'var(--offwhite)',
        charcoal: 'var(--charcoal)',
        'muted-gray': 'var(--muted-gray)',
      },
      fontFamily: {
        sans: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
      },
      ringColor: {
        DEFAULT: 'var(--ring-blue)',
      },
    },
  },
  plugins: [],
} satisfies Config;
