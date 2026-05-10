<script setup lang="ts">
import { computed } from 'vue';
import Avatar from './Avatar.vue';

interface Props {
  names: readonly string[];
}

const props = defineProps<Props>();

const MAX_VISIBLE = 3;

const visible = computed((): readonly string[] =>
  props.names.slice(0, MAX_VISIBLE),
);

const overflow = computed((): number =>
  Math.max(0, props.names.length - MAX_VISIBLE),
);
</script>

<template>
  <span
    class="avatar-stack"
    :aria-label="`${props.names.length} members`"
  >
    <Avatar
      v-for="(name, idx) in visible"
      :key="`${name}-${idx}`"
      :name="name"
      tone="cream"
      class="avatar-stack__item"
    />
    <span
      v-if="overflow > 0"
      class="chip chip--dark avatar-stack__more"
    >
      +{{ overflow }}
    </span>
  </span>
</template>

<style scoped>
.avatar-stack {
  display: inline-flex;
  align-items: center;
}

.avatar-stack__item:not(:first-child),
.avatar-stack__more {
  margin-left: -8px;
}

.avatar-stack__item {
  border: 2px solid var(--cream);
}

.avatar-stack__more {
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: var(--text-xs);
  border: 2px solid var(--cream);
  z-index: 1;
}
</style>
