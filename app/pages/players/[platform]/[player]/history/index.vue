<script setup lang="ts">
import {
  IconChevronRight,
  IconChevronDown,
  IconNorthStar,
  IconSwords,
  IconBan,
  IconFilterOff,
  IconLoader2,
} from '@tabler/icons-vue'
import type { ReviewFilters } from '#shared/types/review'
import { filterMatches, ROLE_LABELS } from '#shared/domain/review'
import { PLATFORMS } from '#shared/domain/platform'
import { InvalidRiotId } from '#shared/domain/riot-id'
import {
  championPortrait,
  formatDate,
  formatDuration,
  formatScore,
  roleLabel,
} from '~/utils/format'
import { matchPath, profilePath } from '~/utils/routes'

const player = usePlayerRoute()
const {
  data: history,
  pending,
  error,
  load,
  matches,
  next,
  unavailable,
  excluded,
  loadMore,
  loadingMore,
  moreError,
} = usePlayerHistory()
const invalid = { code: 'INVALID_RIOT_ID', message: new InvalidRiotId().message }
const order = ref<'recent' | 'oldest'>('recent')
const filters = reactive({ queue: '', role: '', result: '' })
const filtered = computed(() =>
  filterMatches(matches.value, { ...filters, order: order.value } satisfies ReviewFilters),
)
const modes = computed(() =>
  [...new Map(matches.value.map((match) => [match.queueId, match.mode]))].sort(
    (a, b) => a[0] - b[0],
  ),
)
const filtering = computed(() => Boolean(filters.queue || filters.role || filters.result))
function resetFilters() {
  filters.queue = ''
  filters.role = ''
  filters.result = ''
}
watch(player, resetFilters)
useHead({
  title: computed(() =>
    history.value
      ? `Historique de ${history.value.player.gameName}#${history.value.player.tagLine} — Rift Review`
      : 'Historique des parties — Rift Review',
  ),
})
</script>

<template>
  <SearchState
    v-if="!history"
    :pending="pending"
    :error="player ? error : invalid"
    :subject="player?.riotId"
    @retry="load(true)"
  />
  <div v-else class="history-page">
    <section class="history-heading page-container">
      <div>
        <p class="eyebrow">Au-delà des stats</p>
        <h1>Historique des parties</h1>
        <p class="history-player">
          <NuxtLink :to="profilePath(history.player)"
            >{{ history.player.gameName }}<span>#{{ history.player.tagLine }}</span></NuxtLink
          >
          <span class="region-badge" :title="PLATFORMS[history.player.platform].name">{{
            PLATFORMS[history.player.platform].label
          }}</span>
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
            <option value="NONE">Aucun</option>
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
          {{ matches.length }} partie{{ matches.length > 1 ? 's' : '' }} chargée{{
            matches.length > 1 ? 's' : ''
          }}, tous modes confondus
        </p>
        <button v-if="filtering" type="button" class="text-button" @click="resetFilters">
          <IconFilterOff :size="15" aria-hidden="true" />Effacer les filtres
        </button>
      </div>
      <div v-if="filtered.length" class="match-list">
        <article
          v-for="match in filtered"
          :key="match.id"
          class="match-row"
          :class="match.win ? 'is-win' : 'is-loss'"
        >
          <NuxtLink
            :to="matchPath(history.player, match.id)"
            :aria-label="`Voir la partie : ${match.championName}, ${match.win ? 'victoire' : 'défaite'}${match.remake ? ', remake' : ''}, ${match.mode}, ${formatDate(match.startedAt)}`"
          >
            <span
              class="match-art"
              :style="{
                backgroundImage: `url('${championPortrait(match.championKey, history.assetVersion)}')`,
              }"
              aria-hidden="true"
            />
            <span class="result" :class="match.win ? 'win' : 'loss'"
              >{{ match.win ? 'Victoire' : 'Défaite'
              }}<small v-if="match.remake" class="remake-tag">Remake</small></span
            >
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
            <span class="match-score">{{ formatScore(match) }}</span>
            <span class="match-date"
              ><time :datetime="new Date(match.startedAt).toISOString()">{{
                formatDate(match.startedAt)
              }}</time
              ><small>{{ formatDuration(match.duration) }}</small></span
            >
            <IconChevronRight class="match-arrow" :size="24" aria-hidden="true" />
          </NuxtLink>
        </article>
      </div>
      <section v-else class="empty-history">
        <IconFilterOff :size="32" aria-hidden="true" />
        <h2>{{ matches.length ? 'Aucune partie ne correspond.' : 'Aucune partie récente.' }}</h2>
        <p>
          {{
            matches.length
              ? 'Essayez d’autres filtres, ou chargez plus de parties.'
              : `Aucune partie disponible sur ${PLATFORMS[history.player.platform].label} pour ce joueur.`
          }}
        </p>
        <button v-if="filtering" type="button" class="button" @click="resetFilters">
          Réinitialiser les filtres
        </button>
      </section>
      <div class="load-more">
        <button
          v-if="next !== null"
          type="button"
          class="button"
          :disabled="loadingMore"
          @click="loadMore"
        >
          <template v-if="loadingMore"
            ><IconLoader2 class="spinner" :size="19" aria-hidden="true" />Chargement…</template
          ><template v-else
            >Afficher plus <IconChevronDown :size="19" aria-hidden="true"
          /></template>
        </button>
        <p v-else-if="matches.length">Toutes les parties disponibles sont affichées.</p>
      </div>
      <p v-if="moreError" class="partial-warning load-more-error" role="alert">
        {{ moreError.message }}
      </p>
      <div class="sample-notice">
        <p>
          {{ matches.length }} partie{{ matches.length > 1 ? 's' : '' }} chargée{{
            matches.length > 1 ? 's' : ''
          }}, 20 par page, les plus récentes d’abord ·
          {{ PLATFORMS[history.player.platform].label }}
        </p>
        <p v-if="unavailable" class="partial-warning" role="status">
          Chargement partiel : {{ unavailable }} partie(s) indisponible(s).
        </p>
        <p v-if="excluded">
          {{ excluded }} partie(s) personnalisée(s) ou jouée(s) sur un autre serveur exclue(s).
        </p>
      </div>
    </div>
  </div>
</template>
