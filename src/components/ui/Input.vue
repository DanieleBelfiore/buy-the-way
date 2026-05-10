<script setup lang="ts">
defineOptions({ inheritAttrs: false });

interface Props {
  modelValue: string;
  placeholder?: string;
  type?: string;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  type: 'text',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const onInput = (event: Event): void => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
};
</script>

<template>
  <label class="input input--wrap">
    <span
      v-if="$slots.iconLeft"
      class="input__icon"
      aria-hidden="true"
    >
      <slot name="iconLeft" />
    </span>
    <input
      v-bind="$attrs"
      class="input__field"
      :type="props.type"
      :value="props.modelValue"
      :placeholder="props.placeholder"
      @input="onInput"
    >
  </label>
</template>

<style scoped>
.input--wrap {
  width: 100%;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.input__icon {
  display: inline-flex;
  align-items: center;
  color: var(--ink-40);
  flex-shrink: 0;
}

.input__field {
  flex: 1 1 auto;
  border: 0;
  background: transparent;
  outline: none;
  color: inherit;
  font: inherit;
  padding: 0;
  min-width: 0;
}

.input__field::placeholder {
  color: var(--ink-40);
}
</style>
