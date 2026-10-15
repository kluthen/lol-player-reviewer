<script setup lang="ts">
const { riotId, load, reset } = usePlayerReview()
watch(riotId, (value) => {
  if (import.meta.client) {
    if (value) void load(value)
    else reset()
  }
})
onMounted(() => {
  if (riotId.value) void load(riotId.value)
})
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#main">Aller au contenu</a>
    <NuxtRouteAnnouncer />
    <AppHeader />
    <main id="main" tabindex="-1"><NuxtPage /></main>
    <AppFooter />
  </div>
</template>
