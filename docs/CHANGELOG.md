<!-- Outil musique OneClient — journal des changements — v2.4 — 2026-11-11 -->
# Journal des changements

Les versions antérieures (v1 à v2.3) sont décrites dans le journal tenu dans le projet « Oneclient - Articles » ; elles ne sont pas reprises ici.

| Version | Date | Fichiers à envoyer | Changements |
| --- | --- | --- | --- |
| v2.4 | 2026-11-11 | `page.html` (obligatoire : le comportement change). `index.php` et `stats.php` : seulement le commentaire de version, à envoyer pour garder les versions alignées. | **Simplification, sans changer les résultats.** Une seule question (quatre façons d'acheter) au lieu de trois ; la stratégie choisie est mise en évidence dans les cartes, le tableau, le graphique et l'image à partager. « Hypothèses et limites » : 8 points au lieu d'une vingtaine. Code mort retiré (moments, momentOf, buildModel, startBoost, autoShare, cardMsg, 10 familles de styles). Corrections : « au moins 12 mois » (texte d'aide) ; « Dans les 1 000 simulations… » ; graphique sur 1 000 trajectoires (le dernier point égale le tableau : 606 €) ; fichier dont toutes les écoutes durent moins de 30 s : message et résultats masqués ; export standard de Spotify reconnu ; abonnement coché sans prix : message sous la ligne, et message si aucun prix ; forme « par vagues » choisie à la main : la moyenne du rythme est conservée (566 € → 605 €, contre 606 € en rythme constant) ; `role="alert"` sur les messages ; pied de page sans « premier service de streaming en Europe » ; commentaire sur l'adresse IP corrigé. |

## Contrôle des chiffres (exemple par défaut, titre 1,29 €, album 10,99 €, abonnement 11,99 €, 12 mois, seuil 5)
96 favoris, 60,3 % de l'écoute, 124 € pour les acheter. Valeur du milieu sur 5 ans : favoris puis rien 124 € ; la moitié des nouveaux 365 € ; chaque nouveau favori 606 € (404 à 805 €) ; petit à petit 604 € (404 à 697 €). Identique à la v2.3 pour les quatre stratégies, avec le modèle fondé sur les mois mesurés et avec celui du profil type.

## Décisions
- Une seule question : on choisit une des quatre stratégies du tableau (par défaut : la moitié des nouveaux). Plus de position « écouter de tout », plus de message de contradiction, plus de fusion de lignes identiques dans le tableau.
- La simulation (1 000 simulations, 60 mois, fourchette à 95 %) est conservée. Seule modification : la fourchette du graphique utilise les 1 000 trajectoires.
- Réglages avancés et exemple fictif conservés tels quels.
- Non fait, volontairement : intégration des données Apple (annulée le 6/11/2026), version néerlandaise, refonte graphique.

## À savoir
L'exemple affiché par la page (profil type) donne 356 € / 588 € pour « la moitié » / « chaque nouveau favori », car il utilise les valeurs de son profil. Le même historique chargé comme fichier donne 365 € / 606 €.
