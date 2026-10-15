# Vérification visuelle — Rift Review

Date : 15 octobre 2026. Branche locale : `feat/rift-review`.

## Références et preuves

Sources : `01-profil-joueur.png`, `02-historique-parties.png`, `03-version-mobile.png`, identiques aux maquettes jointes. Dimensions originales : 1586 × 992 pour les deux écrans desktop, 941 × 1672 pour le mobile.

Captures Chrome réellement rendu, via Playwright, sur `http://127.0.0.1:3000` :

- [Profil desktop](docs/screenshots/profile-desktop.png) : viewport CSS 1280 × 800, capture complète 1280 × 882.
- [Historique desktop](docs/screenshots/history-desktop.png) : viewport CSS 1280 × 800, capture complète 1280 × 997.
- [Profil mobile](docs/screenshots/profile-mobile.png) : viewport CSS 577 × 1024, capture complète 577 × 1135.
- [Accueil](docs/screenshots/welcome.png) : état sans recherche.

Densité : deviceScaleFactor 1. Pour les comparaisons, références redimensionnées respectivement à 1280 × 800 et 577 × 1024 ; captures recadrées au viewport sans modifier l’échelle. Référence à gauche, application à droite : [profil](docs/screenshots/comparisons/profile.jpg), [historique](docs/screenshots/comparisons/history.jpg), [mobile](docs/screenshots/comparisons/mobile.jpg). La [comparaison détaillée des statistiques et des cartes](docs/screenshots/comparisons/profile-detail.jpg) a également été ouverte.

État : joueur de test `NamiMain#MDS`, profil général et historique sans filtre, ordre récent, menu et dialogue fermés. Les fixtures HTTP simulent dix parties pour contrôler les calculs ; aucune donnée fictive n’est injectée dans l’application réelle. Différences de contenu connues : cinquième ligne d’historique affichée dès le départ, tri calculé des champions, deux défaites sélectionnées selon la règle documentée. La comparaison juge la structure et le rendu sans prétendre que ces contenus sont identiques à la maquette.

## Surfaces contrôlées

- **Typographie** : titres à empattements Georgia, marque desktop Times New Roman, interface Inter locale WOFF2. Police réellement chargée vérifiée dans Chrome. Tailles et lisibilité mobile revues après une première comparaison.
- **Disposition** : en-tête, bannière, identité, trois indicateurs, deux panneaux desktop, filtres et lignes d’historique, deux cartes mobiles et bouton vers l’historique. Vérification sans débordement à 320, 390, 577, 768, 1024 et 1280 px. Les mentions de périmètre/calcul ajoutent de la hauteur et déplacent le footer ; les actions principales restent visibles et accessibles.
- **Couleurs** : fond bleu nuit, panneaux discrets, bordures bleues, turquoise pour les victoires et actions, rouge pour les défaites, or pour la marque et les accents. Contrastes vérifiés automatiquement avec axe.
- **Images** : logo et décors extraits des références ; portraits réels de Data Dragon, donc différents des illustrations interprétées des maquettes. Aucun remplacement des illustrations par des formes CSS ou des pictogrammes fictifs. Images chargées sans erreur, état de repli prévu si le CDN échoue. Les icônes Tabler remplacent les pictogrammes des maquettes.
- **Textes** : « Champions les plus joués » décrit le calcul réel ; « Non applicable » pour l’ARAM. Périmètre de l’échantillon, convention KDA et règle « À revoir » explicités. Les scores, listes et taux proviennent des données reçues.

## Historique des corrections

1. **P1 — Recherche au premier chargement** : une saisie avant la fin de l’hydratation pouvait être perdue. Champs activés après montage ; test complet depuis l’accueil passé ensuite.
2. **P2 — Hiérarchie mobile** : ordre visuel des indicateurs et texte des cartes trop petits à la première capture. Ordre 60 % / parties / KDA corrigé ; tailles et boutons augmentés, alignement des parties corrigé. Comparaison finale mobile ouverte après correction.
3. **P2 — Débordement tablette de l’historique** : le décor dépassait de 11 px à 768 px. Inset adapté au breakpoint ; régression couverte par un test navigateur, désormais passé.
4. **P2 — Images d’historique** : les illustrations complètes rendaient les champions trop petits dans les bandeaux. Portraits recadrés utilisés ; comparaison finale de l’historique contrôlée.
5. **P2 — Décor mobile** : le premier recadrage montrait du texte décoratif tronqué. Recadrage resserré, nouvelle capture et comparaison ouverte ; ce texte n’apparaît plus.

## Interactions et accessibilité

Huit tests navigateur passent : recherche depuis l’accueil ; profil vers historique ; filtres combinés, réinitialisation et absence de résultat ; affichage progressif ; détails et retour du focus après Échap ; menu mobile ; données absentes/partielles ; 429 avec délai ; validation HTTP ; captures ; absence de débordement aux breakpoints.

Analyse axe WCAG 2 A/AA et 2.1 AA : aucune violation détectée sur accueil, profil, historique, dialogue et mobile. Navigation clavier vérifiée sur le parcours de détails. Aucun message d’erreur console, aucune exception de page ni image échouée pendant l’inspection des six largeurs. Cette vérification ne remplace pas un audit manuel RGAA ou un essai avec lecteur d’écran.

## Écarts acceptés et suivi

- Les assets Data Dragon, le tri et les valeurs calculées ne reproduisent pas les données fictives dessinées.
- Les notes de calcul/périmètre, la durée de partie et le disclaimer augmentent la hauteur des pages. L’historique commence à cinq lignes, conformément à la pagination choisie.
- P3 : affiner éventuellement le dessin des icônes et la texture des panneaux ; aucun blocage d’usage relevé.
- La vérification réelle de Riot attend une clé valide dans `.env`. Les tests HTTP simulés ne prouvent pas sa validité ni l’accès réseau Riot de la future installation.

## Contrôles terminés

- [x] Sources et captures ouvertes ensemble, aux dimensions normalisées.
- [x] Comparaisons générales et région détaillée examinées.
- [x] Corrections P1/P2 vérifiées par nouvelles captures ou tests.
- [x] Clavier, responsive, erreurs et accessibilité automatisée contrôlés.
- [x] Build, typage strict, 24 tests unitaires et vérification de formatage passés.

final result: passed
