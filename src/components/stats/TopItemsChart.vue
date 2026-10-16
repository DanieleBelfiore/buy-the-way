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
import type { Scale, TooltipItem } from 'chart.js';
import { useI18n } from 'vue-i18n';
import { CATEGORIES } from '@/domain/categories';
import { useThemeStore } from '@/stores/theme';
import type { TopItem } from '@/domain/stats';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Chart.js draws on a canvas, so it cannot inherit CSS fonts: without this it
// falls back to Helvetica. Read the app font from <body> so it stays in sync.
if (typeof document !== 'undefined') {
  ChartJS.defaults.font.family = getComputedStyle(document.body).fontFamily;
}

const props = defineProps<{ items: readonly TopItem[] }>();

// Emoji + name; about what fits beside the bars on a 320 px phone.
const LABEL_MAX_CHARS = 18;

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

// The canvas is role="img": screen readers get the same data as text.
const ariaLabel = computed(
  () =>
    `${t('stats.topItems.title')}. ${props.items.map((i) => `${i.name}: ${i.usageCount}`).join(', ')}`,
);

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
        label: (ctx: TooltipItem<'bar'>) => `${ctx.label}: ${ctx.parsed.x ?? 0}`,
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
      ticks: {
        autoSkip: false,
        color: inkColor.value,
        // Chart.js clips an over-long label at the start ("zarella di
        // bufala"). Cut it at the end instead; the tooltip keeps the full name.
        callback(this: Scale, value: string | number): string {
          const label = this.getLabelForValue(Number(value));
          return label.length > LABEL_MAX_CHARS ? `${label.slice(0, LABEL_MAX_CHARS - 1).trimEnd()}…` : label;
        },
      },
    },
  },
}));
</script>

<template>
  <div data-testid="top-items-chart" class="w-full" :style="{ height: `${Math.max(items.length * 32 + 32, 220)}px` }">
    <!-- :key forces a fresh chart instance on theme flip so axes + ticks
         pick up the new ink color without needing a manual chart.update(). -->
    <Bar :key="`bars-${themeStore.resolved}`" :data="chartData" :options="chartOptions" :aria-label="ariaLabel" />
  </div>
</template>
