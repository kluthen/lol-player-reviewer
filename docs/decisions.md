# Journal de décisions — Rift Review

Date : 15 octobre 2026. Statut : appliqué à la version qui suit la spécification v1 (`docs/spec.md`, mise à jour du 15 octobre 2026).

## Besoin et périmètre

Permettre à un coach de retrouver un joueur, comprendre ses résultats récents et choisir des parties à discuter. Le PDF est un brief fonctionnel ; ses consignes pédagogiques de groupes et rendez-vous T+25/T+75/T+120 ne sont pas exécutées comme des instructions utilisateur. Les captures documentent cette version, sans prétendre représenter ces échéances.

Trois écrans, chacun avec une URL partageable : le **profil** (parties classées uniquement), l’**historique** (tous les modes) et le **détail d’une partie** (les deux équipes). La recherche choisit le serveur parmi les 15 plateformes LoL, EUW (`euw1`) par défaut (Q6). ACCOUNT-V1 passe toujours par l’hôte `europe` (il répond pour tous les joueurs) ; MATCH-V5 passe par la région du serveur (`europe`, `americas`, `asia`, `sea`) ; SUMMONER-V4 et LEAGUE-V4 par l’hôte du serveur. La correspondance est dans `shared/domain/platform.ts`, alignée sur `scripts/check-riot-key.mjs`.

Un Riot ID qui existe mais n’a pas de profil sur le serveur choisi (SUMMONER-V4 répond 404) donne une erreur qui nomme le serveur (S2). Les parties personnalisées et celles jouées sur un autre serveur de la même région sont exclues et comptées. Les données viennent exclusivement des parties réellement disponibles. Aucun JSON de secours ni mode démonstration n’est activé dans l’application.

Les maîtrises, les timelines, les comptes utilisateur et une base de données ne sont pas nécessaires à ce périmètre.

## Routes

| Route                                               | Page                                           |
| --------------------------------------------------- | ---------------------------------------------- |
| `/`                                                 | Accueil et recherche                           |
| `/players/{plateforme}/{pseudo}-{tag}`              | Profil ; `?periode=30-60` ou `30-90` en option |
| `/players/{plateforme}/{pseudo}-{tag}/history`      | Historique                                     |
| `/players/{plateforme}/{pseudo}-{tag}/history/{id}` | Détail d’une partie ouverte depuis ce joueur   |

Le tag ne contient jamais de tiret : le dernier `-` du segment sépare pseudo et tag (`Jean-Luc-1234`). La période fait partie de l’URL pour qu’un lien partagé montre les mêmes chiffres. Les anciens liens EUW (`/?joueur=Pseudo%23TAG`, `/historique?joueur=…`) redirigent en 301 vers les nouvelles routes sur `euw1`. Les liens du détail vers d’autres joueurs utilisent `info.platformId` de la partie.

## Conventions de calcul

Les règles sont dans `shared/domain/review.ts` ; leurs tests dans `tests/unit/review.test.ts`.

- **Profil = parties classées.** Solo/Duo (420) et Flex (440), comptées ensemble (Q9). MATCH-V5 est interrogé avec `type=ranked&startTime=…&count=N`, puis la file est vérifiée. Les remakes (`gameEndedInEarlySurrender`) sont exclus et leur nombre affiché.
- **Périodes :** « 20 parties · 30 jours » (défaut), « 30 parties · 60 jours », « 30 parties · 90 jours ». `startTime` en secondes, arrondi à cinq minutes près pour réutiliser la liste en cache. Les parties comptées sont celles que Riot renvoie, moins les remakes : un remake n’est pas remplacé par une partie plus ancienne. Changer de période garde les chiffres affichés pendant le chargement ; les parties déjà en cache ne sont pas redemandées.
- Victoires : nombre de victoires / nombre de parties comptées, arrondi au pourcentage entier. Sans partie : « — ».
- KDA : (somme des éliminations + somme des assistances) / max(somme des morts, 1) sur toute la période, avec une décimale française (O1). Sans partie : « — ». Ce calcul diffère d’une moyenne des ratios individuels ; il remplace l’affichage « Aucune mort » de la version précédente.
- Champions favoris : nombre de parties décroissant, puis nom Data Dragon (fr_FR) par ordre alphabétique sans tenir compte de la casse ni des accents (`Intl.Collator('fr', { sensitivity: 'base' })`), trois maximum, chacun avec parties, % de victoires et KDA (O3). Nami 4 / Lulu 4 donne Lulu.
- Rôle principal : `teamPosition` le plus fréquent sur la Faille (mapId 11). En cas d’égalité, tous les rôles à égalité sont affichés, le plus récemment joué d’abord (« Support · Jungle ») ; la règle vaut sur mobile (H6) et sur desktop (H2, Q10). Sans partie classée : aucun rôle. ARAM et Arena n’ont pas de rôle : « Aucun ».
- Image ronde : sur desktop, l’icône de profil (SUMMONER-V4, Q10) ; sur mobile, le champion le plus joué selon la règle ci-dessus (H5), ou l’icône de profil sans partie classée. Le niveau d’invocateur est affiché sous l’image. Le classement Solo/Duo et Flex (LEAGUE-V4) est affiché sur desktop ; s’il est indisponible, le profil s’affiche sans lui.
- « Dernières parties » sur desktop : les cinq dernières parties classées de la période, victoires et défaites (O6). « À revoir » sur mobile : les trois dernières défaites classées de la période (O7). Chaque partie ouvre son détail (O8).
- Performance moyenne (O2) : éliminations, morts et assistances par partie ; CS, or, dégâts aux champions et score de vision rapportés à la somme des `timePlayed` en minutes ; participation aux éliminations = (éliminations + assistances) / éliminations de l’équipe ; part des dégâts = dégâts aux champions / dégâts de l’équipe, sommés sur la période.
- **Historique = tous les modes**, du plus récent au plus ancien, 20 parties par page (`start`, `count=20`). « Afficher plus » demande les 20 suivantes à Riot, sans limite (Q7). Les filtres mode, rôle et résultat se combinent sur les parties chargées ; « Récent / Ancien » change l’ordre d’affichage. Les remakes sont affichés et marqués (L5).
- **Détail d’une partie :** une équipe par `teamId` (100 bleue, 200 rouge), ou par `playerSubteamId` en Arena, classées par `subteamPlacement`. Équipe gagnante : `info.teams[].win` (en Arena, le `win` des joueurs), mise en avant et étiquetée « Victoire » / « Défaite ». Score d’équipe : somme des éliminations, morts et assistances. Le joueur suivi est retrouvé par PUUID via son compte (souvent en cache), sinon par le Riot ID enregistré dans la partie.
- Dates transmises en millisecondes UTC et affichées en Europe/Paris. Durées en secondes affichées minutes:secondes. CS = sbires + monstres.

## Architecture et sécurité

Les règles pures sont dans `shared/domain`. Trois cas d’usage, `GetPlayerProfile`, `GetPlayerHistory` et `GetMatchDetail`, dépendent du port `RiotPort` et d’un fournisseur de catalogue. Transport HTTP, cache et adapter sont dans `server/infrastructure`. Les routes `/api/profile`, `/api/history` et `/api/match` partagent `defineRiotHandler` (quota par adresse, traduction des erreurs) ; Vue affiche les DTO. Cette séparation rend les règles testables sans dépendre de Nuxt ou du réseau.

L’adapter valide une partie MATCH-V5 en un enregistrement complet (`MatchRecord` : les dix participants, ou tous ceux d’Arena) et met cet enregistrement en cache. Une même partie sert au profil, à l’historique et au détail sans nouvel appel.

La clé reste dans le runtimeConfig privé. Elle est envoyée uniquement aux hôtes Riot connus (régions et plateformes, liste fermée), dans `X-Riot-Token`. Segments dynamiques encodés, redirections refusées, entrées et réponses validées. Les DTO publics ne contiennent ni clé, ni PUUID (y compris ceux des neuf autres joueurs du détail), ni réponse Riot brute. Aucun appel Riot authentifié depuis le navigateur. Les erreurs techniques externes ne sont pas exposées.

Cache mémoire borné par instance : comptes, invocateurs et classements 5 min, listes d’identifiants 2 min, parties 30 jours (2 000 au plus, une partie terminée ne change pas), catalogue 24 h. Les chargements simultanés d’une même entrée sont fusionnés, les erreurs ne sont pas conservées. Un redémarrage vide le cache. Un cache partagé serait nécessaire avec plusieurs instances ; il n’est pas requis pour l’atelier.

Coût d’un profil sans cache : compte, invocateur, classement et liste (4 appels), plus une partie par identifiant (20 ou 30). Une page d’historique : compte et invocateur (souvent en cache), liste, puis jusqu’à 20 parties. Le détail : 0 ou 1 appel, plus le compte du joueur suivi s’il n’est plus en cache.

Trois parties maximum sont chargées simultanément. Départs espacés d’au moins 110 ms, au plus 95 réservations dans une fenêtre glissante de deux minutes, tous hôtes confondus. HTTP 429 bloque les requêtes suivantes selon `Retry-After`, transmis au navigateur ; aucun retry anticipé. Les appels à l’API de l’application sont limités à 30 par minute par adresse observée, les trois routes confondues, sans confiance implicite envers les en-têtes proxy.

Timeout systématique : Riot 10 s, Data Dragon 5 s. Les détails manquants produisent un avertissement ; les calculs utilisent les seules parties disponibles. Si tous les détails échouent, une erreur est affichée. L’échec du catalogue n’empêche pas les statistiques : noms des parties et version d’assets vérifiée 16.20.1 en repli.

## Références et compatibilité

Palette et disposition suivent les maquettes. Logo et décors sont extraits des références fournies ; portraits et illustrations de champions viennent de Data Dragon. Une illustration de skin ne représente pas une propriété du compte. Inter est servi localement en WOFF2 avec sa licence OFL ; Georgia fournit les titres. Tabler est l’unique dépendance d’interface ajoutée.

`tests/fixtures` contient des données artificielles utilisées uniquement par les tests. Les captures interceptent la réponse HTTP ; ces fixtures ne sont jamais importées par l’application. Elles prouvent le comportement de l’interface, pas un appel Riot réel.

TypeScript 5.9.3 est fixé : TypeScript 7.0.2 proposé à l’installation n’expose pas l’entrée `typescript/lib/tsc` utilisée par vue-tsc 3.3.13. Le framework Nuxt 4.6.1 initial est conservé.

## Limites connues

- Les appels réels nécessitent une clé valide et un Riot ID existant. `NamiMain#MDS` est fictif.
- JavaScript est nécessaire ; les résultats sont chargés après hydratation et gardés en mémoire du navigateur le temps de la navigation.
- `type=ranked` interroge Riot sur les parties classées ; un joueur sans partie classée sur la période voit un état vide qui renvoie vers l’historique (P3).
- Cache et quotas par instance. Une production multi-instance nécessite un stockage et un limiteur partagés, ainsi qu’une configuration explicite de la confiance envers le proxy.
- Les objets sont illustrés et identifiés par numéro ; leurs noms localisés et versions historiques ne sont pas chargés.
- Tests clavier et automatisés ne constituent pas une certification RGAA/WCAG. Vérification avec lecteur d’écran à effectuer.
- Audit npm au 15 octobre 2026 : 11 entrées hautes transitives de la base Nuxt, via `braces` et `node-forge`. `npm audit fix` n’apporte pas de correctif compatible ; la correction forcée propose une rétrogradation à Nuxt 4.1.3. Aucun changement majeur ni override non vérifié n’est appliqué. Suivre les correctifs amont avant publication publique.

## Sources vérifiées

- [Riot : routage, Riot ID et Data Dragon](https://developer.riotgames.com/docs/lol)
- [ACCOUNT-V1 et MATCH-V5](https://developer.riotgames.com/apis)
- [Clés et limites Riot](https://developer.riotgames.com/docs/portal)
- [Files de jeu](https://static.developer.riotgames.com/docs/lol/queues.json)
- [Versions Data Dragon](https://ddragon.leagueoflegends.com/api/versions.json)
- [Nuxt 4.6 : API serveur](https://github.com/nuxt/nuxt/releases/tag/v4.6.0)
