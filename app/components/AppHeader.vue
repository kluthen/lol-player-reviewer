<script setup lang="ts">
import { IconMenu2, IconX } from '@tabler/icons-vue'
import { historyPath, profilePath } from '~/utils/routes'

const route = useRoute()
const player = usePlayerRoute()
const open = ref(false)
const profileLink = computed(() => (player.value ? profilePath(player.value) : '/'))
const historyLink = computed(() => (player.value ? historyPath(player.value) : null))
const onHistory = computed(() =>
  String(route.name ?? '').startsWith('players-platform-player-history'),
)
const onProfile = computed(() => !onHistory.value)
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
      <NuxtLink class="brand" to="/" aria-label="Rift Review, accueil">
        <img src="/images/brand-mark.png" alt="" width="35" height="49" />
        <span
          ><span class="brand-name">Rift <span>Review</span></span
          ><span class="brand-tagline">Progressez, plus loin.</span></span
        >
      </NuxtLink>
      <nav class="desktop-nav" aria-label="Navigation principale">
        <NuxtLink
          :to="profileLink"
          :aria-current="onProfile ? 'page' : undefined"
          :class="{ active: onProfile }"
          >Joueurs</NuxtLink
        >
        <NuxtLink
          v-if="historyLink"
          :to="historyLink"
          :aria-current="onHistory ? 'page' : undefined"
          :class="{ active: onHistory }"
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
      <NuxtLink :to="profileLink" :aria-current="onProfile ? 'page' : undefined">{{
        player ? 'Profil joueur' : 'Accueil'
      }}</NuxtLink>
      <NuxtLink v-if="historyLink" :to="historyLink" :aria-current="onHistory ? 'page' : undefined"
        >Historique des parties</NuxtLink
      >
    </nav>
    <div class="mobile-search"><PlayerSearch /></div>
  </header>
</template>
