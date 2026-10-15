<script setup lang="ts">
import { IconArrowRight, IconSearch } from '@tabler/icons-vue'
</script>

<template>
  <section class="search-state welcome-state">
    <div class="welcome-art" aria-hidden="true" />
    <div class="welcome-copy">
      <p class="eyebrow">Au-delà des stats</p>
      <h1>Comprendre le jeu.<br /><span>Faire progresser le joueur.</span></h1>
      <p>
        Un profil, ses dernières parties, les bonnes questions.<br class="desktop-only" />
        Préparez votre prochain entraînement.
      </p>
      <div class="welcome-search">
        <PlayerSearch label="Trouver un joueur pour préparer un entraînement" />
      </div>
      <p class="search-hint">
        <IconSearch :size="15" aria-hidden="true" /> Un Riot ID complet et son serveur, par exemple
        NamiMain#MDS sur EUW
        <IconArrowRight :size="15" aria-hidden="true" />
      </p>
      <div class="welcome-facts">
        <span>Tous les serveurs, EUW par défaut</span><span>Parties classées et historique</span
        ><span>Données Riot Games</span>
      </div>
    </div>
  </section>
</template>
