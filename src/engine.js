/* Outil musique OneClient — engine.js — v2.4 — 2026-11-11 */
/* ===== Moteur v2 : fonctions pures, testables sans navigateur ===== */
const DAY = 864e5, WEEK = 7 * DAY;
const ENGINE_DEFAULTS = {
  minPlays: 5,        // écoutes pour un favori
  minWeeks: 1,        // semaines différentes pour un favori (1 = pas de critère de régularité)
  favWindow: 60,      // jours pour qu'un nouveau titre devienne favori
  silentPlays: 3,     // une semaine avec moins de 3 écoutes est « silencieuse »
  departWeeks: 13,    // 13 semaines silencieuses d'affilée = départ
  pauseRatio: 0.25,   // une semaine sous 25 % du niveau habituel = pause
  startWeeks: 8,      // les 8 premières semaines d'une période = démarrage
  minRegular: 6,      // mois réguliers nécessaires pour reconnaître une forme
  horizon: 60,        // mois simulés
  runs: 1000,         // nombre de simulations
  block: 3,           // longueur des suites de mois tirées
  defaultRenewal: 0.9 // renouvellement supposé quand le fichier ne permet pas de le mesurer
};

function norm(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, " "); }
function keyOf(artist, track) { return norm(artist) + "\u0000" + norm(track); }
function monthIdx(t) { const d = new Date(t); return d.getUTCFullYear() * 12 + d.getUTCMonth(); }
function monthStart(m) { return Date.UTC(Math.floor(m / 12), m % 12, 1); }
function weekIdx(t) { return Math.floor((t + 3 * DAY) / WEEK); } // semaines du lundi au dimanche
const T95 = [NaN, 12.71, 4.30, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23, 2.20, 2.18, 2.16, 2.14, 2.13, 2.12, 2.11, 2.10, 2.09, 2.09];
function t95(df) { return df <= 0 ? NaN : df < T95.length ? T95[df] : 1.96 + 2.4 / df; }
function mulberry(seed) { let s = seed >>> 0; return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* Tirage d'un nombre d'événements rares (loi de Poisson). */
function poisson(lambda, rnd) {
  if (!(lambda > 0)) return 0;
  if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd())));
  const L = Math.exp(-lambda); let k = 0, q = 1; do { k++; q *= rnd(); } while (q > L); return k - 1;
}

/* Moyenne, écart type et marge d'erreur à 95 % (loi de Student). */
function meanCI(values) {
  const n = values.length;
  if (!n) return { n: 0, mean: null, sd: null, moe: null, low: null, high: null, fragile: true };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  const moe = sd === null ? null : t95(n - 1) * sd / Math.sqrt(n);
  return { n, mean, sd, moe, low: moe === null ? null : Math.max(0, mean - moe), high: moe === null ? null : mean + moe,
    fragile: n < ENGINE_DEFAULTS.minRegular || moe === null || (mean > 0 && moe >= mean * 0.5) };
}

/* Prépare les écoutes valides (30 s et plus), triées, avec la liste des dates par titre. */
function prepare(streams) {
  const valid = streams.filter(s => s.ms === undefined || s.ms >= 30000).sort((a, b) => a.t - b.t);
  const times = new Map(), info = new Map(), firstOf = new Map();
  for (const s of valid) {
    let tl = times.get(s.key); if (!tl) { tl = []; times.set(s.key, tl); firstOf.set(s.key, s); } tl.push(s.t);
    let i = info.get(s.key); if (!i) { info.set(s.key, { track: s.track, artist: s.artist, album: s.album }); } else if (!i.album && s.album) i.album = s.album;
  }
  return { valid, times, info, firstOf, first: valid.length ? valid[0].t : null, last: valid.length ? valid[valid.length - 1].t : null };
}

/* Partie 1 : le constat, exact, sur la période choisie. */
function constat(prep, p) {
  const { valid, info } = prep;
  if (!valid.length) return null;
  const last = prep.last;
  const from = p.period === "all" ? prep.first : Math.max(prep.first, last - (p.period === "6" ? 182 : 365) * DAY);
  const counts = new Map(), weeks = new Map();
  let plays = 0, video = 0, ms = 0;
  for (const s of valid) {
    if (s.t < from) continue;
    plays++; ms += s.ms || 0; if (s.video) video++;
    counts.set(s.key, (counts.get(s.key) || 0) + 1);
    if (p.minWeeks > 1) { let w = weeks.get(s.key); if (!w) { w = new Set(); weeks.set(s.key, w); } w.add(weekIdx(s.t)); }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const favs = ranked.filter(([k, c]) => c >= p.minPlays && (p.minWeeks <= 1 || weeks.get(k).size >= p.minWeeks));
  const favPlays = favs.reduce((s, [, c]) => s + c, 0);
  const costOf = keys => {
    const groups = new Map(); let noAlbum = 0;
    for (const k of keys) { const i = info.get(k); if (i.album) { const g = norm(i.artist) + "\u0000" + norm(i.album); groups.set(g, (groups.get(g) || 0) + 1); } else noAlbum++; }
    let cost = noAlbum * p.track, albums = 0, tracks = noAlbum, inAlbums = 0;
    for (const n of groups.values()) { if (p.album > 0 && n * p.track > p.album) { cost += p.album; albums++; inAlbums += n; } else { cost += n * p.track; tracks += n; } }
    return { cost, albums, tracks, inAlbums };
  };
  const months = (last - from) / (30.4375 * DAY);
  return {
    from, to: last, months, plays, video, hours: ms / 3.6e6, distinct: counts.size,
    favCount: favs.length, favShare: plays ? favPlays / plays : 0, favKeys: favs.map(([k]) => k), favCounts: favs.map(([, c]) => c),
    all: costOf(ranked.map(([k]) => k)), fav: costOf(favs.map(([k]) => k)),
    rankedCounts: ranked.map(([, c]) => c),
    top: ranked.slice(0, 5).map(([k, c]) => ({ ...info.get(k), plays: c }))
  };
}

/* Semaines et périodes : silence, départ, retour, pause, démarrage. */
function periods(prep, p) {
  const { valid } = prep;
  const w0 = weekIdx(prep.first), w1 = weekIdx(prep.last);
  const W = []; for (let w = w0; w <= w1; w++) W.push({ w, plays: 0 });
  for (const s of valid) W[weekIdx(s.t) - w0].plays++;
  // départs : au moins 13 semaines silencieuses d'affilée ; la période en cours commence au dernier retour
  let run = 0, periodStart = w0, departures = [];
  for (const x of W) {
    if (x.plays < p.silentPlays) { run++; continue; }
    if (run >= p.departWeeks) { departures.push({ from: x.w - run, to: x.w - 1 }); periodStart = x.w; }
    run = 0;
  }
  const cur = W.filter(x => x.w >= periodStart);
  const active = cur.filter(x => x.plays >= p.silentPlays).map(x => x.plays).sort((a, b) => a - b);
  const level = active.length ? active[Math.floor(active.length / 2)] : 0; // écoutes d'une semaine habituelle
  for (const x of W) {
    if (x.w < periodStart) { x.phase = "avant"; continue; }
    x.phase = x.w - periodStart < p.startWeeks ? "démarrage" : x.plays < p.pauseRatio * level ? "pause" : "régulier";
  }
  const weekStart = w => w * WEEK - 3 * DAY;
  const firstListen = (valid.find(s => s.t >= weekStart(periodStart)) || valid[0]).t;
  return { weeks: W, periodStart: weekStart(periodStart), firstListen, level, departures: departures.map(d => ({ from: weekStart(d.from), to: weekStart(d.to + 1) })), returned: departures.length > 0 };
}

/* Série mois par mois de la période en cours, nouveaux favoris (fenêtre de 60 jours) et rythme. */
function monthly(prep, per, p) {
  const { valid, times } = prep;
  const m0 = monthIdx(per.periodStart), m1 = monthIdx(prep.last);
  const M = []; for (let m = m0; m <= m1; m++) M.push({ m, start: monthStart(m), end: monthStart(m + 1), plays: 0, newTitles: 0, newFavs: 0, pauseWeeks: 0, startWeeks: 0, weeks: 0 });
  for (const s of valid) if (s.t >= per.periodStart) { const i = monthIdx(s.t) - m0; if (M[i]) M[i].plays++; }
  for (const tl of times.values()) {
    const f = tl[0]; // première écoute de tout l'historique : un titre connu avant un départ n'est pas nouveau
    if (f < per.periodStart) continue;
    const i = monthIdx(f) - m0; M[i].newTitles++;
    let n = 0; const wk = new Set();
    for (const t of tl) { if (t > f + p.favWindow * DAY) break; n++; wk.add(weekIdx(t)); }
    if (n >= p.minPlays && wk.size >= p.minWeeks) M[i].newFavs++;
  }
  for (const x of per.weeks) {
    if (x.phase === "avant") continue;
    const t = x.w * WEEK - 3 * DAY + 3.5 * DAY, i = monthIdx(t) - m0; if (!M[i]) continue;
    M[i].weeks++; if (x.phase === "pause") M[i].pauseWeeks++; if (x.phase === "démarrage") M[i].startWeeks++;
  }
  for (const x of M) {
    x.recent = x.end + p.favWindow * DAY > prep.last; // la fenêtre de 60 jours n'est pas terminée
    x.phase = x.startWeeks > 0 ? "démarrage" : x.weeks && x.pauseWeeks * 2 >= x.weeks ? "pause" : "régulier";
  }
  // Le démarrage déborde souvent : on le prolonge tant qu'un mois compte nettement plus de nouveaux favoris que la suite.
  const later = M.filter(x => x.phase === "régulier" && !x.recent).map(x => x.newFavs).sort((a, b) => a - b);
  const med = later.length ? later[Math.floor(later.length / 2)] : 0;
  for (const x of M) { if (x.phase === "démarrage" || x.plays === 0) continue; if (x.phase === "régulier" && !x.recent && x.newFavs > 2 * med + 2) x.phase = "démarrage"; else break; }
  const reg = M.filter(x => x.phase === "régulier" && !x.recent);
  // Les pauses font partie de la façon d'écouter : elles restent dans le rythme moyen et dans les tirages.
  const pool = M.filter(x => x.phase !== "démarrage" && !x.recent);
  return { months: M, regular: reg, pool, rhythm: meanCI(pool.map(x => x.newFavs)), rhythmActive: meanCI(reg.map(x => x.newFavs)), pauses: pool.length - reg.length };
}

/* Forme : départ (prudent, connu, grand saut) et croisière (constante, saturation, dents de scie). */
function shape(mon, p) {
  const r = mon.rhythmActive;
  const startM = mon.months.filter(x => x.phase === "démarrage" && !x.recent);
  const startMean = startM.length ? startM.reduce((a, x) => a + x.newFavs, 0) / startM.length : null;
  let start = null, ratio = null;
  if (startMean !== null && r.n) {
    ratio = startMean / Math.max(r.mean, 0.5);
    start = ratio < 1.5 ? "prudent" : ratio < 4 ? "connu" : "grandSaut"; // seuils conventionnels
  }
  if (r.n < p.minRegular) return { start, ratio, cruise: null, known: false, level: r.mean, decay: 1 };
  const ys = mon.regular.map(x => x.newFavs), xs = ys.map((_, i) => i), n = ys.length;
  const mx = (n - 1) / 2, my = r.mean;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const firstFit = my - slope * mx, lastFit = my + slope * mx;
  const trend = my > 0 ? (lastFit - firstFit) / my : 0;
  const cv = my > 0 ? r.sd / my : 0;
  let cruise, level = my, decay = 1;
  if (my === 0 || trend <= -0.5) {
    // saturation : on part du niveau des 6 derniers mois, et de la baisse mesurée entre le premier et le dernier tiers
    cruise = "saturation";
    const third = Math.max(2, Math.floor(n / 3)), head = ys.slice(0, third), tail = ys.slice(-third);
    const mh = head.reduce((a, b) => a + b, 0) / head.length, mt = tail.reduce((a, b) => a + b, 0) / tail.length;
    const recent = ys.slice(-6); level = recent.reduce((a, b) => a + b, 0) / recent.length;
    decay = mh > 0 && mt > 0 ? Math.max(0.8, Math.min(1, Math.pow(mt / mh, 1 / Math.max(1, n - third)))) : 0.9;
  } else cruise = my >= 1 && (r.sd * r.sd) / my >= 3 ? "dents" : "constante"; // dents de scie : bien plus variable que le hasard seul
  return { start, ratio, cruise, known: true, level, decay, trend, cv };
}

/* Renouvellement : quelle part de l'écoute de la seconde moitié vos favoris de la première moitié couvrent encore. */
function renewal(prep, per, p) {
  const after = Math.max(per.periodStart + p.startWeeks * WEEK, prep.last - 365 * DAY);
  const plays = prep.valid.filter(s => s.t >= after);
  if (plays.length < 600 || prep.last - after < 150 * DAY) return { r: p.defaultRenewal, measured: false };
  const half = Math.floor(plays.length / 2), A = plays.slice(0, half), B = plays.slice(half);
  const ca = new Map(); for (const s of A) ca.set(s.key, (ca.get(s.key) || 0) + 1);
  const S = new Set([...ca].filter(([, c]) => c >= p.minPlays).map(([k]) => k));
  if (S.size < 5) return { r: p.defaultRenewal, measured: false };
  const covA = A.filter(s => S.has(s.key)).length / A.length, covB = B.filter(s => S.has(s.key)).length / B.length;
  const lag = ((B[0].t + B[B.length - 1].t) / 2 - (A[0].t + A[A.length - 1].t) / 2) / (30.4375 * DAY);
  const rho = covA > 0 ? covB / covA : 1;
  const r = Math.max(0.5, Math.min(1, Math.pow(Math.max(rho, 1e-6), 1 / Math.max(lag, 1))));
  return { r, measured: true, rho, lag, covA, covB };
}

/* Les adresses IP du fichier ne sont jamais lues : l'analyse des lieux a été retirée. */

/* Les quatre stratégies d'achat proposées. follow = part des nouveaux favoris achetés. */
const STRATEGY_FOLLOW = { favs: 0, half: 0.5, every: 1, build: 1 };
function strategy(id, ctx) {
  const { favCounts, subPrice, track } = ctx;
  const F = favCounts.length, build = id === "build";
  const capMonth = Math.max(1, Math.floor(subPrice / track));
  const target = build ? 0 : F; // « petit à petit » : rien au départ
  return { follow: STRATEGY_FOLLOW[id], target, longRun: F, now: target, cap: build ? capMonth : Infinity, capMonth };
}

/* Simulation : 1 000 fois 60 mois.
   - Incertitude sur le rythme : chaque simulation tire d'abord un rythme moyen plausible (rééchantillonnage des mois réguliers).
   - Variations d'un mois à l'autre : les nouveaux favoris sont tirés par suites de mois réels (vagues et creux conservés).
   - Renouvellement : chaque mois avec des nouveaux favoris, les anciens perdent une part (1 - r) de leur place, que les nouveaux prennent.
   - Achats : chaque mois, on achète d'abord les titres qui pèsent le plus dans l'écoute, dans la limite du budget mensuel. */
function simulate(model, strat, ctx, opts = {}) {
  const p = { ...ENGINE_DEFAULTS, ...opts };
  const rnd = mulberry(20261028);
  const { pool, r, D, favCounts, factor, shapeInfo, favCost } = model;
  const H = p.horizon, F = favCounts.length, tot = favCounts.reduce((a, b) => a + b, 0) || 1;
  const w0 = favCounts.map(c => c / tot); // place de chaque favori actuel dans l'écoute des favoris, du plus écouté au moins écouté
  const cum = [0]; for (const w of w0) cum.push(cum[cum.length - 1] + w);
  const poolMean = pool.length ? pool.reduce((a, b) => a + b, 0) / pool.length : 0;
  const costs = [], covAvg = [], covEnd = [], paths = []; let newSum = 0;
  for (let run = 0; run < p.runs; run++) {
    // 1. un rythme moyen plausible pour cette simulation
    let scale = 1;
    if (pool.length > 1 && poolMean > 0) { let s = 0; for (let i = 0; i < pool.length; i++) s += pool[Math.floor(rnd() * pool.length)]; scale = (s / pool.length) / poolMean; }
    // 2. les nouveaux favoris de chaque mois, par suites de mois réels
    const n = [];
    if (pool.length) while (n.length < H) { const i = Math.floor(rnd() * pool.length); for (let k = 0; k < p.block && n.length < H; k++) n.push(pool[(i + k) % pool.length] * scale); }
    else for (let m = 0; m < H; m++) n.push(0);
    for (let m = 0; m < H; m++) {
      let v = n[m] * factor;
      if (shapeInfo && shapeInfo.cruise === "saturation") v = v * (shapeInfo.poolMean > 0 ? shapeInfo.level / shapeInfo.poolMean : 0) * Math.pow(shapeInfo.decay, m + 1);
      n[m] = poisson(v, rnd); // les découvertes arrivent au hasard autour de la moyenne du mois
      newSum += n[m];
    }
    // 3. les achats, mois par mois
    let ownedOld = Math.min(strat.now, F), oldScale = 1, carry = 0;
    const cohorts = []; // nouveaux favoris : { n, w (place de chacun), eligible, owned }
    let cost = ownedOld === F && F > 0 ? favCost : ownedOld * ctx.track, covSum = 0, cov = 0; const path = [cost];
    const wantOld = Math.min(F, strat.longRun);
    for (let m = 0; m < H; m++) {
      const nm = n[m];
      if (nm > 0) {
        oldScale *= r; for (const c of cohorts) c.w *= r;
        let elig = 0; if (!strat.everything && strat.follow > 0) { carry += nm * strat.follow; elig = Math.min(nm, Math.floor(carry)); carry -= elig; }
        cohorts.push({ n: nm, w: (1 - r) / nm, eligible: elig, owned: 0 });
      }
      let budget = strat.cap, bought = 0;
      if (budget === Infinity) { // pas de plafond : tout ce qui est voulu est acheté tout de suite
        bought += wantOld - ownedOld; ownedOld = wantOld;
        for (const c of cohorts) { bought += c.eligible - c.owned; c.owned = c.eligible; }
        budget = 0;
      }
      while (budget > 0) {
        let best = null, bw = -1;
        if (ownedOld < wantOld) { bw = w0[ownedOld] * oldScale; best = "old"; }
        for (const c of cohorts) if (c.owned < c.eligible && c.w > bw) { bw = c.w; best = c; }
        if (best === null) break;
        if (best === "old") ownedOld++; else best.owned++;
        budget--; bought++;
      }
      cost += bought * ctx.track;
      const newMass = cohorts.reduce((a, c) => a + c.n * c.w, 0), ownedNew = cohorts.reduce((a, c) => a + c.owned * c.w, 0);
      cov = (1 - D) * (cum[ownedOld] * oldScale + ownedNew) / (oldScale + newMass);
      covSum += cov; path.push(cost);
    }
    costs.push(cost); covAvg.push(covSum / H); covEnd.push(cov);
    paths.push(path);
  }
  const q = (arr, x) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(x * (s.length - 1))))]; };
  const band = arr => ({ mid: q(arr, 0.5), low: q(arr, 0.025), high: q(arr, 0.975) });
  const pathBand = []; for (let m = 0; m <= H; m++) pathBand.push(band(paths.map(x => x[m])));
  return { newPerMonth: newSum / (p.runs * H), cost: band(costs), covAvg: band(covAvg), covEnd: band(covEnd), cheaper: costs.filter(c => c < ctx.subPrice * H).length / costs.length, pathBand };
}

/* Lecture d'un export Spotify. L'adresse IP du fichier n'est jamais lue. */
function readExportJson(name, text) {
  let data;
  try { data = JSON.parse(text.replace(/^\uFEFF/, "")); } catch (e) { return { kind: "invalid", name }; }
  if (Array.isArray(data) && data.length && typeof data[0] === "object" && "ms_played" in data[0]) {
    const out = [];
    for (const r of data) {
      if (!r.master_metadata_track_name || !r.master_metadata_album_artist_name) continue; // podcasts, livres audio
      const t = Date.parse(r.ts); if (!isFinite(t)) continue;
      const s = { t, ms: +r.ms_played || 0, track: r.master_metadata_track_name, artist: r.master_metadata_album_artist_name,
        album: r.master_metadata_album_album_name || null, auto: r.reason_start ? r.reason_start === "trackdone" : null,
        video: /video/i.test(name), key: keyOf(r.master_metadata_album_artist_name, r.master_metadata_track_name) };
      out.push(s);
    }
    return { kind: "streams", name, items: out };
  }
  // Export standard de Spotify (StreamingHistory) : sans l'historique étendu, l'outil ne peut pas l'utiliser.
  if (Array.isArray(data) && data.length && data[0] && typeof data[0] === "object" && "endTime" in data[0] && "trackName" in data[0] && "msPlayed" in data[0]) return { kind: "standard", name };
  return { kind: "other", name };
}

/* Profil type : un historique fictif de 12 mois, fabriqué à partir d'une forme de départ et de croisière.
   Toutes les valeurs ci-dessous sont des hypothèses, affichées comme telles dans la page. */
const START_TYPES = { prudent: 10, connu: 30, grandSaut: 120 };          // favoris ajoutés pendant les 2 premiers mois
const CRUISE_TYPES = { constante: m => 6, saturation: m => 12 * Math.pow(0.72, m), dents: m => [12, 2, 8, 0, 10, 3][m % 6] }; // nouveaux favoris par mois
function genHistory({ start = "connu", cruise = "constante", perDay = 25, seed = 20261019 } = {}) {
  const rnd = mulberry(seed);
  const artists = ["Les Lampes Bleues", "Mara Okoye", "Port de Meuse", "Atelier Nord", "Sable & Fils", "Nora Velde", "Orage Doux", "Kivu Lights",
    "Duo Ferrand", "Les Heures Claires", "Basalte", "Inès Moreau", "Treize Lunes", "Café Néon", "Hautes Fagnes", "Lila Ndayi"];
  const words = ["Quai", "Matin", "Rivière", "Néon", "Été", "Passage", "Fenêtre", "Retour", "Silence", "Colline", "Vertige", "Phare", "Radio", "Ligne", "Pluie", "Nord"];
  let id = 0;
  const title = () => { const i = id++; const ar = artists[i % artists.length]; return { artist: ar, album: words[Math.floor(i / 160) % words.length] + " " + (1 + Math.floor(i / 16) % 10), track: words[i % 16] + " " + words[Math.floor(i / 16) % 16] + " " + (i + 1) }; };
  const favs = [], begin = Date.UTC(2025, 9, 1), out = [];
  const add = n => { for (let k = 0; k < n; k++) favs.push({ ...title(), w: 1 }); };
  for (let d = 0; d < 365; d++) {
    const m = Math.floor(d / 30.4375);
    if (d % 30 === 0) { if (m < 2) add(Math.round(START_TYPES[start] / 2)); else add(Math.round(CRUISE_TYPES[cruise](m - 2))); }
    if (d % 30 === 0) for (const f of favs) f.w *= 0.97; // renouvellement : les anciens favoris perdent un peu de place
    for (const f of favs.slice(-12)) f.w = Math.max(f.w, 1.6); // les derniers arrivés tournent davantage
    const total = favs.reduce((a, f) => a + f.w, 0);
    const plays = Math.max(1, Math.round(perDay * (0.6 + rnd() * 0.8)));
    for (let k = 0; k < plays; k++) {
      let x;
      if (!favs.length || rnd() < 0.4) x = title(); // découverte : un titre écouté une seule fois
      else { let r = rnd() * total; x = favs[favs.length - 1]; for (const f of favs) { r -= f.w; if (r <= 0) { x = f; break; } } }
      const day = new Date(begin + d * DAY).getUTCDay(), hour = day >= 1 && day <= 5 && rnd() < 0.45 ? 8 + rnd() * 10 : 18 + rnd() * 5;
      out.push({ ts: new Date(begin + d * DAY + hour * 3.6e6).toISOString().replace(/\.\d+Z$/, "Z"), ms_played: 190000, master_metadata_track_name: x.track,
        master_metadata_album_artist_name: x.artist, master_metadata_album_album_name: x.album, reason_start: rnd() < 0.75 ? "trackdone" : "clickrow" });
    }
  }
  return out;
}
