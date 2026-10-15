<script setup lang="ts">
import {
  IconChevronRight,
  IconChevronDown,
  IconNorthStar,
  IconSwords,
  IconBan,
  IconFilterOff,
} from '@tabler/icons-vue'
import type { ReviewFilters, ReviewMatch } from '#shared/types/review'
import { filterMatches, ROLE_LABELS } from '#shared/domain/review'
import { championPortrait, formatDate, formatDuration, roleLabel } from '../utils/format'

const { review, pending, error, riotId } = usePlayerReview()
const order = useState<'recent' | 'oldest'>('match-order', () => 'recent')
const filters = reactive({ queue: '', role: '', result: '' })
const visibleCount = ref(5)
const selected = ref<ReviewMatch | null>(null)
const filtered = computed(() =>
  filterMatches(review.value?.matches ?? [], {
    ...filters,
    order: order.value,
  } satisfies ReviewFilters),
)
const visible = computed(() => filtered.value.slice(0, visibleCount.value))
const modes = computed(() =>
  [...new Map(review.value?.matches.map((match) => [match.queueId, match.mode]) ?? [])].sort(
    (a, b) => a[0] - b[0],
  ),
)
function resetFilters() {
  filters.queue = ''
  filters.role = ''
  filters.result = ''
}
watch([() => filters.queue, () => filters.role, () => filters.result, order], () => {
  visibleCount.value = 5
})
watch(riotId, () => {
  resetFilters()
  selected.value = null
})
useHead({ title: 'Historique des parties — Rift Review' })
</script>

<template>
  <SearchState v-if="pending || error || !review" />
  <div v-else class="history-page">
    <section class="history-heading page-container">
      <div>
        <p class="eyebrow">Au-delà des stats</p>
        <h1>Historique des parties</h1>
        <p class="history-player">
          {{ review.player.gameName }}<span>#{{ review.player.tagLine }}</span>
        </p>
      </div>
      <p class="history-mantra">Analyser<br />Progresser<br />Plus loin<span /></p>
    </section>
    <div class="history-content page-container">
      <div class="filter-bar" role="group" aria-label="Filtrer les parties chargées">
        <label
          ><span class="sr-only">Mode de jeu</span
          ><select v-model="filters.queue">
            <option value="">Mode : Tous</option>
            <option v-for="[id, name] in modes" :key="id" :value="String(id)">{{ name }}</option>
          </select></label
        >
        <label
          ><span class="sr-only">Rôle</span
          ><select v-model="filters.role">
            <option value="">Rôle : Tous</option>
            <option v-for="(label, key) in ROLE_LABELS" :key="key" :value="key">{{ label }}</option>
            <option value="NONE">Non applicable</option>
          </select></label
        >
        <label
          ><span class="sr-only">Résultat</span
          ><select v-model="filters.result">
            <option value="">Résultat : Tous</option>
            <option value="win">Victoire</option>
            <option value="loss">Défaite</option>
          </select></label
        >
        <label class="history-order"
          ><span class="sr-only">Ordre des parties</span
          ><select v-model="order">
            <option value="recent">Récent</option>
            <option value="oldest">Ancien</option>
          </select></label
        >
      </div>
      <div class="history-scope">
        <p role="status" aria-live="polite">
          {{ filtered.length }} résultat{{ filtered.length > 1 ? 's' : '' }} parmi
          {{ review.matches.length }} parties chargées
        </p>
        <button
          v-if="filters.queue || filters.role || filters.result"
          type="button"
          class="text-button"
          @click="resetFilters"
        >
          <IconFilterOff :size="15" aria-hidden="true" />Effacer les filtres
        </button>
      </div>
      <div v-if="visible.length" class="match-list">
        <article
          v-for="match in visible"
          :key="match.id"
          class="match-row"
          :class="match.win ? 'is-win' : 'is-loss'"
        >
          <button
            type="button"
            :aria-label="`Détails : ${match.championName}, ${match.win ? 'victoire' : 'défaite'}, ${formatDate(match.startedAt)}`"
            @click="selected = match"
          >
            <span
              class="match-art"
              :style="{
                backgroundImage: `url('${championPortrait(match.championKey, review.assetVersion)}')`,
              }"
              aria-hidden="true"
            />
            <span class="result" :class="match.win ? 'win' : 'loss'">{{
              match.win ? 'Victoire' : 'Défaite'
            }}</span>
            <span class="match-champion">{{ match.championName }}</span>
            <span class="match-mode"
              ><IconSwords :size="24" aria-hidden="true" />{{ match.mode }}</span
            >
            <span class="match-role"
              ><IconNorthStar v-if="match.role" :size="25" aria-hidden="true" /><IconBan
                v-else
                :size="25"
                aria-hidden="true"
              />{{ roleLabel(match.role) }}</span
            >
            <span class="match-score"
              >{{ match.kills }} / {{ match.deaths }} / {{ match.assists }}</span
            >
            <span class="match-date"
              ><time :datetime="new Date(match.startedAt).toISOString()">{{
                formatDate(match.startedAt)
              }}</time
              ><small>{{ formatDuration(match.duration) }}</small></span
            >
            <IconChevronRight class="match-arrow" :size="24" aria-hidden="true" />
          </button>
        </article>
      </div>
      <section v-else class="empty-history">
        <IconFilterOff :size="32" aria-hidden="true" />
        <h2>
          {{ review.matches.length ? 'Aucune partie ne correspond.' : 'Aucune partie récente.' }}
        </h2>
        <p>
          {{
            review.matches.length
              ? 'Essayez d’autres filtres dans cet échantillon de parties.'
              : 'Aucune partie disponible sur EUW pour ce joueur.'
          }}
        </p>
        <button v-if="review.matches.length" type="button" class="button" @click="resetFilters">
          Réinitialiser les filtres
        </button>
      </section>
      <div class="load-more">
        <button
          v-if="visibleCount < filtered.length"
          type="button"
          class="button"
          @click="visibleCount += 5"
        >
          Afficher plus <IconChevronDown :size="19" aria-hidden="true" />
        </button>
        <p v-else-if="filtered.length">Toutes les parties de cet échantillon sont affichées.</p>
      </div>
      <SampleNotice />
    </div>
    <MatchDetails
      v-if="selected"
      :match="selected"
      :version="review.assetVersion"
      @close="selected = null"
    />
  </div>
</template>
