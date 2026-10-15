<script setup lang="ts">
import { IconX, IconSwords, IconEye, IconCoins, IconFlame, IconPlant } from '@tabler/icons-vue'
import type { ReviewMatch } from '#shared/types/review'
import {
  championPortrait,
  formatDate,
  formatDuration,
  formatKda,
  formatNumber,
  roleLabel,
} from '../utils/format'

const props = defineProps<{ match: ReviewMatch; version: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const titleId = useId()
onMounted(() => {
  dialog.value?.showModal()
})
const kda = computed(() =>
  props.match.deaths
    ? formatKda((props.match.kills + props.match.assists) / props.match.deaths)
    : 'Aucune mort',
)
function backdrop(event: MouseEvent) {
  if (event.target === dialog.value) dialog.value.close()
}
</script>

<template>
  <dialog
    ref="dialog"
    class="match-dialog"
    :aria-labelledby="titleId"
    @close="emit('close')"
    @click="backdrop"
  >
    <div class="dialog-body">
      <button
        type="button"
        class="icon-button dialog-close"
        aria-label="Fermer les détails"
        autofocus
        @click="dialog?.close()"
      >
        <IconX :size="24" aria-hidden="true" />
      </button>
      <p class="eyebrow">La partie en détail</p>
      <div class="detail-identity">
        <ChampionImage
          :src="championPortrait(match.championKey, version)"
          :alt="match.championName"
          eager
        />
        <div>
          <h2 :id="titleId">{{ match.championName }}</h2>
          <span class="result" :class="match.win ? 'win' : 'loss'">{{
            match.win ? 'Victoire' : 'Défaite'
          }}</span>
        </div>
      </div>
      <p class="detail-context">
        {{ match.mode }} · {{ roleLabel(match.role) }}<br />{{ formatDate(match.startedAt) }} ·
        {{ formatDuration(match.duration) }} · EUW
      </p>
      <div class="detail-score">
        <strong
          >{{ match.kills }} <span>/</span> {{ match.deaths }} <span>/</span>
          {{ match.assists }}</strong
        ><span>Éliminations / morts / assistances</span>
        <p>KDA : {{ kda }}</p>
      </div>
      <dl class="detail-stats">
        <div>
          <dt><IconFlame :size="20" aria-hidden="true" /> Dégâts aux champions</dt>
          <dd>{{ formatNumber(match.damage) }}</dd>
        </div>
        <div>
          <dt><IconCoins :size="20" aria-hidden="true" /> Or gagné</dt>
          <dd>{{ formatNumber(match.gold) }}</dd>
        </div>
        <div>
          <dt><IconEye :size="20" aria-hidden="true" /> Score de vision</dt>
          <dd>{{ formatNumber(match.vision) }}</dd>
        </div>
        <div>
          <dt><IconPlant :size="20" aria-hidden="true" /> Sbires et monstres</dt>
          <dd>
            {{ formatNumber(match.cs) }}
            <small
              >({{
                formatKda(match.duration > 0 ? match.cs / (match.duration / 60) : null)
              }}/min)</small
            >
          </dd>
        </div>
      </dl>
      <div v-if="match.items.some(Boolean)" class="detail-items">
        <h3>Équipement en fin de partie</h3>
        <div>
          <template v-for="(item, index) in match.items" :key="index"
            ><ChampionImage
              v-if="item"
              :src="`https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${item}.png`"
              :alt="`Objet ${item}, emplacement ${index + 1}`"
          /></template>
        </div>
      </div>
      <p v-if="!match.win" class="coaching-note">
        <IconSwords :size="20" aria-hidden="true" /><span
          >Une défaite ouvre la discussion. Interprétez ces chiffres selon le rôle, le mode et le
          contexte de la partie.</span
        >
      </p>
      <p class="match-reference">Référence : {{ match.id }}</p>
    </div>
  </dialog>
</template>
