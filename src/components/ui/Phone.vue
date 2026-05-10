<script setup lang="ts">
// Dev-only preview frame. No props. Static phone shell using tokens.css.
</script>

<template>
  <div
    class="phone"
    role="presentation"
  >
    <div class="statusbar">
      <span>9:41</span>
      <span>BTW</span>
    </div>
    <div class="scroll">
      <slot />
    </div>
    <div class="home-ind" />
  </div>
</template>
