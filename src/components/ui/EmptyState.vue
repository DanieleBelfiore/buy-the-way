<template>
  <div class="empty-state">
    <div
      v-if="$slots.icon"
      class="empty-state__icon"
    >
      <slot name="icon" />
    </div>
    <p class="empty-state__title">
      <slot name="title" />
    </p>
    <p
      v-if="$slots.body"
      class="empty-state__body"
    >
      <slot name="body" />
    </p>
    <div
      v-if="$slots.cta"
      class="empty-state__cta"
    >
      <slot name="cta" />
    </div>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-10) var(--space-6);
  text-align: center;
}

.empty-state__icon {
  color: var(--ink-40);
}

.empty-state__title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--charcoal);
  margin: 0;
}

.empty-state__body {
  font-size: var(--text-base);
  color: var(--ink-82);
  margin: 0;
  max-width: 28ch;
}

.empty-state__cta {
  margin-top: var(--space-2);
}
</style>
