<script setup lang="ts">
import { IconSearch, IconX } from '@tabler/icons-vue'
import { DEFAULT_PLATFORM, PLATFORMS, type Platform } from '#shared/domain/platform'
import { InvalidRiotId, parseRiotId } from '#shared/domain/riot-id'
import { profilePath } from '~/utils/routes'

withDefaults(defineProps<{ label?: string }>(), { label: 'Rechercher un joueur' })

const player = usePlayerRoute()
const value = ref(player.value?.riotId ?? '')
const platform = ref<Platform>(player.value?.platform ?? DEFAULT_PLATFORM)
const input = ref<HTMLInputElement>()
const ready = ref(false)
onMounted(() => {
  ready.value = true
})
watch(player, (current) => {
  value.value = current?.riotId ?? ''
  if (current) platform.value = current.platform
})
const inputId = useId()
const platformId = useId()
function clear() {
  value.value = ''
  input.value?.focus()
}
async function submit() {
  let riotId: { gameName: string; tagLine: string }
  try {
    riotId = parseRiotId(value.value)
  } catch (cause) {
    if (!(cause instanceof InvalidRiotId)) throw cause
    input.value?.setCustomValidity(cause.message)
    input.value?.reportValidity()
    return
  }
  await navigateTo(profilePath({ platform: platform.value, ...riotId }))
}
</script>

<template>
  <form class="player-search" role="search" :aria-label="label" @submit.prevent="submit">
    <label class="sr-only" :for="inputId">Riot ID, au format Pseudo#TAG</label>
    <button
      class="search-submit icon-button"
      type="submit"
      :disabled="!ready"
      aria-label="Rechercher"
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
      :disabled="!ready"
      required
      @input="input?.setCustomValidity('')"
    />
    <button
      v-if="value"
      class="icon-button search-clear"
      type="button"
      aria-label="Effacer la recherche"
      @click="clear"
    >
      <IconX :size="18" aria-hidden="true" />
    </button>
    <label class="sr-only" :for="platformId">Serveur</label>
    <select :id="platformId" v-model="platform" class="search-platform" :disabled="!ready">
      <option v-for="(info, id) in PLATFORMS" :key="id" :value="id" :title="info.name">
        {{ info.label }}
      </option>
    </select>
  </form>
</template>
