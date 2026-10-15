<script setup lang="ts">
import { IconChevronRight } from '@tabler/icons-vue'
import type { ReviewMatch } from '#shared/types/review'
import { REVIEW_GAMES } from '#shared/domain/review'
import { championPortrait, formatDate, formatScore } from '~/utils/format'
import { historyPath, matchPath, type PlayerLocation } from '~/utils/routes'

defineProps<{ matches: ReviewMatch[]; version: string; player: PlayerLocation }>()
</script>

<template>
  <section class="review-section">
    <div class="review-title">
      <h2>À revoir</h2>
      <span>Apprendre<br />de chaque partie</span>
    </div>
    <div v-if="matches.length" class="review-cards">
      <article v-for="match in matches" :key="match.id" class="review-card">
        <ChampionImage
          :src="championPortrait(match.championKey, version)"
          :alt="match.championName"
        />
        <div class="review-card-copy">
          <h3>{{ match.championName }}</h3>
          <p class="result loss">Défaite</p>
          <p class="review-score">{{ formatScore(match) }}</p>
          <time :datetime="new Date(match.startedAt).toISOString()">{{
            formatDate(match.startedAt)
          }}</time>
        </div>
        <NuxtLink
          class="button review-detail"
          :to="matchPath(player, match.id)"
          :aria-label="`Détails de la partie avec ${match.championName}, ${formatDate(match.startedAt)}`"
        >
          Détails <IconChevronRight :size="20" aria-hidden="true" />
        </NuxtLink>
      </article>
    </div>
    <div v-else class="empty-inline">
      <p>Aucune défaite classée sur cette période.</p>
      <p>Retrouvez tous les résultats dans l’historique.</p>
    </div>
    <NuxtLink :to="historyPath(player)" class="button all-matches"
      >Toutes les parties <IconChevronRight :size="20" aria-hidden="true"
    /></NuxtLink>
    <p class="review-rule">
      Les {{ REVIEW_GAMES }} dernières défaites classées de la période. Un point de départ pour
      échanger.
    </p>
  </section>
</template>
