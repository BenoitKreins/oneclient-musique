<?php
// Outil musique OneClient v2.4 du 2026-11-11
// Page privée des visites, réservée aux administrateurs du WordPress de oneclient.be.
// Ouvrez https://oneclient.be/outils/musique/stats.php : si vous n'êtes pas connecté, WordPress demande votre identifiant,
// puis vous ramène ici. Aucune clé à retenir ni à mettre dans l'adresse.
// Attention : WordPress utilise des variables globales ($wp, $post…). Ce fichier n'en crée aucune : tout le reste est dans une fonction.
$oneclient_wp_load = dirname(__DIR__, 2) . '/wp-load.php'; // public_html/wp-load.php (WordPress installé à la racine du site)
if (!is_file($oneclient_wp_load)) { http_response_code(404); exit('Page introuvable.'); }
require_once $oneclient_wp_load;
unset($oneclient_wp_load);
if (!is_user_logged_in()) { auth_redirect(); exit; }                       // vers la page de connexion WordPress
if (!current_user_can('manage_options')) { http_response_code(404); exit('Page introuvable.'); } // connecté mais pas administrateur
nocache_headers();
oneclient_musique_stats();

function oneclient_musique_stats() {
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex');
$compte = [];
$fichier = __DIR__ . '/donnees/visites.csv';
if (is_file($fichier)) foreach (file($fichier, FILE_IGNORE_NEW_LINES) as $l) { [$d, $n] = array_pad(explode(';', $l), 2, 0); if ($d !== 'date' && $d !== '') $compte[$d] = (int)$n; }
krsort($compte);
$total = array_sum($compte);
$mois = [];
foreach ($compte as $d => $n) { $m = substr($d, 0, 7); $mois[$m] = ($mois[$m] ?? 0) + $n; }
$h = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?><!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Visites de l'outil musique</title>
<style>body{font-family:system-ui,sans-serif;margin:0;padding:24px 16px;background:#F3F5F4;color:#15201D}main{max-width:520px;margin:0 auto}h1{font-size:22px}table{border-collapse:collapse;width:100%;background:#fff;margin-bottom:24px}th,td{padding:7px 10px;border-bottom:1px solid #D6DDDA;text-align:left;font-variant-numeric:tabular-nums}td:last-child,th:last-child{text-align:right}.big{font-size:32px;font-weight:700}</style></head>
<body><main><h1>Visites de l'outil musique</h1>
<p><span class="big"><?= $h($total) ?></span> visites depuis la mise en ligne.</p>
<h2>Par mois</h2><table><tr><th>Mois</th><th>Visites</th></tr><?php foreach ($mois as $m => $n): ?><tr><td><?= $h($m) ?></td><td><?= $h($n) ?></td></tr><?php endforeach; ?></table>
<h2>Par jour (60 derniers)</h2><table><tr><th>Jour</th><th>Visites</th></tr><?php foreach (array_slice($compte, 0, 60, true) as $d => $n): ?><tr><td><?= $h($d) ?></td><td><?= $h($n) ?></td></tr><?php endforeach; ?></table>
<p>Comptage côté serveur : ni adresse IP, ni cookie. Les robots connus sont exclus.</p></main></body></html>
<?php }
