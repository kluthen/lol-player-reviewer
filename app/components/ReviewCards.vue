<script setup lang="ts">
import { IconChevronRight } from '@tabler/icons-vue'
import type { ReviewMatch } from '#shared/types/review'
import { championPortrait, formatDate } from '../utils/format'

const { review } = usePlayerReview()
const emit = defineEmits<{ select: [match: ReviewMatch] }>()
const matches = computed(
  () =>
    review.value?.summary.reviewIds.flatMap(
      (id) => review.value?.matches.find((match) => match.id === id) ?? [],
    ) ?? [],
)
</script>

<template>
  <section v-if="review" class="review-section">
    <div class="review-title">
      <h2>À revoir</h2>
      <span>Apprendre<br />de chaque partie</span>
    </div>
    <div v-if="matches.length" class="review-cards">
      <article v-for="match in matches" :key="match.id" class="review-card">
        <ChampionImage
          :src="championPortrait(match.championKey, review.assetVersion)"
          :alt="match.championName"
        />
        <div class="review-card-copy">
          <h3>{{ match.championName }}</h3>
          <p class="result loss">Défaite</p>
          <p class="review-score">{{ match.kills }} / {{ match.deaths }} / {{ match.assists }}</p>
          <time :datetime="new Date(match.startedAt).toISOString()">{{
            formatDate(match.startedAt)
          }}</time>
        </div>
        <button
          type="button"
          class="button review-detail"
          :aria-label="`Détails de la partie avec ${match.championName}`"
          @click="emit('select', match)"
        >
          Détails <IconChevronRight :size="20" aria-hidden="true" />
        </button>
      </article>
    </div>
    <div v-else class="empty-inline">
      <p>
        {{
          review.matches.length
            ? 'Aucune défaite dans les parties chargées.'
            : 'Aucune partie récente à analyser.'
        }}
      </p>
      <p>Retrouvez tous les résultats dans l’historique.</p>
    </div>
    <NuxtLink :to="{ path: '/historique', query: $route.query }" class="button all-matches"
      >Toutes les parties <IconChevronRight :size="20" aria-hidden="true"
    /></NuxtLink>
    <p class="review-rule">
      Les deux défaites avec le plus de morts, parmi les parties chargées. Un point de départ pour
      échanger.
    </p>
  </section>
</template>
