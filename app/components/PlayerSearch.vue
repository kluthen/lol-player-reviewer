<script setup lang="ts">
import { IconSearch, IconX } from '@tabler/icons-vue'

withDefaults(defineProps<{ label?: string }>(), { label: 'Rechercher un joueur sur EUW' })

const { riotId, pending, search } = usePlayerReview()
const value = ref(riotId.value)
const input = ref<HTMLInputElement>()
const ready = ref(false)
onMounted(() => {
  ready.value = true
})
watch(riotId, (id) => {
  value.value = id
})
const inputId = useId()
function clear() {
  value.value = ''
  input.value?.focus()
}
</script>

<template>
  <form class="player-search" role="search" :aria-label="label" @submit.prevent="search(value)">
    <label class="sr-only" :for="inputId">Riot ID, au format Pseudo#TAG</label>
    <button
      class="search-submit icon-button"
      type="submit"
      :disabled="pending || !ready"
      aria-label="Rechercher sur EUW"
    >
      <IconSearch :size="22" aria-hidden="true" />
    </button>
    <input
      :id="inputId"
      ref="input"
      v-model="value"
      name="riotId"
      placeholder="Rechercher un joueur#TAG"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      maxlength="40"
      :disabled="pending || !ready"
      required
    />
    <span class="search-region">EUW</span>
    <button
      v-if="value"
      class="icon-button search-clear"
      type="button"
      aria-label="Effacer la recherche"
      @click="clear"
    >
      <IconX :size="18" aria-hidden="true" />
    </button>
  </form>
</template>
