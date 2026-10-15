<script setup lang="ts">
import {
  IconTrophyFilled,
  IconSwords,
  IconUsersGroup,
  IconArrowRight,
  IconNorthStar,
} from '@tabler/icons-vue'
import type { PlayerProfile, RankedStanding } from '#shared/types/review'
import { DEFAULT_PERIOD, PERIODS, findPeriod } from '#shared/domain/period'
import { PLATFORMS } from '#shared/domain/platform'
import { InvalidRiotId } from '#shared/domain/riot-id'
import {
  championPortrait,
  championSplash,
  formatKda,
  formatNumber,
  formatPercent,
  formatScore,
  profileIcon,
  rankedLabel,
  roleList,
} from '~/utils/format'
import { historyPath, matchPath } from '~/utils/routes'

const route = useRoute()
const router = useRouter()
const player = usePlayerRoute()
const period = computed(() => findPeriod(route.query.periode) ?? DEFAULT_PERIOD)
const {
  data: profile,
  pending,
  error,
  load,
} = useRiotResource<PlayerProfile>(
  'profile',
  () =>
    player.value
      ? {
          url: '/api/profile',
          query: {
            platform: player.value.platform,
            riotId: player.value.riotId,
            period: period.value.id,
          },
        }
      : null,
  // Changing the period keeps the current figures on screen while the new ones load.
  () => (player.value ? `${player.value.platform}:${player.value.riotId}` : ''),
)
const invalid = { code: 'INVALID_RIOT_ID', message: new InvalidRiotId().message }

function setPeriod(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  void router.replace({
    query: { ...route.query, periode: id === DEFAULT_PERIOD.id ? undefined : id },
  })
}

const byId = computed(() => new Map(profile.value?.matches.map((match) => [match.id, match])))
const recent = computed(
  () => profile.value?.summary.recentIds.flatMap((id) => byId.value.get(id) ?? []) ?? [],
)
const toReview = computed(
  () => profile.value?.summary.reviewIds.flatMap((id) => byId.value.get(id) ?? []) ?? [],
)
const roles = computed(() => roleList(profile.value?.summary.mainRoles ?? []))
const topChampion = computed(() => profile.value?.summary.topChampion ?? null)
const averages = computed(() => profile.value?.summary.averages ?? null)
const heroStyle = computed(() =>
  topChampion.value
    ? {
        backgroundImage: `url("${topChampion.value.key === 'Nami' ? '/images/profile-banner.webp' : championSplash(topChampion.value.key)}")`,
      }
    : undefined,
)
const standing = (queue: RankedStanding['queue']) =>
  profile.value?.ranked?.find((entry) => entry.queue === queue)
const perMinute = (value: number | null) => (value === null ? '—' : formatNumber(Math.round(value)))
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count > 1 ? many : one}`

useHead({
  title: computed(() =>
    profile.value
      ? `${profile.value.player.gameName}#${profile.value.player.tagLine} — Rift Review`
      : 'Rift Review — Progressez, plus loin.',
  ),
})
</script>

<template>
  <SearchState
    v-if="!profile"
    :pending="pending"
    :error="player ? error : invalid"
    :subject="player?.riotId"
    @retry="load(true)"
  />
  <div v-else class="profile-page" :class="{ 'is-updating': pending }" :aria-busy="pending">
    <section class="profile-hero">
      <div class="profile-art" :style="heroStyle" aria-hidden="true" />
      <div class="profile-identity">
        <div class="profile-avatar-wrap">
          <div class="profile-avatar">
            <ChampionImage
              class="avatar-desktop"
              :src="profileIcon(profile.player.profileIconId, profile.assetVersion)"
              alt="Icône de profil"
              eager
            />
            <ChampionImage
              class="avatar-mobile"
              :src="
                topChampion
                  ? championPortrait(topChampion.key, profile.assetVersion)
                  : profileIcon(profile.player.profileIconId, profile.assetVersion)
              "
              :alt="topChampion ? `Champion le plus joué : ${topChampion.name}` : 'Icône de profil'"
              eager
            />
          </div>
          <span class="level-badge" :title="`Niveau d’invocateur ${profile.player.level}`"
            >Niv. {{ profile.player.level }}</span
          >
        </div>
        <div>
          <p class="eyebrow mobile-eyebrow">Le joueur, au-delà des chiffres</p>
          <h1>
            {{ profile.player.gameName
            }}<span class="desktop-tag">#{{ profile.player.tagLine }}</span>
          </h1>
          <p class="profile-role">
            <span class="mobile-tag"
              >#{{ profile.player.tagLine }}<template v-if="roles"> · </template></span
            ><IconNorthStar v-if="roles" :size="27" aria-hidden="true" /><span
              v-if="roles"
              class="main-roles"
              title="Rôle le plus joué en partie classée sur la période"
              >{{ roles }}</span
            ><span class="region-badge" :title="PLATFORMS[profile.player.platform].name">{{
              PLATFORMS[profile.player.platform].label
            }}</span>
          </p>
          <p v-if="profile.ranked" class="ranked-line">
            <span
              >Solo/Duo :
              {{
                standing('RANKED_SOLO_5x5')
                  ? rankedLabel(standing('RANKED_SOLO_5x5')!)
                  : 'Non classé'
              }}</span
            ><span
              >Flex :
              {{
                standing('RANKED_FLEX_SR') ? rankedLabel(standing('RANKED_FLEX_SR')!) : 'Non classé'
              }}</span
            >
          </p>
        </div>
      </div>
      <nav class="profile-tabs" aria-label="Vues du joueur">
        <NuxtLink :to="route.fullPath" aria-current="page" class="active">Vue d’ensemble</NuxtLink
        ><NuxtLink :to="historyPath(profile.player)">Parties</NuxtLink>
      </nav>
    </section>
    <div class="profile-content page-container">
      <div class="summary-grid">
        <article class="stat-card stat-wins">
          <IconTrophyFilled :size="43" aria-hidden="true" />
          <div>
            <h2>Victoires</h2>
            <p>{{ profile.summary.winRate === null ? '—' : `${profile.summary.winRate} %` }}</p>
          </div>
        </article>
        <article class="stat-card stat-kda">
          <IconSwords :size="43" aria-hidden="true" />
          <div>
            <h2>KDA <span class="sr-only">moyen</span></h2>
            <p>{{ formatKda(profile.summary.kda) }}</p>
          </div>
        </article>
        <article class="stat-card stat-games">
          <IconUsersGroup :size="47" aria-hidden="true" />
          <div>
            <h2>Parties</h2>
            <p>{{ profile.summary.games }}</p>
          </div>
        </article>
        <label class="period-select"
          ><span class="sr-only">Période</span
          ><select :value="period.id" :disabled="pending" @change="setPeriod">
            <option v-for="option in PERIODS" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select></label
        >
      </div>
      <div class="sample-notice">
        <p role="status" aria-live="polite">
          <template v-if="pending">Mise à jour des statistiques…</template
          ><template v-else
            >{{ plural(profile.summary.games, 'partie classée', 'parties classées') }} (Solo/Duo et
            Flex) sur la période « {{ period.label }} » ·
            {{ PLATFORMS[profile.player.platform].label }}</template
          >
        </p>
        <p v-if="profile.sample.remakes">
          {{ plural(profile.sample.remakes, 'remake') }} exclu{{
            profile.sample.remakes > 1 ? 's' : ''
          }}
          des statistiques.
        </p>
        <p v-if="profile.sample.unavailable" class="partial-warning" role="status">
          Chargement partiel : {{ profile.sample.unavailable }} partie(s) indisponible(s). Les
          statistiques utilisent uniquement les parties disponibles.
        </p>
        <p v-if="profile.sample.excluded">
          {{ profile.sample.excluded }} partie(s) jouée(s) sur un autre serveur exclue(s).
        </p>
      </div>
      <section v-if="!profile.summary.games" class="panel empty-profile">
        <h2>Aucune partie classée sur cette période.</h2>
        <p>
          Le profil ne compte que les parties classées Solo/Duo et Flex. L’historique montre aussi
          les autres modes.
        </p>
        <NuxtLink class="button button-gold" :to="historyPath(profile.player)"
          >Voir l’historique <IconArrowRight :size="16" aria-hidden="true"
        /></NuxtLink>
      </section>
      <template v-else>
        <div class="overview-panels">
          <section class="panel champions-panel">
            <h2>Champions favoris</h2>
            <div class="champion-grid">
              <figure v-for="champion in profile.summary.champions" :key="champion.key">
                <ChampionImage
                  :src="championPortrait(champion.key, profile.assetVersion)"
                  :alt="champion.name"
                />
                <figcaption>
                  {{ champion.name }}<small>{{ plural(champion.games, 'partie') }}</small
                  ><small
                    >{{ champion.winRate }} % de victoires · KDA
                    {{ formatKda(champion.kda) }}</small
                  >
                </figcaption>
              </figure>
            </div>
          </section>
          <section class="panel latest-panel">
            <h2>Dernières parties</h2>
            <div class="latest-list">
              <NuxtLink
                v-for="match in recent"
                :key="match.id"
                class="latest-match"
                :to="matchPath(profile.player, match.id)"
                :aria-label="`${match.championName}, ${match.win ? 'victoire' : 'défaite'}, ${match.kills} éliminations, ${match.deaths} morts, ${match.assists} assistances, voir la partie`"
              >
                <ChampionImage
                  :src="championPortrait(match.championKey, profile.assetVersion)"
                  alt=""
                /><span class="latest-name">{{ match.championName }}</span
                ><span class="result-badge" :class="match.win ? 'win' : 'loss'">{{
                  match.win ? 'Victoire' : 'Défaite'
                }}</span
                ><span class="latest-score">{{ formatScore(match) }}</span>
              </NuxtLink>
            </div>
            <div class="panel-footer">
              <NuxtLink class="button button-gold" :to="historyPath(profile.player)"
                >Voir plus <IconArrowRight :size="16" aria-hidden="true"
              /></NuxtLink>
            </div>
          </section>
        </div>
        <ReviewCards :matches="toReview" :version="profile.assetVersion" :player="profile.player" />
        <section v-if="averages" class="panel performance-panel">
          <h2>Performance moyenne</h2>
          <dl class="performance-grid">
            <div>
              <dt>Éliminations / morts / assistances</dt>
              <dd>
                {{ formatKda(averages.kills) }} / {{ formatKda(averages.deaths) }} /
                {{ formatKda(averages.assists) }}
              </dd>
            </div>
            <div>
              <dt>CS par minute</dt>
              <dd>{{ formatKda(averages.csPerMinute) }}</dd>
            </div>
            <div>
              <dt>Or par minute</dt>
              <dd>{{ perMinute(averages.goldPerMinute) }}</dd>
            </div>
            <div>
              <dt>Dégâts aux champions par minute</dt>
              <dd>{{ perMinute(averages.damagePerMinute) }}</dd>
            </div>
            <div>
              <dt>Participation aux éliminations</dt>
              <dd>{{ formatPercent(averages.killParticipation) }}</dd>
            </div>
            <div>
              <dt>Score de vision par minute</dt>
              <dd>{{ formatKda(averages.visionPerMinute) }}</dd>
            </div>
            <div>
              <dt>Part des dégâts de l’équipe</dt>
              <dd>{{ formatPercent(averages.damageShare) }}</dd>
            </div>
          </dl>
        </section>
      </template>
      <p class="calculation-note">
        KDA = (éliminations + assistances) / morts (au moins 1), sur l’ensemble des parties de la
        période. Seules les parties classées Solo/Duo et Flex comptent, remakes exclus.
      </p>
    </div>
  </div>
</template>
