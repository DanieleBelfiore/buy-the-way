import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        cream: 'var(--cream)',
        'cream-soft': 'var(--cream-soft)',
        offwhite: 'var(--offwhite)',
        charcoal: 'var(--charcoal)',
        'muted-gray': 'var(--muted-gray)',
        'ring-blue': 'var(--ring-blue)',
        'ink-03': 'var(--ink-03)',
        'ink-04': 'var(--ink-04)',
        'ink-08': 'var(--ink-08)',
        'ink-12': 'var(--ink-12)',
        'ink-40': 'var(--ink-40)',
        'ink-82': 'var(--ink-82)',
        'ink-83': 'var(--ink-83)',
        'ink-100': 'var(--ink-100)',
        'cat-fruit': 'var(--cat-fruit)',
        'cat-dairy': 'var(--cat-dairy)',
        'cat-meat': 'var(--cat-meat)',
        'cat-bakery': 'var(--cat-bakery)',
        'cat-bev': 'var(--cat-bev)',
        'cat-frozen': 'var(--cat-frozen)',
        'cat-clean': 'var(--cat-clean)',
        'cat-hyg': 'var(--cat-hyg)',
        'cat-other': 'var(--cat-other)',
      },
      fontFamily: {
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        base: 'var(--text-base)',
        md: 'var(--text-md)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)',
        hero: 'var(--text-hero)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      spacing: {
        '0.5': 'var(--space-1)',
        '1': 'var(--space-2)',
        '2': 'var(--space-3)',
        '3': 'var(--space-4)',
        '4': 'var(--space-5)',
        '6': 'var(--space-6)',
        '8': 'var(--space-8)',
        '12': 'var(--space-12)',
        '16': 'var(--space-16)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        'elev-1': 'var(--shadow-elev-1)',
        focus: 'var(--shadow-focus)',
      },
    },
  },
  plugins: [],
};

export default config;
