<script setup lang="ts">
import { IconArrowLeft, IconCalendar, IconClock } from '@tabler/icons-vue'
import type { MatchDetail, MatchPlayer, MatchTeam } from '#shared/types/review'
import { PLATFORMS } from '#shared/domain/platform'
import { InvalidRiotId } from '#shared/domain/riot-id'
import {
  championPortrait,
  formatDateTime,
  formatDuration,
  formatScore,
  roleLabel,
} from '~/utils/format'
import { historyPath, profilePath } from '~/utils/routes'

const route = useRoute()
const player = usePlayerRoute()
const matchId = computed(() =>
  typeof route.params.matchId === 'string' ? route.params.matchId : '',
)
const {
  data: match,
  pending,
  error,
  load,
} = useRiotResource<MatchDetail>('match', () =>
  player.value && matchId.value
    ? { url: '/api/match', query: { id: matchId.value, riotId: player.value.riotId } }
    : null,
)
const invalid = { code: 'INVALID_RIOT_ID', message: new InvalidRiotId().message }

// Every player links to their own profile, on the server the game was played on.
const profileOf = (participant: MatchPlayer) =>
  match.value?.platform && participant.gameName && participant.tagLine
    ? profilePath({
        platform: match.value.platform,
        gameName: participant.gameName,
        tagLine: participant.tagLine,
      })
    : null
const riotIdOf = (participant: MatchPlayer) =>
  participant.gameName
    ? `${participant.gameName}${participant.tagLine ? `#${participant.tagLine}` : ''}`
    : 'Joueur inconnu'
const teamName = (team: MatchTeam, index: number) =>
  match.value?.arena
    ? `Équipe ${index + 1}`
    : team.id === 100
      ? 'Équipe bleue'
      : team.id === 200
        ? 'Équipe rouge'
        : `Équipe ${index + 1}`
const placementLabel = (placement: number) =>
  placement === 1 ? '1ʳᵉ place' : `${placement}ᵉ place`

useHead({
  title: computed(() =>
    match.value ? `${match.value.mode} — partie en détail — Rift Review` : 'Partie — Rift Review',
  ),
})
</script>

<template>
  <SearchState
    v-if="!match"
    :pending="pending"
    :error="player ? error : invalid"
    :subject="player?.riotId"
    @retry="load(true)"
  />
  <div v-else class="match-page page-container">
    <NuxtLink v-if="player" class="text-button back-link" :to="historyPath(player)"
      ><IconArrowLeft :size="16" aria-hidden="true" />Historique de {{ player.riotId }}</NuxtLink
    >
    <header class="match-summary">
      <p class="eyebrow">La partie en détail</p>
      <h1>{{ match.mode }}</h1>
      <p class="match-meta">
        <span
          ><IconCalendar :size="18" aria-hidden="true" /><time
            :datetime="new Date(match.startedAt).toISOString()"
            >{{ formatDateTime(match.startedAt) }}</time
          ></span
        ><span
          ><IconClock :size="18" aria-hidden="true" /><span class="sr-only">Durée :</span
          >{{ formatDuration(match.duration) }}</span
        ><span v-if="match.platform" class="region-badge" :title="PLATFORMS[match.platform].name">{{
          PLATFORMS[match.platform].label
        }}</span
        ><span v-if="match.remake" class="remake-tag">Remake</span>
      </p>
    </header>
    <div class="rosters" :class="{ 'is-arena': match.arena }">
      <section
        v-for="(team, index) in match.teams"
        :key="team.id"
        class="roster"
        :class="team.win ? 'is-winner' : 'is-loser'"
        :aria-labelledby="`team-${team.id}`"
      >
        <header class="roster-head">
          <h2 :id="`team-${team.id}`">{{ teamName(team, index) }}</h2>
          <span class="result-badge" :class="team.win ? 'win' : 'loss'">{{
            team.win ? 'Victoire' : 'Défaite'
          }}</span>
          <span v-if="team.placement" class="roster-placement">{{
            placementLabel(team.placement)
          }}</span>
          <p class="roster-score" :title="'Éliminations / morts / assistances de l’équipe'">
            <span class="sr-only">Score de l’équipe : </span>{{ formatScore(team) }}
          </p>
        </header>
        <ul class="roster-players">
          <li
            v-for="(participant, position) in team.players"
            :key="position"
            class="roster-player"
            :class="{ 'is-reviewed': participant.reviewed }"
          >
            <NuxtLink
              v-if="profileOf(participant)"
              class="roster-champion"
              :to="profileOf(participant)!"
              :aria-label="`${participant.championName}, profil de ${riotIdOf(participant)}`"
              ><ChampionImage
                :src="championPortrait(participant.championKey, match.assetVersion)"
                alt=""
              /><span>{{ participant.championName }}</span></NuxtLink
            ><span v-else class="roster-champion"
              ><ChampionImage
                :src="championPortrait(participant.championKey, match.assetVersion)"
                alt=""
              /><span>{{ participant.championName }}</span></span
            >
            <div class="roster-identity">
              <NuxtLink
                v-if="profileOf(participant)"
                class="roster-name"
                :to="profileOf(participant)!"
                >{{ participant.gameName }}<span>#{{ participant.tagLine }}</span></NuxtLink
              ><span v-else class="roster-name">{{ riotIdOf(participant) }}</span>
              <span class="roster-role"
                >{{ roleLabel(participant.role)
                }}<strong v-if="participant.reviewed" class="reviewed-tag"
                  >Joueur suivi</strong
                ></span
              >
            </div>
            <span class="roster-kda"
              ><span class="sr-only">Éliminations / morts / assistances : </span
              >{{ formatScore(participant) }}</span
            >
          </li>
        </ul>
      </section>
    </div>
    <p class="match-reference">Référence : {{ match.id }}</p>
  </div>
</template>
