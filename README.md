# Rift Review

Une application League of Legends pour préparer un entraînement : recherche par Riot ID, profil et synthèse calculée, historique filtrable et sélection de parties à revoir sur mobile. Les trois maquettes fournies servent de références visuelles.

Nuxt 4.6, Vue 3 et TypeScript strict. Domaine, cas d’usage, transport Riot, cache et interface sont séparés. Aucune base de données n’est nécessaire.

## Lancer le projet

Prérequis : Node.js 22.18+ ou Node.js 24 LTS, npm et une clé du [portail développeur Riot Games](https://developer.riotgames.com/).

```bash
npm ci
```

Copiez `.env.example` vers `.env` puis renseignez la clé **localement**, sans l’ajouter à Git :

```dotenv
RIOT_API_KEY=votre_cle_riot
```

```bash
npm run dev
```

Ouvrez <http://localhost:3000>, saisissez un Riot ID **existant** au format `Pseudo#TAG` et validez avec Entrée ou la loupe. La région est fixée à **EUW**. `NamiMain#MDS` est l’exemple fictif des maquettes, pas un compte garanti.

Sous PowerShell, utilisez `npm.cmd` si `npm.ps1` est bloqué. Après ajout ou renouvellement de la clé, redémarrez le serveur. Les clés de développement Riot expirent généralement après 24 heures.

Le Dev Container existant reste disponible : dans VS Code, utilisez « Dev Containers: Reopen in Container ». Les dépendances sont installées automatiquement et le port 3000 est transféré.

## Fonctionnement

1. Le serveur convertit le Riot ID en PUUID via ACCOUNT-V1.
2. Il demande au maximum les 20 derniers identifiants via MATCH-V5, puis les détails manquants en cache, avec trois requêtes simultanées maximum.
3. Il sélectionne le participant par PUUID et calcule la synthèse sur les parties EUW réellement disponibles.
4. Le navigateur réutilise l’échantillon entre profil et historique. Filtres et « Afficher plus » n’ajoutent aucun appel Riot.

La clé et le PUUID ne sont pas transmis au navigateur. Sans clé, une recherche affiche une erreur de configuration. Aucun mode de secours ne fournit de statistiques inventées.

Le [journal de décisions](docs/decisions.md) décrit les calculs, la sélection « À revoir », les caches, l’architecture, les sources et les limites connues.

## API

`GET /api/review?riotId=Pseudo%23TAG`

Réponse 200 : `player`, `matches`, `summary`, `sample`, `assetVersion`, `updatedAt`. `sample.unavailable` signale un chargement partiel ; `sample.excluded` compte les parties privées ou hors EUW. Contrat : [shared/types/review.ts](shared/types/review.ts).

| Statut | Signification                                                 |
| ------ | ------------------------------------------------------------- |
| 400    | Riot ID mal formé                                             |
| 404    | Compte introuvable                                            |
| 429    | Quota atteint ; respecter l’en-tête et le champ `retryAfter`  |
| 503    | Clé absente, refusée ou expirée                               |
| 502    | Riot inaccessible, données invalides ou détails indisponibles |
| 500    | Erreur interne avec message générique                         |

Les erreurs publiques contiennent `data.code` et `data.message`. Aucun retry automatique avant l’échéance indiquée.

## Vérifier

```bash
npm test
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

Les tests unitaires utilisent le runner Node avec transformation TypeScript. Les tests Playwright couvrent recherche, navigation, filtres, pagination locale, détails, clavier, mobile, états vide et partiel, rate limiting et accessibilité automatisée. Ils démarrent le serveur si nécessaire. Sous Windows, Chrome installé est utilisé ; ailleurs, lancez `npx playwright install chromium` avant les tests.

Les données artificielles de `tests/fixtures` sont réservées aux tests. Les [captures de cette version](docs/screenshots) utilisent des réponses HTTP simulées : elles ne prouvent pas un appel Riot réel. Le [rapport visuel](design-qa.md) décrit les comparaisons et les écarts intentionnels.

`npm run format` reformate les sources. Le dossier utilisateur `doc/` est préservé.

## Production et exploitation

```bash
npm ci
npm run build
# Définir NUXT_RIOT_API_KEY dans l’environnement du processus :
node .output/server/index.mjs
```

Un serveur Node est nécessaire : la génération statique ne fournit pas l’API privée. `NUXT_RIOT_API_KEY` configure le secret au runtime en production, sans reconstruire. Ne transférez pas `.env` dans les assets publics.

Cache mémoire borné, vidé au redémarrage. Une recherche sans cache demande jusqu’à 22 appels Riot, plus les requêtes statiques Data Dragon, mises en cache 24 heures. Quotas locaux à une instance ; les autres applications utilisant la même clé partagent le quota global Riot.

Diagnostic : vérifier le statut et `data.code`, la présence du secret côté serveur et sa validité sur le portail Riot. Sur un 429, attendre la durée indiquée. Pour revenir à une ancienne version, relancer la précédente sortie `.output` avec sa configuration ; aucune migration ni donnée persistée n’est à restaurer.

L’audit npm signale des vulnérabilités transitives de la base Nuxt sans correctif compatible disponible lors de cette livraison. Détails et restrictions de déploiement : journal de décisions.

## Crédits

Visuels : [Riot Games / Data Dragon](https://developer.riotgames.com/docs/lol). Logo et décors : maquettes fournies. Police Inter : licence OFL dans `public/fonts/Inter-LICENSE.txt`. Icônes Tabler : MIT.

Rift Review isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
