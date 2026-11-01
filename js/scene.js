/* window.VIS.scene (v9): beats price-start, price-rise, price-relief, price-question, turn; v8-only beats remain unrouted below.
   Two pictures share one layer.
   - The time chart: the weekly EIA price line (real data only). In the time-* beats it shrinks to the top of the panel and an approval
     panel opens under it on the same time axis. The approval series is data/approval_sim.json
     (both: { simulated, label, source, points: [{date, v}], annotations: [{date, text}] }); panel title, source line and annotations come from the file.
   - The scatter: the five-midterms chart for time-midterms, ported from the v4 charts module (past-shortcut); unrouted in v8.
   render(state) is a pure function of the scroll state: every build is complete by p = 0.45 and then holds. Site-wide v6 pacing: the figure
   builds over p = 0.05-0.25 and the arrows and callout labels come in over p = 0.25-0.45. Lines are drawn on with p, annotations fade in with p
   and out with t, the two pictures cross-fade with t, and nothing runs on a timer.
   v8 changes from v7.2:
   - time-why-not: the bracket and "relief came in response to rising prices" label are removed (PI on version 12).
   - price-regions: all seven supply-region lines are drawn in their PADD_COLORS colour (none highlighted, none grey).
     No shaded windows, no values, no callouts. Region names at right ends on desktop; a compact key under the chart on phone.
     The approval panel fades out with the t of time-why-not. In the t of price-regions the lines fade out for the hand-over
     to the dots module, which fades county dots in at their map positions in matching region colours.
   v9: turn keeps the price-question chart and dims its national line, tip, start mark and heading over p = 0.05-0.25.
   Its scene layer fades during t into exposure; the v8 approval, midterms and region beats remain unrouted.
   v7.2 conventions still apply: figure titles with a muted subtitle line; second-stage labels fade over 0.07 of p;
   the source line fades with its figure; under reduced motion the large morphs are a cross-fade. */
(function () {
  'use strict';
  window.VIS = window.VIS || {};

  const NS = 'http://www.w3.org/2000/svg';
  const BEATS = ['price-start', 'price-rise', 'price-relief', 'price-question', 'turn', 'time-approval', 'time-why-not', 'time-midterms', 'price-regions'];
  const KEYS = ['1A', '1B', '1C', '2', '3', '4', '5'];
  const NAME = { '1A': 'New England', '1B': 'Central Atlantic', '1C': 'Lower Atlantic', '2': 'Midwest', '3': 'Gulf Coast', '4': 'Rocky Mountain', '5': 'West Coast' };
  const SHORT = { '1A': 'New Eng.', '1B': 'Mid-Atl.', '1C': 'Low. Atl.', '2': 'Midwest', '3': 'Gulf', '4': 'Rockies', '5': 'West' };
  const DAY = 864e5;
  const pd = s => +new Date(s + 'T00:00:00Z');
  const XA = pd('2024-10-07'), XB = pd('2026-11-06');   // the time axis leaves room for both election windows
  const L0 = pd('2024-10-14');                            // first week drawn: the start of the 2024 window
  const D0 = pd('2024-11-04'), DJAN = pd('2026-01-26'), DMAR = pd('2026-03-09');
  const W24 = [pd('2024-10-15'), pd('2024-11-04')], W26 = [pd('2026-10-13'), pd('2026-11-02')];   // the 21 days before each Election Day
  const WAR = [pd('2026-03-01'), pd('2026-04-15')];
  // relief measures (website/content_brief.md): the one array every relief marker is built from. A ring marks `date` on the line and `label`
  // is its text. `pos` is an optional layout hint (default 'ur'): the label sits up-left, up-right or down-right of the ring, where the line
  // leaves room ('dr' labels hang under the summer stretch of the line, at price level `at` (`atPhone`), on a leader that runs down from the ring).
  // 'sr' (v7.2) is for the two rings that sit almost on top of each other at the right end of the line: their labels stand one above the other in the
  // margin to the right of the line, on parallel leaders (the earlier date takes the upper label). `wmax` (optional) caps the label's wrap width in px.
  // To add or drop a measure, add or remove an entry here; nothing else needs to change.
  const RELIEF = [
    { date: pd('2026-03-11'), label: 'Mar 11: oil released from the Strategic Petroleum Reserve', pos: 'ul' },
    { date: pd('2026-04-30'), label: 'from Apr 30: EPA fuel waivers', pos: 'dr', at: 3.45, atPhone: 3.35 },
    { date: pd('2026-10-04'), label: 'Oct: state gas-tax cuts', labelPhone: 'gas-tax cuts', pos: 'sr' },
    { date: pd('2026-10-09'), label: 'Oct 9: diesel deal with Russia', labelPhone: 'diesel deal', pos: 'sr' }
  ];
  RELIEF.forEach(R => { R.pos = R.pos || 'ur'; });
  const DOTFADE = 14 * DAY;                               // a dot fades in over this long after the drawing reaches its date
  const LO_STACK = 2.5;                                   // floor of the squeezed price panel
  const APR = { lo: 38, hi: 48.5, grid: [40, 45] };       // approval axis, percent (refitted to the series in prepAppr)
  const SRC = {
    price: ['Source: U.S. Energy Information Administration, weekly retail gasoline prices (regular, all formulations).', 'Source: U.S. Energy Information Administration, weekly retail prices.', 'Source: U.S. EIA, weekly retail prices.']
  };
  const ARIA = {
    price: 'Weekly U.S. retail gasoline price from October 2024 to October 2026',
    regions: 'Weekly U.S. retail gasoline price from October 2024 to October 2026 by seven EIA supply regions',
    mid: 'Scatter plot of five midterm elections: average gas price against House seats won or lost by the president’s party, with a dashed fitted line'
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const ramp = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
  const smooth = (a, b, x) => { const t = ramp(x, a, b); return t * t * (3 - 2 * t); };
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // v9.3: the price line slows down as it nears the end of its draw (mostly ease-out, a little linear so that it never stalls)
  const slowEnd = x => x + 0.7 * x * x * (1 - x);   // starts at the old pace (slope 1), ends at 0.3 of it
  const TH = () => window.THEME || { bg: '#F7F3EC', ink: '#1E1B22', muted: '#5D5862', rule: '#D9D2C7', accent: '#0F6B66', accentSoft: '#D5E8E4', rep: '#B2423A', dem: '#2F5D9B' };
  const PC = () => window.PADD_COLORS || {};
  const PRICE = () => { const t = TH(); return (t.price && t.price[1]) || '#5E36C9'; };   // Two inks: violet
  // reduced motion: the shell publishes ENGINE.reducedMotion; matchMedia is the fallback
  const RM = () => window.ENGINE && typeof window.ENGINE.reducedMotion === 'boolean' ? window.ENGINE.reducedMotion : !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // v8: all seven regions in PADD_COLORS, none highlighted, none grey
  // figure headings: candidates from longest to shortest, the first that fits on one line is used
  const TITLE = ['Average price of regular gasoline, weekly', 'Regular gasoline, weekly'], SUB = ['U.S. average, dollars per gallon', 'Dollars per gallon'];
  const TITLE_R = ['Average price of regular gasoline, weekly, by supply region', 'Gasoline price by supply region, weekly'];
  const SUB_R = ['Dollars per gallon'];
  // the longest source-line candidate that fits one line at 12 px (window.sourceLine would otherwise settle for the first one that fits at 11 px)
  const srcFit = (cands, w) => { const c = cands.filter(Boolean); return [c.find(t => measureText(t, 12, 400) <= w - 24) || c[c.length - 1]]; };
  const money = v => '$' + v.toFixed(2);
  const fmtMonth = d => new Date(d).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });

  const S = { ready: false, host: null, data: null, w: 0, h: 0, ctx: null, apOk: false, apMeta: null, src: '', aria: '', midKey: '' };

  const svgEl = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k,
      k === 'stroke-width' && (tag === 'path' || tag === 'line') ? attrs[k] * TH().chartWeight / 2 : attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  /* ---------- data ---------- */
  function prep(data) {
    const e = data && data.eia;
    if (!e || !e.national || !e.padd) return false;
    const nat = e.national.filter(d => pd(d.date) >= L0);
    if (nat.length < 3) return false;
    S.dates = nat.map(d => pd(d.date));
    S.nat = nat.map(d => +d.p);
    const byDate = {};
    KEYS.forEach(k => { byDate[k] = {}; (e.padd[k] || []).forEach(d => { byDate[k][d.date] = +d.p; }); });
    S.reg = {};
    KEYS.forEach(k => { const arr = []; nat.forEach((d, i) => { arr.push(byDate[k][d.date] != null ? byDate[k][d.date] : (i ? arr[i - 1] : S.nat[i])); }); S.reg[k] = arr; });
    S.dLast = S.dates[S.dates.length - 1];
    S.pStart = priceAt(D0);
    S.pLast = S.nat[S.nat.length - 1];
    S.pJan = priceAt(DJAN);
    S.pMar = priceAt(DMAR);
    S.peak = S.nat.reduce((m, v, i) => v > m.v ? { v, d: S.dates[i] } : m, { v: -1, d: 0 });
    // the rise as the study measures it: average in the 2026 window minus average in the 2024 window (eia.json rise_window; so far one 2026 week)
    S.rise = {};
    const rw = e.rise_window || {}, r26 = e.rise && e.rise['2026'];
    KEYS.forEach(k => {
      S.rise[k] = rw[k] && rw[k].rise != null ? +rw[k].rise : r26 && r26[k] != null ? +r26[k] : S.reg[k][S.reg[k].length - 1] - priceAt(D0, S.reg[k]);
    });
    S.counties = (data.counties && data.counties.rows) || [];
    const pm = new Date(S.peak.d).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    ARIA.price = 'Line chart of the weekly U.S. retail gasoline price from October 2024 to October 2026: ' + money(S.pStart) + ' at Election Day 2024, a peak of ' + money(S.peak.v) + ' in ' + pm + ', and ' + money(S.pLast) + ' in the latest week';
    return true;
  }

  // the approval series (data/approval_sim.json: { simulated, label, source, points, annotations }); the chart works
  // without it (the panel then says the file is missing). A monthly series is drawn as dots (single polls), a weekly or denser one as a line.
  function prepAppr(j) {
    const rows = j && Array.isArray(j.points) ? j.points.filter(r => r && r.date && isFinite(+r.v) && pd(r.date) >= XA && pd(r.date) <= XB).sort((a, b) => pd(a.date) - pd(b.date)) : [];
    if (rows.length < 3) return false;
    S.aDates = rows.map(r => pd(r.date));
    S.aV = rows.map(r => +r.v);
    const gaps = S.aDates.slice(1).map((d, i) => (d - S.aDates[i]) / DAY).sort((a, b) => a - b);
    S.aDots = gaps[Math.floor(gaps.length / 2)] > 20;
    const ap = t => String(t).replace(/'/g, '’');   // figure text uses typographic apostrophes, also when the file has straight ones
    const sim = !!j.simulated, src = j.source ? ap(j.source) : sim ? 'Approval: illustrative, simulated.' : 'Approval: see the file’s source.';
    S.apMeta = {
      sim,
      label: j.label ? ap(j.label) : sim ? 'Illustrative: simulated approval of the president (%)' : 'Approval of the president (%)',
      src: ['Prices: U.S. Energy Information Administration. ' + src, 'Prices: U.S. EIA. ' + src, src].concat([src.split(/(?<=\.)\s/)[0], 'Prices: U.S. EIA. ' + src.split(',')[0] + '.', src.split(/[;,]/)[0] + '.']),   // last resorts on a narrow panel: the file's first sentence, then its first clause
      ann: (Array.isArray(j.annotations) ? j.annotations : []).filter(a => a && a.date && a.text && pd(a.date) >= S.aDates[0] && pd(a.date) <= S.aDates[S.aDates.length - 1]).slice(0, 4).map(a => ({ date: pd(a.date), text: ap(a.text) }))
    };
    // axis: whole 5s for the gridlines, a little room above and below the series
    const lo = Math.min.apply(null, S.aV), hi = Math.max.apply(null, S.aV);
    APR.lo = Math.floor((lo - 1.5) / 0.5) * 0.5; APR.hi = Math.ceil((hi + 1) / 0.5) * 0.5;
    APR.grid = [];
    for (let v = Math.ceil(APR.lo / 5) * 5; v < APR.hi; v += 5) if (v > APR.lo + 0.5) APR.grid.push(v);
    return true;
  }

  function priceAt(date, arr) {
    arr = arr || S.nat;
    const d = S.dates;
    if (date <= d[0]) return arr[0];
    for (let i = 1; i < d.length; i++) if (date <= d[i]) return lerp(arr[i - 1], arr[i], (date - d[i - 1]) / (d[i] - d[i - 1]));
    return arr[arr.length - 1];
  }

  /* ---------- text measuring and wrapping ---------- */
  function measureText(str, size, weight) {
    if (!S.ctx) S.ctx = document.createElement('canvas').getContext('2d');
    S.ctx.font = (weight || 400) + ' ' + size + 'px ' + ((window.THEME && window.THEME.fontLabelShort) || "'Barlow', 'IBM Plex Sans', system-ui, sans-serif");
    return S.ctx.measureText(str).width;
  }
  function wrap(str, size, maxW, weight) {
    const words = String(str).split(/\s+/), lines = [];
    let cur = '';
    words.forEach(w => {
      const t = cur ? cur + ' ' + w : w;
      if (cur && measureText(t, size, weight) > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function setLines(textEl, lines, x, y, lh, anchor) {
    while (textEl.firstChild) textEl.removeChild(textEl.firstChild);
    textEl.setAttribute('text-anchor', anchor || 'start');
    lines.forEach((ln, i) => {
      const t = svgEl('tspan', { x: x, y: y + i * lh });
      t.textContent = ln;
      textEl.appendChild(t);
    });
  }
  const widest = (lines, fs, wt) => Math.max.apply(null, lines.map(l => measureText(l, fs, wt)));

  /* ---------- structure ---------- */
  function build() {
    const c = TH(), host = S.host, pr = PRICE(), soft = mix(pr, c.bg, 0.82);   // the election windows are tinted with the price violet (the rise is the difference of their two averages)
    S.grey = mix(c.muted, c.bg, 0.5); S.greyMap = mix(c.muted, c.bg, 0.62);   // the light one keeps about 3.3:1 against the page
    host.textContent = '';
    S.layer = document.createElement('div'); S.layer.className = 'sc-layer'; host.appendChild(S.layer);
    const wrapDiv = () => { const d = document.createElement('div'); d.style.cssText = 'position:absolute;inset:0'; S.layer.appendChild(d); return d; };

    S.timeWrap = wrapDiv();
    S.map = document.createElement('canvas'); S.map.className = 'sc-map'; S.map.setAttribute('aria-hidden', 'true'); S.timeWrap.appendChild(S.map);
    S.mapCap = document.createElement('div'); S.mapCap.className = 'sc-cap'; S.mapCap.textContent = 'The seven supply regions'; S.timeWrap.appendChild(S.mapCap);
    const root = S.svg = svgEl('svg', { class: 'sc-svg', role: 'img', 'aria-label': ARIA.price }, S.timeWrap);
    const defs = svgEl('defs', null, root);
    const mk = svgEl('marker', { id: 'sc-arrow', viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 8, markerHeight: 8, markerUnits: 'userSpaceOnUse', orient: 'auto' }, defs);
    svgEl('path', { d: 'M1.5 1.5 L8.5 5 L1.5 8.5', fill: 'none', stroke: c.ink, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, mk);
    // the part of the 2026 window that lies after the last weekly price is hatched
    const hatch = svgEl('pattern', { id: 'sc-hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    svgEl('rect', { width: 6, height: 6, fill: soft, 'fill-opacity': 0.5 }, hatch);
    svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: pr, 'stroke-width': 1, 'stroke-opacity': 0.4 }, hatch);
    // the approval panel is uncovered from below as the price chart's floor moves up (render sets the rect's top)
    const clip = svgEl('clipPath', { id: 'sc-apclip' }, defs);
    S.apClip = svgEl('rect', { x: 0, y: 0, width: 1e4, height: 1e4 }, clip);
    // the price lines stop at the top of the plot (while the axis ceiling is still rising they would run up into the figure heading)
    const tclip = svgEl('clipPath', { id: 'sc-topclip' }, defs);
    S.topClip = svgEl('rect', { x: 0, y: 0, width: 1e4, height: 1e4 }, tclip);

    // everything but the source line (which window.sourceLine appends to the svg itself) lives in one group, so that a reduced-motion cross-fade can
    // fade the figure and its source line separately
    const svg = S.fig = svgEl('g', { class: 'sc-fig' }, root);
    S.gWin = svgEl('g', null, svg);
    S.w24 = svgEl('rect', { fill: soft }, S.gWin);
    S.w26a = svgEl('rect', { fill: soft }, S.gWin);
    S.w26b = svgEl('rect', { fill: 'url(#sc-hatch)' }, S.gWin);
    S.gWinLab = svgEl('g', null, svg);   // the window labels come in after the bands (second stage)
    S.w24Lab = svgEl('text', { fill: c.muted, 'font-size': 12, stroke: c.bg, 'stroke-width': 3, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, S.gWinLab); S.w24Lab.textContent = '2024 window';
    S.w26Lab = svgEl('text', { fill: c.muted, 'font-size': 12, 'text-anchor': 'end', stroke: c.bg, 'stroke-width': 3, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, S.gWinLab);
    S.warBand = svgEl('rect', { fill: c.rule, 'fill-opacity': 0.6 }, svg);

    S.gGrid = svgEl('g', null, svg);
    S.gAxis = svgEl('g', null, svg);
    S.gPTicks = svgEl('g', null, svg);
    S.pBase = svgEl('line', { stroke: c.muted, 'stroke-width': 1 }, svg);
    S.gAp = svgEl('g', { 'clip-path': 'url(#sc-apclip)' }, svg);
    // figure headings: a title and a muted subtitle at the top left; the price-regions pair replaces the price pair as the lines split
    const head = (t, st) => ({ t: svgEl('text', { fill: c.ink, 'font-weight': 600, 'data-fig-title': '1' }, svg), s: svgEl('text', { fill: c.muted, 'data-fig-sub': '1' }, svg), tt: t, st });
    S.head = head(TITLE, SUB); S.headR = head(TITLE_R, SUB_R);

    S.refLine = svgEl('line', { stroke: c.muted, 'stroke-width': 1, 'stroke-dasharray': '4 4' }, svg);
    S.refLab = svgEl('text', { fill: c.muted, 'font-size': 12 }, svg);

    S.regPaths = {};
    const pc = PC();
    KEYS.forEach(k => {
      S.regPaths[k] = svgEl('path', { fill: 'none', stroke: pc[k] || S.grey, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'clip-path': 'url(#sc-topclip)' }, svg);
    });
    S.natPath = svgEl('path', { fill: 'none', stroke: pr, 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'clip-path': 'url(#sc-topclip)' }, svg);
    // v8: in price-regions the national line becomes thin ink as it splits (render transitions it)
    S.apPath = svgEl('path', { fill: 'none', stroke: c.ink, 'stroke-width': 1.9, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'clip-path': 'url(#sc-apclip)' }, svg);
    // a monthly series: the line is solid between consecutive months and dashed across a missing month; the dots sit on top of it
    S.apGap = svgEl('path', { fill: 'none', stroke: c.ink, 'stroke-width': 1, 'stroke-dasharray': '3 4', 'stroke-linecap': 'round', 'clip-path': 'url(#sc-apclip)' }, svg);
    S.apDotG = svgEl('g', { 'clip-path': 'url(#sc-apclip)' }, svg);
    S.apMsg = svgEl('text', { fill: c.muted, 'font-size': 12, 'clip-path': 'url(#sc-apclip)' }, svg);
    S.apMsg.textContent = 'Approval series not loaded (data/approval_sim.json).';

    const arrow = parent => svgEl('path', { fill: 'none', stroke: c.ink, 'stroke-width': 1, 'marker-end': 'url(#sc-arrow)' }, parent);
    const label = (parent, fill) => svgEl('text', { fill: fill || c.ink, 'font-size': 13, 'font-weight': 500 }, parent);   // axis/data labels: Barlow 500, 13px per DESIGN.md

    S.startG = svgEl('g', null, svg);
    S.startGrp = svgEl('g', null, S.startG);
    S.startDot = svgEl('circle', { r: 5, fill: c.bg, stroke: c.ink, 'stroke-width': 1.5, cx: 0, cy: 0 }, S.startGrp);
    S.startArrow = arrow(S.startGrp);
    S.startLab = label(S.startGrp);
    S.shortStartGrp = svgEl('g', null, S.startG);
    S.shortStartArrow = arrow(S.shortStartGrp); S.shortStartLab = label(S.shortStartGrp);

    S.tip = svgEl('circle', { r: 4, fill: pr, stroke: c.bg, 'stroke-width': 1.5, 'clip-path': 'url(#sc-topclip)' }, svg);

    S.tipG = svgEl('g', null, svg);
    S.tipGrp = svgEl('g', null, S.tipG);
    S.tipArrow = arrow(S.tipGrp);
    S.tipLab = label(S.tipGrp);

    S.ann = {};
    ['A', 'B', 'C'].forEach(k => {
      const g = svgEl('g', null, svg), grp = svgEl('g', null, g);
      S.ann[k] = { g, grp, arrow: arrow(grp), text: label(grp) };
    });

    // price-regions: what the price rise is, in terms of the two windows
    S.winG = svgEl('g', null, svg);
    S.winText = label(S.winG); S.winText.setAttribute('stroke', c.bg); S.winText.setAttribute('stroke-width', 4); S.winText.setAttribute('paint-order', 'stroke'); S.winText.setAttribute('stroke-linejoin', 'round');

    // relief measures: a ring on the line, a thin leader and a compact label
    S.rel = RELIEF.map(() => {
      const g = svgEl('g', null, svg);
      return { g, lead: svgEl('path', { fill: 'none', stroke: c.ink, 'stroke-width': 1 }, g), ring: svgEl('circle', { r: 4.5, fill: c.bg, stroke: c.ink, 'stroke-width': 1.6 }, g), text: label(g) };
    });
    // time-why-not: one bracket under the four rings, with their shared label beneath it
    S.sharedG = svgEl('g', null, svg);
    S.sharedBr = svgEl('path', { fill: 'none', stroke: c.muted, 'stroke-width': 1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, S.sharedG);
    S.sharedText = label(S.sharedG);

    S.warG = svgEl('g', null, svg);
    S.warText = label(S.warG);

    // time-approval: the approval file's own annotations (a ring on the series, a short leader and a label); built per file in layout()
    S.paG = svgEl('g', null, svg);
    S.pa = [];
    S.gapG = svgEl('g', null, svg);   // v7.2 [2.2]: the muted note on the dashed stretch of the approval line (a missing month)
    S.gapOn = false;

    S.labG = svgEl('g', null, svg);
    S.labs = {};
    const pc2 = PC();
    KEYS.forEach(k => {
      const g = svgEl('g', null, S.labG), col = pc2[k] || c.muted;
      S.labs[k] = {
        g,
        leader: svgEl('path', { fill: 'none', stroke: col, 'stroke-width': 1 }, g),
        sw: svgEl('line', { stroke: col, 'stroke-width': 3, 'stroke-linecap': 'round' }, g),
        text: svgEl('text', { fill: c.ink, 'font-size': 13, 'font-weight': 400 }, g)
      };
    });
    // v8 phone: a compact key under the chart (an inline list of colour swatches and short names)
    S.phoneKeyG = svgEl('g', null, svg);

    // reduced motion: the outgoing layout of a morph is kept here as a copy of the svg, and fades out while the live svg fades in
    S.ghost = document.createElement('div'); S.ghost.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none'; S.ghost.setAttribute('aria-hidden', 'true');
    S.timeWrap.insertBefore(S.ghost, S.svg);

    S.midWrap = wrapDiv();
    S.mid = svgEl('svg', { class: 'sc-svg', role: 'img', 'aria-label': ARIA.mid }, S.midWrap);
  }

  /* ---------- layout (recomputed on resize) ---------- */
  function layout() {
    const w = S.w, h = S.h, c = TH();
    if (!w || !h) return;
    const phone = w < 560;
    const fs0 = phone ? 13 : Math.round(clamp(w / 120, 15, 17));   // labels grow a little on wide panels
    // v8: region labels show names only (no rise values); phone uses a compact key under the chart
    const labTxt = k => phone ? SHORT[k] : NAME[k];
    const labW = phone ? 0 : Math.max.apply(null, KEYS.map(k => measureText(labTxt(k), fs0, 400)));
    // mt leaves room for the figure heading (title and subtitle); tTop is the highest an annotation label may sit
    const L = S.L = { phone, short: phone && h < 230, ml: phone ? 48 : 52, mr: phone ? 92 : Math.ceil(labW + 34), mt: phone ? 52 : 74, mb: phone ? 46 : 52, fs: fs0, tTop: phone ? 50 : 68 };
    L.x0 = L.ml; L.x1 = w - L.mr; L.y0 = L.mt; L.y1 = h - L.mb;
    // stacked (time-* beats): the price chart keeps the top ~45% of the plot, with room above it for the war label; approval below
    L.room = phone ? 32 : 28;
    L.P1s = Math.round(L.y0 + 0.46 * (L.y1 - L.y0));
    // the approval panel's heading comes from the file's label: the part before the first comma is the title, the rest the muted subtitle
    // (a simulated series gets the boxed "Illustrative" tag at the top right, and its title leaves room for it)
    const aLabel = S.apMeta ? S.apMeta.label : 'Approval of the president (%)', comma = aLabel.indexOf(', ');
    let aT = comma > 0 ? aLabel.slice(0, comma) : aLabel; const aS = comma > 0 ? aLabel.slice(comma + 2) : '';
    if (S.apMeta && S.apMeta.sim) aT = aT.replace(/^Illustrative:\s*(\w)/i, (m, c1) => c1.toUpperCase());   // the tag says "Illustrative"; the title keeps the word simulated
    const FT = window.THEME.figType, tfs = L.tfs = FT.title[phone ? 1 : 0], sfs = L.sfs = FT.sub[phone ? 1 : 0], tagW = S.apMeta && S.apMeta.sim ? measureText('Illustrative', FT.tag[phone ? 1 : 0], 500) + 8 : 0;
    S.apTitleLines = wrap(aT, tfs, w - 24 - (tagW ? tagW + 8 : 0), 600);
    S.apSubLines = aS ? wrap(aS.charAt(0).toUpperCase() + aS.slice(1), sfs, w - 24, 400) : [];
    L.apT0 = L.P1s + (phone ? 22 : 28);   // baseline of the approval title's first line
    L.apS0 = L.apT0 + (S.apTitleLines.length - 1) * (tfs + 3) + sfs + 4;   // baseline of the first subtitle line
    L.A0 = (S.apSubLines.length ? L.apS0 + (S.apSubLines.length - 1) * (sfs + 3) : L.apT0 + (S.apTitleLines.length - 1) * (tfs + 3)) + (phone ? 12 : 14); L.A1 = L.y1;
    S.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);

    // the y axis starts at a fixed floor and its ceiling follows the scroll (see render), so each beat uses the chart's height
    let lo = Infinity;
    S.nat.forEach(v => { lo = Math.min(lo, v); });
    KEYS.forEach(k => S.reg[k].forEach(v => { lo = Math.min(lo, v); }));
    L.lo = Math.floor((lo - 0.1) * 2) / 2;
    L.X = d => lerp(L.x0, L.x1, (d - XA) / (XB - XA));
    S.px = S.dates.map(L.X);
    S.apx = S.apOk ? S.aDates.map(L.X) : [];

    // gridlines every 50 cents; their positions are set per frame
    S.gGrid.textContent = ''; S.grid = [];
    for (let v = L.lo; v <= 6.0001; v += 0.5) {
      const line = svgEl('line', { x1: L.x0, x2: L.x1, stroke: c.rule, 'stroke-width': 1 }, S.gGrid);
      const t = svgEl('text', { x: L.x0 - 8, 'text-anchor': 'end', fill: c.muted, 'font-size': L.phone ? 13 : 15 }, S.gGrid);
      t.textContent = '$' + v.toFixed(2);
      S.grid.push({ v, half: Math.abs(v - Math.round(v)) > 0.01, line, t });
    }
    // time axis (at the foot of the plot; in the stacked beats it belongs to the approval panel, and the price panel gets bare ticks)
    S.gAxis.textContent = ''; S.gPTicks.textContent = '';
    svgEl('line', { x1: L.x0, x2: L.x1, y1: L.y1, y2: L.y1, stroke: c.muted, 'stroke-width': 1 }, S.gAxis);
    const step = phone ? 6 : 3, startM = new Date(XA);
    let y = startM.getUTCFullYear(), m = startM.getUTCMonth(), guard = 0;
    while (guard++ < 40) {
      const d = Date.UTC(y, m, 1);
      if (d > XB) break;
      if (d > XA + 20 * DAY && m % step === 0) {
        const x = L.X(d);
        if (x < L.x1 - 14) {
          svgEl('line', { x1: x, x2: x, y1: L.y1, y2: L.y1 + 5, stroke: c.muted, 'stroke-width': 1 }, S.gAxis);
          svgEl('line', { x1: x, x2: x, y1: 0, y2: 4, stroke: c.muted, 'stroke-width': 1 }, S.gPTicks);
          const t = svgEl('text', { x: x, y: L.y1 + 20, 'text-anchor': 'middle', fill: c.muted, 'font-size': L.phone ? 13 : 15 }, S.gAxis);
          t.textContent = (m === 0) ? fmtMonth(d) + ' ' + (phone ? '’' + String(y).slice(2) : y) : fmtMonth(d);
        }
      }
      m++; if (m > 11) { m = 0; y++; }
    }
    S.pBase.setAttribute('x1', L.x0); S.pBase.setAttribute('x2', L.x1);
    // the figure heading: title (Barlow 600, ink) with a muted subtitle line under it; the regions pair is the same size
    [S.head, S.headR].forEach(hd => {
      hd.t.setAttribute('font-size', L.tfs); hd.s.setAttribute('font-size', L.sfs);
      const one = (c, sz, wt) => [c.find(t => measureText(t, sz, wt) <= w - 24) || c[c.length - 1]];
      setLines(hd.t, one(hd.tt, L.tfs, 600), 12, phone ? 19 : 27, L.tfs + 3, 'start');
      setLines(hd.s, one(hd.st, L.sfs, 400), 12, phone ? 37 : 52, L.sfs + 3, 'start');
    });
    S.src = '';

    // the two election windows; the 2026 window runs past the last weekly price, and that part is hatched
    const fsS = phone ? 13 : 15;
    L.w24 = [L.X(W24[0]), L.X(W24[1] + DAY)];
    L.w26 = [L.X(W26[0]), L.X(W26[1] + DAY)];
    const cut = clamp(L.X(S.dLast), L.w26[0], L.w26[1]);
    [[S.w24, L.w24[0], L.w24[1]], [S.w26a, L.w26[0], cut], [S.w26b, cut, L.w26[1]]].forEach(([r, a, b]) => { r.setAttribute('x', a.toFixed(1)); r.setAttribute('width', Math.max(0, b - a).toFixed(1)); });
    S.w24Lab.setAttribute('font-size', fsS); S.w26Lab.setAttribute('font-size', fsS);
    S.w24Lab.setAttribute('x', L.w24[0].toFixed(1));
    // the 2026 label breaks into two lines on a phone, so that it clears the 2024 label; drawTime moves it with a transform
    setLines(S.w26Lab, phone ? ['2026 window,', 'still open'] : ['2026 window, still open'], L.w26[1].toFixed(1), phone ? -(fsS + 3) : 0, fsS + 3, 'end');
    S.warBand.setAttribute('x', L.X(WAR[0]).toFixed(1)); S.warBand.setAttribute('width', (L.X(WAR[1]) - L.X(WAR[0])).toFixed(1));

    // approval panel: gridlines, labels, title (static; it fades in and out as a whole)
    S.gAp.textContent = '';
    const YA = L.YA = v => lerp(L.A1, L.A0, (v - APR.lo) / (APR.hi - APR.lo));
    APR.grid.forEach(v => {
      svgEl('line', { x1: L.x0, x2: L.x1, y1: YA(v), y2: YA(v), stroke: c.rule, 'stroke-width': 1 }, S.gAp);
      const t = svgEl('text', { x: L.x0 - 8, y: YA(v) + 4, 'text-anchor': 'end', fill: c.muted, 'font-size': L.phone ? 13 : 15 }, S.gAp);
      t.textContent = v + '%';
    });
    const apTitle = svgEl('text', { fill: c.ink, 'font-size': L.tfs, 'font-weight': 600 }, S.gAp);
    setLines(apTitle, S.apTitleLines, 12, L.apT0, L.tfs + 3, 'start');
    if (S.apSubLines.length) { const apSub = svgEl('text', { fill: c.muted, 'font-size': L.sfs }, S.gAp); setLines(apSub, S.apSubLines, 12, L.apS0, L.sfs + 3, 'start'); }
    if (S.apMeta && S.apMeta.sim) {   // Two inks: plain text, no box (Barlow 500, 12px)
      const ty = L.apT0;
      const tt = svgEl('text', { x: (w - 12).toFixed(1), y: ty.toFixed(1), 'text-anchor': 'end', fill: c.muted, 'font-size': window.THEME.figType.tag[L.phone ? 1 : 0], 'font-weight': 500, 'data-fig-tag': '1' }, S.gAp); tt.textContent = 'Illustrative';
    }
    // single polls (a monthly series) as dots, drawn above the joining line (S.apPath solid, S.apGap dashed)
    S.apDots = []; S.apDotG.textContent = '';
    if (S.apOk && S.aDots) S.aDates.forEach((d, i) => { S.apDots.push(svgEl('circle', { cx: S.apx[i].toFixed(1), cy: YA(S.aV[i]).toFixed(1), r: phone ? 3.5 : 4.5, fill: c.ink, stroke: c.bg, 'stroke-width': 1.2 }, S.apDotG)); });
    S.apMsg.setAttribute('x', L.x0 + 8); S.apMsg.setAttribute('y', L.A0 + 22);

    // annotations are built relative to the point they mark; render() clamps each label box into the panel and caps the arrow length
    const fs = L.fs, lh = fs + 3;
    S.refLine.setAttribute('x1', L.x0); S.refLine.setAttribute('x2', L.x1);
    S.refLab.setAttribute('font-size', fs);
    setLines(S.refLab, [money(S.pStart)], L.x1 + 8, 0, lh, 'start');
    L.hideRefOnPhone = phone;   // on phones the ref label is redundant with the start annotation and collides in the margin

    const item = (a, text, lines, x, y, anchor, arrow) => {
      text.setAttribute('font-size', fs);
      setLines(text, lines, x, y, lh, anchor);
      const tw = widest(lines, fs, 500);
      a.text = text; a.arrowEl = a.arrow; a.pts = arrow;
      a.box = { x0: anchor === 'end' ? x - tw : anchor === 'middle' ? x - tw / 2 : x, x1: anchor === 'end' ? x : anchor === 'middle' ? x + tw / 2 : x + tw, y0: y - fs, y1: y + (lines.length - 1) * lh + 4 };
      return a;
    };
    // A tall plot has a steeper local price path below the starting point;
    // On phones the starting price sits near the chart's floor; place the label above the dot so it clears the axis
    const sdy = phone ? -36 : S.h > 1100 ? 80 : 46;
    S.startItem = item({ grp: S.startGrp, arrow: S.startArrow }, S.startLab, phone ? ['Election Day 2024:', money(S.pStart)] : ['Election Day 2024: ' + money(S.pStart)], 8, sdy, 'start', [14, sdy < 0 ? sdy + lh + 4 : sdy - fs - 2, 2, sdy < 0 ? -6 : 8]);
    if (L.short) S.shortStartItem = item({ grp: S.shortStartGrp, arrow: S.shortStartArrow }, S.shortStartLab, ['2024 vote: ' + money(S.pStart)], 8, -18, 'start', [14, -10, 2, -6]);
    S.tipItem = item({ grp: S.tipGrp, arrow: S.tipArrow }, S.tipLab, ['January 2026:', money(S.pJan)], 40, -3, 'start', [35, 2, 9, 2]);
    const A = S.ann;
    item(A.A, A.A.text, ['War with Iran', 'disrupts supply'], -24, -54, 'end', [-28, -54 + lh + 4, -6, -5]);
    item(A.B, A.B.text, ['Peak: ' + money(S.peak.v)], 0, -40, 'middle', [0, -33, 0, -8]);
    // the end label sits in the right margin, past the 2026 window; the rise is the difference of the two prices as printed ($4.28 - $3.07)
    const cStr = money(S.pLast) + ', +' + money(Math.round(S.pLast * 100) / 100 - Math.round(S.pStart * 100) / 100) + ' since Election Day 2024', cdx = L.x1 - L.X(S.dLast) + 8;
    if (phone) item(A.C, A.C.text, wrap(cStr, fs, Math.max(70, S.w - L.x1 - 18), 500), cdx, 4, 'start', [cdx - 2, -2, 6, 3]);   // v9.4 QA: beside the end point, above the $3.07 label
    else item(A.C, A.C.text, wrap(cStr, fs, Math.max(70, S.w - L.x1 - 18), 500), cdx, 46, 'start', [cdx + 4, 46 - lh - 1, 3, 8]);


    // relief labels: wrapped to the room on their side of the pole
    L.relDx = phone ? 18 : 30; L.relDy = phone ? 34 : 48;   // how far the up-left and up-right labels sit from their ring
    L.tilt = phone ? 0.15 : 0.25;                             // 'dr' leader: sideways run per px of drop, enough to stay clear of the rise to its left
    L.srAngle = (phone ? 68 : 45) * Math.PI / 180;            // 'sr' leaders: the common direction (up and to the right) of the two parallel leaders (steep on a phone, where the margin is narrow)
    L.srL2 = phone ? 28 : 22;                                 // length of the shorter 'sr' leader (longer on phones to keep the lower label clear of the price line)
    S.rel.forEach((r, i) => {
      const R = RELIEF[i], x = L.X(R.date), lab = phone && R.labelPhone ? R.labelPhone : R.label;
      // the room on the label's side of its ring: 'ul' stays clear of the price labels, 'dr' hangs on a leader that tilts to the right, 'sr' stands in the right margin
      const room = R.pos === 'ul' ? x - L.relDx - L.x0 - 4 : R.pos === 'dr' ? w - 8 - (x + 8 + L.tilt * 0.5 * S.h) : R.pos === 'sr' ? w - 6 - (x + 36) : w - 8 - (x + L.relDx);
      r.lines = L.short && R.pos === 'ul' ? ['Mar 11: oil released', 'from the Strategic', 'Petroleum Reserve'] : wrap(lab, fs, Math.max(96, Math.min(R.wmax || (phone ? 180 : 250), room)), 500);
      r.text.setAttribute('font-size', fs);
      r.w = widest(r.lines, fs, 500);
    });
    // the two October labels: on phones they merge into one combined label on the later ring; on desktop they stack
    const sr = RELIEF.map((R, i) => i).filter(i => RELIEF[i].pos === 'sr').sort((a, b) => RELIEF[a].date - RELIEF[b].date);
    if (sr.length === 2) {
      const a = sr[0], b = sr[1], xb = L.X(RELIEF[b].date), ct = Math.cos(L.srAngle), st = Math.sin(L.srAngle);
      if (phone) {
        // one combined label: "gas-tax cuts, diesel deal" on the later ring's element
        const labA = RELIEF[a].labelPhone || RELIEF[a].label, labB = RELIEF[b].labelPhone || RELIEF[b].label;
        const combined = labA + ',\n' + labB;
        const room = w - 6 - (xb + L.srL2 * ct + 6);
        const rb = S.rel[b];
        rb.lines = wrap(combined, fs, Math.max(70, Math.min(180, room)), 500); rb.w = widest(rb.lines, fs, 500);
      } else {
        const xa = L.X(RELIEF[a].date);
        let roomA = w - 6 - (xa + 40);
        for (let it = 0; it < 4; it++) {
          const ra = S.rel[a], rb = S.rel[b];
          ra.lines = wrap(RELIEF[a].label, fs, Math.max(70, Math.min(250, roomA)), 500); ra.w = widest(ra.lines, fs, 500);
          rb.lines = wrap(RELIEF[b].label, fs, Math.max(70, Math.min(250, w - 6 - (xb + L.srL2 * ct + 6))), 500); rb.w = widest(rb.lines, fs, 500);
          const L1 = L.srL2 + ((ra.lines.length - 1) * lh + fs + 16) / st;
          roomA = w - 6 - (xa + L1 * ct + 4);
        }
      }
    }
    S.sharedText.setAttribute('font-size', fs);
    S.sharedLines = wrap('relief came in response to rising prices', fs, Math.max(100, Math.min(phone ? 160 : 280, w - 16)), 500);
    S.sharedW = widest(S.sharedLines, fs, 500);
    S.warText.setAttribute('font-size', fs);
    S.warLines = wrap('the war: moved prices, and perhaps approval directly', fs, Math.min(w - 16, phone ? 230 : 380), 500);
    S.warW = widest(S.warLines, fs, 500);
    layoutApprNotes(fs, lh);

    S.labFS = fs;
    KEYS.forEach(k => {
      const lab = S.labs[k];
      lab.text.setAttribute('font-size', S.labFS);
      lab.text.setAttribute('x', L.x1 + 22);
      lab.text.textContent = labTxt(k);
    });

    // v8 phone: compact key (coloured swatches with short names in two rows under the chart)
    S.phoneKeyG.textContent = '';
    if (phone) {
      const pc3 = PC(), kfs = 10, gap = 10, swR = 3.5, lh = kfs + 8;
      let cx = L.ml, cy = L.y1 + 34;   // below the time axis labels (at y1 + 20)
      KEYS.forEach(k => {
        const tw = measureText(SHORT[k], kfs, 400);
        if (cx + swR * 2 + 4 + tw > w - 12) { cx = L.ml; cy += lh; }
        svgEl('circle', { cx: cx + swR, cy: cy + swR, r: swR, fill: pc3[k] || c.muted }, S.phoneKeyG);
        const t = svgEl('text', { x: cx + swR * 2 + 4, y: cy + swR + kfs * 0.35, fill: c.ink, 'font-size': kfs }, S.phoneKeyG);
        t.textContent = SHORT[k];
        cx += swR * 2 + 4 + tw + gap;
      });
    }

    // locator map
    const mw = phone ? 118 : Math.round(clamp(w * 0.1, 176, 260)), mh = Math.round(mw * 610 / 975);
    S.mapBox = { x: Math.max(L.x0 + 10, L.w24[1] + 10), y: L.y0 + (phone ? 6 : 8), w: mw, h: mh };   // x: clear of the 2024 window band
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    S.map.style.left = S.mapBox.x + 'px'; S.map.style.top = S.mapBox.y + 'px';
    S.map.style.width = mw + 'px'; S.map.style.height = mh + 'px';
    S.map.width = Math.round(mw * dpr); S.map.height = Math.round(mh * dpr);
    S.mapCap.style.left = S.mapBox.x + 'px'; S.mapCap.style.top = (S.mapBox.y + mh + 2) + 'px';
    S.mapCap.style.fontSize = '12px';
    drawMap(mw, mh, dpr);
    // v8: no election windows or definition-of-rise text in price-regions; the axis ceiling is set to clear the highest line
    const top = 5.85;   // just above the highest line drawn (West Coast, about $5.73 in 2026)
    L.hiR = Math.max(6.0, top + 0.3);
    S.midKey = '';
  }

  // The approval file's annotations: a ring on the series, a short leader and a label beside it, on the side of the line that is free
  // (above-right of a falling stretch, below-right of a rising one); the box is kept inside the approval panel.
  function layoutApprNotes(fs, lh) {
    const L = S.L, w = S.w, c = TH();
    S.paG.textContent = ''; S.pa = []; S.gapG.textContent = ''; S.gapOn = false;
    if (!S.apOk || !S.apMeta) return;
    const vAt = d => {
      const t = S.aDates, v = S.aV;
      if (d <= t[0]) return v[0];
      for (let i = 1; i < t.length; i++) if (d <= t[i]) return lerp(v[i - 1], v[i], (d - t[i - 1]) / (t[i] - t[i - 1]));
      return v[v.length - 1];
    };
    const dx = L.phone ? 12 : 18, dy0 = L.phone ? 20 : 26, maxW = L.phone ? 130 : 240;
    // everything an annotation label must keep clear of: the data marks (dots, or points sampled along the line) and the labels already placed
    const marks = [];
    if (S.aDots) S.aDates.forEach((d, i) => marks.push({ x: L.X(d), y: L.YA(S.aV[i]), r: 6 }));
    for (let i = 1; i < S.aDates.length; i++) {
      const x0 = L.X(S.aDates[i - 1]), x1 = L.X(S.aDates[i]), y0 = L.YA(S.aV[i - 1]), y1 = L.YA(S.aV[i]), n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
      for (let k = 0; k <= n; k++) marks.push({ x: lerp(x0, x1, k / n), y: lerp(y0, y1, k / n), r: 2 });
    }
    S.apMeta.ann.forEach(a => marks.push({ x: L.X(a.date), y: L.YA(vAt(a.date)), r: 7 }));   // every ring is a mark too
    const boxes = [];
    // the leader from the label's edge (ex, ey) to the ring (x, y), sampled, the last 9 px before the ring left out
    const leaderPts = (ex, ey, x, y) => { const d = Math.hypot(x - ex, y - ey), n = Math.max(1, Math.floor((d - 9) / 5)), o = []; for (let k = 0; k <= n; k++) o.push({ x: lerp(ex, x, k * 5 / d), y: lerp(ey, y, k * 5 / d), r: 1 }); return o; };
    let x0 = 0, y0 = 0;   // the ring being placed (its own mark does not count against its leader)
    const hits = (b, pad, lp) => marks.reduce((n, m) => n + (m.x + m.r + pad > b.x0 && m.x - m.r - pad < b.x1 && m.y + m.r + pad > b.y0 && m.y - m.r - pad < b.y1 ? 1 : 0), 0)
      + 100 * boxes.reduce((n, o) => n + (o.x0 - 8 < b.x1 && o.x1 + 8 > b.x0 && o.y0 - 6 < b.y1 && o.y1 + 6 > b.y0 ? 1 : 0), 0)   // a label over another label is far worse than one over a mark
      + (lp || []).reduce((n, q) => n + (boxes.some(o => q.x > o.x0 - 3 && q.x < o.x1 + 3 && q.y > o.y0 - 3 && q.y < o.y1 + 3) ? 1 : 0)
        + (marks.some(m => Math.hypot(m.x - q.x, m.y - q.y) < m.r + 3 && Math.hypot(m.x - x0, m.y - y0) > 1) ? 1 : 0), 0);
    // v7.2 [2.2]: the dashes across a missing month say so, in a short muted note beside the dashed stretch (placed first, so that the file's annotations keep clear of it)
    if (S.aDots) for (let i = 1; i < S.aDates.length; i++) {
      if (S.aDates[i] - S.aDates[i - 1] <= 45 * DAY) continue;
      const ma = new Date(S.aDates[i - 1]), mb = new Date(S.aDates[i]), names = [];
      for (let y = ma.getUTCFullYear(), m = ma.getUTCMonth() + 1; y * 12 + m < mb.getUTCFullYear() * 12 + mb.getUTCMonth(); m++) { if (m > 11) { m = 0; y++; } names.push(new Date(Date.UTC(y, m, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })); }
      if (!names.length) continue;
      const txt = 'dashed: no value for ' + names.join(' and '), gfs = Math.max(12, fs - 1), tw = measureText(txt, gfs, 400), bhh = gfs;
      const sx = L.X(S.aDates[i - 1]), sy = L.YA(S.aV[i - 1]), ex = L.X(S.aDates[i]), ey = L.YA(S.aV[i]), mx = (sx + ex) / 2, my = (sy + ey) / 2;
      x0 = -1e3; y0 = -1e3;
      let best = null;
      // the nearest free spot to the middle of the dashed stretch: above or below it, sliding sideways
      [-1, 1].forEach(v => [8, 12, 18, 26].forEach(d => { for (let fx = -1.5; fx <= 1.5; fx += 0.1) {
        const cx = clamp(mx + fx * tw, L.x0 + 4 + tw / 2, w - 6 - tw / 2), top = v < 0 ? my - d - bhh : my + d;
        if (top < L.A0 - 2 || top + bhh > L.A1 - 4) continue;
        const box = { x0: cx - tw / 2, x1: cx + tw / 2, y0: top - 1, y1: top + bhh + 3 }, n = hits(box, 3, null), score = n * 1000 + Math.hypot(cx - mx, top + bhh / 2 - my);
        if (!best || score < best.score) best = { score, box, cx, top };
      } }));
      if (!best) continue;
      boxes.push(best.box);
      const g = svgEl('text', { fill: c.muted, 'font-size': gfs, 'text-anchor': 'middle', stroke: c.bg, 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, S.gapG);
      setLines(g, [txt], best.cx, best.top + gfs * 0.82, gfs + 3, 'middle');
      S.gapOn = true;
    }
    S.apMeta.ann.forEach(a => {
      const x = L.X(a.date), y = L.YA(vAt(a.date));
      const falling = vAt(a.date + 25 * DAY) - vAt(a.date - 25 * DAY) < 0;
      x0 = x; y0 = y;
      // Search for the nearest free spot for the label: above or below the ring (above a falling line, below a rising one is slightly preferred),
      // at growing distances and sideways offsets, first at the full wrap width and then narrower; the spot must lie inside the panel and touch no
      // mark, ring, leader or label. If nothing is free, the least crowded spot wins.
      let best = null;
      [maxW, maxW * 0.7].forEach((mw, wi) => {
        if (best && best.n === 0) return;
        const lines = wrap(a.text, fs, mw, 500), tw = widest(lines, fs, 500), bh = (lines.length - 1) * lh + fs;
        [-1, 1].forEach(v => [1, 1.4, 1.8, 2.3, 3, 3.8].forEach(m => {
          const top = v < 0 ? y - dy0 * m - bh : y + dy0 * m;
          if (top < L.A0 - 2 || top + bh > L.A1 - 4) return;
          for (let off = -tw - 130; off <= 130; off += 10) {
            const bx = x + off;
            if (bx < L.x0 + 4 || bx + tw > w - 6) continue;   // clear of the axis labels
            const box = { x0: bx, x1: bx + tw, y0: top - fs * 0.1, y1: top + bh + 3 }, ex = clamp(x, bx + 3, bx + tw - 3), ey = v < 0 ? top + bh + 4 : top - 3;
            const n = hits(box, 3, leaderPts(ex, ey, x, y)), score = n * 1000 + Math.hypot((bx + tw / 2) - x, (top + bh / 2) - y) + wi * 25 + ((v < 0) === falling ? 0 : 8);
            if (!best || score < best.score) best = { n, score, bx, top, v, lines, tw, bh, box, ex, ey };
          }
        }));
      });
      if (!best) {   // panel too small for any spot: above the ring, clamped into the panel
        const lines = wrap(a.text, fs, maxW, 500), tw = widest(lines, fs, 500), bh = (lines.length - 1) * lh + fs, bx = clamp(x + dx, L.x0 + 4, w - 6 - tw), top = clamp(y - dy0 - bh, L.A0 - 2, L.A1 - 4 - bh);
        best = { n: 1, bx, top, v: -1, lines, tw, bh, box: { x0: bx, x1: bx + tw, y0: top, y1: top + bh + 3 }, ex: clamp(x, bx + 3, bx + tw - 3), ey: top + bh + 4 };
      }
      boxes.push(best.box);
      const bx = best.bx, top = best.top;
      leaderPts(best.ex, best.ey, x, y).forEach(q => marks.push(q));
      const g = svgEl('g', null, S.paG);
      const ld = svgEl('path', { fill: 'none', stroke: c.ink, 'stroke-width': 1 }, g);
      const ring = svgEl('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 4.5, fill: c.bg, stroke: c.ink, 'stroke-width': 1.6 }, g);
      const t = svgEl('text', { fill: c.ink, 'font-size': fs, 'font-weight': 500, stroke: c.bg, 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, g);   // a halo keeps it readable over a gridline
      setLines(t, best.lines, bx, top + fs * 0.92, lh, 'start');
      lead(ld, best.ex, best.ey, x, y);
      S.pa.push({ g });
    });
  }

  function drawMap(mw, mh, dpr) {
    if (!window.d3 || !S.counties.length) return;
    const ctx = S.map.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, mw, mh);
    const proj = d3.geoAlbersUsa().scale(1280 * Math.min(mw / 975, mh / 610)).translate([mw / 2, mh / 2]);
    const r = Math.max(0.9, mw / 150);
    const by = {};
    S.counties.forEach(cn => {
      const q = proj([cn.lon, cn.lat]); if (!q) return;
      (by[cn.padd] = by[cn.padd] || []).push(q);
    });
    // v8: all regions in their PADD_COLORS colour on the locator map
    const pcc = PC();
    KEYS.forEach(k => {
      ctx.fillStyle = pcc[k] || S.greyMap;
      (by[k] || []).forEach(q => { ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 6.2832); ctx.fill(); });
    });
  }

  /* ---------- drawing helpers ---------- */
  function pathTo(dateEnd, yAt, d, xs) {
    d = d || S.dates; xs = xs || S.px;
    const n = d.length;
    let k = 0;
    while (k + 1 < n && d[k + 1] <= dateEnd) k++;
    const parts = [];
    for (let i = 0; i <= k; i++) parts.push((i ? 'L' : 'M') + xs[i].toFixed(1) + ' ' + yAt(i).toFixed(1));
    let ex = xs[k], ey = yAt(k);
    if (k + 1 < n && dateEnd > d[k]) {
      const f = (dateEnd - d[k]) / (d[k + 1] - d[k]);
      ex = lerp(xs[k], xs[k + 1], f); ey = lerp(yAt(k), yAt(k + 1), f);
      parts.push('L' + ex.toFixed(1) + ' ' + ey.toFixed(1));
    }
    return { d: parts.join(''), x: ex, y: ey };
  }

  function dodge(items, gap, lo, hi) {
    items.sort((a, b) => a.y - b.y);
    for (let i = 1; i < items.length; i++) if (items[i].y < items[i - 1].y + gap) items[i].y = items[i - 1].y + gap;
    const over = items.length ? items[items.length - 1].y - hi : 0;
    if (over > 0) { items[items.length - 1].y -= over; for (let i = items.length - 2; i >= 0; i--) if (items[i].y > items[i + 1].y - gap) items[i].y = items[i + 1].y - gap; }
    if (items.length && items[0].y < lo) { const sh = lo - items[0].y; items.forEach(it => { it.y += sh; }); }
    return items;
  }

  const op = (e, v) => { e.setAttribute('opacity', v.toFixed(3)); e.style.display = v < 0.004 ? 'none' : ''; };
  const at = (g, x, y) => g.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
  const rectY = (e, y0, y1) => { e.setAttribute('y', y0.toFixed(1)); e.setAttribute('height', Math.max(0, y1 - y0).toFixed(1)); };

  // Put an annotation at the data point (x, y): the label box is clamped inside the panel (clear of the title line and the source band),
  // and the arrow runs from the label's edge to the point, never longer than ARROW_MAX px.
  const ARROW_MAX = 40;
  function place(a, x, y) {
    const w = S.w, h = S.h, b = a.box, pad = 6, top = S.L.tTop, bot = h - 26;   // top: clear of the figure heading
    let dx = 0, dy = 0;
    if (x + b.x0 < pad) dx = pad - (x + b.x0); else if (x + b.x1 > w - pad) dx = w - pad - (x + b.x1);
    if (y + b.y0 < top) dy = top - (y + b.y0); else if (y + b.y1 > bot) dy = bot - (y + b.y1);
    a.text.setAttribute('transform', dx || dy ? 'translate(' + dx.toFixed(1) + ' ' + dy.toFixed(1) + ')' : '');
    let sx = a.pts[0] + dx, sy = a.pts[1] + dy;
    const ex = a.pts[2], ey = a.pts[3], len = Math.hypot(sx - ex, sy - ey);
    if (len > ARROW_MAX) { sx = ex + (sx - ex) * ARROW_MAX / len; sy = ey + (sy - ey) * ARROW_MAX / len; }
    a.arrow.setAttribute('d', 'M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ' L' + ex + ' ' + ey);
    at(a.grp, x, y);
  }

  /* ---------- the time chart: what each beat shows ---------- */
  // f.k opens the approval panel (0: price chart at full height, 1: stacked); tn is the eased transition toward the next beat,
  // which fades the beat's own annotations.
  function phase(id, p, tn) {
    const keep = 1 - tn;
    const HI = S.L && S.L.phone ? 5.4 : 5.0;   // v9.4 QA: a phone's axis ceiling leaves room above the October rings for their two stacked labels
    const f = { dateEnd: S.dLast, hi: HI, k: 0, win: 0, winLab: 0, startMark: 0, ref: 0, tipLab: 0, aA: 0, aB: 0, aC: 0,
      shortStart: 0, rel: 0, relLab: [], shared: 0, war: 0, warLab: 0, appr: 0, apprEnd: Infinity, pa: [], gap: 0, head: 1, s: 0, lab: 0, map: 0, dim: 0 };
    // v6 pacing: the figure builds over p = 0.05-0.25; its arrows and callout labels come in over p = 0.25-0.45.
    // v7.2 [S13]: each label fades over 0.07 of p (not 0.11-0.20), so that its half-transparent state is brief; staggered labels keep their order
    if (id === 'price-start') {
      f.dateEnd = lerp(S.dates[0], DJAN, slowEnd(ramp(p, 0.05, 0.25)));
      f.hi = 3.6;
      f.head = smooth(0, 0.08, p);   // the heading comes in as the panel pins, so that it does not print over the title page's last lines
      f.startMark = smooth(0.25, 0.32, p);
      f.tipLab = smooth(0.32, 0.39, p) * keep;
    } else if (id === 'price-rise') {
      const u = slowEnd(ramp(p, 0.05, 0.25));
      f.dateEnd = lerp(DJAN, S.dLast, u);
      f.hi = lerp(3.6, HI, u);   // the axis ceiling follows the line's date progress (no second smoothstep)
      f.startMark = 1; f.ref = smooth(0.05, 0.15, p);
      f.aA = smooth(0.25, 0.32, p) * keep;
      f.aB = smooth(0.31, 0.38, p) * keep;
      f.aC = smooth(0.37, 0.44, p) * keep;
    } else if (id === 'price-relief') {
      f.shortStart = smooth(0.05, 0.12, p);
      f.startMark = 1; f.ref = 1 - smooth(0, 0.10, p);
      f.rel = smooth(0.05, 0.20, p);
      const n = RELIEF.length, step = n > 1 ? 0.09 / (n - 1) : 0;
      f.relLab = RELIEF.map((R, i) => smooth(0.25 + step * i, 0.32 + step * i, p));
    } else if (id === 'price-question') {
      f.shortStart = keep;
      f.startMark = 1;
      f.rel = keep; f.relLab = RELIEF.map(() => 1);   // the group carries keep; labels stay at full opacity inside it (no squared fade)
    } else if (id === 'turn') {
      f.startMark = 1;
      f.dim = smooth(0.05, 0.25, p);
    } else if (id === 'time-approval') {
      const out = 1 - smooth(0, 0.12, p);
      f.startMark = out;
      f.k = smooth(0.05, 0.15, p);
      f.appr = 1;
      f.apprEnd = S.apOk ? lerp(S.aDates[0], S.aDates[S.aDates.length - 1] + DOTFADE, ramp(p, 0.10, 0.25)) : 0;   // runs DOTFADE past the last point so that it is fully shown
      const n = S.pa.length, step = n > 1 ? 0.08 / (n - 1) : 0;
      f.pa = S.pa.map((_, i) => smooth(0.27 + step * i, 0.34 + step * i, p) * keep);   // after the approval series has been drawn
      f.gap = smooth(0.25, 0.32, p);   // what the dashes mean; it stays in time-why-not
    } else if (id === 'time-why-not') {
      f.k = 1; f.appr = 1; f.gap = 1;
      f.war = smooth(0.05, 0.17, p) * keep;
      f.rel = smooth(0.10, 0.22, p) * keep;
      f.warLab = smooth(0.25, 0.32, p) * keep;
      // v8: the bracket and "relief came in response to rising prices" label are removed (PI on version 12)
    } else if (id === 'price-regions') {
      f.appr = 1 - smooth(0.0, 0.07, p);
      f.k = 1 - smooth(0.02, 0.14, p);
      f.s = smooth(0.05, 0.30, p);            // v8: the split is stage 1 (p 0.05-0.30)
      f.hi = lerp(HI, S.L.hiR, f.s);
      f.map = smooth(0.14, 0.25, p);
      // v8: no windows, no window labels, no rise text
      f.lab = smooth(0.25, 0.32, p);           // region names at the right ends
    }
    return f;
  }

  function drawTime(f) {
    const L = S.L, k = f.k, s = f.s, hi = f.hi;
    const P0 = L.y0 + k * L.room, P1 = lerp(L.y1, L.P1s, k), lo = lerp(L.lo, LO_STACK, k);
    const Y = v => lerp(P1, P0, (v - lo) / (hi - lo)), YA = L.YA;
    const mode = k >= 0.5 ? 'stack' : 'price', aria = k >= 0.5 ? 'stack' : s > 0.5 ? 'regions' : 'price';
    // v7.2 [S12]: the source line belongs to its figure. Where the chart changes layout the old text fades out
    // and the new text fades in around the layout's midpoint
    const srcA = ramp(Math.abs(k - 0.5), 0, 0.2);
    if (mode !== S.src || Math.abs(srcA - S.srcA) > 0.004) {
      S.src = mode; S.srcA = srcA;
      const am = S.apMeta;
      if (typeof window.sourceLine === 'function') window.sourceLine(S.svg, srcFit(mode === 'stack' ? (am ? am.src : ['Prices: U.S. EIA. Approval series not loaded.']) : SRC.price, S.w), S.w, S.h, srcA);
    }
    // the figure heading: the regions pair takes over from the price pair as the national line splits
    op(S.head.t, f.head * (1 - smooth(0, 0.4, s)) * (1 - 0.55 * f.dim)); op(S.head.s, f.head * (1 - smooth(0, 0.4, s)) * (1 - 0.55 * f.dim));
    op(S.headR.t, smooth(0.6, 1, s)); op(S.headR.s, smooth(0.6, 1, s));
    if (aria !== S.aria) {
      S.aria = aria;
      S.svg.setAttribute('aria-label', aria === 'stack'
        ? 'Two charts on one time axis: the weekly U.S. gasoline price (EIA) above, and the ' + (S.apMeta && S.apMeta.sim ? 'simulated ' : '') + 'approval rating of the president below'
        : ARIA[aria]);
    }

    S.grid.forEach(g => {
      const a = clamp((hi - g.v) / 0.1, 0, 1), y = Y(g.v);
      g.line.setAttribute('y1', y.toFixed(1)); g.line.setAttribute('y2', y.toFixed(1));
      g.t.setAttribute('y', (y + 4).toFixed(1));
      const vis = a * clamp((g.v - lo) / 0.15, 0, 1);   // the floor is the axis line itself; a gridline the moving floor reaches fades out
      g.line.setAttribute('opacity', vis.toFixed(3));
      g.t.setAttribute('opacity', (vis * (L.phone && g.half ? 0 : 1)).toFixed(3));   // phones: whole dollars only (the half-dollar labels crowd the short axis)
    });
    // the price panel's own floor and ticks, once it has moved up off the time axis
    S.pBase.setAttribute('y1', P1.toFixed(1)); S.pBase.setAttribute('y2', P1.toFixed(1));
    op(S.pBase, k > 0.004 ? 1 : 0);
    at(S.gPTicks, 0, P1); op(S.gPTicks, k);

    // the two election windows (price-regions only): bands first, then their labels and the definition of the rise
    op(S.gWin, f.win); op(S.gWinLab, f.winLab); op(S.winG, f.winLab);
    if (f.win > 0.004) [S.w24, S.w26a, S.w26b].forEach(r => rectY(r, P0, P1));
    if (f.winLab > 0.004) { S.w24Lab.setAttribute('y', (P1 - 7).toFixed(1)); at(S.w26Lab, 0, P1 - 7); }
    // the war band runs across both panels
    op(S.warBand, f.war);
    if (f.war > 0.004) rectY(S.warBand, P0, L.A1);

    // approval panel: a line for a weekly series, the dots appearing in date order for a monthly one
    const ao = f.appr * smooth(0.3, 0.9, k);
    S.apClip.setAttribute('y', (P1 + 6).toFixed(1));
    S.topClip.setAttribute('y', (P0 - 3).toFixed(1));
    op(S.gAp, ao);
    const lineOn = S.apOk && ao > 0.004 && f.apprEnd > S.aDates[0];
    if (lineOn && !S.aDots) {
      S.apPath.setAttribute('d', pathTo(f.apprEnd, i => YA(S.aV[i]), S.aDates, S.apx).d);
      S.apPath.setAttribute('stroke-width', 1.9 * TH().chartWeight / 2);
      op(S.apPath, ao);
    } else if (lineOn) {
      const sg = gapPaths(f.apprEnd);
      S.apPath.setAttribute('d', sg.solid); S.apPath.setAttribute('stroke-width', 1.5 * TH().chartWeight / 2); op(S.apPath, ao);
      S.apGap.setAttribute('d', sg.dashed);
    } else op(S.apPath, 0);
    op(S.apGap, lineOn && S.aDots ? ao : 0);
    op(S.apDotG, S.aDots ? ao : 0);
    S.apDots.forEach((dot, i) => { op(dot, smooth(0, DOTFADE, f.apprEnd - S.aDates[i])); });
    op(S.apMsg, S.apOk ? 0 : ao);

    // national line, drawn on to dateEnd
    const nat = pathTo(f.dateEnd, i => Y(S.nat[i]));
    S.natPath.setAttribute('d', nat.d);
    // v8: as the regions appear the national line becomes thin ink, then fades to stay as a reference
    const c2 = TH();
    S.natPath.setAttribute('stroke', s > 0.01 ? c2.ink : PRICE());
    S.natPath.setAttribute('stroke-width', (lerp(2.4, 1, s) * TH().chartWeight / 2).toFixed(2));
    S.natPath.setAttribute('stroke-opacity', ((s > 0.5 ? lerp(1, 0.3, (s - 0.5) / 0.5) : 1) * (1 - 0.7 * f.dim)).toFixed(3));
    S.tip.setAttribute('cx', nat.x.toFixed(1)); S.tip.setAttribute('cy', nat.y.toFixed(1));
    op(S.tip, (1 - smooth(0, 0.5, s)) * (1 - 0.7 * f.dim));

    // regional lines emerge from the national line
    KEYS.forEach(kk => {
      const path = S.regPaths[kk];
      if (s < 0.004) { path.style.display = 'none'; return; }
      path.style.display = '';
      const R = S.reg[kk];
      path.setAttribute('d', pathTo(S.dLast, i => { const a = Y(S.nat[i]); return a + (Y(R[i]) - a) * s; }).d);
      path.setAttribute('stroke-opacity', s.toFixed(3));
    });

    // marks and annotations, each translated to the point it labels
    const yRef = Y(S.pStart);
    S.refLine.setAttribute('y1', yRef.toFixed(1)); S.refLine.setAttribute('y2', yRef.toFixed(1));
    at(S.refLab, 0, yRef + 4);
    op(S.refLine, f.ref * 0.9); op(S.refLab, L.hideRefOnPhone ? 0 : f.ref);
    place(S.startItem, L.X(D0), Y(S.pStart)); op(S.startG, f.startMark * (1 - 0.7 * f.dim));
    const ss = L.short ? f.shortStart : 0;
    op(S.startLab, 1 - ss); op(S.startArrow, 1 - ss); op(S.shortStartGrp, ss);
    if (L.short) place(S.shortStartItem, L.X(D0), Y(S.pStart));
    place(S.tipItem, L.X(DJAN), Y(S.pJan)); op(S.tipG, f.tipLab);
    place(S.ann.A, L.X(DMAR), Y(S.pMar)); op(S.ann.A.g, f.aA);
    place(S.ann.B, L.X(S.peak.d), Y(S.peak.v)); op(S.ann.B.g, f.aB);
    place(S.ann.C, L.X(S.dLast), Y(S.pLast)); op(S.ann.C.g, f.aC);

    drawRelief(f, Y);
    drawWar(f, P0);
    drawApprNotes(f, ao);

    // v8: region labels at the right end (desktop only); phone gets a compact key
    op(S.labG, L.phone ? 0 : f.lab);
    op(S.phoneKeyG, L.phone ? f.lab : 0);
    if (!L.phone && f.lab > 0.004) {
      const n = S.dates.length - 1, xe = L.X(S.dLast);
      const ends = {};
      const items = KEYS.map(kk => { const a = Y(S.nat[n]); ends[kk] = a + (Y(S.reg[kk][n]) - a) * s; return { k: kk, y: ends[kk] + 4 }; });
      dodge(items, S.labFS + 4, L.y0 + 8, L.y1 - 6);
      items.forEach(it => {
        const l = S.labs[it.k];
        l.text.setAttribute('y', it.y.toFixed(1));
        l.sw.setAttribute('x1', L.x1 + 8); l.sw.setAttribute('x2', L.x1 + 17);
        l.sw.setAttribute('y1', (it.y - 4).toFixed(1)); l.sw.setAttribute('y2', (it.y - 4).toFixed(1));
        l.leader.setAttribute('d', 'M' + (xe + 2).toFixed(1) + ' ' + ends[it.k].toFixed(1) + ' L' + (L.x1 + 8) + ' ' + (it.y - 4).toFixed(1));
      });
    }

    // locator map
    S.map.style.opacity = f.map.toFixed(3); S.mapCap.style.opacity = f.map.toFixed(3);
    S.map.style.display = S.mapCap.style.display = f.map < 0.004 ? 'none' : 'block';
  }

  // the monthly approval line up to dateEnd, as separate segments: solid between consecutive months, dashed across a gap of more than 45 days
  function gapPaths(dateEnd) {
    const solid = [], dashed = [];
    for (let i = 1; i < S.aDates.length && S.aDates[i - 1] < dateEnd; i++) {
      const f = Math.min(1, (dateEnd - S.aDates[i - 1]) / (S.aDates[i] - S.aDates[i - 1]));
      const x0 = S.apx[i - 1], y0 = S.L.YA(S.aV[i - 1]), x1 = lerp(x0, S.apx[i], f), y1 = lerp(y0, S.L.YA(S.aV[i]), f);
      (S.aDates[i] - S.aDates[i - 1] > 45 * DAY ? dashed : solid).push('M' + x0.toFixed(1) + ' ' + y0.toFixed(1) + 'L' + x1.toFixed(1) + ' ' + y1.toFixed(1));
    }
    return { solid: solid.join(''), dashed: dashed.join('') };
  }

  // v7.2 [S8], reduced motion: the large morphs of the time chart (the axis rescaling while the line is drawn on, the price chart squeezing up to make
  // room for approval, the national line splitting into regions with the axis rescaling) become a cross-fade between the layout at the start and the layout
  // at the end of the morph's scroll span. The span is the same as without the preference; the labels' own fades stay.
  const MORPH = { 'price-rise': [0.05, 0.25], 'time-approval': [0.05, 0.25], 'price-regions': [0.05, 0.30] };
  function drawTimeFrame(id, p, tn) {
    const sp = RM() ? MORPH[id] : null;
    if (!(sp && p > sp[0] && p < sp[1])) {
      if (S.ghostOn) { S.ghostOn = false; S.ghost.style.display = 'none'; S.ghost.textContent = ''; S.fig.style.opacity = ''; S.src = ''; }
      drawTime(phase(id, p, tn));
      return;
    }
    const m = (p - sp[0]) / (sp[1] - sp[0]), srcOf = svg => svg && svg.querySelector(':scope > text.source-line');
    drawTime(phase(id, sp[0], tn));
    // a copy of the svg as the old layout, with its own marker, pattern and clip ids (the live ones are redrawn for the new layout next)
    S.ghost.innerHTML = S.svg.outerHTML.replace(/sc-(arrow|hatch|apclip|topclip)/g, 'scg-$1');
    const gs = S.ghost.firstChild, gFig = gs && gs.querySelector(':scope > g.sc-fig'), gSrc = srcOf(gs);
    if (gs) { gs.removeAttribute('role'); gs.removeAttribute('aria-label'); }
    S.ghost.style.display = ''; S.ghost.style.opacity = ''; S.ghostOn = true;
    const fb = phase(id, sp[1], tn);
    drawTime(fb);
    // the figure cross-fades; its source line does not (two different lines would overprint): the old text leaves over the first half, the new one arrives over the second
    const lSrc = srcOf(S.svg), same = !!(gSrc && lSrc && gSrc.textContent === lSrc.textContent);
    S.fig.style.opacity = m.toFixed(3);
    if (gFig) gFig.style.opacity = (1 - m).toFixed(3);
    if (lSrc) lSrc.style.opacity = (same ? 1 : ramp(m, 0.5, 1)).toFixed(3);
    if (gSrc) gSrc.style.opacity = (same ? 0 : 1 - ramp(m, 0, 0.5)).toFixed(3);
    S.map.style.opacity = (fb.map * m).toFixed(3); S.mapCap.style.opacity = (fb.map * m).toFixed(3);
  }

  // a straight leader from the point (ex, ey) to the edge of the ring at (x, y)
  const lead = (e, ex, ey, x, y) => {
    const d = Math.hypot(ex - x, ey - y) || 1, r = 7;
    e.setAttribute('d', 'M' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ' L' + (x + (ex - x) * r / d).toFixed(1) + ' ' + (y + (ey - y) * r / d).toFixed(1));
  };

  // relief measures: a ring on the line at the date; in price-relief each ring has its own label, set off by a short angled leader
  // (a vertical tick or pole would vanish against the near-vertical March rise); in time-why-not the rings share one label under a bracket.
  // The two October rings sit almost on top of each other, so their labels ('sr') stand one above the other in the margin to the right of the line,
  // on parallel leaders: the earlier ring's label is the upper one, centred on the end of the longer leader; the later ring's label hangs from the end
  // of the shorter leader, and the longer leader passes above it.
  function drawRelief(f, Y) {
    const L = S.L, fs = L.fs, lh = fs + 3, w = S.w;
    const pts = RELIEF.map(R => ({ x: L.X(R.date), y: Y(priceAt(R.date)) }));
    const sr = RELIEF.map((R, i) => i).filter(i => RELIEF[i].pos === 'sr').sort((a, b) => RELIEF[a].date - RELIEF[b].date);
    const srAt = {};   // ring index -> { lx, ty, ex, ey }: label left edge and top, and where the leader ends
    const srMerged = L.phone && sr.length === 2;   // on phones the two October rings are too close to stack; one combined label
    if (sr.length === 2 && f.rel > 0.004) {
      const a = sr[0], b = sr[1], A = pts[a], B = pts[b], ct = Math.cos(L.srAngle), st = Math.sin(L.srAngle), tan = st / ct;
      const bh = i => (S.rel[i].lines.length - 1) * lh + fs, mid = fs * 0.55;
      if (srMerged) {
        // one combined label on the later ring; the earlier ring keeps its ring but hides its label
        const L2 = L.srL2, e2 = { x: B.x + L2 * ct, y: B.y - L2 * st };
        srAt[b] = { lx: e2.x + 3, ty: e2.y - mid, ex: e2.x, ey: e2.y };
      } else {
        const L2 = L.srL2, e2 = { x: B.x + L2 * ct, y: B.y - L2 * st }, top2 = e2.y - mid;
        let L1 = L2 + 8, e1;
        for (; L1 < 220; L1 += 2) {
          e1 = { x: A.x + L1 * ct, y: A.y - L1 * st };
          const yAtLab2 = A.y - (e2.x + 3 - A.x) * tan;
          if (e1.y - mid + bh(a) + 8 <= top2 && yAtLab2 <= top2 - 4) break;
        }
        srAt[a] = { lx: e1.x + 3, ty: e1.y - mid, ex: e1.x, ey: e1.y };
        srAt[b] = { lx: e2.x + 3, ty: top2, ex: e2.x, ey: e2.y };
        const over = L.tTop - srAt[a].ty;
        if (over > 0) { srAt[a].ty += over; srAt[a].ey += over; }
      }
    }
    S.rel.forEach((r, i) => {
      if (f.rel < 0.004) { op(r.g, 0); return; }
      op(r.g, f.rel);
      const R = RELIEF[i], x = pts[i].x, y = pts[i].y, la = f.relLab[i] || 0;
      r.ring.setAttribute('cx', x.toFixed(1)); r.ring.setAttribute('cy', y.toFixed(1));
      // on phones the earlier sr ring hides its label (the later ring carries the combined text)
      if (srMerged && R.pos === 'sr' && i === sr[0]) { op(r.lead, 0); op(r.text, 0); return; }
      op(r.lead, la); op(r.text, la);
      if (la < 0.004) return;
      const bh = (r.lines.length - 1) * lh + fs;
      let bx, top, ex, ey, anchor = 'start';
      if (R.pos === 'sr' && srAt[i]) {   // in the margin to the right of the line
        bx = Math.min(srAt[i].lx, w - 6 - r.w); top = srAt[i].ty; ex = srAt[i].ex; ey = srAt[i].ey;
      } else if (R.pos === 'ul') {   // block's bottom-right corner up-left of the ring
        bx = Math.max(x - L.relDx, L.x0 + 4 + r.w); top = Math.max(L.tTop, y - L.relDy - bh); anchor = 'end';
        ex = bx + 3; ey = top + bh + 4;
      } else if (R.pos === 'dr') {   // block's top-left corner below and right of the ring, under the summer stretch of the line: the leader drops from the ring
                                     // with a slight tilt to the right, through the empty pocket between the rise to its left and the summer dip to its right
        top = Math.min(Y(L.phone ? R.atPhone : R.at) - fs, S.h - 30 - bh);
        bx = Math.min(x + 8 + L.tilt * Math.max(0, top - y), w - 6 - r.w);
        ex = bx - 3; ey = top - 3;
      } else {   // 'ur': block's bottom-left corner up-right of the ring
        bx = Math.min(x + L.relDx, w - 6 - r.w); top = Math.max(L.tTop, y - L.relDy - bh);
        ex = bx - 3; ey = top + bh + 4;
      }
      setLines(r.text, r.lines, bx, top + fs * 0.92, lh, anchor);
      lead(r.lead, ex, ey, x, y);
    });

    // time-why-not: a bracket under the four rings (its ends mark the first and the last measure), the label beneath it. The bracket sits under the
    // price line wherever the line is above $3.20 and above the panel's floor label
    op(S.sharedG, f.shared);
    if (f.shared > 0.004) {
      const bh = (S.sharedLines.length - 1) * lh + fs, xa = Math.min.apply(null, pts.map(p => p.x)), xb = Math.max.apply(null, pts.map(p => p.x));
      const yb = Math.min(Y(2.95), Y(LO_STACK) - 7 - bh - 9), tk = 5;
      S.sharedBr.setAttribute('d', 'M' + xa.toFixed(1) + ' ' + (yb - tk).toFixed(1) + ' V' + yb.toFixed(1) + ' H' + xb.toFixed(1) + ' V' + (yb - tk).toFixed(1));
      // the label starts at the bracket's left end (a label centred under the bracket would run over the rise to the left of it)
      const lx = Math.min(xa + 6, w - 6 - S.sharedW);
      setLines(S.sharedText, S.sharedLines, lx, yb + 9 + fs * 0.92, lh, 'start');
    }
  }

  function drawWar(f, P0) {
    op(S.warG, f.warLab);
    if (f.warLab < 0.004) return;
    const L = S.L, fs = L.fs, lh = fs + 3, n = S.warLines.length;
    const cx = clamp((L.X(WAR[0]) + L.X(WAR[1])) / 2, 8 + S.warW / 2, S.w - 8 - S.warW / 2);
    setLines(S.warText, S.warLines, cx, P0 - 8 - (n - 1) * lh, lh, 'middle');
  }

  // the approval file's annotations, each fading in on its own (f.pa[i])
  function drawApprNotes(f, ao) {
    S.pa.forEach((a, i) => { op(a.g, f.pa[i] || 0); });
    op(S.paG, f.pa.length ? 1 : 0);
    op(S.gapG, S.gapOn ? f.gap * ao : 0);   // the note on the dashed stretch fades with the approval panel
  }

  /* ---------- time-midterms: five midterms (ported from the v4 charts module, past-shortcut) ---------- */
  // The chart lives in a box of at most MAXW x MAXH, centred in the panel; G.h is the usable height above the 22px source band, G.hh the whole box.
  const MAXW = 1100, MAXH = 1000, BAND = 22, MINUS = '−';
  let G = null, C = null;
  const r2 = v => Math.round(v * 100) / 100;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const attrs = o => { let s = ''; for (const k in o) if (o[k] != null && o[k] !== false) s += ' ' + k + '="' + o[k] + '"'; return s; };
  const E = (tag, o, inner) => {
    if ((tag === 'path' || tag === 'line') && o && o['stroke-width'] != null) o['stroke-width'] *= TH().chartWeight / 2;
    return '<' + tag + attrs(o) + (inner == null ? '/>' : '>' + inner + '</' + tag + '>');
  };
  const grp = (a, inner) => a <= 0.004 ? '' : E('g', { opacity: a >= 0.996 ? null : Math.round(a * 1000) / 1000 }, inner);
  const sgn = (v, d) => { const s = Math.abs(v).toFixed(d == null ? 1 : d); return v < 0 ? MINUS + s : s; };
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    let o = 0;
    for (let s = 16; s >= 0; s -= 8) o = o * 256 + Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
    return '#' + ('000000' + o.toString(16)).slice(-6);
  }
  function midColors() {
    const c = Object.assign({}, TH());
    c.faint = mix(c.muted, c.bg, 0.35);
    return c;
  }
  function midGeom(w, h) {
    const bw = Math.min(w, MAXW), bh = Math.min(h, MAXH), cp = bw < 700;
    return { ox: Math.round((w - bw) / 2), oy: Math.round((h - bh) / 2), w: bw, hh: bh, h: bh - BAND, compact: cp, m: cp ? 14 : 28, top: cp ? 10 : 24, fsA: cp ? 13 : 15, fsT: cp ? 13 : 15, fsTitle: window.THEME.figType.title[cp ? 1 : 0] };
  }
  function T(s, x, y, o) {
    o = o || {};
    return E('text', {
      x: r2(x), y: r2(y), 'font-size': o.fs || G.fsA, fill: o.fill || C.ink, 'text-anchor': o.anchor, 'font-weight': o.wt,
      transform: o.rot ? 'rotate(' + o.rot + ' ' + r2(x) + ' ' + r2(y) + ')' : null,
      stroke: o.halo ? C.bg : null, 'stroke-width': o.halo ? 4 : null, 'paint-order': o.halo ? 'stroke' : null, 'stroke-linejoin': o.halo ? 'round' : null
    }, esc(s));
  }
  const LN = (x1, y1, x2, y2, o) => E('line', Object.assign({ x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2), stroke: C.rule, 'stroke-width': 1 }, o || {}));
  // a block of wrapped text; y is the top of the block; returns {svg, box}
  function N(s, x, y, maxW, o) {
    o = o || {};
    const fs = o.fs || G.fsA, wt = o.wt || 400, lh = Math.round(fs * 1.33), lines = wrap(s, fs, maxW, wt), anchor = o.anchor || 'start';
    const w = widest(lines, fs, wt);
    let bx = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
    if (w < G.w - 8) {   // keep the block inside the chart box at every width
      const pad = G.compact ? 12 : 4, sh = bx < pad ? pad - bx : bx + w > G.w - pad ? G.w - pad - (bx + w) : 0;
      if (sh) { x += sh; bx += sh; }
    }
    const sp = lines.map((l, i) => E('tspan', { x: r2(x), y: r2(y + fs * 0.92 + i * lh) }, esc(l))).join('');
    const svgS = E('text', {
      'font-size': fs, fill: o.fill || C.ink, 'text-anchor': anchor === 'start' ? null : anchor, 'font-weight': o.wt,
      stroke: o.halo === false ? null : C.bg, 'stroke-width': o.halo === false ? null : 4, 'paint-order': o.halo === false ? null : 'stroke', 'stroke-linejoin': 'round'
    }, sp);
    return { svg: svgS, box: { x: bx, y: y, w: w, h: lines.length * lh } };
  }
  // a thin arrow with an open arrowhead; o.bend curves it
  function ARROW(a, b, o) {
    o = o || {};
    const col = o.col || 'ink';
    let d;
    if (o.bend) {
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
      d = 'M' + r2(a.x) + ',' + r2(a.y) + ' Q' + r2(mx - dy / L * o.bend) + ',' + r2(my + dx / L * o.bend) + ' ' + r2(b.x) + ',' + r2(b.y);
    } else d = 'M' + r2(a.x) + ',' + r2(a.y) + ' L' + r2(b.x) + ',' + r2(b.y);
    return E('path', { d: d, fill: 'none', stroke: col === 'accent' ? C.accent : col === 'muted' ? C.muted : C.ink, 'stroke-width': 1, 'marker-end': 'url(#scm-' + col + ')' });
  }
  // a note plus an arrow from the note's box to a target point; stops `gap` px short of the target
  function CALL(s, x, y, maxW, target, o) {
    o = o || {};
    const n = N(s, x, y, maxW, o), b = n.box, pad = 5, gap = o.gap == null ? 6 : o.gap, col = o.arrowCol || 'ink';
    let from;
    if (o.from) from = o.from;
    else if (target.x >= b.x && target.x <= b.x + b.w) from = { x: target.x, y: target.y > b.y + b.h / 2 ? b.y + b.h + pad : b.y - pad };
    else if (target.y >= b.y && target.y <= b.y + b.h) from = { x: target.x > b.x + b.w / 2 ? b.x + b.w + pad : b.x - pad, y: target.y };
    else {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, dx = target.x - cx, dy = target.y - cy;
      const s_ = Math.min((b.w / 2 + pad) / (Math.abs(dx) || 1e-6), (b.h / 2 + pad) / (Math.abs(dy) || 1e-6));
      from = { x: cx + dx * s_, y: cy + dy * s_ };
    }
    const vx = target.x - from.x, vy = target.y - from.y, L = Math.hypot(vx, vy) || 1;
    const to = { x: target.x - vx / L * gap, y: target.y - vy / L * gap };
    return { svg: n.svg + (L > gap + 8 ? ARROW(from, to, { col: col, bend: o.bend }) : ''), box: b };
  }
  function midDefs() {
    const mk = (id, col) => E('marker', { id: 'scm-' + id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' },
      E('path', { d: 'M1.5,1.5 L8.5,5 L1.5,8.5', fill: 'none', stroke: col, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return E('defs', {}, mk('ink', C.ink) + mk('accent', C.accent) + mk('muted', C.muted));
  }
  // title at the top; returns {svg, bottom}
  function midTitle(txt) {
    const fs = G.fsTitle, lines = wrap(txt, fs, G.w - 2 * G.m, 600), lh = Math.round(fs * 1.28);
    let s = '';
    lines.forEach((l, i) => { s += T(l, G.m, G.top + fs * 0.95 + i * lh, { fs: fs, wt: 600 }); });
    return { svg: s, bottom: G.top + lines.length * lh + 8 };
  }
  function axisBottom(sc, y, ticks, fmt) {
    let s = LN(sc.range()[0], y, sc.range()[1], y, { stroke: C.faint });
    ticks.forEach(v => {
      s += LN(sc(v), y, sc(v), y + 4, { stroke: C.faint });
      s += T(fmt(v), sc(v), y + 4 + G.fsT + 3, { fs: G.fsT, fill: C.muted, anchor: 'middle' });
    });
    return s;
  }
  function midPts() {
    const m = (S.data.hist && S.data.hist.midterms) || [], a = (S.data.eia && S.data.eia.annual_national) || {};
    return m.filter(d => a[d.year] != null).map(d => ({ year: d.year, party: d.pres_party, seats: d.house_seat_change, price: +a[d.year] }));
  }
  // The three notes of the midterm chart on a narrow panel. Each note is a text block plus a thin arrow to its target. The block goes to the nearest
  // spot (a grid search, first at the full wrap width, then narrower) where it overlaps no point, year label, fitted-line sample, axis label or earlier
  // note, and its arrow crosses none of them either; the arrow of a line note ends on the point of the fitted line nearest to the block.
  function narrowNotes(q) {
    const { pts, xs, ys, rad, placed, a0, b, ml, mr, top, bot, ann, P10 } = q;   // (lab10: the placed year label of 2010)
    const R = G.w - mr, obst = [];
    pts.forEach(d => { const x = xs(d.price), y = ys(d.seats); obst.push({ x0: x - rad - 3, x1: x + rad + 3, y0: y - rad - 3, y1: y + rad + 3 }); });
    placed.forEach(c => obst.push({ x0: c.x0 - 3, x1: c.x1 + 3, y0: c.y0 - 2, y1: c.y1 + 2 }));
    const lx0 = xs(q.xa), ly0 = ys(a0 + b * q.xa), lx1 = xs(q.xb), ly1 = ys(a0 + b * q.xb), ll = Math.hypot(lx1 - lx0, ly1 - ly0);
    for (let k = 0; k <= ll; k += 4) { const x = lx0 + (lx1 - lx0) * k / ll, y = ly0 + (ly1 - ly0) * k / ll; obst.push({ x0: x - 3, x1: x + 3, y0: y - 3, y1: y + 3 }); }
    const hit = bx => obst.reduce((n, r) => n + (r.x0 < bx.x1 + 3 && r.x1 > bx.x0 - 3 && r.y0 < bx.y1 + 2 && r.y1 > bx.y0 - 2 ? 1 : 0), 0);   // a little air around a block
    let own = null;   // the year label an arrow points at: the arrow may run up to it
    const inOwn = (x, y) => own && x > own.x0 - 4 && x < own.x1 + 4 && y > own.y0 - 3 && y < own.y1 + 3;
    const hitPt = (x, y) => !inOwn(x, y) && obst.some(r => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1);
    const clipOut = (f, t) => {   // the end of an arrow from f toward t, stopping at the edge of the label t sits on
      if (!own) return t;
      let lo = 0, hi = 1;
      for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2, x = f.x + (t.x - f.x) * m, y = f.y + (t.y - f.y) * m; if (inOwn(x, y)) hi = m; else lo = m; }
      return { x: f.x + (t.x - f.x) * lo, y: f.y + (t.y - f.y) * lo };
    };
    const edge = (bx, t) => {   // where a ray from the block's centre to the target leaves the block (5 px clear)
      const cx = (bx.x0 + bx.x1) / 2, cy = (bx.y0 + bx.y1) / 2, dx = t.x - cx, dy = t.y - cy;
      const k = Math.min(((bx.x1 - bx.x0) / 2 + 5) / (Math.abs(dx) || 1e-6), ((bx.y1 - bx.y0) / 2 + 5) / (Math.abs(dy) || 1e-6));
      return { x: cx + dx * k, y: cy + dy * k };
    };
    const lineTarget = bx => {   // nearest point of the fitted line to the block's centre, kept off the ends
      const cx = (bx.x0 + bx.x1) / 2, cy = (bx.y0 + bx.y1) / 2, ux = (lx1 - lx0) / ll, uy = (ly1 - ly0) / ll;
      const t = clamp(((cx - lx0) * ux + (cy - ly0) * uy), 0.12 * ll, 0.88 * ll);
      return { x: lx0 + ux * t, y: ly0 + uy * t };
    };
    // one note: blocks = [{ s, fs, wt, fill }] stacked; target = a point, or null for the fitted line; the preferred spot (px, py) breaks ties
    const putNote = (blocks, maxW, target, gap, px, py, o) => {
      let best = null;
      [maxW, maxW * 1.4, maxW * 0.78, maxW * 0.6].forEach((mw, wi) => {
        if (best && best.n === 0) return;
        const bl = blocks.map(k => { const fs = k.fs || G.fsA, lh = Math.round(fs * 1.33), lines = wrap(k.s, fs, mw, k.wt || 400); return { k, fs, lh, lines, w: widest(lines, fs, k.wt || 400), h: lines.length * lh }; });
        const bw = Math.max.apply(null, bl.map(k => k.w)), bh = bl.reduce((s2, k) => s2 + k.h + 2, -2);
        for (let y = top; y + bh <= bot - 2; y += 6) for (let x = ml + 4; x + bw <= R; x += 6) {
          const bx = { x0: x, x1: x + bw, y0: y, y1: y + bh }, t = target || lineTarget(bx), f = edge(bx, t), te = clipOut(f, t), len = Math.hypot(te.x - f.x, te.y - f.y);
          let n = hit(bx);
          const m = Math.max(0, Math.floor((len - gap - 2) / 4));
          for (let k = 1; k <= m; k++) if (hitPt(f.x + (t.x - f.x) * k * 4 / len, f.y + (t.y - f.y) * k * 4 / len)) n++;
          const score = n * 1e4 + Math.hypot(x - px, y - py) * 0.5 + (len < 14 ? (14 - len) * 6 : 0) + (len > 70 ? (len - 70) * 2 : 0) + wi * 30;
          if (!best || score < best.score) best = { score, n, bl, bx, bw, t: te, f, len };
        }
      });
      if (!best) return '';
      obst.push({ x0: best.bx.x0 - 3, x1: best.bx.x1 + 3, y0: best.bx.y0 - 2, y1: best.bx.y1 + 2 });
      let s2 = '', y = best.bx.y0;
      best.bl.forEach(k => {
        const sp = k.lines.map((l, i) => E('tspan', { x: r2(best.bx.x0), y: r2(y + k.fs * 0.92 + i * k.lh) }, esc(l))).join('');
        s2 += E('text', { 'font-size': k.fs, fill: k.k.fill || C.ink, 'font-weight': k.k.wt, stroke: C.bg, 'stroke-width': 4, 'paint-order': 'stroke', 'stroke-linejoin': 'round' }, sp);
        y += k.h + 2;
      });
      const L2 = best.len, to = { x: best.t.x - (best.t.x - best.f.x) / L2 * gap, y: best.t.y - (best.t.y - best.f.y) / L2 * gap };
      if (L2 > gap + 8) s2 += ARROW(best.f, to, { col: o.col });
      return s2;
    };
    let out = '';
    out += grp(ann(0.31, 0.38), putNote(G.hh < 380 ? [{ s: 'Dashed best-fit line: higher gas prices, fewer seats lost' }] : [{ s: 'Higher gas prices, fewer seats lost' }, { s: 'dashed: the best straight line', fs: G.fsT, fill: C.muted }], 150, null, 3, xs(2.4), ys(-6), {}));
    out += grp(ann(0.37, 0.44), putNote([{ s: 'With five points, a line can tell almost any story', wt: 600, fill: C.accent }], 160, null, 3, xs(3.32), ys(-26), { col: 'accent' }));
    if (P10) {
      own = q.lab10;   // the arrow points at the year label, which stands beside its point
      const t = { x: (own.x0 + own.x1) / 2, y: (own.y0 + own.y1) / 2 };
      out += grp(ann(0.25, 0.32), putNote([{ s: '2010: gas $' + P10.price.toFixed(2) + ', ' + Math.abs(P10.seats) + ' seats lost' }], 150, t, 0, xs(3.45), ys(-51), {}));
      own = null;
    }
    return out;
  }
  function drawShortcut(L) {
    const pts = midPts();
    if (!pts.length || !window.d3) return T('Midterm or EIA data not loaded.', G.m, G.top + 20, { fill: C.muted });
    const p = L.p, ann = (a, b) => ramp(p, a, b) * (1 - (L.out || 0)), tt = midTitle(G.compact && G.hh < 380 ? 'Five midterms: gas price and seats lost' : 'Five midterms: gas price and House seats lost by the president’s party');   // a short panel gets a one-line title
    let out = tt.svg;
    // legend
    const ly = tt.bottom + 6;
    let lx = G.m;
    [['R', 'Republican president', C.rep], ['D', 'Democratic president', C.dem]].forEach(q => {
      out += E('circle', { cx: lx + 5, cy: ly + 6, r: 5, fill: q[2] });
      out += T(q[1], lx + 15, ly + 6 + G.fsT * 0.36, { fs: G.fsT, fill: C.muted });
      lx += 15 + measureText(q[1], G.fsT) + 18;
    });
    const cp = G.compact, ml = cp ? 50 : 72, mr = G.m + (cp ? 4 : 12), top = ly + 24, bot = G.h - (cp ? (G.hh < 380 ? 64 : 72) : 84);
    const xs = d3.scaleLinear().domain([2.3, 4.2]).range([ml, G.w - mr]), ys = d3.scaleLinear().domain([-72, 4]).range([bot, top]);
    [-60, -40, -20, 0].forEach(v => {
      out += LN(ml, ys(v), G.w - mr, ys(v), { stroke: v === 0 ? C.muted : C.rule });
      out += T(v === 0 ? '0' : sgn(v, 0), ml - 7, ys(v) + 4, { fs: G.fsT, fill: C.muted, anchor: 'end' });
    });
    out += axisBottom(xs, bot, [2.5, 3, 3.5, 4], v => '$' + v.toFixed(2));
    out += T(cp ? 'Gas price in the election year, $ per gallon (EIA)' : 'Average U.S. gas price in the election year, $ per gallon (EIA)', (ml + G.w - mr) / 2, bot + (cp ? (G.hh < 380 ? 36 : 40) : 46), { fs: G.fsT, fill: C.ink, anchor: 'middle' });
    out += T(cp ? 'Seats won (+) or lost (−)' : 'House seats won (+) or lost (−) by the president’s party', 16, (top + bot) / 2, { fs: G.fsT, fill: C.ink, anchor: 'middle', rot: -90 });
    S.midSrc = ['Source: EIA annual average prices; House seat changes: The American Presidency Project, UC Santa Barbara.', 'Source: EIA; House seat changes: The American Presidency Project, UC Santa Barbara.', 'Source: EIA; The American Presidency Project, UCSB.'];

    // fitted line (least squares), drawn left to right
    const mx = d3.mean(pts, d => d.price), my = d3.mean(pts, d => d.seats);
    const b = d3.sum(pts, d => (d.price - mx) * (d.seats - my)) / d3.sum(pts, d => (d.price - mx) * (d.price - mx)), a0 = my - b * mx;
    const xa = 2.45, xb = 4.1, f = ramp(p, 0.15, 0.25), xe = xa + (xb - xa) * f;
    if (f > 0.001) out += LN(xs(xa), ys(a0 + b * xa), xs(xe), ys(a0 + b * xe), { stroke: C.ink, 'stroke-width': 1.6, 'stroke-dasharray': '6 5' });

    // points, one by one. Each year label takes the first side (right, left, below, above) where its box touches neither the whole fitted line
    // (placement does not depend on p), nor another point or label, and stays inside the plot.
    const rad = cp ? 6 : 8, fsY = G.fsA, lineSeg = [xs(xa), ys(a0 + b * xa), xs(xb), ys(a0 + b * xb)];
    const near = (bx, q) => { for (let k = 0; k <= 80; k++) { const x = lerp(lineSeg[0], lineSeg[2], k / 80), y = lerp(lineSeg[1], lineSeg[3], k / 80); if (x > bx.x0 - q && x < bx.x1 + q && y > bx.y0 - q && y < bx.y1 + q) return true; } return false; };
    const placed = [];
    const yl = pts.map(d => {
      const gx = xs(d.price), gy = ys(d.seats), tw = measureText(String(d.year), fsY, 600), gap = rad + 5, th = fsY * 0.75, asc = fsY * 1.0, desc = fsY * 0.35;
      const cands = [
        { x: gx + gap, y: gy + 4.5, anchor: null, x0: gx + gap, x1: gx + gap + tw },
        { x: gx - gap, y: gy + 4.5, anchor: 'end', x0: gx - gap - tw, x1: gx - gap },
        { x: gx, y: gy + rad + 5 + th, anchor: 'middle', x0: gx - tw / 2, x1: gx + tw / 2 },
        { x: gx, y: gy - rad - 5, anchor: 'middle', x0: gx - tw / 2, x1: gx + tw / 2 },
        { x: gx + rad * 0.5, y: gy + rad + 3.6 + asc, anchor: null, x0: gx + rad * 0.5, x1: gx + rad * 0.5 + tw },   // down-right: clear of a line that rises to the right
        { x: gx - rad * 0.5, y: gy - rad - 3.6 - desc, anchor: 'end', x0: gx - rad * 0.5 - tw, x1: gx - rad * 0.5 }        // up-left
      ];
      cands.forEach(c => { c.y0 = c.y - asc; c.y1 = c.y + desc; });
      const ok = c => c.x0 > ml + 2 && c.x1 < G.w - mr && !near(c, 2)
        && !pts.some(o => { const ox = xs(o.price), oy = ys(o.seats); return ox + rad + 3 > c.x0 && ox - rad - 3 < c.x1 && oy + rad + 3 > c.y0 && oy - rad - 3 < c.y1; })
        && !placed.some(o => o.x0 - 4 < c.x1 && o.x1 + 4 > c.x0 && o.y0 - 2 < c.y1 && o.y1 + 2 > c.y0);
      const c = cands.find(ok) || cands[0];
      placed.push(c);
      return c;
    });
    pts.forEach((d, i) => {
      const kk = ramp(p, 0.05 + 0.02 * i, 0.11 + 0.02 * i);
      if (kk <= 0) return;
      const gx = xs(d.price), gy = ys(d.seats), c = yl[i];
      out += grp(kk, E('circle', { cx: r2(gx), cy: r2(gy), r: r2(rad * (0.4 + 0.6 * kk)), fill: d.party === 'R' ? C.rep : C.dem, stroke: C.bg, 'stroke-width': 1.5 }) +
        T(String(d.year), c.x, c.y, { fs: fsY, wt: 600, halo: true, anchor: c.anchor }));
    });

    // annotations. On narrow panels (< 700 px) each note is put by a small search for the nearest free spot (the desktop positions are fixed)
    const P10 = pts.filter(d => d.year === 2010)[0], right = G.w - mr;
    if (G.w < 700) return out + narrowNotes({ pts, xs, ys, rad, placed, a0, b, xa, xb, ml, mr, top, bot, ann, P10, lab10: yl[pts.indexOf(P10)] });
    if (P10) {
      const a1 = ann(0.25, 0.32);
      const txt = cp ? '2010: gas $' + P10.price.toFixed(2) + ', ' + Math.abs(P10.seats) + ' seats lost' : 'Reading one point: in 2010 gas averaged $' + P10.price.toFixed(2) + ' and the president’s party lost ' + Math.abs(P10.seats) + ' seats';
      const nx = xs(cp ? 3.45 : 3.3), ny = ys(cp ? -51 : -57);   // compact: further from the point than v4, so the arrow is long enough to read
      out += grp(a1, CALL(txt, nx, ny, right - nx, { x: xs(P10.price) + rad + 56, y: ys(P10.seats) + 2 }, { gap: 4, from: { x: nx - 5, y: ny + 8 }, bend: -10 }).svg);
    }
    const a2 = ann(0.31, 0.38);
    const l2 = 'Higher gas prices, fewer seats lost';
    const n2x = xs(2.4), n2y = ys(cp ? -6 : -8), w2 = cp ? 150 : 270;
    const m2 = N(l2, n2x, n2y, w2, { halo: true }).box, nn2 = N('dashed: the best straight line', n2x, m2.y + m2.h + 2, w2, { fill: C.muted, fs: G.fsT, halo: true });
    const c2 = CALL(l2, n2x, n2y, w2, { x: xs(2.95), y: ys(a0 + b * 2.95) - 3 }, { gap: 3, from: { x: n2x + Math.min(m2.w, 170) * 0.5, y: nn2.box.y + nn2.box.h + 5 }, bend: 0 });
    out += grp(a2, c2.svg + nn2.svg);
    const a3 = ann(0.37, 0.44);
    const n3x = xs(cp ? 3.32 : 3.4), n3y = ys(cp ? -26 : -30), w3 = right - n3x - 2;
    out += grp(a3, CALL('With five points, a line can tell almost any story', n3x, n3y, w3, { x: xs(3.75), y: ys(a0 + b * 3.75) + 5 }, { gap: 2, wt: 600, fill: C.accent, arrowCol: 'accent', from: { x: n3x + Math.min(w3, 150) * 0.55, y: n3y - 4 } }).svg);
    return out;
  }
  function drawMid(p, out) {
    const key = [Math.round(p * 2000), Math.round(out * 1000), S.w, S.h].join('|');
    if (key === S.midKey) return;
    S.midKey = key;
    G = midGeom(S.w, S.h); C = midColors(); S.midSrc = null;
    let inner = '';
    try { inner = drawShortcut({ p, out }); } catch (e) { console.error('[scene] time-midterms', e); }
    S.mid.setAttribute('viewBox', '0 0 ' + S.w + ' ' + S.h);
    const mp = midPts();
    if (mp.length) {
      const mxp = mp.reduce((a, d) => a + d.price, 0) / mp.length, myp = mp.reduce((a, d) => a + d.seats, 0) / mp.length, cov = mp.reduce((a, d) => a + (d.price - mxp) * (d.seats - myp), 0);
      const lo = Math.min.apply(null, mp.map(d => -d.seats)), hi = Math.max.apply(null, mp.map(d => -d.seats));
      S.mid.setAttribute('aria-label', 'Scatter plot of ' + mp.length + ' midterm elections (' + mp.map(d => d.year).join(', ') + '): the average U.S. gas price in the election year against the House seats the president’s party lost, from ' + lo + ' to ' + hi + '. A dashed best-fit line slopes toward ' + (cov > 0 ? 'fewer' : 'more') + ' seats lost in years with higher gas prices.');
    }
    S.mid.innerHTML = midDefs() + E('svg', { class: 'scm-box', x: G.ox, y: G.oy, width: G.w, height: G.hh, overflow: 'visible' }, inner);
    const box = S.mid.querySelector('.scm-box');
    if (box && S.midSrc && typeof window.sourceLine === 'function') window.sourceLine(box, srcFit(S.midSrc, G.w), G.w, G.hh);
  }

  /* ---------- render ---------- */
  function render(state) {
    if (!S.ready || !S.L) return;
    const mine = BEATS.indexOf(state.id) >= 0, inc = BEATS.indexOf(state.next) >= 0;
    if (!mine && !inc) { S.layer.style.opacity = 0; return; }
    let id, p, layerOp, tn = 0;
    // handing over to another module: leave over the first 60% of the eased t, so the two pictures overlap only briefly
    if (mine) { id = state.id; p = state.p; layerOp = inc ? 1 : 1 - ramp(ease(state.t), 0, 0.6); tn = inc ? ease(state.t) : 0; }
    else { id = state.next; p = 0; layerOp = ease(state.t); }
    S.layer.style.opacity = layerOp < 0.004 ? 0 : layerOp.toFixed(3);
    if (layerOp < 0.004) return;

    // which picture: the time chart, the scatter, or a cross-fade between them, linear in the eased t (SPEC: no second easing on top);
    // the outgoing picture leaves over the first 60% and the incoming one arrives over the last 60%
    let timeOp = 1, midOp = 0, tId = id, tP = p, tTn = tn, midP = 0, midOut = 0;
    if (id === 'time-midterms') {
      timeOp = 0; midOp = 1; midP = p;
      if (state.next === 'price-regions' && mine) {
        midOp = 1 - ramp(tn, 0, 0.6); timeOp = ramp(tn, 0.4, 1); midOut = ramp(tn, 0, 0.4);
        tId = 'price-regions'; tP = 0; tTn = 0;
      }
    } else if (id === 'time-why-not' && state.next === 'time-midterms') {
      timeOp = 1 - ramp(tn, 0, 0.6); midOp = ramp(tn, 0.4, 1);
    }
    S.timeWrap.style.opacity = timeOp.toFixed(3); S.timeWrap.style.display = timeOp < 0.004 ? 'none' : '';
    S.midWrap.style.opacity = midOp.toFixed(3); S.midWrap.style.display = midOp < 0.004 ? 'none' : '';
    if (timeOp >= 0.004) drawTimeFrame(tId, tP, tTn);
    if (midOp >= 0.004) drawMid(midP, midOut);
  }

  /* ---------- module ---------- */
  window.VIS.scene = {
    init(el, data) {
      S.host = el; S.data = data;
      S.ready = prep(data);
      if (!S.ready) {
        el.textContent = '';
        const m = document.createElement('div'); m.style.cssText = 'padding:2rem;font:14px/1.5 sans-serif;color:#5E6773';
        m.textContent = 'EIA price data not loaded (data/eia.json).';
        el.appendChild(m);
        return;
      }
      build();
      // the approval series is this module's own file: data/approval_sim.json (simulated);
      // until it arrives (or if it fails) the panel shows a note instead of the line
      const load = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ': HTTP ' + r.status); return r.json(); })
        .then(j => { if (!prepAppr(j)) throw new Error(u + ': no usable points'); });
      load('data/approval_sim.json')
        .then(() => { S.apOk = true; })
        .catch(e => { S.apOk = false; console.info('[scene] approval series not loaded: ' + e.message); })
        .then(() => { if (S.L) { S.src = ''; S.aria = ''; layout(); if (window.BEAT_STATE) render(window.BEAT_STATE); } });
    },
    resize(w, h) {
      S.w = w; S.h = h;
      if (!S.ready) return;
      layout();
      if (window.BEAT_STATE) render(window.BEAT_STATE);
    },
    render
  };
})();
