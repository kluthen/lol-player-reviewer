<script setup lang="ts">
import {
  IconAlertCircle,
  IconArrowRight,
  IconLoader2,
  IconSearch,
  IconRefresh,
  IconClock,
} from '@tabler/icons-vue'

const { pending, error, riotId, retryAt, load } = usePlayerReview()
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
const remaining = computed(() => Math.max(0, Math.ceil((retryAt.value - now.value) / 1000)))
</script>

<template>
  <section
    v-if="pending"
    class="search-state loading-state"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <IconLoader2 class="spinner state-icon" :size="38" aria-hidden="true" />
    <p class="eyebrow">Lecture du jeu</p>
    <h1>Chaque partie raconte une histoire.</h1>
    <p>
      Nous récupérons les dernières parties de <strong>{{ riotId }}</strong
      >.<br />Le premier chargement peut prendre quelques instants.
    </p>
    <div class="loading-bars" aria-hidden="true"><span /><span /><span /></div>
  </section>
  <section v-else-if="error" class="search-state error-state" role="alert">
    <IconClock v-if="remaining" class="state-icon" :size="38" aria-hidden="true" /><IconAlertCircle
      v-else
      class="state-icon"
      :size="38"
      aria-hidden="true"
    />
    <p class="eyebrow">Recherche interrompue</p>
    <h1>
      {{
        error.code === 'RIOT_NOT_FOUND' ? 'Ce joueur reste introuvable.' : 'Un instant, invocateur.'
      }}
    </h1>
    <p>{{ error.message }}</p>
    <p v-if="remaining" role="timer">Nouvelle recherche possible dans {{ remaining }} s.</p>
    <button
      v-if="riotId"
      type="button"
      class="button"
      :disabled="remaining > 0"
      @click="load(riotId)"
    >
      <IconRefresh :size="18" aria-hidden="true" />Réessayer
    </button>
  </section>
  <section v-else class="search-state welcome-state">
    <div class="welcome-art" aria-hidden="true" />
    <div class="welcome-copy">
      <p class="eyebrow">Au-delà des stats</p>
      <h1>Comprendre le jeu.<br /><span>Faire progresser le joueur.</span></h1>
      <p>
        Un profil, ses dernières parties, les bonnes questions.<br class="desktop-only" />
        Préparez votre prochain entraînement.
      </p>
      <div class="welcome-search">
        <PlayerSearch label="Trouver un joueur pour préparer un entraînement" />
      </div>
      <p class="search-hint">
        <IconSearch :size="15" aria-hidden="true" /> Un Riot ID complet, par exemple NamiMain#MDS
        <IconArrowRight :size="15" aria-hidden="true" />
      </p>
      <div class="welcome-facts">
        <span>Europe de l’Ouest</span><span>20 dernières parties</span
        ><span>Données Riot Games</span>
      </div>
    </div>
  </section>
</template>
