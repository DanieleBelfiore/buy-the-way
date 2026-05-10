<script setup lang="ts">
import { computed } from 'vue';

type Tone = 'cream' | 'dark';

interface Props {
  name: string;
  tone?: Tone;
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'cream',
});

const initials = computed((): string => {
  const trimmed = props.name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/u);
  const firstStr = parts[0] || '';
  if (parts.length === 1) {
    return firstStr.charAt(0).toUpperCase();
  }
  const lastStr = parts[parts.length - 1] || '';
  const first = firstStr.charAt(0);
  const last = lastStr.charAt(0);
  return `${first}${last}`.toUpperCase();
});

const toneClass = computed((): string =>
  props.tone === 'dark' ? 'chip--dark' : 'chip--cream',
);
</script>

<template>
  <span
    class="chip avatar"
    :class="toneClass"
    data-testid="avatar"
    :aria-label="props.name"
    :title="props.name"
  >
    <span class="avatar__initials">{{ initials }}</span>
  </span>
</template>

<style scoped>
.avatar {
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--text-xs);
  letter-spacing: 0.02em;
}

.avatar__initials {
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
</style>
