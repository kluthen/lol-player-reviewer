# Rift Review

Une application League of Legends pour préparer un entraînement : recherche par Riot ID et serveur, profil calculé sur les parties classées d’une période, historique de toutes les parties avec filtres, et détail de chaque partie avec les deux équipes. La spécification est dans [docs/spec.md](docs/spec.md) ; les trois maquettes fournies servent de références visuelles.

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

Pour vérifier que la clé fonctionne : `npm run check:riot-key -- [plateforme] [Pseudo#TAG]` (plateforme `euw1` par défaut).

Ouvrez <http://localhost:3000>, saisissez un Riot ID **existant** au format `Pseudo#TAG`, choisissez le serveur (**EUW** par défaut) et validez avec Entrée ou la loupe. `NamiMain#MDS` est l’exemple fictif des maquettes, pas un compte garanti.

Sous PowerShell, utilisez `npm.cmd` si `npm.ps1` est bloqué. Après ajout ou renouvellement de la clé, redémarrez le serveur. Les clés de développement Riot expirent généralement après 24 heures.

Le Dev Container existant reste disponible : dans VS Code, utilisez « Dev Containers: Reopen in Container ». Les dépendances sont installées automatiquement et le port 3000 est transféré.

## Fonctionnement

Chaque page a une URL partageable :

| Page       | Route                                                           |
| ---------- | --------------------------------------------------------------- |
| Accueil    | `/`                                                             |
| Profil     | `/players/euw1/Pseudo-TAG` (option `?periode=30-60` ou `30-90`) |
| Historique | `/players/euw1/Pseudo-TAG/history`                              |
| Partie     | `/players/euw1/Pseudo-TAG/history/EUW1_7212345678`              |

1. Le serveur convertit le Riot ID en PUUID via ACCOUNT-V1, puis vérifie que le joueur existe sur le serveur choisi via SUMMONER-V4 (niveau et icône).
2. **Profil :** il demande à MATCH-V5 les parties classées de la période (`type=ranked`, `startTime`, `count` de 20 ou 30), charge les parties absentes du cache, trois à la fois, et calcule les chiffres sur les parties Solo/Duo et Flex, remakes exclus. LEAGUE-V4 fournit le classement.
3. **Historique :** 20 parties de tous les modes par page ; « Afficher plus » demande les 20 suivantes. Les filtres portent sur les parties chargées.
4. **Partie :** les deux équipes complètes, tirées de la même partie en cache. Chaque joueur renvoie vers son profil sur le serveur de la partie.

La clé et les PUUID ne sont pas transmis au navigateur. Sans clé, une recherche affiche une erreur de configuration. Aucun mode de secours ne fournit de statistiques inventées.

Le [journal de décisions](docs/decisions.md) décrit les calculs, les règles d’égalité, les listes « Dernières parties » et « À revoir », les caches, l’architecture, les sources et les limites connues.

## API

Contrat complet : [shared/types/review.ts](shared/types/review.ts). `platform` est un serveur LoL (`euw1`, `eun1`, `na1`, `kr`…).

| Route                                                             | Réponse 200                                                                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/profile?platform=euw1&riotId=Pseudo%23TAG&period=20-30` | `PlayerProfile` : `player` (niveau, icône), `ranked`, `period`, `matches` classées, `summary`, `sample` (`remakes`, `unavailable`, `excluded`) |
| `GET /api/history?platform=euw1&riotId=Pseudo%23TAG&start=0`      | `PlayerHistory` : `player`, 20 `matches` de tous les modes, `page` (`start`, `next` : `null` en fin d’historique)                              |
| `GET /api/match?id=EUW1_7212345678&riotId=Pseudo%23TAG`           | `MatchDetail` : file, date, durée, `teams` avec leurs joueurs, totaux et résultat ; `riotId` (facultatif) marque le joueur suivi               |

`period` vaut `20-30` (défaut), `30-60` ou `30-90`.

| Statut | Signification                                                         |
| ------ | --------------------------------------------------------------------- |
| 400    | Riot ID, serveur, période, page ou référence de partie invalide       |
| 404    | Compte introuvable, joueur absent de ce serveur ou partie introuvable |
| 429    | Quota atteint ; respecter l’en-tête et le champ `retryAfter`          |
| 503    | Clé absente, refusée ou expirée                                       |
| 502    | Riot inaccessible, données invalides ou détails indisponibles         |
| 500    | Erreur interne avec message générique                                 |

Les erreurs publiques contiennent `data.code` et `data.message`. Aucun retry automatique avant l’échéance indiquée.

## Vérifier

```bash
npm test
npm run typecheck
npm run format:check
npm run build
npm run test:e2e
```

Les tests unitaires utilisent le runner Node avec transformation TypeScript. Les tests Playwright couvrent recherche avec serveur, périodes, profil desktop et mobile, historique, filtres, pagination Riot, détail d’une partie et liens vers les joueurs, clavier, états vide et partiel, rate limiting, redirections des anciens liens et accessibilité automatisée. Ils démarrent le serveur si nécessaire. Sous Windows, Chrome installé est utilisé ; ailleurs, lancez `npx playwright install chromium` avant les tests.

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

Cache mémoire borné, vidé au redémarrage. Un profil sans cache demande jusqu’à 24 appels Riot (20 parties) ou 34 (30 parties), une page d’historique jusqu’à 21, plus les requêtes statiques Data Dragon, mises en cache 24 heures. Les parties restent en cache : changer de période ou ouvrir une partie déjà vue ne redemande que ce qui manque. Quotas locaux à une instance ; les autres applications utilisant la même clé partagent le quota global Riot.

Diagnostic : vérifier le statut et `data.code`, la présence du secret côté serveur et sa validité sur le portail Riot. Sur un 429, attendre la durée indiquée. Pour revenir à une ancienne version, relancer la précédente sortie `.output` avec sa configuration ; aucune migration ni donnée persistée n’est à restaurer.

L’audit npm signale des vulnérabilités transitives de la base Nuxt sans correctif compatible disponible lors de cette livraison. Détails et restrictions de déploiement : journal de décisions.

## Crédits

Visuels : [Riot Games / Data Dragon](https://developer.riotgames.com/docs/lol). Logo et décors : maquettes fournies. Police Inter : licence OFL dans `public/fonts/Inter-LICENSE.txt`. Icônes Tabler : MIT.

Rift Review isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
