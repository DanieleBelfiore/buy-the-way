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
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-active': 'var(--primary-active)',
      },
      spacing: {
        '50': '12.5rem',
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
