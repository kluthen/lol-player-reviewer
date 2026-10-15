# API Riot Games pour Rift Review

*Récupérer un joueur et ses dernières parties*

Cette fiche explique comment alimenter le profil, les statistiques et l’historique de tes maquettes League of Legends. Le projet est limité à 20 parties, mises en cache sur le serveur.

## La bonne documentation

Utilise [developer.riotgames.com](https://developer.riotgames.com/). Les liens api.riot-os.org concernent un système d’exploitation pour objets connectés, sans rapport avec League of Legends.

## Les trois appels à enchaîner

Un endpoint est une adresse de l’API. GET signifie que l’on demande des données. Pour un joueur sur EUW, les trois appels suivants utilisent cet hôte :

```text
https://europe.api.riotgames.com
```

### 1 Retrouver le joueur

```http
GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
```

Exemple fictif : `NamiMain#MDS` devient `gameName = NamiMain` et `tagLine = MDS`. La réponse contient le `puuid`, l’identifiant technique à utiliser ensuite. Encode les valeurs dans l’URL.

### 2 Obtenir les identifiants des parties

```http
GET /lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=20
```

Remplace `{puuid}` par la valeur reçue. La réponse est une liste de `matchId`. `start=0` commence au début ; `count=20` demande jusqu’à 20 parties.

### 3 Obtenir les détails de chaque partie

```http
GET /lol/match/v5/matches/{matchId}
```

Répète cet appel pour chaque `matchId` reçu. Dans `info.participants`, sélectionne le participant dont le `puuid` correspond au joueur recherché. Tu récupères alors son champion et ses statistiques.

## La clé reste sur le serveur

Le navigateur appelle ton serveur ; ton serveur appelle Riot. Ajoute la clé fournie par le formateur à chaque requête Riot dans cet en-tête :

```http
X-Riot-Token: <clé API>
```

Ne place jamais cette clé dans le JavaScript envoyé au navigateur ni dans un dépôt Git.

## Alimenter les écrans

Les champs ci-dessous viennent du détail de partie, sauf le pseudo et le tag qui viennent du compte Riot. Les statistiques de synthèse sont calculées par ton application sur les parties chargées et retenues.

| À afficher | Donnée ou calcul |
| --- | --- |
| Pseudo et tag | `gameName` et `tagLine` du compte Riot |
| Champion | `championId` et `championName` du participant |
| Victoire ou défaite | `win` : `true` = victoire ; `false` = défaite |
| Score 4 / 2 / 18 | `kills` / `deaths` / `assists` : éliminations, morts, assistances |
| Date et durée | `info.gameStartTimestamp` ; `info.gameDuration` en secondes pour les parties récentes |
| Mode de jeu | `info.queueId` : `420` = Solo/Duo ; `440` = Flex ; `450` = ARAM |
| Rôle | `teamPosition` : `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY`. `UTILITY` = support ; rôle non applicable en ARAM. |
| Champions les plus joués | Regrouper par `championId` et compter les parties |

## Calculer la synthèse

Taux de victoire : victoires ÷ parties retenues × 100. Exemple : 12 victoires sur 20 parties donnent 60 %. Affiche le nombre de parties utilisé.

KDA global proposé : (total des éliminations + total des assistances) ÷ total des morts. Exemple : (40 + 150) ÷ 50 = 3,8. Si le total des morts est nul, affiche « Aucune mort ».

Sans partie disponible, affiche « Aucune partie » et aucune moyenne. Les filtres de mode, rôle et résultat s’appliquent aux 20 parties chargées. « Afficher plus » dévoile ces résultats sans dépasser 20.

## Images et informations supplémentaires

Data Dragon fournit les portraits de champions et les images d’objets, sans clé API. Exemple de portrait :

```text
https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/Nami.png
```

MATCH-V5 fournit aussi dégâts, or, objets et vision. SUMMONER-V4 peut ajouter le niveau du compte et son icône, via `euw1.api.riotgames.com` pour EUW.

## Prévoir les erreurs et le cache

Conserve les parties en cache par région et `matchId`. Prévois un joueur introuvable, un historique vide, un chargement partiel et une clé refusée. Sur une erreur `429`, attends le délai `Retry-After` avant de réessayer. Sans cache, 20 parties représentent 22 appels pour le parcours minimal.

## Références officielles

- [Référence des endpoints ACCOUNT-V1 et MATCH-V5](https://developer.riotgames.com/apis)
- [Documentation League of Legends et Data Dragon](https://developer.riotgames.com/docs/lol)
- [Clés API et gestion des erreurs](https://developer.riotgames.com/docs/portal)
