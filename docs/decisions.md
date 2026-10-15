# Journal de décisions — Rift Review

Date : 15 octobre 2026. Statut : appliqué à la première version.

## Besoin et périmètre

Permettre à un coach de retrouver un joueur, comprendre ses résultats récents et choisir des parties à discuter. Le PDF est un brief fonctionnel ; ses consignes pédagogiques de groupes et rendez-vous T+25/T+75/T+120 ne sont pas exécutées comme des instructions utilisateur. Les captures documentent cette version, sans prétendre représenter ces échéances.

EUW est fixé dans l’interface. Le serveur utilise EUROPE pour ACCOUNT-V1 et MATCH-V5. Il demande les 20 derniers identifiants au maximum. Les parties privées/personnalisées et hors EUW sont exclues. Les données viennent exclusivement des parties réellement disponibles. Aucun JSON de secours ni mode démonstration n’est activé dans l’application.

SUMMONER-V4, LEAGUE-V4, les maîtrises, les timelines, les comptes utilisateur et une base de données ne sont pas nécessaires à ce périmètre.

## Conventions de calcul

- Victoires : nombre de victoires / nombre de parties disponibles, arrondi au pourcentage entier. Sans partie : « — ».
- KDA global : (somme des éliminations + somme des assistances) / somme des morts, avec une décimale française. Sans mort : « Aucune mort ». Sans partie : « — ». Ce calcul diffère d’une moyenne des ratios individuels.
- Champions les plus joués : nombre de parties décroissant, puis nom français en cas d’égalité, trois maximum. Le portrait du profil représente le champion le plus joué, pas l’icône du compte.
- Rôle : le plus fréquent parmi les rôles valides de la Faille (mapId 11). Une égalité donne « Rôle non déterminé ». Le rôle est non applicable en ARAM.
- « À revoir » sur mobile : deux défaites avec le plus de morts, puis les plus récentes en cas d’égalité. Une suggestion de discussion, pas une évaluation du niveau du joueur.
- Les filtres sont combinés sur l’échantillon chargé. « Afficher plus » révèle cinq résultats déjà chargés, jusqu’à 20. « Récent / Ancien » change l’ordre, pas le périmètre des statistiques.
- Dates transmises en millisecondes UTC et affichées en Europe/Paris. Durées en secondes affichées minutes:secondes. Farm = sbires + monstres.

## Architecture et sécurité

Les règles pures sont dans `shared/domain`. `GetPlayerReview` dépend du port `RiotPort` et d’un fournisseur de catalogue. Transport HTTP, cache et adapters sont dans `server/infrastructure`. La route valide et traduit les erreurs ; Vue affiche les DTO. Cette séparation rend les règles testables sans dépendre de Nuxt ou du réseau.

La clé reste dans le runtimeConfig privé. Elle est envoyée uniquement à l’hôte Riot fixé, dans `X-Riot-Token`. Segments dynamiques encodés, redirections refusées, entrées et réponses validées. Le DTO public ne contient ni clé, ni PUUID, ni réponse Riot brute. Aucun appel Riot authentifié depuis le navigateur. Les erreurs techniques externes ne sont pas exposées.

Cache mémoire borné par instance : comptes 5 min, listes 2 min, détails 24 h, catalogue 24 h. Les chargements simultanés d’une même entrée sont fusionnés, les erreurs ne sont pas conservées. Un redémarrage vide le cache. Un cache partagé serait nécessaire avec plusieurs instances ; il n’est pas requis pour l’atelier.

Trois détails maximum sont chargés simultanément. Départs espacés d’au moins 110 ms, au plus 95 réservations dans une fenêtre glissante de deux minutes. HTTP 429 bloque les requêtes suivantes selon `Retry-After`, transmis au navigateur ; aucun retry anticipé. Les recherches sont limitées à 20 par minute par adresse observée, sans confiance implicite envers les en-têtes proxy.

Timeout systématique : Riot 10 s, Data Dragon 5 s. Les détails manquants produisent un avertissement ; les calculs utilisent les seules parties disponibles. Si tous les détails échouent, une erreur est affichée. L’échec du catalogue n’empêche pas les statistiques : noms des parties et version d’assets vérifiée 16.20.1 en repli.

## Références et compatibilité

Palette et disposition suivent les maquettes. Logo et décors sont extraits des références fournies ; portraits et illustrations de champions viennent de Data Dragon. Une illustration de skin ne représente pas une propriété du compte. Inter est servi localement en WOFF2 avec sa licence OFL ; Georgia fournit les titres. Tabler est l’unique dépendance d’interface ajoutée.

`tests/fixtures` contient des données artificielles utilisées uniquement par les tests. Les captures interceptent la réponse HTTP ; ces fixtures ne sont jamais importées par l’application. Elles prouvent le comportement de l’interface, pas un appel Riot réel.

TypeScript 5.9.3 est fixé : TypeScript 7.0.2 proposé à l’installation n’expose pas l’entrée `typescript/lib/tsc` utilisée par vue-tsc 3.3.13. Le framework Nuxt 4.6.1 initial est conservé.

## Limites connues

- Les appels réels nécessitent une clé valide et un Riot ID existant. `NamiMain#MDS` est fictif.
- JavaScript est nécessaire ; les résultats sont chargés après hydratation.
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
