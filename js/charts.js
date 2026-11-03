/* window.VIS.charts (v9): the chart beats of the explainer site.
   v9 beats: check-idea, check-chart, fluke-intro, fluke-reshuffle, power-detect, power-rule-out, power-benchmark (2026-11-02: the detectable effect beside 15 per-dollar estimates from other studies, drawBenchmark, data/dollar.json);
   hol-prices, hol-gradient, hol-question, hol-limits; report-ladder, report-variants, prereg, when, results, about. Three runs in main.js OWNERS.
   v9.4: fluke-intro stands completely still (label above the cards, market and vote shift under each card, no subtitle); fluke-reshuffle runs five reshuffles over p 0.04-0.6 and fills the line over
   0.6-0.76 (beat of 260vh in css/site.css). report-variants:
   one-line labels in a column as wide as the longest (short labels where the chart would get too narrow), two group headers, "Governor race against Senate race", and "Turnout" on its own short axis.
   v9.3: check-idea and check-chart are one figure (drawPlacebo): check-idea builds the furniture and the row labels with no estimates, check-chart brings the estimates in;
   no box and no annotations (the text carries the reasoning). fluke-intro and fluke-reshuffle are one figure (drawTest, layout in testLayout): the intro stands still, the
   reshuffle beat swaps the cards over five scroll-linked reshuffles and then fills the line of results, which is drawn on the same axis (domain -1 to +1, points per extra $10 a month)
   as the two power beats (drawPrec). The page shows the final design only: no crude comparison anywhere.
   scope-3, drawPowerMeaning and the check-reading stage are gone from the routing (the scope figure is in slice.js).
   simple-past, simple-past-2 (drawCrude) are unrouted since v9 and kept for re-insertion.
   Every build is complete by p = 0.45 (test 0.56) and then holds still. placebo-chart and placebo-reading are one figure (PST): the second beat holds the first one's
   picture and only adds its labels. Second-stage rule: the figure builds over p = 0.05-0.25 and its arrows and callout labels come in over p = 0.25-0.32 (v7.2, s2()).
   v7.2 (SPEC "v7.2 conventions"): one heading style (title()), the price token for prices, source lines that fade with their figure, an in-text "Shuffle again".
   Unrouted since v7 but kept, so they can be re-inserted (PI): past-estimates … past-estimates-4 and report-past (drawForest, KY, STAGE, the hist data path).
   In those four past-estimates beats each beat builds its own stage (state-price rows and their average; local-price rows; Kim & Yang row; nothing more) and holds
   the earlier stages fully built, so no mark rebuilds between them.
   Interface: init(el, data), render(state), resize(w, h). Needs d3 v7.
   render() is a pure function of state = {id, next, p, t, w, h} (plus the dots a visitor adds with "Shuffle again").
   No timers: everything moves with the scroll position. The one exception is the button animation. */
(function () {
  'use strict';
  window.VIS = window.VIS || {};
  var d3 = window.d3;

  var MINE = ['simple-past', 'simple-past-2',
    'check-idea', 'check-chart', 'fluke-intro', 'fluke-reshuffle', 'fluke-estimate',
    'power-detect', 'power-rule-out', 'power-benchmark',
    'hol-prices', 'hol-gradient', 'hol-question', 'hol-limits',
    'report-ladder', 'report-variants', 'prereg', 'when', 'results', 'results-past', 'results-senate', 'about'];

  /* The precision figures of the simulations, shared by power-detect, power-rule-out and power-benchmark (rebuilt on the final price window by hand):
     detect: the effect the test finds four times in five; ruleOut: the half-width of the 90 percent interval when the true effect is zero; sd: the spread of one estimate (both distributions). Points per extra $10 a month. */
  var PREC = { detect: 0.37, ruleOut: 0.21, sd: 0.12 };

  var KY = { band: [2, 3] };   // Kim & Yang (2021), converted to vote points per extra $10 a month: roughly 2 to 3

  /* The estimates of the "report-ladder" chart and the variants of "report-variants": made-up numbers, in vote points per extra $10 a month.
     Fixed in the code (no random draws), so the picture is identical on every load. `g` is a group heading without an estimate;
     `sub` rows hang under the heading above; `open` draws a hollow marker (the state versions). v7: four rows, no headings or sub-rows; the intervals widen down the ladder. */
  var LADDER = [
    { lab: 'All counties', est: 1.60, lo: 1.25, hi: 1.95 },
    { lab: 'Within races', est: 1.30, lo: 0.85, hi: 1.75 },
    { lab: 'Unusual part of the rise only', est: 0.45, lo: -0.15, hi: 1.05 },
    { lab: 'Final analysis', est: 0.30, lo: -0.45, hi: 1.05, main: true }
  ];
  var VARIANTS = [   // v9.4: every variation has a hover note (TIPS, key `tip`); `s` is the short label for panels too narrow for the full one; two group headers (`sep`) under the main variations; `turn` draws its own small axis
    { lab: 'Fewer adjustments', tip: 'fewer', est: 0.50, lo: -0.15, hi: 1.15 },
    { lab: 'More adjustments', tip: 'more', est: 0.25, lo: -0.60, hi: 1.10 },
    { lab: 'Without pass-through', tip: 'passthrough', s: 'No pass-through', est: 0.85, lo: -0.10, hi: 1.80 },
    { lab: 'Exposure from vehicles only', tip: 'vehicles', s: 'Vehicles only', est: 0.20, lo: -0.55, hi: 0.95 },
    { lab: 'Without tax-cut states', tip: 'taxcut', s: 'No tax-cut states', est: 0.35, lo: -0.60, hi: 1.30 },
    { lab: 'Leaving out one state at a time', tip: 'leavestate', s: 'Leave out a state', band: true, lo: 0.10, hi: 0.50 },
    { lab: 'Leaving out one region at a time', tip: 'leaveregion', s: 'Leave out a region', band: true, lo: 0.05, hi: 0.60 },
    { lab: 'Senate races only', tip: 'senate', s: 'Senate only', est: 0.15, lo: -0.75, hi: 1.05 },
    { lab: 'Governor races only', tip: 'governor', s: 'Governor only', est: 0.60, lo: -0.50, hi: 1.70 },
    { lab: 'Metro-area prices', tip: 'metro', s: 'Metro prices', est: 0.20, lo: -0.75, hi: 1.15 },
    { lab: 'Earlier rise also local', tip: 'earlier', s: 'Earlier rise local', est: 0.30, lo: -0.50, hi: 1.10 },
    { sep: 'Alternative outcomes' },
    { lab: 'Vote share instead of vote shift', tip: 'voteshare', s: 'Vote share', est: 0.35, lo: -0.45, hi: 1.15 },
    { lab: 'Measured from the previous race for the same office', tip: 'sameoffice', s: 'Previous race', est: 0.45, lo: -0.40, hi: 1.30 },
    { lab: 'Governor race against Senate race', tip: 'govsen', s: 'Governor vs Senate', turn: true, unit: 'points against the governor’s party (governor race minus Senate race) per extra $10 a month', unitS: 'points against governor’s party (governor minus Senate) per $10 a month', est: 0.15, lo: -0.65, hi: 0.95 },   // its own unit (signed by the governor's party), drawn on its own short axis
    { lab: 'Turnout', tip: 'turnout', s: 'Turnout', turn: true, unit: 'turnout points per extra $10 a month', est: 0.05, lo: -0.70, hi: 0.80 },   // its own unit (turnout points per extra $10 a month), drawn on its own short axis   // its own unit (turnout points per extra $10 a month), drawn on its own short axis
    { sep: 'Alternative price measure' },
    { lab: 'Extra fuel cost since January', tip: 'january', s: 'Since January', est: 0.10, lo: -0.50, hi: 0.70 }
  ];
  var REP_DOM = [-1.3, 2.1];

  /* ---------- results integration: when window.RESULTS is not null, use real data ---------- */
  function hasResults() { return window.RESULTS != null; }
  function isStandIn() { return hasResults() && window.RESULTS.stand_in; }
  function resultsTag() {
    if (!hasResults()) return 'Illustrative';
    if (isStandIn()) return 'STAND-IN, NOT RESULTS';
    var R = window.RESULTS;
    if (R.stage === 'first') return 'First results';
    if (R.stage === 'update') return 'Updated results';
    if (R.final) return 'Final results';
    return 'Results';
  }
  function resultsSource() {
    if (!hasResults()) return 'Illustrative: made-up numbers until November 4.';
    var R = window.RESULTS, s = '';
    if (isStandIn()) s += 'STAND-IN, NOT RESULTS. ';
    s += R.n_states_in + ' of ' + (R.n_states_in + R.n_states_out) + ' states';
    if (R.states_out && R.states_out.length && R.states_out.length <= 8) s += ' (waiting: ' + R.states_out.join(', ') + ')';
    s += '. As of ' + (R.as_of || '').replace('T', ' ').replace(/\.\d+Z?$/, ' UTC').replace(/Z$/, ' UTC') + '.';
    s += ' Election results: civicAPI (civicapi.org).';   // attribution required by civicAPI's terms (2026-11-03)
    return s;
  }
  function resultsSourceShort() {   // for a narrow panel: the state count and the time only
    if (!hasResults()) return null;
    var R = window.RESULTS;
    return R.n_states_in + ' of ' + (R.n_states_in + R.n_states_out) + ' states. As of ' + (R.as_of || '').replace('T', ' ').replace(/:\d\d(\.\d+)?Z?$/, ' UTC').replace(/Z$/, ' UTC') + '. civicAPI.';
  }
  function standInMark() {   // a stand-in run: a large red watermark behind the figure, so no screenshot can pass for results
    var fs = Math.max(18, Math.min(G.w / 11, 64));
    return E('text', { x: G.w / 2, y: G.hh / 2, 'text-anchor': 'middle', 'font-family': FONT, 'font-size': fs, 'font-weight': 700, fill: C.rep, opacity: 0.28, transform: 'rotate(-14 ' + G.w / 2 + ' ' + G.hh / 2 + ')', 'pointer-events': 'none' }, 'STAND-IN, NOT RESULTS');
  }
  var rlCache = null, rvCache = null;   // built once per RESULTS object: the drawing code sets fields on the rows (txh, ...) and reads them in later calls, as it does on LADDER and VARIANTS
  function realLadder() {
    if (!hasResults()) return LADDER;
    if (rlCache && rlCache.src === window.RESULTS) return rlCache.v;
    rlCache = { src: window.RESULTS, v: buildLadder() };
    return rlCache.v;
  }
  function buildLadder() {
    return window.RESULTS.ladder.map(function (r, i) {
      if (r.status !== 'run') return { lab: LADDER[i].lab, est: 0, lo: 0, hi: 0, main: r.main, status: r.status };
      return { lab: LADDER[i].lab, est: r.beta_per_10_dollars, lo: r.ci95_lo_per_10_dollars, hi: r.ci95_hi_per_10_dollars, main: r.main, status: r.status };
    });
  }
  function realVariants() {
    if (!hasResults()) return VARIANTS;
    if (rvCache && rvCache.src === window.RESULTS) return rvCache.v;
    rvCache = { src: window.RESULTS, v: buildVariants() };
    return rvCache.v;
  }
  function buildVariants() {
    var out = [], R = window.RESULTS;
    var specs = VARIANTS.slice();
    specs.splice(specs.findIndex(function (v) { return v.tip === 'voteshare'; }) + 1, 0,
      { lab: 'Vote share with the previous election', s: 'Levels: previous election', tip: 'levels_previous' });
    if (!R.final) specs = specs.filter(function (v) { return v.tip !== 'turnout'; });
    else specs.splice(specs.findIndex(function (v) { return v.tip === 'turnout'; }) + 1, 0,
      { lab: 'Turnout interaction with 2024 Republican share', s: 'Turnout × 2024 Republican share', tip: 'turnout_interaction', turn: true,
        unit: 'turnout points per $10/month × 2024 Republican share (state-clustered 95% interval)', unitS: 'Turnout points per $10 × 2024 GOP share' });
    specs.push({ lab: 'Price only', tip: 'price_only', turn: true, unit: 'points per 10 cents', unitS: 'Points per 10 cents' },
      { sep: 'Separate question: state prices' }, { lab: 'State-price analysis', s: 'State prices', tip: 'state_price' });
    specs.forEach(function (v) {
      if (v.sep) { out.push(Object.assign({}, v)); return; }
      var tip = v.tip, found = null;
      R.variants.forEach(function (rv) { if (rv.tip === tip) found = rv; });
      if (!found || found.status !== 'run') {
        var reason = found ? found.status : 'not available';
        out.push(Object.assign({}, v, { est: null, lo: null, hi: null, status: reason }));
        return;
      }
      var r = Object.assign({}, v);
      if (found.band) {
        r.band = true; r.lo = found.lo_per_10_dollars; r.hi = found.hi_per_10_dollars;
        delete r.est;
      } else {
        var suffix = tip === 'price_only' ? '_per_10_cents' : '_per_10_dollars';
        r.est = found['beta' + suffix]; r.lo = found['ci95_lo' + suffix]; r.hi = found['ci95_hi' + suffix];
      }
      r.status = 'run';
      out.push(r);
    });
    return out;
  }
  function realDomain() {
    if (!hasResults()) return REP_DOM;
    var lo = REP_DOM[0], hi = REP_DOM[1];
    var all = realLadder().concat(realVariants());
    all.forEach(function (r) {
      if (r.turn || r.sep) return;   // the two own-unit rows have their own axis
      if (r.lo != null && isFinite(r.lo)) lo = Math.min(lo, r.lo - 0.15);
      if (r.hi != null && isFinite(r.hi)) hi = Math.max(hi, r.hi + 0.15);
      if (r.est != null && isFinite(r.est)) { lo = Math.min(lo, r.est - 0.15); hi = Math.max(hi, r.est + 0.15); }
    });
    return [lo, hi];
  }

  var MAXW = 1100, MAXH = 1000, BAND = 22;   // widest and tallest chart box; the source line sits in a 22px band at the bottom
  var STAGE = { 'past-estimates': 0, 'past-estimates-2': 1, 'past-estimates-3': 2, 'past-estimates-4': 3 };   // the four beats of one figure: stages built so far (unrouted since v7)
  var PST = {};   // v9.3: the placebo figure is two beats (check-idea, check-chart) in one family (FAM); no beat holds another's labels any more
  var CRD = { 'simple-past': 0, 'simple-past-2': 1 };
  var HQL = { 'hol-question': 0, 'hol-limits': 1 };
  var FAM = { 'check-idea': 'chk', 'check-chart': 'chk', prereg: 'timeline', when: 'timeline', 'report-ladder': 'rep', 'report-variants': 'rep', 'fluke-intro': 'test', 'fluke-reshuffle': 'test', 'fluke-estimate': 'test',
    'hol-question': 'hql', 'hol-limits': 'hql', 'power-detect': 'prec', 'power-rule-out': 'prec' };
  var HOLD = { 'fluke-reshuffle': 0.8, 'power-rule-out': 0.6, 'hol-question': 0.8 };   // the figure fades over the last fifth of a beat (t), so a build must be done before p = 0.8   // p after which the picture no longer changes (default 0.46)
  var FALL = { bg: '#FAFAF8', ink: '#1C2128', muted: '#5E6773', rule: '#D9DCE0', accent: '#0E5F6B', accentSoft: '#D7E9EB', rep: '#B2423A', dem: '#2F5D9B' };
  var FONT = (window.THEME && window.THEME.fontLabelCharts) || '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var MINUS = '−';
  var LABELS = {
    'power-benchmark': 'Fifteen estimates from other studies of money and the vote, in two panels on one axis, in vote points per $10 a month, with a vertical line at the effect this test should reliably detect, ' + PREC.detect.toFixed(2) + (hasResults() ? ', and the 2026 main estimate on top' : ''),
    'simple-past': 'Twelve past elections with this year’s extra fuel cost against earlier vote shifts; gray dots for the simplest comparison across all counties',
    'simple-past-2': 'The same chart with within-race estimates added in dark; five of twelve lie outside the range expected when there is no effect',
    'check-idea': 'The twelve-row chart of past elections with labels but no estimates yet',
    'check-chart': 'Twelve placebo estimates for the final comparison; every interval includes zero',
    'fluke-intro': 'Four illustrative markets with the unusual parts of their price rises on cards (minus 5, plus 10, minus 2 and minus 3 cents), the small scatter of vote shift against the unusual part of the rise, whose slope is the result, and the empty line the results will fall on',
    'fluke-estimate': 'The finished reshuffle picture holds, and a teal dot labelled my estimate appears on the line of reshuffled results, far out on the right, outside all of them.',
    'fluke-reshuffle': 'The unusual parts of four illustrative markets’ price rises reshuffled among the markets; each reshuffle changes the slope of the small scatter and drops a dot onto a line of results',
    'power-detect': 'Two distributions on the same axis of results: the gray one of reshuffled results and a second at the detectable effect of ' + PREC.detect.toFixed(2),
    'power-rule-out': 'The gray distribution with a bracket from minus ' + PREC.ruleOut.toFixed(2) + ' to plus ' + PREC.ruleOut.toFixed(2) + ' and shaded zones beyond it',
    'hol-prices': 'Ohio weekly gas price against the Midwest, with the tax suspension and a drop of about 27 cents',
    'hol-gradient': 'Ohio’s 88 counties by exposure and extra fuel cost of the price rise, with a scroll-linked drop for the tax-cut relief',
    'hol-question': 'Ohio’s exposure axis with two schematic lines for whether a cent of relief counts like a cent of price, a bracket for the relief’s own slope, and a second row for the shift against the governor’s party',
    'hol-limits': 'The same two-row schematic with a note that five states chose to cut and when, not at random',
    'holiday-measure': 'Illustrative State H around a tax cut',
    'holiday-split': 'Two Ohio county bars with market price and relief',
    'past-estimates': 'Forest plot of state-price estimates for 2018 to 2024',
    'past-estimates-2': 'The same with local-price rows',
    'past-estimates-3': 'The same with the Kim and Yang band',
    'past-estimates-4': 'The whole forest plot',
    'test-why': 'Forty-four squares sized by weight in the comparison',
    'report-ladder': 'Illustrative estimates in four rows from simplest to main analysis',
    'report-variants': 'Illustrative forest plot of the main estimate and sixteen variations, in three groups: the main variations, alternative outcomes (the last one, turnout, on its own short axis) and an alternative price measure',
    'report-past': 'Forest plot of 2018–2024 estimates and an empty 2026 slot',
    prereg: 'Timeline of the plan and when the results appear',
    when: 'Timeline: plan and code fixed by November 2, Election Day on November 3, first results on November 4, one update about a week later and a final update at 100 percent (turnout added), then House races in December; the first results are highlighted',
    results: hasResults() ? 'The 2026 main estimate shown above the twelve past elections on one axis' : 'Timeline with the first results highlighted',
    'results-past': 'Exploratory estimates for the 2022 and 2024 elections with county prices, and the 2026 main estimate, on one axis',
    'results-senate': 'Estimates for each of the nine competitive Senate races with 95% ranges, the estimate for all nine together, a band for the other Senate races, and the difference between the two',
    about: 'Timeline with the first results highlighted'
  };

  var el, root, svg, btn, tip, D = {}, PTS = 0.1502;
  var W = 0, H = 0, G = null, C = null;
  var last = null, key = '', rev = 0, btnSt = null;
  var extras = [];       // dots the visitor added with "Shuffle again": {perm, v}
  var anim = null;       // running button animation: {from, to, v, t0}
  var mctx = document.createElement('canvas').getContext('2d');

  /* ---------- small helpers ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ramp(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function smooth(a, b, v) { var t = ramp(v, a, b); return t * t * (3 - 2 * t); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function attrs(o) {
    var s = '';
    for (var k in o) if (o[k] != null && o[k] !== false) s += ' ' + k + '="' + o[k] + '"';
    return s;
  }
  function E(tag, o, inner) {
    if (tag === 'text' && o && o['font-weight'] === 600) o['font-weight'] = window.THEME.labelWeight;
    if ((tag === 'line' || tag === 'path') && o && o['stroke-width'] != null)
      o['stroke-width'] *= (window.THEME.chartWeight || 2.8) / 2;   // v9.5 (DESIGN.md §Marks): 1.4x today; THEME default was 2 (1x), now 2.8 (1.4x)
    if (tag === 'rect' && o) { if (+o.height < 0) o.height = 0; if (+o.width < 0) o.width = 0; }   // very small panels (320px) can compute negative sizes
    return '<' + tag + attrs(o) + (inner == null ? '/>' : '>' + inner + '</' + tag + '>'); }
  function grp(a, inner, o) { return a <= 0.004 ? '' : E('g', Object.assign({ opacity: a >= 0.996 ? null : Math.round(a * 1000) / 1000 }, o || {}), inner); }
  function sgn(v, d) { var s = Math.abs(v).toFixed(d == null ? 1 : d); return v < 0 ? MINUS + s : s; }
  function sgnPlus(v, d) { var s = Math.abs(v).toFixed(d == null ? 1 : d); return (v < 0 ? MINUS : '+') + s; }
  function pctS(v) { return Math.round(v * 100) + '%'; }
  function mix(a, b, t) {
    var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), o = 0;
    for (var s = 16; s >= 0; s -= 8) o = o * 256 + Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
    return '#' + ('000000' + o.toString(16)).slice(-6);
  }
  function colors() {
    var T = window.THEME || {}, c = {};
    Object.keys(FALL).forEach(function (k) { c[k] = T[k] || FALL[k]; });
    c.burden = (T.burden && T.burden[1]) || '#C9822B';
    c.burdenDeep = T.inkADeep || '#B86A00';
    c.bar = mix(c.muted, c.bg, 0.55);
    c.faint = mix(c.muted, c.bg, 0.35);
    c.price = (T.price && T.price[1]) || '#5E4A8B'; c.priceSoft = (T.price && T.price[0]) || '#EEE8F3'; c.priceLow = T.priceLow || '#6B7785';   // v7.2 (SPEC §3): price rises and price differences
    return c;
  }
  function tw(s, fs, wt) { mctx.font = (wt === 600 ? window.THEME.labelWeight : wt || 400) + ' ' + fs + 'px ' + FONT; return mctx.measureText(s).width; }
  function wrapLines(s, maxW, fs, wt) {
    var words = String(s).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (cur && tw(t, fs, wt) > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  /* ---------- svg builders ---------- */
  function T(s, x, y, o) {
    o = o || {};
    return E('text', {
      x: r2(x), y: r2(y), 'font-size': o.fs || G.fsA, fill: o.fill || C.ink, 'text-anchor': o.anchor, 'font-weight': o.wt,
      'font-style': o.italic ? 'italic' : null, transform: o.rot ? 'rotate(' + o.rot + ' ' + r2(x) + ' ' + r2(y) + ')' : null,
      stroke: o.halo ? C.bg : null, 'stroke-width': o.halo ? 4 : null, 'paint-order': o.halo ? 'stroke' : null, 'stroke-linejoin': o.halo ? 'round' : null
    }, esc(s));
  }
  function LN(x1, y1, x2, y2, o) { return E('line', Object.assign({ x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2), stroke: C.rule, 'stroke-width': 1 }, o || {})); }
  /* a block of wrapped text; y is the top of the block; returns {svg, box} */
  function N(s, x, y, maxW, o) {
    o = o || {};
    var fs = o.fs || G.fsA, wt = o.wt || 400, lh = Math.round(fs * 1.33), lines = wrapLines(s, maxW, fs, wt), w = 0, anchor = o.anchor || 'start';
    lines.forEach(function (l) { w = Math.max(w, tw(l, fs, wt)); });
    var bx = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
    if (!o.noClamp && G && w < G.w - 8) {            // keep the block inside the chart box at every width
      var pad = G.compact ? 12 : 4, sh = bx < pad ? pad - bx : bx + w > G.w - pad ? G.w - pad - (bx + w) : 0;
      if (sh) { x += sh; bx += sh; }
    }
    var sp = lines.map(function (l, i) { return E('tspan', { x: r2(x), y: r2(y + fs * 0.92 + i * lh) }, esc(l)); }).join('');
    var svgS = E('text', {
      'font-size': fs, fill: o.fill || C.ink, 'text-anchor': anchor === 'start' ? null : anchor, 'font-weight': o.wt, 'font-style': o.italic ? 'italic' : null,
      stroke: o.halo === false ? null : C.bg, 'stroke-width': o.halo === false ? null : 4, 'paint-order': o.halo === false ? null : 'stroke', 'stroke-linejoin': 'round'
    }, sp);
    var bh_ = lines.length * lh;
    if (o.bg) svgS = E('rect', { x: r2(bx - 4), y: r2(y), width: r2(w + 8), height: r2(bh_), fill: C.bg }) + svgS;   // a gap in the grid behind the text
    return { svg: svgS, box: { x: bx, y: y, w: w, h: bh_ }, lh: lh, n: lines.length };
  }
  /* a thin arrow with an open arrowhead; o.bend curves it */
  function ARROW(a, b, o) {
    o = o || {};
    var col = o.col || 'ink', d;
    if (o.bend) {
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      d = 'M' + r2(a.x) + ',' + r2(a.y) + ' Q' + r2(mx - dy / L * o.bend) + ',' + r2(my + dx / L * o.bend) + ' ' + r2(b.x) + ',' + r2(b.y);
    } else d = 'M' + r2(a.x) + ',' + r2(a.y) + ' L' + r2(b.x) + ',' + r2(b.y);
    return E('path', { d: d, fill: 'none', stroke: col === 'accent' ? C.accent : col === 'muted' ? C.muted : C.ink, 'stroke-width': 1, 'stroke-dasharray': o.dash || null, 'marker-end': 'url(#ah-' + col + ')' });
  }
  /* a note plus an arrow from the note's box to a target point; stops `gap` px short of the target */
  function CALL(s, x, y, maxW, target, o) {
    o = o || {};
    var n = N(s, x, y, maxW, o), b = n.box, pad = 5, gap = o.gap == null ? 6 : o.gap, col = o.arrowCol || 'ink', from;
    if (o.from) from = o.from;
    else if (target.x >= b.x && target.x <= b.x + b.w) from = { x: target.x, y: target.y > b.y + b.h / 2 ? b.y + b.h + pad : b.y - pad };
    else if (target.y >= b.y && target.y <= b.y + b.h) from = { x: target.x > b.x + b.w / 2 ? b.x + b.w + pad : b.x - pad, y: target.y };
    else {
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = target.x - cx, dy = target.y - cy;
      var s_ = Math.min((b.w / 2 + pad) / (Math.abs(dx) || 1e-6), (b.h / 2 + pad) / (Math.abs(dy) || 1e-6));
      from = { x: cx + dx * s_, y: cy + dy * s_ };
    }
    var vx = target.x - from.x, vy = target.y - from.y, L = Math.hypot(vx, vy) || 1;
    var to = { x: target.x - vx / L * gap, y: target.y - vy / L * gap };
    return { svg: n.svg + (L > gap + 8 ? ARROW(from, to, { col: col, bend: o.bend, dash: o.dash }) : ''), box: b };
  }
  function defs() {
    function mk(id, col) {
      return E('marker', { id: 'ah-' + id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' },
        E('path', { d: 'M1.5,1.5 L8.5,5 L1.5,8.5', fill: 'none', stroke: col, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    }
    var hatch = E('pattern', { id: 'ch-hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      E('rect', { width: 7, height: 7, fill: C.accentSoft }) + E('line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: C.ink, 'stroke-width': 1.4 }));
    var ruleHatch = E('pattern', { id: 'ch-rule-hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' },
      E('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: C.rule, 'stroke-width': 1.2 }));
    return E('defs', {}, mk('ink', C.ink) + mk('accent', C.accent) + mk('muted', C.muted) + hatch + ruleHatch);
  }
  /* title (and optional plain tag) at the top; returns {svg, bottom} */
  function title(txt, tag, reserve) {   // Barlow 600 at the figure title size; the tag as plain small text (no box)
    var fs = G.fsTitle, tfs = window.THEME.figType.tag[G.compact ? 1 : 0], tgw = tag ? tw(tag, tfs, 500) + 8 : 0, s = '';
    if (G.phone) {
      var ls = wrapLines(txt, G.w - 2 * G.m - (reserve || 100), fs, 600), lhP = Math.round(fs * 1.28);
      ls.forEach(function (l, i) { s += T(l, G.m, G.top + fs * 0.95 + i * lhP, { fs: fs, wt: 600 }); });
      s = E('g', { 'data-fig-title': '1' }, s);
      // The source repeats the status; the phone header reserves its right end for Overview.
      // A measurable anchor keeps the shell's Overview link in the header, below the tag.
      s += E('rect', { 'data-fig-tag': '1', x: G.w - G.m + 8, y: G.top + 2, width: 8, height: 18, fill: 'none' });
      return { svg: s, bottom: G.top + ls.length * lhP + 8 };
    }
    var btn = ((window.innerWidth || 1024) < 600 ? 84 : 147) + 14;   // room on the row for main.js's "Back to the overview" button (147px, 84px under 600px wide) and its gaps
    // the wrap width is measured at the actual title size, so a title never pushes the button below it
    var lines = wrapLines(txt, G.w - 2 * G.m - (tgw ? tgw + 8 : 0) - btn, fs, 600), lh = Math.round(fs * 1.28);
    lines.forEach(function (l, i) { s += T(l, G.m, G.top + fs * 0.95 + i * lh, { fs: fs, wt: 600 }); });
    s = E('g', { 'data-fig-title': '1' }, s);
    var bottom = G.top + lines.length * lh;
    if (tag) {
      // v9.5 (DESIGN.md §Components 5): plain small text, no box
      s += T(tag, G.w - G.m - tgw / 2, G.top + tfs + 2, { fs: tfs, fill: C.muted, anchor: 'middle', wt: 500 });
      s += E('g', { 'data-fig-tag': '1' }, '');   // empty marker for external code that looks for data-fig-tag
      bottom = Math.max(bottom, G.top + tfs + 4);
    }
    return { svg: s, bottom: bottom + 8 };
  }
  function msg(s) { return T(s, G.m, G.top + 20, { fill: C.muted }); }
  /* the grey source line under every chart: SRC records the candidates (longest first); paint() hands them to window.sourceLine
     (shell helper: svg, text, w, h) on the chart box, which draws the 12px muted line in the 22px band; own fallback if it is missing */
  var srcNow = null;
  function SRC(long_, short_, wrap) {
    if (wrap) { srcNow = { wrap: long_ }; return ''; }   // a long source that may wrap upward: drawn here at 12px (srcWrap); the chart keeps SRCW() px free for it
    var c = short_ ? [long_, short_] : [long_], fit = c.filter(function (t) { return tw(t, 12) <= G.w - 30; });   // offer only lines that fit at 12px (the shell would shrink a longer one to 11px)
    srcNow = fit.length ? fit : [c[c.length - 1]]; return '';
  }
  function SRCW(txt) { return (wrapLines(txt, G.w - 24, 12).length - 1) * 15; }
  function srcWrap(box, txt) {
    var lines = wrapLines(txt, G.w - 24, 12), t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('class', 'source-line'); t.setAttribute('font-size', 12); t.setAttribute('fill', C.muted);
    lines.forEach(function (ln, i) {
      var sp = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      sp.setAttribute('x', 12); sp.setAttribute('y', G.hh - 8 - (lines.length - 1 - i) * 15); sp.textContent = ln; t.appendChild(sp);
    });
    box.appendChild(t);
  }
  function srcFallback(box, cands) {
    var fs = 12, txt = cands[cands.length - 1];
    if (tw(txt, fs) > G.w - 24) { while (txt.length > 12 && tw(txt + '…', fs) > G.w - 24) txt = txt.slice(0, -1); txt += '…'; }
    var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('class', 'source-line'); t.setAttribute('x', 12); t.setAttribute('y', G.hh - 7); t.setAttribute('font-size', fs); t.setAttribute('fill', C.muted); t.textContent = txt;
    box.appendChild(t);
  }
  /* v7.2 [S13]: second-stage labels fade in over p 0.25-0.32, so their half-transparent state is brief. s2() maps the old second-stage window
     0.25-0.45 onto 0.25-0.32 and keeps the order of staggered labels; first-stage windows (up to 0.25) are unchanged. */
  function s2(v) { return v <= 0.25 ? v : 0.25 + (Math.min(v, 0.45) - 0.25) * 0.35; }
  function ann(L, a, b) { return ramp(L.p, s2(a), s2(b)) * (1 - (L.out || 0)); }
  function axisBottom(sc, y, ticks, fmt, o) {
    o = o || {};
    var s = LN(sc.range()[0], y, sc.range()[1], y, { stroke: C.faint });
    ticks.forEach(function (v) {
      s += LN(sc(v), y, sc(v), y + 4, { stroke: C.faint });
      s += T(fmt(v), sc(v), y + 4 + G.fsT + 3, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    });
    return s;
  }
  function niceTicks(a, b, n) { return d3.ticks(a, b, n); }
  /* right-aligned label, centred on cy; returns {svg, h} */
  function RL(txt, xr, cy, maxW, o) {
    o = o || {};
    var fs = o.fs || G.fsA, lh = Math.round(fs * 1.33), n = wrapLines(txt, maxW, fs, o.wt || 400).length, h = n * lh;
    return { svg: N(txt, xr, cy - h / 2 + (o.dy || 0), maxW, { anchor: 'end', fs: fs, wt: o.wt, fill: o.fill, halo: false, noClamp: true }).svg, h: h };
  }
  /* the one coefficient mark of the site (PI, 2026-10-30): a thin line running through a solid dot, as in ggplot's geom_pointrange, with no end caps and no halo. The line is a
     paler tint of the dot. It grows out of the estimate by e. o.main: the main estimate, a larger dot and a slightly heavier line; o.open: a hollow dot; o.op: the dot's opacity */
  function IV(xs, cy, r, e, o) {
    o = o || {};
    if (r.status && r.status !== 'run') {
      var why = String(r.status).replace(/^not_run: |^deferred: /, ''), wfs = G.compact ? 11 : 12, wx = xs(0) + 8;
      if (wx + tw(why, wfs) > xs.range()[1]) wx = xs.range()[0] + 8;   // right of the zero line when it fits, so the line does not run through the words
      return T(why, wx, cy + (G.compact ? 4 : 5), { fs: wfs, fill: C.muted, italic: true });
    }   // results: a row that did not run shows why, never a mark
    var col = o.col || C.ink, rad = (G.compact ? 3.5 : 4.5) + (o.main ? 1.5 : 0), xe = xs(r.est), xl = xe + (xs(r.lo) - xe) * e, xh = xe + (xs(r.hi) - xe) * e;
    return LN(xl, cy, xh, cy, { stroke: mix(col, C.bg, 0.4), 'stroke-width': o.main ? 1.75 : 1.25 }) +
      E('circle', { cx: r2(xe), cy: r2(cy), r: rad, fill: o.open ? C.bg : col, stroke: o.open ? col : null, 'stroke-width': o.open ? 1.5 : null, opacity: o.op == null ? null : o.op });
  }
  // grid lines group by group, so that a group's heading sits on clear paper (PI, 2026-10-30); the last group runs down to the axis
  function groupGrid(xs, ticks, rows, axY) {
    var s = '', segs = [], cur = null;
    rows.forEach(function (r) {
      if (r.head != null) { cur = null; return; }
      if (!cur) { cur = { a: r.y - 2, b: 0 }; segs.push(cur); }
      cur.b = r.y + r.h + 2;
    });
    segs[segs.length - 1].b = axY;
    segs.forEach(function (g) { ticks.forEach(function (t) { if (Math.abs(t) > 1e-9) s += LN(xs(t), g.a, xs(t), g.b, { stroke: C.rule }); }); });
    return s;
  }

  /* ================== holiday-prices: Ohio against the Midwest, from the EIA's weekly data ================== */
  function drawHolPrices(L) {
    var X = D.holiday_example, ei = D.eia, cp = G.compact, p = L.p, out = '';
    if (!X || !ei || !ei.states || !ei.states.OH || !ei.padd || !ei.padd['2']) return msg('The Ohio prices are not loaded.');
    var mwm = {}; ei.padd['2'].forEach(function (r) { mwm[r.date] = r.p; });
    var rows = ei.states.OH.filter(function (r) { return r.date >= '2026-06-01' && mwm[r.date] != null; }).map(function (r) {
      return { d: r.date, t: Date.parse(r.date + 'T00:00:00Z'), oh: r.p, mw: mwm[r.date], gap: (r.p - mwm[r.date]) * 100 };
    });
    var n = rows.length, cut = Date.parse(X.cut_date + 'T00:00:00Z'), DAY = 864e5;
    var inB = {}, inA = {}; (X.weeks_before || []).forEach(function (d) { inB[d] = 1; }); (X.weeks_after || []).forEach(function (d) { inA[d] = 1; });
    var tt = title(cp ? 'Ohio’s gas price against the Midwest' : 'Ohio’s weekly gas price against the Midwest average, 2026'); out += tt.svg;
    var relTxt = 'about ' + Math.round(X.relief_cents) + '¢', relFs = G.fsA + (cp ? 0 : 1);
    var ml = cp ? 44 : 60, mr = cp ? Math.max(62, Math.ceil(tw(relTxt, relFs, 700) + 26)) : 134, x0 = ml, x1 = G.w - mr, fsH = G.fsT + 0.5;   // the right margin holds the bracket's label on one line
    var xs = d3.scaleLinear().domain([rows[0].t - 3 * DAY, rows[n - 1].t + 2 * DAY]).range([x0, x1]);
    function xi(k) { var a = Math.floor(k), b = Math.min(a + 1, n - 1); return xs(lerp(rows[a].t, rows[b].t, k - a)); }
    var axisH = 4 + G.fsT + 3 + 8, y0 = tt.bottom + (cp ? 14 : 20), p1t = y0 + 12, bot = G.h - G.m - axisH, avail = bot - p1t - (cp ? 40 : 46);
    var hTop = Math.round(avail * 0.56), p1b = p1t + hTop, p2t = p1b + (cp ? 40 : 46), p2b = bot;
    var y1 = d3.scaleLinear().domain([3.5, 4.5]).range([p1b, p1t]), y2 = d3.scaleLinear().domain([-34, 30]).range([p2b, p2t]);
    // month grid, both panels, and the axis
    [[5, 'Jun'], [6, 'Jul'], [7, 'Aug'], [8, 'Sep'], [9, 'Oct']].forEach(function (q) {
      var xm = xs(Date.UTC(2026, q[0], 1));
      out += LN(xm, p1t, xm, p1b, { stroke: C.rule, opacity: 0.6 }) + LN(xm, p2t, xm, p2b, { stroke: C.rule, opacity: 0.6 }) +
        LN(xm, p2b, xm, p2b + 4, { stroke: C.faint }) + T(q[1] + (cp ? '' : ' 1'), xm, p2b + 4 + G.fsT + 3, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    });
    out += LN(x0, p2b, x1, p2b, { stroke: C.faint });
    // top panel
    out += T(cp ? 'Price, $ a gallon' : 'Regular gasoline, dollars a gallon', x0, y0 + 2, { fs: fsH, fill: C.ink, wt: 600 });
    y1.ticks(cp ? 3 : 5).forEach(function (v) { out += LN(x0, y1(v), x1, y1(v), { stroke: C.rule }) + T('$' + v.toFixed(2), x0 - 6, y1(v) + 4, { fs: G.fsT, fill: C.muted, anchor: 'end' }); });
    var fx = ramp(p, 0.04, 0.22) * (n - 1), fg = ramp(p, 0.09, 0.25) * (n - 1);
    out += E('path', { d: pathPart(rows.map(function (r) { return r.mw; }), xi, y1, 0, fx), fill: 'none', stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' });
    out += E('path', { d: pathPart(rows.map(function (r) { return r.oh; }), xi, y1, 0, fx), fill: 'none', stroke: C.price, 'stroke-width': 2.6, 'stroke-linejoin': 'round' });
    // direct labels at the line ends
    var la = ramp(p, 0.19, 0.25), yo = y1(rows[n - 1].oh) + 6, ym = y1(rows[n - 1].mw) - 2;
    if (yo - ym < 15) { var mid = (yo + ym) / 2; yo = mid + 8; ym = mid - 8; }
    out += grp(la, T('Ohio', x1 + 9, yo + 4, { fs: G.fsA, fill: C.price, wt: 700 }) + T(cp ? 'Midwest' : 'Midwest average', x1 + 9, ym + 4, { fs: G.fsA, fill: C.ink, wt: 600 }));
    // bottom panel: Ohio minus the Midwest
    out += T(cp ? 'Ohio minus Midwest, cents' : 'Ohio minus the Midwest average, cents', x0, p1b + (cp ? 26 : 30), { fs: fsH, fill: C.ink, wt: 600 });
    y2.ticks(cp ? 3 : 6).forEach(function (v) {
      out += LN(x0, y2(v), x1, y2(v), { stroke: v === 0 ? C.faint : C.rule, 'stroke-width': v === 0 ? 1.3 : 1 }) + T(v === 0 ? '0' : (v < 0 ? MINUS : '+') + Math.abs(v), x0 - 6, y2(v) + 4, { fs: G.fsT, fill: C.muted, anchor: 'end' });
    });
    if (!cp) out += T('Ohio higher', x1 - 2, p2t + 12, { fs: G.fsT, fill: C.muted, anchor: 'end' }) + T('Ohio lower', x1 - 2, p2b - 6, { fs: G.fsT, fill: C.muted, anchor: 'end' });
    var gp = '', gd = '';
    gp = E('path', { d: pathPart(rows.map(function (r) { return r.gap; }), xi, y2, 0, fg), fill: 'none', stroke: C.faint, 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
    rows.forEach(function (r, k) {
      if (k > fg + 1e-9) return;
      var used = inB[r.d] || inA[r.d];
      // v9.5 (DESIGN.md §Marks): outlined dots, 1-1.25px stroke in the dot's color, fill at ~20%
      gd += E('circle', { cx: r2(xi(k)), cy: r2(y2(r.gap)), r: cp ? 2.8 : 3.4, fill: used ? mix(C.ink, C.bg, 0.8) : mix(C.faint, C.bg, 0.8), stroke: used ? C.ink : C.faint, 'stroke-width': 1.1 });
    });
    out += gp + gd;
    // the two averages
    var tB = X.weeks_before.map(function (d) { return Date.parse(d + 'T00:00:00Z'); }), tA = X.weeks_after.map(function (d) { return Date.parse(d + 'T00:00:00Z'); });
    var mB = xs(tB[0]), mB2 = xs(tB[tB.length - 1]), mA = xs(tA[0]), mA2 = xs(tA[tA.length - 1]), vB = X.gap_before_cents, vA = X.gap_after_cents;
    out += grp(ramp(p, 0.19, 0.26), LN(mB - 4, y2(vB), mB2 + 4, y2(vB), { stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }) + LN(mA - 4, y2(vA), mA2 + 4, y2(vA), { stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    // second stage: the day Ohio suspends its tax, and the drop between the two averages
    var xc = xs(cut), a2 = ann(L, 0.25, 0.35), a3 = ann(L, 0.33, 0.45);
    var mk = LN(xc, y0 + 8, xc, p2b, { stroke: C.ink, 'stroke-dasharray': '1.5 4', 'stroke-width': 1.4, 'stroke-linecap': 'round' });
    var lw = tw('Ohio suspends its 38.5¢ tax', fsH, 700);
    mk += T('Ohio suspends its 38.5¢ tax', Math.min(xc + 4 + lw / 2, G.w - G.m - lw / 2), y0 + 2, { fs: fsH, fill: C.ink, wt: 700, anchor: 'middle', halo: true });
    out += grp(a2, mk);
    var bx = mA2 + (cp ? 7 : 12), yT = y2(vB), yB = y2(vA), dr = '';
    dr += LN(mB2 + 4, yT, bx + 6, yT, { stroke: C.price, 'stroke-dasharray': '2 3', 'stroke-width': 1.1 });
    dr += E('path', { d: 'M' + r2(bx) + ',' + r2(yT) + ' h6 V' + r2(yB) + ' h-6', fill: 'none', stroke: C.price, 'stroke-width': 1.8 });
    var mid2 = (yT + yB) / 2;
    dr += N(relTxt, bx + 12, mid2 - G.fsA * 0.66, G.w - (bx + 12) - 2, { fs: relFs, wt: 700, fill: C.price, halo: true }).svg;
    if (!cp) {
      dr += T('+' + Math.round(vB) + '¢ before', bx + 12, yT - 2, { fs: G.fsT, fill: C.muted, halo: true }) + T(MINUS + Math.abs(Math.round(vA)) + '¢ since', bx + 12, yB + 12, { fs: G.fsT, fill: C.muted, halo: true });
    }
    out += grp(a3, dr);
    out += SRC('Source: U.S. Energy Information Administration, weekly retail gasoline prices (Ohio; Midwest region, which includes Ohio).', 'Source: EIA weekly retail gasoline prices.');
    return out;
  }

  /* ================== holiday-measure: the gas-tax cut in an illustrative "State H" ================== */
  var HS = null, HN = 95, HD = 65, HREL = 0.30;   // days from Aug 1 to Election Day (Nov 3); the tax is suspended on day 65 (Oct 5); relief in dollars a gallon
  function holSetup() {
    if (HS) return HS;
    var rng = seededRng(20261022), i;
    function nrm() { var u = 1 - rng(), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
    var cmp = [], act = [], cf = [], c = 4.02, e = 0;
    for (i = 0; i < HN; i++) { c += (i < 38 ? 0.0012 : 0.0030) + 0.0040 * nrm(); cmp.push(c); }   // similar states that kept their taxes: a drifting random walk
    for (i = 0; i < HN; i++) {
      e = 0.6 * e + 0.0035 * nrm();
      if (i < HD) { act.push(cmp[i] + 0.07 + e); cf.push(act[i]); }
      else {
        cf.push(act[HD - 1] + cmp[i] - cmp[HD - 1]);                                   // the estimate: State H's last price, moved as the comparison states moved
        act.push(cf[i] + e - HREL * (1 - Math.exp(-(i - HD + 1) / 1.3)));             // what drivers paid: about 30 cents lower within a few days
      }
    }
    var gap = d3.mean(d3.range(HN - 20, HN), function (k) { return cf[k] - act[k]; });
    HS = { act: act, cf: cf, gap: gap };
    return HS;
  }
  /* a polyline through arr[i0..fi] (fi may be fractional) */
  function pathPart(arr, xs, ys, i0, fi) {
    var d = '', n = Math.floor(fi), k;
    for (k = i0; k <= n && k < arr.length; k++) d += (k === i0 ? 'M' : 'L') + r2(xs(k)) + ',' + r2(ys(arr[k]));
    if (fi > n && n + 1 < arr.length && n >= i0) d += 'L' + r2(xs(fi)) + ',' + r2(ys(lerp(arr[n], arr[n + 1], fi - n)));
    return d;
  }
  function drawHolMeasure(L) {
    var S = holSetup(), cp = G.compact, p = L.p, out = '';
    var tt = title(cp ? 'State H: pump prices around a tax cut' : 'State H: what drivers paid, and what they would have paid', 'Illustrative'); out += tt.svg;
    var ml = cp ? 58 : 60, mr = G.m + 4, top = tt.bottom + 18, bot = G.h - (cp ? 50 : 60);
    var ys = d3.scaleLinear().domain([d3.min(S.act) - 0.07, d3.max(S.cf) + 0.09]).nice(5).range([bot, top]), xs = d3.scaleLinear().domain([0, HN - 1]).range([ml, G.w - mr]);
    ys.ticks(cp ? 4 : 6).forEach(function (v) {
      out += LN(ml, ys(v), G.w - mr, ys(v), { stroke: C.rule }) + T('$' + v.toFixed(2), ml - 7, ys(v) + 4, { fs: G.fsT, fill: C.muted, anchor: 'end' });
    });
    out += LN(ml, bot, G.w - mr, bot, { stroke: C.faint });
    [[0, 'Aug 1'], [31, 'Sep 1'], [61, 'Oct 1'], [94, 'Nov 3']].forEach(function (q, i) {
      out += LN(xs(q[0]), bot, xs(q[0]), bot + 4, { stroke: C.faint }) + T(q[1], xs(q[0]), bot + 4 + G.fsT + 3, { fs: G.fsT, fill: C.muted, anchor: i === 3 ? 'end' : 'middle' });
    });
    out += T('Election Day', xs(94), bot + 4 + 2 * (G.fsT + 3), { fs: G.fsT, fill: C.muted, anchor: 'end' });
    out += T('Pump price, $ a gallon, 2026', cp ? 13 : 16, (top + bot) / 2, { fs: G.fsT, fill: C.ink, anchor: 'middle', rot: -90 });

    var fi = ramp(p, 0.04, 0.25) * (HN - 1), a0 = ann(L, 0.25, 0.33);
    // the gap between the two lines, shaded from the day of the suspension on
    if (fi > HD - 1) {
      var up = [], dn = [], k, n = Math.floor(fi);
      for (k = HD - 1; k <= n && k < HN; k++) { up.push([xs(k), ys(S.cf[k])]); dn.push([xs(k), ys(S.act[k])]); }
      if (fi > n && n + 1 < HN) { up.push([xs(fi), ys(lerp(S.cf[n], S.cf[n + 1], fi - n))]); dn.push([xs(fi), ys(lerp(S.act[n], S.act[n + 1], fi - n))]); }
      out += E('path', { d: 'M' + up.map(function (q) { return r2(q[0]) + ',' + r2(q[1]); }).join('L') + 'L' + dn.reverse().map(function (q) { return r2(q[0]) + ',' + r2(q[1]); }).join('L') + 'Z', fill: C.priceSoft });   // prices and price gaps in the violet (SPEC §3)
    }
    // the day of the suspension
    out += grp(a0, LN(xs(HD), top - 4, xs(HD), bot, { stroke: C.ink, 'stroke-dasharray': '1.5 4', 'stroke-width': 1.4, 'stroke-linecap': 'round' }) +
      N(cp ? 'Oct 5: tax suspended' : 'Oct 5: gas tax suspended', xs(HD) - 8, bot - (cp ? 36 : 44), cp ? 90 : 150, { anchor: 'end', wt: 600, fill: C.ink }).svg);
    out += E('path', { d: pathPart(S.act, xs, ys, 0, fi), fill: 'none', stroke: C.ink, 'stroke-width': 2.4, 'stroke-linejoin': 'round' });
    if (fi > HD - 1) out += E('path', { d: pathPart(S.cf, xs, ys, HD - 1, fi), fill: 'none', stroke: C.muted, 'stroke-width': 2, 'stroke-dasharray': '6 4', 'stroke-linejoin': 'round' });

    // labels
    var xe = xs(HN - 1), lw = Math.max(80, xe - xs(HD) - 14), amin = d3.min(S.act.slice(HD));
    var lab1 = N(cp ? 'Estimate without the suspension' : 'Estimated price without the suspension, from similar states that kept their taxes', xe, ys(S.cf[HN - 1]) - (cp ? 46 : 56), lw, { anchor: 'end', fill: C.muted, wt: 600 });
    out += grp(ann(L, 0.29, 0.39), lab1.svg);
    out += grp(ann(L, 0.27, 0.37), N(cp ? 'What drivers paid' : 'What drivers paid at the pump', xe, ys(amin) + 12, lw, { anchor: 'end', wt: 600 }).svg);
    var mi = Math.round(HD + (HN - 1 - HD) * (cp ? 0.55 : 0.45)), gm = (S.cf[mi] + S.act[mi]) / 2;
    var gl = N(cp ? 'relief to drivers' : 'relief that reached drivers', xs(mi), ys(gm) - (cp ? 18 : 22), 200, { anchor: 'middle', wt: 700, fill: C.price, halo: false, fs: G.fsA + (cp ? 0 : 1) });
    out += grp(ann(L, 0.35, 0.45), gl.svg + N('about ' + Math.round(S.gap * 100) + '¢ a gallon', xs(mi), gl.box.y + gl.box.h + 2, 200, { anchor: 'middle', fill: C.price, halo: false }).svg);
    out += SRC('Illustrative: simulated prices.');
    return out;
  }

  /* ================== holiday-split: the extra fuel cost split, with two real Ohio counties ================== */
  function drawHolSplit(L) {
    var X = D.holiday_example, cp = G.compact, p = L.p, out = '';
    if (!X || !X.counties) return msg('The Ohio county figures are not loaded.');
    var tt = title(cp ? 'Two Ohio counties: extra fuel cost and tax cut' : 'Two Ohio counties: the extra fuel cost from the market price, and the relief from the tax cut'); out += tt.svg;
    var sub = N(cp ? 'Share of a typical household’s monthly income.' : 'Extra fuel costs since the 2024 election, as a share of a typical household’s monthly income.', G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false });
    out += sub.svg;
    var x0 = G.m + 4, x1 = G.w - G.m - (cp ? 10 : 24), xs = d3.scaleLinear().domain([0, 3.2]).range([x0, x1]);
    var CK = [
      { c: X.counties.high_rural, desc: 'a rural county in southern Ohio', k: 0 },
      { c: X.counties.low_suburban, desc: 'a suburb of Columbus', k: 1 }
    ];
    var axisH = 4 + G.fsT + 3 + 22, top = sub.box.y + sub.box.h + (cp ? 12 : 22), bot = G.h - G.m - axisH;
    var bh = cp ? 20 : clamp((bot - top) / 8, 30, 56), labH = cp ? 16 : 24, hdrH = 2 * Math.round((G.fsA + 1) * 1.33) + (cp ? 4 : 8) + 2, natH = hdrH + labH + bh + (cp ? 40 : 52);
    var gapB = clamp((bot - top - 2 * natH) * 0.4, cp ? 14 : 30, 90), blockH = natH + gapB, top0 = top + Math.max(0, (bot - top - (2 * natH + gapB)) * 0.4);
    bot = Math.min(bot, top0 + 2 * natH + gapB + (cp ? 4 : 8));
    CK.forEach(function (q, i) {
      var c = q.c, d = c.market_part, rl = -c.relief_part, nt = c.net, yy = top0 + i * blockH, a1 = ramp(p, 0.05 + 0.04 * i, 0.17 + 0.04 * i), a2 = ramp(p, 0.15 + 0.04 * i, 0.25), s = '';
      var nm = N(c.name + ', Ohio', G.m, yy, G.w - 2 * G.m, { fs: G.fsA + (cp ? 0 : 1), wt: 700, halo: false });
      var dn = N(q.desc + ': a $1 rise costs ' + c.exposure.toFixed(1) + ' percent of income', G.m, yy + nm.box.h, G.w - 2 * G.m, { fs: G.fsT + 0.5, fill: C.muted, halo: false });
      s += nm.svg + dn.svg;
      var by = yy + nm.box.h + dn.box.h + labH + (cp ? 4 : 8), e = ease(a1);
      // the market part grows from the left; the relief is the end of it, turning accent
      s += E('rect', { x: r2(x0), y: r2(by), width: r2((xs(d) - x0) * e), height: bh, fill: C.burden });
      s += E('rect', { x: r2(xs(nt)), y: r2(by), width: r2((xs(d) - xs(nt)) * ease(a2)), height: bh, fill: C.accent });
      s += LN(x0, by - 3, x0, by + bh + 3, { stroke: C.ink, 'stroke-width': 1.2 });
      out += grp(Math.min(1, a1 * 3), s);
      // second stage: the labels
      var al = ann(L, 0.25 + 0.04 * i, 0.37 + 0.04 * i), t = '';
      t += LN(xs(nt), by - 5, xs(nt), by + bh + 5, { stroke: C.ink, 'stroke-width': 1.6 });
      t += T((cp ? 'net ' : 'net extra fuel cost ') + nt.toFixed(1) + '%', xs(nt) - 5, by - 7, { fs: G.fsA, wt: 700, anchor: 'end', halo: true });
      t += T('relief ' + rl.toFixed(1) + '%', xs(nt) + 5, by - 7, { fs: G.fsA, wt: 700, fill: C.accent, halo: true });
      var by2 = by + bh + (cp ? 9 : 12);
      t += E('path', { d: 'M' + r2(x0) + ',' + r2(by2 - 4) + ' v4 H' + r2(xs(d)) + ' v-4', fill: 'none', stroke: C.ink, 'stroke-width': 1 });
      t += N((cp ? 'from the market price: ' : 'extra fuel cost from the market price: ') + d.toFixed(1) + '%', x0, by2 + 4, G.w - 2 * G.m, { fs: G.fsA, fill: C.ink, wt: 600 }).svg;
      out += grp(al, t);
    });
    // one axis for both bars
    var axY = bot + 4;
    out += axisBottom(xs, axY, [0, 1, 2, 3], function (v) { return v + '%'; });
    out += T('Percent of a typical household’s monthly income', (x0 + x1) / 2, axY + 4 + G.fsT + 3 + 15, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    out += SRC('Sources: U.S. Energy Information Administration (Ohio weekly prices); American Community Survey (exposure). The relief is a rough estimate from weekly prices.', 'Sources: EIA; American Community Survey. Rough estimate.');
    return out;
  }

  /* ================== holiday-compare, holiday-limits: the two responses still to be estimated ================== */
  function drawHolCompare(L) {
    var cp = G.compact, lim = L.beat === 'holiday-limits', p = lim ? 1 : L.p, out = '', sf = cp ? 1 : clamp(G.h / 700, 1, 1.5);
    var tt = title(cp ? 'Two responses, estimated side by side' : 'Two responses to estimate, side by side'); out += tt.svg;
    var sub = N('Vote points against the president’s party per extra $10 a month in fuel costs.', G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false });
    out += sub.svg;
    var x0 = G.m + 6, x1 = G.w - G.m - 6, xe = d3.scaleLinear().domain([-2, 2]).range([x0, x1]);
    var noteH = cp ? 46 : 46, top = sub.box.y + sub.box.h + noteH, axY = G.h - G.m - (4 + G.fsT + 3 + 24);
    var rh = clamp((axY - top) / 5.2, cp ? 34 : 50, cp ? 56 : 84), gapR = Math.round(rh * 0.62), ey = top + Math.max(0, (axY - top - (2 * rh + gapR + 40)) * 0.15);
    var es = '', zy0 = ey - 4;
    if (lim) {
      var nn = N('five states; the states chose when to cut', G.m, sub.box.y + sub.box.h + (cp ? 8 : 14), G.w - 2 * G.m, { fs: G.fsA + (cp ? 0.5 : 1.5), wt: 700, fill: C.accent, halo: false });
      out += grp(ann(Object.assign({}, L, { p: L.p }), 0.05, 0.25), nn.svg);
    }
    [['Response to market price changes', 0.05], ['Response to the tax-cut relief', 0.11]].forEach(function (q, i) {
      var ln = N(q[0], G.m, ey, G.w - 2 * G.m, { fs: G.fsA + (cp ? 0.5 : 1.5), wt: 600 }), bt = ey + ln.box.h + 4;
      es += grp(ramp(p, q[1], q[1] + 0.12), ln.svg + E('rect', { x: r2(x0), y: r2(bt), width: r2(x1 - x0), height: r2(rh), rx: 3, fill: i ? C.accentSoft : 'none', 'fill-opacity': 0.55, stroke: C.accent, 'stroke-width': 1.2, 'stroke-dasharray': '6 4' }));
      es += grp(ann(lim ? { p: 1 } : L, 0.27 + 0.05 * i, 0.4 + 0.05 * i), T('estimate from Nov 4', xe(0) - (cp ? 10 : 16), bt + rh / 2 + 5, { fs: G.fsA + 1, fill: C.accent, anchor: 'end', wt: 600, halo: true }));
      ey = bt + rh + gapR;
    });
    var ax2 = Math.min(axY, ey - gapR + 22);
    out += grp(ramp(p, 0.03, 0.15), LN(xe(0), zy0, xe(0), ax2, { stroke: C.ink, 'stroke-dasharray': '4 3', 'stroke-width': 1.2 }) + T('no effect', xe(0), zy0 - 4, { fs: G.fsT + 0.5, anchor: 'middle', halo: true }) +
      axisBottom(xe, ax2, [-2, -1, 0, 1, 2], function (v) { return v === 0 ? '0' : sgn(v, 0); }) +
      T('Vote points per extra $10 a month', (x0 + x1) / 2, ax2 + 4 + G.fsT + 3 + 15, { fs: G.fsT, fill: C.muted, anchor: 'middle' }));
    out += es;
    out += SRC('Source: project estimates, from November 4.');
    return out;
  }

  /* ================== placebo-idea: this year's extra fuel cost against twelve earlier elections (a schematic) ================== */
  var MIDS = [2002, 2006, 2010, 2014, 2018, 2022], PRES = [2000, 2004, 2008, 2012, 2016, 2020];
  function drawPlaceboIdea(L) {
    var cp = G.compact, p = L.p, out = '', fsY = G.fsT;
    var tt = title(cp ? 'This year’s extra fuel cost and earlier elections' : 'This year’s extra fuel cost, set against twelve earlier elections'); out += tt.svg;
    // the 2026 box: its text sets its size
    var bfs = G.fsA + (cp ? 0 : 1), boxW = cp ? Math.min(176, (G.w - 2 * G.m) * 0.5) : clamp(G.w * 0.26, 190, 250), bpad = cp ? 8 : 12;
    var bt = N('the unusual part of this year’s extra fuel cost, county by county', 0, 0, boxW - 2 * bpad, { fs: bfs, wt: 600, halo: false, noClamp: true });
    var yrH = Math.round((bfs + 3) * 1.2), boxH = bpad + yrH + 4 + bt.box.h + bpad;
    var x0 = G.m + (cp ? 2 : 6), x1 = G.w - G.m - boxW / 2, xs = d3.scaleLinear().domain([2000, 2026]).range([x0, x1]);
    // vertical stack: the arrow's label, the box, the two rows of elections
    var lt = 'used to ‘explain’ earlier vote shifts it can’t have caused', lfs = G.fsA + (cp ? 0 : 1), lW = Math.min(cp ? 190 : 330, x1 - boxW / 2 - x0 - 10);
    var nl0 = wrapLines(lt, lW, lfs, 600).length; lW = Math.min(lW, Math.ceil(tw(lt, lfs, 600) / nl0) + 24);   // balanced lines, no orphan word
    var labH = wrapLines(lt, lW, lfs, 600).length * Math.round(lfs * 1.33);
    var rlH = fsY + 6, rowGap = cp ? 30 : 44, markH = cp ? 28 : 36;
    var blockH = labH + (cp ? 30 : 40) + boxH + (cp ? 44 : 64) + 2 * (rlH + markH) + rowGap;
    var yLab = tt.bottom + Math.max(cp ? 10 : 24, (G.h - tt.bottom - blockH) * 0.22);   // v7.2 [5.2]: the schematic sits high in the panel
    var yBox = yLab + labH + (cp ? 30 : 40), xBoxL = xs(2026) - boxW / 2;
    var yR1L = yBox + boxH + (cp ? 44 : 64), yR1 = yR1L + rlH + markH / 2 - 4, yR2L = yR1 + markH / 2 + rowGap, yR2 = yR2L + rlH + markH / 2 - 4;
    var o_ = 1 - (L.out || 0);
    // stage 1: the two rows build from left to right, then 2026 comes in
    var aRow = function (yr) { return ramp(p, 0.05 + 0.13 * (yr - 2000) / 24, 0.09 + 0.13 * (yr - 2000) / 24); };
    out += grp(ramp(p, 0.04, 0.09), T('midterms', x0, yR1L + fsY * 0.9, { fs: fsY, wt: 600, fill: C.ink }) + T('presidential elections', x0, yR2L + fsY * 0.9, { fs: fsY, wt: 600, fill: C.ink }) +
      LN(x0, yR1, xs(2024), yR1, { stroke: C.rule }) + LN(x0, yR2, xs(2024), yR2, { stroke: C.rule }));
    MIDS.forEach(function (yr) {
      var a = aRow(yr);
      out += grp(a, E('circle', { cx: r2(xs(yr)), cy: r2(yR1), r: cp ? 4.5 : 5.5, fill: C.ink, stroke: C.bg, 'stroke-width': 1.5 }) +
        T(String(yr), xs(yr), yR1 + (cp ? 18 : 21), { fs: fsY, fill: C.muted, anchor: 'middle' }));
    });
    PRES.forEach(function (yr, i) {
      var a = aRow(yr + 2), xa = xs(yr + (cp ? 0.5 : 0.3)), xb = xs(yr + (cp ? 3.5 : 3.7)), s = '';
      s += LN(xa, yR2, xb, yR2, { stroke: C.ink, 'stroke-width': 2.4, 'stroke-linecap': 'round' });
      if (!cp) s += E('circle', { cx: r2(xa), cy: r2(yR2), r: 3, fill: C.ink }) + E('circle', { cx: r2(xb), cy: r2(yR2), r: 3, fill: C.ink });
      if (!cp || i === 0 || i === PRES.length - 1) s += T(yr + '–' + String(yr + 4).slice(2), (xa + xb) / 2, yR2 + (cp ? 18 : 21), { fs: fsY, fill: C.muted, anchor: 'middle' });
      out += grp(a, s);
    });
    var aB = ramp(p, 0.17, 0.25), bx = '';
    // 2026 is the next midterm: its mark sits at the end of the midterm row, which runs on to it as a dashed line (orchestrator, v7)
    bx += LN(xs(2024), yR1, xs(2026), yR1, { stroke: C.rule, 'stroke-dasharray': '3 3' });
    bx += LN(xs(2026), yBox + boxH, xs(2026), yR1, { stroke: C.accent, 'stroke-width': 1.2 });
    bx += E('circle', { cx: r2(xs(2026)), cy: r2(yR1), r: cp ? 4.5 : 5.5, fill: C.accent, stroke: C.bg, 'stroke-width': 1.5 });
    bx += E('rect', { x: r2(xBoxL), y: r2(yBox), width: r2(boxW), height: r2(boxH), rx: 3, fill: C.accentSoft, stroke: C.accent, 'stroke-width': 1.4 });
    bx += T('2026', xBoxL + bpad, yBox + bpad + bfs + 2, { fs: bfs + 3, wt: 700, fill: C.accent });
    bx += N('the unusual part of this year’s extra fuel cost, county by county', xBoxL + bpad, yBox + bpad + yrH + 4, boxW - 2 * bpad, { fs: bfs, wt: 600, fill: C.ink, halo: false, noClamp: true }).svg;
    out += grp(aB, bx);
    // stage 2: one curved arrow from the box back over the earlier elections, and its label
    // v7.2 [5.2]: the arrow lands on a light bracket over all twelve elections, not on one of them
    var yBr = yR1L - (cp ? 12 : 16), brk = E('path', { d: 'M' + r2(xs(2000)) + ',' + r2(yBr + 6) + ' V' + r2(yBr) + ' H' + r2(xs(2024)) + ' V' + r2(yBr + 6), fill: 'none', stroke: C.muted, 'stroke-width': 1 });
    var A = { x: xBoxL - 6, y: yBox + boxH * 0.42 }, B = { x: xs(2012), y: yBr - 3 };
    var Cq = { x: lerp(B.x, A.x, 0.62), y: Math.min(A.y, yLab + labH) - (cp ? 4 : 10) };
    var arc = E('path', { d: 'M' + r2(A.x) + ',' + r2(A.y) + ' Q' + r2(Cq.x) + ',' + r2(Cq.y) + ' ' + r2(B.x) + ',' + r2(B.y), fill: 'none', stroke: C.accent, 'stroke-width': 1.4, 'marker-end': 'url(#ah-accent)' });
    var apx = 0.25 * A.x + 0.5 * Cq.x + 0.25 * B.x;
    out += grp(ann(L, 0.25, 0.36), brk + arc);
    out += grp(ann(L, 0.31, 0.43), N(lt, clamp(apx - lW / 2, x0, A.x - lW), yLab, lW, { fs: lfs, wt: 600, fill: C.accent }).svg);
    out += SRC('Schematic. Elections from 2000 to 2024.');
    return out;
  }

  /* ================== placebo-chart, placebo-reading: the twelve placebo estimates (real, provisional) ================== */
  function plFmt(v) { return Math.abs(v) < 0.005 ? '0.00' : sgnPlus(v, 2); }
  var PL_PRES = { mid_2002: 'Bush', mid_2006: 'Bush', mid_2010: 'Obama', mid_2014: 'Obama', mid_2018: 'Trump', mid_2022: 'Biden' };   // v7.1 (causal review C9): the president at each midterm
  function plRows() {
    var P = D.placebo;
    if (!P || !P.rows || !P.rows.length) return null;
    return P.rows;
  }
  function drawPlaceboPhone(L) {
    var rr = plRows(); if (!rr) return msg('The placebo estimates are not loaded.');
    var idea = L.beat === 'check-idea', m = idea ? Math.max(ramp(L.p, 0.08, 0.20), L.to ? L.m : 0) : 1;
    var tt = title('Twelve elections', ''), out = tt.svg;
    var short = G.h < 270, top = tt.bottom + (short ? 8 : 14), axY = G.h - (short ? 47 : 72), two = (axY - top) / 12 < 17;
    var groups = two ? [['midterm', 'Midterms'], ['presidential', 'Presidential']] : [[null, '']];
    var dm = Math.max(1, Math.ceil(d3.max(rr, function (r) { return Math.max(Math.abs(r.lo), Math.abs(r.hi)); }) * 2 + 0.1) / 2);
    groups.forEach(function (gr, j) {
      var rows = gr[0] ? rr.filter(function (r) { return r.kind === gr[0]; }) : rr;
      var left = G.m + j * (G.w - 2 * G.m + 18) / 2, right = two ? left + (G.w - 2 * G.m - 18) / 2 - 12 : G.w - G.m - 8;
      var x0 = left + (two ? 44 : 84), xs = d3.scaleLinear().domain([-dm, dm]).range([x0, right]);
      var unit = (axY - top - 2) / rows.length;
      if (two) out += T(gr[1], left, top - 8, { fs: 11, wt: 600, fill: C.muted });
      out += LN(xs(0), top, xs(0), axY, { stroke: C.ink, 'stroke-dasharray': '4 3' });
      out += axisBottom(xs, axY, two ? [-dm, dm] : [-dm, 0, dm], function (v) { return v === 0 ? '0' : sgnPlus(v, 1); });
      rows.forEach(function (r, i) {
        var y = top + (i + 0.5) * unit, lab = r.label.replace(/ (midterm|presidential)$/, '');
        if (two) lab = lab.replace(/20(\d\d)/g, '$1').replace(/19(\d\d)/g, '$1');
        else if (PL_PRES[r.id]) lab += ', ' + PL_PRES[r.id];
        out += T(lab, x0 - 8, y + 4, { fs: 11, anchor: 'end' });
        if (m > 0.004) out += grp(m, IV(xs, y, r, window.innerWidth < 900 ? 1 : idea ? 1 : ease(ramp(L.p, 0.04 + i * 0.012, 0.12 + i * 0.012))));
        else out += LN(x0, y, right, y, { stroke: C.rule, 'stroke-dasharray': '2 4' });
      });
    });
    groups.forEach(function (gr, j) {
      var left = G.m + (two ? j * (G.w - 2 * G.m + 18) / 2 : 0), right = two ? left + (G.w - 2 * G.m - 18) / 2 : G.w - G.m;
      if (!short) {
        out += T('← Rep.', left, axY + 37, { fs: 13, fill: C.rep, wt: 600 });
        out += T('Dem. →', right, axY + 37, { fs: 13, fill: C.dem, wt: 600, anchor: 'end' });
      }
    });
    out += T('Vote points per extra $10/month', G.w / 2, axY + (short ? 38 : 61), { fs: 13, fill: C.muted, anchor: 'middle' });
    out += SRC('MIT Election Lab; Amlani and Algara.');   // the price window closed on Nov 2: no Provisional status
    return out;
  }

  function drawPlacebo(L) {
    if (G.phone) return drawPlaceboPhone(L);
    var rows0 = plRows();
    if (!rows0) return msg('The placebo estimates are not loaded.');
    /* v9.3: check-idea and check-chart are one figure, with no box and no annotations (the text carries the reasoning). check-idea builds the furniture and the row labels (pb)
       with no estimates (pe = 0); check-chart starts from that picture and brings the estimates in. */
    var idea = L.beat === 'check-idea', mm = idea ? (L.to ? L.m : 0) : 1;   // mm: 0 = the idea beat, 1 = the chart (the morph from the idea to the chart runs in t of check-idea)
    var cp = G.compact, pb = idea ? L.p : 1, pe = idea ? 0 : L.p, p = pb, o_ = 1 - (L.out || 0), out = '';
    var tt = title(cp ? 'Twelve past elections' : 'Twelve past elections: this year’s extra fuel cost against earlier vote shifts', ''); out += tt.svg;
    var axT = 'Points per extra $10 a month of fuel costs';   // on a phone it moves up into the subtitle, so that the twelve rows keep their height; the side labels carry the direction
    var dirT = 'Right = toward the Democrats, in every row.';   // v7.2 [5.1]: an Obama-era row pointing right is not "against Obama"
    var subC = N(cp ? axT + '.' : 'Dot: estimate. Line: the range of effects the data are consistent with (95%). ' + dirT, G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false });
    var subI = N(cp ? 'Final comparison.' : 'Final comparison. ' + dirT, G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false });
    var sub = subC;   // the chart's subtitle sets the layout; the idea beat's text fades into it
    out += grp(mm, subC.svg) + (mm < 0.996 ? grp(1 - mm, subI.svg) : '');
    // the source line wraps on narrow panels; the space it needs is kept free
    var srcT = ['Project estimates on AAA prices, October 13–November 2. Election results: MIT Election Data and Science Lab; Amlani and Algara (2002–2014).',
      'Project estimates. Election results: MIT Election Data and Science Lab; Amlani and Algara (2002–2014).',
      'Project estimates; MIT Election Lab; Amlani and Algara.', 'Project estimates; MIT Election Lab; Amlani and Algara.'];
    srcT = cp ? (srcT.filter(function (t) { return tw(t, 12) <= G.w - 24; })[0] || srcT[1]) : srcT[0];   // the full line wraps on a desktop panel; a phone gets the longest one that fits on one line
    var srcX = SRCW(srcT);
    if (idea && mm < 0.996) srcT = cp ? 'MIT Election Lab; Amlani and Algara.' : 'Election results: MIT Election Data and Science Lab; Amlani and Algara (2002–2014).';   // no estimates yet; the space kept free is the chart's; once the morph completes, the chart's source is canonical
    // rows: two groups, each in time order, with a heading row
    var short = cp && G.h < 340;   // v9: a phone held short (375x667: a 314px panel) cannot fit twelve rows, two headings and the note: no headings (midterm labels carry the president, the others a span of years), no note, 11px labels
    var fl = short ? 11 : G.fsA, rows = [], groups = [['midterm', 'Midterms'], ['presidential', 'Presidential elections']];
    groups.forEach(function (g, gi) {
      rows.push({ head: short ? '' : g[1], wt: short ? (gi ? 0 : 0.8) : 1, pre: gi ? (short ? 0.4 : cp ? 0.3 : 0.45) : 0 });
      rows0.filter(function (r) { return r.kind === g[0]; }).forEach(function (r) { rows.push({ r: r, wt: 1, lab: r.label.replace(/ (midterm|presidential)$/, '') + (PL_PRES[r.id] ? ', ' + PL_PRES[r.id] : '') }); });
    });
    // the midterm labels carry the president (v7.1 desktop; v7.2 [5.1] phones too, so "2018, Trump" is there for the text), so the column fits its widest label
    var labMax = d3.max(rows, function (o) { return tw(o.lab, fl, 400); }) || 0;
    var colL = Math.max(cp ? 54 : 78, Math.ceil(labMax) + (cp ? 12 : 22)), x0 = G.m + colL, x1 = Math.min(G.w - G.m - (cp ? 4 : 24), x0 + 720);
    var M = d3.max(rows0, function (r) { return Math.max(Math.abs(r.lo), Math.abs(r.hi)); }), dm = Math.max(1, Math.ceil(M * 2 + 0.1) / 2);
    var xs = d3.scaleLinear().domain([-dm, dm]).range([x0, x1]), zx = xs(0);
    var off = cp ? 20 : 38, noteH = 0;   // v9.3: no annotation under the axis
    // the side labels: measured first, so that the note below always clears them, even where one has to wrap
    var sfs = cp ? 13 : G.fsT + 0.5, lwid = Math.max(70, zx - off - 2 - G.m), rwid = Math.max(70, G.w - zx - off - 4);
    var sideH = Math.max(N('toward the Republicans', 0, 0, lwid, { fs: sfs, wt: 600, noClamp: true }).box.h, N('toward the Democrats', 0, 0, rwid, { fs: sfs, wt: 600, noClamp: true }).box.h);
    var axisBlock = (4 + G.fsT + 3) + 5 + sideH + (cp ? 0 : 20) + 8 + noteH + 6 - (short ? 16 : 0);   // v9.4 QA: a short phone panel gives the rows the spare room above the source line
    var top = sub.box.y + sub.box.h + (cp ? 4 : 16), bot = G.h - G.m - srcX - axisBlock, tot = d3.sum(rows, function (r) { return r.wt + (r.pre || 0); });
    var unit = Math.min((bot - top) / tot, cp ? 30 : 40), y = top + Math.max(0, (bot - top - unit * tot) * 0.3);
    rows.forEach(function (r) { y += (r.pre || 0) * unit; r.y = y; r.h = unit * r.wt; r.cy = y + r.h / 2; y += r.h; });
    var axY = y + 6;
    // stage 1 furniture: grid, zero line, axis, side labels, axis title
    var aF = ramp(p, 0.03, 0.08), f = '', ticks = cp ? d3.range(-dm, dm + 0.01, 1) : xs.ticks(8);
    f += groupGrid(xs, ticks, rows, axY);
    f += LN(zx, rows[0].cy + 7, zx, axY, { stroke: C.ink, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' });
    f += T('no effect', zx, rows[0].cy + 2, { fs: G.fsT + 0.5, anchor: 'middle', halo: true });
    f += axisBottom(xs, axY, ticks, function (v) { return Math.abs(v) < 1e-9 ? '0' : sgnPlus(v, Math.abs(v - Math.round(v)) > 0.01 ? 1 : 0); });
    var cy2 = axY + 4 + G.fsT + 3 + 14, sideBot = cy2 - 9 + sideH;
    f += N('toward the Republicans', zx - off, cy2 - 9, lwid, { anchor: 'end', fill: C.rep, fs: sfs, wt: 600, noClamp: true }).svg + ARROW({ x: zx - 5, y: cy2 }, { x: zx - off + 5, y: cy2 });
    f += N('toward the Democrats', zx + off, cy2 - 9, rwid, { anchor: 'start', fill: C.dem, fs: sfs, wt: 600, noClamp: true }).svg + ARROW({ x: zx + 5, y: cy2 }, { x: zx + off - 5, y: cy2 });
    if (!cp) f += T(axT, (x0 + x1) / 2, sideBot + 15, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    out += grp(aF, f);
    // the rows come in one after another, top to bottom
    var k = 0, row2018 = null, presHead = null;
    rows.forEach(function (r) {
      if (r.head != null) {
        if (r.pre && r.head) presHead = r;
        out += grp(ramp(p, 0.05 + 0.0125 * k, 0.09 + 0.0125 * k), T(r.head, G.m, r.cy + 4.5, { fs: G.fsA, wt: 600, fill: C.ink }));
        return;
      }
      var q = r.r, a0 = 0.05 + 0.0125 * k, bl = ramp(pb, a0, a0 + 0.06), b = ramp(pe, a0, a0 + 0.06), s = '', e = ease(b), cy = r.cy;
      k++;
      if (q.id === 'mid_2018') row2018 = r;
      if (bl <= 0.004) return;
      s += grp(bl, RL(r.lab, x0 - (cp ? 8 : 14), cy, colL - 10, { fs: fl }).svg);
      if (idea && mm < 0.996) s += grp(bl * (1 - mm), LN(x0, cy, x1, cy, { stroke: C.rule, 'stroke-dasharray': '3 5', 'stroke-width': 0.8 }));   // empty lanes: the estimates will go here
      if (b > 0.004) {
        s += IV(xs, cy, q, e, { op: Math.min(1, b * 3) });
      }
      out += s;
    });
    out += SRC(srcT, null, true);
    return out;
  }

  /* ================== test-why: 44 states, a handful of them carrying most of the weight ================== */
  var WHY_W = null;
  function whyWeights() {   // illustrative: the five largest carry about 60 percent, the other 39 share the rest and fall away geometrically
    if (WHY_W) return WHY_W;
    var top = [0.19, 0.16, 0.14, 0.07, 0.05], rest = [], a = 0.04, i;
    for (i = 0; i < 39; i++) rest.push(a * Math.pow(0.9, i));
    var tot = d3.sum(rest), k = 0.39 / tot;
    WHY_W = top.concat(rest.map(function (v) { return v * k; }));
    return WHY_W;
  }
  /* lay the squares out in rows no wider than maxW, bottom-aligned within a row; returns {sq: [{x, y, s}], h} for the side s0 of the biggest square */
  function packSquares(ws, s0, gap, maxW) {
    var wm = ws[0], rows = [[]], x = 0, sq = [], y = 0, rh = 0, i;
    var sides = ws.map(function (w) { return Math.max(3, s0 * Math.sqrt(w / wm)); });
    for (i = 0; i < ws.length; i++) {
      if (x > 0 && x + sides[i] > maxW) { y += rh + gap * 2; x = 0; rh = 0; }
      rh = Math.max(rh, sides[i]);
      sq.push({ x: x, row: y, s: sides[i], rowH: 0 }); x += sides[i] + gap;
    }
    var h = y + rh, rowTop = {};
    sq.forEach(function (q) { rowTop[q.row] = Math.max(rowTop[q.row] || 0, q.s); });
    sq.forEach(function (q) { q.rowH = rowTop[q.row]; q.y = q.row + q.rowH - q.s; });
    return { sq: sq, h: h };
  }
  function drawTestWhy(L) {
    var cp = G.compact, p = L.p, out = '', ws = whyWeights(), n = ws.length;
    var tt = title(cp ? 'How much each state counts' : 'Forty-four states, and how much each one counts in the comparison', 'Illustrative'); out += tt.svg;
    var capT = 'Each square is a state, sized by how much it counts in the comparison.';
    var cap = N(capT, G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false });
    out += cap.svg;
    var gap = cp ? 2 : 5, maxW = cp ? G.w - 2 * G.m : Math.min(G.w - 2 * G.m, 720), top = cap.box.y + cap.box.h + (cp ? 56 : 80), availH = G.h - G.m - top - (cp ? 16 : 20), s0, pk;
    // v7.2 [6.2]: wrapped rows at every width (one row made the small states dots on desktop): the largest side that still fits the height
    for (s0 = cp ? maxW * 0.3 : Math.min(maxW * 0.3, 170); s0 > 20; s0 -= 3) { pk = packSquares(ws, s0, gap, maxW); if (pk.h <= availH * (cp ? 1 : 0.85)) break; }
    var oy = top + Math.max(0, (availH - pk.h) * 0.35), ox = G.m;
    var HAND = 5, aL = ann(L, 0.25, 0.37), hi = aL;
    pk.sq.forEach(function (q, i) {
      var a = ramp(p, 0.05 + 0.2 * i / n, 0.1 + 0.2 * i / n + 0.05), s = q.s * ease(a);
      if (a <= 0.004) return;
      out += E('rect', { x: r2(ox + q.x + (q.s - s) / 2), y: r2(oy + q.y + (q.s - s)), width: r2(s), height: r2(s), fill: i < HAND ? mix(C.bar, C.accent, hi) : C.bar });
    });
    // second stage: the label and a bracket over the handful
    var bx0 = ox + pk.sq[0].x, bl = Math.min(HAND, pk.sq.filter(function (q) { return q.row === pk.sq[0].row; }).length) - 1, bx1 = ox + pk.sq[bl].x + pk.sq[bl].s, by = oy + pk.sq[0].row - 8, sy = by - 8;
    var lab = 'a handful of states carry most of the weight', lw = Math.min(maxW, cp ? 190 : 340);
    var ln = N(lab, bx0, by - 24 - (wrapLines(lab, lw, G.fsA + (cp ? 0.5 : 1), 700).length - 1) * Math.round((G.fsA + 1) * 1.33), lw, { fs: G.fsA + (cp ? 0.5 : 1), wt: 700, fill: C.accent, halo: false });
    out += grp(aL, ln.svg + E('path', { d: 'M' + r2(bx0) + ',' + r2(by) + ' v-6 H' + r2(bx1) + ' v6', fill: 'none', stroke: C.accent, 'stroke-width': 1.6 }));
    out += SRC('Illustrative: the weights are made up.');
    return out;
  }

  /* ================== forest plots: past-estimates (four stages), report-past ================== */
  /* hover and focus notes: the data behind each state-price estimate (cycle rows, then the average), and the two row labels of report-variants */
  var TIPS = {
    c0: { h: '2018', t: '67 races, 4,039 county-race rows. Prices come from a thin 2016 window (2 days).' },
    c1: { h: '2020', t: '50 races, 3,111 county-race rows. Prices come from a thin 2016 window (2 days); no lagged-price adjustment.' },
    c2: { h: '2022', t: '67 races, 4,191 county-race rows.' },
    c3: { h: '2024', t: '50 races, 3,111 county-race rows.' },
    avg: { h: 'Average of the four elections', t: '14,452 county-race rows in all. The cycles differ in how many races and rows they rest on.' },
    main: { h: 'Main analysis', t: 'Compares counties in nearby local markets of the same kind within the same race, using the unusual part of each market’s extra fuel cost. It adjusts for oil and gas jobs and the earlier vote shift, and for each state’s pass-through and the unusual part of its earlier rise.' },
    fewer: { h: 'Fewer adjustments', t: 'Keeps only the comparison within races and among nearby markets of the same kind, and drops the four adjustments: oil and gas jobs, the 2020–24 vote shift and the two adjustments for state prices. It shows how much the adjustments change the answer.' },
    more: { h: 'More adjustments', t: 'Also accounts for each county’s education, ethnic make-up, population density, age and income. It tests whether those differences between places are behind the result.' },
    passthrough: { h: 'Without pass-through', t: 'Drops the adjustment for how much each state’s price usually moves when the national price moves (for example, because of percentage taxes). It shows whether that adjustment drives the result.' },
    vehicles: { h: 'Exposure from vehicles only', t: 'Measures how much of its income a household spends on gasoline from the number of vehicles it owns alone, instead of from commuting and vehicles together. It is simpler and does not depend on the commuting estimates.' },
    taxcut: { h: 'Without tax-cut states', t: 'Leaves out the states with a gas-tax cut or suspension in force in the weeks before either election, because policy rather than the market moved their prices.' },
    leavestate: { h: 'Leaving out one state at a time', t: 'Repeats the main analysis once for each state, leaving that state out. The band shows the range of the estimates. It tests whether a single state drives the result.' },
    leaveregion: { h: 'Leaving out one region at a time', t: 'Repeats the main analysis once for each fuel supply region, leaving that region out. The band shows the range of the estimates. It tests whether a single region drives the result.' },
    senate: { h: 'Senate races only', t: 'Uses only the Senate races. Governor and Senate races differ in who is on the ballot, so this tests whether one kind of race drives the result.' },
    governor: { h: 'Governor races only', t: 'Uses only the governor races. Governor and Senate races differ in who is on the ballot, so this tests whether one kind of race drives the result.' },
    voteshare: { h: 'Vote share instead of vote shift', t: 'A different outcome. Instead of the vote shift, measured from the 2024 presidential vote, it uses the president’s party’s share of the vote itself, in two forms: allowing a separate slope for each race on the 2024 presidential share, and also on the previous midterm’s share.' },
    levels_previous: { h: 'Vote share with the previous election', t: 'The second levels specification also adjusts for the previous election share, with a separate slope for each race.' },
    price_only: { h: 'Price only', t: 'Uses the price rise alone, without weighting by income or gasoline use. Points per 10 cents, on its own axis.' },
    state_price: { h: 'Separate question: state prices', t: 'Uses the unusual part of the state price rise instead of local market prices, with the main analysis controls and weights.' },
    turnout_interaction: { h: 'Turnout interaction with the 2024 Republican share', t: 'How the turnout effect changes with the 2024 Republican share in points, centred at its weighted mean. The interval uses state-clustered CR1 inference; there is no reshuffling p-value for this interaction.' },
    sameoffice: { h: 'Measured from the previous race for the same office', t: 'A different outcome. The vote shift is measured from the previous race for the same office (the 2022 governor race, or the previous race for the Senate seat) instead of from the 2024 presidential vote.' },
    metro: { h: 'Metro-area prices', t: 'Uses price changes for metropolitan areas instead of county prices grouped into local markets, compared within groups of nearby metropolitan areas formed the same way. It tests whether the way local prices are measured drives the result.' },
    earlier: { h: 'Earlier rise also local', t: 'The main analysis adjusts for the unusual part of each state’s 2020–24 rise, measured at the state level because county prices begin in late 2022. This version also measures it locally, with metro-area prices.' },
    january: { h: 'Extra fuel cost since January', t: 'A different price measure. Each place’s price rise is measured from its January 2026 average to the weeks before Election Day, instead of the two-year change since the 2024 election. The extra fuel cost is exposure times this rise.' },
    govsen: { h: 'Governor race against Senate race', t: 'Governors have some say over fuel prices through state gas taxes. In the 22 states that vote for both a governor and a senator this year, the two races share the same voters and the same price rise. This row asks whether a larger extra fuel cost cost the governor’s party more in the governor race than in the Senate race.' },
    turnout: { h: 'Turnout', t: 'Each county’s total votes in the race as a percent of its 2024 presidential votes. Reported only once every state has counted all its votes, because incomplete counts distort turnout far more than vote shares.' }
  };
  function hitRect(k, x, y, w, h) {
    return E('rect', { 'class': 'ch-hit', 'data-tip': k, tabindex: 0, role: 'img', 'aria-label': TIPS[k].h + ': ' + TIPS[k].t, x: r2(x), y: r2(y), width: r2(w), height: r2(h), rx: 3 });
  }
  function drawForest(L, mode) {
    var Hh = D.hist;
    if (!Hh || !Hh.cycles) return msg('Historical estimates are not loaded.');
    var P = PTS, rp = mode === 'rpast', cp = G.compact, wide = G.w >= 760, out = '', p = L.p, stg = rp ? 0 : (STAGE[L.beat] || 0);   // stg: how many later stages the beat has already built (est only)
    var rows = [];
    Hh.cycles.forEach(function (c, i) {
      rows.push({ k: 'c', lab: String(c.year) + (!rp && wide ? ', state prices' : ''), est: c.est * P, lo: c.lo95 * P, hi: c.hi95 * P, wt: 1, st: 0, tip: 'c' + i, a: rp ? [0.04 + 0.035 * i, 0.12 + 0.035 * i] : [0.05 + 0.03 * i, 0.13 + 0.03 * i] });
    });
    var pl = Hh.pooled;
    rows.push({ k: 'p', lab: rp ? (cp ? 'Average' : 'Average of the four elections') : (cp ? 'Average' : wide ? 'Average, state prices' : 'Average'), est: pl.est * P, lo: pl.lo95 * P, hi: pl.hi95 * P, wt: 1.35, st: 0, pre: 0.3, rule: true, tip: 'avg', a: rp ? [0.18, 0.26] : [0.17, 0.25] });
    if (rp) rows.push({ k: 's', lab: '2026', wt: 1.5, pre: 0.2, a: [0.215, 0.295] });
    else {
      var cm = Hh.cycles_metro || [];
      cm.forEach(function (c, j) {
        rows.push({ k: 'm', lab: c.year + (wide ? ', local prices' : ' local'), est: c.pp10_est, lo: c.pp10_lo95, hi: c.pp10_hi95, wt: 1, st: 1, pre: j ? 0 : 0.3, rule: !j, a: [0.06 + 0.08 * j, 0.22 + 0.08 * j] });
      });
      rows.push({ k: 'y', lab: '', wt: cp ? 1.8 : 1.9, st: 2, pre: 0.3, rule: true, a: [0.06, 0.30] });
    }
    var tt = title(rp ? (cp ? 'Past elections and the 2026 state version' : 'Past elections, and where the 2026 state version will go') : (cp ? 'Past elections: an extra $10 a month' : 'Past elections: the effect of an extra $10 a month in fuel costs'), 'Provisional');
    out += tt.svg;
    var top = tt.bottom + 4;
    if (!cp) {
      var sub = N('Vote points against the president’s party. Dot: estimate. Line: 95% plausible range. Hover over a row of state-price estimates for the data behind it.', G.m, top, G.w - 2 * G.m - (wide ? 130 : 0), { fill: C.muted, fs: G.fsT + 0.5, halo: false });
      out += sub.svg; top += sub.box.h + 8;
    } else {
      var hn = N('Tap a state-price row for the data behind it.', G.m, top, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT, halo: false });
      out += hn.svg; top += hn.box.h + 12;
    }
    var colW = wide ? 168 : 0, x0 = G.m + (wide ? 156 : cp ? 88 : 104), x1 = G.w - G.m - colW - (wide ? 14 : 8);
    var iv = rows.filter(function (r) { return r.lo != null; });
    var lo = d3.min(iv, function (r) { return r.lo; }), hi = d3.max(iv, function (r) { return r.hi; });
    var xs = d3.scaleLinear().domain([Math.min(-1, lo - 0.2), Math.max(1.5, hi + 0.2)]).nice(6).range([x0, x1]);
    var axisBlock = cp ? 94 : 112, bot = G.h - G.m - axisBlock + 20, avail = bot - top - 22;
    var tot = d3.sum(rows, function (r) { return r.wt + (r.pre || 0); }), unit = Math.min(avail / tot, wide ? 84 : 66), y = top + 22 + Math.max(0, (avail - unit * tot) * 0.3);
    rows.forEach(function (r) { y += (r.pre || 0) * unit; r.h = unit * r.wt; r.y = y; r.cy = y + r.h / 2; y += r.h; });
    var gTop = rows[0].y - 6, gBot = rows[rows.length - 1].y + rows[rows.length - 1].h;
    var axY = gBot + 6;
    // grid and zero line
    xs.ticks(cp ? 4 : 8).forEach(function (t) { if (t !== 0) out += LN(xs(t), gTop, xs(t), axY, { stroke: C.rule }); });
    out += LN(xs(0), gTop - 6, xs(0), axY, { stroke: C.ink, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' });
    out += axisBottom(xs, axY, xs.ticks(cp ? 4 : 8), function (v) { return v === 0 ? '0' : sgn(v, 0); });
    if (wide) out += T('Estimate (95% range)', G.w - G.m, gTop - 12, { fs: G.fsT, fill: C.muted, anchor: 'end' });
    var lw = x0 - G.m - 12;

    rows.forEach(function (r) {
      var b = rp ? ramp(p, r.a[0], r.a[1]) : r.st < stg ? 1 : r.st > stg ? 0 : ramp(p, r.a[0], r.a[1]), s = '';   // est: earlier stages stand fully built, later ones are not there yet
      if (r.rule) out += grp(b, LN(G.m, r.y - (r.pre || 0) * unit / 2, G.w - G.m, r.y - (r.pre || 0) * unit / 2, { stroke: C.rule }));
      if (b <= 0) return;
      if (r.k === 's') {
        var rh = Math.min(r.h - 10, 64), rt = r.cy - rh / 2;
        s += T('2026', x0 - 12, r.cy + 5, { fs: G.fsA + 1, wt: 700, fill: C.accent, anchor: 'end' });
        s += E('rect', { x: r2(x0), y: r2(rt), width: r2(x1 - x0), height: r2(rh), rx: 3, fill: 'none', stroke: C.accent, 'stroke-width': 1.2, 'stroke-dasharray': '6 4' });
        s += T(cp ? 'state version: from Nov 4' : '2026 state version: from November 4', (x0 + x1) / 2, r.cy + 5, { fs: G.fsA + 1, wt: 600, fill: C.accent, anchor: 'middle', halo: true });
      } else if (r.k === 'y') {
        // Kim & Yang: a hatched band, not an estimate; the label sits above it, the note below
        var bh = cp ? 14 : 22, e = ease(b), cyb = r.y + r.h * (cp ? 0.58 : 0.5), bx = xs(KY.band[0]), bw = (xs(KY.band[1]) - bx) * e;
        var klT = ['Kim & Yang (2021), six presidential elections: rough conversion', 'Kim & Yang (2021), six elections: rough conversion', 'Kim & Yang (2021): rough conversion'].filter(function (t) { return tw(t, G.fsA + (cp ? 0 : 0.5), 600) <= G.w - 2 * G.m - 8; })[0] || 'Kim & Yang (2021): rough conversion';
        var kl = N(klT, G.m, r.y + 1, G.w - 2 * G.m, { fs: G.fsA + (cp ? 0 : 0.5), wt: 600, bg: true });
        if (cp) cyb = Math.max(cyb, kl.box.y + kl.box.h + 6 + bh / 2);   // the band and its note sit under the label, never across it
        s += grp(ramp(b, 0, 0.5), kl.svg);
        s += E('rect', { x: r2(bx), y: r2(cyb - bh / 2), width: r2(bw), height: bh, fill: 'url(#ch-hatch)', stroke: C.ink, 'stroke-width': 1.2 });
        s += grp(ramp(b, 0.6, 1), cp ? N('variation: six national price changes', bx - 8, cyb - 8, bx - 8 - G.m, { anchor: 'end', fs: G.fsT, fill: C.muted, bg: true }).svg : N('variation: six national price changes', (bx + xs(KY.band[1])) / 2 - 100, cyb + bh / 2 + 3, 240, { fs: G.fsT + 0.5, fill: C.muted, bg: true }).svg);
        if (wide) s += E('text', { x: G.w - G.m, y: r2(cyb + 4.5), 'text-anchor': 'end', 'font-size': G.fsA, fill: C.ink, opacity: ramp(b, 0.5, 1) }, E('tspan', { 'font-weight': 600 }, 'about ' + KY.band[0] + ' to ' + KY.band[1]));
      } else {
        var pooled = r.k === 'p', col = pooled ? C.accent : C.ink, e2 = ease(b), cy = r.cy;
        if (r.tip && b > 0.5) s += hitRect(r.tip, G.m - 4, r.y + 2, G.w - 2 * G.m + 8, r.h - 4);
        s += RL(r.lab, x0 - 12, cy, lw, { fs: G.fsA, wt: pooled ? 600 : 400, fill: pooled ? C.accent : C.ink }).svg;
        s += IV(xs, cy, r, e2, { col: col, main: pooled, op: Math.min(1, b * 3) });
        if (wide) {
          s += E('text', { x: G.w - G.m, y: r2(cy + 4.5), 'text-anchor': 'end', 'font-size': G.fsA, fill: pooled ? C.accent : C.ink, opacity: ramp(b, 0.5, 1) },
            E('tspan', { 'font-weight': 600 }, sgn(r.est, 2)) + E('tspan', { fill: pooled ? C.accent : C.muted }, '  (' + sgn(r.lo, 2) + ' to ' + sgn(r.hi, 2) + ')'));
        }
      }
      out += s;
    });

    // second stage: the axis arrows and the labels
    var pr = rows[4], cy2 = axY + 4 + G.fsT + 3 + 18, cs = '';
    var aA = rp ? ann(L, 0.25, 0.35) : stg > 0 ? 1 - (L.out || 0) : ann(L, 0.25, 0.37);
    var lwid = Math.max(70, xs(0) - 40 - G.m), rw = Math.max(70, x1 - xs(0) - 40);
    var lN = N('toward the president’s party', xs(0) - 38, cy2 - (cp ? 15 : 9), lwid, { anchor: 'end', fill: C.ink, fs: G.fsT + 0.5 });
    var rN = N('against the president’s party', xs(0) + 38, cy2 - (cp ? 15 : 9), rw, { anchor: 'start', fill: C.ink, fs: G.fsT + 0.5 });
    cs += lN.svg + rN.svg + ARROW({ x: xs(0) - 6, y: cy2 }, { x: xs(0) - 32, y: cy2 }) + ARROW({ x: xs(0) + 6, y: cy2 }, { x: xs(0) + 32, y: cy2 });
    cs += T('no effect', xs(0), gTop - 12, { fs: G.fsT + 0.5, anchor: 'middle', halo: true });
    out += grp(aA, cs);
    out += T('Vote points per extra $10 a month in fuel costs', (x0 + x1) / 2, cy2 + (cp ? 34 : 38), { fs: G.fsT, fill: C.muted, anchor: 'middle' }).replace('<text', '<text opacity="' + r2(Math.max(aA, rp ? 0 : ramp(p, 0, 0.05) * (1 - (L.out || 0)))) + '"');
    if (rp) {
      var aB = ann(L, 0.33, 0.45), aC = ann(L, 0.28, 0.4), zx = xs(Math.min(2.3, xs.domain()[1] - 1.2)), c22 = rows[2];
      out += grp(aC, CALL('Every range includes zero', zx, c22.cy - (cp ? 10 : 22), x1 - zx - 2, { x: xs(c22.hi) + 4, y: c22.cy }, { gap: 3, from: { x: zx - 5, y: c22.cy - (cp ? 2 : 6) } }).svg);
      var bx2 = xs(Math.min(1.7, xs.domain()[1] - 1.7)), pn = pr.cy - (cp ? 4 : 10);
      out += grp(aB, CALL(cp ? 'Average: ' + sgn(pr.est, 1) + ' (range ' + sgn(pr.lo, 1) + ' to ' + sgn(pr.hi, 1) + ')' : 'Average of the four elections: ' + sgn(pr.est, 1) + ' vote points per extra $10 a month (range ' + sgn(pr.lo, 1) + ' to ' + sgn(pr.hi, 1) + ')', bx2, pn, x1 - bx2 - 2,
        { x: xs(pr.hi) + 5, y: pr.cy }, { gap: 3, wt: 600, fill: C.accent, arrowCol: 'accent', from: { x: bx2 - 5, y: pr.cy } }).svg);
    }
    out += rp ? SRC('Source: project estimates, 2018–2024 (state prices).', 'Source: project estimates, 2018–2024.') :
      stg < 2 ? SRC('Source: project estimates (provisional).', 'Source: project estimates.') :   // Kim & Yang joins the source line when its row appears (beat 3)
      SRC('Sources: project estimates (provisional); Kim & Yang (2021), American Politics Research.', 'Sources: project estimates; Kim & Yang (2021).');
    return out;
  }
  /* ================== fluke-intro, fluke-reshuffle: all 24 orderings of four price differences ================== */
  /* v9.3: fluke-intro shows the figure standing still (cards, the small scatter, the empty line the results will go on); fluke-reshuffle is one long beat in which
     the cards swap over five reshuffles, the scatter's slope changes each time and each result drops onto the line, which then fills to all 24 orderings. */
  var NC = 4, NB = 20, NR = 8, TEST = null;   // PI 2026-10-29: eight animated reshuffles (was five), with a taller beat
  var PER10 = 13.7;   // cents a gallon that make $10 a month for a typical household (about 73 gallons a month)
  var METRO = ['Market 1', 'Market 2', 'Market 3', 'Market 4'], METRO_S = METRO;   // v7: one group of four nearby markets; anonymous, because the price differences are simulated
  var CARD = [-5, 10, -2, -3];                    // v8: unusual parts in cents against the group average (fixed from the storyboard)
  var GAP = [0.2, 0.7, 0.4, 0.5];            // v9.3: fixed illustrative vote shifts against the president's party, vs the race (points); on this scale the results fall on the axis of the power figure
  var ACTUAL = [0, 1, 2, 3];                   // the card in each market as the markets stand: the original arrangement
  /* scroll windows of fluke-reshuffle (p; v9.4: a beat of about 260vh, slower than v9.3). The original arrangement's result drops first (p 0-0.035), then five reshuffles
     share p 0.04-0.6 equally; each has three clearly separate steps: the cards and the points of the scatter swap together, the fitted line settles and the result number
     follows, the result dot drops onto the line. Then the line fills (0.6-0.78), its share line comes in, and the button. */
  var SCH = (function () {
    var rs = [], a0 = 0.04, a1 = 0.60, w = (a1 - a0) / NR, i, s0;
    for (i = 0; i < NR; i++) { s0 = a0 + i * w; rs.push({ swap: [s0, s0 + 0.5 * w], rec: [s0 + 0.5 * w, s0 + 0.78 * w], drop: [s0 + 0.78 * w, s0 + w] }); }
    return { d0: [0.004, 0.036], rs: rs };
  })();
  var MP = { fill: [0.60, 0.76], tails: [0.74, 0.78], share: [0.70, 0.76], btn: [0.76, 0.80], done: 0.78 };   // after the reshuffles: the line fills, the share line, the button (the figure fades over the last fifth of the beat, so all of it is in by p 0.8)
  var ANIM_MS = 3000;                              // "Shuffle again": cards 0-0.45, strip 0.45-0.65, dot drop 0.65-1
  function seededRng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function permsOf(a) {
    if (a.length <= 1) return [a];
    var o = [];
    a.forEach(function (x, i) { permsOf(a.filter(function (_, j) { return j !== i; })).forEach(function (q) { o.push([x].concat(q)); }); });
    return o;
  }
  /* the fitted line of vote shift on price difference, for the cards in this order: slope in points per cent, and the intercept */
  function fitOf(perm) {
    var xv = perm.map(function (c) { return CARD[c]; }), mx = d3.mean(xv), my = d3.mean(GAP), sxx = d3.sum(xv, function (x) { return (x - mx) * (x - mx); }), sxy = d3.sum(xv, function (x, i) { return (x - mx) * (GAP[i] - my); });
    var b = sxy / (sxx || 1); return { sl: b, ic: my - b * mx };
  }
  function valueOf(perm) { return fitOf(perm).sl * PER10; }   // the result of the whole analysis: the slope, in points of vote share per extra $10 a month
  function binOf(v) { return clamp(Math.floor((v + 1) / 2 * NB), 0, NB - 1); }
  /* the exact permutation distribution: all 24 orderings of the four price differences over the four markets */
  function testSetup() {
    if (TEST) return TEST;
    var P = permsOf([0, 1, 2, 3]), vals = P.map(valueOf), actual = valueOf(ACTUAL), ai = P.findIndex(function (q) { return q.join() === ACTUAL.join(); });
    function look(i) { return P[i].map(function (c) { return CARD[c]; }).join(); }   // what the cards show: equal cards swapped look identical
    function nearest(t, skip) {
      var best = -1, seen = skip.map(look);
      vals.forEach(function (v, i) { if (seen.indexOf(look(i)) < 0 && (best < 0 || Math.abs(v - t) < Math.abs(vals[best] - t))) best = i; });
      return best;
    }
    var taken = [ai], rsel = [0.08, -0.22, 0.24, -0.06, 0.15, -0.13, 0.03, -0.18].map(function (t) { var j = nearest(t, taken); taken.push(j); return j; });
    var rest = d3.shuffler(seededRng(11))(d3.range(P.length).filter(function (i) { return taken.indexOf(i) < 0; }));
    var land = taken.concat(rest), cnt = new Array(NB).fill(0);
    var pos = land.map(function (i) { var b = binOf(vals[i]); return { i: i, v: vals[i], b: b, k: cnt[b]++ }; });
    var nTail = vals.filter(function (v) { return Math.abs(v) >= Math.abs(actual) - 1e-9; }).length;
    TEST = { P: P, vals: vals, actual: actual, ai: ai, pos: pos, cnt: cnt, nTail: nTail, perms: [ACTUAL].concat(rsel.map(function (j) { return P[j]; })), vs: [actual].concat(rsel.map(function (j) { return vals[j]; })) };
    return TEST;
  }
  /* the five cards, each moving from its slot in permA to its slot in permB. v7.2 [6.1]: the moving cards first drop into their own lanes below the row,
     travel sideways only while they are apart, and rise back into place; the price tags are drawn after all cards, so no tag is hidden mid-shuffle */
  function drawCards(permA, permB, e, x0, cardsY, cw, gap, chh, cp, laneH, dir) {
    var movers = [], lane = {}, u = clamp(e, 0, 1), q = ease(ramp(u, 0.15, 0.85)), dip = smooth(0, 0.2, u) * (1 - smooth(0.8, 1, u)), s = '', tags = '', order = [];
    for (var ci = 0; ci < NC; ci++) { var d = Math.abs(permB.indexOf(ci) - permA.indexOf(ci)); if (d) movers.push({ ci: ci, d: d }); }
    movers.sort(function (a, b) { return b.d - a.d || a.ci - b.ci; });
    movers.forEach(function (m, i) { lane[m.ci] = i + 1; });
    for (var c2 = 0; c2 < NC; c2++) order.push(c2);
    order.sort(function (a, b) { return (lane[b] || 0) - (lane[a] || 0); });
    var unit = movers.length ? Math.min(chh * 0.62, laneH / movers.length) : 0;
    order.forEach(function (c) {
      var pa = permA.indexOf(c), pb = permB.indexOf(c), pos = lerp(pa, pb, q), lift = (dir || 1) * (lane[c] || 0) * unit * dip;
      var cx = x0 + pos * (cw + gap), cyy = cardsY + lift, sh = CARD[c];
      s += E('rect', { x: r2(cx), y: r2(cyy), width: r2(cw), height: chh, rx: 2, fill: C.bg, stroke: C.bg, 'stroke-width': 5, 'stroke-linejoin': 'round' });   // a background-coloured halo: where cards pass over each other, the border underneath is cut, so edges never look doubled
      s += E('rect', { x: r2(cx), y: r2(cyy), width: r2(cw), height: chh, rx: 2, fill: C.bg, stroke: C.ink, 'stroke-width': 1 });
      s += E('rect', { x: r2(cx), y: r2(cyy), width: r2(cw), height: 3, fill: sh >= 0 ? C.price : C.priceLow });   // price differences: violet above the group average, slate below (SPEC §3)
      tags += T((sh === 0 ? '' : sh > 0 ? '+' : MINUS) + Math.abs(sh) + '¢', cx + cw / 2, cyy + chh / 2 + 5, { fs: cp ? 13 : 15.5, anchor: 'middle', wt: 600, halo: true });
    });
    return s + tags;
  }
  /* where the cards and the analysis strip stand at scroll position p of fluke-reshuffle */
  function orderAt(Tt, p) {
    var rs = SCH.rs, k = -1, i;
    for (i = 0; i < rs.length; i++) if (p >= rs[i].swap[0]) k = i;
    var o = { k: k, A: Tt.perms[Math.max(k, 0)], B: Tt.perms[k < 0 ? 0 : k + 1], es: 0, er: 1, drop: null, landed: 0 };
    if (k >= 0) { o.es = ramp(p, rs[k].swap[0], rs[k].swap[1]); o.er = ramp(p, rs[k].rec[0], rs[k].rec[1]); }
    var dw = [SCH.d0].concat(rs.map(function (r) { return r.drop; }));
    dw.forEach(function (w, i) { if (p >= w[1]) o.landed = i + 1; else if (p > w[0] && !o.drop) o.drop = { idx: i, f: ramp(p, w[0], w[1]) }; });
    return o;
  }
  var TEST_AXT = 'Result of the analysis, b (points per extra $10 a month)';
  var TEST_LBL = 'the unusual part of each market’s rise';
  function testTitle() { if (G.phone) return 'Reshuffling rises'; return !G.compact ? 'Reshuffling the unusual parts of the rises in one group' : G.h < 330 ? 'Reshuffling price rises' : 'Reshuffling the rises in one group'; }   // the label above the cards spells out which part is reshuffled
  /* the layout of the reshuffle figure. drawPrec asks for the line's axis (hx0, hx1, histBot), so that the power figure stands on the same axis.
     v9.4: no subtitle; one label above the cards; under each card its market and vote shift; the cards swap in lanes above the row (they travel up into the room under the title). */
  function testLayout(tt, more) {
    var Tt = testSetup(), cp = G.compact, L = {};
    L.rowW = cp ? G.w - 2 * G.m : Math.min(G.w - 2 * G.m, 900); L.gap = cp ? 5 : 10; L.cw = (L.rowW - L.gap * (NC - 1)) / NC; L.chh = cp ? (G.h < 330 ? 24 : 28) : 44; L.x0 = G.m; L.fsS = G.fsT;
    L.hx0 = G.m + (cp ? 12 : 28); L.hx1 = G.w - G.m - (cp ? 10 : 28); L.hw = L.hx1 - L.hx0; L.bwp = L.hw / NB;
    L.tight = cp && G.h < 330;   // a phone held short (375x667): no share line, and a low line, so that everything stays inside the panel
    L.lblFs = L.fsS + 0.5; L.laneUp = L.tight ? 4 : cp ? 14 : 40;   // the room above the label, into which the swapping cards rise
    L.lblY = tt.bottom + L.laneUp + L.lblFs; L.cardsY = L.lblY + 7; L.laneRoom = L.cardsY - tt.bottom - 6;
    L.nameY = L.cardsY + L.chh + L.fsS + (cp ? 4 : 6); L.gapY = L.nameY + L.fsS + 3;
    L.stripH = L.tight ? 32 : cp ? 40 : 92; L.stripY = L.gapY + (L.tight ? 10 : cp ? 14 : 24); L.histTop = L.stripY + L.stripH + (L.tight ? 6 : cp ? 26 : 32);
    // bottom: what sits under the line (the same space in both beats, so the picture does not jump)
    L.btnH = cp ? 32 : 36;
    
    L.axT = L.tight ? 'Result, b (points per extra $10 a month)' : TEST_AXT; L.axTitle = N(L.axT, L.hx0, 0, L.hw, { fs: L.fsS, halo: false });
    var below = 4 + L.fsS + 3 + 8 + L.axTitle.box.h + 10 + (cp ? 0 : L.btnH + 8);   // on a phone the button sits in the analysis strip, between the result and the small scatter
    var yb = G.h - (cp ? 8 : G.m), histH = clamp(yb - below - L.histTop, cp ? (L.tight ? 26 : 48) : 90, 340), maxC = d3.max(Tt.cnt);
    L.dr = Math.min(cp ? 4.2 : clamp(L.hw / 124, 6, 8.5), L.bwp / 2 - 0.7, (histH - 12) / ((maxC + 3) * 2 + 1));
    histH = Math.min(histH, (maxC + 3) * (2 * L.dr + 1) + 12);
    L.histH = histH; L.histBot = L.histTop + histH;
    L.axY = L.histBot + 4 + L.fsS + 3 + 8; L.btnY = L.axY + L.axTitle.box.h + 10;
    L.btnY = cp ? L.stripY + (L.stripH - L.btnH) / 2 : Math.min(L.btnY, yb - L.btnH);
    if (G.phone) {
      L.lblFs = 14; L.fsS = 13; L.chh = 24;
      L.lblY = tt.bottom + 14; L.cardsY = L.lblY + 7; L.laneRoom = 12;
      L.nameY = L.cardsY + L.chh + 16; L.gapY = L.nameY + 17;
      L.stripY = L.gapY + 14; L.stripH = 36; L.btnH = 28;
      L.axT = 'Points per extra $10 a month';
      L.histBot = G.h - 48; L.axY = L.histBot + 27;
      L.histTop = L.stripY + L.stripH + 16;
      // Short panels omit redundant card/status captions before sacrificing the result axis.
      L.mini = L.histBot - L.histTop < 56;
      if (L.mini) {
        L.cardsY = tt.bottom + (window.innerHeight > window.innerWidth && G.hh >= 280 ? 19 : -4); L.chh = 20;
        L.nameY = L.cardsY + L.chh + 13; L.gapY = L.nameY;
        L.stripY = L.nameY + 6; L.stripH = 36; L.btnH = 26;
        L.histTop = L.stripY + L.stripH + 4;
        L.histBot = G.h - 44;
      }
      L.showAxisTitle = true;
      L.axY = L.histBot + 27;
      // Give the regression the spare height; the small pile of results needs only its stack height.
      var dotR = L.mini ? 3 : 4, stackN = maxC + (more ? 1 : 0), stackH = stackN * (2 * dotR + 1) + 4, grow = clamp(L.histBot - L.histTop - stackH, 0, 74);
      L.stripH += grow; L.histTop += grow;
      L.histH = Math.max(8, L.histBot - L.histTop);
      L.dr = Math.min(dotR, L.bwp / 2 - 1, (L.histH - 2 - stackN) / (stackN * 2));
      L.btnY = L.stripY + (L.mini ? 31 : 8);
    }
    return L;
  }
  function drawTest(L) {
    // fluke-estimate (PI 2026-10-29): the finished picture of fluke-reshuffle holds, and a teal dot, my estimate, lands far out on the right
    var est = L.beat === 'fluke-estimate', pe = L.p;
    var Tt = testSetup(), intro = L.beat === 'fluke-intro', cp = G.compact, out = '', o_ = 1 - (L.out || 0), NALL = Tt.pos.length, pp = intro ? 0 : est ? 0.8 : L.p, p = est ? 0.8 : L.p;
    var tt = title(testTitle(), 'Illustrative', (window.innerWidth || 1024) < 600 ? 100 : 168);
    out += tt.svg;
    var Y = testLayout(tt, !intro && (est || p >= MP.done) && (extras.length || anim)), x0 = Y.x0, rowW = Y.rowW, gap = Y.gap, cw = Y.cw, chh = Y.chh, fsS = Y.fsS, bwp = Y.bwp, dr = Y.dr, hx0 = Y.hx0;
    var aCards = 1, aStrip = 1, aLink = 1, aAxis = 1;   // v9.4: fluke-intro stands still, with everything on it (the layer itself fades in with t, so nothing fades again with p)
    // under the cards: the markets with their fixed vote shifts (the label above the cards is drawn once the swap is known)
    var nm = '', fsV = cp ? 12 : fsS, shLab = tw('vote shift +0.2', fsV) <= cw - 4 ? 'vote shift ' : 'shift ';
    for (var s = 0; s < NC; s++) {
      var sx = x0 + s * (cw + gap);
      nm += T(G.phone && Y.mini ? 'M' + (s + 1) + ' vote ' + sgnPlus(GAP[s], 1) : METRO[s], sx + cw / 2, Y.nameY, { fs: G.phone && Y.mini ? 12 : fsS, fill: C.ink, anchor: 'middle', wt: 600 });
      if (!G.phone || !Y.mini) nm += T(shLab + sgnPlus(GAP[s], 1), sx + cw / 2, Y.gapY, { fs: fsV, fill: C.muted, anchor: 'middle' });
    }
    out += grp(aCards * (G.phone ? o_ : 1), nm);

    // the ordering on show: scroll-linked in fluke-reshuffle; the original arrangement standing still in fluke-intro; the visitor's own after the button
    var dl = orderAt(Tt, pp), done = !intro && p >= MP.done, extraDrop = null, restPerm = extras.length ? extras[extras.length - 1].perm : Tt.perms[NR], restV = extras.length ? extras[extras.length - 1].v : Tt.vs[NR];
    var permA = dl.A, permB = dl.B, es = dl.es, er = dl.er, vShow, who, whoAlt = null;
    if (!intro && p >= MP.fill[0]) {
      if (done && anim) {
        var u = Math.min(1, (performance.now() - anim.t0) / ANIM_MS);
        permA = anim.from; permB = anim.to; es = ramp(u, 0, 0.45); er = ramp(u, 0.45, 0.65); extraDrop = { v: anim.v, f: ramp(u, 0.65, 1) };
        who = 'Your shuffle';
      } else { permA = permB = restPerm; es = 0; er = 1; who = extras.length ? 'Your shuffle' : 'Reshuffle ' + NR; if (!extras.length) whoAlt = 'Latest reshuffle'; }   // once the line fills, "Reshuffle 5" would read as one of five: it becomes the latest of many
      vShow = anim && done ? lerp(valueOf(permA), anim.v, ease(er)) : restV;
    } else {
      vShow = lerp(valueOf(permA), valueOf(permB), ease(er));
      who = es <= 0.001 ? (dl.k <= 0 ? 'Original arrangement' : 'Reshuffle ' + dl.k) : 'Reshuffle ' + (dl.k + 1);
    }
    var swapping = es > 0.001 && es < 0.999, rerun = es >= 0.999 && er < 0.999;
    var rd = swapping ? (cp ? 'Reshuffling…' : 'Reshuffling the unusual parts of the rises…') : rerun ? 'Rerunning the analysis…' : who;
    if (G.phone && rerun) rd = 'Rerunning…';
    var lblA = 1 - smooth(0, 0.2, es) * (1 - smooth(0.8, 1, es));   // the label above the cards gives way while they rise into its place
    out += grp(G.phone && Y.mini && !(window.innerHeight > window.innerWidth && G.hh >= 280) ? 0 : lblA * o_, T(TEST_LBL, x0, Y.lblY, { fs: Y.lblFs, fill: C.muted }));
    var settled = !swapping && !rerun;
    // the cards
    var cardQ = G.phone ? (es < 0.5 ? 0 : 1) : es;
    var cardsSvg = drawCards(permA, permB, cardQ, x0, Y.cardsY, cw, gap, chh, cp, Y.laneRoom, -1);
    // the dashed slots show only where no card stands (a card on its slot would leave a second, parallel border)
    var qs = ease(clamp(es, 0, 1)), slotSvg = '';
    for (var sl_ = 0; sl_ < NC; sl_++) {
      var dmin = 9;
      for (var cc_ = 0; cc_ < NC; cc_++) dmin = Math.min(dmin, Math.abs(lerp(permA.indexOf(cc_), permB.indexOf(cc_), qs) - sl_));
      slotSvg += grp(clamp(dmin * 1.6, 0, 1), E('rect', { x: r2(x0 + sl_ * (cw + gap)), y: r2(Y.cardsY), width: r2(cw), height: chh, rx: 2, fill: 'none', stroke: C.faint, 'stroke-width': 1, 'stroke-dasharray': '3 3' }));
    }
    cardsSvg = (G.phone ? '' : slotSvg) + cardsSvg;

    // the analysis strip: the analysis on the ordering on show, as a small scatter of vote shift against the unusual part of the rise, and the result it gives
    var stripY = Y.stripY, stripH = Y.stripH, st = '';
    var scW = G.phone ? Math.min(Y.mini ? 160 : 126, rowW * (Y.mini ? 0.44 : 0.34)) : cp ? 108 : Math.min(300, rowW * 0.42), scX = cp ? x0 + rowW - scW : x0 + Math.min(360, rowW - scW);
    if (!G.phone || !Y.mini) st += E('line', { x1: r2(x0), y1: r2(stripY - 6), x2: r2(x0 + rowW), y2: r2(stripY - 6), stroke: C.rule, 'stroke-width': 1 });
    var rdT = function (t) { return T(t, x0, stripY + (cp ? 11 : 15), { fs: G.fsA, wt: 600, fill: settled ? C.accent : C.muted }); }, wf = whoAlt ? ease(ramp(p, MP.fill[0], MP.fill[0] + 0.08)) : 0;
    var rdTxt = whoAlt && rd === who ? grp(1 - wf, rdT(who)) + grp(wf, rdT(whoAlt)) : rdT(rd);
    var numTxt = (vShow < 0 ? MINUS : '+') + Math.abs(vShow).toFixed(2), numFs = cp ? 17 : 28, numLab = cp ? 'Result: ' + numTxt : numTxt, numY = stripY + (G.phone && Y.mini ? 19 : cp ? 32 : 70);
    if (G.phone && Y.mini) rdTxt = '';
    if (cp) st += rdTxt + T(numLab, x0, numY, { fs: numFs, wt: 700, fill: settled ? C.accent : C.muted });
    else st += rdTxt + T('Result of the analysis', x0, stripY + 38, { fs: fsS + 0.5, fill: C.muted }) + T(numLab, x0, numY, { fs: numFs, wt: 700, fill: settled ? C.accent : C.muted });
    // the small scatter
    var pl = scX + (cp ? 12 : 14), pr = scX + scW - 6, pt = stripY + (cp ? 2 : 16), pb = stripY + stripH - (cp ? 5 : 22), cmin = d3.min(CARD) - 2, cmax = d3.max(CARD) + 2, YMIN = G.phone ? d3.min(GAP) - 0.1 : 0, YMAX = G.phone ? d3.max(GAP) + 0.1 : 0.9;
    if (G.phone) pb = Y.histTop - 6;
    var sxs = d3.scaleLinear().domain([cmin, cmax]).range([pl, pr]), sys = d3.scaleLinear().domain([YMIN, YMAX]).range([pb, pt]), pts = [];
    for (var m = 0; m < NC; m++) pts.push([lerp(CARD[permA[m]], CARD[permB[m]], ease(G.phone ? cardQ : es)), GAP[m]]);   // the points move with the cards
    var fA = fitOf(permA), fB = fitOf(permB), sl = lerp(fA.sl, fB.sl, ease(er)), ic = lerp(fA.ic, fB.ic, ease(er));   // the line settles after they have moved
    st += LN(pl, pt, pl, pb, { stroke: C.faint }) + LN(pl, pb, pr, pb, { stroke: C.faint });
    var fa = cmin, fb = cmax;
    if (Math.abs(sl) > 1e-6) { var f1 = (YMIN - ic) / sl, f2 = (YMAX - ic) / sl; fa = Math.max(cmin, Math.min(f1, f2)); fb = Math.min(cmax, Math.max(f1, f2)); }
    var lx0 = sxs(fa), ly0 = sys(ic + sl * fa);
    if (fb > fa) st += LN(lx0, ly0, sxs(fb), sys(ic + sl * fb), { stroke: C.accent, 'stroke-width': 2 });
    // v9.5 (DESIGN.md §Marks): outlined dots
    pts.forEach(function (q) { st += E('circle', { cx: r2(sxs(q[0])), cy: r2(sys(q[1])), r: cp ? 3.4 : 4.6, fill: mix(C.ink, C.bg, 0.8), stroke: C.ink, 'stroke-width': 1.1 }); });
    if (!cp) st += T('unusual part of the rise', (pl + pr) / 2, stripY + stripH - 3, { fs: fsS, fill: C.muted, anchor: 'middle' });
    if (!cp) st += T('vote shift', pl, pt - 6, { fs: fsS, fill: C.muted });
    out += grp(aStrip * o_, st);
    // the link: the result is the slope of the line in the small scatter
    var nx1 = x0 + tw(numLab, numFs, 700) + (cp ? 10 : 12), ny = numY - (cp ? 5 : 10), lk = '';
    var lkTxt = cp ? 'slope = result' : 'the slope of this line is the result';
    if (!G.phone && lx0 - 8 - nx1 > 30) {
      var ay = clamp(ly0, pt + 2, pb - 2), midX = (nx1 + lx0 - 8) / 2;
      lk += ARROW({ x: nx1, y: ny }, { x: lx0 - 8, y: ay }, { col: 'accent' });
      lk += T(lkTxt, midX, cp ? Math.min(ny, ay) - 6 : Math.max(ny, ay) + 17, { fs: cp ? 12.5 : G.fsT + 0.5, wt: 600, fill: C.accent, anchor: 'middle', halo: true });
    }
    out += grp(aLink * aStrip * o_ * (cp && !intro ? 1 - ramp(p, MP.btn[0], MP.btn[1]) : 1), lk);   // on a phone the button takes the link's place

    // the line the results fall on: one dot for each of the 24 orderings, on the same axis as the power figure
    var xs = d3.scaleLinear().domain([-1, 1]).range([hx0, Y.hx1]), histBot = Y.histBot, histTop = Y.histTop;
    var ax = axisBottom(xs, histBot, [-1, -0.5, 0, 0.5, 1], function (v) { return v === 0 ? '0' : v < 0 ? MINUS + Math.abs(v) : '+' + v; });
    ax += LN(xs(0), histTop - 4, xs(0), histBot, { stroke: C.faint, 'stroke-width': 1, 'stroke-dasharray': '4 3' }) + (G.phone ? '' : Y.tight ? T('no link', xs(0) + 4, histTop + fsS - 1, { fs: fsS - 1, fill: C.muted }) : T('no link', xs(0), histTop - 9, { fs: fsS, fill: C.muted, anchor: 'middle' }));   // the light zero line: no link between the unusual part of the rise and the vote shift
    if (!G.phone || Y.showAxisTitle) ax += N(Y.axT, hx0, Y.axY, Y.hw, { fs: fsS, halo: false }).svg;
    out += grp(aAxis * o_, ax);
    var fill = intro ? 0 : ease(ramp(p, MP.fill[0], MP.fill[1])), nShow = intro ? 0 : p >= MP.fill[0] ? NR + 1 + Math.round((NALL - NR - 1) * fill) : dl.landed;
    var dots = '';
    for (var k = 0; k < nShow; k++) {
      var q = Tt.pos[k], cxk = hx0 + (q.b + 0.5) * bwp, cyk = histBot - dr - 1 - q.k * (2 * dr + 1);
      // v9.5 (DESIGN.md §Marks): outlined dots
      var latest = G.phone && Math.abs(q.v - vShow) < 1e-6;
      dots += E('circle', { cx: r2(cxk), cy: r2(cyk), r: r2(dr), fill: latest ? C.accent : mix(C.muted, C.bg, 0.8), stroke: latest ? C.accent : C.muted, 'stroke-width': latest ? 1.8 : 1 });
    }
    out += grp(o_, dots);
    if (G.phone && intro) out += E('circle', { cx: r2(xs(vShow)), cy: r2(histBot - 5), r: 4, fill: C.accent, stroke: C.bg, 'stroke-width': 1.5 });
    // the dropping dot: it leaves the strip, falls into its bin and carries its result
    var dsx = x0 + (cp ? 56 : 86), dsy = stripY + (cp ? 34 : 76);
    function dropDot(v, f, stk, labelTxt) {
      var b = binOf(v), tx = hx0 + (b + 0.5) * bwp, ty = histBot - dr - 1 - stk * (2 * dr + 1), g = f * f;
      var fx = G.phone ? tx : dsx, fy = G.phone ? histTop + dr + 1 : dsy, cx = lerp(fx, tx, ease(f)), cy = lerp(fy, ty, g);
      var lab = (labelTxt || '') + ': ' + sgnPlus(v, 2), lw = tw(lab, G.fsA, 600), right = cx + dr + 7 + lw < Y.hx1 + 4;
      return E('line', { x1: r2(cx), y1: r2(fy), x2: r2(cx), y2: r2(cy), stroke: C.accent, 'stroke-width': 1, 'stroke-dasharray': '2 3', opacity: 0.55 }) +
        E('circle', { cx: r2(cx), cy: r2(cy), r: r2(dr), fill: mix(C.accent, C.bg, 0.8), stroke: C.accent, 'stroke-width': 1.1 }) +
        (!G.phone && labelTxt ? grp(ramp(f, 0.08, 0.3), T(lab, right ? cx + dr + 6 : cx - dr - 6, cy + 4.5, { fs: G.fsA, wt: 600, fill: C.accent, anchor: right ? 'start' : 'end', halo: true })) : '');
    }
    if (!intro && p < MP.fill[0] && dl.drop && dl.drop.f > 0 && dl.drop.f < 1) { var pk = Tt.pos[dl.drop.idx]; out += grp(o_, dropDot(pk.v, dl.drop.f, pk.k, dl.drop.idx > 0 ? 'reshuffle ' + dl.drop.idx : null)); }
    // the visitor's own shuffles: hollow dots stacked on the pile
    var ex = done ? extras : [];
    if (G.phone && ex.length) {
      // Keep the exact 24 orderings; show the most recent extra shuffles that fit above each bin.
      var slots = Math.floor((Y.histH - 2) / (2 * dr + 1)), used = Tt.cnt.slice();
      if (extraDrop) used[binOf(extraDrop.v)]++;
      ex = ex.slice().reverse().filter(function (x) { var b = binOf(x.v); return used[b] < slots && ++used[b]; }).reverse();
    }
    if (ex.length || extraDrop) {
      var st2 = Tt.cnt.slice(), xs_ = '';
      ex.forEach(function (x) { var b2 = binOf(x.v); xs_ += E('circle', { cx: r2(hx0 + (b2 + 0.5) * bwp), cy: r2(histBot - dr - 1 - st2[b2]++ * (2 * dr + 1)), r: r2(dr - 0.8), fill: C.bg, stroke: C.accent, 'stroke-width': 1.8 }); });
      if (extraDrop && extraDrop.f > 0 && extraDrop.f < 1) xs_ += dropDot(extraDrop.v, extraDrop.f, st2[binOf(extraDrop.v)], 'your shuffle');
      out += xs_;
    }
    if (est) {
      var ea = ramp(pe, 0.08, 0.22), ev = 0.8, exs = xs(ev), eys = histBot - dr - 1, er = dr + 2;
      if (ea > 0.004) out += grp(ea * o_, E('circle', { cx: r2(exs), cy: r2(eys), r: r2(er), fill: mix(C.accent, C.bg, 0.8), stroke: C.accent, 'stroke-width': 1.25 }) +
        T('my estimate', exs, eys - er - 8, { fs: G.fsA + 1, wt: 700, fill: C.accent, anchor: 'middle', halo: true }));
    }
    out += grp(aCards * o_, cardsSvg);
    var ba = intro ? 0 : ramp(p, MP.btn[0], MP.btn[1]) * o_;
    btnSt = { x: G.phone ? G.m + (Y.mini ? 0 : 114) : cp ? G.m + 120 : G.m, y: Y.btnY - 4, h: Y.btnH + 8, a: ba, enabled: done && !anim && ba > 0.95, fs: G.phone ? 11 : cp ? 13 : 14, narrow: G.phone };
    out += SRC('Illustrative: simulated prices.');
    return out;
  }
  function shuffleAgain(force) {
    if (anim || !TEST || (force !== true && (!btnSt || !btnSt.enabled))) return;
    var Tt = TEST, from = extras.length ? extras[extras.length - 1].perm : Tt.perms[2], to, tries = 0;
    do { to = Tt.P[Math.floor(Math.random() * Tt.P.length)]; } while (to.map(function (c) { return CARD[c]; }).join() === from.map(function (c) { return CARD[c]; }).join() && ++tries < 50);
    var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var v = valueOf(to);
    if (rm) { extras.push({ perm: to, v: v }); if (extras.length > 40) extras.shift(); rev++; repaint(); textStatus(v); return; }
    anim = { from: from, to: to, v: v, t0: performance.now() };
    (function tick() {
      if (!anim) return;
      var u = (performance.now() - anim.t0) / ANIM_MS;
      if (u >= 1) { extras.push({ perm: anim.to, v: anim.v }); if (extras.length > 40) extras.shift(); textStatus(anim.v); anim = null; rev++; repaint(); return; }
      repaint(true); requestAnimationFrame(tick);
    })();
  }

  /* ================== power: simulated precision on the axis of the reshuffled results ================== */
  /* v9.3: the three power beats are one figure on the axis of the reshuffle line (same left and right ends, same ticks, same height where the panel allows).
     power-detect: the grey distribution of reshuffled results, then the second one at 0.37 (shaded: the part that falls outside the grey one, "4 in 5").
     power-rule-out: the grey distribution stays and the second fades; a bracket from -0.21 to +0.21 above it, and the zones beyond it hatched. */
  function drawPrecPhone(L) {
    var stage = L.beat === 'power-rule-out' ? 1 : 0;
    if (L.to === 'power-rule-out' && L.m > 0.5) stage = 1;
    var tt = title('Simulated estimates', ''), out = tt.svg;
    var x0 = G.m + 12, x1 = G.w - G.m - 12, xs = d3.scaleLinear().domain([-1, 1]).range([x0, x1]);
    var top = tt.bottom + (stage ? 18 : G.hh < 280 ? 28 : 34), ay = G.h - 44, peak = Math.max(12, (ay - top) * 0.90);
    function curve(mu, lo, hi, fill, stroke) {
      var d = 'M' + xs(lo) + ',' + ay;
      for (var i = 0; i <= 80; i++) { var v = lerp(lo, hi, i / 80); d += ' L' + r2(xs(v)) + ',' + r2(ay - peak * Math.exp(-0.5 * Math.pow((v - mu) / PREC.sd, 2))); }
      return E('path', { d: d + ' L' + xs(hi) + ',' + ay + 'Z', fill: fill, stroke: stroke, 'stroke-width': 1.5 });
    }
    if (stage) {
      [[-1, -PREC.ruleOut], [PREC.ruleOut, 1]].forEach(function (z) {
        out += E('rect', { x: xs(z[0]), y: top, width: xs(z[1]) - xs(z[0]), height: Math.max(1, ay - top), fill: 'url(#ch-rule-hatch)' });
        out += T('Ruled out ' + (z[0] === -1 ? '<' : '>') + sgnPlus(z[0] === -1 ? z[1] : z[0], 2), xs(z[0] === -1 ? z[1] : z[0]), top - 10, { fs: 11, wt: 600, anchor: z[0] === -1 ? 'end' : 'start' });
      });
    }
    [-1, -0.5, 0, 0.5, 1].forEach(function (v) { out += LN(xs(v), top, xs(v), ay, { stroke: v ? C.rule : C.ink, 'stroke-dasharray': v ? null : '4 3' }); });
    out += curve(0, -1, 1, C.rule, C.muted);
    if (!stage) {
      var a = ramp(L.p, 0.24, 0.30);
      out += grp(a, curve(PREC.detect, -1, 1, C.accentSoft, C.accent) + curve(PREC.detect, PREC.detect - 0.841621 * PREC.sd, 1, C.accent, null));
      out += T('No effect', xs(-0.24), top - 20, { fs: 11, wt: 600, fill: C.muted, anchor: 'end' });
      out += grp(a, T('Effect ' + sgnPlus(PREC.detect, 2), xs(PREC.detect), top - 20, { fs: 11, wt: 600, fill: C.accent, anchor: 'middle' }) +
        T('4 in 5', xs(PREC.detect + 0.32), top - 3, { fs: 11, wt: 700, fill: C.accent, anchor: 'middle' }) +
        LN(xs(PREC.detect + 0.32), top + 4, xs(PREC.detect + 0.12), ay - peak * 0.38, { stroke: C.accent }));
    }
    out += axisBottom(xs, ay, [-1, -0.5, 0, 0.5, 1], function (v) { return v ? sgnPlus(v, v % 1 ? 1 : 0) : '0'; });
    out += T('Points per extra $10 a month', (x0 + x1) / 2, ay + 33, { fs: 13, fill: C.muted, anchor: 'middle' });
    out += SRC('Project simulations (AAA, October 13–November 2).');
    return out;
  }
  function drawPrec(L) {
    if (G.phone) return drawPrecPhone(L);
    var cp = G.compact, stage = L.beat === 'power-rule-out' ? 1 : 0, p = L.p, o_ = 1 - (L.out || 0), out = '';
    var pr = stage === 1 ? p : 1, held = stage >= 1;
    var morph = stage === 0 && L.to === 'power-rule-out' ? L.m : held ? 1 : 0;
    var tight = cp && G.h < 330;
    var tt = title(tight ? 'Simulated estimates' : 'Simulated estimates per extra $10 a month', '');
    out += tt.svg;
    var x0 = G.m + (cp ? 12 : 28), x1 = G.w - G.m - (cp ? 10 : 28);
    var xs = d3.scaleLinear().domain([-1, 1]).range([x0, x1]);
    var axY0 = testLayout(title(testTitle(), 'Illustrative')).histBot;   // the line of the reshuffle figure: the same axis, the same height where the panel allows
    var cloudTop = tt.bottom + (tight ? 34 : cp ? 54 : 80), axFull = cp ? cloudTop + (tight ? 40 : 52) : clamp(axY0, tt.bottom + 200, Math.max(tt.bottom + 200, G.h - 150));   // on a phone the figure is a low strip in all three beats (the panel is about 400px tall)
    var axY = axFull;
    var cloudH = Math.max(40, axY - cloudTop - 24);
    var sd = PREC.sd, peak = cp ? Math.min(tight ? 34 : 40, Math.max(12, (axY - cloudTop - 4) * 0.83)) : Math.min(cloudH * 0.83, 230), crit = PREC.detect - 0.841621 * sd;
    function density(mu, lo, hi, fill, stroke) {
      var n = 80, pts = [], i, xx, yy, d = '';
      for (i = 0; i <= n; i++) {
        xx = lo + (hi - lo) * i / n;
        yy = axY - peak * Math.exp(-0.5 * Math.pow((xx - mu) / sd, 2));
        pts.push([xs(xx), yy]);
      }
      d = 'M' + r2(pts[0][0]) + ',' + r2(axY);
      pts.forEach(function (q) { d += ' L' + r2(q[0]) + ',' + r2(q[1]); });
      d += ' L' + r2(pts[n][0]) + ',' + r2(axY) + 'Z';
      return E('path', { d: d, fill: fill, stroke: stroke, 'stroke-width': stroke ? 1.5 : null });
    }
    var ticks = [-1, -0.5, 0, 0.5, 1], grid = '';
    ticks.forEach(function (v) {
      grid += LN(xs(v), cloudTop - 4, xs(v), axY, { stroke: v === 0 ? C.ink : C.rule, 'stroke-width': v === 0 ? 1.2 : 1, 'stroke-dasharray': v === 0 ? '4 3' : null });
    });
    grid += axisBottom(xs, axY, ticks, function (v) { return v === 0 ? '0' : sgnPlus(v, Math.abs(v - Math.round(v)) > 0.01 ? 1 : 0); });
    grid += N('Points per extra $10 a month of fuel costs', (x0 + x1) / 2, axY + 23, x1 - x0, { anchor: 'middle', fs: G.fsT, fill: C.muted, halo: false }).svg;
    out += grp(held ? 1 : ramp(p, 0.03, 0.10), grid);
    if (held) {
      var ba = ramp(pr, 0.05, 0.25), zoneY = cloudTop - 4, zoneH = axY - zoneY;
      var zones = [[x0, xs(-PREC.ruleOut)], [xs(PREC.ruleOut), x1]].map(function (z) {
        return E('rect', { x: r2(z[0]), y: r2(zoneY), width: r2(z[1] - z[0]), height: r2(zoneH), fill: C.rule, opacity: 0.2 }) +
          E('rect', { x: r2(z[0]), y: r2(zoneY), width: r2(z[1] - z[0]), height: r2(zoneH), fill: 'url(#ch-rule-hatch)' });
      }).join('');
      out += grp(ba, zones);
    }
    out += grp(held ? 1 : ramp(p, 0.05, 0.25), density(0, -1, 1, C.rule, C.muted));
    var accentA = (held ? 0 : ramp(p, 0.25, 0.45)) * (1 - morph);
    var slide = window.ENGINE && window.ENGINE.reducedMotion ? 0 : -18 * (1 - ramp(p, 0.25, 0.45));
    out += grp(accentA, density(PREC.detect, -1, 1, C.accentSoft, C.accent), { transform: 'translate(' + r2(slide) + ',0)' });
    out += grp(accentA * 0.8, density(PREC.detect, crit, 1, C.accent, null), { transform: 'translate(' + r2(slide) + ',0)' });
    out += grp(accentA, LN(xs(crit), axY - peak - 8, xs(crit), axY, { stroke: C.accent, 'stroke-width': 1.4, 'stroke-dasharray': '3 3' }), { transform: 'translate(' + r2(slide) + ',0)' });
    out += grp((held ? 0 : ann(L, 0.25, 0.36)) * (1 - morph), N('4 in 5', xs(PREC.detect), axY - peak - 8 - Math.round(G.fsA * 1.33), 70, { anchor: 'middle', fs: G.fsA, wt: 700, fill: C.accent, halo: true }).svg);
    if (held) {
      // the bracket sits above the plot, over the zones, so that its label has room on a phone as well
      var yb = cloudTop - 14, lab = tight ? 'effects beyond this are ruled out' : 'if the estimate lands at zero, effects beyond this are ruled out', bw = Math.min(G.w - 2 * G.m - 20, cp ? 340 : 340);
      var ln_ = N(lab, 0, 0, bw, { fs: G.fsA, wt: 600, halo: false, noClamp: true }), zx_ = xs(0);
      var brk = E('path', { d: 'M' + r2(xs(-PREC.ruleOut)) + ',' + r2(yb + 6) + ' V' + r2(yb) + ' H' + r2(xs(PREC.ruleOut)) + ' V' + r2(yb + 6), fill: 'none', stroke: C.ink, 'stroke-width': 1.4 });
      brk += N(lab, zx_, yb - 4 - ln_.box.h, bw, { anchor: 'middle', fs: G.fsA, wt: 600, fill: C.ink, halo: true }).svg;
      out += grp(stage === 1 ? ann(L, 0.25, 0.38) : o_, brk);
    }
    out += SRC('Project simulations on past elections (AAA prices, October 13–November 2).', null, true);
    return out;
  }

  /* ================== power-benchmark: the detectable effect beside 15 per-dollar estimates from other studies ================== */
  /* data/dollar.json (build_site_dollar.py): rows {label, country, what, panel, est, lo, hi} in vote points per $10 a month. One coefficient plot in two panels on one axis;
     a vertical line at PREC.detect through both; with results, the "2026" row on top across a dashed divider (the same row and helpers as drawResultsPast).
     Motion, one operation, placed against the text (TIMING in main.js: p 0.01-0.45 over the scroll while the text block's top travels from 0.95 to about 0.12 of the screen on a desktop,
     from 1.14 to 0.44 on a phone): the rows come in from the start of the beat (upper panel p 0.02-0.18, lower 0.17-0.31) and the line is drawn after them (p 0.29-0.44), all while the top of the text is still on screen;
     the furniture and the labels stand from p = 0. */
  var BM_DOM = [-0.2, 3.5];
  function drawBenchmark(L) {
    var B = D.dollar;
    if (!B || !B.rows || !B.rows.length) return msg('The data for the other studies is not loaded.');
    var cp = G.compact, ph = G.phone, p = L.p, out = '', withR = hasResults(), R = window.RESULTS;
    var tt = title(ph ? 'Other studies, per $10 a month' : 'Other studies of money and the vote', isStandIn() ? 'STAND-IN, NOT RESULTS' : '');
    out += tt.svg;
    var panels = [['recurring', 'Paid every month or year'], ['oneoff', 'Paid once, spread over 12 months']].map(function (q) {
      return { head: q[1], rows: B.rows.filter(function (r) { return r.panel === q[0]; }).sort(function (a, b) { return b.est - a.est; }) };
    });
    var nS = panels[0].rows.length + panels[1].rows.length, nMax = Math.max(panels[0].rows.length, panels[1].rows.length);
    // a phone held short (the panel under about 330px): the panel headings move into the plot (the empty lower right of each panel), the axis title is left to the figure title ("per $10 a month"),
    // and the source is one short line, so that fifteen rows keep room. On the shortest panels even that does not leave room for fifteen rows: the two panels then take turns (paged)
    var tight = ph && G.h < 330, paged = false, headH = tight ? 0 : ph ? 18 : cp ? 22 : 28, gapP = tight ? 6 : 0;
    var srcTxt = tight ? 'Sources: 14 studies; rules filed at osf.io/k7txw.' : 'Sources: 14 published studies, put on one scale by rules filed with the pre-registration (osf.io/k7txw).';
    var axTxt = 'Shift against the governing party (points per $10 a month)';
    var axFs = ph ? 12 : G.fsT, axT = tight ? { box: { h: 0 } } : N(axTxt, G.w / 2, 0, G.w - 2 * G.m, { anchor: 'middle', fs: axFs, fill: C.muted, halo: false });
    var bottom = 4 + G.fsT + 3 + (tight ? 4 : 8 + axT.box.h + 6) + (ph && !tight ? SRCW(srcTxt) : 0), unitMax = ph ? 22 : cp ? 30 : 40;
    var subTxt = ph ? 'Dot: estimate. Line: 95% range.' : 'Dot: estimate. Line: the range of effects the data are consistent with (95%).', sub = null, labY, lineTop, y0, unit, k;
    function fit(rowsN, heads) { return (G.h - bottom - 4 - y0 - heads * headH - (heads > 1 ? gapP : 0) - (withR ? 10 : 0)) / (rowsN + (withR ? 1 : 0)); }
    for (k = 0; k < 2; k++) {   // a phone drops the subtitle if the rows would get too tight with it
      sub = k === 0 && !tight ? N(subTxt, G.m, tt.bottom + 2, G.w - 2 * G.m - (ph ? 0 : 150), { fill: C.muted, fs: G.fsT + 0.5, halo: false }) : null;   // not a phone: room at the right for main.js's "Back to the overview" link, which sits under the tag
      labY = (sub ? sub.box.y + sub.box.h : tt.bottom) + (tight ? 12 : ph ? 15 : cp ? 18 : 26); lineTop = labY + 5; y0 = lineTop + (ph ? 3 : 8);
      unit = Math.min(unitMax, fit(nS, 2));
      if (!ph || unit >= 15) break;
    }
    if (ph && unit < 11.5) { paged = true; headH = 18; gapP = 0; unit = Math.min(unitMax, fit(nMax, 1)); }
    var inl = tight && !paged;   // the headings inside the plot
    if (sub) out += sub.svg;
    var fl = ph ? (unit >= 14 ? 12 : 11) : cp ? 12.5 : 14, fd = ph ? 11 : fl - 1.5, fh = ph ? Math.max(11, Math.min(12, fl)) : cp ? 13 : G.fsT;
    var two = !ph && unit >= 27;   // author and, under it, country and what the money was; a short panel or a phone keeps the author alone
    var rowsAll = panels[0].rows.concat(panels[1].rows), labMax = tw('2026', fl, 700);
    rowsAll.forEach(function (r) { labMax = Math.max(labMax, tw(r.label, fl, 400), two ? tw(r.country + ', ' + r.what, fd, 400) : 0); });
    var colL = Math.ceil(labMax) + (cp ? 12 : 22), x0 = G.m + colL, x1 = G.w - G.m - (ph ? 24 : cp ? 30 : 40);
    var main = withR && R.ladder && R.ladder[3], dom0 = BM_DOM[0], step = ph ? 1 : 0.5;
    if (main && okEst(main)) dom0 = Math.max(-1.5, Math.min(dom0, main.ci95_lo_per_10_dollars - 0.1, main.beta_per_10_dollars - 0.1));   // the 2026 estimate must stay on the axis, so the axis grows to the left for it
    var xs = d3.scaleLinear().domain([dom0, BM_DOM[1]]).range([x0, x1]), ticks = d3.range(Math.ceil(dom0 / step - 1e-9) * step, (ph ? 3 : 3.5) + 1e-9, step);
    var xl = x0 - (cp ? 8 : 12), cur = y0, grid = '', body = '', e;
    // the 2026 row, with results, on top across a dashed divider
    if (withR) {
      var cy0 = cur + unit / 2, mr = okEst(main) ? Object.assign({ main: true }, toIV(main)) : { status: String((main && main.status) || 'not available').replace(/^not_run: |^deferred: /, '') };
      body += T('2026', xl, cy0 + fl * 0.35, { anchor: 'end', fs: fl, wt: 700, fill: C.accent });
      e = ease(ramp(p, 0.01, 0.09));
      body += grp(ramp(e, 0, 0.3), mr.status && mr.status !== 'run' ? IV(xs, cy0, mr, e, {}) : IVc(xs, cy0, mr, e, { col: C.accent, main: true }));
      cur += unit + 5;
      body += LN(G.m, cur, G.w - G.m, cur, { stroke: C.rule, 'stroke-dasharray': '3 4' });
      cur += 5;
    }
    var swap = ramp(p, 0.165, 0.185), endY = cur;   // paged: the first panel fades out as the second comes in
    panels.forEach(function (pn, pi) {
      var pb = '', pg = '', yy = cur;
      if (!inl) { pb += T(pn.head, x1, yy + headH - 7, { anchor: 'end', fs: fh, wt: 600, fill: C.muted }); yy += headH; }   // right-aligned, clear of the two lines at the left
      else if (pi) { pb += LN(G.m, yy + gapP / 2, G.w - G.m, yy + gapP / 2, { stroke: C.rule, 'stroke-dasharray': '3 4' }); yy += gapP; }
      var segTop = yy;
      pn.rows.forEach(function (r, i) {
        var cy = yy + unit / 2, a0 = pi === 0 ? 0.02 + i * 0.016 : 0.17 + i * 0.0145;
        if (two) pb += T(r.label, xl, cy - 1.5, { anchor: 'end', fs: fl, fill: C.ink }) + T(r.country + ', ' + r.what, xl, cy + fd + 0.5, { anchor: 'end', fs: fd, fill: C.muted });
        else pb += T(r.label, xl, cy + fl * 0.35, { anchor: 'end', fs: fl, fill: C.ink });
        var ee = ease(ramp(p, a0, a0 + 0.05));
        pb += grp(ramp(ee, 0, 0.3), IVc(xs, cy, r, ee, { col: C.ink }));   // the row comes in: the dot fades in as its interval grows
        if (r.hi > BM_DOM[1] && ee > 0.98) pb += T(r.hi.toFixed(1), xs(BM_DOM[1]) + 8, cy + fh * 0.35, { fs: ph ? fh : fh - 1, fill: C.muted });   // the interval runs past the axis: its end value beside the arrowhead
        if (inl && i === pn.rows.length - 1) pb += T(pn.head, x1 + 8, cy + fh * 0.35, { anchor: 'end', fs: fh, wt: 600, fill: C.muted, halo: true });
        yy += unit;
      });
      ticks.forEach(function (v) { if (v) pg += LN(xs(v), segTop - 2, xs(v), yy + 2, { stroke: C.rule }); });   // grid lines panel by panel, so that a heading sits on clear paper
      if (paged) {
        var al = pi ? swap : 1 - swap;
        grid += grp(al, pg); body += grp(al, pb); endY = Math.max(endY, yy);
      } else { grid += pg; body += pb; cur = yy; endY = yy; }
    });
    var axY = endY + 4;
    var la = ease(ramp(p, 0.29, 0.44)), xd = xs(PREC.detect), yClip = lineTop + (axY - lineTop) * la, lab = 'Effect I should reliably detect: ' + PREC.detect.toFixed(2), lines = '', labs = '';
    lines += LN(xs(0), lineTop, xs(0), axY, { stroke: C.muted, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' });   // the zero line and the line at the detectable effect, under the rows
    if (la > 0.004) lines += LN(xd, lineTop, xd, yClip, { stroke: C.accent, 'stroke-width': 1.8 });
    labs += T('no effect', xs(0) - 5, labY, { anchor: 'end', fs: fh, fill: C.muted });
    if (la > 0.004) {
      var lx = xd + 6, anc = 'start';
      if (lx + tw(lab, fh, 600) > G.w - G.m) { lab = ph ? 'Reliably detected: ' + PREC.detect.toFixed(2) : lab; if (lx + tw(lab, fh, 600) > G.w - G.m) { lx = G.w - G.m; anc = 'end'; } }
      labs += grp(ramp(p, 0.29, 0.34), T(lab, lx, labY, { anchor: anc, fs: fh, wt: 600, fill: C.accent }));
    }
    out += grid + lines + body + labs;
    out += axisBottom(xs, axY, ticks, function (v) { return v === 0 ? '0' : sgn(v, v % 1 ? 1 : 0); });
    if (!tight) out += N(axTxt, G.w / 2, axY + 4 + G.fsT + 3 + 8, G.w - 2 * G.m, { anchor: 'middle', fs: axFs, fill: C.muted, halo: false }).svg;
    out += SRC(srcTxt, null, ph && !tight);
    return out;
  }

  /* ================== report-ladder, report-variants: the estimates I promise to show ================== */
  function drawReportPhone(L) {
    var ladder = L.beat === 'report-ladder', tt = title(ladder ? 'Simplest to main' : 'Main and variants', resultsTag()), out = tt.svg;
    var restore = G.phone && window.innerHeight > window.innerWidth, tiny = G.hh < 230, note = ladder && G.h - tt.bottom > 200;
    var top = tt.bottom + (tiny ? -4 : 14), ay = G.h - (restore && ladder ? note ? 104 : 66 : note ? 84 : tiny ? 44 : 49), rows, unit, group = '', own = false;
    if (ladder) rows = realLadder().map(function (r, i) { return Object.assign({}, r, { tip: null, s: ['All counties', 'Within races', 'Unusual rise only', 'Final analysis'][i] }); });
    else {
      var n = Math.max(2, Math.floor((ay - top - 22) / 22) - 1), pages = [], main = Object.assign({}, realLadder()[3], { s: 'Main analysis', tip: 'main' });
      var pending = [], heading = 'Model variants';
      function flush() {
        for (var k = 0; k < pending.length; k += n) pages.push({ rows: [main].concat(pending.slice(k, k + n)), group: heading });
        pending = [];
      }
      realVariants().forEach(function (v) {
        if (v.sep) { flush(); heading = v.sep; }
        else if (v.turn) {
          flush();
          var prev = pages[pages.length - 1];
          if (prev && prev.own && (!hasResults() || prev.rows.length < 2)) prev.rows.push(v);
          else pages.push({ rows: [v], group: 'Alternative outcomes', own: true });
        }
        else pending.push(v);
      });
      flush();
      var page = pages[Math.min(pages.length - 1, Math.floor(ramp(L.p, 0.03, 0.44) * pages.length))];
      rows = page.rows; group = page.group; own = !!page.own;
      if (!own) { out += T(group, G.m, top + 7, { fs: 11, fill: C.muted, wt: 600 }); top += 22; }
    }
    if (own) {
      var bh = (G.h - top - 6) / rows.length;
      rows.forEach(function (r, i) {
        var y = top + i * bh, ayO = y + bh - 40, cy = (y + 36 + ayO - 8) / 2;
        var sx = d3.scaleLinear().domain([-1, 1]).range([G.m + 12, G.w - G.m - 12]);
        out += hitRect(r.tip, G.m, y, G.w - 2 * G.m, bh);
        out += T(r.tip === 'govsen' ? 'Governor minus Senate' : (r.s || r.lab), G.m, y + 20, { fs: 13, wt: 600 });
        out += LN(sx(0), y + 30, sx(0), ayO, { stroke: C.ink, 'stroke-dasharray': '4 3' });
        out += IV(sx, cy, r, 1);
        out += axisBottom(sx, ayO, [-1, 0, 1], function (v) { return v ? sgn(v, 0) : '0'; });
        out += T((hasResults() && r.unitS) || (r.tip === 'govsen' ? 'Points against governor’s party per $10/month' : 'Turnout points per extra $10/month'), G.w / 2, ayO + 40, { fs: 13, anchor: 'middle', fill: C.muted });
      });
      return out + SRC(resultsSource());
    }
    var labelW = Math.min(142, (G.w - 2 * G.m) * 0.46), x0 = G.m + labelW, x1 = G.w - G.m - 10;
    var xs = d3.scaleLinear().domain(realDomain()).range([x0, x1]);
    unit = (ay - top - (tiny ? 0 : 8)) / rows.length;
    if (!ladder) ay = top + unit * rows.length + (tiny ? 0 : 8);
    var plotBot = ay;
    [-1, 0, 2].forEach(function (v) { out += LN(xs(v), top - 3, xs(v), plotBot, { stroke: v ? C.rule : C.ink, 'stroke-dasharray': v ? null : '4 3' }); });
    rows.forEach(function (r, i) {
      var y = top + unit * (i + 0.5), main = !!r.main || r.tip === 'main', col = main ? C.accent : C.ink;
      var lab = r.s || r.lab;
      if (r.tip) out += hitRect(r.tip, G.m, y - unit / 2, labelW - 8, unit);
      out += RL(lab, x0 - 12, y, labelW - 12, { fs: tiny ? 11 : 13, wt: main ? 700 : 400, fill: col }).svg;
      if (r.band) out += E('rect', { x: xs(r.lo), y: y - 3, width: xs(r.hi) - xs(r.lo), height: 6, fill: C.faint, stroke: C.muted });
      else out += IV(xs, y, r, 1, { col: col, main: main });
    });
    out += axisBottom(xs, ay, [-1, 0, 1, 2], function (v) { return v ? sgn(v, 0) : '0'; });
    out += T('Vote points per extra $10/month', G.w / 2, ay + 40, { fs: 13, anchor: 'middle', fill: C.muted });
    if (restore && ladder) out += T('Dot: estimate. Line: 95% range.', G.w / 2, ay + 58, { fs: 11, anchor: 'middle', fill: C.muted });
    if (note) out += N('Further down: less mixing with other differences; wider intervals.', G.m, ay + (restore ? 68 : 47), G.w - 2 * G.m, { fs: 11, halo: false }).svg;
    out += SRC(resultsSource());
    return out;
  }
  function drawReportTablet(L) {
    var a = smooth(0.04, 0.30, L.p), exit = 1 - smooth(0, 0.45, a), th0 = thumbSpecs ? thumbSpecs.length : 0;
    var out = grp(exit, drawReport({ beat: 'report-ladder', p: 1 }));
    if (thumbSpecs) thumbSpecs.slice(th0).forEach(function (ts) { ts.a *= exit; });
    var tt = title('Main estimate and variants', resultsTag()), body = tt.svg;
    body += N('Vote points per extra $10/month. Dot: estimate; line: 95% range.', G.m, tt.bottom, G.w - 2 * G.m, { fs: 14, fill: C.muted, halo: false }).svg;
    var top = tt.bottom + 32, bot = G.h - 48, cw = (G.w - 2 * G.m - 22) / 2;
    var main = Object.assign({}, realLadder()[3], { s: 'Main analysis', tip: 'main' });
    var model = [main].concat(realVariants().filter(function (v) { return !v.sep; }).slice(0, 11));
    function scale(x) { return d3.scaleLinear().domain(realDomain()).range([x + 145, x + cw - 4]); }
    function row(r, x, y, xs, h) {
      var col = r.main ? C.accent : C.ink, lab = r.s || r.lab;
      var z = RL(lab, x + 137, y, 137, { fs: 13, wt: r.main ? 700 : 400, fill: col }).svg;
      if (r.tip) z += hitRect(r.tip, x, y - h / 2, 138, h);
      return z + (r.band ? E('rect', { x: xs(r.lo), y: y - 3, width: xs(r.hi) - xs(r.lo), height: 6, fill: C.faint, stroke: C.muted }) : IV(xs, y, r, 1, { col: col, main: r.main }));
    }
    var x = G.m, xs = scale(x), unit = (bot - top - 24) / model.length;
    body += T('Model variants', x, top + 10, { fs: 13, fill: C.muted, wt: 600 });
    [-1, 0, 1, 2].forEach(function (v) { body += LN(xs(v), top + 20, xs(v), bot, { stroke: v ? C.rule : C.ink, 'stroke-dasharray': v ? null : '4 3' }); });
    model.forEach(function (r, i) { body += row(r, x, top + 24 + unit * (i + 0.5), xs, unit); });
    body += axisBottom(xs, bot + 4, [-1, 0, 1, 2], function (v) { return v ? sgn(v, 0) : '0'; });
    x += cw + 22; xs = scale(x);
    var yy = top + 10, normal = (bot - top - 204) / 3;
    body += T('Alternative outcomes', x, yy, { fs: 13, fill: C.muted, wt: 600 }); yy += 14;
    realVariants().filter(function (v) { return v.tip === 'voteshare' || v.tip === 'sameoffice'; }).forEach(function (r) {
      body += row(r, x, yy + normal / 2, xs, normal); yy += normal;
    });
    realVariants().filter(function (v) { return v.turn; }).forEach(function (r) {
      body += T(r.tip === 'govsen' ? 'Governor minus Senate' : (r.s || r.lab), x, yy + 14, { fs: 13, wt: 600 });
      var tx = d3.scaleLinear().domain([-1, 1]).range([x + 18, x + cw - 18]), cy = yy + 32;
      body += LN(tx(0), yy + 23, tx(0), cy + 5, { stroke: C.ink, 'stroke-dasharray': '4 3' }) + IV(tx, cy, r, 1);
      body += axisBottom(tx, cy + 5, [-1, 0, 1], function (v) { return v ? sgnPlus(v, 0) : '0'; });
      body += T(r.tip === 'govsen' ? 'Points against governor’s party per $10/month' : 'Turnout points per $10/month', x + cw / 2, yy + 72, { fs: 11, fill: C.muted, anchor: 'middle' });
      yy += 80;
    });
    body += T('Alternative price measure', x, yy + 14, { fs: 13, fill: C.muted, wt: 600 }); yy += 24;
    body += row(realVariants()[realVariants().length - 1], x, yy + normal / 2, xs, normal);
    body += axisBottom(xs, bot + 4, [-1, 0, 1, 2], function (v) { return v ? sgn(v, 0) : '0'; });
    body += T('Vote points per extra $10/month', G.w / 2, bot + 40, { fs: 13, fill: C.muted, anchor: 'middle' });
    SRC(resultsSource());
    return out + grp(smooth(0.45, 1, a), body);
  }
  function drawReport(L) {
    if (window.innerWidth < 900 && G.w >= 520 && G.w < 640 && L.beat === 'report-variants') return hasResults() ? drawReportPhone(L) : drawReportTablet(L);
    if (G.phone) return drawReportPhone(L);
    var cur = L.beat, cp = G.w < 760 || G.compact, out = '', p = L.p;
    var g = cur === 'report-variants' ? smooth(0.04, 0.30, p) : 0;   // the ladder-to-variants morph lives in report-variants' build, not in the hand-over t
    var lad = cur === 'report-ladder', bV = cur === 'report-variants' ? p : 0;
    var short = cp && G.h < 340, fs = cp ? 13 : G.fsA, fsT = short ? 11 : cp ? 13 : G.fsT + 0.5;   // short: a phone held short (375x667), where nineteen rows have to share about 190px
    var t1 = title(cp ? 'Estimates, simplest to main analysis' : 'The estimates I will report, from the simplest comparison to the main analysis', resultsTag());
    var t2 = title(cp ? 'Main estimate and variants' : 'The main estimate under the variations I will show', resultsTag());
    var gf = clamp(1 - g * 2.5, 0, 1), gv = ramp(g, 0.5, 1);   // the ladder fades out quickly while the main row glides up; the variants fade in at the end
    out += grp(gf, t1.svg) + grp(gv, t2.svg);
    var tb = cp ? lerp(t1.bottom, t2.bottom - (short ? 9 : 0), g) : Math.max(t1.bottom, t2.bottom), nar = G.w < 500, top = tb;
    // the subtitle: a unit and a key (v9.4); the variants add what hovering does
    var subW = G.w - 2 * G.m, subFs = G.fsT + 0.5;
    var subL = N('Vote points against the president’s party per extra $10 a month in fuel costs. Dot: estimate. Line: 95% range.', G.m, tb, subW, { fill: C.muted, fs: subFs, halo: false });
    var subV = N('Vote points against the president’s party per extra $10 a month in fuel costs. Dot: estimate. Line: 95% range. Hover over a row for what it does.', G.m, tb, subW, { fill: C.muted, fs: subFs, halo: false });
    if (!nar) { out += grp(gf, subL.svg) + grp(gv, subV.svg); top = tb + Math.max(subL.box.h, subV.box.h) + 6; }   // a phone has no room above the chart: its key goes under the axis title
    else top = tb;
    // the variants' labels: the full ones where the chart keeps room enough, else the short ones; one line each, in a column as wide as the longest
    var fsV = short ? 9.5 : nar ? 11.5 : cp ? 13 : 15, mainW = tw('Main analysis', fsV + 0.5, 700), xrPad = cp ? 8 : 14, colRV = nar ? 14 : 24;
    function labW(useS) { return Math.ceil(Math.max(mainW, d3.max(realVariants(), function (v) { return v.sep ? 0 : tw(useS && v.s ? v.s : v.lab, fsV, 400); }))); }
    var useS = (G.w - 2 * G.m - colRV - (labW(false) + xrPad + 6)) < (cp ? 200 : 250), colLV = labW(useS) + xrPad + 6;
    var colL = cp ? 128 : clamp(G.w * 0.30, 180, 270), colR = cp ? 52 : clamp(G.w * 0.23, 130, 190);
    var colLe = lerp(colL, colLV, g), colRe = lerp(colR, colRV, g);   // the ladder keeps its own margins; the variants need a wide label column and no right margin
    var x0 = G.m + colLe, x1 = G.w - G.m - colRe, xs = d3.scaleLinear().domain(realDomain()).range([x0, x1]);
    var oldAxY = G.h - (nar ? 6 : G.m) - (nar ? 4 + fsT + 3 + 12 + 13 : 4 + fsT + 3 + 22);
    var axY = nar ? lerp(oldAxY, G.h - 6 - (4 + fsT + 3 + 12), g) : oldAxY, rTop = top + (short ? lerp(3, 0, g) : cp ? 17 : 24), rBot = axY - 8;
    // variants geometry first (the turnout block, being a separate axis, breaks the grid)
    var hdr = short ? 1.0 : nar ? 1.0 : cp ? 1.1 : 1.25, TXH = short ? 25 : nar ? 33 : 54, nTurn = realVariants().filter(function (v) { return v.turn; }).length, nUnits = 1 + hdr * realVariants().filter(function (v) { return v.sep; }).length + realVariants().filter(function (v) { return !v.sep && !v.turn; }).length + 0.5 * nTurn;
    // the rows with their own unit (v.turn): the unit stands under the short axis, on one line where it fits and else on two (broken before the bracket)
    var fsU = nar ? fsT - 1 : fsT, lgU = short ? 1 : 2, unitMax = G.w - 2 * G.m - 4, tnbs = [], txhSum = 0, unitLines = {};
    realVariants().forEach(function (v) {
      if (!v.turn) return;
      var u_ = nar ? ((hasResults() && v.unitS) || (v.tip === 'govsen' ? 'Governor minus Senate: points against governor’s party per $10/month' : 'Turnout points per extra $10/month')) : v.unit, ls = tw(u_, fsU) <= unitMax || u_.indexOf(' (') < 0 ? [u_] : [u_.slice(0, u_.indexOf(' (')), u_.slice(u_.indexOf(' (') + 1)];
      unitLines[v.tip] = ls; v.txh = TXH + (ls.length - 1) * (fsU + lgU) + (cp ? 0 : 6); txhSum += v.txh;
    });
    var vu = Math.min((rBot - rTop - txhSum) / nUnits, cp ? 30 : 56), vrow = [], cc = rTop + vu;
    realVariants().forEach(function (v) {
      if (v.sep) { vrow.push({ v: v, y: cc + (nar ? 0.5 : 0.62) * hdr * vu }); cc += hdr * vu; }
      else if (v.turn) { var hT = 0.5 * vu + v.txh; vrow.push({ v: v, y: cc + 0.5 * vu }); tnbs.push({ top: cc, bot: cc + hT, y: cc + 0.5 * vu }); cc += hT; }
      else { vrow.push({ v: v, y: cc + 0.5 * vu }); cc += vu; }
    });
    // grid, zero line and axis (the same for every layout, so the axis stays put between the ladder and the variants; the turnout block of the variants is left out of the grid)
    var ticks = xs.ticks(cp ? 4 : 8);
    function gridSeg(xv, stroke, o) {
      var segs = [[rTop - 4, axY]];   // no gap in the ladder; the gaps open with the variants (one per row with its own axis; adjacent gaps leave no segment between them)
      if (tnbs.length && g > 0.004) {
        segs = [[rTop - 4, lerp(axY, tnbs[0].top - 2, g)]];
        tnbs.forEach(function (q, i) { segs.push([lerp(rTop - 4, q.bot + 2, g), i + 1 < tnbs.length ? lerp(axY, tnbs[i + 1].top - 2, g) : axY]); });
      }
      return segs.map(function (q) { return q[1] > q[0] ? LN(xv, q[0], xv, q[1], Object.assign({ stroke: stroke }, o || {})) : ''; }).join('');
    }
    ticks.forEach(function (v) { if (v !== 0) out += gridSeg(xs(v), C.rule); });
    out += gridSeg(xs(0), C.ink, { 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }) + (short ? '' : T('no effect', xs(0), rTop - 10, { fs: fsT, anchor: 'middle', halo: true }));
    out += axisBottom(xs, axY, ticks, function (v) { return v === 0 ? '0' : sgn(v, Math.abs(v - Math.round(v)) > 0.01 ? 1 : 0); });
    out += grp(nar ? gf : 1, T('Vote points per extra $10 a month', (x0 + x1) / 2, axY + 4 + fsT + 3 + (nar ? 12 : 16), { fs: fsT, fill: C.muted, anchor: 'middle' }));
    if (nar) out += grp(gf, T('Dot: estimate. Line: 95% range.', G.w / 2, axY + 4 + fsT + 3 + 12 + 13, { fs: fsT - 0.5, fill: C.muted, anchor: 'middle' })) + grp(gv, T('Vote points per extra $10/month; square: estimate; line: 95% range.', G.w / 2, axY + 4 + fsT + 3 + 12, { fs: fsT - 1, fill: C.muted, anchor: 'middle' }));

    // geometry of the ladder: heading rows are short, estimate rows are full height; one spare row under the ladder for the last note
    var wts = realLadder().map(function (r) { return r.g ? 0.55 : 1; }), tw_ = d3.sum(wts) + (cp ? 1.4 : 0.5);   // a phone keeps room under the last row for the horizontal note (8.1)
    var u = Math.min((rBot - rTop) / tw_, cp ? 56 : 128), ly = [], yy = rTop;
    realLadder().forEach(function (r, i) { ly.push(yy + wts[i] * u / 2); yy += wts[i] * u; });
    var iMain = realLadder().length - 1, vy0 = rTop + 0.5 * vu;
    var yMain = lerp(ly[iMain], vy0, g), lw = colLe - (cp ? 8 : 14), stateCol = C.muted;

    // the ladder rows
    var bi = -1;
    realLadder().forEach(function (r, i) {
      if (!r.g) bi++;
      var main = !!r.main, a = lad ? ramp(p, 0.05 + 0.07 * i, 0.13 + 0.07 * i) : 1, fade = main ? 1 : gf;
      if (a <= 0.004 || fade <= 0.004) return;
      var cy = main ? yMain : ly[i];
      if (r.g) {   // a heading: left-aligned across the chart, with a hairline
        out += grp(fade * a, T(r.g, G.m, cy + 4.5, { fs: fs, wt: 700, fill: C.ink }) + LN(G.m + tw(r.g, fs, 700) + 10, cy, G.w - G.m, cy, { stroke: C.rule }));
        return;
      }
      var col = main ? C.accent : r.open ? stateCol : C.ink, e = ease(a);
      var thW = cp ? 28 : 46, thH = cp ? 5 : 6;
      var txt = r.lab, lb = RL(txt, x0 - (cp ? 8 : 14) - thW - 8, cy, lw - thW - 8, { fs: fs, wt: main ? 700 : 600, fill: main ? C.accent : C.ink });
      var sr = grp(Math.min(1, a * 4), IV(xs, cy, r, e, { col: col, main: main, open: r.open }));
      // ladder thumbnails: collect specs; applied after innerHTML in paint()
      if ((lad || gf > 0.004) && a > 0.5 && typeof window.SLICE !== 'undefined' && window.SLICE && typeof window.SLICE.thumb === 'function') {
        var thStage = [0, 1, 2, 5][bi], thX = G.ox + x0 - (cp ? 8 : 14) - thW, thY = G.oy + cy - thH / 2;
        if (!thumbSpecs) thumbSpecs = [];
        thumbSpecs.push({ stage: thStage, x: thX, y: thY, w: thW, h: thH, a: gf * a });
      }
      if (main) out += grp(gf, lb.svg) + sr; else out += grp(fade, lb.svg + sr);
    });
    // ladder annotations (second stage): two arrows down the right side, both ending at the main analysis
    var o_ = gf, ladP = lad ? p : 1, aA = ramp(ladP, s2(0.27), s2(0.37)) * o_, aB = ramp(ladP, s2(0.33), s2(0.43)) * o_;
    if ((lad || gf > 0.004) && o_ > 0.004) {
      var yTop = ly[0] - u * 0.42;
      if (!cp) {
        var wA = colR * 0.44 - 4, xA = x1 + colR * 0.27, xB = x1 + colR * 0.73, nA = N('less mixing with other differences', xA, yTop, wA * 1.15, { anchor: 'middle', fs: G.fsT + 0.5, fill: C.ink, halo: false }), nB = N('wider intervals', xB, yTop, wA * 1.05, { anchor: 'middle', fs: G.fsT + 0.5, fill: C.ink, halo: false });
        out += grp(aA, nA.svg + ARROW({ x: xA, y: nA.box.y + nA.box.h + 8 }, { x: xA, y: ly[iMain] + u * 0.3 }));
        out += grp(aB, nB.svg + ARROW({ x: xB, y: nB.box.y + nB.box.h + 8 }, { x: xB, y: ly[iMain] + u * 0.3 }));
      } else {
        var xa = G.w - G.m - 6, xb = xa - 26, y0 = ly[0] - u * 0.35;
        // v7.2 [8.1]: no rotated text on a phone; one arrow down the right edge and one horizontal note under the last row
        out += grp(aA, ARROW({ x: xa, y: y0 }, { x: xa, y: ly[iMain] + u * 0.3 }));
        out += grp(aB, N('Further down the list: less mixing with other differences, and wider intervals.', G.m, ly[iMain] + u * 0.5 + 6, G.w >= 520 && G.w < 640 && window.innerWidth < 900 ? x0 - G.m - 8 : G.w - 2 * G.m - 8, { fs: 12, fill: C.ink, wt: 600 }).svg);
      }
    }
    // the variants
    if (g > 0.004) {
      var xr = x0 - xrPad, ul = function (txt, cy_, wt_) { if (vu < fsV + 5) return ''; var wl = tw(txt, fsV, wt_ || 400); return LN(xr - wl, cy_ + fsV * 0.35 + (short ? 2 : 3), xr, cy_ + fsV * 0.35 + (short ? 2 : 3), { stroke: C.muted, 'stroke-dasharray': '1.5 2.5', 'stroke-width': 1.2 }); };   // the dotted underline lies under the label text only
      var hitH = Math.max(vu - 1, short ? 9 : 12), mfs = fsV + (short ? 0 : 0.5);
      out += grp(gv, (gv > 0.5 ? hitRect('main', G.m - 4, vy0 - hitH / 2, xr - G.m + 8, hitH) : '') + T('Main analysis', xr, vy0 + mfs * 0.35, { fs: mfs, wt: 700, fill: C.accent, anchor: 'end' }) + LN(xr - mainW, vy0 + mfs * 0.35 + 3, xr, vy0 + mfs * 0.35 + 3, { stroke: C.muted, 'stroke-dasharray': '1.5 2.5', 'stroke-width': 1.2 }));
      var idx = 0;
      vrow.forEach(function (q) {
        var v = q.v, cy = q.y;
        if (v.sep) {   // a small group header with a thin rule
          var ah = ramp(bV, 0.03 + 0.022 * (idx - 0.7), 0.09 + 0.022 * (idx - 0.7)) * g, hw_ = tw(v.sep, fsV, 600);
          if (ah > 0.004) out += grp(ah, T(v.sep, G.m, cy + fsV * 0.35, { fs: fsV, wt: 600, fill: C.muted }) + LN(G.m + hw_ + 10, cy, G.w - G.m, cy, { stroke: C.rule }));
          return;
        }
        var a = ramp(bV, 0.03 + 0.022 * idx, 0.11 + 0.022 * idx) * g; idx++;   // sixteen rows, all in by p = 0.44
        if (a <= 0.004) return;
        var txt = useS && v.s ? v.s : v.lab, s_ = '', e = ease(a);
        if (v.tip && a > 0.5) s_ += hitRect(v.tip, G.m - 4, cy - hitH / 2, xr - G.m + 8, hitH);   // a row label with a note: hover and keyboard focus
        s_ += T(txt, xr, cy + fsV * 0.35, { fs: fsV, fill: C.ink, anchor: 'end' }) + ul(txt, cy);
        if (v.status && v.status !== 'run') {
          // non-run row: show status reason instead of a mark
          s_ += IV(xs, cy, v, e);   // IV writes the reason when the row did not run
          out += grp(Math.min(1, a * 3), s_);
          return;
        }
        if (v.band) {
          var bx0 = xs(v.lo), bx1 = xs(v.hi), bh = Math.max(6, vu * 0.34), bn = 'range across the leave-outs';
          s_ += E('rect', { x: r2(lerp((bx0 + bx1) / 2, bx0, e)), y: r2(cy - bh / 2), width: r2((bx1 - bx0) * e), height: r2(bh), fill: C.faint, stroke: C.muted, 'stroke-width': 1 });
          if (e > 0.9 && bx1 + 8 + tw(bn, fsT) < G.w - G.m + 6) s_ += T(bn, bx1 + 8, cy + 4, { fs: fsT, fill: C.muted });
        } else if (v.turn) {
          // its own unit, so its own short axis and zero line under the row; the unit stands under the axis
          var th = Math.min(xs(0) - x0 - 8, cp ? 70 : 100), tx = d3.scaleLinear().domain([-1, 1]).range([xs(0) - th, xs(0) + th]), yA = cy + (short ? 7 : nar ? 8 : cp ? 9 : 11), uls = unitLines[v.tip];
          s_ += LN(xs(0), cy - vu * 0.5 + 2, xs(0), yA + 4, { stroke: C.ink, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' });
          s_ += IV(tx, cy, v, e);
          s_ += LN(tx(-1), yA, tx(1), yA, { stroke: C.faint });
          if (nar) {   // a phone: the end labels stand beside the axis, so that the block is one line lower only
            [-1, 0, 1].forEach(function (t_) { s_ += LN(tx(t_), yA - 2, tx(t_), yA + 2, { stroke: C.faint }); });
            s_ += T(MINUS + '1', tx(-1) - 4, yA + 3.5, { fs: fsT - 1, fill: C.muted, anchor: 'end' }) + T('+1', tx(1) + 4, yA + 3.5, { fs: fsT - 1, fill: C.muted });
            uls.forEach(function (ul_, j) { s_ += T(ul_, clamp(xs(0), G.m + tw(ul_, fsU) / 2, G.w - G.m - tw(ul_, fsU) / 2), yA + 4 + fsT + 1 + j * (fsU + lgU), { fs: fsU, fill: C.muted, anchor: 'middle' }); });
          } else {
            [-1, 0, 1].forEach(function (t_) { s_ += LN(tx(t_), yA, tx(t_), yA + 4, { stroke: C.faint }) + T(t_ === 0 ? '0' : sgnPlus(t_, 0), tx(t_), yA + 4 + fsT, { fs: fsT, fill: C.muted, anchor: 'middle' }); });
            uls.forEach(function (ul_, j) { s_ += T(ul_, clamp(xs(0), G.m + tw(ul_, fsU) / 2, G.w - G.m - tw(ul_, fsU) / 2), yA + 4 + fsT + 3 + fsT + j * (fsU + lgU), { fs: fsU, fill: C.muted, anchor: 'middle' }); });
          }
        } else s_ += IV(xs, cy, v, e);
        out += grp(Math.min(1, a * 3), s_);
      });
    }
    out += SRC(resultsSource());
    return out;
  }

  /* ================== results step: the 2026 estimate above the twelve past elections ================== */
  function drawResults(L) {
    if (!hasResults()) return drawTimeline(L);   // no results yet: show the timeline
    var R = window.RESULTS, cp = G.compact, out = '';
    var P = D.placebo;
    if (!P || !P.rows || !P.rows.length) return msg('The placebo data is not loaded.');
    var tag = isStandIn() ? 'STAND-IN, NOT RESULTS' : resultsTag();
    var ttxt = cp ? '2026 and twelve past elections' : 'The 2026 main estimate alongside the twelve past elections';
    var tt = title(ttxt, tag); out += tt.svg;
    var sub = N('A positive estimate is a shift toward the Democrats, which in 2026 means against the president’s party.', G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false });
    out += sub.svg;
    // Collect rows: the twelve past elections, then the 2026 estimate
    var rows = [];
    P.rows.forEach(function (r) {
      var lab = r.label.replace(/ (midterm|presidential)$/, '');
      if (PL_PRES[r.id]) lab += ', ' + PL_PRES[r.id];
      rows.push({ lab: lab, est: r.est, lo: r.lo, hi: r.hi, past: true, id: r.id });
    });
    var main = R.ladder[3];   // Final analysis
    if (main && main.status === 'run') {
      rows.push({ lab: '2026', est: main.beta_per_10_dollars, lo: main.ci95_lo_per_10_dollars, hi: main.ci95_hi_per_10_dollars, main: true });
    } else {
      rows.push({ lab: '2026', main: true, none: String((main && main.status) || 'not available').replace(/^not_run: |^deferred: /, '') });
    }
    // Domain: fit all rows
    var dm = 0.5;
    rows.forEach(function (r) {
      if (r.none) return;
      if (r.est != null) dm = Math.max(dm, Math.abs(r.est) + 0.15);
      if (r.lo != null) dm = Math.max(dm, Math.abs(r.lo) + 0.15);
      if (r.hi != null) dm = Math.max(dm, Math.abs(r.hi) + 0.15);
    });
    dm = Math.ceil(dm * 2) / 2;
    var fl = cp ? 13 : G.fsA, top = sub.box.y + sub.box.h + (cp ? 10 : 18), axY = G.h - G.m - (4 + G.fsT + 3 + 22);
    var labMax = d3.max(rows, function (r) { return tw(r.lab, fl, r.main ? 700 : 400); }) || 0;
    var colL = Math.max(cp ? 54 : 78, Math.ceil(labMax) + (cp ? 12 : 22));
    var x0 = G.m + colL, x1 = G.w - G.m - (cp ? 4 : 24);
    var xs = d3.scaleLinear().domain([-dm, dm]).range([x0, x1]);
    // A divider between past and 2026
    var nPast = rows.filter(function (r) { return r.past; }).length;
    var unit = (axY - top) / rows.length;
    // Grid and axis
    var ticks = xs.ticks(cp ? 4 : 8);
    ticks.forEach(function (v) { if (v !== 0) out += LN(xs(v), top, xs(v), axY, { stroke: C.rule }); });
    out += LN(xs(0), top, xs(0), axY, { stroke: C.ink, 'stroke-dasharray': '4 3', 'stroke-width': 1.2 });
    out += axisBottom(xs, axY, ticks, function (v) { return v === 0 ? '0' : sgn(v, Math.abs(v - Math.round(v)) > 0.01 ? 1 : 0); });
    out += T('Vote points per extra $10 a month', (x0 + x1) / 2, axY + 4 + G.fsT + 3 + 16, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    // Rows
    var a = ramp(L.p, 0, 0.45);
    rows.forEach(function (r, i) {
      var cy = top + (i + 0.5) * unit;
      var col = r.main ? C.accent : C.ink, wt = r.main ? 700 : 400;
      if (unit >= fl - 1 || r.main || i === 0) out += RL(r.lab, x0 - (cp ? 8 : 14), cy, colL - 8, { fs: fl, wt: wt, fill: col }).svg;   // a short panel names only the first past election and 2026
      if (i === nPast && nPast > 0) out += LN(G.m, cy - unit / 2 + 2, G.w - G.m, cy - unit / 2 + 2, { stroke: C.rule, 'stroke-dasharray': '3 4' });
      var e = r.main ? ease(ramp(a, 0.3, 0.9)) : ease(ramp(a, i * 0.02, 0.1 + i * 0.02));
      if (r.none) out += T(r.none, x0 + 8, cy + fl * 0.35, { fs: fl - 1, fill: C.muted, italic: true });
      else out += IV(xs, cy, r, e, { col: col, main: r.main });
    });
    out += SRC(resultsSource());
    return out;
  }

  /* ================== timeline: prereg, when ================== */
  var MS = [   // 2026-10-28: the registered dates restored (PI); updates have no fixed date
    { date: 'By Nov 2', what: 'Plan and code fixed', fixed: true },
    { date: 'Tue, Nov 3', what: 'Election Day', ed: true },
    { date: 'Wed, Nov 4', what: 'First results' },
    { date: 'About a week later', what: 'Update' },
    { date: 'All states at 100%', what: 'Final update' },
    { date: 'December', what: 'House races' }
  ];
  /* ================== results-senate and results-past: two figures that follow the main result ================== */
  var SEN_NAMES = { IA: 'Iowa', KS: 'Kansas', ME: 'Maine', MI: 'Michigan', MN: 'Minnesota', NH: 'New Hampshire', OH: 'Ohio', SC: 'South Carolina', TX: 'Texas' };
  function okEst(r) { return !!r && r.status === 'run' && r.beta_per_10_dollars != null && r.ci95_lo_per_10_dollars != null && r.ci95_hi_per_10_dollars != null; }
  function toIV(r) { return { est: r.beta_per_10_dollars, lo: r.ci95_lo_per_10_dollars, hi: r.ci95_hi_per_10_dollars, status: 'run' }; }
  function niceDomain(vals, floor, cap) {   // symmetric, in steps of 0.5; `cap` keeps one very wide interval from squeezing the rest
    var m = floor || 0.5;
    vals.forEach(function (v) { if (v != null && isFinite(v)) m = Math.max(m, Math.abs(v) + 0.15); });
    m = Math.ceil(m * 2) / 2;
    return cap ? Math.min(m, cap) : m;
  }
  /* the coefficient mark on a fixed axis: where the interval runs past the axis the line stops at the edge with a small chevron, and a dot outside the axis is not drawn */
  function IVc(xs, cy, r, e, o) {
    o = o || {};
    if (r.status && r.status !== 'run') return IV(xs, cy, r, e, o);
    var dm = xs.domain(), a = dm[0], b = dm[1], col = o.col || C.ink, pale = mix(col, C.bg, 0.4), rad = (G.compact ? 3.5 : 4.5) + (o.main ? 1.5 : 0);
    var inside = r.est >= a && r.est <= b, xe = xs(clamp(r.est, a, b)), xl = xs(clamp(r.lo, a, b)), xh = xs(clamp(r.hi, a, b));
    xl = xe + (xl - xe) * e; xh = xe + (xh - xe) * e;
    var s = LN(xl, cy, xh, cy, { stroke: pale, 'stroke-width': o.main ? 1.75 : 1.25 }), k = 5;
    if (r.lo < a && e > 0.98) s += E('path', { d: 'M' + r2(xl + k) + ',' + r2(cy - k) + ' L' + r2(xl) + ',' + r2(cy) + ' L' + r2(xl + k) + ',' + r2(cy + k), fill: 'none', stroke: pale, 'stroke-width': 1.25 });
    if (r.hi > b && e > 0.98) s += E('path', { d: 'M' + r2(xh - k) + ',' + r2(cy - k) + ' L' + r2(xh) + ',' + r2(cy) + ' L' + r2(xh - k) + ',' + r2(cy + k), fill: 'none', stroke: pale, 'stroke-width': 1.25 });
    if (inside) s += E('circle', { cx: r2(xe), cy: r2(cy), r: rad, fill: col });
    return s;
  }
  function pmNum(v) { return Math.abs(v) < 0.005 ? '0.00' : sgnPlus(v, 2); }

  function drawResultsSenate(L) {
    if (!hasResults() || !window.RESULTS.senate) return drawTimeline(L);
    var S = window.RESULTS.senate, cp = G.compact, out = '', tag = isStandIn() ? 'STAND-IN, NOT RESULTS' : resultsTag();
    var tt = title('Competitive Senate races', tag); out += tt.svg;
    var tight = G.phone && G.h < 320;   // the shortest phones: one subtitle line, so that ten rows keep room
    var sub = N(tight ? 'Dot: estimate; line: 95% range.' : cp ? 'Against the president’s party. Dot: estimate; line: 95% range. One-race rows are exploratory.' : 'Vote points against the president’s party per extra $10 a month. Dot: estimate. Line: 95% range. Each race alone is exploratory.', G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false });
    out += sub.svg;
    var rows = (S.states || []).map(function (r) { return { lab: SEN_NAMES[r.state] || r.state, rec: r, est: r.beta_per_10_dollars, lo: r.ci95_lo_per_10_dollars, hi: r.ci95_hi_per_10_dollars, status: r.status === 'run' ? 'run' : r.status }; });
    var nIn = rows.filter(function (r) { return r.status === 'run'; }).length;
    var comp = S.competitive, oth = S.other, diff = S.difference, hasC = okEst(comp), hasO = okEst(oth);
    var pooled = { lab: hasC ? 'All together (' + comp.n_states + ' states)' : 'All together', main: true };
    if (hasC) Object.assign(pooled, toIV(comp)); else pooled.status = String((comp && comp.status) || 'not available').replace(/^not_run: /, '');
    // the caption under the axis: the registered difference, then what the numbers can't show
    var c1 = okEst(diff)
      ? (tight ? 'Competitive minus other: ' : 'Competitive minus other Senate races: ') + pmNum(diff.beta_per_10_dollars) + ' points (95% interval ' + pmNum(diff.ci95_lo_per_10_dollars) + ' to ' + pmNum(diff.ci95_hi_per_10_dollars) + ').'
      : 'Competitive minus other Senate races: not available' + (diff && diff.status ? ' (' + String(diff.status).replace(/^not_run: /, '') + ')' : '') + '.';
    var c2 = tight ? 'Little power; one-race rows are noisy.' : G.phone ? 'Little power; one race alone is exploratory and noisy.' : 'This comparison has little power, and the estimate for any one race alone is noisy.';
    var capFs = cp ? 12 : G.fsT, capW = G.w - 2 * G.m, capN = N(c1 + ' ' + c2, G.m, 0, capW, { fs: capFs, halo: false, fill: C.ink });
    var capH = capN.box.h + 6, axSp = 4 + G.fsT + 3 + 30;
    var fl = tight ? 11 : cp ? 12 : G.fsA, bandLab = cp ? 15 : 20;
    var top = sub.box.y + sub.box.h + (G.phone ? 6 : cp ? 32 : 40) + bandLab, axY = G.h - capH - axSp - 4;   // the strip under the subtitle is for main.js's "Back to the overview" button
    var all = rows.concat([pooled]), unit = Math.min((axY - top) / (all.length + 0.5), cp ? 34 : 46), sepGap = unit * 0.5;
    axY = Math.min(axY, top + unit * all.length + sepGap + 6);
    var vals = [];
    all.forEach(function (r) { if (r.status === 'run') vals.push(r.lo, r.hi, r.est); });
    var pv = []; [comp, oth].forEach(function (r) { if (okEst(r)) pv.push(r.ci95_lo_per_10_dollars, r.ci95_hi_per_10_dollars, r.beta_per_10_dollars); });
    var dmPool = niceDomain(pv, 0.5), dm = niceDomain(vals.concat(pv), 0.5, Math.max(2, dmPool * 2.5));
    var labMax = d3.max(all, function (r) { return tw(r.lab, fl, r.main ? 700 : 400); }) || 0, colL = Math.ceil(labMax) + (cp ? 14 : 24);
    var x0 = G.m + colL, x1 = G.w - G.m - (cp ? 6 : 24), xs = d3.scaleLinear().domain([-dm, dm]).range([x0, x1]);
    var ticks = xs.ticks(cp ? 4 : 8);
    var a = ramp(L.p, 0, 0.45);
    // the reference band: the pooled estimate for the other Senate races
    if (hasO) {
      var bl = xs(clamp(oth.ci95_lo_per_10_dollars, -dm, dm)), bh = xs(clamp(oth.ci95_hi_per_10_dollars, -dm, dm)), bg = ease(ramp(a, 0, 0.5));
      out += grp(bg, E('rect', { x: r2(bl), y: r2(top - 4), width: r2(Math.max(2, bh - bl)), height: r2(axY - top + 4), fill: C.accentSoft, opacity: 0.75 }) +
        LN(xs(clamp(oth.beta_per_10_dollars, -dm, dm)), top - 4, xs(clamp(oth.beta_per_10_dollars, -dm, dm)), axY, { stroke: C.accent, 'stroke-width': 1.25, 'stroke-dasharray': '5 3' }) +
        T(cp ? 'Other Senate races' : 'Other Senate races: estimate and 95% range', clamp((bl + bh) / 2, x0 + (cp ? 48 : 120), x1 - (cp ? 48 : 120)), top - 10, { fs: cp ? 12 : G.fsT, fill: C.accent, anchor: 'middle', wt: 600 }));
    }
    ticks.forEach(function (v) { if (Math.abs(v) > 1e-9) out += LN(xs(v), top - 4, xs(v), axY, { stroke: C.rule }); });
    out += LN(xs(0), top - 4, xs(0), axY, { stroke: C.ink, 'stroke-dasharray': '4 3', 'stroke-width': 1.2 });
    out += axisBottom(xs, axY, ticks, function (v) { return v === 0 ? '0' : sgn(v, Math.abs(v - Math.round(v)) > 0.01 ? 1 : 0); });
    out += T(tight ? 'Points against the president’s party per $10 a month' : cp ? 'Vote points per extra $10 a month' : 'Vote points against the president’s party per extra $10 a month', tight ? G.w / 2 : (x0 + x1) / 2, axY + 4 + G.fsT + 3 + 16, { fs: tight ? G.fsT - 1 : G.fsT, fill: C.muted, anchor: 'middle' });
    all.forEach(function (r, i) {
      var cy = top + (i + 0.5) * unit + (r.main ? sepGap : 0), col = r.main ? C.accent : C.ink;
      out += RL(r.lab, x0 - (cp ? 8 : 14), cy, colL - 8, { fs: fl, wt: r.main ? 700 : 400, fill: col }).svg;
      if (r.main) out += LN(G.m, cy - unit / 2 - sepGap / 2 + 2, G.w - G.m, cy - unit / 2 - sepGap / 2 + 2, { stroke: C.rule, 'stroke-dasharray': '3 4' });
      var e = ease(ramp(a, 0.2 + i * 0.02, 0.5 + i * 0.02));
      out += r.status === 'run' ? IVc(xs, cy, r, e, { col: col, main: r.main }) : IV(xs, cy, { status: r.status }, e, {});
    });
    out += N(c1 + ' ' + c2, G.m, axY + axSp, capW, { fs: capFs, halo: false, fill: C.ink }).svg;
    out += SRC(resultsSource(), resultsSourceShort());
    return out;
  }

  function drawResultsPast(L) {
    if (!hasResults()) return drawTimeline(L);
    var P = D.past_county;
    if (!P || !P.rows) return msg('The data for 2022 and 2024 is not loaded.');
    var R = window.RESULTS, cp = G.compact, out = '', tag = isStandIn() ? 'STAND-IN, NOT RESULTS' : 'Exploratory';
    var tt = title(cp ? 'The same design in 2022, 2024 and 2026' : 'The same design in 2022, 2024 and 2026', tag); out += tt.svg;
    var sub = N(cp ? 'Against the president’s party. Dot: estimate; line: 95% range.' : 'Vote points against the president’s party per extra $10 a month. Dot: estimate. Line: 95% range.', G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false });
    out += sub.svg;
    var rows = P.rows.map(function (r) { return { lab: r.label, est: r.beta_per_10_dollars, lo: r.ci95_lo_per_10_dollars, hi: r.ci95_hi_per_10_dollars, status: r.status === 'run' ? 'run' : r.status, past: true }; });
    var main = R.ladder && R.ladder[3];
    if (okEst(main)) rows.push(Object.assign({ lab: '2026', main: true }, toIV(main)));
    else rows.push({ lab: '2026', main: true, status: String((main && main.status) || 'not available').replace(/^not_run: |^deferred: /, '') });
    var cap = '2022 and 2024: exploratory, run before I registered the plan. Price change measured from a single archived day in 2020. In 2022 and 2024 the president was a Democrat, so a positive value there is a shift toward the Republicans.';
    var capFs = cp ? 12 : G.fsT, capN = N(cap, G.m, 0, G.w - 2 * G.m, { fs: capFs, halo: false, fill: C.ink }), axSp = 4 + G.fsT + 3 + 30;
    var fl = cp ? 13 : G.fsA, top = sub.box.y + sub.box.h + (G.phone ? 10 : cp ? 32 : 40), unit = Math.min((G.h - capN.box.h - axSp - 14 - top) / rows.length, cp ? 44 : 60), axY = top + unit * rows.length + 4;
    var vals = []; rows.forEach(function (r) { if (r.status === 'run') vals.push(r.lo, r.hi, r.est); });
    var dm = niceDomain(vals, 0.5), labMax = d3.max(rows, function (r) { return tw(r.lab, fl, r.main ? 700 : 400); }) || 0, colL = Math.ceil(labMax) + (cp ? 14 : 24);
    var x0 = G.m + colL, x1 = G.w - G.m - (cp ? 6 : 24), xs = d3.scaleLinear().domain([-dm, dm]).range([x0, x1]), ticks = xs.ticks(cp ? 4 : 8);
    ticks.forEach(function (v) { if (Math.abs(v) > 1e-9) out += LN(xs(v), top, xs(v), axY, { stroke: C.rule }); });
    out += LN(xs(0), top, xs(0), axY, { stroke: C.ink, 'stroke-dasharray': '4 3', 'stroke-width': 1.2 });
    out += axisBottom(xs, axY, ticks, function (v) { return v === 0 ? '0' : sgn(v, Math.abs(v - Math.round(v)) > 0.01 ? 1 : 0); });
    out += T(cp ? 'Vote points per extra $10 a month' : 'Vote points against the president’s party per extra $10 a month', (x0 + x1) / 2, axY + 4 + G.fsT + 3 + 16, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    var a = ramp(L.p, 0, 0.45);
    rows.forEach(function (r, i) {
      var cy = top + (i + 0.5) * unit, col = r.main ? C.accent : C.ink;
      out += RL(r.lab, x0 - (cp ? 8 : 14), cy, colL - 8, { fs: fl, wt: r.main ? 700 : 400, fill: col }).svg;
      if (r.main) out += LN(G.m, cy - unit / 2, G.w - G.m, cy - unit / 2, { stroke: C.rule, 'stroke-dasharray': '3 4' });
      var e = r.main ? ease(ramp(a, 0.3, 0.9)) : ease(ramp(a, i * 0.05, 0.3 + i * 0.05));
      out += r.status === 'run' ? IVc(xs, cy, r, e, { col: col, main: r.main }) : IV(xs, cy, { status: r.status }, e, {});
    });
    out += N(cap, G.m, axY + axSp, G.w - 2 * G.m, { fs: capFs, halo: false, fill: C.ink }).svg;
    out += SRC(resultsSource(), resultsSourceShort());
    return out;
  }

  function drawTimelinePhone(L) {
    var when = L.beat === 'when', mw = when ? 1 : L.to === 'when' ? L.m : 0;
    var tt = title('Plan and results'), out = tt.svg, rx = G.m + 10, tx = rx + 22;
    var note = N('At least 90% counted. Slower states, such as California, join later.', tx, 0, G.w - G.m - tx, { fs: 12, halo: false });
    var extra = (note.box.h + 46) * mw, top = tt.bottom + 12, bot = G.h - 10;
    var sp = (bot - top - extra) / 5, ys = MS.map(function (m, i) { return top + i * sp + (i >= 3 ? extra : 0); });
    out += LN(rx, ys[0], rx, ys[5], { stroke: C.faint, 'stroke-width': 2 });
    MS.forEach(function (m, i) {
      var y = ys[i], on = i === 2 && mw > 0.5, col = on ? C.accent : C.ink;
      if (on) out += E('rect', { x: G.m, y: y - 10, width: G.w - 2 * G.m, height: 22, fill: C.accentSoft });
      if (m.ed) out += E('path', { d: 'M' + rx + ',' + (y - 6) + ' l6,6 l-6,6 l-6,-6 Z', fill: C.ink });
      else out += E('circle', { cx: rx, cy: y, r: on ? 7 : 5, fill: m.fixed || on ? C.accent : C.bg, stroke: m.fixed || on ? C.accent : C.ink, 'stroke-width': 1.8 });
      out += T(m.date, tx, y + 4, { fs: 12, wt: 700, fill: col });
      var what = m.what + (when && i === 4 && G.w > 400 ? ' (turnout added)' : '');
      out += T(what, tx + tw(m.date, 12, 700) + 8, y + 4, { fs: 12, fill: col, wt: on ? 600 : 400 });
    });
    if (mw > 0.01) {
      var ny = ys[2] + 17;
      out += grp(ramp(mw, 0.85, 1), N('At least 90% counted. Slower states, such as California, join later.', tx, ny, G.w - G.m - tx, { fs: 12, halo: false }).svg + ARROW({ x: tx + 6, y: ny + note.box.h + 5 }, { x: tx + 6, y: Math.max(ny + note.box.h + 17, ys[3] - 17) }, { col: 'muted' }));
    } else {
      var dy = (ys[0] + ys[1]) / 2;
      var cap = 'Fixed before the election', lx = tx + tw(cap, 11, 600) + 12;
      out += LN(lx, dy, G.w - G.m, dy, { stroke: C.accent, 'stroke-dasharray': '4 4' });
      if (cap) out += T(cap, tx, dy + 4, { fs: 11, wt: 600, fill: C.accent });
    }
    return out;
  }
  function drawTimeline(L) {
    if (G.phone) return drawTimelinePhone(L);
    var cp = G.compact, wide = G.w >= 700, tight = cp && G.h < 330, out = '', cur = L.beat;   // tight: a phone held short, where each milestone is one line
    var mw = cur === 'when' ? 1 : (L.to === 'when' ? L.m : 0);               // how far toward "when"
    var build = cur === 'prereg' ? ramp(L.p, 0, 0.45) : 1;
    var aP = cur === 'prereg' ? ramp(L.p, 0.05, 0.2) * (1 - mw) : 0, aW = cur === 'when' ? ann(L, 0.05, 0.2) * (1 - (L.out || 0)) : 0;
    var tt = title('What is fixed in advance, and when the results appear'); out += tt.svg;
    var railX = wide ? G.m + 190 : G.m + 16, tx = railX + (wide ? 26 : 26), fsD = tight ? 12.5 : cp ? 13 : 15, fsW = tight ? 12 : cp ? 12.5 : (wide ? 16 : 14);
    var noteStr = 'Included once at least 90% of the expected vote is counted. Slower states, such as California, join later.';
    var noteW = Math.min(G.w - tx - G.m, 420);
    var noteTxt = N(noteStr, tx, 0, noteW, { fs: G.fsA, fill: C.ink, halo: false });
    var extra = (noteTxt.box.h + 18) * mw;
    var top = tt.bottom + (wide ? 36 : tight ? 14 : 22), bottom = G.h - (tight ? 6 : G.m) - (wide ? 40 : tight ? 0 : 28), sp = Math.min(cp ? 70 : 104, (bottom - top - extra) / 5);
    var ys = MS.map(function (m, i) { return top + i * sp + (i >= 3 ? extra : 0); });
    var railEnd = lerp(ys[0], ys[5], ramp(build, 0, 0.4));
    out += LN(railX, ys[0], railX, railEnd, { stroke: C.faint, 'stroke-width': 2 });
    if (mw > 0.01) out += E('rect', { x: r2(G.m), y: r2(ys[2] - (wide ? 20 : tight ? 13 : fsD + 7)), width: r2(G.w - 2 * G.m), height: r2(wide ? 40 : tight ? 26 : fsD + fsW + 20), fill: C.accentSoft, opacity: r2(mw * 0.9), rx: 2 });
    MS.forEach(function (m, i) {
      var k = ramp(build, 0.04 + i * 0.06, 0.16 + i * 0.06), hl = i === 2 ? mw : 0, y = ys[i], s = '';
      if (k <= 0) return;
      var r = lerp(6.5, 9, hl), on = hl > 0.5;
      if (m.ed) s += E('rect', { x: r2(railX - 6), y: r2(y - 6), width: 12, height: 12, fill: C.ink, transform: 'rotate(45 ' + railX + ' ' + y + ')' });
      else s += E('circle', { cx: railX, cy: r2(y), r: r2(r), fill: m.fixed || on ? C.accent : C.bg, stroke: m.fixed || on ? C.accent : C.ink, 'stroke-width': 2 });
      var dc = on ? C.accent : C.ink;
      if (wide) {
        s += T(m.date, railX - 22, y + fsD * 0.35, { fs: fsD, wt: 700, fill: dc, anchor: 'end' }) + T(m.what, tx, y + fsW * 0.35, { fs: fsW, fill: dc, wt: on ? 700 : 400 });
      } else if (tight) {
        s += T(m.date, tx, y + fsD * 0.35, { fs: fsD, wt: 700, fill: dc }) + T(m.what, tx + tw(m.date, fsD, 700) + 8, y + fsW * 0.35, { fs: fsW, fill: dc, wt: on ? 600 : 400 });
      } else {
        s += T(m.date, tx, y + fsD * 0.35, { fs: fsD, wt: 700, fill: dc }) + T(m.what, tx, y + fsD * 0.35 + fsW + 5, { fs: fsW, fill: dc, wt: on ? 600 : 400 });
      }
      out += grp(k, s, { transform: 'translate(0,' + r2((1 - k) * 6) + ')' });
    });
    // prereg annotations: the divider and the registration note
    if (aP > 0.004) {
      var dy = wide ? (ys[0] + ys[1]) / 2 + 4 : ys[0] + (ys[1] - ys[0]) * (tight ? 0.5 : 0.7), dl = LN(G.m, dy, G.w - G.m, dy, { stroke: C.accent, 'stroke-dasharray': '5 4', 'stroke-width': 1.2 });
      var lbl = cp ? 'Fixed before the election' : 'Everything above this line is fixed before the election';
      var ln_ = N(lbl, wide ? tx : G.m + 24, wide ? dy - Math.round(G.fsA * 1.33) - 5 : dy - 8, G.w - tx - G.m, { fill: C.accent, wt: 600 });   // a wide timeline puts it above the divider, clear of the next date
      var a_ = dl + ln_.svg;
      if (wide) {
        var rn = CALL('The plan is registered publicly and the code is published', tx + 250, ys[0] - 20, G.w - tx - 250 - G.m, { x: tx + 214, y: ys[0] }, { gap: 4, from: { x: tx + 245, y: ys[0] } });
        a_ += rn.svg;
      }
      out += grp(aP, a_);
    }
    // when annotation: the small label at the 100 percent update (turnout comes with the last count)
    if (aW > 0.004) {
      // PI 2026-10-29: plain text in parentheses right after "Final update" (was a teal pill)
      var y4 = ys[4], k4 = ramp(build, 0.04 + 4 * 0.06, 0.16 + 4 * 0.06), tl_ = '(turnout added)', wW = tw(MS[4].what, fsW, 400) + 4;
      var tlx = wide ? tx + wW : tight ? tx + tw(MS[4].date, fsD, 700) + 8 + wW : tx + wW, tly = wide || tight ? y4 + fsW * 0.35 : y4 + fsD * 0.35 + fsW + 5;
      out += grp(aW * k4, T(tl_, tlx, tly, { fs: fsW, wt: 400, fill: C.ink }));
    }
    // when annotation: the note on late states
    if (aW > 0.004 || (L.to === 'when' && mw > 0.01)) {
      var ny = ys[2] + (wide ? 22 : tight ? 12 : fsD * 0.35 + fsW + 14), nn = N(noteStr, tx, ny, noteW, { fs: G.fsA, fill: C.ink });
      out += grp(aW, nn.svg + ARROW({ x: tx + 8, y: ny + nn.box.h + 4 }, { x: tx + 8, y: ys[3] - 16 }, { col: 'muted' }));
    }
    return out;
  }

  /* ================== v8 NEW: simple-past, simple-past-2 — twelve past elections with crude comparisons ================== */
  var PL_PRES_CR = { mid_2002: 'Bush', mid_2006: 'Bush', mid_2010: 'Obama', mid_2014: 'Obama', mid_2018: 'Trump', mid_2022: 'Biden' };
  function drawCrude(L) {
    var S = D.stages;
    if (!S || !S.rows || !S.rows.length) return msg('The stages data is not loaded.');
    var cp = G.compact, stg = CRD[L.beat] || 0, p = stg ? 1 : L.p, o_ = 1 - (L.out || 0), out = '';
    var tt = title(cp ? 'Twelve past elections' : 'Twelve past elections: this year’s extra fuel cost against earlier vote shifts', 'Provisional'); out += tt.svg;
    var dirT = 'Right = toward the Democrats, in every row.';
    // on a phone the subtitle shares its line with the figure's annotation, and the axis side labels give the direction, so the twelve rows keep their height
    var sub0 = N(cp ? 'All counties.' : 'Simplest comparison, all counties. ' + dirT, G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false });
    var sub1 = N(cp ? 'gray: all; dark: within races' : 'Within races, with all counties in gray. ' + dirT, G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false });
    var subM = stg ? 1 : L.to === 'simple-past-2' ? L.m : 0, sub = sub0.box.h >= sub1.box.h ? sub0 : sub1;
    out += grp(1 - subM, sub0.svg) + grp(subM, sub1.svg);
    var srcT = 'Project estimates on AAA prices so far (October 13–28); provisional. Election results: MIT Election Data and Science Lab; Amlani and Algara (2002–2014).';
    var srcShort = tw('Project estimates (provisional); MIT Election Lab; Amlani and Algara.', 12) <= G.w - 24 ? 'Project estimates (provisional); MIT Election Lab; Amlani and Algara.' : 'Project estimates; MIT Election Lab; Amlani and Algara.';
    var srcX = SRCW(cp ? srcShort : srcT);
    var rows0 = S.rows, rows = [], groups = [['midterm', 'Midterms'], ['presidential', 'Presidential elections']];
    groups.forEach(function (g, gi) {
      rows.push({ head: g[1], wt: 1, pre: gi ? (cp ? 0.3 : 0.45) : 0 });
      rows0.filter(function (r) { return r.kind === g[0]; }).forEach(function (r) {
        rows.push({ r: r, wt: 1, pre: cp && r.id === 'pres_2012_2016' ? 1 : 0, lab: r.label.replace(/ (midterm|presidential)$/, '') + (PL_PRES_CR[r.id] ? ', ' + PL_PRES_CR[r.id] : '') });
      });
    });
    var axT = 'Points per extra $10 a month of fuel costs';
    var labMax = d3.max(rows, function (o) { return tw(o.lab, G.fsA, 400); }) || 0;
    var colL = Math.max(cp ? 54 : 78, Math.ceil(labMax) + (cp ? 12 : 22)), x0 = G.m + colL, x1 = Math.min(G.w - G.m - (cp ? 4 : 24), x0 + 720);
    if (!cp) x1 = Math.min(x1, G.w - G.m - (G.w < 800 ? 165 : 185));
    var allN0 = rows0.map(function (r) { return r.n0; });
    var M = d3.max(allN0, function (r) { return Math.max(Math.abs(r.lo), Math.abs(r.hi)); }), dm = Math.max(1, Math.ceil(M * 2 + 0.1) / 2);
    var xs = d3.scaleLinear().domain([-dm, dm]).range([x0, x1]), zx = xs(0);
    var sfs = cp ? 13 : G.fsT + 0.5, lwid = Math.max(70, zx - 38 - G.m), rwid = Math.max(70, G.w - zx - 38 - 4);
    var sideL = cp ? 'to Republicans' : 'toward the Republicans', sideR = cp ? 'to Democrats' : 'toward the Democrats';
    var sideH = Math.max(N(sideL, 0, 0, lwid, { fs: sfs, wt: 600, noClamp: true }).box.h, N(sideR, 0, 0, rwid, { fs: sfs, wt: 600, noClamp: true }).box.h);
    var axisBlock = (4 + G.fsT + 3) + 5 + sideH + (cp ? 0 : 20) + 8;
    var top = sub.box.y + sub.box.h + (cp ? 16 : 34), bot = G.h - G.m - srcX - axisBlock, tot = d3.sum(rows, function (r) { return r.wt + (r.pre || 0); });
    var unit = Math.min((bot - top) / tot, cp ? 30 : 40), y = top + Math.max(0, (bot - top - unit * tot) * 0.3);
    rows.forEach(function (r) { y += (r.pre || 0) * unit; r.y = y; r.h = unit * r.wt; r.cy = y + r.h / 2; y += r.h; });
    var axY = y + 6, gTop = rows[1].y - 2;
    var aF = ramp(p, 0.03, 0.08), f = '', ticks = cp ? d3.range(-dm, dm + 0.01, 1) : xs.ticks(8);
    f += groupGrid(xs, ticks, rows, axY);
    f += LN(zx, rows[0].cy + 7, zx, axY, { stroke: C.ink, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' });
    f += T('no effect', zx, rows[0].cy + 2, { fs: G.fsT + 0.5, anchor: 'middle', halo: true });
    f += axisBottom(xs, axY, ticks, function (v) { return Math.abs(v) < 1e-9 ? '0' : sgnPlus(v, Math.abs(v - Math.round(v)) > 0.01 ? 1 : 0); });
    var cy2 = axY + 4 + G.fsT + 3 + 14;
    f += N(sideL, zx - 38, cy2 - 9, lwid, { anchor: 'end', fill: C.rep, fs: sfs, wt: 600, noClamp: true }).svg + ARROW({ x: zx - 5, y: cy2 }, { x: zx - 33, y: cy2 });
    f += N(sideR, zx + 38, cy2 - 9, rwid, { anchor: 'start', fill: C.dem, fs: sfs, wt: 600, noClamp: true }).svg + ARROW({ x: zx + 5, y: cy2 }, { x: zx + 33, y: cy2 });
    if (!cp) f += T(axT, (x0 + x1) / 2, cy2 + Math.max(sideH, 16) + 12, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    out += grp(aF, f);
    var k = 0, row2016 = null;
    rows.forEach(function (r) {
      if (r.head) { out += grp(ramp(p, 0.05 + 0.0125 * k, 0.09 + 0.0125 * k), T(r.head, G.m, r.cy + 4.5, { fs: G.fsA, wt: 600, fill: C.ink })); return; }
      var q = r.r, a0 = 0.05 + 0.0125 * k, b = ramp(p, a0, a0 + 0.06), s = '', e = ease(b), cy = r.cy; k++;
      if (q.id === 'pres_2012_2016') row2016 = r;
      if (b <= 0.004) return;
      s += RL(r.lab, x0 - (cp ? 8 : 14), cy, colL - 10, { fs: G.fsA }).svg;
      var n0 = q.n0, greyA = stg ? 0.4 : 1 - 0.6 * (L.to === 'simple-past-2' ? L.m : 0);
      s += grp(greyA, IV(xs, cy, n0, e, { col: C.muted, op: Math.min(1, b * 3) }));
      out += s;
    });
    if (stg) {
      var k2 = 0;
      rows.forEach(function (r) {
        if (r.head) return;
        var q = r.r, n1 = q.n1, a0 = 0.05 + 0.0125 * k2, b = ramp(L.p, a0, a0 + 0.06), e = ease(b), cy = r.cy + 6; k2++;
        if (b <= 0.004) return;
        var s = IV(xs, cy, n1, e, { op: Math.min(1, b * 3) });
        out += s;
      });
      var keyTxt = cp ? 'gray: all; dark: same race' : 'gray: all counties; dark: within races';
      var keyY = top - 9;   // dedicated space between the subtitle and Midterms
      if (!cp) out += grp(ramp(L.p, 0.18, 0.25), T(keyTxt, G.m, keyY, { fs: G.fsT, fill: C.muted }));
      out += grp(ann(L, 0.25, 0.36), cp
        ? N('5 of 12 outside the fluke range', G.w - G.m, sub.box.y, 150, { fs: G.fsT + 0.5, wt: 700, fill: C.accent, anchor: 'end', halo: true }).svg
        : T('5 of 12 outside the fluke range', G.w - G.m, keyY, { fs: G.fsT, wt: 700, fill: C.accent, anchor: 'end', halo: true }));
      if (row2016) {
        var dot = { x: xs(row2016.r.n1.est), y: row2016.cy + 6 };
        var note = cp
          ? N('2016: ~1.6 pts / $10', clamp(dot.x + 18 - tw('2016: ~1.6 pts / $10', G.fsT, 600), x0 + 2, G.w - G.m - 120), row2016.y - unit / 2 - 8, 130, { fs: G.fsT, wt: 600, fill: C.accent, halo: true })   // in the gap kept above the 2012–16 row
          : N('2016: about 1.6 points per $10', dot.x - 10, row2016.cy - 36, Math.min(130, dot.x - x0 - 14), { anchor: 'end', fs: G.fsA, wt: 600, fill: C.accent, halo: true });
        out += grp(ann(L, 0.30, 0.42), note.svg);
      }
    } else {
      out += grp(ann(L, 0.25, 0.36) * (1 - (L.to === 'simple-past-2' ? L.m : 0)), cp
        ? N('1 of 12 outside the fluke range', G.w - G.m, sub.box.y, 150, { fs: G.fsT + 0.5, wt: 700, fill: C.accent, anchor: 'end', halo: true }).svg
        : T('1 of 12 outside what a fluke would plausibly give', G.w - G.m, gTop - 12, { fs: G.fsA, wt: 700, fill: C.accent, anchor: 'end', halo: true }));
    }
    out += SRC(cp ? srcShort : srcT, null, true);
    return out;
  }

  /* ================== v8 NEW: scope-3 ================== */
  function drawScope3(L) {
    var cp = G.compact, p = L.p, o_ = 1 - (L.out || 0), out = '';
    var tt = title(cp ? 'What each result would mean' : 'Two possible kinds of result, and what each would mean', 'Schematic'); out += tt.svg;
    var x0 = G.m + 6, x1 = G.w - G.m - 6, dm = 1.2;
    var xs = d3.scaleLinear().domain([-dm, dm]).range([x0, x1]), zx = xs(0);
    var axT = 'Points per extra $10 a month of fuel costs';
    var top = tt.bottom + (cp ? 30 : 50), zoneH = cp ? 80 : 140, zoneTop = top + 20, zoneBot = zoneTop + zoneH;
    var axY = zoneBot + (cp ? 20 : 30);
    var f = '', ticks = cp ? d3.range(-dm, dm + 0.01, 0.5) : xs.ticks(8);
    ticks.forEach(function (t) { if (Math.abs(t) > 1e-9) f += LN(xs(t), zoneTop - 4, xs(t), axY, { stroke: C.rule }); });
    f += LN(zx, zoneTop - 4, zx, axY, { stroke: C.ink, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' });
    f += axisBottom(xs, axY, ticks, function (v) { return Math.abs(v) < 1e-9 ? '0' : sgnPlus(v, Math.abs(v - Math.round(v)) > 0.01 ? 1 : 0); });
    f += T(axT, (x0 + x1) / 2, axY + 4 + G.fsT + 3 + 16, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    var sfs = cp ? 13 : G.fsT + 0.5, sideY = axY + 4 + G.fsT + 3 + (cp ? 35 : 34);
    f += N('toward the Republicans', zx - 38, sideY - 9, Math.max(70, zx - 38 - G.m), { anchor: 'end', fill: C.rep, fs: sfs, wt: 600, noClamp: true }).svg;
    f += ARROW({ x: zx - 5, y: sideY }, { x: zx - 33, y: sideY });
    f += N('toward the Democrats', zx + 38, sideY - 9, Math.max(70, G.w - zx - 38 - 4), { anchor: 'start', fill: C.dem, fs: sfs, wt: 600, noClamp: true }).svg;
    f += ARROW({ x: zx + 5, y: sideY }, { x: zx + 33, y: sideY });
    out += grp(ramp(p, 0.03, 0.1), f);
    var uncBand = 0.35;
    var zx0 = xs(-uncBand), zx1 = xs(uncBand);
    out += grp(ramp(p, 0.05, 0.20) * o_, E('rect', { x: r2(zx0), y: r2(zoneTop), width: r2(zx1 - zx0), height: zoneH, fill: C.rule, opacity: 0.5 }));
    out += grp(ann(L, 0.10, 0.22), N(cp ? 'close to zero: local channel weak' : 'close to zero: the local channel weak; the national effect unknown', (zx0 + zx1) / 2, zoneTop + (cp ? 10 : 20), Math.max(80, zx1 - zx0 - 16), { anchor: 'middle', fs: G.fsA, wt: 600, fill: C.ink }).svg);
    out += grp(ramp(p, 0.10, 0.22) * o_, E('rect', { x: r2(zx1), y: r2(zoneTop), width: r2(x1 - zx1), height: zoneH, fill: C.accentSoft, opacity: 0.6 }));
    out += grp(ann(L, 0.15, 0.25), N(cp ? 'a clear result: local channel at work' : 'a clear result: the local channel at work', zx1 + (x1 - zx1) / 2, zoneTop + (cp ? 10 : 20), Math.max(80, x1 - zx1 - 16), { anchor: 'middle', fs: G.fsA, wt: 600, fill: C.accent }).svg);
    out += SRC('Schematic.');
    return out;
  }

  /* ================== v8 NEW: power-meaning ================== */
  function drawPowerMeaning(L) {
    var cp = G.compact, p = L.p, o_ = 1 - (L.out || 0), out = '';
    var tt = title(cp ? 'From a local difference to a vote' : 'What the sizes mean in practice', 'Provisional'); out += tt.svg;
    var CH = ['+5¢ a gallon above its group', '≈ $3 a month for a typical household', '≈ 0.12 points of vote share, at 0.37 points per $10'];
    var CAP = [['× about 73 gallons a month'], ['× 0.037 points per $1 a month']];
    var fsC = cp ? 13 : G.w > 900 ? 20 : 18;
    var a1 = function (i) { return ramp(p, 0.05 + 0.07 * i, 0.15 + 0.07 * i); };
    var aArr = function (i) { return ann(L, 0.26 + 0.07 * i, 0.36 + 0.07 * i); };
    if (!cp) {
      var aw = clamp(G.w * 0.12, 84, 124), colW = (G.w - 2 * G.m - 2 * aw) / 3;
      var hh = CH.map(function (t) { return N(t, 0, 0, colW - 6, { fs: fsC, wt: 600, halo: false }).box.h; });
      var maxH = Math.max.apply(null, hh), yy = tt.bottom + Math.max(56, (G.h - tt.bottom - maxH) * 0.36);
      for (var i = 0; i < 3; i++) {
        var cx = G.m + i * (colW + aw), col = i === 2 ? C.accent : C.ink;
        out += grp(a1(i) * o_, N(CH[i], cx, yy, colW - 6, { fs: fsC, wt: 600, fill: col, halo: false }).svg);
        if (i < 2) {
          var ax0_ = cx + colW + 2, ax1_ = cx + colW + aw - 12, ay = yy + 10;
          out += grp(aArr(i) * o_, ARROW({ x: ax0_, y: ay }, { x: ax1_, y: ay }, { col: i === 1 ? 'accent' : 'ink' }) + N(CAP[i][0], (ax0_ + ax1_) / 2, yy - 7 - Math.round((G.fsT + 0.5) * 1.33), Math.min(230, colW + aw - 16), { anchor: 'middle', fs: G.fsT + 0.5, fill: C.muted, halo: false }).svg);
        }
      }
    } else {
      var bw = G.w - 2 * G.m - 20, tight = G.h < 400, yy0 = tt.bottom + (tight ? 26 : 34), gp = tight ? 30 : 40;
      var h3 = CH.map(function (t) { return N(t, 0, 0, bw, { fs: fsC, wt: 600, halo: false }).box.h; });
      var yyP = yy0 + Math.max(0, (G.h - yy0 - d3.sum(h3) - 2 * gp) * 0.3);
      for (var j = 0; j < 3; j++) {
        out += grp(a1(j) * o_, N(CH[j], G.m + 20, yyP, bw, { fs: fsC, wt: 600, fill: j === 2 ? C.accent : C.ink, halo: false }).svg);
        if (j > 0) out += grp(aArr(j - 1) * o_, ARROW({ x: G.m + 8, y: yyP - (gp - 9) }, { x: G.m + 8, y: yyP - 5 }, { col: j === 2 ? 'accent' : 'ink' }) + T(CAP[j - 1][0], G.m + 24, yyP - (gp > 35 ? 14 : 11), { fs: G.fsT, fill: C.muted }));
        yyP += h3[j] + gp;
      }
    }
    out += SRC('Provisional precision estimates. Gallons: American Community Survey and federal fuel-economy data.', 'Provisional. ACS; fuel-economy data.');
    return out;
  }

  /* ================== v8 NEW: hol-gradient ================== */
  function drawHolGradient(L) {
    var cp = G.compact, p = L.p, o_ = 1 - (L.out || 0), out = '';
    var cn = D.counties;
    if (!cn || !(cn.rows || cn)) return msg('The county data is not loaded.');
    var allC = cn.rows || cn;
    var oh = (Array.isArray(allC) ? allC : []).filter(function (c) { return c.fips && c.fips.slice(0, 2) === '39'; });
    if (!oh.length) return msg('No Ohio counties found.');
    var RISE = 1.42, RELIEF = 0.27;
    var tt = title(cp ? 'Ohio’s counties: extra fuel cost and tax cut' : 'Ohio’s 88 counties, with and without the tax cut', 'Provisional'); out += tt.svg;
    var sub = N('Extra fuel cost of the price rise, % of a typical household’s monthly income.', G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false }); out += sub.svg;
    var ml = cp ? 44 : 60, mr = G.m + 4;
    var eMin = d3.min(oh, function (c) { return c.e; }), eMax = d3.max(oh, function (c) { return c.e; });
    var xr = [eMin - 0.05, eMax + 0.08], bMax = eMax * RISE;
    var x0 = G.m + ml, x1 = G.w - mr;
    var xs_ = d3.scaleLinear().domain(xr).range([x0, x1]);
    var axisH = 4 + G.fsT + 3 + 22, top0 = sub.box.y + sub.box.h + (cp ? 10 : 20), bot = G.h - G.m - axisH;
    var ys_ = d3.scaleLinear().domain([0, bMax + 0.15]).range([bot, top0]);
    var f = '';
    ys_.ticks(cp ? 4 : 6).forEach(function (v) { f += LN(x0, ys_(v), x1, ys_(v), { stroke: C.rule }) + T(v.toFixed(1) + '%', x0 - 7, ys_(v) + 4, { fs: G.fsT, fill: C.muted, anchor: 'end' }); });
    f += LN(x0, bot, x1, bot, { stroke: C.faint });
    xs_.ticks(cp ? 4 : 6).forEach(function (v) { f += LN(xs_(v), bot, xs_(v), bot + 4, { stroke: C.faint }) + T(v.toFixed(1), xs_(v), bot + 4 + G.fsT + 3, { fs: G.fsT, fill: C.muted, anchor: 'middle' }); });
    f += T('Cost of a $1 rise (% of monthly income)', (x0 + x1) / 2, bot + axisH - 2, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    out += f;
    var dropP = ramp(p, 0.25, 0.40);
    oh.forEach(function (c) {
      var ex = c.e, yBefore = ex * RISE, yAfter = ex * (RISE - RELIEF);
      var yNow = lerp(yBefore, yAfter, ease(dropP));
      var ab = ramp(p, 0.05, 0.20);
      if (ab <= 0.004) return;
      // v9.5 (DESIGN.md §Marks): outlined dots; these use the burden ramp so the fill stays strong enough to read
      if (window.ENGINE && window.ENGINE.reducedMotion && dropP > 0 && dropP < 1) {
        out += grp(ab * (1 - dropP), E('circle', { cx: r2(xs_(ex)), cy: r2(ys_(yBefore)), r: cp ? 3.4 : 4.5, fill: mix(C.burden, C.bg, 0.3), stroke: C.burdenDeep, 'stroke-width': 1.1 }));
        out += grp(ab * dropP, E('circle', { cx: r2(xs_(ex)), cy: r2(ys_(yAfter)), r: cp ? 3.4 : 4.5, fill: mix(C.burden, C.bg, 0.3), stroke: C.burdenDeep, 'stroke-width': 1.1 }));
      } else out += grp(ab, E('circle', { cx: r2(xs_(ex)), cy: r2(ys_(yNow)), r: cp ? 3.4 : 4.5, fill: mix(C.burden, C.bg, 0.3), stroke: C.burdenDeep, 'stroke-width': 1.1 }));
    });
    var lx0 = xs_(xr[0] + 0.02), lx1 = xs_(xr[1] - 0.02);
    out += grp(Math.max(ramp(p, 0.06, 0.18), 0.3), E('line', { x1: r2(lx0), y1: r2(ys_((xr[0] + 0.02) * RISE)), x2: r2(lx1), y2: r2(ys_((xr[1] - 0.02) * RISE)), stroke: C.muted, 'stroke-width': 1.4, 'stroke-dasharray': dropP > 0.5 ? '4 3' : null }));
    if (dropP > 0.1) out += grp(dropP, E('line', { x1: r2(lx0), y1: r2(ys_((xr[0] + 0.02) * (RISE - RELIEF))), x2: r2(lx1), y2: r2(ys_((xr[1] - 0.02) * (RISE - RELIEF))), stroke: C.accent, 'stroke-width': 1.8 }));
    var wLab = cp ? 'without the cut' : 'without the tax cut', aLab = cp ? 'with the cut' : 'with the tax cut';
    var midE = (eMin + eMax) / 2, midX = xs_(midE);
    // each line label sits on the open side of its line: above-left of the dashed line, below-right of the solid one
    out += grp(ann(L, 0.15, 0.24), N(wLab, midX - 4, ys_(midE * RISE) - 12 - Math.round(G.fsA * 1.33), cp ? 130 : 170, { anchor: 'end', fs: G.fsA, fill: C.muted, halo: true }).svg);
    if (dropP > 0.5) out += grp(dropP, N(aLab, midX + 8, ys_(midE * (RISE - RELIEF)) + 14, cp ? 110 : 150, { fs: G.fsA, fill: C.accent, wt: 600, halo: true }).svg);
    var adams = oh.find(function (c) { return c.fips === '39001'; });
    var delaw = oh.find(function (c) { return c.fips === '39041'; });
    if (adams) {
      var aSave = (adams.e * RELIEF).toFixed(1);
      // below the solid line, right-aligned to the plot edge, with a short leader up to the dot
      var aTxt = 'Adams County: saves ' + aSave + '% of income', aW = cp ? 112 : 130;
      var aBox = N(aTxt, x1, 0, aW, { anchor: 'end', fs: G.fsA, wt: 600 }).box;
      var aLineY = ys_(xs_.invert(aBox.x) * (RISE - RELIEF));
      out += grp(ann(L, 0.28, 0.40), CALL(aTxt, x1, aLineY + 14, aW, { x: xs_(adams.e), y: ys_(adams.e * (RISE - RELIEF)) }, { anchor: 'end', gap: 6, wt: 600, fill: C.accent, arrowCol: 'accent' }).svg);
    }
    if (delaw) {
      var dSave = (delaw.e * RELIEF).toFixed(1);
      out += grp(ann(L, 0.32, 0.44), CALL('Delaware County: ' + dSave + '%', xs_(delaw.e) + (cp ? 10 : 20), ys_(delaw.e * (RISE - RELIEF)) + (cp ? 10 : 16), cp ? 100 : 160, { x: xs_(delaw.e), y: ys_(delaw.e * (RISE - RELIEF)) }, { gap: 6, wt: 600, fill: C.accent, arrowCol: 'accent' }).svg);
    }
    out += SRC('EIA; American Community Survey. Rough estimate of the relief.', 'EIA; ACS. Rough estimate.');
    return out;
  }

  /* ================== v8 NEW: hol-question, hol-limits ================== */
  /* v9.3: stage 1 is one schematic (vote shift against the president's party) with its two lines and their labels; stage 2 adds the bracket and then
     makes room for a second row of the same schematic, "also measured against the governor's party". hol-limits holds the finished figure and adds one note. */
  function drawHolQuestion(L) {
    var cp = G.compact, lim = HQL[L.beat] || 0, p = lim ? 1 : L.p, o_ = 1 - (L.out || 0), out = '';
    var cn = D.counties;
    if (!cn || !(cn.rows || cn)) return msg('The county data is not loaded.');
    var allC = cn.rows || cn;
    var oh = (Array.isArray(allC) ? allC : []).filter(function (c) { return c.fips && c.fips.slice(0, 2) === '39'; });
    if (!oh.length) return msg('No Ohio counties found.');
    var eMin = d3.min(oh, function (c) { return c.e; }), eMax = d3.max(oh, function (c) { return c.e; });
    var tt = title(cp ? 'Ohio: does the relief’s slope differ?' : 'Ohio: if a cent of relief counts like a cent of price, or not', 'Illustrative'); out += tt.svg;
    var sub = N('Vote shift against the president’s party (points).', G.m, tt.bottom + 2, G.w - 2 * G.m, { fill: C.muted, fs: G.fsT + 0.5, halo: false }); out += sub.svg;
    var ml = cp ? 44 : 60, mr = G.m + (cp ? 10 : 30);
    var xr = [eMin - 0.05, eMax + 0.08], yr = cp ? [-3, 3] : [-4, 4];
    var x0 = G.m + ml, x1 = G.w - mr;
    var xs_ = d3.scaleLinear().domain(xr).range([x0, x1]);
    var axisH = 4 + G.fsT + 3 + 22, top0 = sub.box.y + sub.box.h + (cp ? 10 : 20), bot = G.h - G.m - axisH;
    // the second row: the first row shrinks upward over p 0.40-0.55 and the second fades in under its own heading over p 0.50-0.62
    var m2 = lim ? 1 : ramp(p, 0.40, 0.55), a2 = lim ? 1 : ramp(p, 0.50, 0.62) * o_;
    var hh2 = cp ? 22 : 28, gap2 = cp ? 10 : 14;                                  // the second row's heading, and the space above it
    var half = (bot - top0 - hh2 - gap2) / 2, bot1 = lerp(bot, top0 + half, m2), top2 = top0 + half + gap2 + hh2;
    var rows = [{ t: top0, b: bot1, a: 1 }];
    if (m2 > 0.001) rows.push({ t: top2, b: bot, a: a2 });
    var sl1 = 2.2, sl2 = 1.0, ic = 0, ex0 = xr[0] + 0.05, ex1 = xr[1] - 0.05, mid = (ex0 + ex1) / 2;
    var f = '';
    var yTicks = cp ? [-2, 0, 2] : [-4, -2, 0, 2, 4];
    rows.forEach(function (r, ri) {
      var ys_ = d3.scaleLinear().domain(yr).range([r.b, r.t]), s_ = '';
      yTicks.forEach(function (v) { s_ += LN(x0, ys_(v), x1, ys_(v), { stroke: v === 0 ? C.faint : C.rule, 'stroke-width': v === 0 ? 1.3 : 1 }) + T(v === 0 ? '0' : sgn(v, 0), x0 - 7, ys_(v) + 4, { fs: G.fsT, fill: C.muted, anchor: 'end' }); });
      f += grp(r.a, s_);
    });
    f += LN(x0, bot, x1, bot, { stroke: C.faint });
    xs_.ticks(cp ? 4 : 6).forEach(function (v) { f += LN(xs_(v), bot, xs_(v), bot + 4, { stroke: C.faint }) + T(v.toFixed(1), xs_(v), bot + 4 + G.fsT + 3, { fs: G.fsT, fill: C.muted, anchor: 'middle' }); });
    f += T('Cost of a $1 rise (% of monthly income)', (x0 + x1) / 2, bot + axisH - 2, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    out += f;
    // the two lines, in every row
    var a1 = ramp(p, 0.05, 0.22), hfs = G.fsA, lw = cp ? 230 : 190;
    rows.forEach(function (r, ri) {
      var ys_ = d3.scaleLinear().domain(yr).range([r.b, r.t]);
      var ln_ = E('line', { x1: r2(xs_(ex0)), y1: r2(ys_(ic + sl1 * (ex0 - mid))), x2: r2(xs_(ex1)), y2: r2(ys_(ic + sl1 * (ex1 - mid))), stroke: C.ink, 'stroke-width': 2 }) +
        E('line', { x1: r2(xs_(ex0)), y1: r2(ys_(ic + sl2 * (ex0 - mid))), x2: r2(xs_(ex1)), y2: r2(ys_(ic + sl2 * (ex1 - mid))), stroke: C.accent, 'stroke-width': 2, 'stroke-dasharray': '6 4' });
      out += grp(a1 * o_ * r.a, ln_);
      // the bracket between the lines at the right end ("what the relief's own slope measures"); in the first row it carries the label, in the second only the bracket
      var bx = xs_(ex1) - (cp ? 10 : 20), by1 = ys_(ic + sl1 * (ex1 - mid)), by2 = ys_(ic + sl2 * (ex1 - mid));
      var aBr = lim ? 1 : ramp(p, 0.25, 0.30);
      out += grp(aBr * o_ * r.a, E('path', { d: 'M' + r2(bx) + ',' + r2(by1) + ' h6 V' + r2(by2) + ' h-6', fill: 'none', stroke: C.accent, 'stroke-width': 1.6 }));
      if (ri === 0) {
        var yAt = function (sl, px) { return ys_(ic + sl * (xs_.invert(px) - mid)); };
        var aL1 = lim ? 1 : ramp(p, 0.18, 0.26), aL2 = lim ? 1 : ramp(p, 0.20, 0.28);
        // each label sits on the open side of its line (the lines rise to the right): the steep line's below-right of its left end,
        // the flat line's below-right of its right end (dropped until it clears the line at its own left edge)
        var l1 = N('if the relief counts for nothing', xs_(ex0) + 2, yAt(sl1, xs_(ex0)) + 10, lw, { fs: hfs, fill: C.ink, halo: true });
        out += grp(aL1 * o_, l1.svg);
        var hqLab2 = 'if a cent of relief counts like a cent of price', lx1_ = xs_(ex1);
        var l2 = N(hqLab2, lx1_ - 6, 0, lw, { anchor: 'end', fs: hfs, wt: 600, noClamp: true }).box;
        out += grp(aL2 * o_, N(hqLab2, lx1_ - 6, Math.max(by2 + 10, yAt(sl2, l2.x) + 10), lw, { anchor: 'end', fs: hfs, fill: C.accent, wt: 600, halo: true }).svg);
        var bw = cp ? 230 : 190, bl = N('what the relief’s own slope measures', x1, 0, bw, { anchor: 'end', fs: hfs, wt: 600, noClamp: true }).box;
        out += grp(aBr * o_ * (cp && !lim ? 1 - ramp(m2, 0, 0.35) : cp ? 0 : 1), N('what the relief’s own slope measures', x1, by1 - 14 - bl.h, bw, { anchor: 'end', fs: hfs, wt: 600, fill: C.accent, halo: true, noClamp: true }).svg);
      }
    });
    // the second row's heading (the first row's is the line under the title)
    if (a2 > 0.004) out += grp(a2, N(cp ? 'also against the governor’s party (points)' : 'also measured against the governor’s party (points)', G.m, top2 - hh2 - 1, G.w - 2 * G.m, { fs: G.fsT + 0.5, wt: 600, fill: C.ink, halo: false }).svg);
    if (lim) {
      var aNote = ann(L, 0.25, 0.38);
      out += grp(aNote, N('five states; their choice, not random', x0 + 6, top0 + (cp ? 6 : 14), x1 - x0 - 12, { fs: G.fsA + (cp ? 0.5 : 1.5), wt: 700, fill: C.accent, halo: false }).svg);
    }
    out += SRC('Illustrative: schematic lines.');
    return out;
  }


  var DRAW = {
    // v8 routed beats
    'simple-past': drawCrude, 'simple-past-2': drawCrude,
    'check-idea': drawPlacebo, 'check-chart': drawPlacebo,
    'fluke-intro': drawTest, 'fluke-reshuffle': drawTest, 'fluke-estimate': drawTest,
    'power-detect': drawPrec, 'power-rule-out': drawPrec, 'power-benchmark': drawBenchmark,
    'hol-prices': drawHolPrices, 'hol-gradient': drawHolGradient, 'hol-question': drawHolQuestion, 'hol-limits': drawHolQuestion,
    'report-ladder': drawReport, 'report-variants': drawReport, prereg: drawTimeline, when: drawTimeline, results: drawResults, 'results-past': drawResultsPast, 'results-senate': drawResultsSenate,
    // unrouted (kept for re-insertion)
    'placebo-idea': drawPlaceboIdea, 'holiday-measure': drawHolMeasure, 'holiday-split': drawHolSplit,
    'holiday-compare': drawHolCompare, 'holiday-limits': drawHolCompare,
    'past-estimates': function (L) { return drawForest(L, 'est'); }, 'past-estimates-2': function (L) { return drawForest(L, 'est'); },
    'past-estimates-3': function (L) { return drawForest(L, 'est'); }, 'past-estimates-4': function (L) { return drawForest(L, 'est'); },
    'test-why': drawTestWhy, 'report-past': function (L) { return drawForest(L, 'rpast'); }
  };

  /* ================== engine ================== */
  function isMine(id) { return !!id && MINE.indexOf(id) >= 0; }
  function alias(id) { if ((id === 'results' || id === 'results-past' || id === 'results-senate') && hasResults()) return id; return id === 'results' || id === 'about' ? 'when' : id; }   // results has its own figure when RESULTS is loaded; otherwise it and about hold the timeline of `when`
  /* the layers to draw for a scroll state: the current beat; related beats (FAM) share one layer that morphs by m,
     other neighbours cross-fade. p is quantised and held, so the same picture is not drawn twice. */
  function plan(s) {
    var id = s.id, nx = s.next, p = Math.round(clamp(s.p || 0, 0, 1) * 2000) / 2000, t = Math.round(clamp(s.t || 0, 0, 1) * 2000) / 2000, mc = isMine(id), mn = isMine(nx);
    if (!mc) return [{ beat: alias(nx), p: 0, a: ease(t), out: 0 }];   // hand-over from the dots: the chart comes in as the dots go out (t is linear; ease it here)
    var cur = alias(id), hold = HOLD[cur] || 0.46, pc = cur !== id ? hold : Math.min(p, hold), nb = mn ? alias(nx) : null;
    if (!nb && nx) return [{ beat: cur, p: pc, a: window.innerWidth < 900 && size()[0] < 520 && nx === 'scope' ? 1 - smooth(0.42, 0.5, t) : 1 - ease(t), out: window.innerWidth < 900 && size()[0] < 520 && nx === 'scope' ? 0 : smooth(0, 0.4, t) }];   // v9: the next beat belongs to another module (scope, state-layer): the chart goes out as that figure comes in
    if (!nb || nb === cur) return [{ beat: cur, p: pc, a: 1, out: 0 }];
    if (CRD[cur] != null && CRD[nb] != null) return [{ beat: cur, p: pc, a: 1, out: 0, to: nb, m: ease(t) }];
    if ((STAGE[cur] != null && STAGE[nb] != null) || (PST[cur] != null && PST[nb] != null) || (HQL[cur] != null && HQL[nb] != null)) return [{ beat: cur, p: pc, a: 1, out: 0 }];   // one figure over several beats: the held picture of this beat is the start of the next, so draw it once (no cross-fade)
    if (FAM[cur] && FAM[cur] === FAM[nb]) return [{ beat: cur, p: pc, a: 1, out: 0, to: nb, m: ease(t) }];
    if (size()[0] < 520) return t < 0.5 ? [{ beat: cur, p: pc, a: 1 - smooth(0.42, 0.5, t), out: 0 }] : [{ beat: nb, p: 0, a: smooth(0.5, 0.58, t), out: 0 }];
    return [{ beat: cur, p: pc, a: 1 - ease(t), out: smooth(0, 0.4, t) }, { beat: nb, p: 0, a: ease(t), out: 0 }];   // at t = 1 the next beat stands at p = 0, so nothing fades in again with p
  }
  /* the chart lives in a box of at most MAXW x MAXH, centred in the panel, so that arrows stay short and labels inside on wide screens;
     G.h is the usable height above the 22px source band, G.hh the whole box */
  function geom(w, h) {
    var bw = Math.min(w, MAXW), bh = Math.min(h, MAXH), cp = bw < 560 || bh < 500;   // a short panel (a tablet held upright) takes the tight layout too
    var sb = (typeof window.SLICE_BAND === 'number' && window.SLICE_BAND > 0) ? Math.round(window.SLICE_BAND) : 0;   // rounded as in the key of render(), so that one key is one picture
    // figure sizes come from THEME.figType (PI, 2026-10-30); G.fsT + 0.5 is the subtitle size
    return { W: w, H: h, ox: Math.round((w - bw) / 2), oy: Math.round((h - bh) / 2), w: bw, hh: bh, h: bh - BAND, compact: cp, phone: bw < 520, m: cp ? 14 : 28, top: (cp ? 10 : 24) + sb, fsA: cp ? 13 : 15, fsT: cp ? 13.5 : 15.5, fsTitle: window.THEME.figType.title[cp ? 1 : 0] };
  }
  function size() {
    var w = W, h = H;
    if (!w || !h) { var r = el.getBoundingClientRect(); w = r.width; h = r.height; }
    return [w || 600, h || 500];
  }
  var tipIdx = null, tipOff = false, tipOffIdx = null, rebuilding = false, thumbSpecs = null;     // which row's note is open; whether Escape closed it; whether the svg is being replaced; ladder thumbnails
  function paint(s) {
    var layers = plan(s);
    if (!layers.length) return;
    var sz = size();
    G = geom(sz[0], sz[1]); C = colors();
    btnSt = null; thumbSpecs = null;
    var out = '', srcs = [];
    layers.forEach(function (L) {
      if (L.a <= 0.004 || !DRAW[L.beat]) return;
      var inner = ''; srcNow = null;
      try { inner = DRAW[L.beat](L); } catch (e) { if (window.console) console.error('charts', L.beat, e); }
      if (isStandIn() && inner && (L.beat === 'report-ladder' || L.beat === 'report-variants' || L.beat === 'results' || L.beat === 'results-past' || L.beat === 'results-senate' || L.beat === 'power-benchmark')) inner = standInMark() + inner;
      out += grp(L.a, inner);
      if (srcNow) srcs.push({ c: srcNow, a: L.a });   // v7.2 [S12]: each figure's source line fades with its figure
    });
    out = defs() + E('svg', { 'class': 'ch-box', x: G.ox, y: G.oy, width: G.w, height: G.hh, overflow: 'visible' }, out);
    // a focused row keeps its focus (and its open note) when the picture is redrawn
    var af = document.activeElement, keep = af && svg.contains(af) && af.getAttribute && af.getAttribute('data-tip'), reopen = tip && tip.style.display === 'block' ? tipIdx : null;
    rebuilding = true;
    svg.setAttribute('width', G.W); svg.setAttribute('height', G.H); svg.setAttribute('viewBox', '0 0 ' + G.W + ' ' + G.H);
    svg.innerHTML = out;
    var box = svg.querySelector('.ch-box');
    if (box) srcs.forEach(function (q) {
      // one nested svg per source line, because the shell helper keeps one line per svg; the line takes its figure's alpha
      var sb = document.createElementNS('http://www.w3.org/2000/svg', 'svg'), a = Math.round(q.a * 1000) / 1000;
      sb.setAttribute('class', 'ch-src'); sb.setAttribute('width', G.w); sb.setAttribute('height', G.hh); sb.setAttribute('overflow', 'visible');
      box.appendChild(sb);
      if (q.c.wrap) srcWrap(sb, q.c.wrap);
      else if (typeof window.sourceLine === 'function') window.sourceLine(sb, q.c, G.w, G.hh, a);
      else srcFallback(sb, q.c);
      var t = sb.querySelector('.source-line'), own = t && (t.getAttribute('opacity') != null || t.style.opacity !== '');
      if (a < 0.999 && !own) sb.setAttribute('opacity', a);   // the shell helper did not take the alpha (older shell, or our own drawing): fade the wrapper instead
    });
    // ladder thumbnails: call window.SLICE.thumb on the live SVG after innerHTML
    if (thumbSpecs && thumbSpecs.length && window.SLICE && typeof window.SLICE.thumb === 'function') {
      thumbSpecs.forEach(function (ts) {
        try {
          var tg = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          if (ts.a < 0.996) tg.setAttribute('opacity', Math.round(ts.a * 1000) / 1000);
          svg.appendChild(tg);
          window.SLICE.thumb(tg, ts.stage, ts.x, ts.y, ts.w, ts.h);
        } catch (e_) {}
      });
    }
    svg.setAttribute('aria-label', LABELS[s.id] || LABELS[s.next] || '');
    hideTip();
    if (keep != null) {
      var nh = svg.querySelector('.ch-hit[data-tip="' + keep + '"]');
      if (nh) { try { nh.focus({ preventScroll: true }); } catch (e) { nh.focus(); } if (reopen != null && !tipOff) showTip(nh); }
    } else if (reopen != null && !tipOff) { var hh = svg.querySelector('.ch-hit[data-tip="' + reopen + '"]'); if (hh && hh.matches(':hover')) showTip(hh); }
    rebuilding = false;
    // the button
    var tl = layers.filter(function (L) { return L.beat === 'fluke-reshuffle' || L.beat === 'fluke-estimate'; })[0];
    if (btnSt && tl && btnSt.a > 0.01) {
      btn.style.display = 'block';
      btn.style.left = (btnSt.x + G.ox) + 'px'; btn.style.top = (btnSt.y + G.oy) + 'px'; btn.style.height = btnSt.h + 'px';
      btn.style.padding = btnSt.narrow ? '0 9px' : '';
      btn.style.fontSize = btnSt.fs + 'px'; btn.style.opacity = r2(btnSt.a * tl.a);
      btn.disabled = !btnSt.enabled; btn.style.pointerEvents = btnSt.enabled ? 'auto' : 'none';
    } else { btn.style.display = 'none'; }
  }
  /* hover, focus and tap notes (placebo rows; report-variants labels; the unrouted past-estimates rows) */
  function hideTip() { if (tip) tip.style.display = 'none'; }
  function showTip(hit) {
    var i = hit.getAttribute('data-tip'), d = TIPS[i];
    if (!d || !tip) return;
    if (tipOff) { if (tipOffIdx === i) return; tipOff = false; }   // Escape closes this note only: moving the focus to another row opens that row's note
    tipIdx = i;
    tip.innerHTML = '<b>' + esc(d.h) + '</b>' + esc(d.t);
    tip.style.display = 'block';
    var rr = root.getBoundingClientRect(), hr = hit.getBoundingClientRect(), tw_ = tip.offsetWidth, th_ = tip.offsetHeight;
    var left = clamp(hr.left - rr.left + hr.width * 0.55 - tw_ / 2, 8, Math.max(8, rr.width - tw_ - 8));
    var topY = hr.bottom - rr.top + 2;
    if (topY + th_ > rr.height - 8) topY = hr.top - rr.top - th_ - 2;
    tip.style.left = Math.round(left) + 'px'; tip.style.top = Math.round(Math.max(4, topY)) + 'px';
  }
  function hitOf(t) { return t && t.closest ? t.closest('.ch-hit') : null; }
  function render(s) {
    if (!root || !s) return;
    last = s;
    if (!tbtn) attachTextBtn();   // the beats may be built after init
    if (!isMine(s.id) && !isMine(s.next)) { root.style.display = 'none'; key = ''; return; }
    if (s.w && s.h) { W = s.w; H = s.h; }
    // the key is the quantised state that paint() draws, so one key is always one picture
    var sb = (typeof window.SLICE_BAND === 'number' && window.SLICE_BAND > 0) ? Math.round(window.SLICE_BAND) : 0;
    var L0 = plan(s), k = L0.map(function (L) { return [L.beat, L.p, L.a.toFixed(3), (L.out || 0).toFixed(3), L.m == null ? '' : L.m.toFixed(3)].join(':'); }).join('|') + '|' + W + '|' + H + '|' + sb + '|' + rev;
    if (k === key && !anim) { root.style.display = 'block'; return; }
    key = k; root.style.display = 'block';
    paint(s);
  }
  function repaint(force) { if (last) { if (!force) key = ''; paint(last); } }
  function resize(w, h) { if (w && h) { W = w; H = h; } key = ''; if (last) render(Object.assign({}, last, { w: W, h: H })); }

  /* v7.2 [S7]: the same reshuffle from a button in the text of `fluke-reshuffle`, which keyboard users can reach (the panel button stays).
     If the figure is not yet at its finished state, the button first moves the page there. A polite live line reports each result. */
  var tbtn = null, tstat = null;
  function attachTextBtn() {
    if (tbtn) return;
    var body = document.querySelector('#b-fluke-reshuffle .beat-body');
    if (!body) return;
    var wrap = document.createElement('div'); wrap.className = 'ch-tbtn-wrap';
    tbtn = document.createElement('button'); tbtn.type = 'button'; tbtn.className = 'ch-tbtn'; tbtn.textContent = 'Shuffle again';
    tstat = document.createElement('span'); tstat.className = 'ch-tstat'; tstat.setAttribute('aria-live', 'polite');
    wrap.appendChild(tbtn); wrap.appendChild(tstat);
    body.insertBefore(wrap, body.querySelector('details'));
    tbtn.addEventListener('click', function () {
      if (anim) return;
      if (!(last && last.id === 'fluke-reshuffle' && last.p >= MP.done) && typeof window.goToBeat === 'function') window.goToBeat('fluke-reshuffle', 0.78);
      requestAnimationFrame(function () { shuffleAgain(true); });
    });
  }
  function textStatus(v) {
    if (!tstat || !TEST) return;
    tstat.textContent = 'Your shuffle: ' + sgnPlus(v, 2) + '.';
  }
  function init(container, data) {
    el = container; D = data || {};
    if (D.hist && D.hist.pp10_per_beta) PTS = D.hist.pp10_per_beta;
    C = colors();
    // v8: delete aliases for beats this module now builds natively
    if (window.V8_ALIAS) ['simple-past','simple-past-2','check-idea','check-chart','fluke-intro','fluke-reshuffle','power-detect','power-rule-out','state-q-2','hol-prices'].forEach(function (k) { delete window.V8_ALIAS[k]; });
    if (!document.getElementById('ch-style')) {
      var st = document.createElement('style'); st.id = 'ch-style';
      st.textContent = css(); document.head.appendChild(st);
    }
    root = document.createElement('div'); root.className = 'ch-root'; root.style.display = 'none';
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('role', 'img');
    root.appendChild(svg);
    tip = document.createElement('div'); tip.className = 'ch-tip'; tip.setAttribute('role', 'tooltip'); root.appendChild(tip);
    ['mouseover', 'focusin'].forEach(function (ev) { svg.addEventListener(ev, function (e) { var h = hitOf(e.target); if (h) { if (!hitOf(e.relatedTarget) && !rebuilding) tipOff = false; showTip(h); } }); });
    ['mouseout', 'focusout'].forEach(function (ev) { svg.addEventListener(ev, function (e) { if (rebuilding) return; if (hitOf(e.target) && !hitOf(e.relatedTarget)) { hideTip(); tipOff = false; } }); });
    svg.addEventListener('click', function (e) { var h = hitOf(e.target); if (h) { if (tip.style.display === 'block') { tipOffIdx = h.getAttribute('data-tip'); hideTip(); tipOff = true; } else { tipOff = false; showTip(h); } } });
    // Escape closes the open note and leaves the keyboard focus where it is
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && tip && tip.style.display === 'block') { tipOffIdx = tipIdx; tipOff = true; hideTip(); } });
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'ch-btn'; btn.textContent = 'Shuffle again'; btn.style.display = 'none';
    btn.addEventListener('click', shuffleAgain);
    attachTextBtn();
    root.appendChild(btn);
    el.appendChild(root);
    if (!D.holiday_example && window.fetch) {   // the shell loads it; fetch it here if it is missing
      fetch('data/holiday_example.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j) { D.holiday_example = j; key = ''; if (last) render(last); } }, function () {});
    }
    // text widths are measured on a canvas, so every weight used here must be loaded before the wrapping is final; redraw when more faces arrive
    if (document.fonts) {
      var redraw = function () { key = ''; if (last) render(last); };
      if (document.fonts.load) Promise.all([400, 500, 600, 700].map(function (w) { return document.fonts.load(w + ' 13px "IBM Plex Sans"'); })).then(redraw, redraw);
      if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', redraw);
      if (document.fonts.ready) document.fonts.ready.then(redraw);
    }
  }
  function css() {
    var c = colors();
    return [
      '.ch-root{position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;pointer-events:none;font-family:' + FONT + ';color:' + c.ink + '}',
      '.ch-root>svg{position:absolute;left:0;top:0;display:block;font-family:' + FONT + ';font-variant-numeric:tabular-nums;-webkit-user-select:none;user-select:none}',
      '.ch-root svg text::selection,.ch-root button::selection{background:' + c.accentSoft + ';color:' + c.ink + '}',
      '.ch-root svg .ch-hit{pointer-events:all;fill:transparent;cursor:default;outline:none}',
      '.ch-root svg .ch-hit:hover,.ch-root svg .ch-hit:focus{fill:' + c.accentSoft + ';fill-opacity:.6}',
      '.ch-root svg .ch-hit:focus-visible{stroke:' + c.accent + ';stroke-width:1.5}',
      '.ch-tip{display:none;position:absolute;z-index:3;max-width:270px;padding:8px 11px;border:1px solid ' + c.rule + ';border-radius:2px;background:' + c.bg + ';color:' + c.ink + ';font-size:12.5px;line-height:1.4;pointer-events:none}',
      '.ch-tip b{display:block;font-weight:600;margin-bottom:2px}',
      '.ch-btn{position:absolute;pointer-events:auto;isolation:isolate;padding:0 22px;border:0;background:transparent;color:' + window.THEME.onAccent + ';font-family:inherit;font-weight:600;cursor:pointer;transition:color .15s ease-out;-webkit-tap-highlight-color:transparent}',
      '.ch-btn::before{content:"";position:absolute;z-index:-1;left:0;right:0;top:4px;bottom:4px;border:1px solid ' + c.accent + ';border-radius:2px;background:' + c.accent + ';transition:background-color .15s ease-out}',
      '@media (hover:hover){.ch-btn:hover:not(:disabled){color:' + c.accent + '}.ch-btn:hover:not(:disabled)::before{background:' + c.bg + '}}',
      '.ch-btn:active:not(:disabled)::before{background:' + c.accentSoft + '}',
      '.ch-btn:disabled{cursor:default;color:' + c.muted + '}',
      '.ch-btn:disabled::before{background:' + c.bg + ';border-color:' + c.rule + '}',
      '.ch-btn:focus-visible{outline:none}',
      '.ch-btn:focus-visible::before{outline:2px solid ' + c.accent + ';outline-offset:3px}',
      '.ch-tbtn-wrap{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin:1.1rem 0 .4rem}',
      '.ch-tbtn{min-height:44px;padding:0 18px;border:1px solid ' + c.accent + ';border-radius:2px;background:transparent;color:' + c.accent + ';font-family:' + FONT + ';font-size:15px;font-weight:600;cursor:pointer;transition:background-color .15s ease-out;-webkit-tap-highlight-color:transparent}',
      '@media (hover:hover){.ch-tbtn:hover{background:' + c.accentSoft + '}}',
      '.ch-tbtn:active{background:' + c.accentSoft + '}',
      '.ch-tbtn:focus-visible{outline:2px solid ' + c.accent + ';outline-offset:3px}',
      '.ch-tstat{font-family:' + FONT + ';font-size:14px;color:' + c.ink + ';font-variant-numeric:tabular-nums}'
    ].join('\n');
  }

  window.VIS.charts = { init: init, render: render, resize: resize };
})();
