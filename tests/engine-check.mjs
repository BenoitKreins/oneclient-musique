// Contrôle du moteur sur l'exemple fictif par défaut (genHistory sans argument).
// Titre 1,29 €, album 10,99 €, abonnement 11,99 €, période 12 mois, seuil 5 écoutes.
// Si un chiffre bouge, le calcul a changé : à justifier dans docs/CHANGELOG.md.
import fs from 'fs';
const dir = new URL('../src/', import.meta.url);
const E = new Function(fs.readFileSync(new URL('engine.js', dir), 'utf8') + '; return {ENGINE_DEFAULTS, genHistory, readExportJson, prepare, constat, periods, monthly, renewal, strategy, simulate};')();
const items = E.readExportJson('exemple.json', JSON.stringify(E.genHistory())).items;
const P = { ...E.ENGINE_DEFAULTS, period: '12', track: 1.29, album: 10.99, minPlays: 5, minWeeks: 1 };
const prep = E.prepare(items), c = E.constat(prep, P), per = E.periods(prep, P), mon = E.monthly(prep, per, P), ren = E.renewal(prep, per, P);
const M = { pool: mon.pool.map(x => x.newFavs), r: ren.r, D: 1 - c.favShare, favCounts: c.favCounts, favCost: c.fav.cost, factor: 1, shapeInfo: null };
const ctx = { favCounts: c.favCounts, subPrice: 11.99, track: 1.29 };
const got = { favoris: c.favCount, part: +(c.favShare * 100).toFixed(1), acheter: Math.round(c.fav.cost) };
for (const id of ['favs', 'half', 'every', 'build']) { const r = E.simulate(M, E.strategy(id, ctx), ctx); got[id] = [Math.round(r.cost.mid), Math.round(r.cost.low), Math.round(r.cost.high)]; got[id + '_graphique'] = Math.round(r.pathBand[60].mid); }
const want = { favoris: 96, part: 60.3, acheter: 124, favs: [124, 124, 124], favs_graphique: 124, half: [365, 263, 464], half_graphique: 365, every: [606, 404, 805], every_graphique: 606, build: [604, 404, 697], build_graphique: 604 };
let ok = true;
for (const k of Object.keys(want)) { const a = JSON.stringify(got[k]), b = JSON.stringify(want[k]); if (a !== b) ok = false; console.log((a === b ? '✓ ' : '✗ ') + k.padEnd(16) + a + (a === b ? '' : '  attendu ' + b)); }
process.exit(ok ? 0 : 1);
