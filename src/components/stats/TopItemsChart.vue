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
import type { TopItem } from '@/domain/stats';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const props = defineProps<{ items: readonly TopItem[] }>();

const { t } = useI18n();

const readCssVar = (cssVarExpr: string): string => {
  const match = cssVarExpr.match(/var\((--[^)]+)\)/);
  if (!match) return '#5f5f5d';
  const name = match[1]!;
  if (typeof window === 'undefined') return '#5f5f5d';
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || '#5f5f5d';
};

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
      ticks: { precision: 0 },
      grid: { color: 'rgba(0,0,0,0.06)' },
    },
    y: {
      grid: { display: false },
      ticks: { autoSkip: false },
    },
  },
}));
</script>

<template>
  <div data-testid="top-items-chart" class="w-full" :style="{ height: `${Math.max(items.length * 32 + 32, 220)}px` }">
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>
