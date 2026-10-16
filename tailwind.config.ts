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
        'primary-ink': 'var(--primary-ink)',
        'primary-hover': 'var(--primary-hover)',
        'primary-active': 'var(--primary-active)',
        'favorite-gold': 'var(--favorite-gold)',
        'favorite-gold-soft': 'var(--favorite-gold-soft)',
        danger: 'var(--danger)',
        'danger-hover': 'var(--danger-hover)',
        'danger-active': 'var(--danger-active)',
        'danger-ink': 'var(--danger-ink)',
        'danger-soft': 'var(--danger-soft)',
        urgent: 'var(--urgent)',
        'urgent-soft': 'var(--urgent-soft)',
      },
      spacing: {
        '50': '12.5rem',
      },
      fontFamily: {
        sans: ['Hanken Grotesk Variable', 'system-ui', 'sans-serif'],
        display: 'var(--font-display)',
      },
      boxShadow: {
        lift: 'var(--shadow-lift)',
      },
      // Named stacking layers, lowest first. Values match the numbers the
      // components used before, so the stacking order is unchanged. The
      // local `z-10` inside each overlay (panel above its own backdrop)
      // stays numeric.
      zIndex: {
        dropdown: '50',
        boot: '50',
        sheet: '100',
        lightbox: '110',
        modal: '120',
        tooltip: '130',
        banner: '150',
        toast: '200',
        tour: '200',
        update: '250',
      },
      ringColor: {
        DEFAULT: 'var(--ring-blue)',
      },
    },
  },
  plugins: [],
} satisfies Config;
