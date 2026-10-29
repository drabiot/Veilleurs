/* ══ compare.js — logique pure du comparateur de builds ══
   Entrée : les builds publiés (champ `statsSnapshot` = maxs de computeStats() de l'Atelier, valeurs non nulles)
   et STAT_GROUPS (Compendium/data.js). Aucun accès DOM : testable sous Node (module.exports).
*/
(function (root) {
  'use strict';

  function round2(n) { return Math.round(n * 100) / 100; }
  function val(b, id) { var v = b && b.statsSnapshot ? b.statsSnapshot[id] : 0; return typeof v === 'number' && isFinite(v) ? v : 0; }

  /* Unité d'une stat dans les totaux : la vitesse d'attaque s'affiche en % (comme le panneau de l'Atelier) */
  function unitOf(stat) { return stat.id === 'vitesse_attaque' ? '%' : (stat.unit || ''); }

  /* Compare les builds stat par stat, groupe par groupe.
     refIdx : colonne de référence pour les deltas.
     Retourne [{ label, rows: [{ stat, values[], deltas[], best[], worst[], diff }] }] — groupes sans valeur omis. */
  function compareStats(builds, groups, refIdx) {
    refIdx = refIdx >= 0 && refIdx < builds.length ? refIdx : 0;
    var out = [];
    groups.forEach(function (g) {
      var rows = [];
      g.stats.forEach(function (stat) {
        var values = builds.map(function (b) { return round2(val(b, stat.id)); });
        if (values.every(function (v) { return v === 0; })) return;
        var max = Math.max.apply(null, values), min = Math.min.apply(null, values);
        var diff = max !== min;
        rows.push({
          stat: stat,
          values: values,
          deltas: values.map(function (v) { return round2(v - values[refIdx]); }),
          best:  values.map(function (v) { return diff && v === max; }),
          worst: values.map(function (v) { return diff && v === min; }),
          diff: diff,
        });
      });
      if (rows.length) out.push({ label: g.label, rows: rows });
    });
    return out;
  }

  /* Score pondéré : Σ poids × valeur / stat.max (échelle du jeu → poids comparables entre Santé et un %).
     weights : { statId: nombre >= 0 }. Retourne [{ score, pct, top[] }] ; pct = score rapporté au meilleur (0-100). */
  function scoreBuilds(builds, weights, allStats) {
    var res = builds.map(function (b) {
      var score = 0, parts = [];
      allStats.forEach(function (stat) {
        var w = +weights[stat.id] || 0;
        if (!w) return;
        var c = w * val(b, stat.id) / (stat.max || 100);
        score += c;
        if (c) parts.push({ stat: stat, contrib: c });
      });
      parts.sort(function (a, b) { return b.contrib - a.contrib; });
      return { score: round2(score * 100), top: parts.slice(0, 3) };
    });
    var best = Math.max.apply(null, res.map(function (r) { return r.score; }));
    res.forEach(function (r) { r.pct = best > 0 ? Math.max(0, Math.round(r.score / best * 100)) : 0; });
    res.winner = -1;
    if (best > 0) {
      var winners = res.map(function (r, i) { return r.score === best ? i : -1; }).filter(function (i) { return i >= 0; });
      if (winners.length === 1) res.winner = winners[0];
    }
    return res;
  }

  /* Profils de pondération prêts à l'emploi */
  var PRESETS = {
    'Dégâts':  { degats: 3, degats_physique: 1, degats_arme: 1, degats_magique: 1, degats_competence: 1, degats_projectile: 1, vitesse_attaque: 2, crit_chance: 1.5, crit_degats: 1.5, crit_comp_chance: 1, crit_comp_degats: 1 },
    'Tank':    { sante: 3, defense: 3, blocage: 1.5, puissance_bloc: 1, durabilite_garde: 1, reduction_degats: 2, tenacite: 1, res_recul: 0.5, chance_parade: 1, regen_sante: 1 },
    'Soutien': { puissance_soin: 3, soin_bonus: 2, soins_recus: 1, regen_mana: 1.5, mana: 1.5, hate: 1.5, regen_sante: 1 },
    'Mobilité': { vitesse_deplacement: 3, vitesse_accroupi: 1, esquive: 2, stamina: 1.5, regen_stamina: 1.5, hate: 1 },
  };

  var api = { compareStats: compareStats, scoreBuilds: scoreBuilds, unitOf: unitOf, round2: round2, PRESETS: PRESETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VCLCompare = api;
})(typeof window !== 'undefined' ? window : globalThis);
