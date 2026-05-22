<script setup lang="ts">
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { useI18n } from 'vue-i18n';
import { CATEGORIES } from '@/domain/categories';
import { useThemeStore } from '@/stores/theme';
import type { TopItem } from '@/domain/stats';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const props = defineProps<{ items: readonly TopItem[] }>();

const { t } = useI18n();
const themeStore = useThemeStore();

// Reading themeStore.resolved inside the helper makes every consuming computed
// re-evaluate when the theme flips, so chart text + grid recolor live.
const readCssVar = (cssVarExpr: string, fallback = '#5f5f5d'): string => {
  void themeStore.resolved;
  const match = cssVarExpr.match(/var\((--[^)]+)\)/);
  if (!match) return fallback;
  const name = match[1]!;
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const inkColor = computed(() => readCssVar('var(--charcoal)', '#1c1c1c'));
const gridColor = computed(() =>
  themeStore.resolved === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
);

const chartData = computed(() => ({
  labels: props.items.map((i) => `${CATEGORIES[i.category].icon} ${i.name}`),
  datasets: [
    {
      label: t('stats.topItems.usageLabel'),
      data: props.items.map((i) => i.usageCount),
      backgroundColor: props.items.map((i) => readCssVar(CATEGORIES[i.category].cssVar)),
      borderRadius: 6,
      borderSkipped: false as const,
    },
  ],
}));

const chartOptions = computed(() => ({
  indexAxis: 'y' as const,
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      displayColors: false,
      callbacks: {
        title: () => '',
        label: (ctx: { parsed: { x: number }; label: string }) =>
          `${ctx.label}: ${ctx.parsed.x}`,
      },
    },
  },
  scales: {
    x: {
      beginAtZero: true,
      ticks: { precision: 0, color: inkColor.value },
      grid: { color: gridColor.value },
    },
    y: {
      grid: { display: false },
      ticks: { autoSkip: false, color: inkColor.value },
    },
  },
}));
</script>

<template>
  <div data-testid="top-items-chart" class="w-full" :style="{ height: `${Math.max(items.length * 32 + 32, 220)}px` }">
    <!-- :key forces a fresh chart instance on theme flip so axes + ticks
         pick up the new ink color without needing a manual chart.update(). -->
    <Bar :key="`bars-${themeStore.resolved}`" :data="chartData" :options="chartOptions" />
  </div>
</template>
