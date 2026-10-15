<script setup lang="ts">
import { IconAlertCircle, IconLoader2, IconRefresh, IconClock } from '@tabler/icons-vue'
import type { ApiError } from '~/composables/useRiotResource'

const props = defineProps<{ pending: boolean; error: ApiError | null; subject?: string }>()
const emit = defineEmits<{ retry: [] }>()
const retryAt = useRetryAt()
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
const title = computed(() => {
  if (props.error?.code === 'MATCH_NOT_FOUND') return 'Cette partie reste introuvable.'
  if (props.error?.code === 'RIOT_NOT_FOUND') return 'Ce joueur reste introuvable.'
  if (props.error?.code.startsWith('INVALID_')) return 'Cette adresse est incomplète.'
  return 'Un instant, invocateur.'
})
</script>

<template>
  <section
    v-if="pending || !error"
    class="search-state loading-state"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <IconLoader2 class="spinner state-icon" :size="38" aria-hidden="true" />
    <p class="eyebrow">Lecture du jeu</p>
    <h1>Chaque partie raconte une histoire.</h1>
    <p>
      Nous récupérons les parties<template v-if="subject">
        de <strong>{{ subject }}</strong></template
      >.<br />Le premier chargement peut prendre quelques instants.
    </p>
    <div class="loading-bars" aria-hidden="true"><span /><span /><span /></div>
  </section>
  <section v-else class="search-state error-state" role="alert">
    <IconClock v-if="remaining" class="state-icon" :size="38" aria-hidden="true" /><IconAlertCircle
      v-else
      class="state-icon"
      :size="38"
      aria-hidden="true"
    />
    <p class="eyebrow">Recherche interrompue</p>
    <h1>{{ title }}</h1>
    <p>{{ error.message }}</p>
    <p v-if="remaining" role="timer">Nouvelle recherche possible dans {{ remaining }} s.</p>
    <button
      v-if="!error.code.startsWith('INVALID_')"
      type="button"
      class="button"
      :disabled="remaining > 0"
      @click="emit('retry')"
    >
      <IconRefresh :size="18" aria-hidden="true" />Réessayer
    </button>
  </section>
</template>
