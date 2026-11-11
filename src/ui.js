/* Outil musique OneClient — ui.js — v2.4 — 2026-11-11 */
/* ===== Page ===== */
/* Prix relevés en Belgique en octobre 2026 (TEXTE : à mettre à jour avec la note sous les réglages). null = prix à indiquer. */
const SERVICES = { "Spotify Premium": 13.99, "Apple Music": 11.99, "YouTube Music": 10.99, "YouTube Premium": 13.99, "Deezer Premium": 11.99, "Amazon Music Unlimited": 12.14, "Autre service": null };
if (typeof document !== "undefined") {
  const $ = id => document.getElementById(id);
  const eur = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const eur2 = new Intl.NumberFormat("fr-BE", { style: "currency", currency: "EUR" });
  const num = new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 0 });
  const num1 = new Intl.NumberFormat("fr-BE", { maximumFractionDigits: 1 });
  const pct = v => num.format(Math.round(v * 100)) + "\u00a0%";
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const dfmt = t => new Date(t).toLocaleDateString("fr-BE", { day: "numeric", month: "long", year: "numeric" }).replace(/^1 /, "1er ");
  const mfmt = t => new Date(t).toLocaleDateString("fr-BE", { month: "short", year: "2-digit", timeZone: "UTC" });
  const vowel = n => /^[aeiouyhàâäéèêëîïôöûüù]/i.test(String(n).trim());
  const de = n => (vowel(n) ? "d'" : "de ") + n;
  const plural = (n, one, many) => n >= 2 ? many : one;
  /* TEXTE : pourquoi l'estimation est fragile (rythme de découverte, marge à 95 %, nombre de mois). first = true pour « je ». */
  function fragReason(r, first) {
    const vous = first ? ["je découvre", "mon"] : ["vous découvrez", "votre"];
    if (!r.n || r.moe === null) return `trop peu de mois d'écoute pour mesurer ${vous[1]} rythme de découverte.`;
    const ratio = r.mean > 0 ? r.moe / r.mean : 1, f = v => r.mean < 3 ? num1.format(v) : num.format(Math.round(v));
    const lo = f(Math.max(0, r.mean - r.moe)), hi = f(r.mean + r.moe);
    return `${vous[0]} environ ${f(r.mean)} nouveaux favoris par mois, mais ce chiffre est ${ratio >= 0.8 ? "très " : ""}incertain (entre ${lo} et ${hi}, avec une confiance de 95\u00a0%).` +
      (r.n < 12 ? ` Il ne repose que sur ${r.n} mois.` : "");
  }
  /* TEXTE : les quatre façons d'acheter proposées. La stratégie cochée est celle mise en évidence partout. */
  const STRATS = [["favs", "Vos favoris actuels, puis rien"], ["half", "Vos favoris, puis la moitié des nouveaux"], ["every", "Vos favoris, puis chaque nouveau favori"], ["build", "Petit à petit, sans dépasser le prix de l'abonnement par mois"]];
  const chosen = () => radio("strat") || "half";
  const mineLab = first => first ? "Mon choix d'achat" : "Votre choix d'achat";
  function choiceText(x, F, first, short) {
    const v = first ? "mes" : "vos";
    if (x.id === "build") return `Acheter petit à petit tous ${v} favoris, actuels et nouveaux` + (short ? "" : `, ${x.s.capMonth} titres par mois au plus`);
    return `Acheter ${v} ${num.format(F)} favoris tout de suite, puis ` + (x.id === "favs" ? "rien" : x.id === "half" ? "la moitié des nouveaux" : "chaque nouveau favori");
  }
  const radio = name => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;

  // TEXTE : noms affichés des formes
  const START_LABEL = { prudent: "prudent, quelques titres", connu: "avec ce que vous connaissiez déjà", grandSaut: "grand saut, beaucoup de titres tout de suite" };
  const CRUISE_LABEL = { constante: "constantes", saturation: "de moins en moins nombreuses", dents: "par vagues" };
  const FACTOR = { moins: 0.5, autant: 1, plus: 1.5 };

  const state = { entries: null, streams: [], kind: "type", version: 0, cache: null, q3: {} };

  function params() {
    const v = (id, d) => { const x = parseFloat($(id).value); return isFinite(x) && x >= 0 ? x : d; };
    const name = (id, d) => ($(id).value || "").trim() || d;
    // Abonnements cochés, avec un prix : l'achat est comparé au moins cher (prix vide : service ignoré)
    const checked = [...document.querySelectorAll("#subsList input[data-sub]")].filter(x => x.checked).map(x => {
      const pr = parseFloat(document.querySelector(`#subsList input[data-price="${x.dataset.sub}"]`).value); return { name: x.dataset.sub, price: pr };
    });
    const hasPrice = x => isFinite(x.price) && x.price > 0;
    let subs = checked.filter(hasPrice).sort((a, b) => a.price - b.price);
    const missing = checked.filter(x => !hasPrice(x)).map(x => x.name), fallback = !subs.length; // fallback : aucun prix, comparaison avec Spotify Premium
    if (fallback) subs = [{ name: "Spotify Premium", price: SERVICES["Spotify Premium"] }];
    const cheapest = subs.filter(x => x.price - subs[0].price < 0.005).map(x => x.name);
    return { subs, missing, fallback, subPrice: subs[0].price, subName: cheapest.join(" ou "),
      track: Math.max(0.01, v("pTrack", 1.29)), album: v("pAlbum", 10.99), period: $("pPeriod").value,
      minPlays: Math.max(1, Math.round(v("pMin", 5))), minWeeks: Math.max(1, Math.round(v("pWeeks", 1))) };
  }

  /* Les calculs lourds ne sont refaits que si le fichier ou les réglages d'analyse changent. */
  function analysis(p) {
    const key = [state.version, p.minPlays, p.minWeeks, p.period, p.track, p.album].join("|");
    if (state.cache && state.cache.key === key) return state.cache;
    const P = { ...ENGINE_DEFAULTS, ...p };
    const prep = prepare(state.streams);
    if (!prep.valid.length) return (state.cache = { key, empty: true });
    const c = constat(prep, P), per = periods(prep, P), mon = monthly(prep, per, P), shp = shape(mon, P), ren = renewal(prep, per, P);
    return (state.cache = { key, prep, P, c, per, mon, shp, ren });
  }

  /* Le rythme futur : moins, autant ou plus qu'aujourd'hui. */
  function q3Factor() { return FACTOR[state.q3.all || "autant"]; }

  /* Forme reconnue (ou choisie pour un profil type) et rythme mesuré : ce sont les réponses préremplies. */
  function detectedCruise(A) { return state.kind === "type" ? state.gen.cruise : (A.shp.cruise || "constante"); }
  function measuredRhythm(A) {
    if (state.kind === "type") { const v = Array.from({ length: 10 }, (_, m) => CRUISE_TYPES[state.gen.cruise](m)); return v.reduce((a, b) => a + b, 0) / v.length; }
    return A.mon.rhythm.n ? A.mon.rhythm.mean : null;
  }
  function syncAnswers(A) {
    const det = detectedCruise(A);
    if (!state.cruiseTouched) document.querySelectorAll('input[name="cruise"]').forEach(x => { x.checked = x.value === det; });
    document.querySelectorAll('#cruiseCards .card').forEach(c => { c.querySelector(".detected").hidden = !(c.querySelector("input").value === det && (state.kind === "type" || A.shp.known)); });
    const mr = measuredRhythm(A);
    if (!state.rhythmTouched) $("rhythm").value = mr === null ? "" : String(Math.round(mr * 10) / 10);
    $("rhythmReset").hidden = !state.rhythmTouched || mr === null;
    // TEXTE : notes sous les réponses de l'étape A
    $("cruiseNote").textContent = state.kind === "type" ? "Profil type : la forme est celle que vous avez choisie plus haut."
      : A.shp.known ? `Choisi d'après vos ${A.mon.rhythmActive.n} mois d'écoute régulière. Changez si un autre vous ressemble plus.`
      : `Votre fichier est encore trop court pour le savoir : ${A.mon.rhythmActive.n} mois d'écoute régulière, il en faut 6. « Au même rythme » est choisi par défaut ; changez si un autre vous ressemble plus.`;
    const r = A.mon.rhythm;
    const ra = A.mon.rhythmActive, frag = ` <span class="fragile">Estimation fragile</span>`;
    $("rhythmNote").innerHTML = mr === null ? "Votre historique est trop court pour mesurer ce rythme : indiquez votre estimation." + frag
      : state.kind === "type" ? `Valeur du profil type : ${num1.format(mr)} par mois.`
      : `D'après votre fichier : ${num1.format(mr)} par mois` + (r.moe !== null ? ` (entre ${num1.format(r.low)} et ${num1.format(r.high)}, avec une confiance de 95\u00a0%)` : "") +
        `, mesuré sur ${r.n} mois${A.mon.pauses ? ` dont ${A.mon.pauses} de pause` : ""}.` + (A.mon.pauses && ra.n ? ` Sans les pauses : ${num1.format(ra.mean)} par mois.` : "") +
        (state.rhythmTouched ? " Vous avez indiqué votre propre valeur : la projection l'utilise telle quelle, sans marge mesurée." : " Changez ce chiffre si vous pensez découvrir plus ou moins.") + (r.fragile ? frag : "");
  }

  function model(A, p) {
    const detected = detectedCruise(A), cruiseSel = radio("cruise") || detected, isAuto = cruiseSel === detected;
    const manual = state.rhythmTouched && $("rhythm").value !== "" ? Math.max(0, parseFloat($("rhythm").value) || 0) : null;
    let pool, shapeInfo = null;
    const cruise = cruiseSel;
    if (manual !== null) pool = cruise === "dents" ? [1.8 * manual, 0.2 * manual, manual] : [manual];
    else if (state.kind === "type") pool = Array.from({ length: 10 }, (_, m) => CRUISE_TYPES[state.gen.cruise](m)); // profil type : les valeurs de la forme choisie
    else pool = A.mon.pool.map(x => x.newFavs);
    const poolMean = pool.length ? pool.reduce((a, b) => a + b, 0) / pool.length : 0;
    if (cruise === "saturation" && state.kind === "type" && manual === null && isAuto) shapeInfo = { cruise: "saturation", level: CRUISE_TYPES.saturation(10), decay: 0.72, poolMean };
    else if (cruise === "saturation") {
      const known = state.kind !== "type" && A.shp.cruise === "saturation" && manual === null;
      shapeInfo = { cruise: "saturation", level: known ? A.shp.level : poolMean, decay: known ? A.shp.decay : 0.95, poolMean };
    }
    if (cruise === "dents" && manual === null && state.kind !== "type" && A.shp.cruise !== "dents") {
      // dents de scie choisies sans les avoir mesurées : on accentue les écarts autour de la même moyenne
      const m0 = pool.reduce((a, b) => a + b, 0) / pool.length;
      pool = pool.map((v, i) => i % 2 ? v * 0.3 : v * 1.7);
      const m1 = pool.reduce((a, b) => a + b, 0) / pool.length;
      if (m1 > 0) pool = pool.map(v => v * m0 / m1); // la moyenne du rythme reste celle de départ
    }
    return { pool, r: A.ren.r, D: 1 - A.c.favShare, favCounts: A.c.favCounts, favCost: A.c.fav.cost, factor: q3Factor(), shapeInfo, cruise, manual, poolMean };
  }

  // ---------- Partie 1 : le constat ----------
  function renderConstat(A, p) {
    const c = A.c, T = (mine, type) => state.kind === "fichier" ? mine : type;
    const perLabel = p.period === "all" ? "tout l'historique" : p.period + " derniers mois";
    $("pastTitle").textContent = `Le passé : ${p.period === "all" ? "tout votre historique" : "vos " + p.period + " derniers mois"}`;
    $("constatPeriod").textContent = `Période analysée : du ${dfmt(c.from)} au ${dfmt(c.to)} (${perLabel}).`;
    $("figures").innerHTML = [
      [num.format(c.plays), `écoutes d'au moins 30 secondes (morceaux${c.video ? " et clips" : ""})`],
      [num.format(c.distinct), "titres différents"],
      [num.format(c.favCount), `${plural(c.favCount, "titre favori", "titres favoris")}, ${plural(c.favCount, "écouté", "écoutés")} au moins ${p.minPlays} fois${p.minWeeks > 1 ? ` sur ${p.minWeeks} semaines différentes` : ""} : ${pct(c.favShare)} de votre écoute`],
      [num.format(Math.round(c.hours)), "heures d'écoute"]
    ].map(([b, s]) => `<div class="fig"><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join("");
    const months = c.months, subCost = months * p.subPrice;
    // TEXTE : tableau du constat
    const rows = [
      ["Version gratuite, avec publicité", "100 %", eur.format(0)],
      [`Abonnement ${p.subName}, ${num1.format(months)} mois`, "100 %", eur.format(subCost)],
      [`Acheter les ${num.format(c.distinct)} titres écoutés (au titre ou à l'album)`, "100 %", eur.format(c.all.cost)],
      [`Acheter vos ${num.format(c.favCount)} favoris`, pct(c.favShare), eur.format(c.fav.cost)]
    ];
    $("constatTable").innerHTML = `<thead><tr><th>Ce que cette période vous aurait coûté</th><th>Écoute couverte</th><th>Coût</th></tr></thead><tbody>` +
      rows.map(r => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${esc(r[2])}</td></tr>`).join("") + `</tbody>`;
    $("constatHint").textContent = `Écoute couverte : la part de vos écoutes que ces titres représentent.` +
      (c.all.albums ? ` Quand un album entier coûte moins cher que ses titres, l'outil prend l'album (${num.format(c.all.albums)} ${plural(c.all.albums, "album", "albums")} ici).` : "");
    const f = Math.round(c.favShare * 100), d = 100 - f;
    $("split").innerHTML = `<div class="bar" role="img" aria-label="Favoris ${f} %, découverte ${d} %"><span class="fav" style="width:${f}%">${f >= 12 ? f + " %" : ""}</span><span class="disc" style="width:${d}%">${d >= 12 ? d + " %" : ""}</span></div>` +
      `<div class="keys"><span>Favoris : ${esc(num.format(c.favCount))} ${plural(c.favCount, "titre", "titres")}</span><span>Découvertes : ${esc(num.format(c.distinct - c.favCount))} titres écoutés une fois ou quelques fois</span></div>`;
    $("top5").innerHTML = c.top.map(x => `<li>${esc(x.track)} <small>· ${esc(x.artist)} · ${num.format(x.plays)} écoutes</small></li>`).join("");
    renderMonths(A, c);
  }

  /* Petites icônes partagées par les graphiques et leurs légendes : casque = écoutes, étoile = nouveaux favoris. */
  const starPts = (cx, cy, r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; return `${(cx + q * Math.cos(a)).toFixed(1)},${(cy + q * Math.sin(a)).toFixed(1)}`; }).join(" ");
  const icoHead = (x, y, c) => `<g fill="none" stroke="${c}" stroke-width="1.6" stroke-linecap="round"><path d="M${x + 1.5} ${y + 8}v-1.5a5.5 5.5 0 0 1 11 0v1.5"/></g><rect x="${x}" y="${y + 7}" width="3.4" height="5.5" rx="1.2" fill="${c}"/><rect x="${x + 10.6}" y="${y + 7}" width="3.4" height="5.5" rx="1.2" fill="${c}"/>`;
  const icoStar = (x, y, c) => `<polygon points="${starPts(x + 7, y + 7.5, 6.5)}" fill="${c}"/>`;
  const legIco = svg => `<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style="flex:none">${svg}</svg>`;

  /* Graphique du constat : un seul graphique, deux échelles. Barres : écoutes (gauche). Ligne étoilée : nouveaux favoris (droite). */
  function renderMonths(A, c) {
    const sp = t => t.replace(/ /g, " "); // espace insécable visible dans le dessin
    const colors = { "démarrage": css("--s-first"), "régulier": css("--accent"), "pause": css("--s-pause"), "avant": css("--s-before") };
    const fav = css("--s-start"), ink = css("--ink"), mut = css("--muted"), surf = css("--surface");
    const m0 = monthIdx(c.from), m1 = monthIdx(c.to), first = Math.max(m0, m1 - 35);
    const byM = new Map(A.mon.months.map(x => [x.m, x]));
    const plays = new Map(); for (const s of A.prep.valid) if (s.t >= c.from) { const m = monthIdx(s.t); plays.set(m, (plays.get(m) || 0) + 1); }
    const rows = []; for (let m = first; m <= m1; m++) { const x = byM.get(m); rows.push({ m, start: monthStart(m), plays: plays.get(m) || 0, phase: x ? x.phase : "avant", newFavs: x ? x.newFavs : null, recent: x ? x.recent : false }); }
    const hasBefore = rows.some(x => x.phase === "avant"), hasRecent = rows.some(x => x.recent && x.newFavs !== null);
    // TEXTE : légende du graphique mois par mois
    $("monthsLegend").innerHTML =
      `<li>${legIco(icoHead(0, 0, ink))}Écoutes : barres, échelle de gauche</li><li>${legIco(icoStar(0, 0, fav))}Nouveaux favoris : ligne, échelle de droite</li><li class="br" aria-hidden="true"></li>` +
      [["Démarrage", "--s-first"], ["Écoute régulière", "--accent"], ["Pause", "--s-pause"]].concat(hasBefore ? [["Avant votre dernier retour", "--s-before"]] : [])
        .map(([l, v]) => `<li><span class="sw" style="background:var(${v})"></span>${l}</li>`).join("") +
      (hasRecent ? `<li>${legIco(`<polygon points="${starPts(7, 7.5, 5.8)}" fill="none" stroke="${fav}" stroke-width="1.4"/>`)}Étoile vide : mois récent, encore incomplet (un titre a 60 jours pour devenir un favori)</li>` : "");
    const cw = $("monthsChart").clientWidth || 640, narrow = cw < 520, W = Math.max(280, Math.min(760, Math.round(cw)));
    const L = 46, R = 34, top = 30, h = narrow ? 200 : 240, H = top + h + (narrow ? 44 : 36);
    const bw = (W - L - R) / rows.length, full = bw >= 46, initials = !full && bw >= 11, every = full || initials ? 1 : Math.ceil(rows.length / 6);
    const vert = !full && bw >= 11; // pas la place pour écrire les écoutes à plat : on les écrit à la verticale
    const nice = (mx, n) => { const st = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000].find(s => mx / s <= n) || 20000; return { st, max: Math.max(st, Math.ceil(mx / st) * st) }; };
    const a1 = nice(Math.max(1, ...rows.map(x => x.plays)) * (vert ? 1.25 : 1.12), 4);
    const n1 = Math.round(a1.max / a1.st), fmax = Math.max(1, ...rows.map(x => x.newFavs || 0)); // mêmes lignes de grille pour les deux échelles
    const st2 = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find(s => fmax * 1.12 / n1 <= s) || 1000, a2 = { st: st2, max: st2 * n1 };
    const y1 = v => top + h * (1 - v / a1.max), y2 = v => top + h * (1 - v / a2.max);
    let g = icoHead(L - 2, 2, ink) + `<text x="${L + 16}" y="${13}" font-size="11" font-weight="600" fill="${ink}">Écoutes</text>` +
      icoStar(W - 72, 2, fav) + `<text x="${W - 2}" y="${13}" text-anchor="end" font-size="11" font-weight="600" fill="${fav}">Favoris</text>`;
    for (let v = 0; v <= a1.max; v += a1.st) g += `<line x1="${L}" x2="${W - R}" y1="${y1(v)}" y2="${y1(v)}" stroke="${css("--line")}"/><text x="${L - 6}" y="${y1(v) + 4}" text-anchor="end" font-size="10" fill="${mut}">${esc(sp(num.format(v)))}</text>`;
    for (let v = 0; v <= a2.max; v += a2.st) g += `<text x="${W - R + 6}" y="${y2(v) + 4}" font-size="10" fill="${fav}">${esc(sp(num.format(v)))}</text>`;
    g += `<line x1="${L}" x2="${W - R}" y1="${y1(0)}" y2="${y1(0)}" stroke="${mut}"/>`;
    const r = full ? 6 : 5, pts = [], labs = [];
    const over = (a, b) => a[0] < b[1] && b[0] < a[1]; // deux intervalles verticaux [haut, bas] qui se chevauchent
    rows.forEach((x, i) => {
      const X = L + i * bw, w = bw * 0.7, x0 = X + bw * 0.15, cx = X + bw / 2, tip = `${esc(mfmt(x.start))} : ${num.format(x.plays)} écoutes` + (x.newFavs !== null ? `, ${x.newFavs} nouveaux favoris` : "");
      g += `<rect x="${x0.toFixed(1)}" y="${y1(x.plays).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, y1(0) - y1(x.plays)).toFixed(1)}" fill="${colors[x.phase]}"><title>${tip}</title></rect>`;
      const cy = x.newFavs !== null ? y2(x.newFavs) : null, star = cy !== null ? [cy - r, cy + r] : null;
      // chiffre des écoutes au-dessus de la barre ; s'il touche l'étoile, il passe au-dessus de l'étoile
      const lab = esc(sp(num.format(x.plays))), len = full ? 10 : 6 + 5.6 * lab.length;
      let bot = y1(x.plays) - 3; if (star && (full || vert) && over([bot - len, bot], star)) bot = star[0] - 2;
      const box = [bot - len, bot];
      if (full) g += `<text x="${cx.toFixed(1)}" y="${(bot - 1).toFixed(1)}" text-anchor="middle" font-size="10" fill="${mut}">${lab}</text>`;
      else if (vert) g += `<text transform="translate(${(cx + 3.5).toFixed(1)} ${bot.toFixed(1)}) rotate(-90)" font-size="9.5" fill="${mut}">${lab}</text>`;
      if (cy !== null) {
        pts.push({ i, cx, cy, v: x.newFavs, recent: x.recent, tip });
        if (bw >= 16 && x.newFavs > 0) { // chiffre des favoris : au-dessus de l'étoile, sinon en dessous, sinon au-dessus du chiffre des écoutes
          let b2 = star[0] - 2; if ((full || vert) && over([b2 - 10, b2], box)) { b2 = star[1] + 11; if (over([b2 - 10, b2], box) || b2 > y1(0) - 1) b2 = box[0] - 2; }
          labs.push(`<text x="${cx.toFixed(1)}" y="${b2.toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="${fav}" stroke="${surf}" stroke-width="3" stroke-linejoin="round" paint-order="stroke">${x.newFavs}</text>`);
        }
      }
      if (i % every === 0) {
        const t = full ? mfmt(x.start) : initials ? mfmt(x.start).charAt(0).toUpperCase() : mfmt(x.start);
        g += `<text x="${cx.toFixed(1)}" y="${y1(0) + 14}" text-anchor="middle" font-size="10" fill="${mut}">${esc(t)}</text>`;
      }
    });
    // la ligne des nouveaux favoris, en pointillé vers les mois récents encore incomplets ; coupée là où il n'y a pas de mesure
    for (let k = 1; k < pts.length; k++) if (pts[k].i === pts[k - 1].i + 1)
      g += `<line x1="${pts[k - 1].cx.toFixed(1)}" y1="${pts[k - 1].cy.toFixed(1)}" x2="${pts[k].cx.toFixed(1)}" y2="${pts[k].cy.toFixed(1)}" stroke="${fav}" stroke-width="2.2"${pts[k].recent ? ` stroke-dasharray="4 3"` : ""}/>`;
    for (const q of pts) g += `<polygon points="${starPts(q.cx, q.cy, r)}" fill="${q.recent ? surf : fav}" stroke="${fav}" stroke-width="1.3"><title>${q.tip}</title></polygon>`;
    g += labs.join("");
    if (!full) g += `<text x="${L}" y="${H - 6}" font-size="10" fill="${mut}">${esc(mfmt(rows[0].start))} → ${esc(mfmt(rows[rows.length - 1].start))}</text>`;
    else g += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="${mut}">Mois de la période analysée</text>`;
    $("monthsChart").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Écoutes (barres) et nouveaux favoris (ligne) par mois sur la période analysée">${g}</svg>`;
  }

  // ---------- Partie 2 : la projection ----------
  function renderProfile(A, M) {
    const r = A.mon.rhythm, ra = A.mon.rhythmActive, s = A.shp, items = [];
    const typ = state.kind === "type";
    if (typ) items.push(`Profil type fictif : au départ, ${START_LABEL[state.gen.start]} ; ensuite, des découvertes ${CRUISE_LABEL[state.gen.cruise]}. Ces formes sont des hypothèses de l'outil.`);
    else {
      const per = A.per, gapM = per.departures.length ? Math.round((per.departures.at(-1).to - per.departures.at(-1).from) / (30.4375 * DAY)) : 0;
      items.push(per.returned ? `Vous écoutez à nouveau depuis le ${dfmt(per.firstListen)}, après ${gapM} mois de pause. L'estimation part de cette date.` : `Vous écoutez depuis le ${dfmt(per.firstListen)}. L'estimation part de cette date.`);
      if (s.start) items.push(s.ratio >= 1.5 ? `Au début, vous avez trouvé beaucoup de favoris d'un coup : ${num1.format(s.ratio)} fois plus par mois que par la suite.` : `Au début, vous avez trouvé vos favoris au même rythme que par la suite.`);
    }
    items.push(A.ren.measured ? `Vos goûts changent : chaque mois, vos anciens favoris perdent environ ${pct(1 - A.ren.r)} de leur place au profit des nouveaux.`
      : `Vos goûts changent : l'outil suppose que vos anciens favoris perdent ${pct(1 - A.ren.r)} de leur place chaque mois. Votre fichier est encore trop court pour le mesurer.`);
    $("profileFacts").innerHTML = items.map(x => `<li>${x}</li>`).join("");
  }

  function strategies(A, M, p) {
    const ctx = { favCounts: A.c.favCounts, subPrice: p.subPrice, track: p.track };
    return STRATS.map(([id, label]) => { const s = strategy(id, ctx); return { id, label, s, sim: simulate(M, s, ctx) }; });
  }

  function renderResult(A, M, p, S, mine) {
    const H = ENGINE_DEFAULTS.horizon, subTotal = p.subPrice * H, s = mine.s, c = A.c;
    const subName = p.subName;
    // TEXTE : verdict de la projection
    let big, sub;
    if (!c.favCount) {
      big = "Aucun titre n'est écouté assez souvent pour devenir un favori : acheter ne couvrirait presque rien de votre écoute.";
      sub = `L'abonnement à ${subName} (${eur.format(subTotal)} sur 5 ans) ou la version gratuite, avec publicité, sont faits pour votre façon d'écouter.`;
    } else {
      const sim = mine.sim, startCost = s.now === c.favCount ? c.fav.cost : s.now * p.track;
      const parts = [];
      if (s.now) parts.push(`acheter ${s.now === c.favCount ? "vos " : ""}${num.format(s.now)} ${plural(s.now, "favori", "favoris")} tout de suite (${eur.format(startCost)})`);
      if (s.longRun > s.now) parts.push(s.now ? `puis le reste de vos favoris actuels au fil des mois (${num.format(s.longRun - s.now)} titres)` : `acheter vos favoris actuels au fil des mois (${num.format(s.longRun)} titres)`);
      const unknown = !M.pool.length || (M.poolMean === 0 && A.mon.rhythm.n === 0);
      const nm = sim.newPerMonth;
      const each = n => unknown ? "rythme à indiquer dans les réglages avancés" : `environ ${num1.format(n)} par mois`;
      const followTxt = s.follow === 1 ? `chacun de vos nouveaux favoris, ${each(nm)}` : `la moitié de vos nouveaux favoris, ${each(nm * s.follow)}`;
      if (s.follow > 0) parts.push((parts.length ? "puis " : "acheter ") + followTxt);
      else parts.push(parts.length ? "puis plus aucun nouveau titre" : "ne rien acheter");
      big = `${mineLab(false)} : ${parts.join(", ")}` + (isFinite(s.cap) && (s.longRun > s.now || s.follow > 0) ? `, sans dépasser ${s.capMonth} titres par mois (${eur2.format(s.capMonth * p.track)}, le prix ${de(subName)}).` : ".");
      const range = eur.format(sim.cost.low) === eur.format(sim.cost.high) ? "" : `, probablement entre ${eur.format(sim.cost.low)} et ${eur.format(sim.cost.high)}`;
      sub = `Sur 5 ans, cela coûte ${eur.format(sim.cost.mid)}${range}, pour ${pct(sim.covAvg.mid)} de votre écoute en moyenne. ` +
        `L'abonnement à ${subName} coûte ${eur.format(subTotal)}, pour toute votre écoute. ` +
        (sim.cheaper >= 0.995 ? `Dans les ${num.format(ENGINE_DEFAULTS.runs)} simulations, votre choix coûte moins cher que l'abonnement.` : sim.cheaper <= 0.005 ? `Dans les ${num.format(ENGINE_DEFAULTS.runs)} simulations, votre choix coûte plus cher que l'abonnement.` : `Dans ${num.format(Math.round(sim.cheaper * 100))} cas sur 100, votre choix coûte moins cher que l'abonnement.`) +
        ` Il ne couvre jamais plus de ${pct(c.favShare)} de votre écoute : seuls les favoris sont achetés.` +
        (unknown ? ` Votre rythme de découverte n'est pas encore mesurable : la projection compte zéro nouveau favori. Indiquez votre rythme dans « Nouveaux favoris par mois ».` : "");
    }
    $("pVerdict").textContent = big; $("pSub").textContent = sub;

    // tableau des stratégies
    const row = x => `<tr class="${x.id === mine.id ? "mine" : ""}"><td>${esc(x.label)}</td><td data-label="Coût">${eur.format(x.sim.cost.mid)}<small>${eur.format(x.sim.cost.low)} à ${eur.format(x.sim.cost.high)}</small></td><td data-label="Écoute">${pct(x.sim.covAvg.mid)}<small>${pct(x.sim.covAvg.low)} à ${pct(x.sim.covAvg.high)}</small></td><td data-label="Moins cher">${pct(x.sim.cheaper)}</td></tr>`;
    $("stratTable").innerHTML = `<thead><tr><th>Façon d'acheter, sur 5 ans</th><th>Coût</th><th>Écoute couverte, en moyenne</th><th>Moins cher que l'abonnement</th></tr></thead><tbody>` +
      S.map(row).join("") +
      p.subs.map(x => `<tr class="sub"><td>Abonnement ${esc(x.name)}</td><td data-label="Coût">${eur.format(x.price * H)}</td><td data-label="Écoute">100 %</td><td data-label="Moins cher">—</td></tr>`).join("") +
      `<tr class="sub"><td>Version gratuite, avec publicité</td><td data-label="Coût">${eur.format(0)}</td><td data-label="Écoute">100 %</td><td data-label="Moins cher">—</td></tr></tbody>`;
    $("stratHint").textContent = `Premier chiffre : la valeur du milieu des 1 000 simulations. Dessous : la fourchette probable (95 cas sur 100). « Moins cher que l'abonnement » : dans combien de cas sur 100 cette façon d'acheter coûte moins que ${eur.format(subTotal)}.`;
    renderFan(mine, subTotal, subName, p);
  }

  /* Niveau 1 : la réponse en une phrase et trois cartes. */
  function renderSummary(A, p, S, mine) {
    const H = ENGINE_DEFAULTS.horizon, subTotal = p.subPrice * H, c = A.c, T = state.kind === "fichier";
    const subName = p.subName;
    // TEXTE : phrase clé et cartes de la réponse
    $("resMeta").textContent = `D'après ${T ? "vos écoutes" : "l'historique fictif de l'exemple"}, du ${dfmt(c.from)} au ${dfmt(c.to)}.`;
    $("keyLine").textContent = c.favCount
      ? `Vous avez ${num.format(c.favCount)} ${plural(c.favCount, "titre favori", "titres favoris")}, ${plural(c.favCount, "écouté", "écoutés")} au moins ${p.minPlays} fois. ${plural(c.favCount, "Il fait", "Ils font")} ${pct(c.favShare)} de votre écoute. Le reste, ${pct(1 - c.favShare)}, ce sont surtout des découvertes : des titres écoutés une fois ou quelques fois.`
      : `Aucun titre n'est écouté assez souvent pour devenir un favori : acheter ne couvrirait presque rien de votre écoute.`;
    const card = (lab, val, cov, det, hl) => `<div class="sumcard${hl ? " hl" : ""}"><span class="lab">${esc(lab)}</span><span class="val">${esc(val)}</span><span class="cov">${esc(cov)}</span><span class="det">${det}</span></div>`;
    const sub = card("S'abonner", eur.format(subTotal), "100 % de votre écoute", `${esc(subName)} à ${esc(eur2.format(p.subPrice))} par mois` + (p.subs.length > 1 ? `, le moins cher des ${p.subs.length} comparés` : ""));
    let cards;
    if (!c.favCount) cards = [sub, card("Version gratuite", eur.format(0), "100 % de l'écoute", "Avec publicité")];
    else {
      const favs = S.find(x => x.id === "favs"), every = S.find(x => x.id === "every");
      const look = x => eur.format(x.sim.cost.mid) + pct(x.sim.covAvg.mid);
      const other = look(mine) === look(favs) ? every : favs; // jamais deux cartes identiques
      const otherLab = other === favs ? "Acheter vos favoris, puis rien" : "Acheter chaque nouveau favori";
      const otherDet = other === favs ? `Vos ${num.format(c.favCount)} favoris d'aujourd'hui, sans nouvel achat` : "Vos favoris, puis chaque nouveau favori";
      const mid = x => x.sim.cost.mid, cov = x => `${pct(x.sim.covAvg.mid)} de votre écoute, en moyenne`;
      const edit = `<button type="button" class="linkbtn" data-open="refinePanel">Changer de façon d'acheter</button>`;
      const mineCard = card(mineLab(false), eur.format(mid(mine)), cov(mine), `${esc(choiceText(mine, c.favCount, false))}.` + (eur.format(mine.sim.cost.low) === eur.format(mine.sim.cost.high) ? "" : ` Probablement entre ${esc(eur.format(mine.sim.cost.low))} et ${esc(eur.format(mine.sim.cost.high))}.`) + ` ${edit}`, true);
      cards = look(other) === look(mine) ? [sub, mineCard] : [sub, card(otherLab, eur.format(mid(other)), cov(other), esc(otherDet)), mineCard];
    }
    $("sumCards").innerHTML = cards.join("");
    // TEXTE : rappel du résultat à côté du choix, pour voir l'effet d'un changement sans remonter
    $("refineRecap").textContent = !c.favCount ? `Aucun favori : l'abonnement (${eur.format(subTotal)} sur 5 ans) ou la version gratuite.`
      : `${mine.label} : ${eur.format(mine.sim.cost.mid)} sur 5 ans, pour ${pct(mine.sim.covAvg.mid)} de votre écoute. L'abonnement : ${eur.format(subTotal)}, pour ${pct(1)}.`;
    const frag = T && A.mon.rhythm.fragile;
    $("fragNote").hidden = !frag;
    if (frag) $("fragNote").innerHTML = `<span class="fragile">Estimation fragile</span> ${esc(fragReason(A.mon.rhythm, false).replace(/^./, x => x.toUpperCase()))} <button type="button" class="linkbtn" data-open="detLimits">En savoir plus</button>`;
  }

  function renderFan(mine, subTotal, subName, p) {
    const H = ENGINE_DEFAULTS.horizon;
    const band = mine.sim.pathBand;
    // Tous les abonnements cochés : une ligne chacun. Même total : un seul trait, les noms regroupés. Du plus cher au moins cher.
    const short = n => ({ "Spotify Premium": "Spotify", "Deezer Premium": "Deezer", "Amazon Music Unlimited": "Amazon Music", "Autre service": "Autre service" })[n] || n;
    const groups = []; for (const s of p.subs) { const t = Math.round(s.price * H * 100) / 100, g0 = groups.find(g => Math.abs(g.total - t) < 0.5); if (g0) g0.names.push(short(s.name)); else groups.push({ total: t, names: [short(s.name)] }); }
    groups.sort((a, b) => b.total - a.total); const low = groups[groups.length - 1];
    const many = groups.length > 1, sub = css("--s-sub");
    // TEXTE : légende du graphique des 5 ans
    $("fanLegend").innerHTML = `<li><span class="sw" style="background:var(--s-band);opacity:.25"></span>Votre choix : fourchette probable (95 cas sur 100)</li><li><span class="sw line" style="background:var(--s-mine)"></span>Valeur du milieu des simulations</li>` +
      (many ? `<li><span class="sw line" style="background:var(--s-sub)"></span>Abonnements : le moins cher en trait plein</li>` : `<li><span class="sw line" style="background:var(--s-sub)"></span>Abonnement ${esc(subName)}</li>`);
    const cw = $("fan").clientWidth || 640, narrow = cw < 520, W = narrow ? Math.max(240, Math.round(cw)) : 640, Hh = narrow ? 220 : 280, L = 62, Tp = 14, B = 30;
    const labW = narrow ? 0 : Math.min(190, 30 + 6.2 * Math.max(...groups.map(g => g.names.join(", ").length)) + 8 + 46);
    const R = narrow ? 22 : 10 + labW;
    const maxV = Math.max(groups[0].total, ...band.map(b => b.high), 1);
    const step = [25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000, 50000].find(s => maxV / s <= 5) || 100000;
    const yMax = Math.ceil(maxV / step) * step;
    const x = m => L + (W - L - R) * m / H, y = v => Tp + (Hh - Tp - B) * (1 - v / yMax);
    let g = "";
    for (let v = 0; v <= yMax; v += step) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${css("--line")}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="${css("--muted")}">${esc(eur.format(v))}</text>`;
    for (let yr = narrow ? 1 : 0; yr <= 5; yr++) if (narrow || yr !== 1 || x(12) - x(0) >= 80) g += `<text x="${x(yr * 12)}" y="${Hh - 10}" text-anchor="${yr === 0 ? "start" : "middle"}" font-size="11" fill="${css("--muted")}">${yr === 0 ? "aujourd'hui" : narrow && yr > 1 && yr < 5 ? yr : yr + (yr > 1 ? " ans" : " an")}</text>`;
    const up = band.map((b, m) => `${x(m).toFixed(1)},${y(b.high).toFixed(1)}`), down = band.map((b, m) => `${x(m).toFixed(1)},${y(b.low).toFixed(1)}`).reverse();
    g += `<polygon points="${up.concat(down).join(" ")}" fill="${css("--s-band")}" fill-opacity="0.18"/>`;
    g += `<polyline points="${band.map((b, m) => `${x(m).toFixed(1)},${y(b.mid).toFixed(1)}`).join(" ")}" fill="none" stroke="${css("--s-mine")}" stroke-width="2.5"/>`;
    for (const gr of groups) { const main = gr === low; g += `<polyline points="${x(0)},${y(0)} ${x(H)},${y(gr.total)}" fill="none" stroke="${sub}" stroke-width="${main ? 2.2 : 1.4}"${main ? "" : ` stroke-opacity="0.45"`}/>`; }
    if (!narrow) { // les tarifs au bout des lignes, en colonne : noms à gauche, montants alignés à droite, du plus cher au moins cher
      const ys = groups.map(gr => y(gr.total) + 4); for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + 14);
      const over = ys[ys.length - 1] - (Hh - B); if (over > 0) for (let i = 0; i < ys.length; i++) ys[i] -= over;
      const xa = x(H) + 8, xb = W - 2;
      groups.forEach((gr, i) => { const main = gr === low, c = main ? sub : css("--muted"), fw = main ? 700 : 400;
        g += `<text x="${xa.toFixed(1)}" y="${ys[i].toFixed(1)}" font-size="11" font-weight="${fw}" fill="${c}">${esc(gr.names.join(", "))}</text><text x="${xb}" y="${ys[i].toFixed(1)}" text-anchor="end" font-size="11" font-weight="${fw}" fill="${c}">${esc(eur.format(gr.total))}</text>`; });
    }
    $("fan").innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Coût cumulé sur 5 ans de votre stratégie et des abonnements comparés">${g}</svg>`;
    // Sur téléphone, pas de place au bout des lignes : la même liste sous le graphique, montants alignés à droite.
    $("fanSubs").hidden = !narrow;
    $("fanSubs").innerHTML = narrow ? groups.map(gr => `<li${gr === low ? ` class="low"` : ""}><span class="sw line" style="background:var(--s-sub)${gr === low ? "" : ";opacity:.45"}"></span><span>${esc(gr.names.join(", "))}</span><span class="amt">${esc(eur.format(gr.total))}</span></li>`).join("") : "";
  }

  function renderLimits(A, M, p) {
    const typ = state.kind === "type", D = ENGINE_DEFAULTS, fav = `${p.minPlays} fois${p.minWeeks > 1 ? `, sur au moins ${p.minWeeks} semaines différentes` : ""}`;
    // TEXTE : hypothèses et limites, avec les valeurs réellement utilisées par le calcul (8 points au plus)
    const items = [
      (typ ? "Exemple fictif : l'historique est inventé, comme les formes du départ et des découvertes. " : "") + `Une écoute compte à partir de 30 secondes, pour les morceaux et les clips. Les podcasts et les livres audio ne comptent pas. Un favori est un titre écouté au moins ${fav} pendant la période.`,
      `Un nouveau favori est un titre entendu pour la première fois, puis écouté ${p.minPlays} fois dans les ${D.favWindow} jours. Un mois dont les ${D.favWindow} jours ne sont pas écoulés ne compte pas encore dans votre rythme.`,
      `Une semaine de moins de ${D.silentPlays} écoutes est vide. Après ${D.departWeeks} semaines vides d'affilée, l'outil considère que vous êtes parti : l'estimation part de votre dernier retour. Une semaine sous ${pct(D.pauseRatio)} d'une semaine habituelle est une pause. Les ${D.startWeeks} premières semaines sont le démarrage, prolongé tant que vous trouvez nettement plus de favoris que par la suite : il n'entre pas dans votre rythme.`,
      `Votre rythme est la moyenne de vos nouveaux favoris par mois, pauses comprises, avec une marge d'erreur à 95 %. L'estimation est fragile s'il y a moins de ${D.minRegular} mois utilisables, ou si la marge dépasse la moitié du rythme.` + (!typ && A.mon.rhythm.fragile ? " Ici, elle est fragile : refaites le test dans quelques mois avec un nouvel export." : ""),
      `Vos goûts changent : chaque mois qui apporte de nouveaux favoris, les anciens perdent de la place au profit des nouveaux. Chez vous : ${pct(1 - A.ren.r)} par mois, ${A.ren.measured ? "mesuré sur vos 12 derniers mois" : `supposé faute de données suffisantes (${pct(1 - D.defaultRenewal)} par mois)`}.`,
      `Chaque façon d'acheter est simulée ${num.format(D.runs)} fois sur ${D.horizon} mois. Chaque simulation tire d'abord un rythme moyen plausible, puis rejoue des suites de ${D.block} mois ${typ ? "de l'exemple" : "de votre historique"} et tire au hasard le nombre de nouveaux favoris de chaque mois. Vous obtenez la valeur du milieu et la fourchette probable (95 cas sur 100). Le hasard est fixé : mêmes données, mêmes réglages, même résultat.`,
      `Seuls les favoris sont achetés : les titres écoutés moins de ${p.minPlays} fois ne le sont jamais. Pour eux, il faut l'abonnement ou la version gratuite. Chaque mois, l'outil achète d'abord les titres que vous écoutez le plus, dans la limite du budget du mois. Un album remplace ses titres quand il coûte moins cher, mais seulement pour l'achat de vos favoris actuels au départ.`,
      `Vos habitudes et les prix restent les mêmes pendant 5 ans, sauf si vous changez le rythme dans les réglages avancés. Un titre acheté est une licence d'usage personnelle : il ne se revend ni ne se transmet comme un CD. La qualité du son, les fonctions des applications et la publicité de la version gratuite ne sont pas comptées.`
    ];
    $("limits").innerHTML = `<div><ul class="limits">${items.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`;
  }

  /* ---------- Image à partager : même mise en page que l'infographie LinkedIn de OneClient (1080 × 1350) ---------- */
  function drawCard(L) {
    const { A, p, S, mine } = L, c = A.c, W = 1080, H = 1350, PX = 64;
    const C = { bg: "#F3F5F4", ink: "#15201D", muted: "#56635F", line: "#D6DDDA", line2: "#E4E9E7", accent: "#0B6E66", soft: "#E1EFEC", white: "#FFFFFF" };
    const SANS = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif', MONO = SANS, DISPLAY = '"Fraunces", Georgia, serif';
    const sp = t => String(t).replace(/ /g, " ");
    const E = v => sp(eur.format(v)), N = v => sp(num.format(v)), P = v => sp(pct(v));
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    const font = (size, weight = 400, fam = SANS, style = "") => { g.font = `${style} ${weight} ${size}px ${fam}`.trim(); };
    const box = (x, y, w, h, r, fill, stroke) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1; g.stroke(); } };
    const wrap = (text, maxW) => { const words = String(text).split(" "), lines = []; let cur = ""; for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; };
    const text = (t, x, y, color, align = "left") => { g.fillStyle = color; g.textAlign = align; g.fillText(t, x, y); };
    // Chiffres en chasse fixe : espaces fines entre les groupes (comme dans l'infographie), au lieu d'une espace pleine largeur.
    const mono = (t, x, y, color, size, align = "left") => {
      const parts = String(t).split(/[\s\u00a0\u202f]+/), gap = size * 0.3, ws = parts.map(q => g.measureText(q).width);
      const total = ws.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
      let cx = align === "right" ? x - total : align === "center" ? x - total / 2 : x;
      g.fillStyle = color; g.textAlign = "left"; parts.forEach((q, i) => { g.fillText(q, cx, y); cx += ws[i] + gap; });
    };
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H); g.textBaseline = "alphabetic";

    // En-tête
    font(16, 600); g.save(); g.fillStyle = C.accent; g.textAlign = "left"; let ex = PX; for (const ch of "MON ANALYSE · OUTIL ONECLIENT") { g.fillText(ch, ex, 72); ex += g.measureText(ch).width + 1.9; } g.restore();
    font(84, 600, DISPLAY); text("Abonnement ou achat ?", PX - 2, 160, C.accent);
    font(23); let y = 202; for (const l of wrap("Cela vaut-il la peine de payer un abonnement musical plutôt que d'acheter mes titres ?", W - 2 * PX)) { text(l, PX, y, C.ink); y += 30; }

    // Trois chiffres clés
    const top100 = c.rankedCounts.slice(0, 100).reduce((a, b) => a + b, 0) / (c.plays || 1);
    const months = Math.max(1, Math.round(c.months));
    const tiles = [[N(c.distinct), `titres différents écoutés en ${months} mois sur Spotify`], [P(top100), "de mon écoute vient de mes 100 titres préférés"], [N(c.favCount), `titres favoris, écoutés ${p.minPlays} fois ou plus`]];
    const tw = (W - 2 * PX - 28) / 3, ty = y + 8, th = 128;
    tiles.forEach(([big, lab], i) => {
      const x = PX + i * (tw + 14); box(x, ty, tw, th, 12, C.white, C.line);
      font(50, 600, MONO); mono(big, x + 20, ty + 60, C.accent, 50);
      font(19); let ly = ty + 92; for (const l of wrap(lab, tw - 40).slice(0, 2)) { text(l, x + 20, ly, C.ink); ly += 24; }
    });

    // Courbe : combien de titres faut-il posséder ?
    const fragile = A.mon.rhythm.fragile && state.kind === "fichier", cy0 = ty + th + 14, ch = fragile ? 272 : 290; box(PX, cy0, W - 2 * PX, ch, 12, C.white, C.line);
    font(28, 600, DISPLAY); text("Combien de titres faut-il posséder ?", PX + 24, cy0 + 40, C.ink);
    font(18); text("Part de mes écoutes de la période couverte si je possède mes titres les plus écoutés", PX + 24, cy0 + 68, C.muted);
    const rc = c.rankedCounts, cum = [0]; for (let i = 0; i < rc.length; i++) cum.push(cum[i] + rc[i]);
    const niceN = v => { const s = [20, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000].find(s => v / s <= 4) || 10000; return Math.ceil(v / s) * s; };
    const xMax = Math.max(20, Math.min(niceN(Math.max(c.favCount, 20) * 1.4), niceN(rc.length)));
    const covAt = n => cum[Math.min(n, rc.length)] / (c.plays || 1);
    const yTop = Math.min(1, Math.ceil((covAt(xMax) + 0.05) * 5) / 5);
    const gx0 = PX + 24 + 46, gx1 = W - PX - 24, gy0 = cy0 + 96, gy1 = cy0 + ch - 44;
    const X = n => gx0 + (gx1 - gx0) * n / xMax, Y = f => gy1 - (gy1 - gy0) * f / yTop;
    font(17); g.lineWidth = 1;
    for (let f = 0; f <= yTop + 1e-9; f += 0.2) { g.strokeStyle = C.line; g.beginPath(); g.moveTo(gx0, Y(f)); g.lineTo(gx1, Y(f)); g.stroke(); text(P(f), gx0 - 10, Y(f) + 6, C.muted, "right"); }
    const stepX = xMax / 4; for (let k = 0; k <= 4; k++) text(k === 4 ? N(xMax) + " titres" : N(Math.round(k * stepX)), X(k * stepX), gy1 + 26, C.muted, k === 0 ? "left" : k === 4 ? "right" : "center");
    const pts = []; const stepN = Math.max(1, Math.round(xMax / 120)); for (let n = 0; n <= xMax; n += stepN) pts.push([X(n), Y(covAt(n))]);
    g.beginPath(); g.moveTo(gx0, gy1); for (const [a, b] of pts) g.lineTo(a, b); g.lineTo(pts[pts.length - 1][0], gy1); g.closePath(); g.fillStyle = "rgba(11,110,102,0.12)"; g.fill();
    g.beginPath(); pts.forEach(([a, b], i) => i ? g.lineTo(a, b) : g.moveTo(a, b)); g.strokeStyle = C.accent; g.lineWidth = 4; g.lineJoin = "round"; g.stroke();
    if (c.favCount > 0 && c.favCount <= xMax) {
      const mx = X(c.favCount), my = Y(covAt(c.favCount));
      g.setLineDash([5, 5]); g.strokeStyle = C.ink; g.lineWidth = 1.5; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx, gy1); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.arc(mx, my, 9, 0, 2 * Math.PI); g.fillStyle = C.accent; g.fill(); g.lineWidth = 3; g.strokeStyle = C.white; g.stroke();
      const right = mx < (gx0 + gx1) * 0.55, ax = right ? mx + 18 : mx - 18, al = right ? "left" : "right";
      const l1 = `${N(c.favCount)} favoris (${E(c.fav.cost)})`, l2 = `couvrent ${P(c.favShare)} de mon écoute`;
      font(21, 600); const w1 = g.measureText(l1).width; font(21); const w2 = g.measureText(l2).width, bwid = Math.max(w1, w2) + 20;
      g.globalAlpha = 0.92; box(right ? ax - 10 : ax - bwid + 10, my + 26, bwid, 62, 6, C.white); g.globalAlpha = 1; // fond clair : le texte reste lisible sur la courbe
      font(21, 600); text(l1, ax, my + 50, C.ink, al);
      font(21); text(l2, ax, my + 76, C.ink, al);
    }

    // Sur les 5 prochaines années : les trois cartes de l'outil, puis les autres façons d'acheter
    const ty0 = cy0 + ch + 14, boxH = H - 146 - ty0; box(PX, ty0, W - 2 * PX, boxH, 12, C.white, C.line);
    const IX = PX + 24, IW = W - 2 * PX - 48;
    font(28, 600, DISPLAY); text("Ce que je paierais sur 5 ans", IX, ty0 + 42, C.ink);
    const dshort = t => new Date(t).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" });
    font(16, 400, SANS, "italic"); let sy = ty0 + 68;
    for (const l of wrap(`${state.kind === "fichier" ? "Mes écoutes" : "Exemple fictif"} du ${dshort(c.from)} au ${dshort(c.to)} · prix belges d'oct. 2026 · milieu de 1 000 simulations`, IW)) { text(l, IX, sy, C.muted); sy += 21; }
    if (fragile) { // pourquoi l'estimation est fragile : un encadré bien visible
      font(17); const lines = wrap("Estimation fragile : " + fragReason(A.mon.rhythm, true), IW - 28).slice(0, 2), nh = 16 + lines.length * 23;
      box(IX, sy - 6, IW, nh, 8, "#FFF3D1"); g.fillStyle = "#6E4E00";
      lines.forEach((l, i) => { if (i === 0) { font(17, 700); const h = "Estimation fragile :"; text(h, IX + 14, sy + 16, "#6E4E00"); const hw = g.measureText(h + " ").width; font(17); text(l.slice(h.length + 1), IX + 14 + hw, sy + 16, "#6E4E00"); } else text(l, IX + 14, sy + 16 + i * 23, "#6E4E00"); });
      sy += nh + 4;
    }
    const H5 = ENGINE_DEFAULTS.horizon;
    const look = x => E(x.sim.cost.mid) + P(x.sim.covAvg.mid);
    const my = x => x.replace(/^Vos /, "Mes ").replace(/ vos /g, " mes ");
    let cards = [], others = [];
    const cheapest = p.subs[0];
    cards.push({ lab: "S'abonner", val: E(cheapest.price * H5), cov: "100 % de mon écoute", det: `${p.subName} à ${sp(eur2.format(cheapest.price))} par mois` });
    if (c.favCount) {
      const favs = S.find(x => x.id === "favs"), every = S.find(x => x.id === "every");
      const other = look(mine) === look(favs) ? every : favs;
      const dup = look(other) === look(mine);
      const shown = new Set(dup ? [] : [other.id]);
      if (!dup) cards.push(other === favs ? { lab: "Acheter mes favoris", val: E(favs.sim.cost.mid), cov: `${P(favs.sim.covAvg.mid)} de mon écoute`, det: `Mes ${N(c.favCount)} favoris d'aujourd'hui, sans nouvel achat` }
        : { lab: "Chaque nouveau favori", val: E(every.sim.cost.mid), cov: `${P(every.sim.covAvg.mid)} de mon écoute`, det: "Mes favoris, puis chaque nouveau" });
      cards.push({ lab: mineLab(true), val: E(mine.sim.cost.mid), cov: `${P(mine.sim.covAvg.mid)} de mon écoute`, det: choiceText(mine, c.favCount, true, true) + (E(mine.sim.cost.low) === E(mine.sim.cost.high) ? "" : ` : entre ${E(mine.sim.cost.low)} et ${E(mine.sim.cost.high)}`), hl: true });
      // les autres façons, sous les cartes
      for (const x of p.subs.slice(1, 3)) others.push([`Abonnement ${x.name}`, "100 %", E(x.price * H5)]);
      for (const x of S) if (!shown.has(x.id) && x.id !== mine.id && look(x) !== look(mine)) others.push([my(x.label), P(x.sim.covAvg.mid), E(x.sim.cost.mid)]);
      others.push([`Tout acheter ce que j'ai écouté en ${Math.max(1, Math.round(c.months))} mois`, "", E(c.all.cost)]);
    } else cards.push({ lab: "Version gratuite", val: E(0), cov: "100 % de mon écoute", det: "avec publicité" });
    const cg = 14, cw2 = (IW - cg * (cards.length - 1)) / cards.length, cy1 = sy + 8, chh = fragile ? 190 : 206;
    cards.forEach((k, i) => {
      const x = IX + i * (cw2 + cg);
      box(x, cy1, cw2, chh, 10, k.hl ? C.soft : C.bg, k.hl ? C.accent : C.line); if (k.hl) { g.lineWidth = 3; g.strokeStyle = C.accent; g.stroke(); }
      font(15, 700); g.save(); let lx = x + 18; for (const ch of k.lab.toUpperCase()) { g.fillStyle = k.hl ? C.accent : C.muted; g.textAlign = "left"; g.fillText(ch, lx, cy1 + 34); lx += g.measureText(ch).width + 1.2; } g.restore();
      const vs = k.val.length > 9 ? 34 : fragile ? 44 : 50; font(vs, 700); text(k.val, x + 18, cy1 + 34 + vs + 12, C.ink);
      font(19, 600); let yy = cy1 + 34 + vs + (fragile ? 38 : 46); for (const l of wrap(k.cov, cw2 - 36).slice(0, 2)) { text(l, x + 18, yy, C.ink); yy += 24; }
      font(15); for (const l of wrap(k.det, cw2 - 36).slice(0, 3)) { text(l, x + 18, yy + 2, C.muted); yy += 19; }
    });
    let oy = cy1 + chh + (fragile ? 28 : 34);
    if (others.length) {
      font(15, 700); text("AUTRES FAÇONS", IX, oy, C.muted); oy += 12;
      const colCov = W - PX - 24 - 130, colCost = W - PX - 24, rowH = Math.min(36, (ty0 + boxH - 10 - oy) / others.length);
      for (const [lab, cov, cost] of others) {
        g.strokeStyle = C.line2; g.lineWidth = 1; g.beginPath(); g.moveTo(IX, oy); g.lineTo(W - PX - 24, oy); g.stroke();
        const mid = oy + rowH / 2 + 7;
        font(19); text(wrap(lab, colCov - 90 - IX)[0], IX, mid, C.ink);
        if (cov) { font(18); text(cov, colCov, mid, C.muted, "right"); }
        font(22, 700); text(cost, colCost, mid, C.ink, "right");
        oy += rowH;
      }
    }
    if (!c.favCount) { font(20, 600); let ny = oy + 10; for (const l of wrap(`Aucun titre écouté ${p.minPlays} fois : acheter ne couvrirait presque rien de mon écoute.`, IW)) { text(l, IX, ny, C.ink); ny += 28; } }

    // Pied : l'invitation à faire le test
    font(26, 700); text("Fais le test avec tes propres données :", PX, H - 92, C.accent);
    const lw = g.measureText("Fais le test avec tes propres données : ").width; text("oneclient.be/outils/musique", PX + lw, H - 92, C.accent);
    g.fillStyle = C.accent; g.fillRect(PX + lw, H - 86, g.measureText("oneclient.be/outils/musique").width, 2);
    font(20); text("Outil gratuit de OneClient. Le calcul se fait sur ton appareil : tes données ne sont envoyées nulle part.", PX, H - 52, C.ink);
    return cv;
  }

  let cardUrl = null;
  async function makeCard() {
    if (!state.last) return;
    // les polices doivent être prêtes avant de dessiner
    try { await Promise.all(['400 20px "Inter"', '600 20px "Inter"', '700 20px "Inter"', '600 84px "Fraunces"'].map(f => document.fonts.load(f))); } catch (e) { /* police de secours */ }
    const cv = drawCard(state.last);
    const blob = await new Promise(r => cv.toBlob(r, "image/png"));
    if (cardUrl) URL.revokeObjectURL(cardUrl);
    cardUrl = URL.createObjectURL(blob);
    $("cardImg").src = cv.toDataURL("image/png"); $("cardImg").hidden = false; $("cardMake").hidden = true; // l'image suit ensuite les réponses toute seule
    $("cardDl").href = cardUrl; $("cardDl").hidden = false;
    state.cardFile = new File([blob], "mon-analyse-musique.png", { type: "image/png" });
    // Partager seulement si l'appareil sait partager un fichier (téléphone, Windows…) ; sinon, Télécharger devient le bouton principal.
    const canShare = !!(navigator.canShare && navigator.canShare({ files: [state.cardFile] }));
    $("cardShare").hidden = !canShare; $("cardDl").classList.toggle("ghostlink", canShare);
  }

  /* TEXTE : abonnement coché sans prix, et aucun prix du tout (4f) */
  function renderSubsNotes(p) {
    document.querySelectorAll("#subsList [data-warn]").forEach(el => { el.hidden = !p.missing.includes(el.dataset.warn); });
    $("subsNote").hidden = !p.fallback;
    $("subsNote").textContent = p.fallback ? `Aucun service comparé n'a de prix : la comparaison se fait avec Spotify Premium, à ${eur2.format(SERVICES["Spotify Premium"])} par mois.` : "";
  }

  let busy = 0;
  function render() {
    const p = params(); renderSubsNotes(p);
    const A = analysis(p);
    if (A.empty) return;
    const T = state.kind === "fichier";
    $("badge").textContent = T ? "Vos données" : "Exemple fictif"; $("badge").className = "badge" + (T ? " mine" : "");
    renderConstat(A, p);
    syncAnswers(A);
    const M = model(A, p);
    renderProfile(A, M);
    const S = strategies(A, M, p), mine = S.find(x => x.id === chosen());
    renderResult(A, M, p, S, mine);
    renderSummary(A, p, S, mine);
    renderLimits(A, M, p);
    state.last = { A, p, M, S, mine };
    if (!$("cardImg").hidden) makeCard(); // l'aperçu suit les réponses
  }
  const later = () => { clearTimeout(busy); busy = setTimeout(render, 120); };

  // ---------- Chargement ----------
  // TEXTE : bouton des résultats détaillés. Nouveau fichier ou exemple : le détail repart caché et replié.
  function setDetail(show) {
    $("resDetail").hidden = !show;
    $("showDetail").textContent = show ? "Masquer les résultats détaillés" : "Voir les résultats détaillés";
    $("showDetail").setAttribute("aria-expanded", String(show));
  }
  function resetDetail() { setDetail(false); document.querySelectorAll("#resDetail details, #resAbout details").forEach(d => { d.open = false; }); }
  function setStatus(msg) { $("status").hidden = !msg; $("status").textContent = msg || ""; }
  function parse() {
    let streams = [];
    for (const e of state.entries) { const r = readExportJson(e.name, e.text); if (r.kind === "streams") streams = streams.concat(r.items); }
    const seen = new Set();
    return streams.filter(s => { const k = s.t + "|" + s.key; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  function loadType() {
    state.gen = { start: $("gStart").value, cruise: $("gCruise").value, perDay: Math.max(1, Math.min(200, parseFloat($("gPerDay").value) || 25)) };
    state.entries = [{ name: "profil-type.json", text: JSON.stringify(genHistory(state.gen)) }];
    state.kind = "type"; state.cruiseTouched = false; state.rhythmTouched = false;
    state.streams = parse(); state.version++; setStatus(""); $("loader").hidden = true; $("results").hidden = false; resetDetail(); render();
  }
  /* Indicateur de progression : les gros fichiers peuvent prendre quelques secondes. */
  const pause = () => new Promise(r => setTimeout(r, 0));
  function progress(step, frac, detail) {
    const order = ["read", "unzip", "parse", "model"], i = order.indexOf(step);
    $("loader").hidden = false; $("loader").classList.toggle("finished", false);
    document.querySelectorAll("#lsteps li").forEach((li, k) => { li.className = k < i ? "done" : k === i ? "now" : ""; });
    $("lfill").style.width = Math.round(((i + Math.min(1, frac)) / order.length) * 100) + "%";
    $("ldetail").textContent = detail || "";
  }
  async function handleFiles(files) {
    setStatus(""); $("lwarn").hidden = true; const t0 = performance.now();
    try {
      progress("read", 0, files.length > 3 ? `Ouverture de ${files.length} fichiers` : "Ouverture de " + files.map(f => f.name).join(", ")); await pause();
      const entries = []; let usedZip = false, skipped = 0;
      for (let i = 0; i < files.length; i++) {
        const f = files[i]; let buf;
        try { buf = await f.arrayBuffer(); } catch (err) { skipped++; continue; } // un dossier que le navigateur n'a pas pu ouvrir
        progress("read", (i + 1) / files.length, `${f.name} : ${num1.format(buf.byteLength / 1048576)} Mo`); await pause();
        if (/\.zip$/i.test(f.name) || new DataView(buf).getUint32(0, true) === 0x04034b50) {
          usedZip = true; progress("unzip", 0, "Décompression en cours…"); await pause();
          entries.push(...await unzipJson(buf, async (k, n, name) => { progress("unzip", k / n, `Décompression en cours… ${name.split("/").pop()}`); await pause(); }));
        } else entries.push({ name: f.name, text: new TextDecoder().decode(buf) });
      }
      if (!entries.length) { $("loader").hidden = true; setStatus(skipped ? "Votre navigateur n'a pas pu ouvrir ce dossier. Ouvrez-le et déposez les fichiers .json qu'il contient, ou déposez le .zip reçu de Spotify." : "Aucun fichier à lire."); return; }
      let streams = [], nRead = 0, nStd = 0;
      for (let i = 0; i < entries.length; i++) {
        progress("parse", i / entries.length, `Analyse des écoutes… fichier ${i + 1} sur ${entries.length}`); await pause();
        const r = readExportJson(entries[i].name, entries[i].text); if (r.kind === "streams") { streams = streams.concat(r.items); nRead++; } else if (r.kind === "standard") nStd++;
      }
      const seen = new Set(); streams = streams.filter(s => { const k = s.t + "|" + s.key; if (seen.has(k)) return false; seen.add(k); return true; });
      if (!streams.length) { $("loader").hidden = true; setStatus(nStd ? "C'est l'export standard : demandez l'historique de streaming étendu." : "Ce fichier ne contient pas d'historique d'écoute de musique. Déposez le .zip complet reçu de Spotify."); return; }
      if (!streams.some(x => x.ms === undefined || x.ms >= 30000)) { $("loader").hidden = true; $("results").hidden = true; setStatus("Aucune écoute de ce fichier ne dure 30 secondes ou plus, et l'outil ne compte que ces écoutes. Vérifiez que vous avez déposé l'historique de streaming étendu."); return; }
      progress("parse", 1, `${num.format(streams.length)} lignes d'écoute lues, sur tout l'historique`); await pause();
      state.entries = entries;
      state.kind = "fichier"; state.cruiseTouched = false; state.rhythmTouched = false;
      state.streams = streams; state.version++; $("cardImg").hidden = true; $("cardDl").hidden = true; $("cardShare").hidden = true; $("cardMake").hidden = false;
      progress("model", 0.2, "Analyse de votre façon d'écouter…"); await pause();
      analysis(params());
      progress("model", 0.6, "Calcul des estimations sur 5 ans…"); await pause();
      $("results").hidden = false; resetDetail(); render();
      // Le récapitulatif reste affiché : on voit que le fichier a bien été traité, même quand tout va très vite.
      const secs = (performance.now() - t0) / 1000;
      let tMin = Infinity, tMax = -Infinity; for (const s of streams) { if (s.t < tMin) tMin = s.t; if (s.t > tMax) tMax = s.t; }
      // Sans .zip, on ne peut pas savoir si tous les fichiers ont été déposés : on le rappelle.
      progress("model", 1, `Terminé en ${num1.format(Math.max(0.1, secs))} s : ${nRead} ${plural(nRead, "fichier d'écoutes lu", "fichiers d'écoutes lus")}, ${num.format(streams.length)} lignes d'écoute.\nHistorique lu : du ${dfmt(tMin)} au ${dfmt(tMax)}.`
      );
      // TEXTE : avertissement bien visible quand le .zip n'a pas été déposé (on ne peut pas savoir s'il manque des fichiers)
      $("lwarn").hidden = usedZip;
      $("lwarn").textContent = usedZip ? "" : "Si ce n'est pas tout votre historique, déposez le .zip complet ou tous les fichiers .json.";
      document.querySelectorAll("#lsteps li").forEach(li => { li.className = "done"; }); $("loader").classList.add("finished");
      $("typeBtn").closest(".example").hidden = true; $("howto").hidden = true; // votre fichier est là : l'exemple ne sert plus
      $("results").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    } catch (e) {
      $("loader").hidden = true;
      setStatus(e && e.message === "nostream" ? "Votre navigateur ne sait pas ouvrir ce .zip. Décompressez-le, puis déposez les fichiers .json qu'il contient."
        : "Ce fichier n'a pas pu être lu. Déposez le .zip reçu de Spotify, sans le modifier, ou les fichiers .json qu'il contient.");
    }
  }

  // ---------- Événements ----------
  $("file").addEventListener("change", e => { if (e.target.files.length) handleFiles([...e.target.files]); e.target.value = ""; });
  const drop = $("drop");
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove("over"); }));
  /* Un dossier déposé (l'export décompressé) est parcouru : on y prend les .json et les .zip. */
  const readDir = dir => new Promise(res => {
    const rd = dir.createReader(), all = [];
    const next = () => rd.readEntries(list => { if (!list.length) return res(all); all.push(...list); next(); }, () => res(all));
    next();
  });
  async function walk(entry, out, top) {
    if (entry.isFile) {
      if (top || /\.(json|zip)$/i.test(entry.name)) { const f = await new Promise((res, rej) => entry.file(res, rej)).catch(() => null); if (f) out.push(f); }
    } else if (entry.isDirectory) for (const e of await readDir(entry)) await walk(e, out, false);
  }
  async function droppedFiles(dt) {
    // Les entrées doivent être lues tout de suite, pendant l'événement.
    const items = [...(dt.items || [])].filter(i => i.kind === "file");
    const entries = items.map(i => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
    if (!entries.length || entries.some(e => !e)) return [...dt.files];
    const out = []; for (const e of entries) await walk(e, out, true); return out;
  }
  drop.addEventListener("drop", async e => {
    const files = await droppedFiles(e.dataTransfer);
    if (files.length) handleFiles(files);
    else setStatus("Ce dossier ne contient ni fichier .json ni fichier .zip. Déposez le .zip reçu de Spotify, ou le dossier « Spotify Extended Streaming History » qu'il contient.");
  });
  const toResults = () => $("results").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  $("typeBtn").addEventListener("click", () => { loadType(); toResults(); });
  ["gStart", "gCruise", "gPerDay"].forEach(id => $(id).addEventListener("change", () => { if (state.kind === "type") loadType(); }));
  ["pTrack", "pAlbum", "pPeriod", "pMin", "pWeeks"].forEach(id => $(id).addEventListener("input", later));
  $("rhythm").addEventListener("input", () => { state.rhythmTouched = true; later(); });
  $("rhythmReset").addEventListener("click", () => { state.rhythmTouched = false; render(); });
  // TEXTE : liste des abonnements comparés (Spotify et Apple Music cochés au départ)
  $("subsList").innerHTML = Object.entries(SERVICES).map(([n, pr], i) => `<div class="subrow"><label class="chk"><input type="checkbox" id="sub${i}" data-sub="${esc(n)}"${n === "Spotify Premium" || n === "Apple Music" ? " checked" : ""}><span>${esc(n)}${n === "Spotify Premium" ? " <small>(le service de votre fichier)</small>" : n === "YouTube Premium" ? " <small>(vidéos comprises)</small>" : ""}</span></label>` +
    `<span class="price"><label for="price${i}" class="vh">Prix de ${esc(n)} par mois</label><input id="price${i}" type="number" step="0.01" min="0" inputmode="decimal" data-price="${esc(n)}" value="${pr ? pr.toFixed(2) : ""}" placeholder="prix"> €</span><p class="subwarn" data-warn="${esc(n)}" aria-live="polite" hidden>Indiquez un prix pour comparer ce service.</p></div>`).join("");
  // TEXTE : le choix d'une façon d'acheter (une seule question)
  $("stratChoice").insertAdjacentHTML("beforeend", STRATS.map(([id, label]) => `<label class="radio"><input type="radio" name="strat" value="${id}"${id === "half" ? " checked" : ""}> ${esc(label)}</label>`).join(""));
  $("subsList").addEventListener("input", e => {
    // indiquer un prix coche le service
    if (e.target.dataset.price !== undefined && e.target.value !== "") document.querySelector(`#subsList input[data-sub="${e.target.dataset.price}"]`).checked = true;
    later();
  });
  $("subsList").addEventListener("change", later);
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.name === "strat") later();
    else if (t.name === "cruise") { state.cruiseTouched = true; later(); }
    else if (t.dataset && t.dataset.q3) { state.q3[t.dataset.q3] = t.value; later(); }
  });
  $("cardMake").addEventListener("click", makeCard);
  // Partager : le menu de partage de l'appareil si possible, sinon l'image copiée, sinon le téléchargement.
  $("cardShare").addEventListener("click", async () => {
    try { await navigator.share({ files: [state.cardFile], title: "Abonnement ou achat ?", text: "Mon analyse : oneclient.be/outils/musique" }); } catch (e) { /* partage annulé */ }
  });
  /* Les graphiques se dessinent à la largeur réelle : on les redessine quand leur bloc s'ouvre. */
  function redrawCharts() {
    const L = state.last; if (!L) return;
    const subName = L.p.subName;
    if ($("detEcoute").open) renderMonths(L.A, L.A.c);
    if ($("detStrat").open) renderFan(L.mine, L.p.subPrice * ENGINE_DEFAULTS.horizon, subName, L.p);
  }
  $("showDetail").addEventListener("click", () => {
    const show = $("resDetail").hidden; setDetail(show);
    if (show) $("resDetail").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  });
  ["detEcoute", "detStrat"].forEach(id => $(id).addEventListener("toggle", redrawCharts));
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-open]"); if (!t) return;
    const d = $(t.dataset.open); if ($("resDetail").contains(d)) setDetail(true);
    if (d.tagName === "DETAILS") d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  let lastW = 0, rt = 0;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { const w = document.documentElement.clientWidth; if (Math.abs(w - lastW) > 30) { lastW = w; redrawCharts(); } }, 150); });
  if (window.matchMedia) window.matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", render);
}
