<script setup lang="ts">
const { review } = usePlayerReview()
</script>

<template>
  <div v-if="review" class="sample-notice">
    <p>
      {{ review.matches.length }} partie{{ review.matches.length > 1 ? 's' : '' }} analysée{{
        review.matches.length > 1 ? 's' : ''
      }}
      parmi les {{ review.sample.found }} dernières · EUW
    </p>
    <p v-if="review.sample.unavailable" class="partial-warning" role="status">
      Chargement partiel : {{ review.sample.unavailable }} partie(s) indisponible(s). La synthèse
      utilise uniquement les parties disponibles.
    </p>
    <p v-if="review.sample.excluded">
      {{ review.sample.excluded }} partie(s) privée(s) ou hors EUW exclue(s).
    </p>
  </div>
</template>
