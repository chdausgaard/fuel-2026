/* v8 shell: scroll-linked engine, title page, part bar, routing, tokens, alias map, slice bar integration.
   Contract (SPEC.md): window.VIS.<name> = { init(el, data), render(state), resize(w, h) } with
   state = { id, next, p, pg, t, w, h }. p is build progress, pg is geometric progress.
   Every picture is a pure function of the scroll position.
   Loaded before steps.js and the modules so that window.THEME and window.PADD_COLORS exist when they run.

   v9 ALIAS map: v9 beats that reuse an older figure until the figure worker builds them.
   Each figure worker deletes the aliases for the beats it builds.
*/
(function () {
  'use strict';
  window.VIS = window.VIS || {};

  /* ---------- tokens ("Two inks" look, DESIGN.md) ---------- */
  // Defaults match the CSS custom properties; CSS is always the single source.
  // The read-from-CSS block below runs unconditionally (no data-theme gate).
  window.THEME = {
    bg: '#F7F3EC', ink: '#1E1B22', muted: '#5D5862', rule: '#D9D2C7',
    inkA: '#EA8A00', inkADeep: '#B86A00', inkB: '#5E36C9', overprint: '#561D00',
    accent: '#0F6B66', accentSoft: '#D5E8E4', rep: '#B2423A', dem: '#2F5D9B',
    burden: ['#F5E2BF', '#EA8A00', '#561D00'],
    price: ['#E9E2F8', '#5E36C9'], priceLow: '#6E7486',
    diverge: ['#5E36C9', '#EEE9E1', '#6E7486'],
    serif: "Vollkorn, Georgia, serif",
    sans: "Barlow, system-ui, sans-serif"
  };
  window.PADD_COLORS = { '1A': '#6A7D9E', '1B': '#4D939F', '1C': '#7A9E76', '2': '#B89D58', '3': '#AD7558', '4': '#93769E', '5': '#5C886A' };

  // Extended keys: modules read these for figure-specific roles, fonts, and derived colours.
  var T = window.THEME;
  T.red = ['#F5E4E0', '#D0807A', '#832520'];
  T.fontBody = "Vollkorn, Charter, 'Iowan Old Style', 'Palatino Linotype', Georgia, serif";
  T.fontLabel = "Barlow, system-ui, sans-serif";
  T.fontLabelCanvas = "Barlow, system-ui, -apple-system, 'Segoe UI', sans-serif";
  T.fontLabelShort = "Barlow, system-ui, sans-serif";
  T.fontLabelCharts = '"Barlow", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  T.fontSerifCanvas = "Vollkorn, Georgia, serif";
  T.fontSerifFull = "Vollkorn, Georgia, serif";
  T.fontLabelFace = '"Barlow"';
  T.fontFallback = 'sans-serif';
  // Figure type, [desktop, phone]: one size for every figure title, subtitle and tag; scale lifts the modules' label sizes (PI, 2026-10-30)
  T.figType = { title: [22, 17], sub: [16, 14], tag: [14, 12], scale: [15 / 13, 13 / 12] };
  T.setAside = '#8E8780'; T.adj = '#3D3840'; T.rust = '#6E7486'; T.plum = '#6E5CA0'; T.amber = '#EA8A00';
  T.calm = '#918A84'; T.pale = '#CFC8BD'; T.greyBar = '#C2BAB0';
  T.metro = '#48526A'; T.metroFill = '#DDD8EE'; T.micro = '#A87A1E'; T.microFill = '#F3E5C5';
  T.rural = '#5E8656'; T.ruralFill = '#DCE6D4';
  T.strip = ['#5D5862', '#A09A93'];
  T.eqOut = '#7A7470'; T.eqRace = '#AEA8A0'; T.barAlt = ['#CFC8BD', '#DDD8D0'];
  T.fadedBar = '#AEA8A0'; T.overviewMut = '#968F88'; T.amberDark = '#8A4A12'; T.glyphSoft = '#D9D2C7';
  T.hlZero = '#EBE6DF'; T.hlEffect = '#D5E8E4';
  T.inkgLine = '#CFC8BD'; T.onAccent = '#ffffff';
  T.dotScale = 1; T.dotAlpha = 1; T.dotStroke = 1.1; T.dotHalftone = 0;
  T.labelWeight = 600; T.chartWeight = 2.8;
  // alpha helper: returns 'rgba(r, g, b, a)' from a hex colour and an alpha 0-1
  window.THEME.alpha = function (hex, a) {
    const n = parseInt((hex || '').replace('#', ''), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  // CSS is the single source: always read custom properties (no data-theme gate).
  {
    const _cs = getComputedStyle(document.documentElement);
    const _tok = name => (_cs.getPropertyValue(name) || '').trim();
    const T = window.THEME, P = window.PADD_COLORS;
    const s = (k, v) => { if (v) T[k] = v; };
    s('bg', _tok('--bg')); s('ink', _tok('--ink')); s('muted', _tok('--muted')); s('rule', _tok('--rule'));
    s('inkA', _tok('--ink-a')); s('inkADeep', _tok('--ink-a-deep')); s('inkB', _tok('--ink-b')); s('overprint', _tok('--overprint'));
    s('accent', _tok('--accent')); s('accentSoft', _tok('--accent-soft'));
    s('rep', _tok('--rep')); s('dem', _tok('--dem'));
    s('priceLow', _tok('--price-low'));
    const t3 = (k, a, b, c) => { const va = _tok(a), vb = _tok(b), vc = _tok(c); if (va && vb && vc) T[k] = [va, vb, vc]; };
    const t2 = (k, a, b) => { const va = _tok(a), vb = _tok(b); if (va && vb) T[k] = [va, vb]; };
    t3('burden', '--burden-0', '--burden-1', '--burden-2');
    t2('price', '--price-0', '--price-1');
    t3('diverge', '--diverge-pos', '--diverge-mid', '--diverge-neg');
    t3('red', '--fig-red-0', '--fig-red-1', '--fig-red-2');
    t2('strip', '--fig-strip-0', '--fig-strip-1');
    t2('barAlt', '--fig-bar-alt-0', '--fig-bar-alt-1');
    // fonts
    s('serif', _tok('--font-serif-canvas')); s('sans', _tok('--font-label-short'));
    s('fontBody', _tok('--font-body')); s('fontLabel', _tok('--font-label'));
    s('fontLabelCanvas', _tok('--font-label-canvas')); s('fontLabelShort', _tok('--font-label-short'));
    s('fontLabelCharts', _tok('--font-label-charts'));
    s('fontSerifCanvas', _tok('--font-serif-canvas')); s('fontSerifFull', _tok('--font-serif-full'));
    s('fontLabelFace', _tok('--font-label-face')); s('fontFallback', _tok('--font-fallback'));
    // figure roles
    ['setAside:--fig-set-aside', 'adj:--fig-adj', 'rust:--fig-rust', 'plum:--fig-plum', 'amber:--fig-amber',
     'calm:--fig-calm', 'pale:--fig-pale', 'greyBar:--fig-grey-bar',
     'metro:--fig-metro', 'metroFill:--fig-metro-fill', 'micro:--fig-micro', 'microFill:--fig-micro-fill',
     'rural:--fig-rural', 'ruralFill:--fig-rural-fill',
     'eqOut:--fig-eq-out', 'eqRace:--fig-eq-race', 'fadedBar:--fig-faded-bar',
     'overviewMut:--fig-overview-mut', 'amberDark:--fig-amber-dark', 'glyphSoft:--fig-glyph-soft',
     'hlZero:--hl-zero', 'hlEffect:--hl-effect', 'inkgLine:--fig-inkg-line', 'onAccent:--on-accent'
    ].forEach(e => { const p = e.split(':'); s(p[0], _tok(p[1])); });
    ['dotScale:--dot-scale', 'dotAlpha:--dot-alpha', 'dotStroke:--dot-stroke',
     'dotHalftone:--dot-halftone', 'labelWeight:--label-weight', 'chartWeight:--chart-weight'
    ].forEach(e => { const p = e.split(':'), v = _tok(p[1]); if (v && Number.isFinite(+v)) T[p[0]] = +v; });
    // PADD colours
    ['1A:--padd-1a', '1B:--padd-1b', '1C:--padd-1c', '2:--padd-2', '3:--padd-3', '4:--padd-4', '5:--padd-5'
    ].forEach(e => { const p = e.split(':'), v = _tok(p[1]); if (v) P[p[0]] = v; });
  }

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // cubic in-out
  const lerp = (a, b, t) => a + (b - a) * t;
  window.ENGINE = { clamp, smoothstep, ease, lerp, reducedMotion: false };
  // v7.2 (SPEC rule 8): published for the modules, updated when the preference changes; the figures are redrawn on a change
  const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  window.ENGINE.reducedMotion = rmq.matches;
  const rmChanged = () => { window.ENGINE.reducedMotion = rmq.matches; if (typeof schedule === 'function') schedule(true); };
  if (rmq.addEventListener) rmq.addEventListener('change', rmChanged); else if (rmq.addListener) rmq.addListener(rmChanged);

  /* ---------- scroll geometry ---------- */
  // Fractions of the viewport height (SPEC.md, "Scroll engine contract"). A beat becomes current when the top of its text block rises past `trig`, just below the bottom
  // edge. Its hand-over toward the next beat (t) runs while the next block's top travels from `enter` up to `trig`.
  // #text's top padding in site.css equals `trig`, so the first beat becomes current as the panel pins.
  // A beat's motion is placed against its text (PI, 2026-10-30): by default it starts when the block's top is at `start`; it may start as early as `trig`, and it is over by
  // the hard stop, when the block's center reaches `stop` (the block's top need not rise past `stopTop`). On a phone these are in the reading band under the panel.
  // `hold` is the scroll left for the finished picture before the hand-over; `len` is the shortest beat, which also keeps a jump's landing clear of the hand-over.
  const GEOM = { desk: { trig: 1.12, enter: 1.4, start: 0.95, stop: 0.25, stopTop: -0.1, hold: 0.2, len: 1.35 },
    phone: { trig: 1.15, enter: 1.33, start: 0.96, stop: 0.6, stopTop: 0.44, hold: 0.12, len: 0.85 } };

  /* ---------- per-beat build timing ---------- */
  // From website/tools/gen_timing.py: the build p over which a beat's motion runs (a to b) and the scroll it takes, [desktop, phone]. Beats not listed have little motion.
  // linear: the motion runs longer than any text can stay on screen; the text holds instead (site.css) and p stays linear in the scroll.
  const TIMING = {
    'price-start': { a: 0.007, b: 0.371, span: [0.57, 0.37] },
    'price-rise': { a: 0.045, b: 0.374, span: [0.70, 0.45] },
    'price-relief': { a: 0.044, b: 0.397, span: [0.57, 0.56] },
    'exposure': { a: 0.081, b: 0.311, span: [0.69, 0.44] },
    'exposure-example': { a: 0.071, b: 0.315, span: [0.64, 0.36] },
    'price-local': { a: 0.085, b: 0.555, span: [0.85, 0.61] },
    'markets': { a: 0.094, b: 0.317, span: [0.62, 0.36] },
    'extra-cost': { a: 0.051, b: 0.355, span: [0.71, 0.50] },
    'simple': { a: 0.101, b: 0.437, span: [0.61, 0.44] },
    'simple-votes': { a: 0.085, b: 0.413, span: [0.58, 0.37] },
    'simple-why': { a: 0.069, b: 0.312, span: [0.57, 0.49] },
    'ideal': { a: 0.057, b: 0.297, span: [0.82, 0.57] },
    'ideal-shuffle': { a: 0.080, b: 0.511, span: [0.95, 0.68] },
    'close-to-random': { a: 0.020, b: 0.700, span: [1.10, 0.72] },
    'route': { a: 0.069, b: 0.322, span: [0.62, 0.42] },
    'same-race': { a: 0.075, b: 0.419, span: [0.58, 0.36] },
    'same-race-2': { a: 0.067, b: 0.368, span: [0.60, 0.59] },
    'nearby-intro': { a: 0.007, b: 0.303, span: [0.95, 0.68] },
    'nearby-groups': { a: 0.088, b: 0.376, span: [0.57, 0.36] },
    'unusual': { a: 0.060, b: 0.660, span: [0.85, 0.60] },
    'exposure-scale': { a: 0.060, b: 0.245, span: [0.59, 0.36] },
    'both-sides-total': { a: 0.065, b: 0.470, span: [0.65, 0.40] },
    'both-sides-remove': { a: 0.065, b: 0.653, span: [1.15, 0.84] },
    'compare': { a: 0.054, b: 0.252, span: [0.65, 0.36] },
    'compare-all': { a: 0.062, b: 0.293, span: [0.65, 0.37] },
    'assumption': { a: 0.017, b: 0.297, span: [0.87, 0.53] },
    'adj-brief': { a: 0.053, b: 0.359, span: [0.74, 0.36] },
    'adj-prior': { a: 0.074, b: 0.236, span: [0.53, 0.36] },
    'adj-state': { a: 0.040, b: 0.575, span: [1.37, 0.78] },
    'adj-pt': { a: 0.122, b: 0.654, span: [0.84, 0.56] },
    'adj-lag': { a: 0.034, b: 0.411, span: [0.86, 0.58] },
    'eq-1': { a: 0.066, b: 0.332, span: [0.57, 0.42] },
    'eq-2': { a: 0.047, b: 0.336, span: [0.74, 0.44] },
    'eq-3': { a: 0.065, b: 0.418, span: [0.73, 0.44] },
    'eq-4': { a: 0.080, b: 0.305, span: [0.85, 0.48] },
    'check-idea': { a: 0.027, b: 0.228, span: [0.57, 0.36] },
    'check-chart': { a: 0.063, b: 0.234, span: [0.57, 0.40] },
    'fluke-reshuffle': { linear: true },
    'power-detect': { a: 0.034, b: 0.452, span: [0.71, 0.45] },
    'power-benchmark': { a: 0.010, b: 0.450, span: [0.83, 0.70] },   // by hand (the frame change is under gen_timing's floor): over from the block's top at 0.95 to 0.12 (PI: done while the top of the text is on screen)
    'scope': { a: 0.062, b: 0.358, span: [0.57, 0.41] },
    'scope-outcomes': { a: 0.088, b: 0.469, span: [0.57, 0.42] },
    'scope-limits': { a: 0.05, b: 0.46, span: [0.60, 0.42] },
    'state-question': { a: 0.089, b: 0.714, span: [0.97, 0.80] },
    'report-ladder': { a: 0.045, b: 0.318, span: [0.57, 0.36] },
    'report-variants': { a: 0.047, b: 0.367, span: [0.63, 0.36] },
    'prereg': { a: 0.030, b: 0.202, span: [0.76, 0.43] },
  };
  const TIMING_DEFAULT = { a: 0.05, b: 0.45, span: [0.5, 0.36] };
  // where each beat's motion runs: s and e are the block top at its start and end; g0 and g1 the same as geometric p (placeMotion)
  const LAY = {};
  function blockHeight(sec) {
    const body = $('.beat-body', sec), ps = body ? body.querySelectorAll(':scope > p') : [];
    const last = ps.length ? ps[ps.length - 1] : body || sec;
    return last.getBoundingClientRect().bottom - sec.getBoundingClientRect().top;
  }
  function layoutBeat(sec, id) {
    const phone = isPhone(), g = phone ? GEOM.phone : GEOM.desk, tm = TIMING[id] || TIMING_DEFAULT;
    if (tm.linear) { LAY[id] = null; return; }
    const span = tm.span[phone ? 1 : 0], h = blockHeight(sec) / window.innerHeight;
    const e = Math.max(g.stopTop, g.stop - h / 2, g.start - span), s = Math.min(g.trig, e + span);
    LAY[id] = { a: tm.a, b: tm.b, s, e, g0: 0, g1: 0 };
    sec.style.minHeight = (100 * Math.max(g.len, g.trig - e + (g.enter - g.trig) + g.hold)) + 'vh';
  }
  function placeMotion(g) {
    const vh = window.innerHeight;
    IDS.forEach((id, i) => {
      const c = LAY[id]; if (!c) return;
      const len = ((i + 1 < N ? tops[i + 1] : endY) - tops[i]) / vh;
      c.g0 = (g.trig - c.s) / len; c.g1 = Math.min(0.98, Math.max(c.g0 + 0.01, (g.trig - c.e) / len));
    });
  }
  // build p from geometric p: the motion's window maps onto its place against the text, and what is before and after it (where nothing moves) takes up the rest
  function W(id, pg) {
    const g = clamp(pg, 0, 1), c = LAY[id];
    if (!c || !c.g1) return g;
    const a = c.g0 > 0 ? c.a : 0;   // a motion that starts at the trigger line has no lead-in: p still starts from 0, so the boundary does not jump
    if (g <= c.g0) return c.g0 > 0 ? a * g / c.g0 : 0;
    if (g >= c.g1) return c.b + (1 - c.b) * (g - c.g1) / (1 - c.g1);
    return a + (c.b - a) * (g - c.g0) / (c.g1 - c.g0);
  }
  function Winv(id, pb) {
    const p = clamp(pb, 0, 1);
    if (!LAY[id] || p === 0 || p === 1) return p;
    let lo = 0, hi = 1;
    for (let k = 0; k < 42; k++) {
      const mid = (lo + hi) / 2;
      if (W(id, mid) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  window.ENGINE.timing = { W, Winv, TIMING, LAY, GEOM };

  /* ---------- script retry ---------- */
  // A module script that fails to load (a dropped connection on a weak network) is requested once more after a short wait. Until then the panel says
  // the figure is loading; if the second try fails too, it says the figure did not load. A module that arrives late is started by lateInit().
  let scriptsPending = 0, startWaiting = false;
  const retried = {};
  window.addEventListener('error', e => {
    const s = e.target;
    if (!s || s.tagName !== 'SCRIPT') return;
    const src = s.getAttribute('src') || '';
    if (!/^js\//.test(src) || retried[src]) return;
    retried[src] = 1; scriptsPending++;
    const done = ok => {
      scriptsPending--;
      if (startWaiting && window.BEATS) { startWaiting = false; start(); return; }
      if (ok) lateInit();
      schedule(true);
    };
    setTimeout(() => {
      const n = document.createElement('script');
      n.src = src; n.onload = () => done(true); n.onerror = () => done(false);
      document.body.appendChild(n);
    }, 300);
  }, true);

  /* ---------- alias map (v8) ---------- */
  // v8 beats that reuse a v7.2 figure until the figure worker builds them.
  // Each worker deletes the aliases of the beats it builds.
  // v9.3 shell: the v9.2 beats whose figure is not built yet show the nearest existing figure (placeholders). A figure worker deletes the alias of the beat it builds.
  // A value is an older id, or { id, p } to hold the older beat at a fixed progress p.
  const ALIAS = {
    'exposure-example': 'dots-example',
    // v9.4: no placeholders left (every v9.4 beat has its own figure).
  };
  // The slice module gets the original ids; these are the ones it draws under an older name until it is rebuilt.
  const SLICE_ALIAS = {};
  // review builds only: set to false before the public release
  const REVIEW_BEAT_TAG = false;
  window.V8_ALIAS = ALIAS;   // published for modules that need to check

  /* ---------- ownership ---------- */
  // v8: OWNERS is a list of runs [module, firstId, lastId]. A module may appear in several runs.
  const OWNERS = [
    ['scene', 'price-start', 'turn'],
    ['dots', 'exposure', 'adj-lag'],
    ['dots', 'eq-1', 'stock-take'],
    ['charts', 'check-idea', 'power-benchmark'],
    ['slice', 'scope', 'scope-limits'],
    ['dots', 'state-question', 'scope-where'],
    ['charts', 'report-ladder', 'about']
  ];
  const MODS_SET = new Set(OWNERS.map(o => o[0]));
  const MODS = [...MODS_SET];   // unique modules in appearance order: scene, dots, charts, slice
  const DATA_FILES = ['counties', 'eia', 'holidays', 'sim', 'hist', 'shares', 'holiday_example', 'markets', 'placebo', 'stages', 'where', 'past_county', 'dollar'];
  const REQUIRED = ['counties', 'eia'];

  let BEATS = [], IDS = [], N = 0, OWNER_AT = [];
  function buildOwners() {
    const r = OWNERS.map(([n, a, b]) => [n, IDS.indexOf(a), IDS.indexOf(b)]), K = r.length;
    for (let pass = 0; pass < 2; pass++) r.forEach((x, k) => {
      if (x[1] < 0) x[1] = k === 0 ? 0 : r[k - 1][2] >= 0 ? r[k - 1][2] + 1 : -1;
      if (x[2] < 0) x[2] = k === K - 1 ? N - 1 : r[k + 1][1] >= 0 ? r[k + 1][1] - 1 : -1;
    });
    OWNER_AT = IDS.map((id, i) => { const x = r.find(x => x[1] >= 0 && i >= x[1] && i <= x[2]); return x ? x[0] : null; });
    r.forEach(([n, a, b], k) => { if (!BEATS.some(x => x.id === OWNERS[k][1]) || !BEATS.some(x => x.id === OWNERS[k][2])) console.info('[main] ' + n + ' runs from ' + (IDS[a] || '?') + ' to ' + (IDS[b] || '?') + ' (a listed id is not in steps.js)'); });
  }
  const ownerOf = id => { const i = IDS.indexOf(id); return i < 0 ? null : OWNER_AT[i]; };

  /* ---------- beats behind a button ---------- */
  // PI, 2026-10-30: detail the reader chooses to see. A run is a group of beats that stays closed until the button in the text before it opens it (<button class="run-btn" data-run="...">
  // in STORYBOARD.md). A closed run's sections are hidden and left out of IDS, N and beatEls, so the beats on either side meet as neighbors and the modules hand over between them as usual.
  // window.BEATS always holds every beat, because the modules order beats by it. A link or address to a closed beat opens its run. No band heading may sit inside a run. ?open=all opens every run.
  const RUNS = { adj: ['adj-oil', 'adj-prior', 'adj-state', 'adj-pt', 'adj-lag'], state: ['state-question'], variants: ['report-variants'] };
  const runOpen = {};
  const runOf = id => Object.keys(RUNS).find(k => RUNS[k].indexOf(id) >= 0);
  function setRuns() {
    IDS = BEATS.map(b => b.id).filter(id => { const k = runOf(id); return !k || runOpen[k]; });
    N = IDS.length;
    buildOwners();
  }
  function showRuns() {
    beatEls.length = 0;
    BEATS.forEach(b => { const on = IDS.indexOf(b.id) >= 0; secOf[b.id].hidden = !on; if (on) beatEls.push(secOf[b.id]); });
    parts.forEach(p => { p.first = IDS.indexOf(p.id); });
    bands.forEach(b => { b.i = IDS.indexOf(b.id); });
    document.querySelectorAll('.run-btn').forEach(b => {
      const on = !!runOpen[b.dataset.run];
      if (!b.dataset.open) b.dataset.open = b.textContent;
      b.textContent = on ? b.dataset.close : b.dataset.open;
      b.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
  }
  function toggleRun(k, open) {
    if (!!runOpen[k] === open) return;
    runOpen[k] = open;
    setRuns(); showRuns(); measure();
  }

  const $ = (s, r) => (r || document).querySelector(s);
  const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
  const isPhone = () => window.matchMedia('(max-width: 899px) and (orientation: portrait), (max-width: 899px) and (min-height: 501px)').matches;
  const isShortLandscape = () => window.matchMedia('(orientation: landscape) and (max-height: 500px)').matches;
  const logged = {};
  const safe = (label, fn) => { try { return fn(); } catch (e) { if (!logged[label + e.message]) { logged[label + e.message] = 1; console.error('[' + label + ']', e); } } };

  const data = {};
  const hosts = {};
  const beatEls = [], secOf = {};
  let panel, ph, bar;
  let tops = [], endY = 0, maxY = 0, trig = 0, twin = 1, pw = 0, ph_ = 0;
  let ready = false, raf = 0, last = null, lastHash = '';
  window.BEAT_STATE = null;

  /* ---------- beat text ---------- */
  function termify(html) {
    let n = 0;
    return html.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (m, term, def) => {
      const id = 'tip' + (++n) + '-' + Math.random().toString(36).slice(2, 6);
      return '<span class="term" tabindex="0" aria-describedby="' + id + '">' + term + '<span class="tip" role="tooltip" id="' + id + '">' + def + '</span></span>';
    });
  }
  // Typographic apostrophes: a rendering change only, no wording is touched.
  const curly = html => html.replace(/(\w)'(\w)/g, '$1’$2');

  function buildBeats() {
    const host = $('#text');
    BEATS.forEach((b, i) => {
      const sec = el('section', 'beat', host);
      sec.id = 'b-' + b.id;
      sec.dataset.id = b.id;
      if (b.partTitle) { sec.classList.add('part-first'); el('h2', 'part-title', sec).textContent = b.partTitle; }
      // v8: band headings from bandTitle (Source Serif 4, sized between body and part heading, no extra block height)
      if (b.bandTitle) {
        sec.classList.add('band-first');
        const bh = el('h3', 'band-title', sec);
        bh.textContent = b.bandTitle;
      }
      if ((b.html || '').length > 650) sec.classList.add('long');
      const body = el('div', 'beat-body', sec);
      body.innerHTML = termify(curly(b.html || ''));
      secOf[b.id] = sec;
    });
    host.addEventListener('click', e => { const b = e.target.closest('.run-btn'); if (b) toggleRun(b.dataset.run, !runOpen[b.dataset.run]); });
    wireTips(host);
    wireBeatLinks(host);
    wireBeatLinks($('#visual'));   // the method overview's tiles (svg links in the figure panel) jump like the in-text links
  }

  // v9.4: no expandable contains math any more, so KaTeX and its loader were removed.

  function wireTips(host) {
    const place = t => {
      const tip = $('.tip', t); if (!tip) return;
      t.classList.add('show');
      const r = t.getBoundingClientRect();
      const w = Math.min(272, window.innerWidth - 16);
      tip.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
      tip.style.top = (r.bottom + 6) + 'px';
      const tr = tip.getBoundingClientRect();
      if (tr.bottom > window.innerHeight - 8) tip.style.top = Math.max(8, r.top - tr.height - 6) + 'px';
    };
    const hide = t => t.classList.remove('show');
    host.addEventListener('mouseover', e => { const t = e.target.closest('.term'); if (t) place(t); });
    host.addEventListener('mouseout', e => { const t = e.target.closest('.term'); if (t && !t.contains(e.relatedTarget)) hide(t); });
    host.addEventListener('focusin', e => { const t = e.target.closest('.term'); if (t) place(t); });
    host.addEventListener('focusout', e => { const t = e.target.closest('.term'); if (t) hide(t); });
    host.addEventListener('click', e => { const t = e.target.closest('.term'); if (t && !t.classList.contains('show')) place(t); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.term.show').forEach(hide); });
    window.addEventListener('scroll', () => { const s = document.querySelectorAll('.term.show'); if (s.length) s.forEach(hide); }, { passive: true });
    host.addEventListener('toggle', () => measure(), true);   // details opened or closed: block positions change
  }

  /* ---------- panel ---------- */
  function buildPanel() {
    panel = $('#panel');
    MODS.forEach(n => { hosts[n] = el('div', 'mod', panel); hosts[n].id = 'mod-' + n; });
    ph = el('div', '', panel); ph.id = 'ph';   // not a live region: a data failure has #load-error (role=alert); this one says a figure script did not load
    // v8: the slice bar overlay sits in its own layer above the modules, positioned by slice.js
    const sliceOverlay = el('div', 'slice-overlay', panel);
    sliceOverlay.id = 'slice-overlay';
    buildOverview();
  }

  /* ---------- "Back to the overview" button (v9.4) ---------- */
  // An HTML link in the figure aside, on every beat from same-race to the end. It links to the overview beat (#b-route) and scrolls through the same
  // handler as the in-text skip links (wireBeatLinks). Placement: immediately left of the visible boxed tag (data-fig-tag), vertically centered on it;
  // with no tag, right-aligned on the vertical center of the visible title (data-fig-title); with neither, at the top right under the top bar.
  // If the title's right edge would collide, it drops to just below the tag (or the title), right-aligned.
  let ovBtn = null, ovWasOn = false, ovSnap = 0;
  function buildOverview() {
    if (!visualAside) return;
    ovBtn = el('a', 'to-overview', visualAside);
    ovBtn.href = '#b-route';
    ovBtn.setAttribute('aria-label', 'Back to the overview of the rest of the page');
    ovBtn.innerHTML = '<span class="long">Back to the overview</span><span class="short">Overview</span>';
  }
  // opacity of an element as drawn: the product over its ancestors in the aside; 0 when hidden
  function effOpacity(e) {
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none') return 0;
    let o = 1;
    for (let n = e; n && n !== visualAside && n.nodeType === 1; n = n.parentNode) {
      const c = n === e ? cs : getComputedStyle(n);
      if (c.display === 'none') return 0;
      o *= parseFloat(c.opacity);
      if (!(o > 0)) return 0;
    }
    return o;
  }
  function visibleOf(sel, min) {
    let best = null, bo = 0;
    visualAside.querySelectorAll(sel).forEach(e => {
      const o = effOpacity(e);
      if (o < min || o <= bo) return;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      best = { e, r }; bo = o;
    });
    return best;
  }
  function placeOverview(st) {
    if (!ovBtn || !ready) return;
    const i0 = IDS.indexOf('same-race'), ci = IDS.indexOf(st.id);
    const op = ci < i0 ? 0 : st.id === 'same-race' ? smoothstep(0.02, 0.12, st.p) : 1;
    ovBtn.style.opacity = op >= 0.999 ? '' : op.toFixed(3);
    const on = op > 0.01;
    ovBtn.classList.toggle('on', on);
    if (!on) { ovWasOn = false; return; }
    const vr = visualAside.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    const bw = ovBtn.offsetWidth, bh = ovBtn.offsetHeight, GAP = 8, padR = isPhone() ? 14 : 28;
    const tag = visibleOf('[data-fig-tag]', 0.12);          // as soon as a tag shows, so that the button never sits on it while it fades in
    const ttl = visibleOf('[data-fig-title]', tag ? 0.5 : 0.05);
    const sl = window.VIS.slice;
    // candidate positions (right edge, top), in the order of preference; the first one that clears every visible text wins
    const cand = [];
    if (tag) {
      cand.push([tag.r.left - GAP, tag.r.top + tag.r.height / 2 - bh / 2]);                      // left of the tag, centered on it
      const aboveTop = tag.r.top - bh - 3;                                                         // else right-aligned just above the tag, if the top bar leaves room
      if (aboveTop >= pr.top + (+window.SLICE_BAND || 0) + 2) cand.push([tag.r.right, aboveTop]);
      for (let k = 0; k < 40; k++) cand.push([tag.r.right, tag.r.bottom + 6 + 5 * k]);            // else just below the tag, right-aligned, stepping down until it clears
    } else if (ttl) {
      // v9.4 QA: the title's first line is its row (a title that wraps, or sits over a caption, is taller than one row)
      const tfs = parseFloat(getComputedStyle(ttl.e).fontSize) || 14, rowH = Math.min(ttl.r.height, tfs * 1.5);
      cand.push([pr.right - padR, ttl.r.top + rowH / 2 - bh / 2]);                                // right-aligned on the title's row
      cand.push([pr.right - padR, ttl.r.top - 5, 0]);                                             // else a little higher, with no safety margin, so that it stays on the row above a caption right under the title
      for (let k = 0; k < 40; k++) cand.push([pr.right - padR, ttl.r.bottom + 4 + 5 * k]);
    } else {
      for (let k = 0; k < 40; k++) cand.push([pr.right - padR, vr.top + (+window.SLICE_BAND || 0) + 8 + 5 * k]);
    }
    const texts = Array.from(visualAside.querySelectorAll('text'));
    const place = c => {
      let right = c[0], top = c[1];
      // keep clear of the arrow from the top bar (scope, scope-outcomes): move left of it
      const av = sl && sl.avoid ? sl.avoid(top - pr.top, top + bh - pr.top) : null;
      if (av && right > av[0] + pr.left - 8 && right - bw < av[1] + pr.left + 8) right = av[0] + pr.left - 12;
      right = Math.min(right, pr.right - 4); right = Math.max(right, pr.left + bw + 4);
      return [right, top, c[2]];
    };
    const clear = (right, top, mg) => !texts.some(e => {
      const r = e.getBoundingClientRect(), q = mg == null ? 3 : mg;
      if (r.width < 1 || r.right < right - bw - q || r.left > right + q || r.bottom < top - q || r.top > top + bh + q) return false;
      return effOpacity(e) >= 0.25;
    });
    let pick = place(cand[cand.length - 1]);
    for (let k = 0; k < cand.length; k++) { const c = place(cand[k]); if (clear(c[0], c[1], c[2])) { pick = c; break; } }
    const right = pick[0], top = pick[1];
    const x = right - bw - vr.left, y = top - vr.top;
    if (!ovWasOn) { ovBtn.style.transition = 'none'; clearTimeout(ovSnap); ovSnap = setTimeout(() => { ovBtn.style.transition = ''; }, 60); }
    ovWasOn = true;
    ovBtn.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
  }

  /* ---------- part bar ---------- */
  // One segment per part (the beats that carry a partTitle in steps.js), labelled with partShort. A segment's width follows the scroll length of its
  // part, with a floor so that its label fits; its line fills as the part is read; a click scrolls to the start of the part's first beat.
  // Phone: the segments shrink to a bare line and one button ("3 of 8 · Who felt it") opens a list of the parts.
  let parts = [], partsNow, partsMenu, partsTrack, partsCtx = null, partCur = -2, bandCur = -2, bands = [], bandPart = -1;
  const reducedMotion = () => window.ENGINE.reducedMotion;

  function buildBar() {
    BEATS.forEach((b, i) => { if (b.partTitle) parts.push({ id: b.id, first: i, title: b.partTitle, short: b.partShort || b.partTitle, start: 0, end: 1, f: -1 }); });
    bar = el('nav', '', document.body); bar.id = 'parts'; bar.setAttribute('aria-label', 'Parts of the story');
    partsNow = el('button', 'parts-now', bar); partsNow.type = 'button';
    partsNow.setAttribute('aria-expanded', 'false'); partsNow.setAttribute('aria-controls', 'parts-menu');
    el('span', 'parts-now-text', partsNow); el('i', 'parts-chev', partsNow);
    partsTrack = el('ol', 'parts-track', bar);
    partsMenu = el('ul', '', bar); partsMenu.id = 'parts-menu'; partsMenu.hidden = true;
    parts.forEach((p, k) => {
      const li = el('li', '', partsTrack), seg = el('button', 'seg', li);
      seg.type = 'button'; seg.title = p.title;
      el('span', 'lab', seg).textContent = p.short;
      p.fill = el('i', 'fill', seg); p.seg = seg; p.li = li;
      seg.addEventListener('click', () => goPart(k));
      const mi = el('button', 'item', el('li', '', partsMenu)); mi.type = 'button'; mi.textContent = p.short;
      mi.addEventListener('click', () => goPart(k));
      p.item = mi;
    });
    partsNow.addEventListener('click', () => toggleMenu());
    document.addEventListener('pointerdown', e => { if (!partsMenu.hidden && !bar.contains(e.target)) toggleMenu(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !partsMenu.hidden) { toggleMenu(false); partsNow.focus(); } });
    buildBands();
  }

  // v8: bands come from bandTitle in steps.js, for every part that has bands. On phone the button names the band being read.
  // The bar itself shows only the connected line (PI, 2026-10-30: the band ticks are gone).
  let bandParts = [];   // [{partIdx, bands: [{name, i}]}]
  function buildBands() {
    // Collect bands per part from bandTitle
    const partOf = i => { let pk = -1; parts.forEach((p, k) => { if (p.first <= i) pk = k; }); return pk; };
    const byPart = {};
    BEATS.forEach((b, i) => {
      if (!b.bandTitle) return;
      const pk = partOf(i);
      if (pk < 0) return;
      if (!byPart[pk]) byPart[pk] = [];
      byPart[pk].push({ name: b.bandTitle, i, id: b.id });
    });
    for (const pk of Object.keys(byPart).map(Number).sort((a, b) => a - b)) {
      const partBands = byPart[pk];
      const li = parts[pk] && parts[pk].li;
      if (!li || !partBands.length) continue;
      bands.push(...partBands);
      bandParts.push({ partIdx: pk, bands: partBands });
    }
    // bandPart is the first part with bands (for backward compatibility in updateBar)
    if (bandParts.length) bandPart = bandParts[0].partIdx;
  }

  function toggleMenu(open) {
    if (open === undefined) open = partsMenu.hidden;
    partsMenu.hidden = !open;
    partsNow.setAttribute('aria-expanded', open ? 'true' : 'false');
    bar.classList.toggle('open', open);
  }

  // A jump (part bar, part menu, skip links) lands where a reader scrolling on gets to: the beat's block top just under the part bar on desktop,
  // just under the pinned panel on a phone. There the figure shows the beat's finished build (p is about 0.4-0.6), and render() is a pure function
  // of the scroll position, so it is the same picture as scrolling there from anywhere. A long distance is covered in one step (no fly-through of
  // every figure in between); a short one scrolls smoothly.
  const LAND_GAP = 24;
  function landingY(i) {
    const barH = parseFloat(getComputedStyle($('#visual')).top) || 0;
    const under = isPhone() ? barH + ph_ : barH;
    return clamp(Math.round(tops[i] - under - LAND_GAP), 0, maxY);
  }
  function goBeat(i) {
    if (!tops.length || i < 0 || i >= N) return;
    const y = landingY(i);
    const near = Math.abs(y - window.scrollY) < 1.5 * window.innerHeight;
    window.scrollTo({ top: y, behavior: near && !reducedMotion() ? 'smooth' : 'auto' });
  }
  function goPart(k) {
    toggleMenu(false);
    if (parts[k]) goBeat(parts[k].first);
  }
  // In-text links to a beat (#b-<id>): same landing, and focus moves to the beat so that keyboard and screen-reader users continue from there.
  function wireBeatLinks(host) {
    host.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#b-"]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      const id = decodeURIComponent(a.getAttribute('href').slice(3));
      if (runOf(id)) toggleRun(runOf(id), true);
      const i = IDS.indexOf(id);
      if (i < 0) return;
      e.preventDefault();
      goBeat(i);
      const sec = beatEls[i]; sec.tabIndex = -1; sec.focus({ preventScroll: true });
    });
  }

  // Called from measure(): scroll range and width of each part.
  function layoutBar() {
    if (!bar || !tops.length) return;
    parts.forEach((p, k) => {
      p.start = tops[p.first] - trig;
      p.end = k + 1 < parts.length ? tops[parts[k + 1].first] - trig : Math.max(p.start + 1, maxY);
    });
    if (!partsCtx) partsCtx = document.createElement('canvas').getContext('2d');
    partsCtx.font = '500 13px ' + window.THEME.sans;
    parts.forEach(p => {
      p.li.style.flexGrow = Math.max(1, Math.round(p.end - p.start));
      p.li.style.minWidth = Math.ceil(partsCtx.measureText(p.short).width + 18) + 'px';   // the label always fits unless the screen is very narrow
    });
    const compact = isPhone() || isShortLandscape();
    partsTrack.inert = compact; partsTrack.setAttribute('aria-hidden', compact ? 'true' : 'false');
    if (!compact && !partsMenu.hidden) toggleMenu(false);
    partCur = -2; bandCur = -2; updateBar(window.scrollY);
  }

  function updateBar(y) {
    if (!bar || !tops.length || !parts.length) return;
    bar.classList.toggle('on', y + trig >= tops[0]);
    let cur = -1;
    parts.forEach((p, k) => { if (y >= p.start - 0.5) cur = k; });
    parts.forEach((p, k) => {
      const f = clamp((y - p.start) / Math.max(1, p.end - p.start), 0, 1);
      if (f !== p.f) { p.f = f; p.fill.style.transform = 'scaleX(' + f.toFixed(4) + ')'; }
    });
    // v8: the band being read, across all parts that have bands
    let band = -1;
    const curBP = bandParts.find(bp => bp.partIdx === cur);
    if (curBP) {
      let bi = 0; const T = y + trig;
      for (let k = 0; k < N; k++) if (tops[k] <= T) bi = k;
      // Find the band index within the global bands array
      curBP.bands.forEach(b => {
        const gi = bands.indexOf(b);
        if (bi >= b.i && gi >= 0) band = gi;
      });
    }
    if (cur === partCur && band === bandCur) return;
    partCur = cur; bandCur = band;
    parts.forEach((p, k) => {
      p.seg.classList.toggle('cur', k === cur); p.seg.classList.toggle('done', k < cur);
      p.item.classList.toggle('cur', k === cur);
      if (k === cur) { p.seg.setAttribute('aria-current', 'step'); p.item.setAttribute('aria-current', 'step'); }
      else { p.seg.removeAttribute('aria-current'); p.item.removeAttribute('aria-current'); }
    });
    const c = parts[Math.max(0, cur)];
    partsNow.firstChild.textContent = (Math.max(0, cur) + 1) + ' of ' + parts.length + ' \u00b7 ' + c.short + (band >= 0 ? ' \u00b7 ' + bands[band].name : '');
  }

  window.setCounter = function () { /* v6: the counter is gone; kept so that module calls do not break */ };

  /* ---------- measurement and state ---------- */
  function measure() {
    if (!beatEls.length) return;
    beatEls.forEach((sec, i) => layoutBeat(sec, IDS[i]));
    const y = window.scrollY;
    tops = beatEls.map(e => e.getBoundingClientRect().top + y);
    endY = beatEls[N - 1].getBoundingClientRect().bottom + y;
    const g = isPhone() ? GEOM.phone : GEOM.desk;
    trig = window.innerHeight * g.trig; twin = window.innerHeight * (g.enter - g.trig);
    placeMotion(g);
    maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    layoutBar();
    const w = panel.clientWidth, h = panel.clientHeight;
    if (w !== pw || h !== ph_) {
      pw = w; ph_ = h;
      if (ready) {
        MODS.forEach(n => { const m = window.VIS[n]; if (m && m.resize) safe(n + '.resize', () => m.resize(pw, ph_)); });
        // v8: publish SLICE_BAND for figure modules
        window.SLICE_BAND = (window.VIS.slice && typeof window.VIS.slice.bandHeight === 'function') ? window.VIS.slice.bandHeight() : 0;
      }
    }
    tpMeasure();
    schedule(true);
  }

  function compute(y) {
    const T = y + trig;
    let i = 0;
    for (let k = 0; k < N; k++) if (tops[k] <= T) i = k;
    const a = tops[i], b = i + 1 < N ? tops[i + 1] : endY;
    const p = b > a ? clamp((T - a) / (b - a), 0, 1) : 0;
    // a linear ramp over the last `twin` px before the next block reaches the trigger line (never more than half the beat); modules ease it
    const t = i + 1 < N ? clamp(1 - (b - T) / Math.max(1, Math.min(twin, 0.5 * (b - a))), 0, 1) : 0;
    return { id: IDS[i], next: i + 1 < N ? IDS[i + 1] : null, p, t, w: pw, h: ph_ };
  }

  const visualAside = document.getElementById('visual');
  let tag = '';

  function schedule(force) {
    if (force) last = null;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame() {
    raf = 0;
    tpDraw();
    if (!ready || !tops.length) return;
    const st = compute(window.scrollY);
    st.pg = st.p;
    st.p = W(st.id, st.pg);
    updateBar(window.scrollY);
    if (last && last.id === st.id && last.next === st.next && last.p === st.p && last.t === st.t && last.w === st.w && last.h === st.h) return;
    last = st;
    window.BEAT_STATE = st;
    if (REVIEW_BEAT_TAG && visualAside && tag !== st.id) { tag = st.id; visualAside.setAttribute('aria-label', 'Figure for the current step [' + st.id + ']'); }

    // v8: apply the alias map so that copied v7.2 modules see the v7 beat id they know
    const al = id => { const a = ALIAS[id]; return a == null ? { id: id } : typeof a === 'string' ? { id: a } : a; };
    const aCur = al(st.id), aNext = st.next ? al(st.next) : null;
    const aliasId = aCur.id, aliasNext = aNext ? aNext.id : null;
    const aliased = { id: aliasId, next: aliasNext, p: aCur.p != null ? aCur.p : st.p, pg: st.pg, t: st.t, w: st.w, h: st.h };

    const own = ownerOf(st.id), inc = st.next ? ownerOf(st.next) : null;
    MODS.forEach(n => {
      const live = n === own || n === inc;
      hosts[n].classList.toggle('live', live);
      hosts[n].classList.toggle('own', n === own);
      if (!live) return;
      const m = window.VIS[n];
      // The slice module gets the original v8 ids (it handles them itself).
      // Other modules get the aliased state so they see v7 ids they know.
      const mst = n === 'slice' ? (SLICE_ALIAS[st.id] ? Object.assign({}, st, { id: SLICE_ALIAS[st.id] }) : st) : aliased;
      if (m && m.render) safe(n + '.render', () => m.render(mst));
    });

    // v8: call the slice bar overlay on every frame within its range (idea-aim to report-ladder)
    const sliceM = window.VIS.slice;
    if (sliceM && sliceM.overlay) safe('slice.overlay', () => sliceM.overlay(st));
    safe('overview', () => placeOverview(st));

    const missing = own && !(window.VIS[own] && window.VIS[own].render);
    ph.classList.toggle('on', !!missing);
    if (missing) ph.textContent = scriptsPending ? 'Loading the figure\u2026' : 'This figure didn\u2019t load. Reloading the page usually fixes it.';

    const key = window.scrollY + trig < tops[0] ? '' : st.id;   // still on the title page: no beat in the address
    if (key !== lastHash) {
      lastHash = key;
      try { history.replaceState(null, '', key ? '#' + key : location.pathname + location.search); } catch (e) { /* sandboxed */ }
    }
  }

  /* ---------- navigation and testing hooks ---------- */
  // Semantic callers request a build picture; tools may request physical progress directly.
  window.ENGINE.beatIds = () => IDS.slice();   // the beats on the page now: closed runs are left out
  window.goToBeat = (id, p) => window.goToBeatGeo(id, Winv(id, p == null ? 0 : p));
  window.goToBeatGeo = function (id, pg) {
    const i = IDS.indexOf(id);
    if (i < 0 || !tops.length) return false;
    const a = tops[i], b = i + 1 < N ? tops[i + 1] : endY;
    const reachable = b > a ? clamp((maxY + trig - a) / (b - a), 0, 1) : 0;
    window.scrollTo(0, clamp(a + clamp(pg == null ? 0 : pg, 0, reachable) * (b - a) - trig, 0, maxY));
    frame();
    return true;
  };

  /* ---------- source line ---------- */
  // window.sourceLine(svgSel, text, w, h, opacity): one grey line (IBM Plex Sans 12px, THEME.muted; class .source-line) at the bottom-left of a panel,
  // inside a reserved 22px bottom band (window.SOURCE_BAND). svgSel is an <svg>, a d3 selection of one, or a selector. w, h are the panel size in px. opacity (0-1, default 1) is optional: a module passes its figure's alpha so that
  // the line fades with the figure (v7.2).
  // text is a string, or an array of candidates from longest to shortest: the first that fits on one line (12px, then 11px) is used,
  // otherwise the first one is wrapped upward from the baseline. Returns the height used (22 for one line). Safe to call on every resize.
  window.SOURCE_BAND = 22;
  let srcCtx = null;
  window.sourceLine = function (svgSel, text, w, h, opacity) {
    let svg = svgSel;
    if (typeof svg === 'string') svg = document.querySelector(svg);
    else if (svg && typeof svg.node === 'function') svg = svg.node();
    if (!svg || !svg.tagName || svg.tagName.toLowerCase() !== 'svg') return 0;
    let t = null;
    for (const c of svg.children) if (c.tagName.toLowerCase() === 'text' && c.classList.contains('source-line')) { t = c; break; }
    if (!t) { t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('class', 'source-line'); t.setAttribute('fill', window.THEME.muted); svg.appendChild(t); }
    const op = opacity == null || isNaN(+opacity) ? 1 : clamp(+opacity, 0, 1);
    t.style.opacity = op === 1 ? '' : op.toFixed(3);
    const cands = (Array.isArray(text) ? text : [text]).filter(Boolean);
    const X = 12, maxW = Math.max(40, w - 2 * X);
    if (!srcCtx) srcCtx = document.createElement('canvas').getContext('2d');
    const width = (str, size) => { srcCtx.font = '400 ' + size + 'px ' + window.THEME.fontLabelShort; return srcCtx.measureText(str).width; };
    let lines = null, size = 12;
    outer: for (const c of cands) for (const sz of [12, 11]) if (width(c, sz) <= maxW) { lines = [c]; size = sz; break outer; }
    if (!lines) {
      size = 11; lines = [];
      let cur = '';
      (cands[0] || '').split(' ').forEach(wd => { const n = cur ? cur + ' ' + wd : wd; if (cur && width(n, size) > maxW) { lines.push(cur); cur = wd; } else cur = n; });
      if (cur) lines.push(cur);
    }
    const lh = Math.round(size * 1.25), base = h - 8;
    t.textContent = '';
    t.style.fontSize = size + 'px';
    lines.forEach((ln, i) => {
      const sp = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      sp.setAttribute('x', X); sp.setAttribute('y', base - (lines.length - 1 - i) * lh);
      sp.textContent = ln; t.appendChild(sp);
    });
    return window.SOURCE_BAND + (lines.length - 1) * lh;
  };

  /* ---------- title page: hero map and hand-off ---------- */
  // One fixed canvas (#tp-map) draws every county dot. From the first scroll to the start of the story (the pin) its rectangle is a pure function of
  // the scroll position: the map (in the flow, #tp-stage holds its place) shrinks into the sticky panel as a faint backdrop, the
  // chart fades in under it, and the backdrop is gone a little after the first beat. The only timer is the 1.2 s load moment.
  const TP = { on: false, loadT: 1, pending: false, t0: 0, blank: false, cue: -1, cap: -1, txt: -1, pOp: -1, cw: 0, ch: 0, dpr: 1 };
  const TAU = 6.2832, NB = 32, TMIN = 0.14, LOAD_MS = 1200;

  function tpInit() {
    const rows = data.counties && data.counties.rows, hero = $('#tp');
    TP.cv = $('#tp-map'); TP.stage = $('#tp-stage'); TP.hero = hero; TP.vis = $('#visual'); TP.pan = $('#panel'); TP.side = $('.tp-side'); TP.cut = null;
    if (!TP.cv || !TP.stage || !rows || !window.d3) { if (hero) hero.classList.add('no-map'); return; }
    const proj = d3.geoAlbersUsa().scale(1280).translate([487.5, 305]);
    const pts = [];
    rows.forEach(c => { const q = c.e != null ? proj([c.lon, c.lat]) : null; if (q) pts.push([q[0], q[1], c.e]); });
    const n = pts.length;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    x0 -= 10; x1 += 10; y0 -= 10; y1 += 10;                       // room for the dot radius
    hero.style.setProperty('--tp-aspect', ((x1 - x0) / (y1 - y0)).toFixed(4));
    const es = pts.map(p => p[2]).sort((a, b) => a - b);
    const lo = es[Math.floor(0.02 * (n - 1))], hi = es[Math.floor(0.98 * (n - 1))];
    const seq = d3.scaleLinear().domain([0, 0.5, 1]).range(window.THEME.burden).interpolate(d3.interpolateLab).clamp(true);
    const col = u => seq(TMIN + (1 - TMIN) * u);
    TP.colors = []; for (let b = 0; b < NB; b++) TP.colors.push(col((b + 0.5) / NB));
    const ramp = $('#tp-ramp'); if (ramp) ramp.style.background = 'linear-gradient(90deg,' + [0, 0.25, 0.5, 0.75, 1].map(col).join(',') + ')';
    // order the dots by colour bucket so that each bucket is one path; darker (more exposed) dots are drawn last
    const bk = pts.map(p => Math.min(NB - 1, Math.max(0, Math.floor(NB * (p[2] - lo) / (hi - lo)))));
    const ord = pts.map((p, i) => i).sort((a, b) => bk[a] - bk[b]);
    TP.n = n; TP.nx = new Float32Array(n); TP.ny = new Float32Array(n); TP.jx = new Float32Array(n); TP.jy = new Float32Array(n); TP.dl = new Float32Array(n);
    TP.bstart = new Int32Array(NB + 1);
    let seed = 20261103;
    const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    ord.forEach((i, k) => {
      TP.nx[k] = (pts[i][0] - x0) / (x1 - x0); TP.ny[k] = (pts[i][1] - y0) / (y1 - y0);
      TP.jx[k] = rnd() * 2 - 1; TP.jy[k] = rnd() * 2 - 1; TP.dl[k] = rnd();
      TP.bstart[bk[i] + 1]++;
    });
    for (let b = 0; b < NB; b++) TP.bstart[b + 1] += TP.bstart[b];
    TP.aspect = (x1 - x0) / (y1 - y0);
    TP.on = true;
    tpMeasure();
    const quick = window.ENGINE.reducedMotion || location.hash.length > 1 || window.scrollY > 0.4 * window.innerHeight;
    if (quick) TP.loadT = 1; else { TP.loadT = 0; TP.pending = true; }
    tpDraw();
  }

  function tpMeasure() {
    if (!TP.on) return;
    const y = window.scrollY, r = TP.stage.getBoundingClientRect(), s = $('#story').getBoundingClientRect(), v = TP.pan.getBoundingClientRect();   // the panel (capped at 1100px wide on wide screens), not #visual
    TP.sideY = TP.side ? TP.side.getBoundingClientRect().top + y : 0;
    TP.sx = r.left + window.scrollX; TP.sy = r.top + y; TP.sw = r.width; TP.sh = r.height;
    TP.y1 = s.top + y;                      // the story starts (it overlaps the bottom of the title page): the panel is pinned and the first beat is about to be current
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    // pinned panel rectangle: the sticky panel is always at the top of the viewport once pinned (only v.left, v.width and v.height are used)
    const phone = isPhone(), padX = Math.min(0.07 * v.width, 64), padY = phone ? Math.min(0.04 * v.height, 20) : Math.min(0.1 * v.height, 80);
    const aw = v.width - 2 * padX, ah = v.height - 2 * padY, fit = Math.min(aw, ah * TP.aspect);
    TP.tw = fit; TP.th = fit / TP.aspect;
    const barH = parseFloat(getComputedStyle($('#visual')).top) || 0;   // the pinned panel sits below the part bar
    TP.tx = v.left + padX + (aw - fit) / 2; TP.ty = barH + padY + (ah - TP.th) / 2;
    const dpr = Math.min(window.devicePixelRatio || 1, isPhone() ? 3 : 2, Math.sqrt(9e6 / (vw * vh)));
    if (vw !== TP.cw || vh !== TP.ch || dpr !== TP.dpr) {
      TP.cw = vw; TP.ch = vh; TP.dpr = dpr;
      TP.cv.width = Math.round(vw * dpr); TP.cv.height = Math.round(vh * dpr);
      TP.cv.style.width = vw + 'px'; TP.cv.style.height = vh + 'px';
      TP.ctx = TP.cv.getContext('2d');
      if (T.dotHalftone) { TP.cols = Math.ceil(vw / 7); TP.cells = new Uint8Array(TP.cols * Math.ceil(vh / 7)); }
    }
    if (TP.pending && TP.sy - y < vh * 0.9) tpStartLoad();
  }

  function tpStartLoad() {
    TP.pending = false; TP.t0 = performance.now();
    const loop = now => { TP.loadT = clamp((now - TP.t0) / LOAD_MS, 0, 1); tpDraw(); if (TP.loadT < 1) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  function tpDraw() {
    if (!TP.on || !TP.ctx) return;
    const y = window.scrollY, ctx = TP.ctx, dpr = TP.dpr, phone = isPhone(), landscape = isShortLandscape();
    if (TP.pending && TP.sy - y < TP.ch * 0.9) tpStartLoad();
    const u = clamp(y / Math.max(1, TP.y1), 0, 1), e = ease(u);   // the hand-off runs from the first scroll to the pin
    // the cue leaves first, then the legend and the title text (on a phone sooner, since the map passes over it); the chart panel arrives as the map settles
    const cue = landscape ? 1 : 1 - smoothstep(0, 0.15, u), cap = 1 - smoothstep(0.04, 0.35, u), txt = phone || landscape ? 1 : 1 - smoothstep(0.2, 0.7, u);   // phone: no fade, the text is cut off where the map passes over it (below)
    if (Math.abs(cue - TP.cue) > 0.004 || Math.abs(txt - TP.txt) > 0.004 || Math.abs(cap - TP.cap) > 0.004) {
      TP.cue = cue; TP.txt = txt; TP.cap = cap;
      const st = TP.hero.style;
      st.setProperty('--tp-cue', cue.toFixed(3)); st.setProperty('--tp-capo', cap.toFixed(3)); st.setProperty('--tp-text', txt.toFixed(3));
      TP.hero.classList.toggle('past', cap < 0.01 && !landscape);
    }
    const pOp = y >= TP.y1 ? 1 : smoothstep(0.55, 1, u);
    if (Math.abs(pOp - TP.pOp) > 0.004) { TP.pOp = pOp; TP.vis.style.opacity = pOp >= 0.999 ? '' : pOp.toFixed(3); }

    const fy = Math.max(TP.sy - y, 0);      // the map follows the page until its top reaches the top of the viewport, then stays there while it settles
    const rx = lerp(TP.sx, TP.tx, e), ry = lerp(fy, TP.ty, e), rw = lerp(TP.sw, TP.tw, e), rh = lerp(TP.sh, TP.th, e);
    // v7.2 (critique T2): on a phone the map passes over the lede as it shrinks into the panel. The lede is not faded with scroll distance; the lines
    // are cut off only where the map is (a mask on .tp-side from the map's lower edge up), so a line is read at full strength until the map reaches it.
    if (TP.side) {
      const cut = phone ? Math.round(ry + rh - (TP.sideY - y)) : -100;
      if (cut !== TP.cut) { TP.cut = cut; TP.side.style.setProperty('--tp-cut', cut + 'px'); }
    }

    let alpha = (1 - 0.8 * smoothstep(0.3, 1, u)) * (1 - smoothstep(0, 0.3 * TP.ch, y - TP.y1));
    const L = TP.loadT;
    if (L < 1) alpha *= 0.25 + 0.75 * smoothstep(0, 0.5, L);
    if (alpha < 0.004) { if (!TP.blank) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, TP.cv.width, TP.cv.height); TP.blank = true; } return; }
    TP.blank = false;

    const r = clamp(rw / (phone ? 560 : 460), phone ? 0.55 : 0.9, 3.6) * T.dotScale;
    if (TP.cells) TP.cells.fill(0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, TP.cw, TP.ch);
    ctx.globalAlpha = alpha * T.dotAlpha;
    const nx = TP.nx, ny = TP.ny;
    for (let b = 0; b < NB; b++) {
      const a = TP.bstart[b], z = TP.bstart[b + 1];
      if (a === z) continue;
      ctx.fillStyle = TP.colors[b];
      ctx.beginPath();
      for (let i = a; i < z; i++) {
        let px = rx + nx[i] * rw, py = ry + ny[i] * rh;
        if (L < 1) {
          const q = clamp((L - 0.35 * TP.dl[i]) / 0.65, 0, 1), k = 1 - (1 - q) * (1 - q) * (1 - q);   // each dot settles on its own beat of the 1.2 s
          px += TP.jx[i] * 0.22 * rw * (1 - k); py += TP.jy[i] * 0.32 * rh * (1 - k);
          if (py < ry) py = ry + (ry - py) * 0.5; else if (py > ry + rh) py = ry + rh - (py - ry - rh) * 0.5;   // the scatter stays below the title block
        }
        let radius = r;
        if (TP.cells) {
          const x = Math.floor(px / 7), y = Math.floor(py / 7), cell = y * TP.cols + x;
          if (x < 0 || x >= TP.cols || y < 0 || cell >= TP.cells.length || TP.cells[cell]) continue;
          TP.cells[cell] = 1; px = x * 7 + 3.5; py = y * 7 + 3.5;
          radius = Math.min(3, Math.max(0.5, Math.round(r * 2) / 2));
        }
        ctx.moveTo(px + radius, py); ctx.arc(px, py, radius, 0, TAU);
      }
      ctx.fill();
      if (T.dotStroke) { ctx.strokeStyle = TP.colors[b]; ctx.lineWidth = T.dotStroke; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- data and start ---------- */
  const getJSON = f => fetch('data/' + f + '.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  function loadData() {
    return Promise.all(DATA_FILES.map(f =>
      getJSON(f)
        .catch(() => new Promise(res => setTimeout(res, 300)).then(() => getJSON(f)))   // one retry: a local server can drop a request when several arrive at once
        .then(j => { data[f] = j; })
        .catch(e => { data[f] = null; if (REQUIRED.indexOf(f) >= 0) return f + ' (' + e.message + ')'; console.info('[main] optional data file missing: ' + f); })
    )).then(r => r.filter(Boolean));
  }

  const inited = {};
  function initModules() {
    MODS.forEach(n => {
      const m = window.VIS[n];
      if (m && m.init) { inited[n] = 1; safe(n + '.init', () => m.init(hosts[n], data)); }
      else console.info('[main] module not present: ' + n);
    });
    ready = true;
    measure();
    MODS.forEach(n => { const m = window.VIS[n]; if (m && m.resize) safe(n + '.resize', () => m.resize(pw, ph_)); });
  }

  // a retried module script arrived after the modules were started: start that module now
  function lateInit() {
    if (!ready) return;
    MODS.forEach(n => {
      const m = window.VIS[n];
      if (inited[n] || !m || !m.init) return;
      inited[n] = 1;
      safe(n + '.init', () => m.init(hosts[n], data));
      if (m.resize) safe(n + '.resize', () => m.resize(pw, ph_));
    });
  }

  function start() {
    if (!window.BEATS && scriptsPending) { startWaiting = true; return; }   // steps.js is being requested again
    BEATS = window.BEATS || [];
    // The two figures that follow the main result need results to show: without RESULTS they are not part of the page, and the Senate one also needs the Senate block.
    const withheld = ['results-past', 'results-senate'].filter(id => !(window.RESULTS != null && (id === 'results-past' || window.RESULTS.senate)));
    if (BEATS.some(b => withheld.includes(b.id))) BEATS = BEATS.filter(b => !withheld.includes(b.id));
    if (window.RESULTS != null) {
      const R = window.RESULTS;
      const escapeText = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const states = R.n_states_in + ' of ' + (R.n_states_in + R.n_states_out) + ' states in the fitted main estimate.';
      BEATS = BEATS.map(b => b.id === 'results' ? { ...b, html:
        '<p>' + escapeText(R.statement) + '</p><p>' + escapeText(states) + '</p>' +
        '<p>These are first results; they update as slower states pass 90 percent of the expected vote.</p>' } : b);
    }
    if (/[?&]open=all\b/.test(location.search)) Object.keys(RUNS).forEach(k => { runOpen[k] = true; });
    setRuns();
    document.querySelectorAll('a.ph').forEach(a => a.addEventListener('click', e => e.preventDefault()));
    // "Scroll to begin": a smooth scroll to the point where the first beat becomes current, so the hand-off from the map plays on the way
    const begin = $('.tp-begin');
    if (begin) begin.addEventListener('click', e => { if (!tops.length) return; e.preventDefault(); window.scrollTo({ top: Math.ceil(tops[0] - trig), behavior: reducedMotion() ? 'auto' : 'smooth' }); });
    buildBeats();
    buildPanel();
    buildBar();
    showRuns();
    pw = panel.clientWidth; ph_ = panel.clientHeight;
    tops = []; measure();

    window.addEventListener('scroll', () => schedule(false), { passive: true });
    let rt = 0;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(measure, 80); });
    if (window.ResizeObserver) {
      new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(measure, 40); }).observe($('#text'));
      new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(measure, 40); }).observe(panel);
      new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(measure, 40); }).observe($('#tp'));
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
      measure();
      // text widths measured before the fonts arrived are stale: lay the figures out once more
      if (ready) MODS.forEach(n => { const m = window.VIS[n]; if (m && m.resize) safe(n + '.resize', () => m.resize(pw, ph_)); });
    });
    window.addEventListener('load', measure);

    ph.classList.add('on'); ph.textContent = 'Loading\u2026';
    loadData().then(errors => {
      if (errors.length) {
        const box = $('#load-error'); box.hidden = false;
        box.textContent = 'Some of the data for this page didn\u2019t load, so parts of it may be missing. Reloading the page usually fixes it.';
        console.error('[main] data not loaded: ' + errors.join('; '));
      }
      ph.classList.remove('on');
      tpInit();
      initModules();
      const hash = decodeURIComponent(location.hash.slice(1));
      if (runOf(hash)) toggleRun(runOf(hash), true);
      if (hash && IDS.indexOf(hash) >= 0) window.goToBeat(hash, 0.4);
      schedule(true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
