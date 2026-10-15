import { env } from 'node:process'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    riotApiKey: env.RIOT_API_KEY || '',
  },
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Rift Review — Progressez, plus loin.',
      meta: [
        {
          name: 'description',
          content:
            'Préparez votre prochain entraînement League of Legends : profil joueur, statistiques récentes et parties à revoir sur EUW.',
        },
      ],
      link: [{ rel: 'icon', type: 'image/png', href: '/images/brand-mark.png' }],
    },
  },
  routeRules: {
    '/api/**': { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  },
  typescript: { strict: true },
})
