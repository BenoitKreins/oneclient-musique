# oneclient-musique

Outil gratuit de [OneClient](https://oneclient.be/) : **acheter sa musique ou s'abonner ?**
À partir de l'historique d'écoute Spotify (export « historique de streaming étendu »), l'outil calcule ce que chaque choix coûterait sur 5 ans, avec une fourchette à 95 %.

Page en ligne : <https://oneclient.be/outils/musique/>

## Vie privée

Le fichier de l'utilisateur est lu par son navigateur. Rien n'est envoyé, rien n'est conservé. La page interdit toute connexion sortante (voir `php/index.php`). Le serveur compte seulement les visites par jour, sans adresse IP.

**Ce dépôt ne contient aucune donnée d'écoute réelle.** Les tests utilisent un historique fictif généré par `genHistory()` (`src/engine.js`). Le compteur de visites du serveur (`donnees/`) est exclu par `.gitignore`.

## Organisation

| Dossier | Contenu |
| --- | --- |
| `src/engine.js` | Le moteur : lecture de l'export, constat, rythme, simulation (1 000 simulations, 60 mois). Fonctions pures. |
| `src/ui.js` | La page : textes, graphiques, image à partager. |
| `src/template.html` | Le gabarit HTML et les styles. |
| `src/unzip.js`, `src/fonts.css` | Décompression du .zip dans le navigateur ; polices incluses. |
| `src/VERSION` | Version et date, reprises dans chaque fichier construit. |
| `php/` | `index.php` (en-têtes de sécurité, compteur) et `stats.php` (visites, réservé aux administrateurs WordPress). |
| `tests/` | Contrôle du moteur et tests de l'interface, sur données fictives. |
| `docs/CHANGELOG.md` | Journal des changements. |

## Construire

```
python3 build.py              # dist/page.html
python3 build.py --release    # dist/musique-vX.Y-AAAA-MM-JJ/ : page, index, stats nommés application-fichier-version-date, plus le .zip
```

## Tester

```
node tests/engine-check.mjs   # chiffres de référence du moteur (aucune dépendance)
npm install && python3 build.py && node tests/ui-fictif.cjs   # interface, avec Playwright
```

Variable facultative : `CHROMIUM_PATH` pour utiliser un navigateur précis.

## Règles de version

Chaque version porte un numéro et une date, écrits dans `src/VERSION` et dans la première ligne de chaque fichier. Toute modification des chiffres de `tests/engine-check.mjs` change le calcul : elle doit être justifiée dans `docs/CHANGELOG.md`.
