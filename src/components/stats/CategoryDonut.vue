<script setup lang="ts">
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { useI18n } from 'vue-i18n';
import { CATEGORIES } from '@/domain/categories';
import { useThemeStore } from '@/stores/theme';
import type { CategoryBreakdownSlice } from '@/domain/stats';

ChartJS.register(ArcElement, Tooltip, Legend);

const props = defineProps<{ slices: readonly CategoryBreakdownSlice[] }>();

const { t } = useI18n();
const themeStore = useThemeStore();

// Tap themeStore.resolved inside computed so chart re-renders on theme flip.
const readCssVar = (cssVarExpr: string, fallback = '#5f5f5d'): string => {
  // touch the ref so this becomes a reactive dep of our computeds
  void themeStore.resolved;
  const match = cssVarExpr.match(/var\((--[^)]+)\)/);
  if (!match) return fallback;
  const name = match[1]!;
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

// Legend / tooltip text color follows the resolved theme so labels stay legible.
const inkColor = computed(() => readCssVar('var(--charcoal)', '#1c1c1c'));

const chartData = computed(() => ({
  labels: props.slices.map(
    (s) => `${CATEGORIES[s.category].icon} ${t(CATEGORIES[s.category].labelKey)}`,
  ),
  datasets: [
    {
      data: props.slices.map((s) => s.count),
      backgroundColor: props.slices.map((s) => readCssVar(CATEGORIES[s.category].cssVar)),
      borderColor: 'transparent',
      borderWidth: 0,
      hoverOffset: 6,
    },
  ],
}));

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '60%',
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        boxWidth: 12,
        padding: 12,
        color: inkColor.value,
        generateLabels: (chart: {
          data: { labels?: string[]; datasets: { data: number[]; backgroundColor: string[] }[] };
        }) => {
          const labels = chart.data.labels ?? [];
          const ds = chart.data.datasets[0];
          if (!ds) return [];
          const total = ds.data.reduce((a, b) => a + b, 0);
          return labels.map((label, i) => {
            const value = ds.data[i] ?? 0;
            const pct = total === 0 ? 0 : Math.round((value / total) * 100);
            return {
              text: `${label} — ${pct}%`,
              // Per-item fontColor overrides labels.color in Chart.js v4 — set
              // it so the legend text follows the theme even when we hand-roll
              // entries via generateLabels.
              fontColor: inkColor.value,
              fillStyle: ds.backgroundColor[i] ?? '#5f5f5d',
              strokeStyle: ds.backgroundColor[i] ?? '#5f5f5d',
              lineWidth: 0,
              index: i,
            };
          });
        },
      },
    },
    tooltip: {
      displayColors: false,
      callbacks: {
        title: () => '',
        label: (ctx: { label: string; parsed: number; dataset: { data: number[] } }) => {
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const pct = total === 0 ? 0 : Math.round((ctx.parsed / total) * 100);
          const items = t('stats.categories.tooltipItems', ctx.parsed, { named: { n: ctx.parsed } });
          return `${ctx.label}: ${pct}% (${items})`;
        },
      },
    },
  },
}));
</script>

<template>
  <div data-testid="category-donut" class="w-full" style="height: 280px">
    <!-- :key forces Chart.js to rebuild the canvas when the theme flips so
         legend text + tooltips pick up the new ink color on first paint. -->
    <Doughnut :key="`donut-${themeStore.resolved}`" :data="chartData" :options="chartOptions" />
  </div>
</template>
