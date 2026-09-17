(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad2 = (n) => String(n).padStart(2, '0');
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const PREFIX = 'parchem:v1:';
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(PREFIX + k);
        return v == null ? d : JSON.parse(v);
      } catch { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch { /* storage unavailable */ }
    },
    del(k) {
      try { localStorage.removeItem(PREFIX + k); } catch { /* storage unavailable */ }
    },
  };

  function seedFrom(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h | 0;
  }

  // mulberry32
  function makeRng(state) {
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  function shuffle(a, rng) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------------------------------------------------------------------------
  // Chemistry
  // ---------------------------------------------------------------------------
  // symbol: [atomic number, name, tile tint]. "_" is a blank tile.
  const BLANK = '_';
  const ELEMENTS = {
    _: [0, 'Blank', ''],
    H: [1, 'Hydrogen', '#9fb3cc'],
    C: [6, 'Carbon', '#6b7280'],
    N: [7, 'Nitrogen', '#3b82f6'],
    O: [8, 'Oxygen', '#ef4444'],
    F: [9, 'Fluorine', '#84cc16'],
    Na: [11, 'Sodium', '#a855f7'],
    Mg: [12, 'Magnesium', '#14b8a6'],
    Al: [13, 'Aluminium', '#94a3b8'],
    Si: [14, 'Silicon', '#d4a373'],
    P: [15, 'Phosphorus', '#f97316'],
    S: [16, 'Sulfur', '#eab308'],
    Cl: [17, 'Chlorine', '#22c55e'],
    K: [19, 'Potassium', '#8b5cf6'],
    Ca: [20, 'Calcium', '#0f766e'],
    Fe: [26, 'Iron', '#c2410c'],
    Zn: [30, 'Zinc', '#64748b'],
    I: [53, 'Iodine', '#7e22ce'],
  };

  // [id, common name, emoji, formula, fact]. Ids are saved with games: never rename one.
  const COMPOUNDS = [
    ['salt', 'Table salt', '🧂', 'NaCl', 'Sodium chloride. Seasoning, preserving and de-icing since ancient times.'],
    ['hydrogen', 'Hydrogen', '🎈', 'H₂', 'The lightest gas there is. The Sun is mostly hydrogen.'],
    ['oxygen', 'Oxygen', '🫁', 'O₂', 'About 21% of every breath you take.'],
    ['nitrogen', 'Nitrogen', '❄️', 'N₂', 'About 78% of the air. As a liquid it boils at −196 °C.'],
    ['chlorine', 'Chlorine', '🏊', 'Cl₂', 'A yellow-green gas used to disinfect drinking water.'],
    ['monoxide', 'Carbon monoxide', '🚨', 'CO', 'Colourless, odourless and toxic. The reason homes have CO alarms.'],
    ['stomach', 'Stomach acid', '🍽️', 'HCl', 'Hydrochloric acid. Your stomach makes it to digest food.'],
    ['quicklime', 'Quicklime', '🔥', 'CaO', 'Calcium oxide. Gets fiercely hot when mixed with water.'],
    ['magnesia', 'Magnesia', '🧱', 'MgO', 'Magnesium oxide. Lines furnaces and settles upset stomachs.'],
    ['iodine', 'Iodine', '🩹', 'I₂', 'Gives off purple vapour; dissolved, it is a brown antiseptic.'],
    ['zincoxide', 'Zinc oxide', '🧴', 'ZnO', 'The white stuff in mineral sunscreen.'],
    ['fluoride', 'Fluoride', '🪥', 'NaF', 'Sodium fluoride. Added to toothpaste to fight cavities.'],

    ['water', 'Water', '💧', 'H₂O', 'The only common substance found naturally as solid, liquid and gas.'],
    ['dryice', 'Dry ice', '🧊', 'CO₂', 'Solid carbon dioxide. It skips the liquid stage and turns straight to fog.'],
    ['ozone', 'Ozone', '🌍', 'O₃', 'High in the sky, a layer of it blocks ultraviolet light.'],
    ['laughing', 'Laughing gas', '😂', 'N₂O', 'Nitrous oxide. Dentists use it to take the edge off.'],
    ['rottenegg', 'Rotten-egg gas', '🥚', 'H₂S', 'Hydrogen sulfide. You can smell it at under one part per billion.'],
    ['so2', 'Sulfur dioxide', '🌋', 'SO₂', 'Volcanoes puff it out; winemakers add a pinch as a preservative.'],
    ['smog', 'Smog gas', '🏙️', 'NO₂', 'Nitrogen dioxide. The brown tint in city smog.'],
    ['prussic', 'Prussic acid', '🍑', 'HCN', 'Hydrogen cyanide. Smells of bitter almonds and is deadly.'],
    ['lye', 'Lye', '🧼', 'NaOH', 'Sodium hydroxide. Turns fat into soap and unclogs drains.'],
    ['causticpotash', 'Caustic potash', '🫧', 'KOH', 'Potassium hydroxide. Makes soft and liquid soaps.'],
    ['quartz', 'Quartz', '🏖️', 'SiO₂', 'Silicon dioxide: sand, glass and quartz crystals.'],
    ['roadsalt', 'Road salt', '🛣️', 'CaCl₂', 'Calcium chloride. Melts ice even at −30 °C.'],
    ['bleach', 'Bleach', '🧺', 'NaClO', 'Sodium hypochlorite, the active part of household bleach.'],
    ['foolsgold', "Fool's gold", '🪙', 'FeS₂', 'Pyrite. Shiny, brassy and worthless to a prospector.'],
    ['fluorite', 'Fluorite', '🔮', 'CaF₂', 'The mineral that gave fluorescence its name.'],

    ['ammonia', 'Ammonia', '🌱', 'NH₃', 'Made by the million tonnes to fertilise the crops that feed the world.'],
    ['peroxide', 'Peroxide', '🫧', 'H₂O₂', 'Hydrogen peroxide. Bleaches hair and fizzes on cuts.'],
    ['acetylene', 'Acetylene', '👨‍🏭', 'C₂H₂', 'Burns hot enough to cut steel in a welding torch.'],
    ['formaldehyde', 'Formaldehyde', '🫙', 'CH₂O', 'Preserves specimens in biology labs.'],
    ['phosphine', 'Phosphine', '🐟', 'PH₃', 'A toxic gas that smells of garlic or rotting fish.'],
    ['whitephos', 'White phosphorus', '✨', 'P₄', 'Glows in the dark and bursts into flame in air.'],
    ['so3', 'Sulfur trioxide', '☁️', 'SO₃', 'Add water and you get sulfuric acid. The culprit in acid rain.'],

    ['methane', 'Methane', '🐄', 'CH₄', 'Natural gas. Cows burp out a lot of it.'],
    ['chalk', 'Chalk', '🖍️', 'CaCO₃', 'Calcium carbonate: chalk, limestone, marble and seashells.'],
    ['nitric', 'Nitric acid', '⚗️', 'HNO₃', 'A strong acid. Turns skin yellow on contact.'],
    ['rust', 'Rust', '🔩', 'Fe₂O₃', 'Iron oxide. Also the red pigment of Mars.'],
    ['sapphire', 'Sapphire', '💎', 'Al₂O₃', 'Aluminium oxide. Add a trace of chromium and it is a ruby.'],
    ['chloroform', 'Chloroform', '😴', 'CHCl₃', 'An early surgical anaesthetic, long since retired.'],
    ['formic', 'Formic acid', '🐜', 'HCOOH', 'The sting in an ant bite. Its name comes from the Latin for ant.'],
    ['slakedlime', 'Slaked lime', '🪣', 'Ca(OH)₂', 'Calcium hydroxide. Hardens into limestone in old mortar.'],
    ['saltpeter', 'Saltpeter', '🎆', 'KNO₃', 'Potassium nitrate. The oxidiser in gunpowder.'],
    ['milkmag', 'Milk of magnesia', '🥛', 'Mg(OH)₂', 'Magnesium hydroxide. A classic antacid.'],

    ['ethylene', 'Ethylene', '🍌', 'C₂H₄', 'A plant hormone that makes fruit ripen.'],
    ['bakingsoda', 'Baking soda', '🧁', 'NaHCO₃', 'Sodium bicarbonate. Releases CO₂ to make cakes rise.'],
    ['methanol', 'Wood alcohol', '🪵', 'CH₃OH', 'Methanol. Once distilled from wood, and poisonous to drink.'],
    ['carbonic', 'Carbonic acid', '🥤', 'H₂CO₃', 'Forms when CO₂ dissolves in water. The tang in fizzy drinks.'],
    ['hydrazine', 'Hydrazine', '🚀', 'N₂H₄', 'Fuel for spacecraft thrusters.'],
    ['washingsoda', 'Washing soda', '👕', 'Na₂CO₃', 'Sodium carbonate. Softens water for laundry.'],
    ['potash', 'Potash', '🌳', 'K₂CO₃', 'Potassium carbonate, once made by soaking wood ashes in pots.'],
    ['epsom', 'Epsom salt', '🛁', 'MgSO₄', 'Magnesium sulfate. Bath salts for sore muscles.'],
    ['salammoniac', 'Sal ammoniac', '🍬', 'NH₄Cl', 'Ammonium chloride. Salty liquorice gets its bite from it.'],

    ['sulfuric', 'Battery acid', '🔋', 'H₂SO₄', 'Sulfuric acid, the most produced industrial chemical on Earth.'],
    ['methylamine', 'Methylamine', '🦑', 'CH₃NH₂', 'Smells fishy. A building block for many drugs and dyes.'],
    ['acetaldehyde', 'Acetaldehyde', '🤕', 'CH₃CHO', 'What your liver turns alcohol into. A big part of a hangover.'],
    ['sf6', 'Deep-voice gas', '🎤', 'SF₆', 'Sulfur hexafluoride. So dense it makes your voice drop.'],
    ['lodestone', 'Lodestone', '🧲', 'Fe₃O₄', 'Magnetite. Naturally magnetic; the first compasses used it.'],
    ['saltcake', 'Salt cake', '📄', 'Na₂SO₄', 'Sodium sulfate. Used by the tonne to make paper and detergent.'],

    ['ethane', 'Ethane', '⛽', 'C₂H₆', 'The second-biggest part of natural gas.'],
    ['vinegar', 'Vinegar', '🥗', 'CH₃COOH', 'Acetic acid gives vinegar its sour bite.'],
    ['cola', 'Cola acid', '🥫', 'H₃PO₄', 'Phosphoric acid. Gives cola its tang.'],
    ['urea', 'Urea', '🚽', 'CO(NH₂)₂', 'The first natural compound made in a lab, in 1828.'],
    ['brimstone', 'Brimstone', '😈', 'S₈', 'Sulfur. Its atoms link up in crown-shaped rings of eight.'],

    ['ethanol', 'Alcohol', '🍺', 'C₂H₅OH', 'Ethanol. Yeast makes it from sugar.'],
    ['propylene', 'Propylene', '🥣', 'C₃H₆', 'Propene. Turned into the plastic of yoghurt pots.'],
    ['ammoniumnitrate', 'Ammonium nitrate', '🌾', 'NH₄NO₃', 'A common fertiliser, and a powerful oxidiser.'],

    ['acetone', 'Acetone', '💅', '(CH₃)₂CO', 'Nail polish remover.'],
    ['antifreeze', 'Antifreeze', '🚗', 'C₂H₄(OH)₂', 'Ethylene glycol. Keeps car engines from freezing.'],
    ['glycine', 'Glycine', '🧬', 'NH₂CH₂COOH', 'The simplest amino acid.'],
  ];

  // Where long names may break in narrow headers ("|" becomes a soft hyphen).
  const BREAKS = [
    'Formal|dehyde', 'Acet|aldehyde', 'Acetyl|ene', 'Chloro|form', 'Methyl|amine', 'Hydra|zine', 'Phos|phine',
    'Propyl|ene', 'Ethyl|ene', 'Anti|freeze', 'Quick|lime', 'Lode|stone', 'Brim|stone', 'Salt|peter', 'Per|oxide',
    'Fluor|ide', 'Fluor|ite', 'Hydro|gen', 'Nitro|gen', 'Mag|nesia', 'Mon|oxide', 'Di|oxide', 'Tri|oxide',
    'Sap|phire', 'Am|monia', 'Am|moniac', 'Am|monium', 'Carbon|ic', 'Phos|phorus', 'Sul|fur', 'Sul|furic', 'Ni|trate',
  ].map((w) => [w.replace('|', ''), w.replace('|', '\u00ad')]);
  const breakable = (name) => name.replace(/[A-Za-z]+/g, (w) => {
    const hit = BREAKS.find(([plain]) => plain.toLowerCase() === w.toLowerCase());
    return hit ? w.slice(0, hit[1].indexOf('\u00ad')) + '\u00ad' + w.slice(hit[1].indexOf('\u00ad')) : w;
  });

  const SUBS = '₀₁₂₃₄₅₆₇₈₉';
  function parseFormula(f) {
    const stack = [{}];
    let i = 0;
    const count = () => {
      let s = '';
      while (i < f.length && SUBS.includes(f[i])) s += SUBS.indexOf(f[i++]);
      return s ? Number(s) : 1;
    };
    const add = (into, el, k) => { into[el] = (into[el] || 0) + k; };
    while (i < f.length) {
      if (f[i] === '(') {
        stack.push({});
        i++;
      } else if (f[i] === ')') {
        i++;
        const inner = stack.pop();
        const k = count();
        for (const [el, c] of Object.entries(inner)) add(stack[stack.length - 1], el, c * k);
      } else {
        const m = f.slice(i).match(/^[A-Z][a-z]?/);
        if (!m || !ELEMENTS[m[0]]) throw new Error(`Bad formula ${f}`);
        i += m[0].length;
        add(stack[stack.length - 1], m[0], count());
      }
    }
    return stack[0];
  }

  const MOLS = COMPOUNDS.map(([id, name, emoji, formula, fact]) => {
    const atoms = parseFormula(formula);
    const size = Object.values(atoms).reduce((a, b) => a + b, 0);
    return { id, name, label: breakable(name), emoji, formula, fact, atoms, size };
  });
  const MOL = Object.fromEntries(MOLS.map((m) => [m.id, m]));
  // ---------------------------------------------------------------------------
  // Holes
  // ---------------------------------------------------------------------------
  // Each hole is a grid where every row and column holds exactly the atoms of
  // its compound (blanks fill the rest), scrambled by a few neighbour swaps.
  // Par is the fewest swaps that solve it, found by search.
  const COURSE = [
    { n: 3, mix: 2 }, { n: 3, mix: 3 }, { n: 3, mix: 3 },
    { n: 4, mix: 3 }, { n: 4, mix: 4 }, { n: 4, mix: 5 },
    { n: 5, mix: 5 }, { n: 5, mix: 6 }, { n: 5, mix: 7 },
  ];
  const PICKUP_PENALTY = 5;
  const PEEK_COST = 1;
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  const lineKeys = (n) => [...range(n).map((i) => `r${i}`), ...range(n).map((i) => `c${i}`)];
  const lineCells = (n, key) => {
    const i = Number(key.slice(1));
    return key[0] === 'r' ? range(n).map((c) => i * n + c) : range(n).map((r) => r * n + i);
  };
  const lineName = (key) => `${key[0] === 'r' ? 'row' : 'column'} ${Number(key.slice(1)) + 1}`;

  // How far a line is from its compound: the number of tiles that would have
  // to change. 0 means made; blanks count as tiles.
  function lineMiss(n, v, key, m) {
    const want = { ...m.atoms, [BLANK]: n - m.size };
    let extra = 0;
    for (const idx of lineCells(n, key)) {
      const el = v[idx];
      if (want[el] > 0) want[el] -= 1;
      else extra += 1;
    }
    return extra;
  }

  function buildGrid(n, rng) {
    const pool = MOLS.filter((m) => m.size >= 2 && m.size <= n);
    const byKey = new Map(pool.map((m) => [Object.keys(m.atoms).sort().map((e) => e + m.atoms[e]).join(''), m]));
    const weights = pool.map((m) => m.size * m.size);
    const totalW = weights.reduce((a, b) => a + b, 0);
    const pickMol = () => {
      let x = rng() * totalW;
      return pool[weights.findIndex((w) => (x -= w) < 0)] || pool[pool.length - 1];
    };
    const rowCells = (m) => {
      const cells = [];
      for (const [el, c] of Object.entries(m.atoms)) for (let k = 0; k < c; k++) cells.push(el);
      while (cells.length < n) cells.push(BLANK);
      return shuffle(cells, rng);
    };
    const columns = (grid) => range(n).map((c) => {
      const counts = {};
      for (let r = 0; r < n; r++) {
        const el = grid[r][c];
        if (el !== BLANK) counts[el] = (counts[el] || 0) + 1;
      }
      return byKey.get(Object.keys(counts).sort().map((e) => e + counts[e]).join('')) || null;
    });
    // Columns that are real compounds. No compound repeats among the rows or
    // among the columns (one row and one column may share, which keeps 3×3
    // boards varied: all-different allows only a handful of them).
    const score = (rows, grid) => {
      let s = new Set(rows.map((m) => m.id)).size - n;
      const seen = new Set();
      for (const m of columns(grid)) {
        if (m && !seen.has(m.id)) {
          seen.add(m.id);
          s += 1;
        }
      }
      return s;
    };
    for (;;) {
      const rows = range(n).map(pickMol);
      const grid = rows.map(rowCells);
      let best = score(rows, grid);
      for (let it = 0; it < 4000 && best < n; it++) {
        const r = randInt(rng, 0, n - 1);
        const keepRow = grid[r].slice();
        const keepMol = rows[r];
        if (rng() < 0.15) {
          rows[r] = pickMol();
          grid[r] = rowCells(rows[r]);
        } else {
          const a = randInt(rng, 0, n - 1);
          const b = randInt(rng, 0, n - 1);
          [grid[r][a], grid[r][b]] = [grid[r][b], grid[r][a]];
        }
        const s = score(rows, grid);
        if (s >= best || rng() < 0.02) best = s;
        else {
          grid[r] = keepRow;
          rows[r] = keepMol;
        }
      }
      if (best === n) return { v: grid.flat(), rows: rows.map((m) => m.id), cols: columns(grid).map((m) => m.id) };
    }
  }

  const swapsOf = (n) => {
    const out = [];
    for (let a = 0; a < n * n; a++) {
      if (a % n < n - 1) out.push([a, a + 1]);
      if (a + n < n * n) out.push([a, a + n]);
    }
    return out;
  };

  // Fewest swaps to solve, by iterative deepening. A sideways swap only
  // changes two columns and an up-down swap only two rows, so half the broken
  // rows plus half the broken columns (rounded up) never overestimates.
  // Returns null if it takes more than `limit`.
  function fewestSwaps(hole, v, limit) {
    const { n } = hole;
    const mols = lineKeys(n).map((k) => MOL[hole.targets[k]]);
    const keys = lineKeys(n);
    const broken = keys.map((k, i) => lineMiss(n, v, k, mols[i]) > 0);
    const swaps = swapsOf(n);
    const bound = () => {
      let r = 0;
      let c = 0;
      for (let i = 0; i < n; i++) {
        if (broken[i]) r++;
        if (broken[n + i]) c++;
      }
      return Math.ceil(r / 2) + Math.ceil(c / 2);
    };
    const touched = (a, b) => (b === a + 1 ? [n + (a % n), n + (b % n)] : [Math.floor(a / n), Math.floor(b / n)]);
    let nodes = 0;
    const dfs = (depth, last) => {
      const h = bound();
      if (h === 0) return true;
      if (h > depth || ++nodes > 400000) return false;
      for (let s = 0; s < swaps.length; s++) {
        if (s === last) continue;
        const [a, b] = swaps[s];
        if (v[a] === v[b]) continue;
        const [x, y] = touched(a, b);
        if (!broken[x] && !broken[y]) continue;
        [v[a], v[b]] = [v[b], v[a]];
        const bx = broken[x];
        const by = broken[y];
        broken[x] = lineMiss(n, v, keys[x], mols[x]) > 0;
        broken[y] = lineMiss(n, v, keys[y], mols[y]) > 0;
        const ok = dfs(depth - 1, s);
        [v[a], v[b]] = [v[b], v[a]];
        broken[x] = bx;
        broken[y] = by;
        if (ok) return true;
      }
      return false;
    };
    v = v.slice();
    for (let d = bound(); d <= limit; d++) {
      if (dfs(d, -1)) return d;
      if (nodes > 400000) return null;
    }
    return null;
  }

  function makeHole(courseId, index) {
    const { n, mix } = COURSE[index];
    const rng = makeRng(seedFrom(`parchem:${courseId}:${index}`));
    const grid = buildGrid(n, rng);
    const targets = {};
    lineKeys(n).forEach((k, i) => { targets[k] = i < n ? grid.rows[i] : grid.cols[i - n]; });
    const hole = { n, targets, solution: grid.v };
    const swaps = swapsOf(n);
    let best = null;
    // Try a few scrambles and keep the one that takes the most swaps to undo.
    for (let attempt = 0; attempt < 8 && !(best && best.par === mix); attempt++) {
      const v = grid.v.slice();
      let last = -1;
      for (let k = 0; k < mix;) {
        const s = randInt(rng, 0, swaps.length - 1);
        const [a, b] = swaps[s];
        if (s === last || v[a] === v[b]) continue;
        [v[a], v[b]] = [v[b], v[a]];
        last = s;
        k++;
      }
      const made = lineKeys(n).filter((key) => !lineMiss(n, v, key, MOL[targets[key]])).length;
      if (made === 2 * n) continue;
      const par = fewestSwaps(hole, v, mix - 1) ?? mix;
      if (!best || par > best.par || (par === best.par && made < best.made)) best = { v, par, made };
    }
    hole.start = best.v;
    hole.par = best.par;
    return hole;
  }

  // Course ids: "d:2026-09-16" for a daily, "c:K3F9QZ" for a coded course.
  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  const dailyId = () => `d:${dateKey()}`;
  function parseId(id) {
    const [kind, a] = String(id).split(':');
    if (kind === 'd' && /^\d{4}-\d{2}-\d{2}$/.test(a)) return { daily: true, date: a };
    if (kind === 'c' && /^[A-Z0-9]{4,8}$/.test(a)) return { daily: false, code: a };
    return null;
  }
  function parseCode(raw) {
    const code = String(raw).toUpperCase().replace(/\s+/g, '');
    return /^[A-Z0-9]{4,8}$/.test(code) ? `c:${code}` : null;
  }
  function randomCode() {
    const bytes = new Uint32Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  }
  function prettyDate(key, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
  }
  function courseLabel(id) {
    const p = parseId(id);
    return p.daily ? `Daily · ${prettyDate(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}` : `Course ${p.code}`;
  }
  const SITE = 'https://parchem.tryonlinux.com/';
  function courseUrl(id) {
    const p = parseId(id);
    const base = location.protocol.startsWith('http') ? new URL('./', location.href).href : SITE;
    return p.daily ? base : `${base}?c=${p.code}`;
  }
  const toParStr = (d) => (d === 0 ? 'E' : d > 0 ? `+${d}` : `−${-d}`);
  const toParClass = (d) => (d < 0 ? 'under' : d > 0 ? 'over' : 'even');

  // Test hook: node can load this file with a stub window to check the holes.
  if (typeof window.__parchemTest === 'function') {
    window.__parchemTest({ MOLS, MOL, COURSE, makeHole, fewestSwaps, lineMiss, lineKeys });
    return;
  }

  // ---------------------------------------------------------------------------
  // State & persistence
  // ---------------------------------------------------------------------------
  const DEFAULT_SETTINGS = { colors: true, moves: true, near: true, sound: false };
  const settings = { ...DEFAULT_SETTINGS, ...store.get('settings', {}) };

  let course = null; // saved progress
  let holes = []; // generated from the course id; never saved
  let selected = null;
  let focusIdx = 0;
  let epoch = 0;
  let infoKey = null;

  const hole = () => holes[course.cur];
  const hs = () => course.holes[course.cur];
  const liveStrokes = (st) => st.swaps + st.peeks.length * PEEK_COST;

  function freshHoleState(h) {
    return { v: h.start.slice(), swaps: 0, peeks: [], done: false, picked: false, score: 0 };
  }

  function validCourse(c, id) {
    return c && c.id === id && Array.isArray(c.holes) && c.holes.length === COURSE.length
      && Number.isInteger(c.cur) && c.cur >= 0 && c.cur < COURSE.length
      && c.holes.every((st, i) => st && Array.isArray(st.v) && st.v.length === COURSE[i].n ** 2
        && st.v.every((el) => ELEMENTS[el]) && Array.isArray(st.peeks) && Number.isFinite(st.swaps));
  }

  function save() {
    store.set(`course:${course.id}`, course);
    store.set('current', course.id);
    const recent = store.get('courses', []).filter((x) => x !== course.id);
    recent.unshift(course.id);
    const keep = recent.slice(0, 12);
    if (recent.includes(dailyId()) && !keep.includes(dailyId())) keep.push(dailyId());
    recent.filter((old) => !keep.includes(old)).forEach((old) => store.del(`course:${old}`));
    store.set('courses', keep);
  }

  function loadCourse(id) {
    holes = COURSE.map((_, i) => makeHole(id, i));
    const saved = store.get(`course:${id}`, null);
    // A saved hole only resumes if it still holds the same tiles as its generated start.
    const same = validCourse(saved, id) && saved.holes.every((st, i) => [...st.v].sort().join() === [...holes[i].start].sort().join());
    course = same ? saved : { id, cur: 0, holes: holes.map(freshHoleState), recorded: false };
    epoch += 1;
    selected = null;
    focusIdx = 0;
    disarm();
    const p = parseId(id);
    const search = p.daily ? '' : `?c=${p.code}`;
    if (location.search !== search) {
      try { history.replaceState(null, '', search || location.pathname); } catch { /* file:// pages can't rewrite the URL */ }
    }
    save();
    buildBoard();
    render();
  }

  const roundTotals = () => {
    let strokes = 0;
    let par = 0;
    let played = 0;
    course.holes.forEach((st, i) => {
      if (!st.done) return;
      strokes += st.score;
      par += holes[i].par;
      played += 1;
    });
    return { strokes, toPar: strokes - par, played };
  };
  const totalPar = () => holes.reduce((s, h) => s + h.par, 0);
  const courseDone = () => course.holes.every((st) => st.done);

  function recordRound() {
    if (course.recorded || !courseDone()) return {};
    course.recorded = true;
    const p = parseId(course.id);
    const { strokes, toPar } = roundTotals();
    const out = {};
    if (p.daily) {
      const daily = store.get('daily', {});
      if (daily[p.date]) out.replay = daily[p.date].toPar;
      else {
        daily[p.date] = { strokes, toPar, grid: emojiGrid() };
        store.set('daily', daily);
      }
    }
    const rounds = store.get('rounds', []);
    const firsts = rounds.filter((r) => !r.replay);
    const prevBest = firsts.length ? Math.min(...firsts.map((r) => r.toPar)) : null;
    if (out.replay == null && prevBest != null && toPar < prevBest) out.newBest = true;
    rounds.unshift({ id: course.id, strokes, toPar, par: totalPar(), at: Date.now(), replay: out.replay != null });
    store.set('rounds', rounds.slice(0, 40));
    save();
    return out;
  }

  function noteMade(ids) {
    const book = store.get('notebook', {});
    const firsts = ids.filter((id) => !book[id]);
    for (const id of ids) book[id] = (book[id] || 0) + 1;
    store.set('notebook', book);
    return firsts;
  }

  function roundStats() {
    const rounds = store.get('rounds', []);
    const daily = store.get('daily', {});
    const days = Object.keys(daily).sort();
    const dayNum = (key) => {
      const [y, m, d] = key.split('-').map(Number);
      return Math.round(Date.UTC(y, m - 1, d) / 86400000);
    };
    let bestStreak = 0;
    let run = 0;
    days.forEach((d, i) => {
      run = i && dayNum(d) - dayNum(days[i - 1]) === 1 ? run + 1 : 1;
      bestStreak = Math.max(bestStreak, run);
    });
    const last = days.length ? dayNum(days[days.length - 1]) : null;
    const streak = last != null && dayNum(dateKey()) - last <= 1 ? run : 0;
    const firsts = rounds.filter((r) => !r.replay);
    return {
      played: firsts.length,
      best: firsts.length ? Math.min(...firsts.map((r) => r.toPar)) : null,
      avg: firsts.length ? firsts.reduce((s, r) => s + r.toPar, 0) / firsts.length : null,
      streak,
      bestStreak,
    };
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  const el = {
    board: $('#board'),
    stage: $('#stage'),
    tiles: $('#tiles'),
    colHeads: $('#colHeads'),
    rowHeads: $('#rowHeads'),
    float: $('#float'),
    hudHole: $('#hudHole'),
    hudName: $('#hudName'),
    hudCourse: $('#hudCourse'),
    hudPar: $('#hudPar'),
    hudStrokes: $('#hudStrokes'),
    hudRound: $('#hudRound'),
    resetBtn: $('#resetBtn'),
    pickBtn: $('#pickBtn'),
    pickLbl: $('#pickLbl'),
    msg: $('#msg'),
    result: $('#result'),
    scorecard: $('#scorecard'),
    footCourse: $('#footCourse'),
    toast: $('#toast'),
  };
  const tileEls = () => el.tiles.children;
  const headEl = (key) => (key[0] === 'r' ? el.rowHeads : el.colHeads).children[Number(key.slice(1))];

  function span(cls) {
    const s = document.createElement('span');
    s.className = cls;
    return s;
  }

  function headCell(key) {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'hdr';
    d.dataset.key = key;
    const text = span('hdr-text');
    text.append(span('hdr-n'), span('hdr-f'));
    d.append(span('hdr-e'), text, span('hdr-dot'));
    return d;
  }

  function buildBoard() {
    const { n } = hole();
    el.board.style.setProperty('--n', String(n));
    el.colHeads.replaceChildren(...range(n).map((i) => headCell(`c${i}`)));
    el.rowHeads.replaceChildren(...range(n).map((i) => headCell(`r${i}`)));
    el.tiles.replaceChildren(...range(n * n).map((i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile';
      b.dataset.i = String(i);
      b.append(span('z'), span('sym'));
      return b;
    }));
    layout();
  }

  const sideBySide = matchMedia('(max-height: 540px) and (orientation: landscape)');
  const ROW_HEAD = 1.9;
  const COL_HEAD = 1.45;

  function layout() {
    if (!course) return;
    const { n } = hole();
    const gap = 5;
    const stageW = Math.min(el.stage.clientWidth - 16, 640);
    const top = el.stage.getBoundingClientRect().top + window.scrollY;
    const below = sideBySide.matches ? 28 : 120;
    const room = Math.min(Math.max(window.innerHeight - top - below, sideBySide.matches ? 170 : 300), 640);
    const fit = Math.min((stageW - n * gap) / (n + ROW_HEAD), (room - n * gap) / (n + COL_HEAD));
    const cell = clamp(Math.floor(fit), 34, 84);
    el.board.style.setProperty('--gap', `${gap}px`);
    el.board.style.setProperty('--cell', `${cell}px`);
    el.board.style.setProperty('--rhw', `${Math.round(cell * ROW_HEAD)}px`);
    el.board.style.setProperty('--chh', `${Math.round(cell * COL_HEAD)}px`);
    el.board.style.setProperty('--font', `${clamp(cell * 0.4, 13, 30).toFixed(1)}px`);
    el.board.style.setProperty('--name', `${clamp(cell * 0.19, 9, 13).toFixed(1)}px`);
  }

  const revealed = (st, key) => st.done || st.peeks.includes(key);

  function renderHeads() {
    const h = hole();
    const st = hs();
    for (const key of lineKeys(h.n)) {
      const d = headEl(key);
      const m = MOL[h.targets[key]];
      const miss = lineMiss(h.n, st.v, key, m);
      const [emoji, text] = d.children;
      emoji.textContent = m.emoji;
      text.children[0].textContent = m.label;
      const showFormula = revealed(st, key) || !miss;
      text.children[1].textContent = showFormula ? m.formula : '';
      d.className = 'hdr';
      if (!miss) d.classList.add('made');
      else if (miss === 1 && settings.near && !st.done) d.classList.add('near');
      if (showFormula) d.classList.add('shown');
      if (m.name.length > 11) d.classList.add('long');
      if (selected != null && (key[0] === 'r' ? Math.floor(selected / h.n) : selected % h.n) === Number(key.slice(1))) d.classList.add('focus');
      const status = !miss ? 'made' : miss === 1 && settings.near ? 'one tile off' : 'not yet';
      d.setAttribute('aria-label', `${lineName(key)}: ${m.name}${showFormula ? `, ${m.formula}` : ''}, ${status}`);
    }
  }

  function renderTiles() {
    const h = hole();
    const st = hs();
    const can = selected != null && settings.moves && !st.done ? neighbours(h.n, selected) : [];
    Array.from(tileEls()).forEach((b, i) => {
      const sym = st.v[i];
      const blank = sym === BLANK;
      const [z, name, tint] = ELEMENTS[sym];
      b.firstChild.textContent = blank ? '' : String(z);
      b.lastChild.textContent = blank ? '' : sym;
      let cls = 'tile';
      if (blank) cls += ' blank';
      else if (settings.colors) cls += ' tinted';
      if (sym.length > 1) cls += ' two';
      if (selected === i) cls += ' selected';
      if (can.includes(i)) cls += ' can-swap';
      b.className = cls;
      b.style.setProperty('--tint', tint);
      b.tabIndex = i === focusIdx ? 0 : -1;
      b.disabled = st.done;
      b.setAttribute('aria-pressed', String(selected === i));
      b.setAttribute('aria-label', `Row ${Math.floor(i / h.n) + 1}, column ${(i % h.n) + 1}: ${blank ? 'blank' : `${name}, ${sym}`}${selected === i ? ', selected' : ''}`);
    });
    el.board.classList.toggle('done', st.done);
  }

  let shownStrokes = null;
  function renderHud() {
    const h = hole();
    const st = hs();
    const p = parseId(course.id);
    el.hudHole.textContent = String(course.cur + 1);
    el.hudName.textContent = `Hole ${course.cur + 1} · ${h.n}×${h.n}`;
    el.hudCourse.textContent = courseLabel(course.id);
    el.footCourse.textContent = p.daily ? courseLabel(course.id) : `Course ${p.code}`;
    el.hudPar.textContent = String(h.par);
    const strokes = st.done ? st.score : liveStrokes(st);
    if (shownStrokes !== null && strokes > shownStrokes) bump(el.hudStrokes);
    shownStrokes = strokes;
    el.hudStrokes.textContent = String(strokes);
    el.hudStrokes.classList.toggle('over', !st.done && strokes >= h.par);
    const { toPar, played } = roundTotals();
    el.hudRound.textContent = played ? toParStr(toPar) : '–';
    el.hudRound.className = played ? toParClass(toPar) : '';
    el.resetBtn.disabled = st.done || !st.swaps;
    el.pickBtn.disabled = st.done;
  }

  function termFor(st, par) {
    if (st.picked) return 'Picked up';
    if (st.score === 1) return 'Hole in one!';
    const d = st.score - par;
    const names = { '-4': 'Condor!', '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', 0: 'Par', 1: 'Bogey', 2: 'Double bogey', 3: 'Triple bogey' };
    return names[d] || (d < 0 ? 'Unreal!' : `${d} over par`);
  }

  function renderResult() {
    const st = hs();
    const h = hole();
    el.result.hidden = !st.done;
    $('.tools').hidden = st.done;
    if (!st.done) return;
    el.result.classList.toggle('picked', st.picked);
    $('#resTerm').textContent = termFor(st, h.par);
    let sub = `${plural(st.score, 'stroke')} on a par ${h.par}`;
    if (!st.picked && st.peeks.length) sub += ` · ${plural(st.swaps, 'swap')} + ${plural(st.peeks.length, 'peek')}`;
    $('#resSub').textContent = sub;
    const next = nextHoleIndex();
    $('#nextBtn').textContent = next === -1 ? 'Round summary' : `Hole ${next + 1} →`;
  }

  function markClass(st, par) {
    if (st.picked) return 'picked';
    const d = st.score - par;
    if (d <= -2) return 'eagle';
    if (d === -1) return 'birdie';
    if (d === 0) return '';
    if (d === 1) return 'bogey';
    return 'double';
  }

  function renderScorecard() {
    let head = '<th scope="row">Hole</th>';
    let par = '<th scope="row">Par</th>';
    let score = '<th scope="row">Score</th>';
    let parSum = 0;
    let scoreSum = 0;
    let any = false;
    course.holes.forEach((st, i) => {
      const cur = i === course.cur ? ' cur' : '';
      parSum += holes[i].par;
      head += `<th class="go${cur}"><button type="button" data-hole="${i}" aria-label="Go to hole ${i + 1}">${i + 1}</button></th>`;
      par += `<td class="${cur}">${holes[i].par}</td>`;
      if (st.done) {
        any = true;
        scoreSum += st.score;
        score += `<td class="${cur}"><span class="mark ${markClass(st, holes[i].par)}">${st.score}</span></td>`;
      } else if (liveStrokes(st)) {
        score += `<td class="${cur}"><span class="mark live">${liveStrokes(st)}</span></td>`;
      } else {
        score += `<td class="${cur}"></td>`;
      }
    });
    head += '<th class="sum">Tot</th>';
    par += `<td class="sum">${parSum}</td>`;
    score += `<td class="sum">${any ? scoreSum : ''}</td>`;
    el.scorecard.innerHTML = `<div class="sc-scroll"><table class="sc"><thead><tr>${head}</tr></thead><tbody><tr>${par}</tr><tr>${score}</tr></tbody></table></div>`;
    const { strokes, toPar, played } = roundTotals();
    $('#scoreTotal').textContent = played
      ? `${strokes} through ${played} · ${toParStr(toPar)}`
      : `Par ${parSum}`;
  }

  function render() {
    renderHeads();
    renderTiles();
    renderHud();
    renderResult();
    renderScorecard();
    if (!el.msg.textContent) say(defaultMsg());
  }

  function defaultMsg() {
    const st = hs();
    if (st.done) return st.picked ? 'Here is the solution. Every formula is shown.' : 'Holed out! Every formula is shown.';
    if (selected != null) return 'Now tap a neighbouring tile to swap.';
    if (!st.swaps) return `Par ${hole().par}. Fix every row and column. Tap a name for a clue.`;
    return 'Tap a tile, then a neighbour to swap.';
  }

  function say(text) {
    el.msg.textContent = text;
  }

  function restartAnim(node, cls) {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }
  const bump = (node) => restartAnim(node, 'bump');

  function focusTile(i) {
    focusIdx = i;
    Array.from(tileEls()).forEach((b, j) => { b.tabIndex = j === i ? 0 : -1; });
    tileEls()[i]?.focus({ preventScroll: true });
  }

  function slide(a, b) {
    if (reducedMotion()) return;
    const { n } = hole();
    const cs = getComputedStyle(el.board);
    const step = parseFloat(cs.getPropertyValue('--cell')) + parseFloat(cs.getPropertyValue('--gap'));
    const move = (to, from) => {
      const t = tileEls()[to];
      t.style.setProperty('--dx', `${((from % n) - (to % n)) * step}px`);
      t.style.setProperty('--dy', `${(Math.floor(from / n) - Math.floor(to / n)) * step}px`);
      restartAnim(t, 'slide');
    };
    move(a, b);
    move(b, a);
  }

  function floatText(big, small) {
    el.float.replaceChildren();
    const b = document.createElement('strong');
    b.textContent = big;
    el.float.append(b);
    if (small) {
      const s = document.createElement('span');
      s.textContent = small;
      el.float.append(s);
    }
    restartAnim(el.float, 'show');
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function neighbours(n, i) {
    const r = Math.floor(i / n);
    const c = i % n;
    const out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
  }

  function select(i) {
    selected = i;
    renderTiles();
    renderHeads();
    say(defaultMsg());
    if (i != null) sound('pick');
  }

  function onTile(i) {
    if (hs().done) return;
    focusIdx = i;
    if (selected === null) select(i);
    else if (selected === i) select(null);
    else if (neighbours(hole().n, selected).includes(i)) doSwap(selected, i);
    else select(i);
    focusTile(i);
  }

  function madeKeys(h, v) {
    return lineKeys(h.n).filter((k) => !lineMiss(h.n, v, k, MOL[h.targets[k]]));
  }

  function doSwap(a, b) {
    const st = hs();
    const h = hole();
    if (st.done) return;
    selected = null;
    if (st.v[a] === st.v[b]) {
      renderTiles();
      renderHeads();
      say(st.v[a] === BLANK ? 'Two blanks: swapping them changes nothing. No stroke.' : 'Those are the same element. No stroke.');
      return;
    }
    const before = new Set(madeKeys(h, st.v));
    [st.v[a], st.v[b]] = [st.v[b], st.v[a]];
    st.swaps += 1;
    const after = madeKeys(h, st.v);
    const gained = after.filter((k) => !before.has(k));
    const lost = [...before].filter((k) => !after.includes(k));
    disarm();
    renderTiles();
    renderHeads();
    renderHud();
    renderScorecard();
    slide(a, b);
    sound('swap');
    if (gained.length) {
      const firsts = noteMade(gained.map((k) => h.targets[k]));
      for (const k of gained) restartAnim(headEl(k), 'hit');
      for (const k of gained) for (const idx of lineCells(h.n, k)) restartAnim(tileEls()[idx], 'hit');
      sound('made', gained.length);
      if (firsts.length) toast(`📓 New in your notebook: ${firsts.map((id) => `${MOL[id].emoji} ${MOL[id].name}`).join(', ')}`);
    }
    if (after.length === 2 * h.n) {
      finishHole(false);
      return;
    }
    const left = 2 * h.n - after.length;
    const names = gained.map((k) => MOL[h.targets[k]].name);
    const parts = [];
    if (names.length) parts.push(`Made ${names.join(' and ')}!`);
    if (lost.length) parts.push(`Broke ${lost.map((k) => MOL[h.targets[k]].name).join(' and ')}.`);
    parts.push(`${plural(left, 'line')} to go.`);
    say(parts.join(' '));
    save();
  }

  function finishHole(picked) {
    const st = hs();
    const h = hole();
    const raw = liveStrokes(st);
    st.done = true;
    st.picked = picked;
    st.score = picked ? Math.max(raw + 1, h.par + PICKUP_PENALTY) : raw;
    if (picked) st.v = h.solution.slice();
    selected = null;
    disarm();
    save();
    say('');
    render();
    const mine = epoch;
    if (!picked) {
      const d = st.score - h.par;
      const quick = reducedMotion();
      setTimeout(() => {
        if (mine !== epoch) return;
        restartAnim(el.tiles, 'shake');
        floatText(termFor(st, h.par), d ? `${toParStr(d)} on this hole` : '');
        sound(d < 0 ? 'birdie' : 'holed');
        if (st.score === 1) confetti(160);
        else if (d < 0) confetti(d <= -2 ? 120 : 70);
      }, quick ? 0 : 200);
    }
    if (courseDone()) {
      const res = recordRound();
      setTimeout(() => { if (mine === epoch) openFinish(res); }, picked ? 300 : 1400);
    }
    $('#nextBtn').focus({ preventScroll: true });
  }

  function nextHoleIndex() {
    const after = course.holes.findIndex((st, i) => i > course.cur && !st.done);
    return after !== -1 ? after : course.holes.findIndex((st) => !st.done);
  }

  function goHole(i) {
    if (i === course.cur) return;
    course.cur = i;
    selected = null;
    focusIdx = 0;
    epoch += 1;
    disarm();
    save();
    buildBoard();
    say('');
    render();
  }

  function nextHole() {
    const n = nextHoleIndex();
    if (n === -1) {
      openFinish(recordRound());
      return;
    }
    goHole(n);
    $('.hud').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function resetHole() {
    const st = hs();
    if (st.done || !st.swaps) return;
    st.v = hole().start.slice();
    selected = null;
    save();
    render();
    Array.from(tileEls()).forEach((t) => restartAnim(t, 'fresh'));
    say(`Tiles back where they started. Your ${plural(liveStrokes(st), 'stroke')} still count.`);
  }

  let armed = 0;
  function disarm() {
    clearTimeout(armed);
    armed = 0;
    el.pickLbl.textContent = 'Pick up';
    el.pickBtn.classList.remove('armed');
  }
  function onPickUp() {
    const st = hs();
    if (st.done) return;
    if (armed) {
      finishHole(true);
      return;
    }
    el.pickLbl.textContent = `Take ${Math.max(liveStrokes(st) + 1, hole().par + PICKUP_PENALTY)}? Tap again`;
    el.pickBtn.classList.add('armed');
    armed = setTimeout(disarm, 3500);
  }

  // Compound card: a clue for free, the formula for a stroke.
  function openInfo(key) {
    infoKey = key;
    const h = hole();
    const st = hs();
    const m = MOL[h.targets[key]];
    const made = !lineMiss(h.n, st.v, key, m);
    const shown = revealed(st, key) || made;
    $('#infoEmoji').textContent = m.emoji;
    $('#infoName').textContent = m.name;
    $('#infoWhere').textContent = `${lineName(key)[0].toUpperCase()}${lineName(key).slice(1)} target · ${plural(m.size, 'atom')} + ${plural(h.n - m.size, 'blank')}`;
    $('#infoFact').textContent = m.fact;
    $('#infoFormula').textContent = shown ? m.formula : '?';
    $('#infoFormula').classList.toggle('hidden', !shown);
    const btn = $('#peekBtn');
    btn.hidden = shown;
    btn.textContent = `Peek at the formula (+${PEEK_COST} stroke)`;
    const book = store.get('notebook', {})[m.id];
    $('#infoBook').textContent = book ? `In your notebook: made ${plural(book, 'time')}.` : 'Not in your notebook yet.';
    open('info');
  }

  function peek() {
    const st = hs();
    if (!infoKey || st.done || st.peeks.includes(infoKey)) return;
    st.peeks.push(infoKey);
    save();
    render();
    sound('pick');
    openInfo(infoKey);
  }

  function emojiFor(st, i) {
    if (!st.done) return '⬜';
    if (st.picked) return '⬛';
    if (st.score === 1) return '⭐';
    const d = st.score - holes[i].par;
    if (d <= -2) return '🟪';
    if (d === -1) return '🟦';
    if (d === 0) return '🟩';
    if (d === 1) return '🟨';
    return '🟥';
  }
  const emojiGrid = () => course.holes.map(emojiFor).join('');

  function openFinish(res = {}) {
    const { strokes, toPar } = roundTotals();
    $('#finStrokes').textContent = String(strokes);
    const tp = $('#finToPar');
    tp.textContent = toParStr(toPar);
    tp.className = `topar ${toParClass(toPar)}`;
    let under = 0;
    let pars = 0;
    let peeks = 0;
    course.holes.forEach((st, i) => {
      peeks += st.peeks.length;
      if (st.picked) return;
      if (st.score < holes[i].par) under++;
      else if (st.score === holes[i].par) pars++;
    });
    $('#finLine').textContent = [`Par ${totalPar()}`, `${under} under par`, plural(pars, 'par'), plural(peeks, 'peek')].join(' · ');
    const badge = $('#finBadge');
    badge.textContent = res.newBest ? 'Your best round yet!' : res.replay != null ? `Replay. Your first result today (${toParStr(res.replay)}) is the one that counts.` : '';
    badge.hidden = !badge.textContent;
    $('#finEmoji').textContent = emojiGrid();
    const p = parseId(course.id);
    $('#finNext').textContent = p.daily ? `Next daily course in ${untilTomorrow()}.` : `Share code ${p.code} to challenge a friend on this course.`;
    open('finish');
    if (toPar <= 0 && !reducedMotion()) confetti(140);
  }

  function untilTomorrow() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.max(1, Math.ceil((next - now) / 60000));
    const h = Math.floor(mins / 60);
    return h ? `${h}h ${pad2(mins % 60)}m` : `${mins}m`;
  }

  function shareText() {
    const { strokes, toPar } = roundTotals();
    const done = course.holes.filter((st) => st.done).length;
    const through = done < COURSE.length ? ` through ${done}` : '';
    return `Par for the Chem ⚗️⛳ ${courseLabel(course.id)}\n${strokes} strokes${through} (${toParStr(toPar)})\n${emojiGrid()}\n${courseUrl(course.id)}`;
  }

  // ---------------------------------------------------------------------------
  // Dialogs
  // ---------------------------------------------------------------------------
  function open(name) {
    const dlg = $(`#dlg-${name}`);
    if (name === 'stats') fillStats();
    if (name === 'course') fillCourse();
    if (name === 'settings') $$('[data-setting]').forEach((i) => { i.checked = !!settings[i.dataset.setting]; });
    $$('dialog[open]').forEach((d) => d !== dlg && d.close());
    if (!dlg.open) dlg.showModal();
  }

  function fillStats() {
    const s = roundStats();
    const tiles = [
      ['Rounds', s.played],
      ['Best round', s.best == null ? '–' : toParStr(s.best)],
      ['Average', s.avg == null ? '–' : toParStr(Math.round(s.avg * 10) / 10)],
      ['Daily streak', s.streak],
    ];
    $('#statGrid').innerHTML = tiles.map(([k, v]) => `<div class="stat"><strong>${esc(v)}</strong><span>${esc(k)}</span></div>`).join('');
    const book = store.get('notebook', {});
    const found = MOLS.filter((m) => book[m.id]).length;
    $('#bookCount').textContent = `${found} / ${MOLS.length}`;
    $('#notebook').innerHTML = MOLS.slice().sort((a, b) => a.size - b.size).map((m) => (book[m.id]
      ? `<div class="entry"><span class="e-emoji">${esc(m.emoji)}</span><span class="e-body"><strong>${esc(m.name)}</strong><span class="muted">${esc(m.formula)}</span></span><b class="e-count">×${esc(book[m.id])}</b></div>`
      : `<div class="entry locked"><span class="e-emoji">❔</span><span class="e-body"><strong>Undiscovered</strong><span class="muted">${esc(plural(m.size, 'atom'))}</span></span></div>`)).join('');
    const rounds = store.get('rounds', []);
    $('#recentRounds').innerHTML = rounds.length ? `
      <div class="table-scroll"><table class="rounds">
        <thead><tr><th>When</th><th>Course</th><th class="num">Strokes</th><th class="num">±</th></tr></thead>
        <tbody>${rounds.slice(0, 15).map((r) => {
          const p = parseId(r.id);
          const when = new Date(r.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const name = p ? (p.daily ? `Daily${r.replay ? ' (replay)' : ''}` : p.code) : '?';
          return `<tr><td>${esc(when)}</td><td>${esc(name)}</td><td class="num">${esc(r.strokes)}</td><td class="num"><b class="${toParClass(r.toPar)}">${esc(toParStr(r.toPar))}</b></td></tr>`;
        }).join('')}</tbody>
      </table></div>` : '<p class="empty">No finished rounds yet. Play all 9 holes to record one.</p>';
  }

  function courseStatus(id) {
    const saved = store.get(`course:${id}`, null);
    if (!saved || !Array.isArray(saved.holes)) return 'Not started';
    const done = saved.holes.filter((st) => st.done).length;
    if (done === COURSE.length) {
      const rounds = store.get('rounds', []).filter((r) => r.id === id);
      const round = rounds.find((r) => !r.replay) || rounds[0];
      return round ? `Finished · ${round.strokes} (${toParStr(round.toPar)})` : 'Finished';
    }
    return done ? `In progress · through ${done}` : 'Not started';
  }

  function fillCourse() {
    $('#dailyStatus').textContent = `Same 9 holes for everyone today. ${courseStatus(dailyId())}.`;
    $('#currentCourseInfo').textContent = `${courseLabel(course.id)} · ${courseStatus(course.id)}`;
  }

  // ---------------------------------------------------------------------------
  // Toast, confetti, sound
  // ---------------------------------------------------------------------------
  let toastTimer = 0;
  function toast(msg, ms = 2800) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function confetti(count) {
    if (reducedMotion()) return;
    const layer = document.createElement('div');
    layer.className = 'confetti';
    const bits = ['⛳', '🧪', '⚛️', '✨', '🏌️'];
    const colors = ['#0e8f7e', '#3b82f6', '#ef4444', '#f5c542', '#a855f7'];
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      if (i % 6 === 0) {
        s.className = 'bit';
        s.textContent = bits[(i / 6) % bits.length];
      } else {
        s.style.setProperty('background', colors[i % colors.length]);
      }
      s.style.setProperty('left', `${Math.random() * 100}%`);
      s.style.setProperty('--x', `${(Math.random() - 0.5) * 240}px`);
      s.style.setProperty('--r', `${(Math.random() - 0.5) * 1080}deg`);
      s.style.setProperty('--d', `${1.6 + Math.random() * 1.6}s`);
      s.style.setProperty('animation-delay', `${Math.random() * 0.4}s`);
      layer.append(s);
    }
    document.body.append(layer);
    setTimeout(() => layer.remove(), 4000);
  }

  let audio = null;
  function tone(freq, start, dur, type = 'sine', vol = 0.05) {
    const t = audio.currentTime + start;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audio.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  function sound(kind, count = 1) {
    if (!settings.sound) return;
    try {
      audio = audio || new AudioContext();
      if (audio.state === 'suspended') audio.resume();
      if (kind === 'pick') tone(660, 0, 0.06, 'triangle', 0.03);
      else if (kind === 'swap') tone(420, 0, 0.08, 'triangle', 0.04);
      else if (kind === 'made') [523, 659, 784].slice(0, 1 + Math.min(count, 2)).forEach((f, i) => tone(f, i * 0.07, 0.2));
      else if (kind === 'holed') [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.3));
      else if (kind === 'birdie') [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.35));
    } catch { /* audio unavailable */ }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'offscreen';
      // A modal dialog makes everything outside it inert, so the textarea must live inside it.
      ($('dialog[open]') || document.body).append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { /* unsupported */ }
      ta.remove();
      return ok;
    }
  }

  async function share() {
    const text = shareText();
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    toast((await copyText(text)) ? 'Result copied to clipboard.' : 'Could not copy. Try again.');
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  let drag = null;
  let swallowClick = false;

  el.tiles.addEventListener('pointerdown', (e) => {
    swallowClick = false;
    const t = e.target.closest('.tile');
    if (!t || e.button > 0 || hs().done) return;
    drag = { i: Number(t.dataset.i), x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  el.tiles.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    const cell = parseFloat(getComputedStyle(el.board).getPropertyValue('--cell'));
    if (Math.hypot(dx, dy) < cell * 0.4) return;
    const { n } = hole();
    const from = drag.i;
    drag = null;
    let to;
    if (Math.abs(dx) > Math.abs(dy)) to = dx > 0 ? (from % n < n - 1 ? from + 1 : -1) : (from % n > 0 ? from - 1 : -1);
    else to = dy > 0 ? from + n : from - n;
    if (to < 0 || to >= n * n) return;
    swallowClick = true;
    focusIdx = to;
    doSwap(from, to);
  });
  const endDrag = () => {
    drag = null;
    if (swallowClick) setTimeout(() => { swallowClick = false; }, 0);
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  el.tiles.addEventListener('click', (e) => {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    const t = e.target.closest('.tile');
    if (t) onTile(Number(t.dataset.i));
  });

  el.tiles.addEventListener('keydown', (e) => {
    const t = e.target.closest('.tile');
    if (!t) return;
    const { n } = hole();
    const i = Number(t.dataset.i);
    if (e.key === 'Escape' && selected != null) {
      e.preventDefault();
      select(null);
      return;
    }
    const moves = {
      ArrowLeft: i % n ? i - 1 : -1,
      ArrowRight: i % n < n - 1 ? i + 1 : -1,
      ArrowUp: i - n,
      ArrowDown: i + n,
      Home: i - (i % n),
      End: i - (i % n) + n - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const to = moves[e.key];
    if (to >= 0 && to < n * n) focusTile(to);
  });

  el.board.addEventListener('click', (e) => {
    const h = e.target.closest('.hdr');
    if (h) openInfo(h.dataset.key);
  });
  el.tiles.addEventListener('animationend', (e) => {
    if (e.target === el.tiles) el.tiles.classList.remove('shake');
    else e.target.closest('.tile')?.classList.remove('slide', 'hit', 'fresh');
  });
  el.board.addEventListener('animationend', (e) => {
    e.target.closest('.hdr')?.classList.remove('hit');
  });
  el.hudStrokes.addEventListener('animationend', () => el.hudStrokes.classList.remove('bump'));

  el.resetBtn.addEventListener('click', resetHole);
  el.pickBtn.addEventListener('click', onPickUp);
  $('#nextBtn').addEventListener('click', nextHole);
  $('#peekBtn').addEventListener('click', peek);
  el.scorecard.addEventListener('click', (e) => {
    const b = e.target.closest('[data-hole]');
    if (b) goHole(Number(b.dataset.hole));
  });

  $$('[data-open]').forEach((b) => b.addEventListener('click', () => open(b.dataset.open)));
  $$('dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
  });

  $('#playDaily').addEventListener('click', () => {
    $('#dlg-course').close();
    loadCourse(dailyId());
    say(defaultMsg());
  });
  $('#playRandom').addEventListener('click', () => {
    $('#dlg-course').close();
    loadCourse(`c:${randomCode()}`);
    say(defaultMsg());
    toast(`New course ${parseId(course.id).code}. Share the link to challenge a friend.`);
  });
  $('#codeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#codeInput');
    const id = parseCode(input.value);
    if (!id) {
      toast('Course codes are 4 to 8 letters and digits, like K3F9QZ.');
      input.focus();
      return;
    }
    input.value = '';
    $('#dlg-course').close();
    loadCourse(id);
    say(defaultMsg());
  });
  $('#copyLink').addEventListener('click', async () => {
    toast((await copyText(courseUrl(course.id))) ? 'Course link copied.' : 'Could not copy the link.');
  });
  let restartArmed = 0;
  $('#restartCourse').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!restartArmed) {
      btn.textContent = 'Tap to confirm';
      restartArmed = setTimeout(() => { restartArmed = 0; btn.textContent = 'Restart'; }, 3000);
      return;
    }
    clearTimeout(restartArmed);
    restartArmed = 0;
    btn.textContent = 'Restart';
    store.del(`course:${course.id}`);
    $('#dlg-course').close();
    loadCourse(course.id);
    say('Course restarted from hole 1.');
  });
  $('#shareBtn').addEventListener('click', share);

  $$('[data-setting]').forEach((input) => {
    input.addEventListener('change', () => {
      settings[input.dataset.setting] = input.checked;
      store.set('settings', settings);
      renderTiles();
      renderHeads();
      if (input.dataset.setting === 'sound' && input.checked) sound('made', 2);
    });
  });

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(layout);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const p = parseId(course.id);
    const untouched = course.holes.every((st) => !st.swaps && !st.peeks.length && !st.done);
    if (p.daily && p.date !== dateKey() && (courseDone() || untouched) && !$('dialog[open]')) {
      loadCourse(dailyId());
      toast('A new daily course is ready.');
    }
  });

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  function startId() {
    const q = new URLSearchParams(location.search).get('c');
    if (q) {
      const id = parseCode(q);
      if (id) return id;
      setTimeout(() => toast("That course code isn't valid, so here's today's daily."), 300);
      return dailyId();
    }
    const current = store.get('current', null);
    const p = current && parseId(current);
    if (p && !p.daily) {
      const saved = store.get(`course:${current}`, null);
      if (saved && Array.isArray(saved.holes) && !saved.holes.every((st) => st.done)) return current;
    }
    return dailyId();
  }

  loadCourse(startId());

  if (!store.get('seenHelp', false)) {
    store.set('seenHelp', true);
    open('help');
  }
})();
