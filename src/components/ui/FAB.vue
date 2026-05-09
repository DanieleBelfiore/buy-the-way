<script setup lang="ts">
interface Props {
  ariaLabel: string;
}

const props = defineProps<Props>();
</script>

<template>
  <button type="button" class="fab" :aria-label="props.ariaLabel">
    <slot />
  </button>
</template>
