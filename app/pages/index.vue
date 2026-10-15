<script setup lang="ts">
import {
  IconTrophyFilled,
  IconSwords,
  IconUsersGroup,
  IconArrowRight,
  IconNorthStar,
} from '@tabler/icons-vue'
import type { ReviewMatch } from '#shared/types/review'
import { championPortrait, championSplash, formatKda, roleLabel } from '../utils/format'

const { review, pending, error, riotId } = usePlayerReview()
const order = useState<'recent' | 'oldest'>('match-order', () => 'recent')
const selected = ref<ReviewMatch | null>(null)
watch(riotId, () => {
  selected.value = null
})
const primaryChampion = computed(() => review.value?.summary.champions[0]?.key)
const latest = computed(() =>
  [...(review.value?.matches ?? [])]
    .sort((a, b) =>
      order.value === 'recent' ? b.startedAt - a.startedAt : a.startedAt - b.startedAt,
    )
    .slice(0, 3),
)
const heroStyle = computed(() =>
  primaryChampion.value
    ? {
        backgroundImage: `url("${primaryChampion.value === 'Nami' ? '/images/profile-banner.webp' : championSplash(primaryChampion.value)}")`,
      }
    : undefined,
)
useHead({
  title: computed(() =>
    review.value
      ? `${review.value.player.gameName}#${review.value.player.tagLine} — Rift Review`
      : 'Rift Review — Progressez, plus loin.',
  ),
})
</script>

<template>
  <SearchState v-if="pending || error || !review" />
  <div v-else class="profile-page">
    <section class="profile-hero">
      <div class="profile-art" :style="heroStyle" aria-hidden="true" />
      <div class="profile-identity">
        <div class="profile-avatar">
          <ChampionImage
            v-if="primaryChampion"
            :src="championPortrait(primaryChampion, review.assetVersion)"
            :alt="`Champion le plus joué : ${review.summary.champions[0]?.name}`"
            eager
          /><IconUsersGroup v-else :size="56" aria-hidden="true" />
        </div>
        <div>
          <p class="eyebrow mobile-eyebrow">Le joueur, au-delà des chiffres</p>
          <h1>
            {{ review.player.gameName
            }}<span class="desktop-tag">#{{ review.player.tagLine }}</span>
          </h1>
          <p class="profile-role">
            <span class="mobile-tag">#{{ review.player.tagLine }} · </span
            ><IconNorthStar v-if="review.summary.mainRole" :size="27" aria-hidden="true" /><span
              :title="
                review.summary.mainRole
                  ? 'Rôle le plus fréquent sur les parties pertinentes chargées'
                  : undefined
              "
              >{{
                review.summary.mainRole ? roleLabel(review.summary.mainRole) : 'Rôle non déterminé'
              }}</span
            ><span class="region-badge">EUW</span>
          </p>
        </div>
      </div>
      <nav class="profile-tabs" aria-label="Vues du joueur">
        <NuxtLink :to="{ path: '/', query: $route.query }" aria-current="page" class="active"
          >Vue d’ensemble</NuxtLink
        ><NuxtLink :to="{ path: '/historique', query: $route.query }">Parties</NuxtLink>
      </nav>
    </section>
    <div class="profile-content page-container">
      <div class="summary-grid">
        <article class="stat-card stat-wins">
          <IconTrophyFilled :size="43" aria-hidden="true" />
          <div>
            <h2>Victoires</h2>
            <p>{{ review.summary.winRate === null ? '—' : `${review.summary.winRate} %` }}</p>
          </div>
        </article>
        <article class="stat-card stat-kda">
          <IconSwords :size="43" aria-hidden="true" />
          <div>
            <h2>KDA <span class="sr-only">global</span></h2>
            <p :class="{ 'deathless-value': review.summary.deathless }">
              {{ review.summary.deathless ? 'Aucune mort' : formatKda(review.summary.kda) }}
            </p>
          </div>
        </article>
        <article class="stat-card stat-games">
          <IconUsersGroup :size="47" aria-hidden="true" />
          <div>
            <h2>Parties</h2>
            <p>{{ review.summary.games }}</p>
          </div>
        </article>
        <label class="order-select"
          ><span class="sr-only">Ordre des dernières parties</span
          ><select v-model="order">
            <option value="recent">Récent</option>
            <option value="oldest">Ancien</option>
          </select></label
        >
      </div>
      <SampleNotice />
      <div v-if="review.matches.length" class="overview-panels">
        <section class="panel champions-panel">
          <h2>Champions les plus joués</h2>
          <div class="champion-grid">
            <figure v-for="champion in review.summary.champions" :key="champion.key">
              <ChampionImage
                :src="championPortrait(champion.key, review.assetVersion)"
                :alt="champion.name"
              />
              <figcaption>
                {{ champion.name
                }}<small>{{ champion.games }} partie{{ champion.games > 1 ? 's' : '' }}</small>
              </figcaption>
            </figure>
          </div>
        </section>
        <section class="panel latest-panel">
          <h2>Dernières parties</h2>
          <div class="latest-list">
            <button
              v-for="match in latest"
              :key="match.id"
              type="button"
              class="latest-match"
              :aria-label="`${match.championName}, ${match.win ? 'victoire' : 'défaite'}, ${match.kills} éliminations, ${match.deaths} morts, ${match.assists} assistances, voir les détails`"
              @click="selected = match"
            >
              <ChampionImage
                :src="championPortrait(match.championKey, review.assetVersion)"
                alt=""
              /><span class="latest-name">{{ match.championName }}</span
              ><span class="result-badge" :class="match.win ? 'win' : 'loss'">{{
                match.win ? 'Victoire' : 'Défaite'
              }}</span
              ><span class="latest-score"
                >{{ match.kills }} / {{ match.deaths }} / {{ match.assists }}</span
              >
            </button>
          </div>
          <div class="panel-footer">
            <NuxtLink class="button button-gold" :to="{ path: '/historique', query: $route.query }"
              >Voir plus <IconArrowRight :size="16" aria-hidden="true"
            /></NuxtLink>
          </div>
        </section>
      </div>
      <div v-else class="panel empty-profile">
        <h2>L’histoire reste à écrire.</h2>
        <p>
          Aucune partie récente disponible sur EUW. Essayez un autre Riot ID ou revenez après une
          prochaine partie.
        </p>
      </div>
      <ReviewCards @select="selected = $event" />
      <p class="calculation-note">
        KDA global = (éliminations + assistances) / morts. Les statistiques portent uniquement sur
        les parties chargées.
      </p>
    </div>
    <MatchDetails
      v-if="selected"
      :match="selected"
      :version="review.assetVersion"
      @close="selected = null"
    />
  </div>
</template>
