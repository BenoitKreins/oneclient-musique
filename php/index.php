<?php
// Outil musique OneClient v2.4 du 2026-11-11
// Compteur de visites, côté serveur uniquement.
// N'enregistre que la date et un nombre : ni adresse IP, ni cookie, rien sur l'appareil du visiteur.
$fichier = __DIR__ . '/donnees/visites.csv';
$agent = $_SERVER['HTTP_USER_AGENT'] ?? '';
$robot = $agent === '' || preg_match('/bot|crawl|spider|slurp|preview|monitor|curl|wget|python|headless/i', $agent);
if (!$robot) {
  $jour = date('Y-m-d');
  $f = @fopen($fichier, 'c+');
  if ($f && flock($f, LOCK_EX)) {
    $lignes = array_filter(explode("\n", stream_get_contents($f)));
    $compte = [];
    foreach ($lignes as $l) { [$d, $n] = array_pad(explode(';', $l), 2, 0); if ($d !== 'date') $compte[$d] = (int)$n; }
    $compte[$jour] = ($compte[$jour] ?? 0) + 1;
    ksort($compte);
    $sortie = "date;visites\n";
    foreach ($compte as $d => $n) $sortie .= "$d;$n\n";
    ftruncate($f, 0); rewind($f); fwrite($f, $sortie); fflush($f);
    flock($f, LOCK_UN);
  }
  if ($f) fclose($f);
}
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
// Sécurité : le navigateur n'a le droit d'ouvrir aucune connexion depuis cette page.
// Le fichier du visiteur ne peut donc partir nulle part, même par erreur ou si un script étranger s'y glissait.
header("Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'");
// Les autres pages de oneclient.be savent qu'on vient de l'outil ; les autres sites ne reçoivent rien.
header('Referrer-Policy: same-origin');
header('X-Content-Type-Options: nosniff');
readfile(__DIR__ . '/page.html');
