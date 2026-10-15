<script setup lang="ts">
import { IconMenu2, IconX } from '@tabler/icons-vue'

const route = useRoute()
const open = ref(false)
const query = computed(() => (route.query.joueur ? { joueur: route.query.joueur } : {}))
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <NuxtLink class="brand" :to="{ path: '/', query }" aria-label="Rift Review, profil joueur">
        <img src="/images/brand-mark.png" alt="" width="35" height="49" />
        <span
          ><span class="brand-name">Rift <span>Review</span></span
          ><span class="brand-tagline">Progressez, plus loin.</span></span
        >
      </NuxtLink>
      <nav class="desktop-nav" aria-label="Navigation principale">
        <NuxtLink
          :to="{ path: '/', query }"
          :aria-current="route.path === '/' ? 'page' : undefined"
          :class="{ active: route.path === '/' }"
          >Joueurs</NuxtLink
        >
        <NuxtLink
          :to="{ path: '/historique', query }"
          :aria-current="route.path === '/historique' ? 'page' : undefined"
          :class="{ active: route.path === '/historique' }"
          >Historique</NuxtLink
        >
      </nav>
      <div class="header-search"><PlayerSearch /></div>
      <button
        class="mobile-menu-button icon-button"
        type="button"
        :aria-expanded="open"
        aria-controls="mobile-nav"
        :aria-label="open ? 'Fermer le menu' : 'Ouvrir le menu'"
        @click="open = !open"
      >
        <IconX v-if="open" :size="28" /><IconMenu2 v-else :size="28" />
      </button>
    </div>
    <nav v-if="open" id="mobile-nav" class="mobile-nav" aria-label="Navigation mobile">
      <NuxtLink :to="{ path: '/', query }" :aria-current="route.path === '/' ? 'page' : undefined"
        >Profil joueur</NuxtLink
      >
      <NuxtLink
        :to="{ path: '/historique', query }"
        :aria-current="route.path === '/historique' ? 'page' : undefined"
        >Historique des parties</NuxtLink
      >
    </nav>
    <div class="mobile-search"><PlayerSearch /></div>
  </header>
</template>
