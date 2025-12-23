<template>
  <div class="card">
    <h2>Vue + Campsite</h2>
    <p>{{ message }}</p>
    <button @click="count++">You clicked {{ count }} times</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const count = ref(0);
const message = 'This Vue component is ready to hydrate in your Campsite build.';
</script>

<style scoped>
.card {
  border: 1px solid var(--fg-ink-soft);
  border-radius: 12px;
  padding: 1rem;
  background: #0e1117;
  color: #f6f4ef;
}
button {
  margin-top: 0.75rem;
  background: linear-gradient(120deg, #f97316, #ea580c);
  color: #0b0c10;
  border: none;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  cursor: pointer;
}
button:hover {
  filter: brightness(1.05);
}
</style>
