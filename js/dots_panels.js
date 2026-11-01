/* window.DOTS_PANELS: chart panels the dots module calls inside its own layer.
   Panels routed in v9.4 (PANEL_OF in vis_dots.js): overview (beat route), group (beats unusual ... compare-all, with both-sides-total), equation
   (beats eq-1 ... stock-take), states-deviation (beats state-bridge, state-comparison, state-adj-pt, state-adj-lag).
   Unrouted, kept so that archived beats can come back (STORYBOARD_archive.md): burden, burden-v6, checks, the v8 ids of states-deviation
   (group-votes, state-layer, adj-pt, adj-lag, state-q) and the method-map overview.
   Interface:  DOTS_PANELS[id].render(g, state, ctx)
     g      d3 selection of an SVG group, cleared by the caller before each call
     state  { id, beat, next, p, t, w, h }   id = the panel id; beat = the beat shown (read by the panels that span several beats)
     ctx    { w, h, small, T, data, opacity, free }   T = THEME, opacity = the beat's fade (applied to g here)
   render is a pure function of state and ctx: no timers, no transitions. Each beat's build is complete by p = 0.45 and then holds.
   Second-stage rule (v6): the figure builds over p = 0.05-0.25; titles, callout labels, arrows and tags come in over p = 0.25-0.45.
   A panel that spans several beats shows, at p = 0 of a beat, the finished picture of the beat before (burden: the end of
   burden-local, also when burden-split follows another panel), and builds its own change over p = 0.05-0.45.
   Caching: a drawing depends only on (beat, min(p, 0.45), size, data, fonts). When that key repeats, the drawing from the last call
   is re-attached instead of rebuilt (see `cached`), so held pictures cost nothing per frame.
   Everything is drawn inside g. The v8 panels reserve the slice band's top offset and the adjustment strip at the bottom.
   Every other number is illustrative or hypothetical (fixed, deterministic) and tagged as such in the panel's source line. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const _T = () => window.THEME || {};
  const FONT = _T().fontLabelCanvas || "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const DEF_T = { bg: '#FAFAF8', ink: '#1C2128', muted: '#5E6773', rule: '#D9DCE0', accent: '#0E5F6B', accentSoft: '#D7E9EB', rep: '#B2423A', dem: '#2F5D9B', burden: ['#EAD9B8', '#C9822B', '#6B2A12'], price: ['#EEE8F3', '#5E4A8B'], priceLow: '#6B7785' };
  const GREY = _T().setAside || '#8A929C';        // what exposure alone predicts (burden-split bars); differences between races
  const AMBER = _T().amber || '#C9822B';       // v6 colour of what exposure alone predicts (equation chip); v7.2: grey (SPEC §3), kept for burden-v6 only
  const RUST = _T().rust || '#A0521D';        // negative deviations
  const PADD2 = (window.PADD_COLORS && window.PADD_COLORS['2']) || '#C2A35A';       // Midwest, as on the map
  const PLUM = _T().plum || '#7B6B94';        // v6 colour of the four adjustments; v7.2: no purple (SPEC §3)
  const INKG = _T().adj || '#3F4650';        // the adjustments (v7.2)
  const HOLD = 0.45;             // every build is complete by this p

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const sm = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const hexRgb = h => { const k = parseInt(h.slice(1), 16); return [(k >> 16) & 255, (k >> 8) & 255, k & 255]; };
  const mix = (a, b, u) => { const A = hexRgb(a), B = hexRgb(b); return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], u))).join(',') + ')'; };
  const MINUS = '−';
  const sgn = (v, d) => (v < 0 ? MINUS : '+') + '$' + Math.abs(v).toFixed(d == null ? 2 : d);
  const about = v => 'about ' + (v < 0.05 ? (v * 100).toFixed(1) : Math.round(v * 100)) + '%';
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(rnd) { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  /* ---------- svg helpers ---------- */
  let mctx = null;
  const c2d = () => mctx || (mctx = document.createElement('canvas').getContext('2d'));
  // label sizes are scaled once, here and in measure(); titles, subtitles and tags (14px and up) pass their final size (PI, 2026-10-30)
  let ZK = 1;
  const fz = v => (+v >= 14 ? +v : Math.max(ZK === _T().figType.scale[1] && window.innerWidth < 900 ? 11 : 0, Math.round(+v * ZK * 10) / 10));
  const FT = (key, small) => _T().figType[key][small ? 1 : 0];
  function S(parent, tag, attrs) { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, k === 'font-size' ? fz(attrs[k]) : attrs[k]); parent.appendChild(e); return e; }
  function measure(str, size, weight) { const c = c2d(); c.font = (weight === 600 ? _T().labelWeight : weight || 400) + ' ' + fz(size) + 'px ' + FONT; return c.measureText(str).width; }
  // Equation widths are measured on a hidden svg text node, the way they are drawn
  let mSvg = null; const mEq = new Map();
  function measureEq(str, size, italic) {
    const key = str + '|' + size + '|' + (italic ? 1 : 0);
    if (mEq.has(key)) return mEq.get(key);
    if (!mSvg) {
      mSvg = document.createElementNS(NS, 'svg'); mSvg.setAttribute('aria-hidden', 'true');
      mSvg.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px;visibility:hidden';
      mSvg.appendChild(document.createElementNS(NS, 'text')); document.body.appendChild(mSvg);
    }
    const t = mSvg.firstChild;
    t.setAttribute('font-family', FONT); t.setAttribute('font-size', fz(size)); t.setAttribute('font-style', italic ? 'italic' : 'normal');
    t.textContent = str;
    const w = t.getComputedTextLength();
    mEq.set(key, w); return w;
  }
  const clearSerif = () => mEq.clear();
  // v9.4: a deterministic estimate of the wrapped lines (no font measurement; slightly wide for IBM Plex Sans, so it never counts too few lines), for
  // layout that must not depend on whether the web fonts have arrived (the group's geometry, which the dots module also reads at its start-up)
  const estW = (s, size, weight) => String(s).length * size * ((weight || 400) >= 600 ? 0.48 : (weight || 400) >= 500 ? 0.475 : 0.465);
  function wrapEst(str, maxW, size, weight) {
    const out = [];
    String(str).split('\n').forEach(par => {
      let ln = '';
      par.split(/\s+/).forEach(w => { const t = ln ? ln + ' ' + w : w; if (ln && estW(t, size, weight) > maxW) { out.push(ln); ln = w; } else ln = t; });
      out.push(ln);
    });
    return out;
  }
  function wrap(str, maxW, size, weight) {
    const out = [];
    String(str).split('\n').forEach(par => {
      let ln = '';
      par.split(/\s+/).forEach(w => { const t = ln ? ln + ' ' + w : w; if (ln && measure(t, size, weight) > maxW) { out.push(ln); ln = w; } else ln = t; });
      out.push(ln);
    });
    return out;
  }
  // phones: the first line is as wide as the room left of the button and the tag, the others take the full width
  function wrapFirst(fn, str, w1, w, size, weight) {
    const first = fn(str, w1, size, weight)[0], rest = String(str).slice(first.length).trim();
    return rest ? [first].concat(fn(rest, w, size, weight)) : [first];
  }
  // Group setup: opacity, font, defs, the grey footnote at the bottom of the drawing area. Returns the layout object L.
  // The dots module draws the real source line in its own 22px band below ctx.h; the text for it is DOTS_PANELS[id].source.
  // ctx.free = {x0,y0,x1,y1}: the rectangle the dots leave empty. Everything is drawn inside it.
  // counter: the beat shows the counter at the bottom right; content then ends above it.
  function setup(g, state, ctx, source, counter) {
    const node = g.node(), small = !!ctx.small, T = Object.assign({}, DEF_T, ctx.T || {});
    ZK = _T().figType.scale[small ? 1 : 0];
    node.setAttribute('opacity', ctx.opacity == null ? 1 : ctx.opacity);
    node.setAttribute('font-family', FONT);
    const F = ctx.free || { x0: 0, y0: 0, x1: ctx.w, y1: ctx.h };
    const sliceBand = typeof ctx.band === 'number' ? ctx.band : +window.SLICE_BAND || 0, stripH = +window.SLICE_STRIP_H || 0;
    const pad = Math.max(small ? 14 : 28, (ctx.w - 1100) / 2 + 28);
    // vis_dots translates the entire panels layer by SLICE_BAND; reserve that height at the bottom here.
    const L = { g: node, w: ctx.w, h: ctx.h, F: F, small: small, T: T, p: state.p, top: F.y0 > 0 ? F.y0 : small ? 8 : 22, pad: pad, fs: 13, fsm: 12, data: ctx.data || {}, _hideTitle: ctx._hideTitle };
    L.phone = small && window.innerWidth < 900;
    L.tiny = L.phone && L.h < 230;
    L.tablet = window.innerWidth < 900 && L.w >= 520 && L.w < 640;
    L.edge = L.tiny || L.tablet || small && L.w >= 480 && L.w < 520 && L.h < 340;
    L.focusGroup = L.phone && ['unusual', 'unusual-why', 'exposure-scale'].includes(state.beat || state.id);
    L.right = Math.min(L.w - pad, F.x1 - (small ? 14 : 28));
    L.floor = Math.min(L.h, F.y1) - sliceBand - stripH;
    L.defs = S(node, 'defs');
    const sz = 12, lh = small ? 15 : 15;
    const sw = L.right - L.pad;
    // optional footnote, lifted 16px so it clears the dots module's source band and the counter; none when `source` is empty
    const lines = source ? wrap(source, sw, sz) : [];
    const base = L.floor - 16;
    if (lines.length) {
      const t = S(node, 'text', { x: L.pad, y: base - (lines.length - 1) * lh, 'font-size': sz, fill: T.muted });
      lines.forEach((ln, k) => { const ts = S(t, 'tspan', { x: L.pad, dy: k ? lh : 0 }); ts.textContent = ln; });
      L.bottom = base - (lines.length - 1) * lh - sz - 10;          // content must end above this
    } else L.bottom = L.floor - 10;
    if (counter && small) L.bottom -= 46;                           // the phone counter runs two lines over the bottom of the area
    L.footH = lines.length * lh + 6;
    return L;
  }
  // Text with optional wrap width and halo, clamped inside the panel. o: size weight fill anchor w lh italic halo minX maxX serif.
  function txt(L, parent, x, y, str, o) {
    o = o || {};
    const size = o.size || L.fs, lh = (o.lh || 1.3) * fz(size), weight = o.weight === 600 ? _T().labelWeight : o.weight || 400;
    const lines = o.w1 ? wrapFirst(wrap, str, o.w1, o.w, size, weight) : o.w ? wrap(str, o.w, size, weight) : String(str).split('\n');
    let bw = 0; lines.forEach(l => { bw = Math.max(bw, measure(l, size, weight)); });
    const anchor = o.anchor || 'start';
    let left = anchor === 'middle' ? x - bw / 2 : anchor === 'end' ? x - bw : x;
    const minX = o.minX == null ? L.pad : o.minX, maxX = o.maxX == null ? L.right : o.maxX;
    const nl = clamp(left, minX, Math.max(minX, maxX - bw));
    x += nl - left; left = nl;
    y = clamp(y, (o.noTop ? 0 : L.top) + size, L.floor - 2);
    const mk = () => {
      const t = S(parent, 'text', { x: x, y: y, 'font-size': size, 'font-weight': weight, fill: o.fill || L.T.ink, 'text-anchor': anchor, 'paint-order': 'stroke', stroke: L.T.bg, 'stroke-width': o.halo == null ? 3 : o.halo, 'stroke-linejoin': 'round' });
      if (o.italic) t.setAttribute('font-style', 'italic');
      if (o.tnum) t.setAttribute('style', 'font-variant-numeric: tabular-nums');
      return t;
    };
    const t = mk(), els = [t];
    // w1 (a title beside the button): one element per line, so that main.js sees the first line's own box, not the box of the whole title
    if (o.w1) lines.forEach((ln, k) => { const e = k ? mk() : t; if (k) { e.setAttribute('y', y + k * lh + 5); els.push(e); } S(e, 'tspan', { x: x }).textContent = ln; });
    else lines.forEach((ln, k) => { const ts = S(t, 'tspan', { x: x, dy: k ? lh : 0 }); ts.textContent = ln; });
    return { el: t, els: els, x0: left, x1: left + bw, y0: y - size * 0.85, y1: y + (lines.length - 1) * lh + size * 0.25 + (o.w1 && lines.length > 1 ? 5 : 0), w: bw, h: lines.length * lh + (o.w1 && lines.length > 1 ? 5 : 0), lh: lh, lines: lines.length };
  }
  // A paragraph with a bold lead-in ("We expect:") followed by wrapped regular text.
  function para(L, parent, x, y, lead, body, w, o) {
    o = o || {};
    const size = o.size || L.fs, lh = 1.35 * size;
    const full = lead + ' ' + body, lines = wrap(full, w, size);
    const t = S(parent, 'text', { x: x, y: y, 'font-size': size, fill: o.fill || L.T.ink });
    lines.forEach((ln, k) => {
      const ts = S(t, 'tspan', { x: x, dy: k ? lh : 0 });
      if (k === 0 && ln.indexOf(lead) === 0) {
        const b = S(ts, 'tspan', { 'font-weight': 600 }); b.textContent = lead;
        const r = S(ts, 'tspan'); r.textContent = ln.slice(lead.length);
      } else ts.textContent = ln;
    });
    return { h: lines.length * lh, y1: y + (lines.length - 1) * lh + size * 0.3, lines: lines.length };
  }
  function line(L, parent, x1, y1, x2, y2, o) {
    o = o || {};
    return S(parent, 'line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: o.stroke || L.T.ink, 'stroke-width': o.w || 1, 'stroke-dasharray': o.dash || '', 'stroke-linecap': 'round', opacity: o.op == null ? 1 : o.op });
  }
  function markerId(L, col, size) {
    size = size || 9;
    const id = 'dp-ah-' + col.replace(/[^0-9a-z]/gi, '') + '-' + size;
    if (!L.defs.querySelector('#' + id)) {
      const m = S(L.defs, 'marker', { id: id, viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: size, markerHeight: size, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
      S(m, 'path', { d: 'M1.5,1.5 L8.5,5 L1.5,8.5', fill: 'none', stroke: col, 'stroke-width': 1.2 * (size > 9 ? 1.5 : 1), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    }
    return id;
  }
  // o: stroke, dash, gap (space before the tip), w (line width), head (arrowhead size, default 9)
  // v9.5 (DESIGN.md §Marks): arrows 1.25px with small heads
  function arrow(L, parent, x1, y1, x2, y2, o) {
    o = o || {};
    const col = o.stroke || L.T.ink, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, gap = o.gap == null ? 3 : o.gap;
    return S(parent, 'line', { x1: x1, y1: y1, x2: x2 - dx / d * gap, y2: y2 - dy / d * gap, stroke: col, 'stroke-width': o.w || 1.25, 'stroke-dasharray': o.dash || '', 'stroke-linecap': 'round', 'marker-end': 'url(#' + markerId(L, col, o.head || 8) + ')' });
  }
  const grp = (parent, op) => S(parent, 'g', op == null ? {} : { opacity: op });
  // The figure heading: a 14px title at the top left, wrapped to leave room for
  // a boxed tag ("Illustrative", "Provisional": 12px, muted, thin border) at the top right; an optional muted subtitle under the title.
  // Returns { bottom } (the y under the heading).
  function figHead(L, parent, title, tagText, sub, tagOp, first1) {
    if (L.edge) tagText = null;
    const size = FT('title', L.small), tz = FT('tag', L.small), tgw = tagText ? measure(tagText, tz, 500) + 8 : 0;
    // when the parent ctx says hideTitle, draw invisible text so layout is identical but nothing paints
    const hidden = L._hideTitle;
    // v9.5: the title leaves room on its row for main.js's "Back to the overview" button, left of the tag;
    // wrap width is measured at the actual title size, so a title never pushes the button below it
    const w = L.right - L.pad - (tgw ? tgw + 8 : 0) - (L.noBtn ? 0 : BTN());
    // first1 (phones, set by the states beats adj-pt and adj-lag): only the first line shares its row with the button, so the other lines take the full width
    const t = txt(L, parent, L.pad, L.top + size * 0.875, first1 && L.phone ? STATE_TITLE_P[title] || title : title, first1 && L.phone ? { weight: 600, size: size, w: L.right - L.pad, w1: w + BTN() - 74, noTop: true } : { weight: 600, size: size, w: w, noTop: true });
    t.el.setAttribute('data-fig-title', '1');
    if (hidden) t.els.forEach(e => e.setAttribute('opacity', '0'));
    let bottom = t.y0 + t.h + 3;
    if (tagText && (tagOp == null || tagOp >= 0.01) && !hidden) {
      // v9.5 (DESIGN.md §Type): the tag is plain small text with no box
      const gt = tagOp == null || tagOp >= 0.999 ? parent : grp(parent, tagOp);
      S(gt, 'text', { x: L.right - tgw / 2, y: L.top + tz + 2, 'font-size': tz, 'font-weight': 500, fill: L.T.muted, 'text-anchor': 'middle', 'data-fig-tag': '1' }).textContent = tagText;
    }
    if (sub && !hidden) { const u = txt(L, parent, L.pad, bottom + 12, sub, { size: FT('sub', L.small), fill: L.T.muted, w: L.right - L.pad }); u.el.setAttribute('data-fig-sub', '1'); bottom = u.y1 + 2; }
    return { bottom: bottom, title: t };
  }
  function shares(L) { const s = L.data && L.data.shares; return s && s.kept_2026 ? s.kept_2026 : null; }
  const beatOf = (state, first) => state.beat || (state.id && state.id !== first.pid ? state.id : first.beat);

  /* ======================================================================
     burden: a worked example with two hypothetical counties.
       burden-state: one state price, so the counties differ only in exposure.
       burden-metro: the state splits into two metro areas with their own price rises; the changed factor turns accent.
       burden-split: each burden is split into what exposure alone predicts (exposure × the comparable areas' average rise, muted)
                     and exposure × the unusual rise (accent), with a small bar per county; the first part is then set aside.
     Each beat builds over p = 0.05–0.25 and its tags, labels and arrows come in over p = 0.25–0.45 (the second stage). */
  // a generic state (straight survey lines, a river on the east side), two counties, and a metro border along county lines
  const B_STATE = [[0.03, 0.08], [0.84, 0.08], [0.87, 0.17], [0.93, 0.23], [0.94, 0.37], [0.90, 0.49], [0.95, 0.61], [0.93, 0.74], [0.98, 0.85], [0.97, 0.94], [0.03, 0.94]];
  const B_CTY = { A: [[0.14, 0.38], [0.33, 0.38], [0.33, 0.50], [0.40, 0.50], [0.40, 0.80], [0.14, 0.80]], B: [[0.60, 0.42], [0.80, 0.42], [0.83, 0.58], [0.80, 0.80], [0.60, 0.80]] };
  const B_SPLIT = [[0.49, -0.05], [0.49, 0.30], [0.53, 0.30], [0.53, 0.64], [0.47, 0.64], [0.47, 1.05]];
  // e: exposure; p0/p1: the price rise statewide / in the metro area; g: what exposure alone predicts (at the average rise $1.20);
  // d, a: the unusual rise and exposure × the unusual rise; t: the burden; k0/k1: the two parts as numbers (bars)
  const B6_ROWS = [
    { name: 'County A', e: '1.5%', p0: '$1.20', p1: '$1.30', b0: '1.8%', b1: '1.95%', v0: 1.8, v1: 1.95, d: '$0.10', g: '1.80%', a: '+0.15%', k0: 1.8, k1: 0.15 },
    { name: 'County B', e: '0.5%', p0: '$1.20', p1: '$1.10', b0: '0.6%', b1: '0.55%', v0: 0.6, v1: 0.55, d: MINUS + '$0.10', g: '0.60%', a: MINUS + '0.05%', k0: 0.6, k1: -0.05 }
  ];
  function priceTag(L, parent, cx, cy, str, col, size, op) {
    if (op < 0.01) return;
    const w = measure(str, size, 600), gq = grp(parent, op);
    S(gq, 'rect', { x: cx - w / 2 - 8, y: cy - size * 0.95, width: w + 16, height: size * 1.55, rx: 3, fill: L.T.bg, stroke: col, 'stroke-width': 1.2 });
    const t = S(gq, 'text', { x: cx, y: cy + size * 0.1, 'font-size': size, 'font-weight': 600, fill: col, 'text-anchor': 'middle', style: 'font-variant-numeric: tabular-nums' });
    t.textContent = str;
  }
  // column positions (right edges / centres, relative to the table's left edge) of the worked lines at font size zz.
  // First six columns: the one-line version of burden-state / burden-metro; the rest extend it to the two-part sum of burden-split.
  function burdenCols(zz) {
    const m = (s, w) => measure(s, zz, w), gap = zz * 0.6;
    const c = { z: zz, gap: gap, nmW: m('County A', 600), eW: m('1.5%'), pW: m('$1.30'), bW: Math.max(m('1.95%', 600), m('1.80%')), opW: m('×'), plW: m('+'),
      dW: Math.max(m('$0.10'), m(MINUS + '$0.10')), aW: Math.max(m('+0.15%'), m(MINUS + '0.05%')) };
    c.cE = c.nmW + gap * 1.8 + c.eW; c.cX = c.cE + gap + c.opW / 2; c.cP = c.cX + c.opW / 2 + gap + c.pW; c.cQ = c.cP + gap + c.opW / 2; c.cB = c.cQ + c.opW / 2 + gap + c.bW;
    c.cPl = c.cB + gap * 1.6 + c.plW / 2; c.cE2 = c.cPl + c.plW / 2 + gap + c.eW; c.cX2 = c.cE2 + gap + c.opW / 2; c.cD = c.cX2 + c.opW / 2 + gap + c.dW;
    c.cQ2 = c.cD + gap + c.opW / 2; c.cA = c.cQ2 + c.opW / 2 + gap + c.aW; c.cQ3 = c.cA + gap * 1.6 + c.opW / 2; c.cT = c.cQ3 + c.opW / 2 + gap + c.bW;
    return c;
  }
  function renderBurdenV6(g, state, ctx) {
    const L = setup(g, state, ctx, '');
    const T = L.T, p = state.p, small = L.small, fs = L.fs;
    const bt = beatOf(state, { pid: 'burden', beat: 'burden-state' });
    const sp2 = bt === 'burden-split-2';                                            // the held figure; only its second stage plays
    const st = bt === 'burden-split' || sp2 ? 2 : bt === 'burden-metro' ? 1 : 0;
    const ph = (a, b) => st >= 1 ? 1 : sm(a, b, p), mm = (a, b) => st >= 2 ? 1 : st === 1 ? sm(a, b, p) : 0, ss = (a, b) => st === 2 ? (sp2 ? 1 : sm(a, b, p)) : 0;
    // burden-state / burden-metro: figure p = 0.05–0.25, tags and note in the second stage
    const aC = ph(0.05, 0.14), aHead = ph(0.1, 0.2), aRow = [ph(0.1, 0.2), ph(0.15, 0.25)], aTag = ph(0.25, 0.35), aNote = ph(0.32, 0.44);
    const mSplit = mm(0.05, 0.2), mNum = mm(0.12, 0.25), mOut = mm(0.05, 0.14), mTag = mm(0.25, 0.37), mNote = mm(0.32, 0.44);
    // burden-split: rows slide and the sums build, then the bars; labels, the average tag and the dimming in the second stage
    const nOut = ss(0.05, 0.1), uMove = ss(0.1, 0.2), nFo = ss(0.05, 0.11), nL2 = ss(0.13, 0.2), nL3 = ss(0.15, 0.22), u1 = ss(0.06, 0.14), uG = ss(0.11, 0.18), uT = ss(0.06, 0.16), uHo = ss(0.05, 0.11), uHdr = ss(0.14, 0.22), u2 = ss(0.14, 0.24), uBar = ss(0.16, 0.25);
    const aAvg = ss(0.25, 0.35), aLab = sp2 ? sm(0.27, 0.4, p) : 0, aLab2 = sp2 ? sm(0.33, 0.45, p) : 0;
    const x0 = L.pad, W = L.right - L.pad;
    const tight = small && L.h < 270;                                               // a short phone panel (about 320 x 568): the title goes, the source line says "Hypothetical counties"
    if (!tight) txt(L, L.g, x0, L.top + 14, 'Two made-up counties in the same state', { weight: 600, size: fs + 1, w: W });

    // layout of the worked lines: the one-line table when the two-part sum fits the panel, else a stacked sum per county
    const z0 = small ? 15 : L.w > 1100 ? 22 : 20, hz = small ? 12 : 13, nz = fs + 1, az = 12, barH = small ? 7 : 9;
    let C = burdenCols(z0), wide = true, z = z0;
    if (C.cT > W) { const zf = z0 * W * 0.985 / C.cT; if (zf >= 13.5) { z = zf; C = burdenCols(z); } else wide = false; }
    const rowH = z * 1.7;
    const stackA = z * 1.5;                                                   // stacked: one text line
    let S3 = null;
    if (!wide) {
      // the labels at the right of the two sums, longest first; the size is the largest at which a pair fits beside the sums, 12px at the least
      const LABS = [['what exposure alone predicts', 'the unusual part of the extra fuel cost'], ['what exposure alone predicts', 'unusual part of the extra fuel cost'], ['exposure alone predicts', 'unusual part of the extra fuel cost']];
      const trySize = zz => {
        const m = (s, w) => measure(s, zz, w), op = m('+') + zz * 0.5;
        const w3 = op + Math.max(m('1.5% × $0.10 = +0.15%'), m('0.5% × ' + MINUS + '$0.10 = ' + MINUS + '0.05%')), w2 = op + m('1.5% × $1.20 = 1.80%');
        for (const lb of LABS) if (w3 + measure(lb[1], az) + 16 <= W && w2 + measure(lb[0], az) + 16 <= W) return { op: op, w3: w3, w2: w2, lab1: lb[0], lab2: lb[1] };
        return null;
      };
      for (z = Math.min(z0, 13.5); z >= 12; z -= 0.5) if ((S3 = trySize(z))) break;
      if (!S3) { z = 12; S3 = trySize(12); }
      if (!S3) { const m = (s, w) => measure(s, 12, w), op = m('+') + 6; S3 = { op: op, w3: op + m('1.5% × $0.10 = +0.15%'), w2: op + m('1.5% × $1.20 = 1.80%'), lab1: LABS[2][0], lab2: LABS[2][1] }; }
    }
    const lh = z * (small ? 1.2 : 1.35), rowHs = wide ? rowH : lh * 3;                          // height of the sum part of one county's block
    // heights of the two county blocks (sum lines, bar, labels). On a phone the bar labels are drawn once, under County A, so County B's block is shorter
    const lone = small && !wide, labH = small ? 8 + az + 5 : 10 + az * 1.2 + 14;
    const blockHs = [rowHs + 2 + barH + labH, rowHs + 2 + barH + (lone ? 4 : labH)], blockH = blockHs[0];

    // vertical budget: the worked lines and the note are measured, the map takes the rest. The split's blocks are the tallest
    // state, and all three beats use its budget so the map stays put from one beat to the next
    const NOTE = ['within the state, the difference comes only from exposure', 'now the difference comes from exposure and from local prices'];
    const noteN = Math.max(wrap(NOTE[0], W, nz).length, wrap(NOTE[1], W, nz).length);
    const hdrH = (small ? 10 : 30) + hz + 8;
    const below = Math.max(hdrH + 2 * rowH + (small ? 4 : 10) + noteN * nz * 1.35, (small ? 14 : hdrH) + blockHs[0] + blockHs[1] + 2);
    const yMap0 = L.top + (tight ? 22 : small ? 38 : 60);                                       // phone: room above the map for the price tag that sits over the state
    const mapH = clamp(L.bottom + (small ? 4 : 0) - below - yMap0, small ? 64 : L.h < 480 ? 70 : 140, small ? 200 : 380);
    const yMap = yMap0 + clamp((L.bottom - below - yMap0 - mapH) / 2, 0, 90);                // centre the block when there is room
    const cramped = small || mapH < 170;                                             // a small map: short tags, above the outline
    const mapW = Math.min(W, mapH * (cramped ? 2 : 1.65)), mx = x0 + (W - mapW) / 2;
    const P = q => [mx + q[0] * mapW, yMap + q[1] * mapH];
    const closed = pts => 'M' + pts.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('L') + 'Z';
    const statePath = closed(B_STATE.map(P));

    // the state: one tint for one price; with local prices, two metro areas with their own tints and a thin border
    const clipId = 'dp-bclip';
    S(S(L.defs, 'clipPath', { id: clipId }), 'path', { d: statePath });
    const gm = S(L.g, 'g', { 'clip-path': 'url(#' + clipId + ')' });
    const tint0 = 0.11 * aC;
    S(gm, 'rect', { x: mx - 20, y: yMap - 20, width: mapW + 40, height: mapH + 40, fill: mix(T.bg, T.accent, tint0) });
    if (mSplit > 0.001) {
      const sp = B_SPLIT.map(P), far = mapW * 0.2;
      const left = [[mx - far, yMap - far]].concat(sp, [[mx - far, yMap + mapH + far]]);
      const right = sp.concat([[mx + mapW + far, yMap + mapH + far], [mx + mapW + far, yMap - far]]);
      const poly = pts => 'M' + pts.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('L') + 'Z';
      S(gm, 'path', { d: poly(left), fill: mix(T.bg, T.accent, lerp(0.11, 0.2, mSplit)) });
      S(gm, 'path', { d: poly(right), fill: mix(T.bg, T.accent, lerp(0.11, 0.05, mSplit)) });
      let len = 0; for (let i = 1; i < sp.length; i++) len += Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]);
      S(gm, 'path', { d: 'M' + sp.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('L'), fill: 'none', stroke: T.accent, 'stroke-width': 1.2, 'stroke-dasharray': len.toFixed(1), 'stroke-dashoffset': (len * (1 - mSplit)).toFixed(1) });
    }
    S(L.g, 'path', { d: statePath, fill: 'none', stroke: T.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' });

    // the two counties, coloured by their burden
    const bsc = d3.scaleLinear().domain([0, 1, 2]).range(T.burden || DEF_T.burden).interpolate(d3.interpolateLab).clamp(true);
    if (aC > 0.01) {
      const gc = grp(L.g, aC);
      ['A', 'B'].forEach((k, i) => {
        const pts = B_CTY[k].map(P), r = B6_ROWS[i], v = lerp(r.v0, r.v1, mNum);
        S(gc, 'path', { d: closed(pts), fill: bsc(v), stroke: T.bg, 'stroke-width': 1.5, 'stroke-linejoin': 'round' });
        const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
        const cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, cy = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
        const t = S(gc, 'text', { x: cx, y: cy + 4, 'font-size': small ? 12 : 13, 'font-weight': 600, fill: i === 0 ? T.bg : T.ink, 'text-anchor': 'middle' });
        const nm = Math.max.apply(null, xs) - Math.min.apply(null, xs), fz = small ? 12 : 13;
        t.textContent = measure(r.name, fz, 600) + 6 <= nm ? r.name : r.name.slice(-1);
      });
    }
    // price tags: one for the state, then one per metro area, then the comparable areas' average
    const tz = small ? 12 : 14;
    const yAvg = cramped ? yMap - 7 : yMap + mapH * 0.075;                          // phone: the whole tag sits above the outline, clear of the metro tags
    priceTag(L, L.g, mx + mapW * 0.5, yAvg, cramped ? '+$1.20 a gallon, statewide' : '+$1.20 a gallon, everywhere in the state', T.ink, tz, aTag * (1 - mOut));
    priceTag(L, L.g, mx + mapW * (cramped ? 0.25 : 0.27), yMap + mapH * 0.21, cramped ? '+$1.30' : '+$1.30 a gallon', T.accent, tz, mTag);
    priceTag(L, L.g, mx + mapW * (cramped ? 0.78 : 0.74), yMap + mapH * 0.24, cramped ? '+$1.10' : '+$1.10 a gallon', T.accent, tz, mTag);
    priceTag(L, L.g, mx + mapW * 0.5, yAvg, 'average rise of comparable areas: +$1.20', T.ink, tz, aAvg);

    /* ----- worked lines ----- */
    const yHead = yMap + mapH + (small ? 10 : 30) + hz, yBlk = small ? yMap + mapH + 8 : yHead + 8;      // the two-part blocks start under the map (on a phone there is no column head over them)
    const bxM = x0 + Math.max(0, (W - C.cB) / 2), bxW = x0 + Math.max(0, (W - C.cT) / 2), bx = lerp(bxM, bxW, uMove);
    const yM = i => yHead + 8 + rowH * (i + 0.75);                                // the one-line rows of burden-state / burden-metro
    const cell = (parent, x, y, str, o) => {
      if (o.op != null && o.op < 0.005) return null;
      const t = S(parent, 'text', { x: x, y: y, 'font-size': o.size || z, 'font-weight': o.weight || 400, fill: o.fill || T.ink, 'text-anchor': o.anchor || 'end', style: 'font-variant-numeric: tabular-nums', opacity: o.op == null ? 1 : o.op });
      t.textContent = str; return t;
    };
    const hdr = (parent, x, y, str, op, fill, anchor) => { const t = S(parent, 'text', { x: x, y: y, 'font-size': hz, fill: fill || T.muted, 'text-anchor': anchor || 'middle', opacity: op }); t.textContent = str; return t; };
    // column heads of the one-line table: they leave as the sums build
    if (aHead * (1 - uHo) > 0.01) {
      const gh = grp(L.g, aHead * (1 - uHo));
      [['exposure', bx + C.cE - C.eW / 2], ['×', bx + C.cX], ['price rise', bx + C.cP - C.pW / 2], ['=', bx + C.cQ]].forEach(h => hdr(gh, h[1], yHead, h[0]));
    }
    if (aHead > 0.01 && (wide || uHo < 1)) hdr(L.g, lerp(bxM + C.cB - C.bW / 2, bxW + C.cT - C.bW / 2, wide ? uT : 0), yHead, 'extra fuel cost', aHead * (wide ? 1 : 1 - uHo));
    const dim = 1 - 0.25 * aLab;                                                   // the grey (first) part dims in burden-split-2; muted text at 0.75 is 3.4:1 on the page

    // bar geometry (split): one bar per county on a common scale; stacked layout uses the full width
    const bar = (i, top, bx0, bx1) => {
      const r = B6_ROWS[i], sc = (bx1 - bx0) / 1.95 * uBar, gb = grp(L.g, uBar > 0.01 ? 1 : 0);
      const X = v => bx0 + v * sc;
      if (r.k1 > 0) {
        S(gb, 'rect', { x: X(0), y: top, width: Math.max(0, r.k0 * sc - 1), height: barH, fill: GREY, opacity: dim });
        S(gb, 'rect', { x: X(r.k0), y: top, width: r.k1 * sc, height: barH, fill: T.accent });
      } else {
        // County B: the unusual part is negative, so it is a notch cut back from the grey end
        S(gb, 'rect', { x: X(0), y: top, width: (r.k0 + r.k1) * sc, height: barH, fill: GREY, opacity: dim });
        S(gb, 'rect', { x: X(r.k0 + r.k1) + 0.6, y: top + 0.6, width: -r.k1 * sc - 1.2, height: barH - 1.2, fill: T.accentSoft, stroke: T.accent, 'stroke-width': 1.2, 'stroke-dasharray': '2 2' });
      }
      if (aLab > 0.01 && uBar > 0.99 && (!lone || i === 0)) {
        const yl = top + barH + (small ? 8 : 10) + az, ar = top + barH + 1, ga = grp(L.g, aLab), gc = grp(L.g, aLab2);
        txt(L, ga, bx0 + 2, yl, 'set aside', { size: az, fill: T.muted, weight: 500, noTop: true });
        arrow(L, ga, bx0 + 12, yl - az - 1, bx0 + 12, ar, { stroke: T.muted, gap: 1 });
        const str = 'the unusual part of the extra fuel cost', w = measure(str, az, 500);
        if (r.k1 > 0) {
          const cx = X(r.k0 + r.k1 / 2);
          txt(L, gc, bx1, yl, str, { size: az, fill: T.accent, weight: 500, anchor: 'end', noTop: true });
          arrow(L, gc, Math.min(cx, bx1 - 4), yl - az - 1, cx, ar, { stroke: T.accent, gap: 1 });
        } else {
          const cx = X(r.k0 + r.k1 / 2), lx = Math.max(bx0 + 70, cx - 6);
          txt(L, gc, lx, yl, str, { size: az, fill: T.accent, weight: 500, noTop: true });
          arrow(L, gc, Math.min(Math.max(cx, lx), lx + w - 4) - 0.01, yl - az - 1, cx, ar, { stroke: T.accent, gap: 1 });
        }
      }
    };

    B6_ROWS.forEach((r, i) => {
      if (aRow[i] < 0.01) return;
      const gr = grp(L.g, aRow[i]);
      const yo = yM(i);
      // the changed factor: a soft accent ground behind the new price, which is set in accent
      const dy = z * 0.4, uo = sm(0, 0.5, mNum), un = sm(0.5, 1, mNum);
      if (wide) {
        const Ti = yBlk + (i ? blockHs[0] : 0), ySum = Ti + rowH * 0.75, y = lerp(yo, ySum, uMove);
        cell(gr, bx, y, r.name, { anchor: 'start', weight: 600 });
        const fe = mix(T.ink, T.muted, u1);
        cell(gr, bx + C.cE, y, r.e, { fill: fe, op: dim });
        cell(gr, bx + C.cX, y, '×', { anchor: 'middle', fill: T.muted, op: dim });
        cell(gr, bx + C.cQ, y, '=', { anchor: 'middle', fill: T.muted, op: dim });
        if (mNum * (1 - u1) > 0.01) S(gr, 'rect', { x: bx + C.cP - C.pW - 5, y: y - z * 0.86, width: C.pW + 10, height: z * 1.18, rx: 3, fill: T.accentSoft, opacity: mNum * (1 - u1) });
        // the price: the metro rise leaves upwards as the average rise arrives from below; the burden 1.95% travels to the end of the sum
        if (st === 2) {
          cell(gr, bx + C.cP, y - dy * u1, r.p1, { op: 1 - u1, fill: T.accent, weight: 600 });
          cell(gr, bx + C.cP, y + dy * (1 - u1), r.p0, { op: u1 * dim, fill: T.muted });
          cell(gr, bx + C.cB, y, r.g, { op: uG * dim, fill: T.muted });
          cell(gr, lerp(bxM + C.cB, bxW + C.cT, uT), y, r.b1, { weight: 600 });
          if (u2 > 0.01) {
            const g2 = grp(gr, u2);
            cell(g2, bx + C.cPl, y, '+', { anchor: 'middle', fill: T.accent, weight: 600 });
            cell(g2, bx + C.cE2, y, r.e, { fill: T.accent });
            cell(g2, bx + C.cX2, y, '×', { anchor: 'middle', fill: T.accent });
            cell(g2, bx + C.cD, y, r.d, { fill: T.accent });
            cell(g2, bx + C.cQ2, y, '=', { anchor: 'middle', fill: T.accent });
            cell(g2, bx + C.cA, y, r.a, { fill: T.accent, weight: 600 });
            cell(g2, bx + C.cQ3, y, '=', { anchor: 'middle', fill: T.muted });
          }
        } else {
          if (uo < 0.99) { cell(gr, bx + C.cP, y - dy * uo, r.p0, { op: 1 - uo }); cell(gr, bx + C.cB, y - dy * uo, r.b0, { op: 1 - uo, weight: 600 }); }
          if (un > 0.01) { cell(gr, bx + C.cP, y + dy * (1 - un), r.p1, { op: un, fill: T.accent, weight: 600 }); cell(gr, bx + C.cB, y + dy * (1 - un), r.b1, { op: un, weight: 600 }); }
        }
        if (st === 2 && uBar > 0.01) bar(i, Ti + rowH + 2, bx + C.cE - C.eW, bx + C.cT);
      } else {
        // narrow panel: the burden-metro line stays as it is, then each county becomes a stacked sum
        const Ti = yBlk + (i ? blockHs[0] : 0), y1 = Ti + lh * 0.8, y2 = Ti + lh * 1.8, y3 = Ti + lh * 2.8, y = lerp(yo, y1, uMove);
        const xn = lerp(bxM, x0, uMove), xt = x0 + W, ind = x0 + S3.op, fo = 1 - nFo;
        cell(gr, xn, y, r.name, { anchor: 'start', weight: 600 });
        if (mNum * fo > 0.01) S(gr, 'rect', { x: bxM + C.cP - C.pW - 5, y: y - z * 0.86, width: C.pW + 10, height: z * 1.18, rx: 3, fill: T.accentSoft, opacity: mNum * fo });
        cell(gr, bxM + C.cE, y, r.e, { op: fo });
        cell(gr, bxM + C.cX, y, '×', { anchor: 'middle', fill: T.muted, op: fo });
        if (st === 2) {
          cell(gr, bxM + C.cP, y - dy * nFo, r.p1, { op: fo, fill: T.accent, weight: 600 });
          const xT = lerp(bxM + C.cB, xt, uT);
          cell(gr, xT, y, r.b1, { weight: 600 });
          cell(gr, bxM + C.cQ, y, '=', { anchor: 'middle', fill: T.muted, op: fo });
          cell(gr, xT - C.bW - z * 0.5, y, '=', { anchor: 'end', fill: T.muted, op: uT });
          const g2 = grp(gr, nL2), g3 = grp(gr, nL3);
          cell(g2, ind, y2, r.e + ' × ' + r.p0 + ' = ' + r.g, { anchor: 'start', fill: T.muted, op: dim });
          cell(g3, x0, y3, '+', { anchor: 'start', fill: T.accent, weight: 600 });
          cell(g3, ind, y3, r.e + ' × ' + r.d + ' = ' + r.a, { anchor: 'start', fill: T.accent });
          if (i === 0) {
            if (nL2 > 0.01) hdr(g2, xt, y2, S3.lab1, 1, T.muted, 'end').setAttribute('font-size', fz(az));
            if (nL3 > 0.01) hdr(g3, xt, y3, S3.lab2, 1, T.accent, 'end').setAttribute('font-size', fz(az));
          }
          if (uBar > 0.01) bar(i, Ti + rowHs + 2, x0, x0 + W);
        } else {
          if (uo < 0.99) { cell(gr, bxM + C.cP, y - dy * uo, r.p0, { op: 1 - uo }); cell(gr, bxM + C.cB, y - dy * uo, r.b0, { op: 1 - uo, weight: 600 }); }
          if (un > 0.01) { cell(gr, bxM + C.cP, y + dy * (1 - un), r.p1, { op: un, fill: T.accent, weight: 600 }); cell(gr, bxM + C.cB, y + dy * (1 - un), r.b1, { op: un, weight: 600 }); }
          cell(gr, bxM + C.cQ, y, '=', { anchor: 'middle', fill: T.muted });
        }
      }
    });
    // wide: the group heads over the two parts (with a thin rule), once, above the sums
    if (wide && st === 2 && uHdr > 0.01) {
      const gh = grp(L.g, uHdr), yr = yHead + 4;
      [['what exposure alone predicts', bx + C.cE - C.eW, bx + C.cB, T.muted, dim], [S3 ? S3.lab2 : 'the unusual part of the extra fuel cost', bx + C.cE2 - C.eW, bx + C.cA, T.accent, 1]].forEach((h, k) => {
        const hh = hdr(gh, (h[1] + h[2]) / 2, yHead, h[0], 1, h[3]); if (k === 0) hh.setAttribute('opacity', dim);
        line(L, gh, h[1], yr, h[2], yr, { stroke: h[3], w: 1.2, op: k === 0 ? dim : 1 });
      });
    }
    // the note under the rows (burden-state, burden-metro); it leaves as the split begins
    const yNote = yHead + 8 + rowH * 2 + (small ? 4 : 10) + nz;
    const nA = aNote * (1 - mNote) * (1 - nOut), nB = mNote * (1 - nOut);
    if (nA > 0.01) txt(L, L.g, x0 + W / 2, yNote, NOTE[0], { anchor: 'middle', size: nz, w: W, fill: T.ink }).el.setAttribute('opacity', nA);
    if (nB > 0.01) txt(L, L.g, x0 + W / 2, yNote, NOTE[1], { anchor: 'middle', size: nz, w: W, fill: T.accent }).el.setAttribute('opacity', nB);
  }

  /* ======================================================================
     burden (v7.2, beats burden-local, burden-split, burden-split-2): one continuous figure with two hypothetical counties.
       burden-local: a made-up state with two local markets (soft shapes), a price tag on each and a dot for each county; the worked lines
                     (exposure × the local price rise = extra fuel cost) come in the second stage.
       burden-split: starts from that picture. The group's average rise appears, the state shrinks to a strip at the top (v7.2, critique 3.2) and each
                     county's line becomes a two-part sum: what exposure alone predicts (grey, built over p 0.05-0.25) and exposure × the unusual
                     rise (accent) with the total (p 0.25-0.45, PI: the second column came too early on v6.3). A small bar per county shows the two parts.
       burden-split-2: the same figure held; only its last stage plays (the first part dims and is set aside; the second is the part the comparison uses).
     Colours (SPEC v7.2): violet = price (market tags, the local price in the sums), grey = set aside, accent = what the comparison uses, burden ramp = exposure.
     The v6 picture (state price, then metro prices) is kept above as renderBurdenV6, unrouted (panel 'burden-v6'). */
  const B7 = [
    { name: 'County A', e: '1.6%', p: '$1.15', t: '1.84%', g: '1.92%', d: MINUS + '$0.05', a: MINUS + '0.08%', ex: 1.6, gv: 1.92, av: -0.08 },
    { name: 'County B', e: '1.2%', p: '$1.30', t: '1.56%', g: '1.44%', d: '$0.10', a: '+0.12%', ex: 1.2, gv: 1.44, av: 0.12 }
  ];
  // the two markets in unit coordinates of the map: centre, radii, the county's dot, two other counties of the market (faint), the tag and the label
  const B7_MKT = [
    { c: [0.27, 0.52], rx: 0.17, ry: 0.24, dot: [0.27, 0.50], others: [[0.19, 0.63], [0.35, 0.39]], tag: '+$1.15', label: 'County A’s market' },
    { c: [0.73, 0.54], rx: 0.17, ry: 0.24, dot: [0.73, 0.52], others: [[0.82, 0.40], [0.65, 0.65]], tag: '+$1.30', label: 'County B’s market' }
  ];
  const B7_WOB = [1, 0.93, 1.05, 0.96, 1.02, 0.91, 1.04, 0.97];            // a soft, uneven outline
  const B7_SCALE = 2.0;                                                     // full length of a bar, in percent of income
  function renderBurden(g, state, ctx) {
    const L = setup(g, state, ctx, '');
    const T = L.T, p = state.p, small = L.small, fs = L.fs, PR = T.price[1];
    const bt = beatOf(state, { pid: 'burden', beat: 'burden-local' });
    const sp2 = bt === 'burden-split-2';                                            // the held figure; only its second stage plays
    const st = bt === 'burden-split' || sp2 ? 2 : 0;
    const ls = (a, b) => st >= 2 ? 1 : sm(a, b, p);                                 // burden-local's builds: finished from the split on
    const ss = (a, b) => st === 2 ? (sp2 ? 1 : sm(a, b, p)) : 0;                    // the split's builds
    // burden-local: the map over p = 0.05-0.25 (state, markets, dots, labels, tags), the worked lines in the second stage (fade over 0.25-0.32)
    const aSt = ls(0.05, 0.13), aMk = ls(0.09, 0.18), aDot = ls(0.13, 0.21), aMl = ls(0.15, 0.25), aTag = ls(0.17, 0.25);
    const aHead = ls(0.25, 0.32), aRow = [ls(0.25, 0.32), ls(0.27, 0.34)];
    // burden-split, first stage (p 0.05-0.25): the average tag, the state shrinking to a strip, the first column and its bar. Second stage
    // (0.25-0.45): the second column, the totals, the accent parts
    const uHo = ss(0.05, 0.11), uAvg = ss(0.05, 0.15), uMove = ss(0.05, 0.2), uP = ss(0.07, 0.17), uG = ss(0.1, 0.2), uHd1 = ss(0.18, 0.25), uBarG = ss(0.18, 0.25);
    const u2 = ss(0.25, 0.32), uHd2 = ss(0.25, 0.32), uT = ss(0.27, 0.34), uAcc = ss(0.3, 0.42), nL2 = ss(0.12, 0.22), nL3 = ss(0.25, 0.32);
    const aSet = sp2 ? sm(0.25, 0.32, p) : 0, aOnly = sp2 ? sm(0.29, 0.36, p) : 0;   // burden-split-2: "set aside", "the only part the comparison uses"
    const x0 = L.pad, W = L.right - L.pad;
    const tight = small && L.h < 270;                                               // a short phone panel (about 320 x 568): the title goes, the source line says "Hypothetical counties"
    if (!tight) figHead(L, L.g, 'Two made-up counties in the same state', 'Illustrative');

    // layout of the worked lines: the one-line table when the two-part sum fits the panel, else a stacked sum per county
    const z0 = small ? 15 : L.w > 1100 ? 22 : 20, hz = small ? 12 : L.w > 1100 ? 14 : 13, az = small ? 12 : 13, barH = small ? 7 : 14;
    let C = burdenCols(z0), wide = true, z = z0;
    if (C.cT > W) { const zf = z0 * W * 0.985 / C.cT; if (zf >= 13.5) { z = zf; C = burdenCols(z); } else wide = false; }
    const rowH = z * 1.7;                                                           // the one-line rows of burden-local
    let S3 = null;
    if (!wide) {
      // the labels at the right of the two sums, longest first; the size is the largest at which a pair fits beside the sums, 12px at the least
      const LABS = [['what exposure alone predicts', 'the unusual part of the extra fuel cost'], ['what exposure alone predicts', 'unusual part of the extra fuel cost'], ['exposure alone predicts', 'unusual part of the extra fuel cost']];
      const W3 = '1.6% × ' + MINUS + '$0.05 = ' + MINUS + '0.08%', W2 = '1.6% × $1.20 = 1.92%';
      const trySize = zz => {
        const m = (s, w) => measure(s, zz, w), op = m('+') + zz * 0.5;
        const w3 = op + m(W3), w2 = op + m(W2);
        for (const lb of LABS) if (w3 + measure(lb[1], az) + 16 <= W && w2 + measure(lb[0], az) + 16 <= W) return { op: op, w3: w3, w2: w2, lab1: lb[0], lab2: lb[1] };
        return null;
      };
      for (z = Math.min(z0, 13.5); z >= 12; z -= 0.5) if ((S3 = trySize(z))) break;
      if (!S3) { z = 12; S3 = trySize(12); }
      if (!S3) { const m = (s, w) => measure(s, 12, w), op = m('+') + 6; S3 = { op: op, w3: op + m(W3), w2: op + m(W2), lab1: LABS[2][0], lab2: LABS[2][1] }; }
    }
    const lh = z * (small ? 1.2 : 1.35), rowHsB = wide ? z * 2.2 : lh * 3;           // height of the sum part of one county's block in the split
    // heights of the two county blocks (sum lines, bar, labels). On a phone the bar labels are drawn once, under County A, so County B's block is shorter
    const lone = small && !wide, labH = small ? 8 + az + 5 : 10 + az * 1.2 + 14;
    const blockHs = [rowHsB + 2 + barH + labH, rowHsB + 2 + barH + (lone ? 4 : labH)];

    // vertical budget. Layout A (burden-local): a large map and the one-line rows. Layout B (the split): the state is a strip at the top; the
    // freed space goes to the sums, the bars and the gaps. The picture moves from A to B over p 0.05-0.2 of burden-split.
    const hdrBlock = hz * 1.2 * 2 + 8, gapMap = small ? 6 : 22;                                  // column heads take up to two lines
    const yMap0 = L.top + (tight ? 22 : small ? 52 : 60);
    const roomEnd = L.bottom + (small ? 4 : 0);
    const belowA = gapMap + hdrBlock + 2 * rowH + 4;
    const mapHA = clamp(roomEnd - belowA - yMap0, small ? 64 : L.h < 480 ? 70 : 140, small ? 190 : 340);
    const yMapA = yMap0 + clamp((roomEnd - belowA - yMap0 - mapHA) / 2, 0, 90);                // centre the block when there is room
    const mapWA = Math.min(W, mapHA * (mapHA < 110 ? 3.6 : small || mapHA < 170 ? 2 : 1.65));
    const belowB = gapMap + (small ? 8 : hdrBlock) + blockHs[0] + blockHs[1] + 2;
    const stripH = clamp(roomEnd - yMap0 - belowB, 56, small ? (tight ? 60 : 78) : clamp(L.h * 0.2, 104, 160));
    const extra = Math.max(0, roomEnd - yMap0 - stripH - belowB);
    const gapB = gapMap + Math.min(extra * 0.35, small ? 10 : 60), blkGap = Math.min(extra * 0.35, small ? 12 : 80);
    const mapWB = Math.min(W, stripH * (small ? 4.4 : 6));
    const mapH = lerp(mapHA, stripH, uMove), yMap = lerp(yMapA, yMap0, uMove), mapW = lerp(mapWA, mapWB, uMove), mx = x0 + (W - mapW) / 2;
    const P = q => [mx + q[0] * mapW, yMap + q[1] * mapH];
    const closed = pts => 'M' + pts.map(q => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join('L') + 'Z';

    // the state (a neutral tint), then the two markets as soft shapes in the price colour
    const stateG = grp(L.g, aSt);
    S(stateG, 'path', { d: closed(B_STATE.map(P)), fill: mix(T.bg, T.muted, 0.06), stroke: T.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
    const blob = m => {
      const cx = m.c[0], cy = m.c[1], n = B7_WOB.length;
      const pts = B7_WOB.map((w, k) => P([cx + m.rx * w * Math.cos(k / n * 2 * Math.PI), cy + m.ry * w * Math.sin(k / n * 2 * Math.PI)]));
      return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.6))(pts);
    };
    const ramp = d3.scaleLinear().domain([0, 0.5, 1]).range(T.burden || DEF_T.burden).interpolate(d3.interpolateLab).clamp(true);
    const expCol = v => ramp((v - 1.0) / 0.8);                                      // exposure 1.2% reads light, 1.6% dark
    const dotR = clamp(mapW * 0.028, small ? 3 : 7, small ? 6 : 12), fz = small ? 12 : 13;
    B7_MKT.forEach((m, i) => {
      if (aMk > 0.01) {
        const gm = grp(L.g, aMk);
        S(gm, 'path', { d: blob(m), fill: mix(T.bg, PR, 0.12), stroke: mix(T.bg, PR, 0.5), 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
        m.others.forEach(o => { const q = P(o); S(gm, 'circle', { cx: q[0], cy: q[1], r: small ? 3 : 3.6, fill: T.bg, stroke: T.muted, 'stroke-width': 1, opacity: 0.8 }); });
      }
      if (aDot > 0.01) {
        const gd = grp(L.g, aDot), q = P(m.dot), r = dotR * (0.4 + 0.6 * aDot);
        S(gd, 'circle', { cx: q[0], cy: q[1], r: r, fill: expCol(B7[i].ex), stroke: T.bg, 'stroke-width': 1.5 });
        const t = S(gd, 'text', { x: q[0], y: q[1] + fz * 0.36, 'font-size': fz, 'font-weight': 600, fill: i === 0 ? _T().onAccent : T.ink, 'text-anchor': 'middle', opacity: aDot });
        t.textContent = i ? 'B' : 'A';
      }
      if (aMl > 0.01) {
        const q = P([m.c[0], Math.min(0.93, m.c[1] + m.ry + 0.12)]);
        txt(L, L.g, q[0], q[1], m.label, { anchor: 'middle', size: small ? 12 : 13, fill: T.muted, w: Math.max(mapW * 0.42, 104) }).el.setAttribute('opacity', aMl);
      }
    });
    // price tags in the price colour: one per market, then (burden-split) the group's average
    const tz = small ? 12 : 14;
    B7_MKT.forEach(m => { const q = P([m.c[0], m.c[1] - m.ry]); priceTag(L, L.g, q[0], q[1] - 13, m.tag, PR, tz, aTag); });
    priceTag(L, L.g, mx + mapW * 0.5, yMap - (mapH < 110 ? 20 : 8), 'the group’s average rise: +$1.20', PR, tz, uAvg);

    /* ----- worked lines ----- */
    const yRows0A = yMapA + mapHA + gapMap + hdrBlock, yHBA = yRows0A - 6;            // A: the one-line rows and their heads; yHB: baseline of the last line of a head
    const yRows0B = yMap0 + stripH + gapB + hdrBlock, yHBB = yRows0B - 6;             // B: the two-part blocks
    const yBlk = small ? yMap0 + stripH + 8 + (gapB - gapMap) : yRows0B;               // on a phone the blocks start under the strip (no column head over them)
    const bxM = x0 + Math.max(0, (W - C.cB) / 2), bxW = x0 + Math.max(0, (W - C.cT) / 2), bx = lerp(bxM, bxW, uMove);
    const yM = i => yRows0A + rowH * (i + 0.75);
    const cell = (parent, x, y, str, o) => {
      if (o.op != null && o.op < 0.005) return null;
      const t = S(parent, 'text', { x: x, y: y, 'font-size': o.size || z, 'font-weight': o.weight || 400, fill: o.fill || T.ink, 'text-anchor': o.anchor || 'end', style: 'font-variant-numeric: tabular-nums', opacity: o.op == null ? 1 : o.op });
      t.textContent = str; return t;
    };
    // a column head, bottom-aligned at baseline yb, wrapped to maxW (at most two lines)
    const hdr = (parent, cx, yb, str, maxW, op, fill, size) => {
      const sz = size || hz, ln = wrap(str, maxW, sz), lhh = sz * 1.2, t = S(parent, 'text', { 'font-size': sz, fill: fill || T.muted, 'text-anchor': 'middle', opacity: op });
      ln.forEach((l, k) => { const ts = S(t, 'tspan', { x: cx, y: yb - (ln.length - 1 - k) * lhh }); ts.textContent = l; });
      return t;
    };
    // burden-local: the three column heads, once; they leave as the split begins
    const spE = (C.cP - C.pW / 2) - (C.cE - C.eW / 2);
    if (aHead * (1 - uHo) > 0.01) {
      const gh = grp(L.g, aHead * (1 - uHo));
      hdr(gh, bxM + C.cE - C.eW / 2, yHBA, 'cost of a $1 rise', spE - 6, 1);
      hdr(gh, bxM + C.cP - C.pW / 2, yHBA, 'local price rise', spE - 6, 1);
      hdr(gh, bxM + C.cB - C.bW / 2, yHBA, 'extra fuel cost', Math.max(spE - 6, C.bW + 16), 1);
    }
    const dim = 1 - 0.25 * aSet;                                                   // the grey (first) part dims in burden-split-2; muted text at 0.75 is 3.4:1 on the page

    // bar geometry (split): one bar per county on a common scale. Grey: what exposure alone predicts; accent: exposure × the unusual rise
    // (a notch cut back from the grey end when it is negative)
    const bar = (i, top, bx0, bx1) => {
      const r = B7[i], sc = (bx1 - bx0) / B7_SCALE, gb = grp(L.g, uBarG > 0.01 ? 1 : 0), X = v => bx0 + v * sc;
      const gEnd = r.av < 0 ? r.gv + r.av * uAcc : r.gv;
      S(gb, 'rect', { x: X(0), y: top, width: Math.max(0, gEnd * sc * uBarG - (r.av > 0 && uAcc > 0.01 ? 1 : 0)), height: barH, fill: GREY, opacity: dim });
      if (uAcc > 0.01) {
        if (r.av > 0) S(gb, 'rect', { x: X(r.gv), y: top, width: r.av * sc * uAcc, height: barH, fill: T.accent });
        else S(gb, 'rect', { x: X(gEnd) + 0.6, y: top + 0.6, width: Math.max(0, -r.av * sc * uAcc - 1.2), height: barH - 1.2, fill: T.accentSoft, stroke: T.accent, 'stroke-width': 1.2, 'stroke-dasharray': '2 2' });
      }
      if (aSet > 0.01 && (!lone || i === 0)) {
        const yl = top + barH + (small ? 8 : 10) + az, ar = top + barH + 1, ga = grp(L.g, aSet), gc = grp(L.g, aOnly);
        txt(L, ga, bx0 + 2, yl, 'set aside', { size: az, fill: T.muted, weight: 500, noTop: true });
        arrow(L, ga, bx0 + 12, yl - az - 1, bx0 + 12, ar, { stroke: T.muted, gap: 1 });
        const str = 'the unusual part of the extra fuel cost', w = measure(str, az, 500), k0 = r.gv + Math.min(r.av, 0);
        const cx = X(k0 + Math.abs(r.av) / 2);
        if (r.av > 0) {
          txt(L, gc, bx1, yl, str, { size: az, fill: T.accent, weight: 500, anchor: 'end', noTop: true });
          arrow(L, gc, Math.min(cx, bx1 - 4), yl - az - 1, cx, ar, { stroke: T.accent, gap: 1 });
        } else {
          const lx = Math.max(bx0 + 70, cx - 6);
          txt(L, gc, lx, yl, str, { size: az, fill: T.accent, weight: 500, noTop: true });
          arrow(L, gc, Math.min(Math.max(cx, lx), lx + w - 4) - 0.01, yl - az - 1, cx, ar, { stroke: T.accent, gap: 1 });
        }
      }
    };

    B7.forEach((r, i) => {
      if (aRow[i] < 0.01) return;
      const gr = grp(L.g, aRow[i]);
      const yo = yM(i), Ti = yBlk + (i ? blockHs[0] + blkGap : 0);
      if (wide) {
        const ySum = Ti + rowHsB * 0.75, y = lerp(yo, ySum, uMove);
        cell(gr, bx, y, r.name, { anchor: 'start', weight: 600 });
        cell(gr, bx + C.cE, y, r.e, { fill: mix(T.ink, T.muted, uG), op: dim });
        cell(gr, bx + C.cX, y, '×', { anchor: 'middle', fill: T.muted, op: dim });
        cell(gr, bx + C.cQ, y, '=', { anchor: 'middle', fill: T.muted, op: dim });
        // the price: the market's rise (violet) leaves upwards as the group's average (grey, set aside) arrives from below; the result 1.84% gives way to what exposure alone predicts
        cell(gr, bx + C.cP, y - z * 0.4 * uP, r.p, { op: 1 - uP, fill: PR });
        cell(gr, bx + C.cP, y + z * 0.4 * (1 - uP), '$1.20', { op: uP * dim, fill: T.muted });
        cell(gr, bx + C.cB, y - z * 0.4 * uG, r.t, { op: 1 - uG, weight: 600 });
        cell(gr, bx + C.cB, y + z * 0.4 * (1 - uG), r.g, { op: uG * dim, fill: T.muted });
        if (u2 > 0.01) {
          const g2 = grp(gr, u2);
          cell(g2, bx + C.cPl, y, '+', { anchor: 'middle', fill: T.accent, weight: 600 });
          cell(g2, bx + C.cE2, y, r.e, { fill: T.accent });
          cell(g2, bx + C.cX2, y, '×', { anchor: 'middle', fill: T.accent });
          cell(g2, bx + C.cD, y, r.d, { fill: T.accent });
          cell(g2, bx + C.cQ2, y, '=', { anchor: 'middle', fill: T.accent });
          cell(g2, bx + C.cA, y, r.a, { fill: T.accent, weight: 600 });
        }
        if (uT > 0.01) {
          const gt = grp(gr, uT);
          cell(gt, bx + C.cQ3, y, '=', { anchor: 'middle', fill: T.muted });
          cell(gt, bx + C.cT, y, r.t, { weight: 600 });
        }
        if (st === 2 && uBarG > 0.01) bar(i, Ti + rowHsB + 2, bx + C.cE - C.eW, bx + C.cT);
      } else {
        // narrow panel: the burden-local line stays as it is, then each county becomes a stacked sum
        const y1 = Ti + lh * 0.8, y2 = Ti + lh * 1.8, y3 = Ti + lh * 2.8, y = lerp(yo, y1, uMove);
        const xn = lerp(bxM, x0, uMove), xt = x0 + W, ind = x0 + S3.op, fo = 1 - uHo;
        cell(gr, xn, y, r.name, { anchor: 'start', weight: 600 });
        cell(gr, bxM + C.cE, y, r.e, { op: fo });
        cell(gr, bxM + C.cX, y, '×', { anchor: 'middle', fill: T.muted, op: fo });
        cell(gr, bxM + C.cP, y, r.p, { op: fo, fill: PR });
        cell(gr, bxM + C.cQ, y, '=', { anchor: 'middle', fill: T.muted, op: fo });
        cell(gr, bxM + C.cB, y, r.t, { weight: 600, op: fo });
        if (st === 2) {
          cell(gr, xt, y, r.t, { weight: 600, op: uT });
          cell(gr, xt - C.bW - z * 0.5, y, '=', { anchor: 'end', fill: T.muted, op: uT });
          if (nL2 > 0.01) {
            const g2 = grp(gr, nL2);
            cell(g2, ind, y2, r.e + ' × $1.20 = ' + r.g, { anchor: 'start', fill: T.muted, op: dim });
            if (i === 0) { const h = S(g2, 'text', { x: xt, y: y2, 'font-size': az, fill: T.muted, 'text-anchor': 'end' }); h.textContent = S3.lab1; }
          }
          if (nL3 > 0.01) {
            const g3 = grp(gr, nL3);
            cell(g3, x0, y3, '+', { anchor: 'start', fill: T.accent, weight: 600 });
            cell(g3, ind, y3, r.e + ' × ' + r.d + ' = ' + r.a, { anchor: 'start', fill: T.accent });
            if (i === 0) { const h = S(g3, 'text', { x: xt, y: y3, 'font-size': az, fill: T.accent, 'text-anchor': 'end' }); h.textContent = S3.lab2; }
          }
          if (uBarG > 0.01) bar(i, Ti + rowHsB + 2, x0, x0 + W);
        }
      }
    });
    // wide: the group heads over the two parts (with a thin rule), and over the total
    if (wide && st === 2) {
      const yr = yHBB + 4;
      if (uHd1 > 0.01) {
        const gh = grp(L.g, uHd1 * dim), x1 = bx + C.cE - C.eW, x2 = bx + C.cB;
        hdr(gh, (x1 + x2) / 2, yHBB, 'what exposure alone predicts', x2 - x1 + 24, 1);
        line(L, gh, x1, yr, x2, yr, { stroke: T.muted, w: 1.2 });
      }
      if (uHd2 > 0.01) {
        const gh = grp(L.g, uHd2), x1 = bx + C.cE2 - C.eW, x2 = bx + C.cA;
        hdr(gh, (x1 + x2) / 2, yHBB, 'the unusual part of the extra fuel cost', x2 - x1 + 24, 1, T.accent);
        line(L, gh, x1, yr, x2, yr, { stroke: T.accent, w: 1.2 });
      }
      if (uT > 0.01) hdr(grp(L.g, uT), bx + C.cT - C.bW / 2, yHBB, 'extra fuel cost', Math.max(spE - 6, C.bW + 16), 1);
    }
  }

  /* ======================================================================
     The bar figure of the group (beats unusual, unusual-why; the backdrop of exposure-scale and both-sides-total): one group of four nearby
     markets, anonymised "Market 1" to "Market 4", with a line at the group's average rise. A transformation beat (SPEC v7.2 §7), in three steps:
       1. p 0.05-0.25: the "before" picture builds with its labels: the bars, the title and tag, the average line and its label
          "the group's average rise: +$1.20". It holds until p 0.30.
       2. p 0.30-0.42: the bars are re-based so that each becomes its deviation from the average.
       3. by p 0.50: "the unusual part of the rise" (bracket and label) and the deviation labels.
     Colours: price = violet (bars; a deviation below the average is the slate `priceLow`), the unusual part = accent.
     All price rises are illustrative simulated local prices; Market 1 and Market 2 are the markets of County A and County B (a note under each), so
     the numbers match burden-local and burden-split: rises of $1.15 and $1.30, group average $1.20, unusual parts -5, +10, -2 and -3 cents. */
  const MK = [['Market 1', 1.15, 'County A’s market'], ['Market 2', 1.30, 'County B’s market'], ['Market 3', 1.18, ''], ['Market 4', 1.17, '']];
  const MK_AVG = 1.20;
  const cents = v => (v < 0 ? MINUS : '+') + Math.round(Math.abs(v) * 100) + '¢';

  function renderStatesCore(g, state, ctx) {
    const L = setup(g, state, ctx, '');
    const T = L.T, p = state.p, fs = L.fs, small = L.small, n = MK.length, PR = T.price[1], PL = T.priceLow;
    const bt = state.beat || state.id || 'unusual-rise';
    const isWhy = bt === 'unusual-why', phone = L.phone, restore = phone && window.innerHeight > window.innerWidth && (bt === 'unusual' || isWhy);
    // unusual-why holds the finished deviation picture and adds an annotation box
    const aTit = (isWhy ? 1 : sm(0.05, 0.13, p)) * (state.headOp == null ? 1 : state.headOp);
    const grow = isWhy ? 1 : clamp((p - 0.06) / 0.11, 0, 1), aLine = isWhy ? 1 : sm(0.35, 0.41, p), aAvg = (isWhy ? 1 : sm(0.39, 0.45, p)) * (state.annOp == null ? 1 : state.annOp);
    const s = isWhy ? 1 : sm(0.46, 0.60, p), aDiff = isWhy ? 1 : sm(0.60, 0.66, p);   // PI 2026-10-29: the averaging after the bars have risen, while the example is read (was line 0.14, re-base 0.30-0.42)
    const aAnn = (restore ? aAvg : aDiff) * (state.annOp == null ? 1 : state.annOp);
    const vals = MK.map(d => d[1]), avg = MK_AVG;

    // heading: title, boxed tag, and a subtitle with the units (it changes with the re-basing)
    const hd = figHead(L, L.g, phone ? 'Four local markets' : 'A made-up group of four nearby markets', phone && L.w < 520 ? null : 'Illustrative', null, state.noTag ? 0 : aTit);
    hd.title.el.setAttribute('opacity', aTit);
    const HM = groupHeadMetrics(L), subY = HM.subYd, subS = L.small ? 12 : 13;             // v9.4: where the group's key sits in the later beats
    const ax1 = txt(L, L.g, L.pad, subY, 'Price rise since 2024, $ per gallon', { fill: T.muted, size: subS, w: L.right - L.pad });
    ax1.el.setAttribute('opacity', (isWhy ? 0 : 1 - sm(0.48, 0.53, p)) * (state.headOp == null ? 1 : state.headOp));
    const ax2 = txt(L, L.g, L.pad, subY, 'Unusual part of the rise, cents per gallon', { fill: T.muted, size: subS, w: L.right - L.pad });
    ax2.el.setAttribute('opacity', (isWhy ? 1 : sm(0.53, 0.58, p)) * (state.headOp == null ? 1 : state.headOp));

    const x0 = L.pad + (small ? 38 : 50), sideRoom = small ? 0 : clamp((L.right - L.pad) * 0.1, 40, 90);     // v9.4: the side room of the old annotation box is gone
    const x1 = L.right - sideRoom - 14, yT = HM.subY + (restore ? 56 : phone ? 24 : small ? 28 : 36);
    const noteRoom = phone ? 26 : small ? 140 : 40; // room for the shared market labels and the phone annotation box
    const plotH = Math.max(phone ? 48 : small ? 70 : 120, Math.min(L.bottom - noteRoom - yT, L.w * 0.62));
    const labelsH = small ? 17 : 20, bandH = 2 * (small ? 8 : 10.5) + 10, dropH = small ? 12 : 46;
    const plotHs = phone ? Math.max(32, L.bottom - (L.bottom - L.top < 300 ? 62 : 84) - (HM.subY + 20)) : Math.max(60, (plotH - (labelsH + bandH + dropH)) * (small ? 0.78 : 0.62));        // v9.4: squashed further in exposure-scale
    const sq = clamp(state.sq || 0, 0, 1), plotHEff = lerp(plotH, plotHs, sq), plotTop = phone ? lerp(yT, HM.subY + 20, sq) : yT, yB = plotTop + plotHEff;
    const oR = isWhy ? 0 : 1 - sm(0.48, 0.53, p), oD = isWhy ? 1 : sm(0.53, 0.58, p);
    const D = 0.17, lo = lerp(0, avg - D, s), hi = lerp(1.6, avg + D, s);
    const Y = v => yB - (v - lo) / (hi - lo) * plotHEff;
    const slot = (x1 - x0) / n, bw = Math.min(slot * (small ? 0.7 : 0.62), 96);

    // gridlines and tick labels: raw values fade out as the deviations fade in. v9.4: state.chartOp fades everything but the bars (both-sides-total
    // shrinks the bars into its column headers while the rest of the chart goes), and state.barsFn draws other bars in their place in the drawing order
    const co = state.chartOp == null ? 1 : state.chartOp;
    const gr = grp(L.g, co);
    (phone && plotHEff < 85 ? [0, 1.0] : [0, 0.5, 1.0, 1.5]).forEach(v => {
      const op = oR; if (op < 0.02 || Y(v) < plotTop - 1 || Y(v) > yB + 1) return;
      line(L, gr, x0, Y(v), x1, Y(v), { stroke: T.rule, op: op * (v === 0 ? 1 : 0.8) });
      txt(L, gr, x0 - 6, Y(v) + 4, v === 0 ? '$0' : '$' + v.toFixed(2), { anchor: 'end', fill: T.muted, size: L.fsm, halo: 0 }).el.setAttribute('opacity', op);
    });
    ((window.innerWidth < 900 && L.w < 900 ? plotHEff : plotH) / ((hi - lo) / 0.05) >= (phone ? 17 : 15) || !(oD > 0) ? [-0.1, -0.05, 0, 0.05, 0.1] : [-0.1, 0, 0.1]).forEach(d => {
      const op = oD * (small && Math.abs(d) === 0.05 ? 1 - clamp((state.sq || 0) / 0.45, 0, 1) : 1);
      if (op < 0.02 || Y(avg + d) < plotTop - 1 || Y(avg + d) > yB + 1) return;
      if (d !== 0) line(L, gr, x0, Y(avg + d), x1, Y(avg + d), { stroke: T.rule, op: op * 0.8 });
      txt(L, gr, x0 - 6, Y(avg + d) + 4, d === 0 ? '0' : cents(d), { anchor: 'end', fill: T.muted, size: L.fsm, halo: 0 }).el.setAttribute('opacity', op);
    });

    // bars, with their values: the rise inside the bar at its foot (white on the violet; the average line crosses the bars higher up), then
    // the unusual part at the tip (above a bar that is above the average, below one that is below)
    const gb = grp(L.g), gbl = grp(L.g, co), base = lerp(0, avg, s), vz = small ? 12 : 13, geo = { bars: [] };
    MK.forEach((d, i) => {
      const bi = sm(i / n * 0.5, i / n * 0.5 + 0.5, grow), v = vals[i] * bi, dev = vals[i] - avg;
      const yA = Y(base), yV = Y(v), col = mix(PR, dev >= 0 ? PR : PL, s), cx = x0 + slot * (i + 0.5);
      geo.bars.push({ x: cx - bw / 2, y: Math.min(yA, yV), w: bw, h: Math.max(0.5, Math.abs(yA - yV)), fill: col });
      if (!state.noBars) S(gb, 'rect', { x: cx - bw / 2, y: Math.min(yA, yV), width: bw, height: Math.max(0.5, Math.abs(yA - yV)), fill: col });
      txt(L, gbl, cx, yB + (L.tiny ? 30 : phone ? 20 : small ? 14 : 17), d[0], { anchor: 'middle', size: L.fsm, fill: T.ink, halo: 0, minX: 0, maxX: L.w });
      if (bi > 0.9 && oR > 0.02) txt(L, gbl, cx, phone ? yV - 7 : Y(base) - 8, sgn(vals[i]), { anchor: 'middle', size: vz, weight: 600, fill: phone ? T.ink : _T().onAccent, tnum: true, halo: 0, minX: 0, maxX: L.w }).el.setAttribute('opacity', oR);
      if (bi > 0.9 && aDiff > 0.02 && !(phone && sq > 0.5 && dev < 0)) txt(L, gbl, cx, dev >= 0 ? yV - 6 : yV + vz + 4, cents(dev), { anchor: 'middle', size: vz, weight: 600, fill: T.ink, tnum: true, minX: 0, maxX: L.w }).el.setAttribute('opacity', aDiff);
    });
    if (state.barsFn) state.barsFn(gb);
    line(L, gbl, x0, Y(base), x1, Y(base), { stroke: T.muted, w: 1, op: oR });

    // the group's average line and its label, part of the "before" picture
    const yAvg = Y(avg);
    if (aLine * co > 0.01) line(L, grp(L.g, aLine * co), x0, yAvg, x1, yAvg, { stroke: T.ink, w: 1.6 });
    if (restore && aAvg > 0.01 && !isWhy) {
      const ga = grp(L.g, aAvg * co), lab = txt(L, ga, L.pad, subY + 19, 'the group’s average rise:\n+$1.20', { size: 12, weight: 500, halo: 0, w: 170 });
      arrow(L, ga, x0 + 6, lab.y1 + 5, x0 + 6, yAvg, { gap: 3 });
    }
    if (aAvg > 0.01 && !phone) {
      const ga = grp(L.g, aAvg * co);
      // the label sits left of Market 2's bar, in as few lines as the room allows (line breaks only between phrases)
      const room = x0 + slot * 1.5 - bw / 2 - 10 - (x0 + 6);
      const opts = ['the group’s average rise: +$1.20', 'the group’s average rise:\n+$1.20', 'the group’s average\nrise: +$1.20', 'the group’s\naverage rise:\n+$1.20'];
      const str = opts.find(o => o.split('\n').every(l => measure(l, fs, 500) <= room)) || opts[3], nl = str.split('\n').length;
      const lab = txt(L, ga, x0 + 6, Math.max(yAvg - (small ? 22 : 26) - (nl - 1) * fs * 1.3, subY + 8 + fs), str, { weight: 500, size: fs });   // never up into the units line
      arrow(L, ga, lab.x0 + 22, lab.y1 + 2, lab.x0 + 22, yAvg, { gap: 2 });
    }
    // the unusual part: a bracket on the largest one (Market 2), with an arrow label at its right
    if (aAnn > 0.01) {
      const gd = grp(L.g, aAnn * co), i = 1, cx = x0 + slot * (i + 0.5), bx = cx + bw / 2 + 6, yTop = Y(vals[i]), dev = vals[i] - avg;
      line(L, gd, bx, yAvg, bx, yTop, { stroke: T.accent, w: 1.6 });
      line(L, gd, bx - 3, yAvg, bx + 3, yAvg, { stroke: T.accent, w: 1.6 });
      line(L, gd, bx - 3, yTop, bx + 3, yTop, { stroke: T.accent, w: 1.6 });
      if (restore) {
        const str = 'the unusual part\nof the rise', x = L.right - 118, y = subY + 19;
        const lab = txt(L, gd, x, y, str, { size: 12, weight: 500, fill: T.accent, halo: 0, w: 118 });
        const plate = S(gd, 'rect', { x: lab.x0 - 4, y: lab.y0 - 3, width: lab.w + 8, height: lab.y1 - lab.y0 + 6, fill: T.bg }); gd.insertBefore(plate, lab.el);
        arrow(L, gd, lab.x0 + 8, lab.y1 + 4, bx + 3, (yAvg + yTop) / 2, { stroke: T.accent, gap: 2 });
      }
      if (!phone) {
      const str = small ? 'the unusual part\nof the rise' : 'the unusual part of the rise\n(' + cents(dev) + ' for Market 2)';
      const lw = Math.max(90, x1 - bx - 22), nl = wrap(str, lw, fs, 500).length;        // above the zero line, clear of the bars of Markets 3 and 4 that hang below it
      const lab = txt(L, gd, bx + 22, Math.min((yAvg + yTop) / 2 - (small ? 4 : 2), yAvg - 8 - (nl - 1) * fs * 1.3), str, { weight: 500, size: fs, fill: T.accent, w: lw });
      arrow(L, gd, lab.x0 - 3, lab.y0 + (small ? 6 : 8), bx + 3, (yAvg + yTop) / 2, { stroke: T.accent, gap: 2 });
      }
    }
    // unusual-why: no annotation box on the figure (v9.2: the text carries the reasoning)
    Object.assign(geo, { x0: x0, x1: x1, slot: slot, bw: bw, yT: yT, yB: yB, plotH: plotHEff, small: small });
    return geo;
  }

  function renderStates(g, state, ctx) {
    const bt = state.beat || state.id;
    if (!(window.ENGINE && window.ENGINE.reducedMotion) || bt === 'unusual-why') return renderStatesCore(g, state, ctx);
    // cross-fade the before (p=0.48, just before the rebase) and after (p=0.64, labels done) over the motion's window
    const fade = sm(0.48, 0.64, state.p);
    if (fade < 0.001) return renderStatesCore(g, state, ctx);
    if (fade > 0.999) return renderStatesCore(g, state, ctx);
    g.node().setAttribute('opacity', ctx.opacity == null ? 1 : ctx.opacity);
    const oA = 1 - sm(0.4, 0.5, fade), oB = sm(0.5, 0.6, fade);
    renderStatesCore(d3.select(grp(g.node())), Object.assign({}, state, { p: 0.48 }), Object.assign({}, ctx, { opacity: oA }));
    renderStatesCore(d3.select(grp(g.node())), Object.assign({}, state, { p: 0.64 }), Object.assign({}, ctx, { opacity: oB }));
  }

  /* ======================================================================
     checks: two panels. Check 1, a binned scatter with a flat fit; check 2, a four-row coefficient plot.
     Illustrative numbers, clearly null: ten bin means from a seeded generator, four hand-set estimates. */
  const CHK2 = [['2024 Republican margin', 0.06, 0.11], ['Oil and gas jobs', -0.09, 0.13], ['Percentage gas tax', 0.04, 0.12], ['Earlier exposure gap', -0.02, 0.10]];
  function chk1Data() {
    const rnd = mulberry(20261101), ys = [];
    for (let i = 0; i < 10; i++) ys.push(0.1 * gauss(rnd));
    const mx = 4.5, my = ys.reduce((a, b) => a + b, 0) / 10;
    let sxy = 0, sxx = 0; ys.forEach((y, i) => { sxy += (i - mx) * (y - my); sxx += (i - mx) * (i - mx); });
    const b = sxy / sxx; return { ys: ys, b: b, a: my - b * mx };
  }

  const CHK_DIM = 0.75;  // the first chart while the second is introduced: muted text at 0.75 is 3.4:1 on the page (0.7 would be 2.96)
  const CHK_OFF = 0.3;   // the second chart before it is introduced (not yet meant to be read)
  function renderChecks(g, state, ctx) {
    const L = setup(g, state, ctx, '');
    const T = L.T, p = state.p, fs = L.fs, fm = L.fsm, small = L.small || L.h < 520;                 // a short panel stacks the charts like a phone
    // one panel across checks (first chart), checks-2 (second chart comes up) and checks-3 (both, with the expect/conclude rows)
    const ks = { 'checks-3': 2, 'checks-2': 1 }[beatOf(state, { pid: 'checks', beat: 'checks' })] || 0;
    const bd = (a, b) => ks > 0 ? 1 : sm(a, b, p);                                    // the builds finish in `checks`; the later beats start from the finished picture
    const aDots = ks > 0 ? 1 : clamp((p - 0.05) / 0.12, 0, 1), aFit = bd(0.14, 0.22), aTit = bd(0.25, 0.33), aBad = bd(0.26, 0.34), aArr = bd(0.27, 0.38);
    const aArr2 = ks === 0 ? 0 : ks === 1 ? sm(0.25, 0.38, p) : 1, aRow = ks === 2 ? sm(0.25, 0.4, p) : 0;
    const eMove = sm(0.05, 0.25, p);
    const e1 = ks === 0 ? 1 : ks === 1 ? lerp(1, CHK_DIM, eMove) : lerp(CHK_DIM, 1, eMove);
    const e2 = ks === 0 ? CHK_OFF : ks === 1 ? lerp(CHK_OFF, 1, eMove) : 1;
    const G1 = grp(L.g, e1), G2 = grp(L.g, e2);
    const gap = 40, colW = small ? L.right - L.pad : (L.right - L.pad - gap) / 2;
    if (!small) txt(L, L.g, L.pad, L.top + 14, 'Illustrative until the real checks run', { weight: 500, size: fs, fill: T.muted, italic: true }).el.setAttribute('opacity', aTit);

    const TX = [['We expect:', 'no slope. If the assumption holds, earlier vote shifts should not line up with the 2026 extra fuel cost.', 'We conclude:', 'a flat line, so no warning here (illustrative). A clear slope would mean reading the estimates with care.'],
      ['We expect:', 'every estimate close to zero. If the assumption holds, none of these predicts a state’s price rise.', 'We conclude:', 'none stands out (illustrative). If one did, I would say so next to the results.']];
    // phone: one line per chart, in the slot under its title (the sources line already says "illustrative")
    const SLOT = [[['Expect:', 'no slope.', 'Conclude:', 'a flat line, no warning.'], ['Expect:', 'no slope.', 'Conclude:', 'flat.']],
      [['Expect:', 'all near zero.', 'Conclude:', 'none stands out.'], ['Expect:', 'zero.', 'Conclude:', 'none stands out.']]];
    const slotPick = i => { const c = SLOT[i].find(a => measure(a[0] + ' ' + a[1] + ' ' + a[2] + ' ' + a[3], fs, 400) + 14 <= colW); return c || SLOT[i][1]; };
    const slotLine = (parent, x, y, a) => {
      const t = S(parent, 'text', { x: x, y: y, 'font-size': fs, fill: T.ink });
      [[a[0], 600], [' ' + a[1] + ' ', 400], [a[2], 600], [' ' + a[3], 400]].forEach(s => { const ts = S(t, 'tspan', { 'font-weight': s[1] }); ts.textContent = s[0]; ts.setAttribute('xml:space', 'preserve'); });
      return t;
    };
    const txtH = TX.map(a => wrap(a[0] + ' ' + a[1], colW, fs).length + wrap(a[2] + ' ' + a[3], colW, fs).length).map(n => n * 1.35 * fs + 8);
    // panel titles (v5: which version each check speaks to); they may wrap, so the plots start below the measured titles
    const TTL = small ? ['Check 1: earlier vote shifts', 'Check 2: state traits and price rises'] : ['Check 1: earlier vote shifts (main analysis, local prices)', 'Check 2: where the bigger price rises landed (states)'];
    const tlh = 1.3 * (fs + 1), tn = TTL.map(s => wrap(s, colW, fs + 1, 600).length), tx = tn.map(n => (n - 1) * tlh);
    const XL1 = '2026 extra fuel cost, low to high (ten equal groups)', xl1 = small ? wrap(XL1, colW - 8, fm).length - 1 : 0;
    const XL2 = small ? 'link to price rise, std. dev.' : 'link to the state’s price rise, std. dev.', xl2 = small ? wrap(XL2, colW - 8, fm).length - 1 : 0;

    // vertical budget
    let y0, plotH, plotH2, PT, py, px;
    if (small) {
      // stacked charts: title, a one-line slot, the plot, its axis; the plots share what is left of the panel height
      const lnh = fm * 1.25, bottom = L.bottom + 9;
      y0 = L.top + 14;
      const F1 = tx[0] + 16 + 7 + 14 + xl1 * lnh + 4, F2 = 15 + tx[1] + 16 + 7 + 26 + xl2 * lnh + 4;
      const pool = bottom - y0 - F1 - F2;
      plotH2 = clamp(pool * 0.55, 4 * (fm + 3), 150); plotH = clamp(pool - plotH2, 40, 130);
      const yT1 = y0 + tx[0] + 16 + 7, yB1 = yT1 + plotH, t2 = yB1 + 14 + xl1 * lnh + 4 + 15;
      PT = [yT1 - y0, t2 + tx[1] + 16 + 7 - t2]; py = [y0, t2]; px = [L.pad, L.pad];
    } else {
      y0 = L.top + 58 + (L.h > 1100 ? L.h * 0.04 : 0);                                // top of the first panel's title row
      PT = [56 + Math.max(tx[0], tx[1]), 56 + Math.max(tx[0], tx[1])];
      plotH = plotH2 = Math.min(L.h * 0.4, 560);
      px = [L.pad, L.pad + colW + gap]; py = [y0, y0];
    }

    /* ----- panel 1 ----- */
    {
      const ox = px[0], oy = py[0], d = chk1Data();
      txt(L, G1, ox, oy, TTL[0], { weight: 600, size: fs + 1, w: colW }).el.setAttribute('opacity', aTit);
      const ax = ox + (small ? 30 : 36), bx = ox + colW - 8, yT = oy + PT[0], yB = yT + plotH;
      const X = i => ax + (i + 0.5) / 10 * (bx - ax), YM = 0.7, Y = v => (yT + yB) / 2 - v / YM * (yB - yT) / 2;
      [-0.5, 0, 0.5].forEach(v => {
        line(L, G1, ax, Y(v), bx, Y(v), { stroke: T.rule, w: v === 0 ? 1.3 : 1 });
        txt(L, G1, ax - 5, Y(v) + 4, v === 0 ? '0' : (v < 0 ? MINUS : '+') + Math.abs(v).toFixed(1), { anchor: 'end', size: fm, fill: T.muted, halo: 0, minX: ox - 4 });
      });
      line(L, G1, ax, yB, bx, yB, { stroke: T.muted });
      if (!small) txt(L, G1, ox, yT - 8, 'Vote shift in earlier elections, points', { size: fm, fill: T.muted, halo: 0 }).el.setAttribute('opacity', aTit);
      txt(L, G1, (ax + bx) / 2, yB + (small ? 14 : 16), XL1, { anchor: 'middle', size: fm, fill: T.muted, halo: 0, w: bx - ax + 30 }).el.setAttribute('opacity', aTit);
      // fit and the problem line
      const fx0 = X(0) - 6, fx1 = X(9) + 6, f = i => d.a + d.b * i;
      const fg = grp(G1, aFit); line(L, fg, fx0, Y(f(-0.5)), fx1, Y(f(9.5)), { stroke: T.accent, w: 2 });
      const bg = grp(G1, aBad), pk = 0.115;                         // a problem: +0.115 points per bin
      line(L, bg, fx0, Y(pk * (-5)), fx1, Y(pk * 5), { stroke: RUST, w: 1.6, dash: '5 4' });
      // dots
      d.ys.forEach((y, i) => { const u = sm(i / 10 * 0.6, i / 10 * 0.6 + 0.4, aDots); if (u > 0.01) S(G1, 'circle', { cx: X(i), cy: Y(y), r: (small ? 3.2 : 4.2) * u, fill: T.ink, stroke: T.bg, 'stroke-width': 1 }); });
      // arrows
      if (aArr > 0.01) {
        const ga = grp(G1, aArr);
        const t1 = txt(L, ga, bx, small ? yB - 3 : Y(-0.36) + 6, small ? 'expected: flat' : 'expected if the assumption\nholds: flat', { anchor: 'end', size: fs, weight: 500, fill: T.accent, minX: ax + 4 });
        arrow(L, ga, X(8.6), t1.y0 - 3, X(8.6), Y(f(8.6)) + (small ? 5 : 7), { stroke: T.accent, gap: 2 });
        const t2 = txt(L, ga, ax + 6, yT + (small ? 9 : 12), small ? 'a slope = warning' : 'a slope here would\nbe a warning', { size: fs, weight: 500, fill: RUST, minX: ax + 2 });
        arrow(L, ga, t2.x1 + 3, t2.y0 + (small ? 4 : 8), X(6.6), Y(pk * 1.6) - 3, { stroke: RUST, gap: 2 });
      }
      if (aRow > 0.01) {
        const gt = grp(G1, aRow);
        if (small) slotLine(gt, ox, oy + tx[0] + 16, slotPick(0));
        else { const ty = yB + 50, a = para(L, gt, ox, ty, TX[0][0], TX[0][1], colW); para(L, gt, ox, a.y1 + fs * 1.05, TX[0][2], TX[0][3], colW); }
      }
    }

    /* ----- panel 2 ----- */
    {
      const ox = px[1], oy = py[1];
      txt(L, G2, ox, oy, TTL[1], { weight: 600, size: fs + 1, w: colW }).el.setAttribute('opacity', aTit);
      const labW = small ? Math.max.apply(null, CHK2.map(r => measure(r[0], fm))) + 8 : Math.min(colW * 0.42, 128), ax = ox + labW + 8, bx = ox + colW - 10, yT = oy + PT[1], yB = yT + plotH2;
      const XM = 0.5, X = v => (ax + bx) / 2 + v / XM * (bx - ax) / 2, pitch = plotH2 / 4;
      [-0.4, 0.4].forEach(v => line(L, G2, X(v), yT, X(v), yB, { stroke: T.rule }));
      line(L, G2, X(0), yT - 4, X(0), yB, { stroke: T.ink, w: 1.4 });
      [-0.4, 0, 0.4].forEach(v => txt(L, G2, X(v), yB + (small ? 13 : 16), v === 0 ? '0' : (v < 0 ? MINUS : '+') + Math.abs(v).toFixed(1), { anchor: 'middle', size: fm, fill: T.muted, halo: 0 }));
      txt(L, G2, (ax + bx) / 2, yB + (small ? 26 : 2 * fs + 6), XL2, { anchor: 'middle', size: fm, fill: T.muted, halo: 0, w: bx - ax + 30, minX: ox }).el.setAttribute('opacity', aTit);
      CHK2.forEach((r, k) => {
        const u = ks > 0 ? 1 : sm(0.08 + k * 0.03, 0.16 + k * 0.03, p); if (u < 0.01) return;
        const gr = grp(G2, u), cy = yT + pitch * (k + 0.5);
        const lb = wrap(r[0], labW, fm), lh = 1.25 * fm;
        const t = S(gr, 'text', { x: ox, y: cy - (lb.length - 1) * lh / 2 + 4, 'font-size': fm, fill: T.ink });
        lb.forEach((ln, j) => { const ts = S(t, 'tspan', { x: ox, dy: j ? lh : 0 }); ts.textContent = ln; });
        const lo = r[1] - 1.96 * r[2], hi = r[1] + 1.96 * r[2];
        line(L, gr, X(lo), cy, X(hi), cy, { stroke: T.accent, w: 2 });
        line(L, gr, X(lo), cy - 4, X(lo), cy + 4, { stroke: T.accent, w: 1.4 }); line(L, gr, X(hi), cy - 4, X(hi), cy + 4, { stroke: T.accent, w: 1.4 });
        S(gr, 'circle', { cx: X(r[1]), cy: cy, r: small ? 3.4 : 4.4, fill: T.accent, stroke: T.bg, 'stroke-width': 1 });
      });
      if (small) {
        // phone: the expectation label takes the slot under the title; the expect/conclude line replaces it in checks-3
        if (aArr2 * (1 - aRow) > 0.01) txt(L, G2, ox, oy + tx[1] + 16, 'expected: all near zero', { size: fs, weight: 500, fill: T.accent }).el.setAttribute('opacity', aArr2 * (1 - aRow));
        if (aRow > 0.01) slotLine(grp(G2, aRow), ox, oy + tx[1] + 16, slotPick(1));
      } else {
        if (aArr2 > 0.01) {
          const ga = grp(G2, aArr2);
          const t1 = txt(L, ga, X(0), yT - 24, 'expected: all near zero', { anchor: 'middle', size: fs, weight: 500, fill: T.accent, minX: ox });
          arrow(L, ga, X(0), t1.y1 + 1, X(0), yT - 2, { stroke: T.accent, gap: 0 });
        }
        if (aRow > 0.01) {
          const gt = grp(G2, aRow), ty = yB + 56, a = para(L, gt, ox, ty, TX[1][0], TX[1][1], colW);
          para(L, gt, ox, a.y1 + fs * 1.05, TX[1][2], TX[1][3], colW);
        }
      }
    }
  }

  /* ======================================================================
     equation (v9.4, beats eq-1 ... stock-take): the whole analysis as one equation, one term to a line (the "+" under the "="), built up one piece at
     a time. Each term sits in a box sized to its measured text (Source Serif, measured on an svg text node, at every width).
       eq-1: vote shift = b × extra fuel cost.  eq-2: race enters after "=", and b × extra fuel cost moves down to its own line.
       eq-3, one operation: the extra fuel cost splits into two terms that move apart: exposure × the group's average rise (the part exposure alone
         predicts, gray) and, with b in front, exposure × the unusual part of the rise (accent). A brace over both, labelled "extra fuel cost", shows
         where they came from and fades once they are apart.
       eq-4: oil and gas jobs and the 2020–24 shift enter; one muted line under the equation points to the analysis plan.
       stock-take: the eq-4 equation holds; three large question marks come in under it one at a time (p 0.05-0.5).
     The top bar's outlines are slice.js's; this panel draws no bar. */
  const EQ_STAGE = { 'recap': 0, 'recap-2': 1, 'recap-3': 2, 'recap-4': 3, 'eq-1': 0, 'eq-2': 1, 'eq-3': 2, 'eq-4': 3, 'stock-take': 3 };
  const EQ_TXT = { out: 'vote shift', eq: '=', race: 'race', p1: '+', p2: '+', p3: '+', p4: '+', p5: '+', p6: '+', b: 'b', x: '×', efc: 'extra fuel cost',
    A: 'exposure × the group’s average rise', B: 'exposure × the unusual part of the rise', oil: 'oil and gas jobs', prior: '2020–24 shift', pt: 'pass-through', stalag: 'state’s 2020–24 rise' };
  const EQ_LAB = { out: '2024–2026, by county', race: 'one for each race', b: 'the number I estimate', A: 'the part exposure alone predicts' };
  const EQ_NOTE = 'The full equation, with all its terms, is in the analysis plan.';
  const EQ_BOX = { out: _T().eqOut || '#7A828C', race: _T().eqRace || '#AEB4BC', kept: _T().accent || '#0E5F6B', A: GREY, oil: INKG, prior: INKG, pt: INKG, stalag: INKG };      // box grounds (tinted toward the page)
  const EQ_LABEL_STAGE = { out: 0, b: 0, race: 1, A: 2 };                                             // the beat that introduces each label
  const eqLab = (id, small) => small && id === 'out' ? '2024 → 2026' : EQ_LAB[id];
  // the lines of stage k: ['op', id] or ['box', boxId, [token ids]]
  function eqLines(k) {
    const lines = [[['box', 'out', ['out']], ['op', 'eq'], k === 0 ? ['box', 'kept', ['b', 'x', 'efc']] : ['box', 'race', ['race']]]];
    if (k === 1) lines.push([['op', 'p1'], ['box', 'kept', ['b', 'x', 'efc']]]);
    if (k >= 2) { lines.push([['op', 'p1'], ['box', 'A', ['A']]]); lines.push([['op', 'p2'], ['box', 'kept', ['b', 'x', 'B']]]); }
    if (k >= 3) { lines.push([['op', 'p3'], ['box', 'oil', ['oil']], ['op', 'p4'], ['box', 'prior', ['prior']]]); lines.push([['op', 'p5'], ['box', 'pt', ['pt']], ['op', 'p6'], ['box', 'stalag', ['stalag']]]); }
    return lines;
  }
  // Lay out stage k at font size z in width W: token, box and label positions (x relative to the equation's left edge, y relative to its top)
  function eqLayout(k, z, W, small, compact, noLab) {
    const az = compact ? 11 : small ? 12 : 13, alh = az * 1.3, pad = Math.round(z * 0.3), sp = z * 0.26, og = z * 0.36, chipH = Math.round(z * (compact ? 1.28 : 1.42)), lineGap = Math.round(z * (compact ? 0.25 : 0.42));
    const w = id => measureEq(EQ_TXT[id], z, id === 'b');
    const lines = eqLines(k), tok = {}, box = {}, lab = {};
    // where the terms after "=" start; lines after the first put their "+" under the "=" (or, on a narrow panel, at the left edge)
    const outW = pad + w('out') + pad, xEq = outW + og, xT0 = xEq + w('eq') + og;
    const widest = Math.max.apply(null, [0, 1, 2, 3].map(kk => eqLines(kk).slice(1).map(ln => lineW(ln)).reduce((a, c) => Math.max(a, c), 0)));
    function lineW(ln) { let x = 0; ln.forEach((it, j) => { if (j) x += og; x += it[0] === 'op' ? w(it[1]) : 2 * pad + it[2].reduce((s, id, q) => s + (q ? sp : 0) + w(id), 0); }); return x; }
    const indent = xT0 + widest - w('p1') - og <= W;
    const xT = indent ? xT0 : w('p1') + og;
    let y = 0;
    const rows = [];
    lines.forEach((ln, li) => {
      let x = li === 0 ? 0 : indent ? xEq + (w('eq') - w('p1')) / 2 : 0;
      ln.forEach((it, j) => {
        if (li > 0 && j === 1) x = xT;                                                // the first term of a later line starts under the first term after "="
        else if (j) x += og;
        if (it[0] === 'op') { tok[it[1]] = { x: x, w: w(it[1]), line: li }; x += w(it[1]); return; }
        const x0 = x; x += pad;
        it[2].forEach((id, q) => { if (q) x += sp; tok[id] = { x: x, w: w(id), line: li }; x += w(id); });
        x += pad; box[it[1]] = { x0: x0, x1: x, line: li };
      });
    });
    // labels: under their term, left-aligned; one that would run into the previous label is right-aligned to its term instead, or goes a row down
    const labOf = { out: ['box', 'out'], race: ['box', 'race'], b: ['tok', 'b'], A: ['box', 'A'] };
    lines.forEach((ln, li) => {
      const ids = noLab ? [] : Object.keys(labOf).filter(id => EQ_LABEL_STAGE[id] <= k && (labOf[id][0] === 'box' ? box[labOf[id][1]] && box[labOf[id][1]].line === li : tok[labOf[id][1]] && tok[labOf[id][1]].line === li));
      ids.sort((a, b2) => (labOf[a][0] === 'box' ? box[labOf[a][1]].x0 + pad : tok[labOf[a][1]].x) - (labOf[b2][0] === 'box' ? box[labOf[b2][1]].x0 + pad : tok[labOf[b2][1]].x));
      const ends = [];
      ids.forEach(id => {
        const lw = measure(eqLab(id, small), az, 500), t = labOf[id][0] === 'box' ? box[labOf[id][1]] : null;
        const left = t ? t.x0 + pad : tok[labOf[id][1]].x, right = t ? t.x1 - pad : (labOf[id][1] === 'B' ? box.kept.x1 - pad : tok[labOf[id][1]].x + tok[labOf[id][1]].w);
        let x = left, row = 0;
        if (ends[0] != null && x < ends[0] + 14) { if (right - lw >= ends[0] + 14) x = right - lw; else row = 1; }
        ends[row] = Math.max(ends[row] || -1e9, x + lw);
        lab[id] = { x: x, w: lw, line: li, row: row };
      });
      rows[li] = ids.length ? 1 + Math.max.apply(null, ids.map(id => lab[id].row)) : 0;
    });
    const lineY = [];
    lines.forEach((ln, li) => { lineY[li] = y; y += chipH + (rows[li] ? 5 + rows[li] * alh : 0) + lineGap; });
    const width = Math.max.apply(null, Object.keys(box).map(id => box[id].x1).concat(Object.keys(tok).map(id => tok[id].x + tok[id].w), Object.keys(lab).map(id => lab[id].x + lab[id].w)));
    const lineW3 = k >= 3 ? (box.stalag ? Math.max(box.prior.x1, box.stalag.x1) : box.prior.x1) : width;
    const lineR = lines.map((ln, li) => Math.max.apply(null, Object.keys(tok).filter(id => tok[id].line === li).map(id => tok[id].x + tok[id].w).concat(Object.keys(lab).filter(id => lab[id].line === li).map(id => lab[id].x + lab[id].w), [0])));
    return { k: k, z: z, az: az, alh: alh, pad: pad, chipH: chipH, tok: tok, box: box, lab: lab, lineY: lineY, rows: rows, height: y - lineGap, width: width, n: lines.length, lineW3: lineW3, lineR: lineR };
  }
  // the brace of eq-3: room at the right of the two new terms for the brace and its label (one line; on a narrow panel, two)
  const EQ_BRACE = 'extra fuel cost';
  function eqBraceRoom(La, small) { const az = La.az; return { one: 18 + measure(EQ_BRACE, az, 500), two: 18 + Math.max(measure('extra', az, 500), measure('fuel cost', az, 500)) }; }
  // the largest font at which every stage fits the width (with the brace's room in stage 3) and the finished picture fits the height
  const EQC = {};
  function eqLayouts(W, availH, small, fe, qH, noteH, tiny) {
    const key = [W, availH, small, window.innerWidth < 900, fe, qH, noteH, tiny].join('|');
    if (EQC.key === key) return EQC.v;
    if (EQC.fe !== fe) { clearSerif(); EQC.fe = fe; }
    const compact = small && availH < 250;
    const sizes = small ? [21, 20, 19, 18, 17, 16, 15, 14, 13].concat(compact ? [12.5, 12, 11.5, 11] : []) : [32, 30, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16];
    let best = null;
    // a phone that cannot hold the finished equation with its labels drops the labels from eq-4 on (they were explained by eq-1 to eq-3) and lets the question marks of stock-take use the room beside the first lines
    outer: for (const choice of small && window.innerWidth < 900 && W < 520 ? sizes.flatMap(z => [false, true].map(noLab => ({ z, noLab }))) : (small ? [false, true] : [false]).flatMap(noLab => sizes.map(z => ({ z, noLab })))) {
      const { z, noLab } = choice;
      const Ls = [0, 1, 2, 3].map(k => eqLayout(k, z, W, small, compact, (tiny && k >= 2) || (noLab && k === 3))), br = eqBraceRoom(Ls[2], small);
      const split = Math.max(Ls[2].box.A.x1, Ls[2].box.kept.x1);
      const brace = split + br.one <= W ? 1 : split + br.two <= W ? 2 : 0;
      const hq = Ls[3].height + noteH + qH, hs = Ls[3].height + noteH, side = small && W - Ls[3].lineW3 >= qH * 1.9;
      const top = small && noLab && W - Math.max(Ls[3].lineR[0], Ls[3].lineR[1]) >= qH * 1.9;
      const qMode = hq <= availH || !(side || top) ? 'below' : side ? 'side' : 'top', h = qMode === 'below' ? hq : hs;
      best = { Ls: Ls, z: z, brace: brace, h: h, qSide: qMode === 'side', qMode: qMode, noLab: noLab };
      if (Ls.every(l => l.width <= W) && (brace || small) && h <= availH) break outer;
    }
    if (small && window.innerWidth < 900 && W < 520) {
      [0, 1].forEach(k => { const l = sizes.map(z => eqLayout(k, z, W, small, compact, false)).find(l => l.width <= W && l.height <= availH); if (l) best.Ls[k] = l; });
      best.h = Math.max(best.h, best.Ls[0].height, best.Ls[1].height);
    }
    EQC.key = key; EQC.v = best;
    return best;
  }

  // One motion window drives both travel and its reduced-motion cross-fade.
  const EQ_MOVE = window.VIS.slice.equationMoveRange;
  function renderEquation(g, state, ctx) {
    const beat0 = beatOf(state, { pid: 'equation', beat: 'eq-1' }), k0 = EQ_STAGE[beat0] || 0, mv = k0 === 1 || k0 === 2 ? EQ_MOVE : null;
    if (window.ENGINE && window.ENGINE.reducedMotion && state.forceMove == null && beat0 !== 'stock-take' && mv && state.p > mv[0] && state.p < mv[1]) {
      const f = sm(mv[0], mv[1], state.p);
      g.node().setAttribute('opacity', ctx.opacity == null ? 1 : ctx.opacity);
      // Sequential cross-fade: old fades out, then new fades in, avoiding overlap.
      const oA = 1 - clamp((f - 0.3) / 0.2, 0, 1), oB = clamp((f - 0.5) / 0.2, 0, 1);
      renderEquation(d3.select(grp(g.node())), Object.assign({}, state, { forceMove: 0 }), Object.assign({}, ctx, { opacity: oA }));
      renderEquation(d3.select(grp(g.node())), Object.assign({}, state, { forceMove: 1 }), Object.assign({}, ctx, { opacity: oB }));
      return;
    }
    const L = setup(g, state, ctx, '');
    const T = L.T, p = L.phone && L.w < 520 && (state.beat || state.id) === 'eq-1' ? Math.max(0.34, state.p) : state.p, small = L.small;
    const beat = beatOf(state, { pid: 'equation', beat: 'eq-1' }), k = EQ_STAGE[beat] || 0, isStock = beat === 'stock-take';
    const x0 = L.pad, W = L.right - L.pad;
    const hd = figHead(L, L.g, 'The whole analysis as one equation', null, null, 1);
    const top0 = hd.bottom + (small ? 14 : 28), area = L.bottom - top0;
    const compact = small && area < 250;
    const eqNote = L.tiny ? '' : (L.tablet && isStock || L.phone && L.w < 520) ? 'Full equation in the analysis plan.' : EQ_NOTE;
    const nz = compact ? 11 : small ? 12 : 13, noteH = eqNote ? nz * 1.3 * wrap(eqNote, W, nz).length + (small ? 9 : 14) : 0, qS = compact ? 22 : small || window.innerWidth < 900 && L.w < 900 ? 44 : clamp(area * 0.11, 64, 78), qH = qS * (window.innerWidth < 900 && L.w < 900 && !small ? 1.65 : 1.25) + (small ? 8 : 16);
    const E = eqLayouts(W, area, small, fontEpoch + (document.fonts ? document.fonts.status : ''), qH, noteH, L.tiny);
    const LA = E.Ls[k], LP = k > 0 && !isStock ? E.Ls[k - 1] : null;
    let z = LA.z, chipH = LA.chipH;
    // the equation's top is the same in every beat: the finished picture (stock-take) sits a little above the middle of the area
    const eqTop = top0 + Math.max(0, (area - E.h) * 0.38);
    // progress of this beat's change
    const P = isStock ? { move: 1, inT: 1, inL: 1, out: 0 } :
      k === 0 ? { move: 1, inT: 1, inL: 1, out: 0 } :
      k === 1 ? { move: sm(EQ_MOVE[0], EQ_MOVE[1], p), inT: sm(0.30, 0.37, p), inL: sm(0.37, 0.44, p), out: 0 } :
      k === 2 ? { move: sm(EQ_MOVE[0], EQ_MOVE[1], p), inT: sm(0.30, 0.37, p), inL: sm(0.37, 0.44, p), out: sm(0.05, 0.11, p) } :
      E.noLab ? { move: sm(0.02, 0.18, p), inT: sm(0.08, 0.2, p), inL: 1, out: sm(0, 0.1, p) } : { move: 1, inT: sm(0.08, 0.2, p), inL: 1, out: 0 };
    if (state.forceMove != null) { P.move = state.forceMove; if (k === 2) P.out = state.forceMove; }
    if (LP) { z = lerp(LP.z, LA.z, P.move); chipH = lerp(LP.chipH, LA.chipH, P.move); }
    const first = { out: sm(0.04, 0.16, p), eq: sm(0.08, 0.18, p), kept: sm(0.12, 0.25, p) };            // eq-1 builds its three pieces in turn
    const firstLab = { out: sm(0.25, 0.32, p), b: sm(0.27, 0.34, p) };
    const X = x => x0 + x, Yl = (Lx, li) => eqTop + Lx.lineY[li];
    // the position of a token now: moving from the previous stage (eq-3's new terms start where "extra fuel cost" was)
    const tokAt = id => {
      const B = LA.tok[id], A = LP ? (LP.tok[id] || (k === 2 && (id === 'A' || id === 'B') ? LP.tok.efc : null)) : null;
      if (!B) return A ? { x: X(A.x), y: Yl(LP, A.line), w: A.w, a: 1 - P.out } : null;
      if (!A) return { x: X(B.x), y: Yl(LA, B.line), w: B.w, a: k === 0 && !isStock ? (id === 'out' ? first.out : first.kept) : id === 'eq' && k === 0 ? first.eq : P.inT, isNew: !isStock };
      const born = LP && !LP.tok[id];                                                    // A and B of eq-3: they appear where "extra fuel cost" was, once apart
      return { x: lerp(X(A.x), X(B.x), P.move), y: lerp(Yl(LP, A.line), Yl(LA, B.line), P.move), w: lerp(A.w, B.w, P.move), a: born ? clamp((P.move - 0.5) / 0.35, 0, 1) : 1, isNew: born };
    };
    const boxAt = id => {
      const B = LA.box[id], A = LP ? (LP.box[id] || (k === 2 && id === 'A' ? { x0: LP.tok.efc.x - LP.pad, x1: LP.tok.efc.x + LP.tok.efc.w + LP.pad, line: LP.tok.efc.line } : null)) : null;
      if (!B) return A ? { x0: X(A.x0), x1: X(A.x1), y: Yl(LP, A.line), a: 1 - P.out } : null;
      if (!A) return { x0: X(B.x0), x1: X(B.x1), y: Yl(LA, B.line), a: k === 0 && !isStock ? (id === 'out' ? first.out : first.kept) : P.inT };
      const born = LP && !LP.box[id];
      return { x0: lerp(X(A.x0), X(B.x0), P.move), x1: lerp(X(A.x1), X(B.x1), P.move), y: lerp(Yl(LP, A.line), Yl(LA, B.line), P.move), a: born ? clamp(P.move / 0.3, 0, 1) : 1 };
    };
    // boxes: the newest terms' grounds a little stronger in their own beat; the emphasis passes to the next beat's terms over its p 0.05-0.15
    const NEWEST = { 0: ['kept', 'out'], 1: ['race'], 2: ['A', 'kept'], 3: ['oil', 'prior', 'pt', 'stalag'] }, hand = sm(0.05, 0.15, p);
    const emOf = (ids, id) => (ids[k] || []).indexOf(id) >= 0 ? (isStock ? 1 - hand : k === 0 ? 1 : hand) : k > 0 && !isStock && (ids[k - 1] || []).indexOf(id) >= 0 ? 1 - hand : 0;
    // v9.5 (DESIGN.md §Components 4): no chips or boxes behind equation terms; the boxes are still tracked for layout/positioning but not drawn
    // tokens (inline style: the site's `.sc-svg text` rule would override a font-family attribute)
    const ids = Object.keys(EQ_TXT).filter(id => LA.tok[id] || (LP && LP.tok[id]));
    ids.forEach(id => {
      const t = tokAt(id); if (!t || t.a < 0.01) return;
      const el = S(L.g, 'text', { x: t.x.toFixed(2), y: (t.y + chipH * 0.5 + z * 0.33).toFixed(2), 'font-size': z, fill: id === 'eq' || /^p\d/.test(id) ? T.muted : T.ink, opacity: t.a.toFixed(3), style: 'font-family:' + FONT + (id === 'b' ? ';font-style:italic' : '') });
      el.textContent = EQ_TXT[id];
      if (id === 'b') S(L.g, 'line', { x1: t.x, y1: t.y + chipH - 4, x2: t.x + t.w, y2: t.y + chipH - 4, stroke: T.accent, 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: t.a.toFixed(3) });
    });
    // labels under the terms: the new ones in this beat at full strength, the older ones quieter; b's label moves with b
    const labIds = Object.keys(EQ_LAB).filter(id => LA.lab[id] || (LP && LP.lab[id]));
    labIds.forEach(id => {
      const B = LA.lab[id], A = LP && LP.lab[id];
      const yOf = (Lx, l) => eqTop + Lx.lineY[l.line] + Lx.chipH + 5 + Lx.az * 0.95 + l.row * Lx.alh;
      let x, y, a;
      if (A && B) { x = lerp(X(A.x), X(B.x), P.move); y = lerp(yOf(LP, A), yOf(LA, B), P.move); a = 1; }
      else if (B) { x = X(B.x); y = yOf(LA, B); a = k === 0 && !isStock ? firstLab[id] || 0 : id === 'B' && k === 2 ? sm(0.37, 0.44, p) : P.inL; }
      else { x = X(A.x); y = yOf(LP, A); a = 1 - P.out; }
      if (a < 0.01) return;
      const fresh = emOf({ 0: ['out', 'b'], 1: ['race'], 2: ['A', 'B'], 3: [] }, id), col = id === 'b' || id === 'B' ? T.accent : T.muted;
      S(L.g, 'text', { x: x.toFixed(2), y: y.toFixed(2), 'font-size': LA.az, fill: col, 'font-weight': 500, opacity: (a * (id === 'b' || id === 'B' ? 1 : lerp(0.82, 1, fresh))).toFixed(3) }).textContent = eqLab(id, small);
    });
    // eq-3 (DESIGN.md §Components 4): a brace groups the split terms under "extra fuel cost"; it fades in after the terms separate and stays throughout eq-3
    if (k === 2 && !isStock) {
      const aB = sm(EQ_MOVE[1], EQ_MOVE[1] + 0.07, p);
      if (aB > 0.01) {
        const tA = tokAt('A'), tB = tokAt('B'), bA = boxAt('A'), bK = boxAt('kept');
        const xb = Math.max(bA.x1, bK.x1) + 7, y1 = Math.min(tA.y, tB.y) + 2, y2 = Math.max(tA.y, tB.y) + chipH - 2, ym = (y1 + y2) / 2, bw = 7;
        const gb = grp(L.g, aB);
        S(gb, 'path', { d: 'M' + xb + ',' + y1 + 'Q' + (xb + bw) + ',' + y1 + ' ' + (xb + bw) + ',' + (y1 + 6) + 'L' + (xb + bw) + ',' + (ym - 5) + 'Q' + (xb + bw) + ',' + ym + ' ' + (xb + bw + 5) + ',' + ym +
          'Q' + (xb + bw) + ',' + ym + ' ' + (xb + bw) + ',' + (ym + 5) + 'L' + (xb + bw) + ',' + (y2 - 6) + 'Q' + (xb + bw) + ',' + y2 + ' ' + xb + ',' + y2, fill: 'none', stroke: T.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
        const lx = xb + bw + 10, az = LA.az;
        if (E.brace === 2) { const t = S(gb, 'text', { 'font-size': az, 'font-weight': 500, fill: T.ink }); S(t, 'tspan', { x: lx, y: ym - 2 }).textContent = 'extra'; S(t, 'tspan', { x: lx, y: ym - 2 + az * 1.25 }).textContent = 'fuel cost'; }
        else if (E.brace === 1) S(gb, 'text', { x: lx, y: ym + az * 0.36, 'font-size': az, 'font-weight': 500, fill: T.ink }).textContent = EQ_BRACE;
        else S(gb, 'text', { x: Math.min(lx, L.right), y: y1 - 6, 'font-size': az, 'font-weight': 500, fill: T.ink, 'text-anchor': 'end' }).textContent = EQ_BRACE;
      }
    }
    // eq-4: the note under the equation (it stays in stock-take)
    const L3 = E.Ls[3];
    if (k === 3 && eqNote) {
      const aN = isStock ? 1 : sm(0.25, 0.32, p);
      if (aN > 0.01) txt(L, S(grp(L.g, aN), 'a', { href: 'plan.html', 'pointer-events': 'auto' }), x0, eqTop + L3.height + noteH - (small ? 4 : 8), eqNote, { size: nz, fill: T.accent, w: W, halo: 0, noTop: true }).el.setAttribute('text-decoration', 'underline');
    }
    // stock-take: three large question marks under the equation, one at a time, each fading in and settling
    if (isStock) {
      let cy = eqTop + L3.height + noteH + qH * 0.62 + (L.small ? 0 : qS * 0.35), cx = x0 + Math.min(W, Math.max(L3.width, 260)) / 2, gap = qS * 1.05;
      if (E.qSide) { gap = qS * 0.72; cx = x0 + L3.lineW3 + (W - L3.lineW3) / 2; cy = eqTop + L3.lineY[3] + L3.chipH - 2; }
      else if (E.qMode === 'top') { const r = Math.max(L3.lineR[0], L3.lineR[1]); gap = qS * 0.72; cx = x0 + r + (W - r) / 2; cy = eqTop + (L3.lineY[1] + L3.chipH) / 2 + qS * 0.3; }
      if (L.tiny || !small && window.innerWidth < 900 && L.w < 900) { cx = clamp(cx, x0 + gap + qS * 0.4, L.right - gap - qS * 0.4); cy = Math.min(cy, L.bottom - qS * 0.35 - 6); if (L.tablet) { cx = L.right - gap - qS * 0.5 - 8; cy = Math.min(L.bottom - qS * 0.4 - 12, eqTop + L3.height + noteH + qS * 0.95); } }
      const Q = [{ dx: -gap, dy: 6, s: 1, r: -9, at: 0.05 }, { dx: 0, dy: -8, s: 0.9, r: 6, at: 0.2 }, { dx: gap * 0.95, dy: 3, s: 1.06, r: -3, at: 0.35 }];
      const col = T.accent;
      Q.forEach(q => {
        const u = sm(q.at, q.at + 0.1, p); if (u < 0.01) return;
        const sz = qS * q.s * lerp(0.88, 1, u), x = cx + q.dx, y = cy + q.dy - (1 - u) * 8;
        S(L.g, 'text', { x: x.toFixed(1), y: y.toFixed(1), 'font-size': sz.toFixed(1), 'font-weight': 600, fill: col, opacity: u.toFixed(3), 'text-anchor': 'middle', transform: 'rotate(' + q.r + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')', style: 'font-family:' + FONT }).textContent = '?';
      });
    }
  }


  /* ======================================================================
     overview (beat method-map, v6.3): the method as a map of clickable tiles, six bands top to bottom with quiet arrows between them.
     One source for the text: the <nav class="mm"> list in the beat's html (window.BEATS).
     Desktop (viewport >= 900px): the tiles are svg links (#b-<id>); main.js turns a click into the part-bar jump (wireBeatLinks on #visual).
     Hover and keyboard focus raise the tile and show its one-liner (rules in site.css, class .mm-*). Phone: the in-text list is the interface;
     the panel shows the six band labels as a quiet vertical flow. Bands build over p = 0.05-0.25, arrows and ticks over 0.25-0.45.
     A tile is ticked once the reader has had at least half of its beats current and a later beat too (history kept in memory, from window.BEAT_STATE). */
  const MM = { info: null, visited: {}, ver: 0, ids: [], maxV: -1 };
  function mmInfo() {
    if (MM.info !== null) return MM.info;
    MM.info = false;
    try {
      const B = window.BEATS || [];
      let mi = B.findIndex(b => b.id === 'method-map');
      if (mi < 0) mi = B.findIndex(b => b.id === 'idea-route');   // v8: the overview moved to idea-route
      if (mi < 0) mi = B.findIndex(b => b.id === 'route');        // v9: the overview is the beat route
      if (mi < 0) return false;
      const doc = new DOMParser().parseFromString(B[mi].html, 'text/html');
      const bands = [], tiles = [];
      doc.querySelectorAll('.mm-band').forEach(be => {
        const heading = be.querySelector('.mm-band-t');                // v9.4: the last band (states, what I'll report) has no heading
        const band = { title: heading ? heading.textContent.trim() : '', tiles: [] };
        be.querySelectorAll('a.mm-tile').forEach(a => {
          const href = a.getAttribute('href'), n = a.querySelector('.mm-n'), title = a.querySelector('.mm-t'), desc = a.querySelector('.mm-d');
          if (!href || !href.startsWith('#b-') || !n || !title || !desc) return;
          const t = { id: href.slice(3), n: n.textContent.trim(), title: title.textContent.trim(), d: desc.textContent.trim(), k: tiles.length + 1 };
          band.tiles.push(t); tiles.push(t);
        });
        if (band.tiles.length) bands.push(band);
      });
      MM.ids = B.map(b => b.id);
      tiles.forEach((t, k) => {
        t.a = MM.ids.indexOf(t.id);
        // a tile reads up to the next tile's beat; the last one (v7: the test on past elections, in the next part) up to the end of its own part
        let end = B.length; for (let i = t.a + 1; t.a >= 0 && i < B.length; i++) if (B[i].part !== B[t.a].part) { end = i; break; }
        t.z = k + 1 < tiles.length ? MM.ids.indexOf(tiles[k + 1].id) : end;
      });
      // v8: no time estimates anywhere (PI decision)
      MM.info = { bands: bands, tiles: tiles };
    } catch (e) { console.error('[overview] cannot read the method-map list', e); }
    return MM.info;
  }
  // passed: at least half of the section's beats have been current, and a later beat has too (a section that was jumped over has none)
  const mmPassed = t => { let n = 0; for (let i = t.a; i < t.z; i++) if (MM.visited[i]) n++; return n >= Math.max(1, Math.ceil((t.z - t.a) / 2)) && MM.maxV >= t.z; };
  // phone (critique N3): the band whose tiles are in view in the list below the panel, as an index (-1 when the list is not on screen). It is read
  // from the layout, like the ticks it comes with, and is part of the drawing's cache key.
  function mmActive() {
    const info = MM.info; if (!info || !window.BEAT_STATE || !['method-map', 'idea-route', 'route'].includes(window.BEAT_STATE.id)) return -1;
    const vis = document.getElementById('visual'), top = vis ? vis.getBoundingClientRect().bottom : window.innerHeight * 0.5, bot = window.innerHeight, mid = top + (bot - top) * 0.4;
    let best = null, bd = 1e9;
    document.querySelectorAll('nav.mm a.mm-tile').forEach(a => {
      const r = a.getBoundingClientRect(); if (r.bottom < top || r.top > bot) return;
      const d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < bd) { bd = d; best = a; }
    });
    if (!best) return -1;
    const id = best.getAttribute('href').slice(3);
    return info.bands.findIndex(b => b.tiles.some(t => t.id === id));
  }
  // v9.4 (route, phone): the tile whose entry in the list below the panel is nearest the reading position, as an index into info.tiles (-1 when none)
  function mmActiveTile() {
    const info = MM.info; if (!info || !window.BEAT_STATE || window.BEAT_STATE.id !== 'route') return -1;
    const vis = document.getElementById('visual'), top = vis ? vis.getBoundingClientRect().bottom : window.innerHeight * 0.5, bot = window.innerHeight, mid = top + (bot - top) * 0.4;
    let best = null, bd = 1e9;
    document.querySelectorAll('nav.mm a.mm-tile').forEach(a => {
      const r = a.getBoundingClientRect(); if (r.bottom < top || r.top > bot) return;
      const d = Math.abs((r.top + r.bottom) / 2 - mid); if (d < bd) { bd = d; best = a; }
    });
    return best ? info.tiles.findIndex(t => '#b-' + t.id === best.getAttribute('href')) : -1;
  }
  const mmPhone = () => !!(window.matchMedia && window.matchMedia('(max-width: 899px) and (orientation: portrait), (max-width: 899px) and (min-height: 501px)').matches);
  // history: every beat that has been current. Read after main.js has computed the state for the frame (two animation frames after a scroll).
  function mmTrack() {
    const st = window.BEAT_STATE, i = st ? MM.ids.indexOf(st.id) : -1;
    if (i < 0 || MM.visited[i]) return;
    MM.visited[i] = 1; MM.maxV = Math.max(MM.maxV, i); MM.ver++;
    const info = MM.info; if (!info) return;
    document.querySelectorAll('a.mm-tile').forEach(a => { const t = info.tiles.find(x => '#b-' + x.id === a.getAttribute('href')); if (t) a.classList.toggle('read', mmPassed(t)); });
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('scroll', () => requestAnimationFrame(() => requestAnimationFrame(mmTrack)), { passive: true });
  }
  mmInfo();   // parse the overview links before main.js builds the page

  // line glyphs in a 32 x 32 box: ink for the data, accent for the idea of the section
  const MM_GLYPH = { 5: 14, 6: 5, 7: 15, 8: 6, 11: 12, 12: 13, 13: 11 };      // v7 tile number -> drawing (the cases below keep the v6.3 numbering; 14 and 15 are new)
  function mmGlyph(parent, k0, x, y, sz, T) {
    const k = MM_GLYPH[k0] || k0, s = sz / 32, g = S(S(parent, 'g', { transform: 'translate(' + x + ',' + y + ') scale(' + s + ')' }), 'g', { class: 'mm-glyph', fill: 'none', 'stroke-width': 1.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    const ink = INKG, acc = T.accent, mut = _T().overviewMut || '#9AA1AA';
    const P = (d, c, o) => S(g, 'path', Object.assign({ d: d, stroke: c || ink }, o || {}));
    const D = (cx, cy, c, r) => S(g, 'circle', { cx: cx, cy: cy, r: r || 2, fill: c || ink, stroke: 'none' });
    switch (k) {
      case 1: P('M4,4V28H28', mut); P('M7,24L26,9', acc); D(9, 22); D(14, 18.5); D(19, 17); D(24, 10); break;                                  // the simplest comparison: dots and a line
      case 2: [9, 16, 23].forEach((yy, i) => { P('M4,' + yy + 'H28', (_T().inkgLine || '#C9CED4')); D(10 + i * 3, yy); D(21 - i * 2, yy, acc); }); break;               // within each race: separate lanes
      case 3: [8, 16, 24].forEach((yy, i) => { D(9, yy, mut, 2.4); D(23, yy + (i - 1) * 2 + 2, acc, 2.4); }); P('M13,16H19', mut, { 'stroke-dasharray': '2 2.5' }); break; // exposure: two kinds of counties
      case 4: [[6, 10], [12, 16], [18, 7], [24, 22]].forEach((b, i) => S(g, 'rect', { x: b[0] - 2, y: 28 - b[1], width: 5, height: b[1], rx: 1, stroke: i === 3 ? acc : ink })); break;     // price rises that differ
      case 5: [[4, 15], [13, 17], [22, 23]].forEach(b => S(g, 'rect', { x: b[0], y: 28 - b[1], width: 6, height: b[1], rx: 1, stroke: ink })); S(g, 'rect', { x: 22, y: 5, width: 6, height: 7, rx: 1, fill: acc, stroke: acc }); P('M2,12H30', acc, { 'stroke-dasharray': '3 2.5' }); break; // the part above the average
      case 6: D(5, 16, ink, 2.4); D(27, 16, ink, 2.4); P('M11,13H21', acc); P('M11,19H21', acc); break;                                          // one assumption: equal
      case 7: P('M4,4V28H28', mut); P('M6,26L27,8', acc); P('M6,26L27,18', ink); break;                                                        // pass-through: a steep and a shallow response
      case 8: P('M4,25H11V17', mut, { 'stroke-dasharray': '2.5 2.5' }); P('M11,17H19V9H28', acc); P('M13,26C18,28 23,24 24,19', ink); P('M21.5,20.5L24,19L25.5,22', ink); break; // an earlier rise carried forward
      case 9: P('M16,4C16,4 7,15 7,20A9,9 0 0 0 25,20C25,15 16,4 16,4Z'); P('M12,21A4.5,4.5 0 0 0 16,25', acc); break;                      // oil and gas
      case 10: P('M3,23L13,17', mut, { 'stroke-dasharray': '2.5 2.5' }); P('M13,17L27,8', acc); P('M21,7.5L27,8L25.5,14', acc); break;           // a trend that began earlier
      case 14: [[8, 16], [14, 12], [20, 18], [14, 22]].forEach(q => D(q[0] + 2, q[1] - 2, ink, 2.3)); S(g, 'ellipse', { cx: 16, cy: 15, rx: 12, ry: 10, stroke: acc, 'stroke-dasharray': '2.5 2.5' }); D(28, 27, mut, 1.8); break;   // nearby markets: a small group, compared with each other
      case 15: P('M4,4V28H28', mut); P('M4,16H28', mut, { 'stroke-dasharray': '2 2.5' }); [[8, 20], [12, 13], [16, 18], [20, 10], [24, 14]].forEach(q => D(q[0], q[1])); P('M6,21L26,9', acc); break;   // what the comparison looks like: dots around a line that rises
      case 11: P('M4,16H28', acc); [7, 12, 17, 22, 27].forEach((xx, i) => D(xx, 16 + [-3, 3, -2, 2, -1][i], ink, 1.8)); P('M20,6.5L23,9.5L28.5,4', acc); break; // checks: a flat line, a tick
      case 12: S(g, 'rect', { x: 3, y: 8, width: 26, height: 6, rx: 1, stroke: mut }); S(g, 'rect', { x: 3, y: 19, width: 26, height: 6, rx: 1, stroke: (_T().inkgLine || '#C9CED4'), 'stroke-dasharray': '2 2' }); S(g, 'rect', { x: 3, y: 19, width: 7, height: 6, rx: 1, fill: acc, stroke: acc }); break; // what is left: a shrinking bar
      case 13: { const t = S(parent, 'text', { x: x + sz / 2, y: y + sz * 0.72, 'font-size': sz * 0.62, fill: acc, 'text-anchor': 'middle', style: 'font-family:' + FONT + ';font-style:italic' }); t.textContent = '= b ×'; g.parentNode.remove(); break; }
      default: break;
    }
    return g;
  }

  // small line drawings in a 64 x 40 box (ink for the data, accent for the idea of the step)
  function mmMini(parent, k, x, y, w, h, T) {
    const g = S(parent, 'g', { transform: 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' + (w / 64).toFixed(3) + ',' + (h / 40).toFixed(3) + ')', fill: 'none', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    const ink = INKG, acc = T.accent, mut = _T().overviewMut || '#9AA1AA', soft = T.accentSoft;
    const P = (d, c, o) => S(g, 'path', Object.assign({ d: d, stroke: c || ink }, o || {}));
    const D = (cx, cy, c, r) => S(g, 'circle', { cx: cx, cy: cy, r: r || 1.9, fill: c || ink, stroke: 'none' });
    const R = (rx, ry, rw, rh, o) => S(g, 'rect', Object.assign({ x: rx, y: ry, width: rw, height: rh, rx: 1 }, o));
    // an open arrowhead at (x, y) for a line arriving in direction (dx, dy)
    const AH = (x, y, dx, dy, c) => { const d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d, a = 4.2, b = 2.6; P('M' + (x - ux * a - uy * b).toFixed(2) + ',' + (y - uy * a + ux * b).toFixed(2) + 'L' + x + ',' + y + 'L' + (x - ux * a + uy * b).toFixed(2) + ',' + (y - uy * a - ux * b).toFixed(2), c); };
    switch (k) {
      case 1: [8, 20, 32].forEach((yy, i) => { P('M3,' + yy + 'H61', (_T().glyphSoft || '#D3D7DC')); [[38, 44, 51, 47], [12, 17, 23, 19], [24, 31, 36, 28]][i].forEach((xx, j) => D(xx, yy + (j % 2 ? -2 : 1.5), i === 0 && j === 2 ? acc : ink)); }); break;
      case 2: S(g, 'ellipse', { cx: 36, cy: 21, rx: 27, ry: 15, stroke: acc, 'stroke-dasharray': '3 3', fill: 'none' }); [[24, 16], [38, 14], [44, 27], [28, 28]].forEach(q => { S(g, 'ellipse', { cx: q[0], cy: q[1], rx: 6, ry: 4.6, fill: soft, stroke: acc, 'stroke-width': 1 }); D(q[0], q[1], ink, 1.5); }); S(g, 'ellipse', { cx: 8, cy: 30, rx: 5, ry: 4, fill: 'none', stroke: mut, 'stroke-width': 1 }); break;
      case 3: P('M3,22H61', mut, { 'stroke-dasharray': '2 3' }); [[10, 4, 0], [24, -14, 1], [38, 3, 0], [52, 4, 0]].forEach(b => { const hh = Math.abs(b[1]); R(b[0] - 4, b[1] < 0 ? 22 - hh : 22, 8, hh, { fill: b[2] ? acc : (_T().inkgLine || '#C9CED4'), stroke: 'none' }); }); break;
      case 6: { const t = S(g, 'text', { x: 32, y: 27, 'font-size': 21, fill: acc, stroke: 'none', 'text-anchor': 'middle', style: 'font-family:' + FONT + ';font-style:italic' }); t.textContent = 'y = bx'; break; }
      case 7: P('M3,21H61', acc); [[8, 18], [16, 24], [24, 19], [32, 23], [40, 18], [48, 22]].forEach(q => D(q[0], q[1], ink, 1.7)); P('M50,9L54,13L61,5', acc, { 'stroke-width': 1.8 }); break;
      case 8: [3, 6, 10, 15, 18, 15, 10, 6, 3].forEach((hh, i) => R(4 + i * 5.2, 34 - hh, 4.2, hh, { fill: (_T().glyphSoft || '#D3D7DC'), stroke: 'none' })); P('M3,34H52', mut); D(58, 29, acc, 2.6); P('M58,25V15', acc, { 'stroke-dasharray': '2 2' }); break;
      case 9: P('M3,28H61', mut); P('M18,24V32', mut, { 'stroke-dasharray': '2 2' }); P('M18,20H48', acc); P('M18,16.5V23.5', acc); P('M48,16.5V23.5', acc); D(35, 20, ink, 2.3); P('M52,10V32', mut, { 'stroke-dasharray': '2 3' }); break;
      case 11: S(g, 'rect', { x: 4, y: 6, width: 56, height: 28, rx: 8, stroke: mut, 'stroke-dasharray': '3 3', fill: 'none' }); D(18, 24, ink, 4); D(46, 15, acc, 5.5); P('M24,22C30,22 35,19 39,16', acc); P('M36.6,13.8L40,15.8L37.6,19', acc); break;
      // v9.4, two further adjustments: an oil derrick, and a swing that goes up and partway back
      case 12: P('M8,36L15.5,5L23,36'); P('M10.1,27.5H20.9'); P('M12.1,19.3H18.9'); P('M13.9,11.6H17.1'); P('M12.5,5H18.5'); P('M4,36H27', mut);
        P('M34,33C37,21 40,10 45,10C50,10 53,16 57,24', acc); AH(57, 24, 4, 8, acc); break;
      // v9.4, what would the answer tell us: the kept part of the bar, an arrow down to b, and b's two possible outcomes
      case 13: { R(4, 3, 56, 5, { fill: (_T().glyphSoft || '#D3D7DC'), stroke: 'none' }); R(51, 3, 9, 5, { fill: acc, stroke: 'none' });
        P('M55.5,10C55.5,15 47,16 41.5,18.5', acc); AH(41.5, 18.5, -5.5, 2.5, acc);
        const t = S(g, 'text', { x: 35, y: 25.5, 'font-size': 13, fill: acc, stroke: 'none', 'text-anchor': 'middle', style: 'font-family:' + FONT + ';font-style:italic' }); t.textContent = 'b';
        P('M30,27.5L17,35.5'); AH(17, 35.5, -13, 8, ink); P('M40,27.5L53,35.5'); AH(53, 35.5, 13, 8, ink); break; }
      // v9.4, what I'll report: a small ladder of four estimates, the intervals widening down to the final one
      case 14: P('M12,3V37', (_T().glyphSoft || '#D3D7DC')); [[27, 39], [25, 42], [21, 47], [16, 53]].forEach((s, i) => { const yy = 7 + i * 9, c = i === 3 ? acc : ink; P('M' + s[0] + ',' + yy + 'H' + s[1], c); S(g, 'rect', { x: (s[0] + s[1]) / 2 - 2.3, y: yy - 2.3, width: 4.6, height: 4.6, fill: c, stroke: 'none' }); }); break;
      default: break;
    }
    return g;
  }

  /* route (v9.4): the overview as a winding path of eleven tiles, rebuilt as a whole.
     Rows read left to right, then right to left. A band of five tiles runs three and two to a row, every other band two to a row; a titled band has its
     heading over its first row, the untitled last band (states, what I'll report) has none. Every tile shows its number, title, one-line description and a
     small drawing of its step at all times. Connectors are solid curves in the gaps, a few pixels clear of the tiles: short arcs between the tiles of a row,
     U-turns in the side margins between rows, in a muted accent. Hover and focus lift a tile (site.css, .mm-a).
     Phone and narrow panels: a compact list of the eleven steps; the one in view in the text below is marked.
     Build: the tiles come in along the path over p 0.05-0.33, each connector just before the tile it leads to. */
  const MM_MINI = { 'same-race': 1, 'nearby-intro': 2, 'exposure-scale': 3, 'adj-brief': 12, 'eq-1': 6, 'check-idea': 7, 'fluke-intro': 8, 'power-detect': 9, 'scope': 13, 'report-ladder': 14 };
  // type and spacing, roomy to compact; the first plan whose path fits the panel's height is used
  const ROUTE_PLANS = [
    { fs: 15, fd: 13, fh: 14, pad: 14, badge: 26, mini: 84, mini3: 64, gx: 42, rg: 26, hh: 30, mU: 36, wMax: 940, lt: 1.25, ld: 1.4 },
    { fs: 14, fd: 12.5, fh: 13.5, pad: 12, badge: 24, mini: 76, mini3: 58, gx: 36, rg: 22, hh: 28, mU: 32, wMax: 900, lt: 1.25, ld: 1.38 },
    { fs: 13.5, fd: 12, fh: 13, pad: 11, badge: 22, mini: 64, mini3: 52, gx: 32, rg: 16, hh: 25, mU: 28, wMax: 900, lt: 1.22, ld: 1.34 },
    { fs: 13, fd: 12, fh: 12.5, pad: 9, badge: 21, mini: 54, mini3: 48, gx: 28, rg: 12, hh: 22, mU: 24, wMax: 900, lt: 1.2, ld: 1.3 }
  ];
  // rows: a band of five runs three and two (or, in the second arrangement, a band of four runs in one row); every other band two to a row
  function routeRows(bands, four) {
    const rows = []; let dir = 1;
    bands.forEach((b, bi) => {
      const n = b.tiles.length, sizes = n === 5 ? [3, 2] : four && n === 4 ? [4] : Array.from({ length: Math.ceil(n / 2) }, () => 2);
      let i = 0;
      sizes.forEach((k, ri) => { rows.push({ band: bi, head: ri === 0 && b.title ? b.title : '', dir: dir, tiles: b.tiles.slice(i, i + k), k: k }); i += k; dir = -dir; });
    });
    return rows;
  }
  // a tile's layout at width w. Narrow tiles (three or four to a row): the badge and the drawing on top, the title and the description under them at full
  // width. Wide tiles: the title beside the badge, the description under the title, the drawing at the right.
  function routeTile(t, w, narrow, P) {
    const lhT = P.fs * P.lt, lhD = P.fd * P.ld;
    if (narrow) {
      const miniW = P.mini3, miniH = miniW * 0.625, tx = P.pad, tw = w - 2 * P.pad, top = Math.max(P.badge, miniH);
      const tl = wrap(t.title, tw, P.fs, 600), dl = wrap(t.d, tw, P.fd, 400);
      const t1 = top + 8 + P.fs * 0.8, d1 = t1 + (tl.length - 1) * lhT + P.fd * 1.45 + 1;
      const textH = d1 + (dl.length - 1) * lhD + P.fd * 0.32;
      return { tx: tx, tw: tw, tl: tl, dl: dl, lhT: lhT, lhD: lhD, t1: t1, d1: d1, miniW: miniW, miniH: miniH, h: P.pad + textH + P.pad, narrow: true };
    }
    const tx = P.pad + P.badge + 10, miniW = P.mini, miniH = miniW * 0.625, tw = w - tx - P.pad - miniW - 16;
    const tl = wrap(t.title, tw, P.fs, 600), dl = wrap(t.d, tw, P.fd, 400);
    const t1 = P.badge / 2 + P.fs * 0.36;                                            // first title baseline, from the top padding (centered on the badge)
    const d1 = t1 + (tl.length - 1) * lhT + P.fd * 1.45 + 1;                         // first description baseline
    const textH = d1 + (dl.length - 1) * lhD + P.fd * 0.32;
    return { tx: tx, tw: tw, tl: tl, dl: dl, lhT: lhT, lhD: lhD, t1: t1, d1: d1, miniW: miniW, miniH: miniH, h: P.pad + Math.max(textH, miniH + 4) + P.pad, narrow: false };
  }
  function routePlan(L, bands) {
    const avail = L.bottom - L.top - 6, span = L.right - L.pad;
    let best = null;
    // the first arrangement (five rows: 3, 2, 2, 2, 2) in every plan, then the second (four rows: 3, 2, 4, 2)
    for (const four of [false, true]) for (const P of ROUTE_PLANS) {
      const rows = routeRows(bands, four), TW = Math.min(span - 2 * P.mU, P.wMax), out = { P: P, TW: TW, rows: rows, geo: [] };
      let total = 0, ok = true;
      rows.forEach((r, ri) => {
        const w = (TW - (r.k - 1) * P.gx) / r.k, lay = r.tiles.map(t => routeTile(t, w, r.k >= 3, P));
        if (r.k >= 3 && lay.some(o => o.tl.length > 3)) ok = false;                // a title in more than three lines: too narrow
        const h = Math.max.apply(null, lay.map(o => o.h));
        out.geo.push({ w: w, lay: lay, h: h });
        total += h + (r.head ? P.hh : 0) + (ri ? P.rg : 0);
      });
      out.total = total; out.ok = ok && total <= avail;
      if (out.ok) return out;
      if (!best) best = out;
    }
    return best;
  }
  function renderRoute(g, state, ctx, info) {
    const L = setup(g, state, ctx, ''), T = L.T, p = L.phone && L.w < 520 ? Math.max(0.35, state.p) : state.p;
    if (!info.tiles.length) return;
    /* v9.5 (DESIGN.md §Components 3): a strip map replaces the card grid.
       One continuous road line with a stop per tile; beside each stop: the title (Barlow 600),
       its one-line description, and its small illustration (kept from v9.4, no tinted box).
       Band names as labels along the road. The reader's position marked with an accent ring. */
    const small = L.small || mmPhone();
    const rm = !!(window.ENGINE && window.ENGINE.reducedMotion);
    // the ring: on a phone the step in view in the list below; on desktop it travels with the stops as they come in and rests on the last one (PI, 2026-10-30)
    const act = small ? mmActiveTile() : Math.min(info.tiles.length - 1, Math.floor(clamp((p - 0.03) / 0.275, 0, 1) * info.tiles.length));

    // Try progressively tighter plans until one fits the available height.
    // Fixed column order per row: road stop → glyph → title + description (text capped at ~34rem).
    // On phones the existing linked list below the panel carries the full
    // descriptions. Keep every stop, title and illustration visible in the
    // pinned strip, rather than clipping its last stops below the panel.
    const STRIP = L.tiny ? [{ fs: 11, fd: 11, bf: 11, mw: 25, mh: 13, sg: 0, bg: 0, rox: 6, g1: 6, g2: 7 }] : L.phone
      ? [{ fs: 13, fd: 12, bf: 11, mw: 32, mh: 18, sg: 5, bg: 8, rox: 10, g1: 10, g2: 10 },
         { fs: 12, fd: 11, bf: 11, mw: 28, mh: 15, sg: 2, bg: 2, rox: 8, g1: 8, g2: 8 },
         { fs: 11, fd: 11, bf: 11, mw: 25, mh: 13, sg: 1, bg: 0, rox: 6, g1: 6, g2: 7 }]
      : small ? [{ fs: 13, fd: 12, bf: 11, mw: 32, mh: 18, sg: 5, bg: 8, rox: 10, g1: 10, g2: 10 }, { fs: 12, fd: 11, bf: 10, mw: 28, mh: 15, sg: 3, bg: 4, rox: 8, g1: 8, g2: 8 }]
      : [{ fs: 17, fd: 15, bf: 15, mw: 60, mh: 38, sg: 12, bg: 18, rox: 16, g1: 14, g2: 16 },
         { fs: 16, fd: 14, bf: 14, mw: 52, mh: 33, sg: 9, bg: 14, rox: 14, g1: 12, g2: 14 },
         { fs: 15, fd: 14, bf: 14, mw: 44, mh: 28, sg: 6, bg: 10, rox: 12, g1: 10, g2: 12 }];
    const avail = L.bottom - L.top - (L.phone ? 0 : 8);
    let SP, entries, textW, glyphX, textX;
    for (const plan of STRIP) {
      SP = small && L.w >= 480 && L.w < 520 && L.h < 340 && window.innerWidth >= 900 ? Object.assign({}, plan, { fs: Math.max(plan.fs, 11 / ZK), fd: Math.max(plan.fd, 11 / ZK), bf: Math.max(plan.bf, 11 / ZK) }) : plan;
      const roadX_ = L.pad + SP.rox;
      const gx_ = roadX_ + SP.g1;                                   // glyph column starts after road + gap1
      const tx_ = gx_ + SP.mw + SP.g2;                              // text starts after glyph + gap2
      const maxSpan = L.right - tx_;
      const tw_ = Math.min(maxSpan, small ? 320 : 544);             // cap at ~34rem
      const lhT = Math.round(SP.fs * 1.3), lhD = Math.round(SP.fd * 1.35), bH = SP.bf + (L.phone ? 4 : small ? 6 : 10);
      entries = [];
      info.bands.forEach((b, bi) => {
        if (bi > 0 && !L.tiny) entries.push({ type: 'gap', h: SP.bg });
        if (b.title && !L.tiny) entries.push({ type: 'band', text: b.title, h: bH });
        b.tiles.forEach(t => {
          const tl = wrap(t.title, tw_, SP.fs, 600), dl = small ? [] : wrap(t.d, tw_, SP.fd, 400);
          const textH = tl.length * lhT + (dl.length ? 3 + dl.length * lhD : 0);
          entries.push({ type: 'tile', tile: t, tl: tl, dl: dl, h: Math.max(textH, SP.mh) + SP.sg, lhT: lhT, lhD: lhD });
        });
      });
      textW = tw_; glyphX = gx_; textX = tx_;
      if (entries.reduce((s, e) => s + e.h, 0) <= avail) break;
    }
    const roadX = L.pad + SP.rox;
    // assign y positions, centered a little high
    let y = L.top + Math.max(4, (avail - entries.reduce((s, e) => s + e.h, 0)) * 0.4);
    entries.forEach(e => { e.y = y; y += e.h; });
    const tiles = entries.filter(e => e.type === 'tile');
    // the road: a stronger line from the first stop to the last
    const roadCol = mix(T.rule, T.muted, 0.2);                   // slightly darker than --rule
    if (tiles.length) {
      const rY0 = tiles[0].y + SP.sg / 2, rY1 = tiles[tiles.length - 1].y + tiles[tiles.length - 1].h - SP.sg;
      const rU = sm(0.01, 0.06, p);
      if (rU > 0.01) line(L, grp(L.g, rU), roadX, rY0, roadX, rY1, { stroke: roadCol, w: 2.5 });
    }
    if (L.phone) S(L.g, 'rect', { x: glyphX - 3, y: L.top, width: L.right - glyphX + 6, height: Math.min(avail + 4, y - L.top + 4), fill: T.bg });
    // band headings (aligned with the text column)
    let tIdx = 0;
    entries.forEach(e => {
      if (e.type === 'tile') tIdx++;
      if (e.type !== 'band') return;
      const u = sm(0.01 + tIdx * 0.005, 0.05 + tIdx * 0.005, p);
      if (u > 0.01) txt(L, grp(L.g, u), textX, e.y + SP.bf + 1, e.text, { size: SP.bf, weight: 500, fill: T.muted, halo: 0, noTop: true });
    });
    // tiles: stop dot, glyph, title, description
    tiles.forEach((e, i) => {
      const t = e.tile, u = sm(0.03 + i * 0.025, 0.08 + i * 0.025, p);
      if (u < 0.01) return;
      const passed = mmPassed(t), on = i === act, cy = e.y + (e.h - SP.sg) / 2;
      const gt = S(L.g, 'g', { opacity: u.toFixed(3), transform: rm || u > 0.999 ? '' : 'translate(0,' + ((1 - u) * 4).toFixed(2) + ')' });
      const a = S(gt, 'a', { href: '#b-' + t.id, tabindex: -1, class: 'mm-a', 'data-k': t.k,
        'aria-label': t.n + '. ' + t.title + '. ' + t.d + (passed ? ' Already read.' : '') });
      // invisible hit rect and focus ring (spans the content unit: road through text)
      const hitR = Math.min(textX + textW, L.right);
      S(a, 'rect', { class: 'mm-box', x: L.pad, y: e.y, width: hitR - L.pad, height: e.h - SP.sg, rx: 4, fill: 'transparent', stroke: 'none' });
      S(a, 'rect', { class: 'mm-ring', x: L.pad - 2, y: e.y - 2, width: hitR - L.pad + 4, height: e.h - SP.sg + 4, rx: 6, fill: 'none' });
      // stop dot on the road (current = accent ring; read = filled accent; else hollow)
      const dr = on ? 4.5 : 3.5;
      if (on) {
        S(a, 'circle', { cx: roadX, cy: cy, r: dr + 3.5, fill: T.bg, stroke: T.accent, 'stroke-width': 1.5 });
        S(a, 'circle', { cx: roadX, cy: cy, r: dr, fill: T.accent });
      } else if (passed) {
        S(a, 'circle', { cx: roadX, cy: cy, r: dr, fill: T.accent });
      } else {
        S(a, 'circle', { cx: roadX, cy: cy, r: dr, fill: T.bg, stroke: roadCol, 'stroke-width': 1.5 });
      }
      // glyph column: centered vertically on the title line (no tinted box)
      const gx = glyphX, gy = e.y + SP.fs * 0.9 - SP.mh * 0.55;
      mmMini(a, MM_MINI[t.id] || 0, gx, gy, SP.mw, SP.mh, T);
      // title (Barlow 600)
      const ty = e.y + SP.fs * 0.9;
      const halo = { 'paint-order': 'stroke', stroke: T.bg, 'stroke-width': 3.5, 'stroke-linejoin': 'round' };   // the faded map runs behind the text
      const tt = S(a, 'text', Object.assign({ x: textX, y: ty, 'font-size': SP.fs, 'font-weight': 600, fill: T.ink }, halo));
      e.tl.forEach((l, j) => { S(tt, 'tspan', { x: textX, dy: j ? e.lhT : 0 }).textContent = l; });
      // description (Barlow 400, muted)
      const dy = ty + (e.tl.length - 1) * e.lhT + 3 + SP.fd * 0.9;
      const td = S(a, 'text', Object.assign({ x: textX, y: dy, 'font-size': SP.fd, fill: T.muted }, halo));
      e.dl.forEach((l, j) => { S(td, 'tspan', { x: textX, dy: j ? e.lhD : 0 }).textContent = l; });
    });
  }
  // phone and narrow panels: the eleven steps as a compact list joined by a thin line; the step in view in the list below is marked
  function routeCompact(L, info, p) {
    const T = L.T, tiles = info.tiles, act = mmPhone() ? mmActiveTile() : -1, avail = L.bottom - L.top - 4;
    const nHead = info.bands.filter(b => b.title).length, gaps = info.bands.length - 1;
    let fs = 13.5, row = 24, hd = 22, gap = 8;
    for (let k = 0; k < 6 && tiles.length * row + nHead * hd + gaps * gap > avail; k++) { fs = Math.max(12, fs - 0.5); row -= 1.5; hd -= 1; gap = Math.max(3, gap - 1); }
    const total = tiles.length * row + nHead * hd + gaps * gap, x = L.pad + 10, r = Math.min(9, row * 0.38);
    let y = L.top + Math.max(2, (avail - total) * 0.4);
    const pos = [];
    info.bands.forEach((b, bi) => {
      if (bi) y += gap;
      if (b.title) { const u = sm(0.01 + bi * 0.02, 0.05 + bi * 0.02, p); if (u > 0.01) txt(L, grp(L.g, u), L.pad, y + hd * 0.62, b.title, { size: 12, weight: 600, fill: T.muted, halo: 0, noTop: true }); y += hd; }
      b.tiles.forEach(t => { pos.push({ t: t, y: y + row / 2 }); y += row; });
    });
    const uLine = sm(0.02, 0.08, p);
    for (let i = 0; i + 1 < pos.length; i++) if (uLine > 0.01) line(L, L.g, x, pos[i].y + r + 2, x, pos[i + 1].y - r - 2, { stroke: mix(T.accent, T.bg, 0.55), w: 1.2, op: uLine });
    pos.forEach((s, i) => {
      const u = sm(0.01 + i * 0.005, 0.05 + i * 0.005, p); if (u < 0.01) return;
      const on = s.t.k - 1 === act, gr = grp(L.g, u);
      S(gr, 'circle', { cx: x, cy: s.y, r: r, fill: on ? T.accent : T.accentSoft, stroke: 'none' });
      S(gr, 'text', { x: x, y: s.y + 3.8, 'font-size': 10.5, 'font-weight': 600, fill: on ? _T().onAccent : T.accent, 'text-anchor': 'middle', style: 'font-variant-numeric: tabular-nums' }).textContent = s.t.n;
      txt(L, gr, x + r + 9, s.y + fs * 0.36, s.t.title, { size: fs, weight: on ? 600 : 500, fill: on ? T.ink : mix(T.ink, T.muted, 0.35), halo: 0, noTop: true, w: L.right - x - r - 9 });
    });
  }

  function renderOverview(g, state, ctx) {
    const info = mmInfo(); if (!info) return;
    if (['idea-route', 'route'].includes(state.beat || state.id)) return renderRoute(g, state, ctx, info);
    const L = setup(g, state, ctx, '');
    const T = L.T, p = state.p, W = L.w, H = L.h, phone = mmPhone();
    // on a phone the beat is the tall list, so the picture builds early (a jump lands near p = 0.1): bands over p = 0.01-0.07, arrows after
    const band = k => phone ? sm(0.01 + 0.006 * k, 0.04 + 0.006 * k, p) : sm(0.05 + 0.025 * k, 0.125 + 0.025 * k, p);                            // bands build in turn over p = 0.05-0.25
    const arr = j => phone ? sm(0.05 + 0.006 * j, 0.08 + 0.006 * j, p) : sm(0.25 + 0.005 * j, 0.32 + 0.005 * j, p);                                // arrows between them, then the ticks: 0.25-0.45
    const aTick = phone ? sm(0.06, 0.1, p) : sm(0.3, 0.36, p);
    const edge = mix(T.rule, T.muted, 0.35);

    if (phone) {
      // a quiet vertical flow of the band labels (the list below the panel is the interface)
      const act = mmActive(), n = info.bands.length, fz = 14, rowH = clamp((H - 40) / n, 30, 46), x = clamp(W * 0.1, 22, 80), y0 = Math.max(20, (H - rowH * n) / 2 + rowH / 2 - 6);
      const gl = grp(L.g, 1);
      for (let j = 0; j < n - 1; j++) { const u = arr(j); if (u > 0.01) line(L, gl, x, y0 + j * rowH + 9, x, y0 + (j + 1) * rowH - 9, { stroke: edge, op: u }); }
      info.bands.forEach((b, k) => {
        const u = band(k), gr = grp(L.g, u), y = y0 + k * rowH + (1 - u) * 8, done = b.tiles.every(mmPassed), on = k === act;
        if (on) S(gr, 'circle', { cx: x, cy: y, r: 10, fill: T.accentSoft });
        S(gr, 'circle', { cx: x, cy: y, r: on ? 6 : 5, fill: on || (done && aTick > 0.5) ? T.accent : T.bg, stroke: on || (done && aTick > 0.5) ? T.accent : T.muted, 'stroke-width': 1.3 });
        const t = txt(L, gr, x + 20, y + 5, b.title, { size: fz, weight: on ? 600 : 500, fill: on ? T.ink : T.muted, halo: 0 });
        const nums = b.tiles.length > 1 ? b.tiles[0].n + '–' + b.tiles[b.tiles.length - 1].n : b.tiles[0].n;
        txt(L, gr, Math.min(L.right, x + 20 + Math.max(t.w, 0) + 12), y + 5, nums, { size: 12, fill: T.muted, halo: 0 });
      });
      return;
    }

    // ----- desktop: the tile map -----
    const big = W > 1100, huge = W > 1500, FS = huge ? 17.5 : big ? 16 : 14.5, FL = huge ? 14.5 : big ? 13.5 : 12.5, FT = huge ? 14 : big ? 13 : 12.5;
    let fs = FS, fl = FL, ft = FT;                                                          // the last plan below may set them smaller (never under 12px for the small texts)
    const padX = clamp(W * 0.06, 22, 96), IW = Math.min(W - 2 * padX, huge ? 1180 : 1060), x0 = (W - IW) / 2;
    const gap = clamp(IW * 0.018, 10, 18), colW = (IW - 3 * gap) / 4, grid2 = colW < 132;     // narrow panel: the four adjustments go two by two
    let num = fl + 8, ln = fs * 1.25;
    const wrapT = (s, w, size, wt) => wrap(s, w, size, wt);
    const w2 = (IW - gap) / 2, narrow = W < 640, gl = narrow ? 0 : huge ? 56 : big ? 46 : 40, gl4 = huge ? 44 : big ? 38 : 34, bandsT = info.bands, nB = bandsT.length;
    const K4 = bandsT.findIndex(b => b.tiles.length === 4);                                // v7: band 3 (the four tiles of "Comparing comparable places"), one row when it fits
    // vertical budget: four settings, roomy to compact; the first one whose tiles are tall enough for their text is used (v7: the last one also
    // sets the type a little smaller, so that nothing overflows at 900 x 600). Every band gets its minimum (the lines of its titles); what is left
    // over is shared out, up to a cap, and the block is centred (a little high).
    const PLANS = [{ CH: clamp(H * 0.03, 18, 32), LH: fl + 14, tpad: 12, padY: clamp(H * 0.04, 16, 40), sc: 1 }, { CH: 14, LH: fl + 10, tpad: 10, padY: 10, sc: 1 }, { CH: 10, LH: fl + 7, tpad: 8, padY: 6, sc: 1 }, { CH: 8, LH: 12 + 6, tpad: 6, padY: 4, sc: 0.9 }];
    let titleW2, titleW4, T4, hs, tpad, CH, LHx, padY, tot, descOn = false, dsz = 12.5, dl = 16;
    // v7.2 (critique N2): on a panel wider than about 640px each tile shows its one-line description under the title (the three roomier plans
    // are tried with it first; if none fits, the tiles go without it, as before, and the description is the hover card)
    const MODES = W > 640 ? [[true, 0], [true, 1], [true, 2], [false, 0], [false, 1], [false, 2], [false, 3]] : [[false, 0], [false, 1], [false, 2], [false, 3]];
    for (let mi = 0; mi < MODES.length; mi++) {
      const i = MODES[mi][1], pl = PLANS[i]; descOn = MODES[mi][0]; tpad = pl.tpad; CH = pl.CH; LHx = pl.LH; padY = pl.padY;
      fs = FS * pl.sc; fl = Math.max(12, FL * pl.sc); ft = Math.max(12, FT * pl.sc); num = fl + 8; ln = fs * 1.25;
      titleW2 = w2 - (tpad + num + 10) - (gl ? gl + 14 : 4); titleW4 = colW - 2 * tpad;
      dsz = ft; dl = dsz * 1.32;
      const dH = (t, w) => descOn ? 4 + wrapT(t.d, w, dsz, 400).length * dl : 0;                  // height of a tile's description at text width w
      const sumTw = IW - (tpad + num + 10) - ((gl || 36) + 24);
      const m2 = b => Math.max(44, Math.max.apply(null, b.tiles.map(t => wrapT(t.title, titleW2, fs, 600).length * ln + dH(t, titleW2))) + 2 * tpad + ft + 2);
      T4 = grid2 ? 0 : Math.max.apply(null, bandsT[K4].tiles.map(t => wrapT(t.title, titleW4, fs - 0.5, 600).length * (fs - 0.5) * 1.25 + dH(t, titleW4))) + tpad + num + 8 + 10 + ft + tpad;
      const m1 = b => Math.max(44, Math.max.apply(null, b.tiles.map(t => wrapT(t.title, sumTw, fs + 1, 600).length * (fs + 1) * 1.25 + dH(t, sumTw))) + 2 * tpad + ft + 2);
      const mins = bandsT.map((b, k) => k === K4 ? (grid2 ? 2 * m2(b) + gap : T4) : b.tiles.length === 1 ? (descOn ? m1(b) : 44) : m2(b));
      const caps = bandsT.map((b, k) => k === K4 ? (grid2 ? 2 * (big ? 112 : 100) + gap : T4 + 34) : b.tiles.length === 1 ? (big ? 96 : 84) : (big ? 112 : 100));
      const fixed = 2 * padY + nB * LHx + (nB - 1) * CH, sumMin = mins.reduce((a, c) => a + c, 0), share = Math.max(0, H - fixed - sumMin) / nB;
      hs = mins.map((m, k) => Math.max(m, Math.min(caps[k], m + share)));
      tot = nB * LHx + (nB - 1) * CH + hs.reduce((a, c) => a + c, 0);
      if (fixed + sumMin <= H) break;
    }
    let y = Math.max(padY * 0.6, (H - tot) * 0.42);
    const tips = [];

    const drawTile = (parent, t, x, yy, w, h, kind, u) => {
      const a = S(parent, 'a', { href: '#b-' + t.id, tabindex: -1, class: 'mm-a mm-' + kind, 'data-k': t.k, 'aria-label': t.n + '. ' + t.title + '. ' + t.d + (mmPassed(t) ? ' Already read.' : '') });
      const sum = kind === 'sum', four = kind === 'four';
      const size = four ? fs - 0.5 : sum ? fs + 1 : fs, tw = four ? titleW4 : sum ? w - (tpad + num + 10) - ((gl || 36) + 24) : titleW2;
      const lines = wrapT(t.title, tw, size, 600), lh = size * 1.25, dls = descOn ? wrapT(t.d, tw, dsz, 400) : [], dh = dls.length ? 4 + dls.length * dl : 0;
      let tx, ty, cx = x + tpad + num / 2, cy;
      if (four) { tx = x + tpad; ty = yy + tpad + num + 12 + size; cy = yy + tpad + num / 2; }
      else { const blockH = lines.length * lh + dh + 4 + ft; ty = yy + (h - blockH) / 2 + size * 0.95; tx = x + tpad + num + 10; cy = ty - size * 0.32; }
      S(a, 'rect', { class: 'mm-box', x: x, y: yy, width: w, height: h, rx: 7, fill: sum ? T.accentSoft : T.bg, stroke: sum ? mix(T.accent, T.bg, 0.45) : T.rule, 'stroke-width': 1.2 });
      S(a, 'rect', { class: 'mm-ring', x: x - 4, y: yy - 4, width: w + 8, height: h + 8, rx: 10, fill: 'none' });   // the site's focus ring (outline does not draw on svg links)
      S(a, 'circle', { cx: cx, cy: cy, r: num / 2, fill: sum ? T.bg : T.accentSoft, stroke: 'none' });
      const nt = S(a, 'text', { x: cx, y: cy + fl * 0.36, 'font-size': fl, 'font-weight': 600, fill: T.accent, 'text-anchor': 'middle', style: 'font-variant-numeric: tabular-nums' }); nt.textContent = t.n;
      if (mmPassed(t) && aTick > 0.01) {
        const gt = S(a, 'g', { opacity: aTick, class: 'mm-tick' }), bx = cx + num / 2 - 1, by = cy - num / 2 + 1;
        S(gt, 'circle', { cx: bx, cy: by, r: 5.5, fill: T.accent, stroke: sum ? T.accentSoft : T.bg, 'stroke-width': 1.5 });
        S(gt, 'path', { d: 'M' + (bx - 2.6) + ',' + (by + 0.2) + 'l1.8,1.8 3.2,-3.6', fill: 'none', stroke: _T().onAccent, 'stroke-width': 1.3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      }
      if (four) mmGlyph(a, t.k, x + w - tpad - gl4, yy + tpad - 3, gl4, T);
      else if (gl || sum) { const gs = gl || 36; mmGlyph(a, t.k, x + w - tpad - gs - 4, yy + (h - gs) / 2, gs, T); }
      const tt = S(a, 'text', { x: tx, y: ty, 'font-size': size, 'font-weight': 600, fill: T.ink });
      lines.forEach((l, i) => { const ts = S(tt, 'tspan', { x: tx, dy: i ? lh : 0 }); ts.textContent = l; });
      if (dls.length) {
        const td = S(a, 'text', { x: tx, y: ty + (lines.length - 1) * lh + 4 + dsz, 'font-size': dsz, fill: T.muted });
        dls.forEach((l, i) => { const ts = S(td, 'tspan', { x: tx, dy: i ? dl : 0 }); ts.textContent = l; });
      }
      // v8: time estimates removed (PI decision)
      if (!descOn) tips.push({ t: t, x: x, y: yy, w: w, h: h });
      return a;
    };

    const bandTop = [];
    bandsT.forEach((b, k) => {
      const u = band(k), gb = S(L.g, 'g', { 'aria-hidden': 'true', opacity: u, transform: 'translate(0,' + ((1 - u) * 10).toFixed(2) + ')' });
      const lab = txt(L, gb, x0, y + fl + 2, b.title, { size: fl, weight: 500, fill: T.muted, halo: 0, noTop: true });
      const ty = y + LHx;
      let hRow = hs[k];
      if (k === K4 && !grid2) {
        b.tiles.forEach((t, i) => drawTile(gb, t, x0 + i * (colW + gap), ty, colW, hs[k], 'four', u));
      } else if (k === K4) {
        const h2 = (hs[k] - gap) / 2; b.tiles.forEach((t, i) => drawTile(gb, t, x0 + (i % 2) * (w2 + gap), ty + Math.floor(i / 2) * (h2 + gap), w2, h2, 'two', u));
      } else if (b.tiles.length === 1) drawTile(gb, b.tiles[0], x0, ty, IW, hs[k], 'sum', u);
      else b.tiles.forEach((t, i) => drawTile(gb, t, x0 + i * (w2 + gap), ty, w2, hs[k], 'two', u));
      bandTop.push([y, ty, ty + hRow]);
      y = ty + hRow + CH;
    });
    // quiet arrows between the bands (stage two)
    for (let j = 0; j < nB - 1; j++) {
      const u = arr(j); if (u < 0.01) continue;
      const ya = bandTop[j][2] + 3, yb = bandTop[j + 1][0] + 1, xm = x0 + IW / 2, ga = grp(L.g, u);
      line(L, ga, xm, ya, xm, yb - 1, { stroke: edge, w: 1 });
      S(ga, 'path', { d: 'M' + (xm - 3.6) + ',' + (yb - 5) + 'L' + xm + ',' + yb + 'L' + (xm + 3.6) + ',' + (yb - 5), fill: 'none', stroke: edge, 'stroke-width': 1, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    }
    // the one-liners: drawn last (on top), shown by CSS on hover and keyboard focus of their tile
    const gTip = S(L.g, 'g', { class: 'mm-tips' });
    tips.forEach(o => {
      const tw = Math.min(250, IW * 0.5), size = 12.5, lines = wrap(o.t.d, tw - 20, size), th = lines.length * size * 1.35 + 16;
      let tipW = Math.max.apply(null, lines.map(l => measure(l, size))) + 20, tx = clamp(o.x + o.w / 2 - tipW / 2, x0 - 6, x0 + IW + 6 - tipW);
      let ty = o.y + o.h + 8; if (ty + th > H - 6) ty = o.y - th - 8;
      const gt = S(gTip, 'g', { class: 'mm-tip', 'data-k': o.t.k, 'aria-hidden': 'true' });
      S(gt, 'rect', { x: tx, y: ty, width: tipW, height: th, rx: 6, fill: T.bg, stroke: T.accent, 'stroke-width': 1.2 });
      const t = S(gt, 'text', { x: tx + 10, y: ty + 8 + size, 'font-size': size, fill: T.ink });
      lines.forEach((l, i) => { const ts = S(t, 'tspan', { x: tx + 10, dy: i ? size * 1.35 : 0 }); ts.textContent = l; });
    });
  }

  /* ---------- accessible names ---------- */
  // Every panel state is one image for a screen reader: role="img" and a label that says what the beat's picture shows (v9.4: in the storyboard's terms).
  const A_BURDEN6 = 'Two made-up counties, A and B, in the same state, shaded by their extra fuel cost, the share of household income that the price rise costs. ';
  const A_SPLIT6 = A_BURDEN6 + 'Each county’s extra fuel cost is split into two parts. County A: exposure 1.5 percent times the average rise of comparable areas, $1.20, gives 1.80 percent, plus 1.5 percent times the unusual part of the rise, $0.10, gives 0.15 percent, in total 1.95 percent. County B: 0.5 percent times $1.20 gives 0.60 percent, plus 0.5 percent times minus $0.10 gives minus 0.05 percent, in total 0.55 percent. A small bar under each county shows the two parts. ';
  const A_LOCAL = 'Two made-up counties, A and B, in the same state, each in its own local market. Prices rose $1.15 a gallon in County A’s market and $1.30 in County B’s. County A: the cost of a $1 rise is 1.6 percent of household income, times $1.15, giving an extra fuel cost of 1.84 percent. County B: 1.2 percent times $1.30 gives 1.56 percent. ';
  const A_SPLIT = 'Two made-up counties, A and B, in the same state and the same group of markets, where the group’s average rise is $1.20. ' +
    'Each county’s extra fuel cost is split into two parts. County A: exposure 1.6 percent times the group’s average rise of $1.20 gives 1.92 percent, the part that exposure alone predicts, plus 1.6 percent times the unusual part of its market’s rise, minus $0.05, gives minus 0.08 percent, in total 1.84 percent. County B: 1.2 percent times $1.20 gives 1.44 percent, plus 1.2 percent times the unusual part of its market’s rise, $0.10, gives 0.12 percent, in total 1.56 percent. A small bar under each county shows the two parts. ';
  const A_CHK = 'Illustrative numbers, not results. ';
  const A_C1 = 'First chart, check 1: ten groups of counties from low to high 2026 extra fuel cost, plotted against their vote shifts in earlier elections. The dots lie along a flat line, which is what is expected if the assumption holds; a dashed line shows the slope that would be a warning. ';
  const A_C2 = 'Second chart, check 2: four estimates of how a state’s Republican margin in 2024, oil and gas jobs, percentage gas tax and earlier exposure gap relate to its price rise. All four intervals include zero, which is what is expected. ';
  const A_SC = 'Two made-up states in one fuel supply region, each with 40 made-up counties placed by exposure. In State A the price rose 10 cents more than the region’s average, in State B 4 cents more. ';
  const A_LAG = 'The gap in Republican share between a made-up state’s more exposed and less exposed counties, in 2020, 2024 and 2026. From 2020 to 2024 the state’s price rose unusually much and the gap widened by 3 points, against the Democrats. From 2024 to 2026 the price rose unusually much again, and the gap partly closes, which looks like a reaction to this year’s prices.';
  const ARIA = {
    'idea-route': () => ARIA.route(),
    'route': () => { const i = MM.info; if (!i || !i.bands.length) return 'The overview of the rest of the page. The accessible list of links is in the text below.'; return 'The overview of the rest of the page: ' + i.tiles.length + ' steps on a winding path. ' + i.bands.map(b => (b.title ? b.title + ': ' : '') + b.tiles.map(t => t.n + ', ' + t.title).join('; ') + '.').join(' ') + ' The accessible list of links is in the text below.'; },
    'method-map': () => 'The method overview. The accessible list of links is in the text below.',
    'unusual': () => 'A made-up group of four nearby markets. Their prices rose by $1.15, $1.30, $1.18 and $1.17 a gallon; the group’s average rise is $1.20. The bars then show the unusual parts of the rises: minus 5, plus 10, minus 2 and minus 3 cents.',
    'unusual-why': () => 'The unusual parts of the four markets’ rises hold: minus 5, plus 10, minus 2 and minus 3 cents.',
    'exposure-scale': () => 'Under each market’s bar, its three to five made-up counties appear as dots sized by their exposure, from 0.5 to 2.3 percent of monthly income for a $1 rise.',
    'both-sides-total': () => 'The sixteen counties line up on one axis by their whole extra fuel cost, from about 0.7 to 2.9 percent of monthly income. The column headers give each market’s rise. The most exposed counties are furthest to the right, whichever market they are in.',
    'both-sides-bridge': () => ARIA['both-sides-total'](),
    'both-sides-remove': () => 'Each county moves left by the part of its extra fuel cost that exposure alone predicts, its exposure times the group’s average rise of $1.20, and those parts go into a hatched band at the top, labelled set aside. What is left, the unusual part of the extra fuel cost, is small. The axis then zooms in around zero, from minus 0.12 to plus 0.22 percent of monthly income: the counties of Market 2, whose price rose more than the group’s average, are to the right of zero, the others to the left.',
    'both-sides-line': () => 'The counties of the made-up group by the unusual part of their extra fuel cost, from minus 0.12 to plus 0.22 percent of monthly income. A bracket marks the most exposed counties at both ends of the line.',
    'both-sides-why': () => 'The counties of the made-up group by the unusual part of their extra fuel cost; the part that exposure alone predicts is set aside in the hatched band at the top.',
    'both-sides': () => ARIA['both-sides-line'](),
    'compare': () => 'The sixteen counties rise or fall to made-up vote shifts against the president’s party, measured from the race average, against the unusual part of their extra fuel cost. The counties further to the right moved further against the president’s party; a faint line runs through them.',
    'compare-all': () => 'About 300 faint made-up counties from many groups join the sixteen. The fitted line through all of them is the slope, b, the number I estimate.',
    'group-votes': () => 'Four columns, Market 1 to Market 4, each headed by the unusual part of its rise: minus 5, plus 10, minus 2 and minus 3 cents. Each column holds three to five made-up counties placed by vote shift against the president’s party relative to the race average, shaded by exposure, with a black line at each market’s average. Market 2’s counties sit about a point higher, its most exposed county highest.',
    'state-layer': () => A_SC + 'Each county is placed by the extra fuel cost from the unusual part of the state’s rise.',
    'state-layer-2': () => A_SC + 'Each county is placed by its made-up vote shift against the president’s party, from the state’s average, with a fitted line in each state.',
    'state-bridge': () => 'One further question, about states: do differences between states’ prices matter in their own right?',
    'state-comparison': () => A_SC + 'First, the extra fuel cost from the unusual part of the state’s rise: both states’ counties are above zero and rise with exposure, more steeply in State A. Then the same counties by made-up vote shift against the president’s party, from the state’s average, with a fitted line in each state: the line is steeper in State A.',
    'state-adj-pt': () => 'Three price-rise bars: the national price plus $1.00, a state that taxes fixed cents per gallon plus $1.00, and a state that taxes a percentage of the price plus $1.07, the extra 7 cents predicted by the tax. Then this year’s rise in the percentage-tax state, $1.12: $1.07 predicted by its price history, in gray, and 5 cents not explained by its history, which stay in the comparison.',
    'state-adj-lag': () => A_LAG,
    'adj-pt': () => 'Three made-up price-rise bars: the national price plus $1.00, a state that taxes fixed cents per gallon plus $1.00, and a state that taxes a percentage of the price plus $1.07, the extra 7 cents highlighted.',
    'adj-pt-2': () => 'The percentage-tax state’s bar, this year’s rise of $1.12, separates the $1.07 that its price history predicts, in gray, from the remaining 5 cents, which stay in the comparison.',
    'adj-lag': () => A_LAG,
    'eq-1': () => 'The whole analysis as one equation: vote shift equals b times extra fuel cost. Under vote shift: 2024 to 2026, by county. Under b: the number I estimate.',
    'eq-2': () => 'A term for the race enters, one for each race: vote shift equals race plus b times extra fuel cost.',
    'eq-3': () => 'The extra fuel cost splits into two terms: exposure times the group’s average rise, the part exposure alone predicts, and b times exposure times the unusual part of the rise, the unusual part of the extra fuel cost. The number b now multiplies only the unusual part.',
    'eq-4': () => 'Four terms enter for the adjustments: oil and gas jobs, the 2020–24 shift, pass-through and the state’s 2020–24 rise. A line under the equation says that the full equation, with all its terms, is in the analysis plan.',
    'stock-take': () => 'The equation holds, and three large question marks appear under it.',
    'state-q': () => ARIA['state-layer-2'](),
    'burden-local': () => A_LOCAL,
    'burden-split': () => A_SPLIT,
    'burden-split-2': () => A_SPLIT + 'The first part is set aside; the second is the unusual part of the extra fuel cost.',
    'burden-state': () => A_BURDEN6 + 'Prices rose $1.20 everywhere in the state, so County A’s extra fuel cost is 1.8 percent of household income and County B’s 0.6 percent; the difference comes only from exposure.',
    'burden-metro': () => A_BURDEN6 + 'The state now has two metro areas with their own price rises: $1.30 around County A and $1.10 around County B. County A’s extra fuel cost is 1.95 percent and County B’s 0.55 percent; the difference comes from exposure and from local prices.',
    'unusual-rise': () => ARIA.unusual(),
    'comparison': () => ARIA['group-votes'](),
    'checks': () => A_CHK + A_C1 + 'The second chart is shown faintly; it is introduced next.',
    'checks-2': () => A_CHK + A_C2 + 'The first chart is shown less strongly.',
    'checks-3': () => A_CHK + A_C1 + A_C2 + 'If a check failed, the estimate would be read with that in mind.',
    'recap': () => ARIA['eq-1'](), 'recap-2': () => ARIA['eq-2'](),
    'recap-3': () => ARIA['eq-3'](), 'recap-4': () => ARIA['eq-4']()
  };
  const ariaOf = (beat, pid) => (ARIA[beat] || ARIA[pid] || (() => ''))();

  /* ---------- caching ---------- */
  // The hook clears the panels layer every frame. A drawing depends only on the beat, min(p, HOLD), the size, the data and the
  // fonts, so when that key repeats the last drawing is moved into the new group instead of being rebuilt.
  const CACHE = {};
  let fontEpoch = 0;
  if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { fontEpoch++; });
  const HOLDS = { 'states-deviation': 0.55, 'group': 0.8 };
  const BEAT_HOLD = { 'state-comparison': 0.8, 'state-adj-pt': 0.8, 'adj-pt': 0.8, 'state-question': 0.8, 'stock-take': 0.6, 'both-sides-total': 0.6, 'both-sides-bridge': 0.6 };                            // v9.3: the slow beats of the states panel finish after p = 0.7                            // the group set-aside finishes after p = 0.65
  function cached(pid, fn, extra) {
    return function (g, state, ctx) {
      const node = g.node(), F = ctx.free || {}, d = ctx.data || {};
      node.setAttribute('opacity', ctx.opacity == null ? 1 : ctx.opacity);
      // the overview's tiles are aria-hidden and out of the Tab order on desktop (v7.2): the in-text nav.mm list is the keyboard and screen-reader path
      node.setAttribute('role', 'img'); node.setAttribute('aria-label', ariaOf(state.beat || state.id, pid));
      const pq = Math.min(clamp(+state.p || 0, 0, 1), BEAT_HOLD[state.beat || state.id] || HOLDS[pid] || HOLD);
      const key = [state.beat || state.id, state.next || '', pq.toFixed(4), (+state.t || 0).toFixed(4), ctx.w, ctx.h, ctx.small ? 1 : 0, window.innerWidth < 600 ? 1 : 0,
        +window.SLICE_BAND || 0, +window.SLICE_STRIP_H || 0, window.ENGINE && window.ENGINE.reducedMotion ? 1 : 0,
        F.x0, F.y0, F.x1, F.y1, d.shares ? 1 : 0, d.eia ? 1 : 0,
        fontEpoch, document.fonts ? document.fonts.status : '', extra ? extra() : ''].join('|');
      const c = CACHE[pid];
      if (c && c.key === key) { node.appendChild(c.inner); return; }
      const inner = S(node, 'g');
      fn(d3.select(inner), Object.assign({}, state, { p: pq }), Object.assign({}, ctx, { opacity: 1 }));
      CACHE[pid] = { key: key, inner: inner };
    };
  }

  /* ======================================================================
     v8 panels: new renderers for beats routed to states-deviation.
     The PANEL_OF in vis_dots.js maps unusual, unusual-why, group-votes,
     state-layer, state-layer-2, adj-pt, adj-pt-2, adj-lag and state-q
     all to 'states-deviation'. This dispatcher sends each beat to the
     right figure. The v7.2 renderStates handles unusual/unusual-rise;
     the new functions below handle the rest. */

  /* group-votes (v8, v7.2 comparison): four columns of simulated counties.
     From unusual-why the bars shrink into the column headers (p 0.05-0.25); the dots and each market's mean follow; the bracket is the second stage. */
  // [exposure, vote shift] per county, hand-set: Market 2's counties lie about a point above the others, its most exposed one highest, and every column has spread
  const GV_DOTS = [
    [[0.6, -0.65], [0.9, 0.35], [1.3, -0.35], [0.7, 0.75]],
    [[0.5, 0.35], [0.8, 1.15], [1.0, 0.6], [1.2, 1.35], [1.6, 1.85]],
    [[0.7, 0.4], [1.0, -0.55], [1.4, -0.25]],
    [[0.55, 0.5], [0.85, -0.45], [1.1, 0.05], [1.5, -0.35]]
  ];
  function renderGroupVotes(g, state, ctx) {
    const reduced = !!(window.ENGINE && window.ENGINE.reducedMotion), p = state.p;
    const L = setup(g, state, ctx, '');
    const T = L.T, small = L.small, n = MK.length, PR = T.price[1], PL = T.priceLow;
    const u = sm(0.05, 0.25, p);                                          // the bars shrink into the headers
    const aOld = reduced ? 1 - u : 1 - sm(0.05, 0.15, p), aNew = reduced ? u : sm(0.12, 0.25, p);

    // the unusual-why picture, without its bars (reduced motion: with them, cross-faded)
    let geo = null;
    if (u < 0.999) {
      const old = S(L.g, 'g', { opacity: aOld });
      geo = renderStatesCore(d3.select(old), Object.assign({}, state, { beat: 'unusual-why', p: 1, noBars: !reduced }), Object.assign({}, ctx, { opacity: aOld }));
    }

    // heading
    const hd = figHead(L, L.g, 'Vote shifts in four nearby markets', 'Illustrative', null, 1 - (geo ? aOld : 0));      // the tag cross-fades with the old figure's
    hd.title.el.setAttribute('opacity', aNew);
    const subS = small ? 12 : 13;
    const sub = txt(L, L.g, L.pad, hd.bottom + 12, (small ? 'Vote shift against the president’s party (points)' : 'Vote shift against the president’s party, relative to the race average (points)'), { size: subS, fill: T.muted, w: L.right - L.pad });
    sub.el.setAttribute('opacity', aNew);

    // columns: a gutter on the left for the scale labels
    const gutter = small ? 46 : 84, x0 = L.pad + gutter, colW = (L.right - x0) / n, colX = i => x0 + colW * (i + 0.5);
    const hz = small ? 12 : 13, hOp = reduced ? u : sm(0.15, 0.25, p);
    const gh = grp(L.g, hOp);
    let hdrBottom = 0;
    const hy = sub.y1 + (small ? 14 : 18);
    MK.forEach((mk, i) => {
      const dev = mk[1] - MK_AVG, big = i === 1;
      const str = big ? 'Market 2: ' + cents(dev) + ',\nunusually large' : mk[0] + ': ' + cents(dev);
      const t = txt(L, gh, colX(i), hy + hz, str, { anchor: 'middle', size: hz, weight: 600, fill: big ? T.accent : T.ink, w: colW - 8, halo: 0, minX: x0, maxX: L.right });
      hdrBottom = Math.max(hdrBottom, t.y1);
    });

    // plot box
    const yT = hdrBottom + 24, legH = 22, yB = Math.max(yT + 84, L.bottom - legH - 6), plotH = yB - yT, ticks = !small || plotH >= 140;      // a short phone panel keeps only the zero label
    const vHi = 2.3, vLo = -1.2, Y = v => yT + (vHi - v) / (vHi - vLo) * plotH;
    // the bars shrink into a short rule under each header
    const tw = Math.min(colW * 0.5, 72);
    if (geo && !reduced) {
      const gb = grp(L.g);
      geo.bars.forEach((b, i) => {
        const tx = colX(i) - tw / 2, ty = hdrBottom + 7, th = 4;
        S(gb, 'rect', { x: lerp(b.x, tx, u), y: lerp(b.y, ty, u), width: lerp(b.w, tw, u), height: lerp(b.h, th, u), fill: b.fill });
      });
    } else {
      const gb = grp(L.g, aNew);
      MK.forEach((mk, i) => S(gb, 'rect', { x: colX(i) - tw / 2, y: hdrBottom + 7, width: tw, height: 4, fill: mk[1] - MK_AVG >= 0 ? PR : PL }));
    }

    // scale: light gridlines, the zero line labelled "race average"
    const gs = grp(L.g, aNew);
    if (ticks) [2, 1, -1].forEach(v => {
      line(L, gs, x0, Y(v), L.right, Y(v), { stroke: T.rule, op: 0.55 });
      txt(L, gs, L.pad, Y(v) + 4, (v < 0 ? MINUS : '+') + Math.abs(v), { size: L.fsm, fill: T.muted, halo: 0 });
    });
    line(L, gs, L.pad, Y(0), L.right, Y(0), { stroke: T.muted, w: 1.5, op: 0.6 });
    const ra = wrap('race average', gutter - 6, L.fsm);
    txt(L, gs, L.pad, Y(0) - 5 - (ra.length - 1) * L.fsm * 1.3, 'race average', { size: L.fsm, fill: T.muted, halo: 0, w: gutter - 6 });
    for (let i = 1; i < n; i++) line(L, gs, x0 + colW * i, hdrBottom + 14, x0 + colW * i, yB, { stroke: T.rule, op: 0.35 });

    // counties, then each market's mean as a short black line
    const dotR = small ? 4.5 : 6, means = [];
    GV_DOTS.forEach((ds, i) => {
      const cx = colX(i), a = reduced ? u : sm(0.13 + i * 0.02, 0.22 + i * 0.01, p);
      let sum = 0;
      ds.forEach(d => {
        sum += d[1];
        if (a > 0.01) S(grp(L.g, a), 'circle', { cx: cx + (d[0] - 1.0) * colW * 0.28, cy: Y(d[1]), r: dotR, fill: mix(T.burden[0], T.burden[2], clamp((d[0] - 0.4) / 1.4, 0, 1)), stroke: T.bg, 'stroke-width': 1 });
      });
      means.push(sum / ds.length);
      const am = reduced ? u : sm(0.2, 0.26, p);
      if (am > 0.01) line(L, grp(L.g, am), cx - colW * 0.3, Y(means[i]), cx + colW * 0.3, Y(means[i]), { stroke: T.ink, w: 2 });
    });
    const gk = grp(L.g, aNew);
    txt(L, gk, L.pad, yB + (small ? 20 : 22), (small ? 'Darker dots: more exposed. Black line: market average' : 'Darker dots are more exposed counties; the black line is each market’s average'), { size: L.fsm, fill: T.muted, halo: 0, w: L.right - L.pad });

    // stage 2: a bracket from the race average to Market 2's average, and what it asks
    const aLab = reduced ? u : sm(0.25, 0.32, p);
    if (aLab > 0.01) {
      const gl = grp(L.g, aLab), bx = colX(1) + colW * 0.4, y0 = Y(0), y1 = Y(means[1]);
      line(L, gl, bx, y0, bx, y1, { stroke: T.accent, w: 1.6 });
      line(L, gl, bx - 4, y0, bx + 4, y0, { stroke: T.accent, w: 1.6 });
      line(L, gl, bx - 4, y1, bx + 4, y1, { stroke: T.accent, w: 1.6 });
      const lw = Math.min(small ? 150 : 270, L.right - bx - 16), lz = small ? 12 : 13;
      const nl = wrap('if prices matter: further against the president’s party', lw, lz, 500).length;
      txt(L, gl, bx + 10, y1 + 4 - (nl - 1) * lz * 1.3, 'if prices matter: further against the president’s party', { size: lz, weight: 500, fill: T.accent, w: lw });
    }
  }

  /* ======================================================================
     States panel (v9.4): state-bridge, state-comparison, state-adj-pt and state-adj-lag share one panel. The supply-region map (state-regions, drawn by the
     dots module) sits between state-comparison and state-adj-pt: the panel fades out at the end of state-comparison and fades in again during the map's t,
     drawing state-adj-pt's start picture, so it draws no opaque background and its titles are gone by the end of state-comparison's t.
     The titles and the "Illustrative" tag are drawn by fadeTitles (the bodies hide their own), so that two titles never overprint. */
  const STATE_TITLE_P = {};   // phones: shorter titles (filled below)
  const STATE_TITLE = { bridge: 'One further question, about states', comp: 'Two made-up states in one supply region', pt: 'National and state price rises', lag: 'Vote gap between a made-up state’s more and less exposed counties, 2020 to 2026' };
  const STATE_COMP_P = 'Two states in one supply region';
  STATE_TITLE_P[STATE_TITLE.lag] = 'Vote gap between a state’s more and less exposed counties';
  // the first option whose lines all fit maxW (line breaks only where an option puts them)
  const fitOpt = (opts, maxW, size, weight) => opts.find(o => o.split('\n').every(l => measure(l, size, weight) <= maxW)) || opts[opts.length - 1];
  // titles: [{text, op}] drawn at the figure's top left, wrapped clear of the tag and the "Back to the overview" button; tag: {text, op} or null
  function fadeTitles(g, ctx, titles, tag) {
    const small = ctx.small, T = Object.assign({}, DEF_T, ctx.T || {}), node = g.node(), tsz = FT('title', small);
    if (window.innerWidth < 900 && (ctx.w < 520 && ctx.h < 230 || ctx.w >= 520 && ctx.w < 640) || small && ctx.w >= 480 && ctx.w < 520 && ctx.h < 340) tag = null;
    if (window.innerWidth < 900 && (small || ctx.w >= 520 && ctx.w < 640) && titles.some(t => t.text === STATE_TITLE.comp)) { titles = titles.map(t => t.text === STATE_TITLE.comp ? { text: STATE_COMP_P, op: t.op } : t); tag = null; }   // phones: the source line says "made-up" and "Illustrative", so the title is short and has the row to itself apart from the button
    const pad = Math.max(small ? 14 : 28, (ctx.w - 1100) / 2 + 28), right = Math.min(ctx.w - pad, ctx.w - (small ? 14 : 28)), topY = small ? 8 : 22;
    const tz = FT('tag', small), tgw = tag ? measure(tag.text, tz, 500) + 8 : 0, tW = right - pad - (tgw ? tgw + 8 : 0) - BTN();
    const ph = small && window.innerWidth < 900;
    titles.forEach(t => {
      if (t.op < 0.001) return;
      if (ph && (t.text === STATE_TITLE.pt || t.text === STATE_TITLE.lag)) {   // phones: the first line shares its row with the button; the others take the full width
        const ls = wrapFirst(wrap, STATE_TITLE_P[t.text] || t.text, tW + BTN() - 74, right - pad, tsz, 600);
        ls.forEach((ln, k) => {
          const e = S(node, 'text', { x: pad, y: topY + tsz * 0.875 + (k ? k * tsz * 1.3 + 5 : 0), 'font-size': tsz, 'font-weight': 600, fill: T.ink, opacity: t.op, 'font-family': FONT, 'paint-order': 'stroke', stroke: T.bg, 'stroke-width': 3, 'stroke-linejoin': 'round' });
          if (!k) e.setAttribute('data-fig-title', '1');
          e.textContent = ln;
        });
        return;
      }
      const el = S(node, 'text', { x: pad, y: topY + tsz * 0.875, 'font-size': tsz, 'font-weight': 600, fill: T.ink, opacity: t.op, 'font-family': FONT, 'paint-order': 'stroke', stroke: T.bg, 'stroke-width': 3, 'stroke-linejoin': 'round', 'data-fig-title': '1' });
      wrap(t.text, tW, tsz, 600).forEach((ln, k) => { const ts = S(el, 'tspan', { x: pad, dy: k ? tsz * 1.3 : 0 }); ts.textContent = ln; });
    });
    if (tag && tag.op > 0.001) {
      const gt = S(node, 'g', { opacity: tag.op });
      S(gt, 'text', { x: right - tgw / 2, y: topY + tz + 2, 'font-size': tz, 'font-weight': 500, fill: T.muted, 'text-anchor': 'middle', 'font-family': FONT, 'data-fig-tag': '1' }).textContent = tag.text;
    }
  }
  // one layer of the panel: a group with its own opacity, drawn with the title hidden
  function stateLayer(g, ctx, op, fn) {
    if (op < 0.001) return;
    const n = S(g.node(), 'g');
    fn(d3.select(n), Object.assign({}, ctx, { opacity: op, _hideTitle: true }));
  }

  /* state-bridge: the question that remains, stated plainly (v9.4: no check mark, no "the main analysis is complete"; the tax-cut question was cut on 2026-10-27) */
  const STATE_QS = ['Do differences between states’ prices matter in their own right?'];
  function renderBridgeBody(g, state, ctx) {
    const L = setup(g, state, ctx, ''), T = L.T, p = state.p, small = L.small;
    const hd = figHead(L, L.g, STATE_TITLE.bridge, null, null, 1);
    const x0 = L.pad, W = Math.min(L.right - L.pad, 640), qz = small ? 15 : 17, lh = qz * 1.32, badge = small ? 11 : 13, gap = small ? 22 : 34;
    const one = STATE_QS.length === 1;   // a single question gets no number badge
    const tx = one ? x0 : x0 + badge * 2 + (small ? 12 : 16), tw = W - (tx - x0);
    const qs = STATE_QS.map(q => wrap(q, tw, qz, 600)), hs = qs.map(ls => Math.max(badge * 2, ls.length * lh));
    const total = hs.reduce((a, h) => a + h, 0) + gap * (hs.length - 1), y0 = hd.bottom + Math.max(small ? 24 : 40, (L.bottom - hd.bottom - total) * 0.38);
    let y = y0;
    qs.forEach((ls, i) => {
      const a = i === 0 ? sm(0.06, 0.18, p) : sm(0.14, 0.26, p), gq = grp(L.g, a);
      if (a > 0.01) {
        if (!one) {
          S(gq, 'circle', { cx: x0 + badge, cy: y + badge, r: badge, fill: T.accent });
          S(gq, 'text', { x: x0 + badge, y: y + badge + (small ? 4 : 4.6), 'font-size': small ? 12 : 13, 'font-weight': 600, fill: _T().onAccent, 'text-anchor': 'middle' }).textContent = String(i + 1);
        }
        const t = S(gq, 'text', { 'font-size': qz, 'font-weight': 600, fill: T.ink });
        ls.forEach((l, k) => { S(t, 'tspan', { x: tx, y: y + badge + qz * 0.36 + k * lh }).textContent = l; });
      }
      y += hs[i] + gap;
    });
  }
  function renderStateBridge(g, state, ctx) {
    stateLayer(g, ctx, 1, (gg, c) => renderBridgeBody(gg, state, c));
    fadeTitles(g, ctx, [{ text: STATE_TITLE.bridge, op: 1 }], null);
  }

  /* state-comparison (v9.4, rebuilt): two made-up states in one supply region, each a small plot of about 40 made-up counties with real axes.
     x: exposure, shared ticks in both plots; y: on the left plot only, one scale for both. The header of each plot is a small bar in the look of the local
     group figure: the unusual part of the state's rise against the region's average (+10¢ and +4¢, both in the price color; PI 2026-10-29: both states rise, at different rates).
     Stage 1 (p 0.05-0.3): y = the extra fuel cost from the unusual part of the state's rise, not measured from the state's average: State A's counties all
       above zero and rising with exposure, State B's above zero too but rising less steeply; the zero line labelled by its tick, "0".
     Stage 2 (p 0.5-0.7): y becomes the vote shift against the president's party, from the state's average; the counties move to made-up vote shifts; the
       zero line gets the label "state average"; a fitted line in each plot, steeper in State A; one label between the plots.
     No shading by exposure: the counties are one neutral ink color. */
  const SC = (() => {
    const r1 = mulberry(20261025), r2 = mulberry(20261026), A = [], B = [];
    for (let i = 0; i < 40; i++) { A.push({ e: clamp(0.8 + gauss(r1) * 0.4, 0.2, 2.2) }); B.push({ e: clamp(0.8 + gauss(r1) * 0.4, 0.2, 2.2) }); }
    const out = [];
    [[A, 0.10], [B, 0.04]].forEach(([ds, dev]) => {
      const m = ds.reduce((s, d) => s + d.e, 0) / ds.length;
      ds.forEach(d => { d.n = gauss(r2) * 0.22; });
      // the scatter is made uncorrelated with exposure, so that each fitted line has exactly the drawn slope (0.8 in State A, 0.32 in State B)
      const nf = groupOLS(ds.map(d => ({ x: d.e, n: d.n })), 'n');
      ds.forEach(d => { d.c = d.e * dev; d.v = 8 * dev * (d.e - m) + d.n - (nf.a + nf.b * d.e); });
      out.push({ ds: ds, dev: dev, m: m, fit: groupOLS(ds.map(d => ({ x: d.e, v: d.v })), 'v') });
    });
    return out;
  })();
  const SC_Y1 = 'Extra fuel cost from the unusual part of the state’s rise (% of monthly income)', SC_Y2 = 'Vote shift against the president’s party, from the state’s average (points)';
  const SC_Y1_P = 'Extra fuel cost from the unusual part of the rise (% of income)', SC_Y2_P = 'Vote shift against the president, from the state’s average (pts)';   // phones: one line each
  const SC_X = 'Exposure (% of monthly income for a $1 rise)';
  function stateTl(p) {
    return { frame: sm(0.08, 0.2, p), build: sm(0.12, 0.28, p), y1: sm(0.1, 0.2, p) * (1 - sm(0.5, 0.55, p)), y2: sm(0.56, 0.62, p),
      t1: 1 - sm(0.5, 0.56, p), t2: sm(0.6, 0.66, p), move: sm(0.52, 0.66, p), avg: sm(0.62, 0.68, p), fit: sm(0.64, 0.70, p), mid: sm(0.68, 0.74, p) };
  }
  function renderStateCore(g, state, ctx, tl) {
    const L = setup(g, state, ctx, ''), T = L.T, small = L.small, az = 12;
    const hd = figHead(L, L.g, L.edge ? STATE_COMP_P : STATE_TITLE.comp, 'Illustrative', null, 1);                      // hidden (fadeTitles draws the titles); it sets the layout below
    const hdB = L.edge ? hd.bottom : L.top + 0.025 * FT('title', small) + 1.3 * FT('title', small) * (L.phone ? wrap(STATE_COMP_P, L.right - L.pad - BTN(), FT('title', small), 600).length : wrap(STATE_TITLE.comp, L.right - L.pad - (measure('Illustrative', 12, 500) + 22) - BTN(), small ? 13 : 14, 600).length) + 3;
    const gap = small ? 16 : clamp((L.right - L.pad) * 0.13, 70, 110), yl = small ? 34 : 46;
    const pw = (L.right - L.pad - yl - gap) / 2, px = [L.pad + yl, L.pad + yl + pw + gap];
    // the y-axis title, above the left plot (it changes in stage 2)
    const yT1 = wrap(L.tiny ? 'Extra fuel cost (% monthly income)' : L.phone ? SC_Y1_P : SC_Y1, L.right - L.pad, az), yT2 = wrap(L.tiny ? 'Vote shift from state average (pts)' : L.phone ? SC_Y2_P : SC_Y2, L.right - L.pad, az), yTn = Math.max(yT1.length, yT2.length);
    let yTitleY = hdB + (L.phone ? 13 : small ? 16 : 22);
    // the headers: the state's name, then a small bar of the unusual part of its rise against the region's average
    const tight = small && L.bottom - L.top < 300;
    const hz = small ? 12 : 13, barW = small ? (tight ? 30 : 44) : 64, hdrY0 = yTitleY + (yTn - 1) * az * 1.3 + (L.phone ? 16 : small ? 18 : 26);
    const labs = tight ? [['+10¢'], ['+4¢']] : [['+10¢ above the region’s average', '+10¢ above the\nregion’s average', '+10¢ above\nthe region’s\naverage'], ['+4¢ above', '+4¢ above']];
    const nameW = tight ? measure('State A', hz, 600) + 8 : 0;
    const labT = [0, 1].map(i => fitOpt(labs[i], pw - nameW - barW - 14, az, 400)), labN = Math.max(labT[0].split('\n').length, labT[1].split('\n').length);
    const barY0 = tight ? hdrY0 - hz * 0.35 : hdrY0 + (small ? 14 : 18);
    const yTop0 = barY0 + Math.max(8, (labN - 1) * az * 1.3 + 4) + (tight ? (L.phone ? 8 : 12) : small ? 16 : 22);
    // the x-axis labels under the plots: ticks, then the title (under each plot; on a phone one title under both)
    const xTitle = L.tiny ? 'Exposure (% monthly income per $1 rise)' : SC_X;
    const xTn = small ? wrap(xTitle, L.right - L.pad, az).length : wrap(SC_X, pw, az).length;
    const below = (L.phone ? 20 : 24) + xTn * az * 1.3 + (small && !tight ? az * 2.6 + 8 : 0);         // phones: room under the plots for the label of stage 2
    // the plots are at most a little taller than wide; on a tall panel the whole block is centered (a little high)
    const ph0 = Math.max(L.tiny ? 22 : 60, L.bottom - below - (small && !tight ? 22 : 0) - yTop0), ph = Math.min(ph0, Math.max(pw * 1.15, 240)), dy = (ph0 - ph) * 0.4;
    yTitleY += dy;
    const hdrY = hdrY0 + dy, barY = barY0 + dy, yTop = yTop0 + dy, yBot = yTop + ph;
    const xs = (v, i) => px[i] + 8 + v / 2 * (pw - 16);
    const Y1 = v => yTop + ph / 2 - v / 0.2 * ph / 2, Y2 = v => yTop + ph / 2 - v / 1.2 * ph / 2, yz = Y1(0);
    const ink = INKG;
    const gf = grp(L.g, tl.frame);
    // y-axis title
    if (tl.y1 > 0.01) { const t = S(grp(gf, tl.y1), 'text', { 'font-size': az, fill: T.muted }); yT1.forEach((l, k) => { S(t, 'tspan', { x: L.pad, y: yTitleY + k * az * 1.3 }).textContent = l; }); }
    if (tl.y2 > 0.01) { const t = S(grp(gf, tl.y2), 'text', { 'font-size': az, fill: T.muted }); yT2.forEach((l, k) => { S(t, 'tspan', { x: L.pad, y: yTitleY + k * az * 1.3 }).textContent = l; }); }
    // y ticks (left plot) and light gridlines (both plots), the two scales cross-fading
    const tickSet = (vals, Y, fmt, op) => {
      if (op < 0.01) return; const gt = grp(gf, op);
      vals.forEach(v => {
        [0, 1].forEach(i => { if (v !== 0) line(L, gt, px[i], Y(v), px[i] + pw, Y(v), { stroke: T.rule, op: 0.6 }); });
        txt(L, gt, px[0] - 7, Y(v) + 4, fmt(v), { anchor: 'end', size: az, fill: T.muted, halo: 0, minX: L.pad - 4, noTop: true });
      });
    };
    tickSet(small ? [-0.2, 0.2] : [-0.2, -0.1, 0.1, 0.2], Y1, v => (v < 0 ? MINUS : '+') + Math.abs(v).toFixed(1), tl.t1);
    tickSet([-1, 1], Y2, v => (v < 0 ? MINUS : '+') + Math.abs(v), tl.t2);
    txt(L, gf, px[0] - 7, yz + 4, '0', { anchor: 'end', size: az, fill: T.muted, halo: 0, minX: L.pad - 4, noTop: true });
    [0, 1].forEach(i => {
      // axes: the zero line, the y-axis (left plot), the x-axis with its ticks
      line(L, gf, px[i], yz, px[i] + pw, yz, { stroke: T.muted, w: 1.2, op: 0.7 });
      if (i === 0) line(L, gf, px[0], yTop - 4, px[0], yBot, { stroke: T.muted, w: 1 });
      line(L, gf, px[i], yBot, px[i] + pw, yBot, { stroke: T.muted, w: 1 });
      (L.tiny ? [0, 2] : small ? [0, 1, 2] : [0, 0.5, 1, 1.5, 2]).forEach(v => {
        line(L, gf, xs(v, i), yBot, xs(v, i), yBot + 4, { stroke: T.muted });
        txt(L, gf, xs(v, i), yBot + 16, String(v), { anchor: 'middle', size: az, fill: T.muted, halo: 0, minX: px[i] - 6, maxX: px[i] + pw + 6, noTop: true });
      });
      if (!small) { const t = S(gf, 'text', { 'font-size': az, fill: T.muted, 'text-anchor': 'middle' }); wrap(SC_X, pw, az).forEach((l, k) => { S(t, 'tspan', { x: px[i] + pw / 2, y: yBot + 34 + k * az * 1.3 }).textContent = l; }); }
      // header: the name and the bar of the unusual part of the rise, against the region's average (a short vertical rule)
      const dev = SC[i].dev, zx = px[i] + nameW + 1 + barW * 0.5, bl = Math.abs(dev) / 0.10 * barW * 0.5, col = dev > 0 ? T.price[1] : T.priceLow;
      txt(L, gf, px[i], hdrY, i ? 'State B' : 'State A', { size: hz, weight: 600, fill: T.ink, halo: 0, noTop: true });
      S(gf, 'rect', { x: dev > 0 ? zx : zx - bl, y: barY - 5, width: bl, height: 10, fill: col });
      line(L, gf, zx, barY - 9, zx, barY + 9, { stroke: T.ink, w: 1.3 });
      const t = S(gf, 'text', { 'font-size': az, fill: dev > 0 ? T.price[1] : T.priceLow, 'font-weight': 500 });
      labT[i].split('\n').forEach((l, k) => { S(t, 'tspan', { x: px[i] + nameW + barW + 12, y: barY + 4 + k * az * 1.3 }).textContent = l; });
    });
    if (small) { const t = S(gf, 'text', { 'font-size': az, fill: T.muted, 'text-anchor': 'middle' }); wrap(xTitle, L.right - L.pad, az).forEach((l, k) => { S(t, 'tspan', { x: (L.pad + L.right) / 2, y: yBot + 32 + k * az * 1.3 }).textContent = l; }); }
    // the counties: on their lines (stage 1), then at their made-up vote shifts (stage 2)
    const r = L.tablet && (state.beat || state.id) === 'state-question' ? 1.8 : small ? 2.7 : 3.6;
    SC.forEach((sc, i) => {
      const gd = grp(L.g);
      sc.ds.forEach((d, j) => {
        const u = clamp((tl.build - j / 40 * 0.5) / 0.5, 0, 1); if (u < 0.01) return;
        const y = lerp(Y1(d.c), Y2(d.v), tl.move);
        S(gd, 'circle', { cx: xs(d.e, i).toFixed(2), cy: clamp(y, yTop + 2, yBot - 2).toFixed(2), r: (r * u).toFixed(2), fill: ink, 'fill-opacity': 0.72, stroke: T.bg, 'stroke-width': 0.8 });
      });
      if (tl.fit > 0.01) {
        const f = sc.fit, x0 = 0.25, x1 = 1.85;
        line(L, grp(L.g, tl.fit), xs(x0, i), Y2(f.a + f.b * x0), xs(x1, i), Y2(f.a + f.b * x1), { stroke: T.accent, w: 2.2 });
      }
    });
    // the zero line relabelled, once: "state average"
    // (at the end of one of the plots, above or below the line: the first place clear of the counties and the fitted lines)
    if (tl.avg > 0.01 && !L.tiny) {
      const w = measure('state average', az), cands = [[1, 'L', 1], [0, 'L', -1], [1, 'R', -1], [0, 'R', 1], [1, 'L', -1], [0, 'L', 1], [1, 'R', 1], [0, 'R', -1]];
      const box = c => { const x = c[1] === 'L' ? px[c[0]] + 4 : px[c[0]] + pw - 4 - w, yb = c[2] > 0 ? yz + 15 : yz - 6; return { x: x, y: yb, x0: x - 2, x1: x + w + 2, y0: yb - az * 0.85 - 2, y1: yb + az * 0.25 + 2 }; };
      const hits = b => SC.reduce((n, sc, i) => n + sc.ds.filter(d => { const cx = xs(d.e, i), cy = Y2(d.v); return !(cx < b.x0 - r || cx > b.x1 + r || cy < b.y0 - r || cy > b.y1 + r); }).length +
        3 * [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1].filter(f => { const xv = 0.25 + f * 1.6, cx = xs(xv, i), cy = Y2(sc.fit.a + sc.fit.b * xv); return !(cx < b.x0 || cx > b.x1 || cy < b.y0 - 2 || cy > b.y1 + 2); }).length, 0);
      const b = cands.map(box).reduce((best, c) => { const n = hits(c); return !best || n < best.n ? Object.assign(c, { n: n }) : best; }, null);
      txt(L, grp(L.g, tl.avg), b.x, b.y, 'state average', { size: az, fill: T.muted, halo: 3, noTop: true, minX: px[0], maxX: px[1] + pw });
    }
    // one label between the plots (on a phone, under them)
    if (tl.mid > 0.01 && !(L.phone && tight)) {
      const gm = grp(L.g, tl.mid), str = 'steeper where the price rose more?';
      if (tight) { const t = S(gm, 'text', { 'font-size': 12, 'font-weight': 500, fill: T.accent, 'text-anchor': 'end', 'paint-order': 'stroke', stroke: T.bg, 'stroke-width': 3 }); ['steeper where the', 'price rose more?'].forEach((l, k) => { S(t, 'tspan', { x: px[1] + pw - 2, y: yTop + 11 + k * 15 }).textContent = l; }); }
      else if (small) txt(L, gm, (L.pad + L.right) / 2, yBot + 32 + xTn * az * 1.3 + 8, str, { anchor: 'middle', size: 13, weight: 500, fill: T.accent, halo: 0, noTop: true });
      else { const ls = wrap(str, gap - 10, 13, 500), t = S(gm, 'text', { 'font-size': 13, 'font-weight': 500, fill: T.accent, 'text-anchor': 'middle' }); ls.forEach((l, k) => { S(t, 'tspan', { x: px[0] + pw + gap / 2, y: yTop + ph * 0.26 + k * 13 * 1.3 }).textContent = l; }); }
    }
  }
  function drawStateCompare(g, state, ctx, p) {
    const tl = stateTl(p), rm = !!(window.ENGINE && window.ENGINE.reducedMotion);
    if (rm && tl.move > 0.001 && tl.move < 0.999) {
      // reduced motion: the counties do not travel; the two stages cross-fade
      stateLayer(g, ctx, 1 - clamp((tl.move - 0.3) / 0.2, 0, 1), (gg, c) => renderStateCore(gg, state, c, stateTl(0.45)));
      stateLayer(g, ctx, clamp((tl.move - 0.5) / 0.2, 0, 1), (gg, c) => renderStateCore(gg, state, c, Object.assign(stateTl(0.66), { fit: tl.fit, mid: tl.mid, avg: tl.avg })));
    } else stateLayer(g, ctx, 1, (gg, c) => renderStateCore(gg, state, c, tl));
  }
  function renderStateComparison(g, state, ctx) {
    const p = state.p, fOut = sm(0.05, 0.14, p);
    stateLayer(g, ctx, 1 - fOut, (gg, c) => renderBridgeBody(gg, Object.assign({}, state, { p: 1 }), c));
    if (p > 0.05) drawStateCompare(g, state, ctx, p);
    const tOp = sm(0.11, 0.2, p);
    fadeTitles(g, ctx, [{ text: STATE_TITLE.bridge, op: 1 - sm(0.05, 0.12, p) }, { text: STATE_TITLE.comp, op: tOp }], { text: 'Illustrative', op: tOp });
  }

  /* state-adj-pt: the pass-through bars (the old adj-pt and adj-pt-2 drawing, in two stages of one beat). It starts from its own empty frame: the
     supply-region map comes in between it and the state comparison. */
  function adjPtAt(p) {
    if (p < 0.38) return { beat: 'adj-pt', p: clamp((p - 0.03) / 0.3, 0, 1) * 0.32 };
    return { beat: 'adj-pt-2', p: clamp((p - 0.38) / 0.3, 0, 1) * 0.32 };
  }
  function renderStateAdjPt(g, state, ctx) {
    const ap = adjPtAt(state.p);
    stateLayer(g, ctx, 1, (gg, c) => renderAdjPt(gg, Object.assign({}, state, { beat: ap.beat, p: ap.p }), c));
    fadeTitles(g, ctx, [{ text: STATE_TITLE.pt, op: 1 }], { text: 'Illustrative', op: 1 });
  }
  /* state-adj-lag: from the bars to the trend line of one made-up state */
  function renderStateAdjLag(g, state, ctx) {
    // v9.4 QA: the bars fade out completely before the trend-line figure fades in, so the two never overprint
    const p = state.p, fo = sm(0.03, 0.11, p), f = sm(0.11, 0.2, p);
    stateLayer(g, ctx, 1 - fo, (gg, c) => renderAdjPt(gg, Object.assign({}, state, { beat: 'adj-pt-2', p: 0.32 }), c));
    stateLayer(g, ctx, f, (gg, c) => renderAdjLagCore(gg, state, c));
    fadeTitles(g, ctx, [{ text: STATE_TITLE.pt, op: 1 - fo }, { text: STATE_TITLE.lag, op: f }], { text: 'Illustrative', op: 1 });
  }

  /* adj-pt-panel: pass-through (adj-pt, adj-pt-2)
     adj-pt:   national +$1.00, a fixed-cents-tax state +$1.00, a percentage-tax state +$1.07, with the extra 7 cents highlighted.
     adj-pt-2: this year the percentage-tax state's price rose $1.12. Its history predicts $1.07 (gray); the other 5 cents stay in the comparison.
               At p = 0 it is the end of adj-pt; the bar recolors to gray over p 0.05-0.25 and the 5 cents grow on its end.
     v9.4: every label breaks only between phrases. */
  function renderAdjPt(g, state, ctx) {
    const L = setup(g, state, ctx, '');
    const T = L.T, p = state.p, small = L.small;
    const bt = state.beat || state.id || 'adj-pt';
    const isPt2 = bt === 'adj-pt-2';
    const hd = figHead(L, L.g, STATE_TITLE.pt, 'Illustrative', null, isPt2 ? 1 : sm(0.05, 0.13, p), true);
    const fz = L.fsm, lh = fz * 1.3, barX0 = L.pad + 3, lw = L.right - barX0;
    const LB = [fitOpt(['national price: +$1.00'], lw, fz), fitOpt(['a state that taxes fixed cents per gallon: +$1.00', 'a state that taxes fixed cents per gallon:\n+$1.00'], lw, fz),
      fitOpt(['a state that taxes a percentage of the price: +$1.07', 'a state that taxes a percentage of the price:\n+$1.07', 'a state that taxes a percentage\nof the price: +$1.07'], lw, fz)];
    const labN = Math.max.apply(null, LB.map(s => s.split('\n').length));
    // a short phone panel: the names sit inside the bars (white on the bar), and the bars are packed
    const inBar = !!L.phone && L.bottom - hd.bottom < 190;
    const yT = hd.bottom + (inBar ? 8 : small ? 12 : 20), offs = inBar ? 0 : 6 + labN * lh + 4, extra = small ? 56 : 52;
    const rowIn = clamp((L.bottom - yT - 40) / 3, 25, 44), barH = inBar ? rowIn - 5 > 30 ? 30 : rowIn - 5 : small ? 18 : 26;       // inBar: the three rows share what the panel leaves
    const rowH = inBar ? Math.max(barH + 5, rowIn) : clamp((L.bottom - yT - offs - barH - extra) / 2, offs + barH + 10, small ? 76 : 96);
    const scale = (L.right - barX0 - 8) / 1.14;
    const LI = [fitOpt(['national price: +$1.00'], scale - 16, fz, 500), fitOpt(['a state that taxes fixed cents per gallon: +$1.00', 'a state taxing fixed cents per gallon: +$1.00', 'taxes fixed cents per gallon: +$1.00'], scale - 16, fz, 500),
      fitOpt(['a state that taxes a percentage of the price: +$1.07', 'a state taxing a percentage of the price: +$1.07', 'taxes a percentage of the price: +$1.07'], scale - 16, fz, 500)];
    const inLabel = (parent, y, str, op) => S(parent, 'text', { x: barX0 + 8, y: y + barH / 2 + fz * 0.36, 'font-size': fz, 'font-weight': 500, fill: _T().onAccent, opacity: op }).textContent = str;
    const label = (parent, y, str, o) => { const t = S(parent, 'text', { 'font-size': fz, fill: (o && o.fill) || T.ink, 'font-weight': (o && o.weight) || 400, 'text-anchor': (o && o.anchor) || 'start' }); str.split('\n').forEach((l, k) => { S(t, 'tspan', { x: (o && o.x != null) ? o.x : barX0, y: y + k * lh }).textContent = l; }); return t; };
    const aL = isPt2 ? 1 : sm(0.25, 0.32, p);
    [1.00, 1.00].forEach((val, i) => {
      const y = yT + i * rowH, u = isPt2 ? 1 : sm(0.05 + i * 0.035, 0.20 + i * 0.025, p);
      if (u < 0.01) return;
      const gb = grp(L.g, u);
      if (!inBar) label(gb, y + 13, LB[i]);
      S(gb, 'rect', { x: barX0, y: y + offs, width: val * scale * u, height: barH, fill: T.price[1], rx: 2 });
      if (inBar) inLabel(gb, y + offs, LI[i], 1);
    });
    // the percentage-tax state
    const y3r = yT + 2 * rowH, y3 = y3r + offs, xBase = barX0 + scale, x107 = barX0 + 1.07 * scale, x112 = barX0 + 1.12 * scale;
    const u3 = isPt2 ? 1 : sm(0.05 + 2 * 0.035, 0.20 + 2 * 0.025, p);
    const c = isPt2 ? sm(0.05, 0.25, p) : 0;                                // 0: the end of adj-pt; 1: the end of adj-pt-2
    if (u3 > 0.01) {
      const g3 = grp(L.g, u3), kOld = 1 - sm(0.05, 0.12, c ? p : 0), kNew = isPt2 ? sm(0.12, 0.2, p) : 0;
      if (!inBar) {
        label(g3, y3r + 13, LB[2]).setAttribute('opacity', kOld);
        if (kNew > 0.01) label(g3, y3r + 13, LB[2].replace('1.07', '1.12')).setAttribute('opacity', kNew);
      }
      S(g3, 'rect', { x: barX0, y: y3, width: scale * u3, height: barH, fill: mix(T.price[1], GREY, c), rx: 2 });
      if (inBar) inLabel(g3, y3, LI[2], kOld);
    }
    if (!isPt2 && aL > 0.01) {
      const gl = grp(L.g, aL);
      S(gl, 'rect', { x: xBase, y: y3, width: x107 - xBase, height: barH, fill: T.accent, rx: 2 });
      label(gl, y3 + barH + 15, 'predicted by the tax', { anchor: 'end', x: L.right, fill: T.accent, weight: 500 });
      line(L, gl, x107 - 3, y3 + barH, x107 - 3, y3 + barH + 4, { stroke: T.accent });
    }
    if (isPt2) {
      // the 7 cents turn gray with the rest of the history-predicted part; the 5 cents grow in the price color
      if (c < 0.999) S(L.g, 'rect', { x: xBase, y: y3, width: x107 - xBase, height: barH, fill: mix(T.accent, GREY, c), rx: 2 });
      else S(L.g, 'rect', { x: barX0, y: y3, width: x107 - barX0, height: barH, fill: GREY, rx: 2 });          // one rect: no seam at $1.00
      if (c > 0.01) S(L.g, 'rect', { x: x107, y: y3, width: (x112 - x107) * c, height: barH, fill: T.price[1], rx: 2 });
      const oldTax = 1 - sm(0.05, 0.12, p);
      if (oldTax > 0.01) label(grp(L.g, oldTax), y3 + barH + 15, 'predicted by the tax', { anchor: 'end', x: L.right, fill: T.accent, weight: 500 });
      const aN = sm(0.25, 0.32, p);
      if (aN > 0.01) {
        const gn = grp(L.g, aN);
        S(gn, 'text', { x: barX0 + 8, y: y3 + barH / 2 + fz * 0.36, 'font-size': fz, 'font-weight': 500, fill: _T().onAccent }).textContent = inBar && L.w < 520 ? 'Total +$1.12; predicted: +$1.07' : 'predicted by its history: +$1.07';
        const bw = Math.min(small ? L.right - barX0 - 8 : 330, L.right - barX0 - 8);
        const str = L.tiny ? 'Unexplained: +5¢' : fitOpt(['not explained by its history: +5¢, stays in the comparison', 'not explained by its history: +5¢,\nstays in the comparison', 'not explained by its history:\n+5¢, stays in the comparison'], bw, fz, 500);
        const ls = str.split('\n'), w = Math.max.apply(null, ls.map(l => measure(l, fz, 500))), ty = y3 + barH + (inBar ? 17 : 20);
        label(gn, ty, str, { anchor: 'end', x: L.right, fill: T.price[1], weight: 500 });
        const lx = clamp((x107 + x112) / 2, L.right - w + 2, L.right - 2);
        line(L, gn, (x107 + x112) / 2, y3 + barH + 2, lx, ty - fz - 1, { stroke: T.price[1] });
      }
    }
  }

  /* adj-lag-panel (v9.4: a trend line instead of arrows): the gap in Republican share between a made-up state's more and less exposed counties, in 2020, 2024 and
     2026 (the years spaced by time). Stage 1: a solid line rising from 2020 to 2024, "gap widens against the Democrats", with a price-colored bar under the
     axis over 2020-2024, "the state's price rose unusually much". Stage 2: a dashed line closing partway from 2024 to 2026, "gap partly closes: looks like
     a reaction to this year's prices", and a second bar over 2024-2026, "and again". */
  function renderAdjLagCore(g, state, ctx) {
    const L = setup(g, state, ctx, '');
    const T = L.T, p = state.p, small = L.small, z = small ? 12 : 13, az = 12;
    const hd = figHead(L, L.g, STATE_TITLE.lag, 'Illustrative', null, sm(0.05, 0.13, p), true);
    const YT = 'Republican share, more exposed minus less exposed counties (points)', azY = L.tiny ? 11 : small && wrap(YT, L.right - L.pad, az).length > 1 ? 10.5 : az, yTl = wrap(YT, L.right - L.pad, azY);   // a phone: the axis title shrinks to one line where it can, to leave the figure its height
    const tight = !!L.phone && L.bottom - hd.bottom < 190;                                  // a short phone panel: the bars' labels take one line, and the plot is packed
    const yTitleY = hd.bottom + (tight ? 12 : small ? 16 : 24);
    const x0 = L.pad + (small ? 30 : 40), x1 = L.right - (small ? 10 : 24);
    const X = yr => x0 + 14 + (yr - 2020) / 6 * (x1 - x0 - 28);
    const below = tight ? 18 + 8 + 8 + 15 + 8 : 18 + 14 + 10 + 14 + 2 * az * 1.3 + 8;       // years, the bars and their labels
    const top0 = yTitleY + (yTl.length - 1) * azY * 1.3 + (tight ? 12 : small ? 18 : 30), hMax = small ? 200 : 380, h = Math.max(tight ? 44 : small ? 56 : 90, Math.min(L.bottom - below - top0, hMax));
    const yTop = top0 + Math.max(0, (L.bottom - below - top0 - h) * 0.4), yBot = yTop + h, Y = v => yBot - (v + 0.6) / 4.6 * (yBot - yTop);
    const a0 = sm(0.06, 0.18, p), a1 = sm(0.10, 0.25, p), l1 = sm(0.20, 0.28, p), a2 = sm(0.28, 0.42, p), l2 = sm(0.38, 0.45, p);
    // axes: y title, ticks, the light zero line; the years on the x-axis
    const ga = grp(L.g, a0);
    const t = S(ga, 'text', { 'font-size': azY, fill: T.muted }); yTl.forEach((l, k) => { S(t, 'tspan', { x: L.pad, y: yTitleY + k * azY * 1.3 }).textContent = l; });
    (L.tiny ? [3] : [1, 2, 3]).forEach(v => { line(L, ga, x0, Y(v), x1, Y(v), { stroke: T.rule, op: 0.55 }); txt(L, ga, x0 - 7, Y(v) + 4, '+' + v, { anchor: 'end', size: az, fill: T.muted, halo: 0, minX: L.pad - 4, noTop: true }); });
    line(L, ga, x0, Y(0), x1, Y(0), { stroke: T.muted, w: 1.2, op: 0.6 });
    txt(L, ga, x0 - 7, Y(0) + 4, '0', { anchor: 'end', size: az, fill: T.muted, halo: 0, minX: L.pad - 4, noTop: true });
    line(L, ga, x0, yBot, x1, yBot, { stroke: T.muted });
    [2020, 2024, 2026].forEach(yr => { line(L, ga, X(yr), yBot, X(yr), yBot + 4, { stroke: T.muted }); txt(L, ga, X(yr), yBot + 18, String(yr), { anchor: 'middle', size: az, fill: T.muted, halo: 0, minX: 0, maxX: L.w, noTop: true }); });
    // the price bars under the axis, with their labels
    const by = yBot + (tight ? 26 : 30), bh = small ? 8 : 10;
    const bar = (ya, yb, u, str, op) => {
      if (u < 0.01) return; const gb = grp(L.g, op);
      S(gb, 'rect', { x: X(ya) + 2, y: by, width: Math.max(0, (X(yb) - X(ya) - 4) * u), height: bh, fill: T.price[1], rx: 2 });
      const ls = str.split('\n'), tt = S(gb, 'text', { 'font-size': az, fill: T.price[1], 'font-weight': 500, 'text-anchor': 'middle', opacity: clamp((u - 0.6) / 0.4, 0, 1) });
      if (!L.tiny) ls.forEach((l, k) => { S(tt, 'tspan', { x: (X(ya) + X(yb)) / 2, y: by + bh + 15 + k * az * 1.3 }).textContent = l; });
    };
    bar(2020, 2024, a1, fitOpt(tight ? ['price rose unusually much'] : ['the state’s price rose unusually much', 'the state’s price\nrose unusually much'], X(2024) - X(2020) - 8, az, 500), 1);
    bar(2024, 2026, a2, 'and again', 1);
    // the trend line: solid 2020-2024, dashed 2024-2026
    const v = [0, 3, 1.6], P = yr => [X(yr), Y(v[[2020, 2024, 2026].indexOf(yr)])];
    if (a1 > 0.01) {
      const p0 = P(2020), p1 = P(2024), q = a1;
      line(L, L.g, p0[0], p0[1], lerp(p0[0], p1[0], q), lerp(p0[1], p1[1], q), { stroke: T.ink, w: 2.2 });
      S(L.g, 'circle', { cx: p0[0], cy: p0[1], r: 4, fill: T.ink });
      if (q > 0.98) S(L.g, 'circle', { cx: p1[0], cy: p1[1], r: 4, fill: T.ink });
      if (l1 > 0.01 && !L.tiny) txt(L, grp(L.g, l1), L.tablet ? x0 + 4 : lerp(p0[0], p1[0], 0.5) - 10, L.tablet ? Y(3) - 14 : lerp(p0[1], p1[1], 0.5) - (small ? 20 : 12), small ? 'gap widens against\nthe Democrats' : 'gap widens against the Democrats', { anchor: L.tablet ? 'start' : 'end', size: z, weight: 500, fill: T.rep, minX: x0 + 4 });
    }
    if (a2 > 0.01) {
      const p1 = P(2024), p2 = P(2026), q = a2;
      line(L, L.g, p1[0], p1[1], lerp(p1[0], p2[0], q), lerp(p1[1], p2[1], q), { stroke: T.ink, w: 2.2, dash: '6 5' });
      if (q > 0.98) S(L.g, 'circle', { cx: p2[0], cy: p2[1], r: 4, fill: T.bg, stroke: T.ink, 'stroke-width': 2 });
      if (l2 > 0.01 && !L.tiny) {
        if (L.tablet) { txt(L, grp(L.g, l2), x1, Y(3) - 12, 'gap partly closes', { anchor: 'end', size: z, weight: 500, fill: T.dem, noTop: true }); return; }
        const str = fitOpt(['gap partly closes: looks like a reaction to this year’s prices', 'gap partly closes: looks like a reaction\nto this year’s prices', 'gap partly closes: looks like\na reaction to this\nyear’s prices', 'gap partly\ncloses: looks like\na reaction to\nthis year’s prices'], small ? L.right - X(2024) - 12 : 300, z, 500);
        const n = str.split('\n').length;
        if (small) {   // phones: two lines above the peak, clear of the dashed return segment
          const zt = 11;
          if (tight) { txt(L, grp(L.g, l2), x1, Y(3) - 7, 'gap partly closes', { anchor: 'end', size: zt, weight: 500, fill: T.dem, minX: x0 + 4, noTop: true }); return; }   // the shortest panels: one line (the text says the rest)
          txt(L, grp(L.g, l2), x1, Y(3) - 7 - zt * 1.15, 'gap partly closes: looks like\na reaction to this year’s prices', { anchor: 'end', lh: 1.15, size: zt, weight: 500, fill: T.dem, minX: x0 + 4, noTop: true });
          return;
        }
        txt(L, grp(L.g, l2), x1, Math.max(yTitleY + (yTl.length - 1) * azY * 1.3 + z + 4, Math.min(p2[1] - 16 - (n - 1) * z * 1.3, Y(3.4) + z - (n > 3 ? z * 1.3 : 0))), str, { anchor: 'end', size: z, weight: 500, fill: T.dem, minX: X(2024) + 12, noTop: true });
      }
    }
  }

  function renderAdjLag(g, state, ctx) {
    const fade = sm(0.05, 0.25, state.p);
    if (fade < 0.001) return renderAdjPt(g, Object.assign({}, state, { beat: 'adj-pt-2', p: 0.55 }), ctx);
    if (fade > 0.999) return renderAdjLagCore(g, state, ctx);
    const before = S(g.node(), 'g', { opacity: 1 - fade });
    const after = S(g.node(), 'g', { opacity: fade });
    renderAdjPt(d3.select(before), Object.assign({}, state, { beat: 'adj-pt-2', p: 0.55 }), Object.assign({}, ctx, { opacity: 1 - fade }));
    renderAdjLagCore(d3.select(after), state, Object.assign({}, ctx, { opacity: fade }));
  }

  /* ======================================================================
     group (v9.4, beats unusual ... compare-all): one made-up group of four markets and its sixteen counties, in one sequence that only moves forward.
       unusual, unusual-why: the four rises, the group's average rise, the unusual parts of the rises (renderStatesCore).
       exposure-scale: the counties appear under their market's bar, sized by exposure, with a key under them.
       both-sides-total: the counties drop onto one axis of whole extra fuel cost (exposure × the market's rise); the bars shrink into column headers (the
         market and its rise) whose colors key the dots; stage 2: an arrow to the right end.
       both-sides-remove: two slow movements. The slide (BS.slide): each county moves left by exposure × the group's average rise, leaving a gray trail; the
         trails lift into a hatched set-aside band at the top (BS.lift), in the look of the race averages' margin in same-race-2, labelled. The zoom (BS.zoom):
         the axis rescales around zero, the axis title and the figure title change, the region labels come in under the axis.
       both-sides-line: the line holds; a bracket over the most exposed at both ends. both-sides-why: holds.
       compare: the band goes; the counties rise or fall to made-up vote shifts; a faint fitted line. compare-all: 300 faint counties, the fitted slope b.
     A county keeps its dot (size and color) throughout: Market 2, whose price rose more than the group's average, violet; the other three slate.
     The annotations of a beat fade out with its t, and the next beat starts from the picture without them (an arrow in both-sides-total, the bracket in
     both-sides-line). No hollow dots, no lines between two positions of a county. */
  const GROUP_E = [[0.6, 1.0, 1.7, 2.3], [0.5, 0.9, 1.4, 1.9, 2.2],
    [0.7, 1.2, 1.9], [0.6, 1.1, 1.6, 2.0]];
  const GROUP_KEY = 'Each dot is a county, sized by its exposure';
  const GROUP_HEAD = {
    bars: 'A made-up group of four nearby markets',
    'exposure-scale': 'A made-up group of four nearby markets, with their counties',
    'both-sides-total': 'Counties of the made-up group, by extra fuel cost',
    zoom: 'Counties of the made-up group, by the unusual part of their extra fuel cost',
    'compare': 'Vote shifts of the made-up group’s counties',
    'compare-all': 'Vote shifts in many made-up groups'
  };
  // phones: shorter titles, so that the heading takes two lines (the group is named by the beats before)
  const PHONE_HEAD = { [GROUP_HEAD.bars]: 'Four local markets', [GROUP_HEAD['both-sides-total']]: 'Counties by extra fuel cost', [GROUP_HEAD.zoom]: 'Unusual part of extra fuel cost', [GROUP_HEAD.compare]: 'The made-up group’s counties', [GROUP_HEAD['compare-all']]: 'Many made-up groups' };
  // compare, compare-all on phones: the source line says "Illustrative", so the tag goes, and the title (one line) has the row to itself apart from the button
  const ONE_LINE = t => t === GROUP_HEAD.compare || t === GROUP_HEAD['compare-all'];
  const SET_LABEL = 'Set aside: the part of the extra fuel cost that exposure alone predicts', SET_LABEL_P = 'Set aside: the part exposure alone predicts';
  const AX_TOTAL = 'Extra fuel cost (% of monthly income)', AX_UNUSUAL = 'Unusual part of the extra fuel cost (% of monthly income)', AX_UNUSUAL_P = 'Unusual part of extra fuel cost (% of monthly income)';
  const AX_VOTE = 'Vote shift against the president’s party (points)', AX_VOTE_S = 'Vote shift against the president (pts)';
  const REG_LO = 'the market’s price rose less than the group’s average', REG_HI = '… rose more';   // PI 2026-10-29: the ellipsis ties it to the left label
  const D0 = [-0.16, 3.04], D1 = [-0.26, 0.26];                                   // x domains: whole extra fuel cost; its unusual part
  // both-sides-remove: the slide, the lift of the trails into the band, the band, its label, "what is left", the zoom, the region labels
  const BS = { slide: [0.05, 0.24], lift: [0.26, 0.40], band: [0.30, 0.38], label: [0.36, 0.43], left: [0.38, 0.44], leftOut: [0.45, 0.50], zoom: [0.45, 0.65], regions: [0.62, 0.70] };
  const ease = t => { const u = clamp(t, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const smr = (r, x) => sm(r[0], r[1], x);
  // room at the right of a title row for main.js's "Back to the overview" button (147px, 84px under 600px) and its gaps
  const BTN = () => ((window.innerWidth || 1024) < 600 ? 84 : 147) + 14;

  function groupOLS(ds, field) {
    const n = ds.length, mx = ds.reduce((s, d) => s + d.x, 0) / n;
    const my = ds.reduce((s, d) => s + d[field], 0) / n;
    const num = ds.reduce((s, d) => s + (d.x - mx) * (d[field] - my), 0);
    const den = ds.reduce((s, d) => s + (d.x - mx) * (d.x - mx), 0);
    const b = num / den;
    return { a: my - b * mx, b: b };
  }
  function groupData() {
    const rnd = mulberry(20261026), counties = [];
    GROUP_E.forEach((es, m) => es.forEach((e, j) => {
      const x = e * (MK[m][1] - MK_AVG);
      counties.push({ m: m, j: j, e: e, x: x, tot: e * MK[m][1], pred: e * MK_AVG,
        yL: 12 * x + clamp(gauss(rnd) * 0.30, -0.65, 0.65),
        yR: 3 * x + clamp(gauss(rnd) * 2, -3.6, 3.6) });
    }));
    // With only sixteen draws, normalize this particular noise list so it visibly has SD about 2.
    const ns = counties.map(d => d.yR - 3 * d.x), nm = ns.reduce((s, v) => s + v, 0) / ns.length;
    const nsd = Math.sqrt(ns.reduce((s, v) => s + (v - nm) * (v - nm), 0) / ns.length);
    counties.forEach((d, i) => { d.yR = 3 * d.x + clamp((ns[i] - nm) * 2 / nsd, -3.6, 3.6); });
    const cloud = [];
    for (let i = 0; i < 300; i++) {
      const x = clamp(gauss(rnd) * 0.08, -0.25, 0.25);
      cloud.push({ x: x, yR: 3 * x + clamp(gauss(rnd) * 2, -3.6, 3.6) });
    }
    const all = counties.concat(cloud), mx = all.reduce((s, d) => s + d.x, 0) / all.length;
    const error = groupOLS(all, 'yR').b - 3;
    all.forEach(d => { d.yR -= error * (d.x - mx); });
    // One shared rescale keeps the extremes in the drawn domain and leaves the OLS slope exactly 3.
    const scale = Math.min(1, ...all.map(d => (3.75 - Math.abs(3 * d.x)) / (Math.abs(d.yR - 3 * d.x) || 1)));
    all.forEach(d => { d.yR = 3 * d.x + (d.yR - 3 * d.x) * scale; });
    return { counties: counties, cloud: cloud, fitL: groupOLS(counties, 'yL'), fitR: groupOLS(all, 'yR') };
  }
  const GROUP_DATA = groupData();

  function groupRadius(L, e) {
    return (L.gScale || 1) * lerp(L.small ? 3 : 3.5, L.small ? 8 : 10.5, Math.sqrt(clamp((e - 0.4) / 1.9, 0, 1)));
  }
  // a beeswarm above the axis: y offsets (negative, from the axis) for dots at xs
  function groupStack(L, xs, rowStep) {
    const placed = [], out = [];
    GROUP_DATA.counties.map((d, i) => ({ i: i, r: groupRadius(L, d.e), x: xs[i] }))
      .sort((a, b) => a.x - b.x || b.r - a.r).forEach(o => {
        let y, row = 0;
        do { y = -o.r - 1 - row * rowStep; row++; } while (placed.some(q => Math.hypot(o.x - q.x, y - q.y) < o.r + q.r + 1) && row < 16);
        placed.push({ x: o.x, y: y, r: o.r }); out[o.i] = y;
      });
    return out;
  }
  // the zoom: the domain from whole extra fuel cost (D0) to its unusual part (D1); the span shrinks geometrically while zero moves to the middle
  function groupDomain(u) {
    const s0 = D0[1] - D0[0], s1 = D1[1] - D1[0], f0 = -D0[0] / s0, f1 = -D1[0] / s1;
    const span = s0 * Math.pow(s1 / s0, u), f = lerp(f0, f1, u), lo = -f * span;
    return [lo, lo + span];
  }
  // the heading of the group figure: the titles of all its beats wrap to the same width and the line under them (units, then the key) sits under the
  // longest, so nothing moves from beat to beat
  // (subY, from the estimate, places the plot; subYd, from the measured titles, places the key line itself, never lower than subY)
  function groupHeadMetrics(L) {
    const tz = FT('title', L.small), kz = L.small ? 12 : 13, titleW = L.right - L.pad - (L.phone && L.w < 520 ? 82 : (estW('Illustrative', FT('tag', L.small), 500) + 14) + 8 + (L.phone && !L.focusGroup ? 74 : BTN()));
    if (L.focusGroup) { const n = wrap('Counties by market', titleW, tz, 600).length, y = L.top + 14 - 0.85 * tz + n * 1.3 * tz + 12;
      return { tz: tz, kz: kz, titleW: titleW, titleN: n, subY: y, subYd: y };
    }
    const ks = Object.keys(GROUP_HEAD), hs = k => L.phone && (k === 'exposure-scale' ? 'Counties by market' : PHONE_HEAD[GROUP_HEAD[k]]) || GROUP_HEAD[k], fullW = L.right - L.pad;
    const lines = (fn, k) => L.phone ? wrapFirst(fn, hs(k), L.w < 520 ? fullW - 82 : titleW, fullW, tz, 600) : fn(hs(k), titleW, tz, 600);
    const titleN = Math.max.apply(null, ks.map(k => lines(wrapEst, k).length));
    const titleM = Math.max.apply(null, ks.map(k => lines(wrap, k).length)), at = n => L.top + 14 - 0.85 * tz + n * 1.3 * tz + 15 + (L.phone && n > 1 ? 5 : 0);   // phones: a title of several lines has 5px more after its first
    return { tz: tz, kz: kz, titleW: titleW, titleN: titleN, subY: at(titleN), subYd: Math.min(at(titleN), at(titleM)) };
  }
  // The geometry of the group panel at this size (the same for every beat, so nothing jumps between beats)
  const GL = { key: null, v: null };
  function groupLayout(L, ctx) {
    const small = L.small, key = [L.w, L.h, L.top, L.bottom, L.pad, L.right, small, L.focusGroup, BTN(), fontEpoch, document.fonts ? document.fonts.status : ''].join('|');
    if (GL.key === key) { L.gScale = GL.v.gScale; return GL.v; }
    const HM = groupHeadMetrics(L), tz = HM.tz, kz = HM.kz, titleW = HM.titleW, subY = HM.subY;
    // the shortest phone panels (375 x 553: about 165px to draw in) leave out the key after exposure-scale, which has shown it
    const noKey = !!L.phone && L.bottom - L.top < 190;
    const subEnd = L.tiny ? L.top + 28 : noKey ? subY - 6 : subY + (wrapEst(GROUP_KEY, L.right - L.pad, kz).length - 1) * kz * 1.3 + kz * 0.25;
    const x0 = L.pad + (small ? 40 : 60), x1 = L.right - 6, PW = x1 - x0;
    // a short phone panel (375 x 667: about 240px to draw in) drops the region labels and draws a thinner band
    const tight = small && L.bottom - L.top < 300;
    const G = { small: small, tight: tight, noKey: noKey, subYf: L.phone ? groupHeadMetrics(Object.assign({}, L, { focusGroup: true })).subYd : HM.subYd, tz: tz, titleW: titleW, subY: subY, subYd: HM.subYd, subEnd: subEnd, x0: x0, x1: x1, PW: PW, kz: kz };
    G.XD = (v, D) => x0 + (v - D[0]) / (D[1] - D[0]) * PW;
    // the set-aside band: its label inside at the top (as the race averages' margin), the sixteen trails under it
    G.lz = small ? 12 : 13; G.llh = small ? 15.5 : 17;
    G.labL = wrapEst(L.tiny ? 'Set aside: exposure alone predicts' : L.phone ? SET_LABEL_P : SET_LABEL, PW - 14, G.lz, 500);
    G.step = L.tiny ? 0.35 : tight ? 0.8 : small ? 1.9 : 3.0; G.barT = tight ? 1 : small ? 1.5 : 2.2;
    G.bandY0 = subEnd + (tight ? 6 : small ? 9 : 14);
    G.barsTop = G.bandY0 + 6 + G.labL.length * G.llh + (tight ? 1 : small ? 3 : 6);
    G.bandH = G.barsTop - G.bandY0 + 15 * G.step + G.barT + (tight ? 4 : small ? 5 : 8);
    // under the axis: tick labels, the axis title, the region labels
    G.az = 12;
    G.axW = small ? L.right - L.pad : PW; G.axX = small ? (L.pad + L.right) / 2 : (x0 + x1) / 2;     // phones: the axis title may use the full width
    G.axL = [wrapEst(L.tiny ? 'Extra fuel cost (% monthly income)' : AX_TOTAL, G.axW, G.az), wrapEst(L.tiny ? 'Unusual part of extra fuel cost (% monthly income)' : L.phone ? AX_UNUSUAL_P : AX_UNUSUAL, G.axW, G.az)];
    G.half = (L.right - L.pad) / 2 - 6;
    G.regL = tight ? [[], []] : [wrapEst(REG_LO, G.half, G.az), wrapEst(REG_HI, G.half, G.az)];
    const axN = Math.max(G.axL[0].length, G.axL[1].length), regN = Math.max(G.regL[0].length, G.regL[1].length);
    G.axY = (tight ? 15 : 18) + 6 + G.az;                                         // the axis title's first baseline, below the axis
    G.regY = G.axY + (axN - 1) * G.az * 1.3 + (small ? 15 : 17);                  // the region labels' first baseline
    G.below = regN ? G.regY + (regN - 1) * G.az * 1.3 + 6 : G.axY + (axN - 1) * G.az * 1.3 + 6;
    // the beeswarms: whole extra fuel cost, and its unusual part (after the zoom); a short phone panel draws the dots smaller
    let st = null, stackH = 0, top = 0, bracket = 0;
    for (const gs of [1, 0.84, 0.72, 0.62, 0.52]) {
      L.gScale = gs; G.gScale = gs;
      G.rowStep = tight ? 5 : (small ? 17 : 22) * gs;
      const ds = GROUP_DATA.counties;
      st = { T: groupStack(L, ds.map(d => G.XD(d.tot, D0)), G.rowStep), F: groupStack(L, ds.map(d => G.XD(d.x, D1)), G.rowStep) };
      stackH = Math.max.apply(null, ds.map((d, i) => -Math.min(st.T[i], st.F[i]) + groupRadius(L, d.e)));
      top = G.bandY0 + G.bandH + (L.phone && L.w < 520 ? 12 : tight ? 3 : small ? 6 : 10); bracket = noKey ? 9 : tight ? L.phone && L.w < 520 ? 30 : 17 : small ? 34 : 42;   // the shortest panels: the bracket is a bare line, the beat's text names it
      if (top + bracket + stackH + G.below <= L.bottom) break;
    }
    G.stT = st.T; G.stF = st.F; G.stackH = stackH; G.bracket = bracket;
    // both-sides: the dots, their bracket and the axis labels, centered under the band, and low enough that the counties drop onto the axis from
    // under their bars (exposure-scale)
    const bars = renderStatesCore(d3.select(S(document.createElementNS(NS, 'svg'), 'g')), { id: 'group', beat: 'unusual-why', p: 1, sq: 1, headOp: 0, annOp: 0, noBars: true }, Object.assign({}, ctx, { opacity: 1 }));
    G.bars = bars;
    const clBottom = bars.yB + (small ? 42 : 46) + 12 + groupRadius(L, 2.3);
    G.yAxBS = Math.min(L.bottom - G.below, Math.max(top + Math.max(0, (L.bottom - top - bracket - stackH - G.below) * 0.5) + bracket + stackH, clBottom + (small ? 12 : 26)));
    // compare: the plot from under the key down to above the axis labels
    G.yPt = L.phone ? L.top + 14 + 0.25 * tz + (L.tiny ? 32 : 20) : subEnd + (small ? 14 : 22);                // phones: one line of title, one of axis title (vote shifts), then the plot: the key and the tag are gone by then
    G.yAxC = L.bottom - G.below + (L.phone ? 8 : 0);                                    // phones: 8px of the 18 between the axis title and the source line
    GL.key = key; GL.v = G;
    return G;
  }
  const groupY = (G, yAx) => v => yAx - (v + 4) / 8 * (yAx - G.yPt);
  function groupClusters(L, bars) {
    if (L.phone && L.bottom - L.top < 300) {                                   // a short phone panel: one row of dots under each bar, packed by their sizes
      const w = GROUP_E.map(es => es.reduce((t, e) => t + 2 * groupRadius(L, e) + 2, -2)), at = GROUP_E.map(() => 0);
      return GROUP_DATA.counties.map(d => {
        const r = groupRadius(L, d.e), x0 = bars.x0 + bars.slot * (d.m + 0.5) - w[d.m] / 2, x = x0 + at[d.m] + r;
        at[d.m] += 2 * r + 2;
        return { x: x, y: bars.yB + 32 };
      });
    }
    return GROUP_DATA.counties.map(d => {
      const es = GROUP_E[d.m], step = Math.min(bars.slot * 0.15, L.small ? 12 : 18);
      return { x: bars.x0 + bars.slot * (d.m + 0.5) + (d.j - (es.length - 1) / 2) * step,
        y: bars.yB + (L.phone ? 47 : L.small ? 42 : 46) + (d.j % 2 ? (L.phone ? 9 : 12) : (L.phone ? -9 : -12)) };
    });
  }
  const groupFill = (L, d) => d.m === 1 ? L.T.price[1] : L.T.priceLow;
  function groupDots(L, positions, opacity, rf) {
    if (opacity < 0.001) return;
    const gd = grp(L.g, opacity), order = GROUP_DATA.counties.map((d, i) => ({ d: d, i: i }));
    order.sort((a, b) => b.d.e - a.d.e).forEach(o => {
      const pt = positions[o.i];
      S(gd, 'circle', { cx: pt.x.toFixed(2), cy: pt.y.toFixed(2), r: (groupRadius(L, o.d.e) * (rf == null ? 1 : rf)).toFixed(2), fill: groupFill(L, o.d), 'fill-opacity': 0.9, stroke: L.T.bg, 'stroke-width': 1 });
    });
  }
  // the heading: titles cross-fading at the top left (each {text, op}), the tag, and the key under them
  function groupHead(L, G, titles, keyOp, noTag, keyY, tagOp) {
    const T = L.T, tz = FT('tag', L.small), tgw = measure('Illustrative', tz, 500) + 8, hg = L.headG || L.g;
    L = Object.assign({}, L, { g: hg });
    titles.forEach(t => {
      if (t.op < 0.001) return;
      const el = txt(L, L.g, L.pad, L.top + 14, L.focusGroup || (L.phone && t.text === GROUP_HEAD['exposure-scale']) ? 'Counties by market' : L.phone && PHONE_HEAD[t.text] || t.text, L.phone ? { weight: 600, size: G.tz, w: L.right - L.pad, w1: ONE_LINE(t.text) || L.w < 520 ? L.right - L.pad - 82 : G.titleW, noTop: true } : { weight: 600, size: G.tz, w: G.titleW, noTop: true });   // phones: the title of exposure-scale stays through the start of the next beat
      el.els.forEach(e => e.setAttribute('opacity', t.op.toFixed(3))); el.el.setAttribute('data-fig-title', '1');
    });
    if (!L.edge && !noTag && !(L.phone && L.w < 520) && (tagOp == null || tagOp > 0.001)) {
      // Match figHead's plain tag exactly across the bar-to-county handoff.
      S(tagOp == null ? L.g : grp(L.g, tagOp), 'text', { x: L.right - tgw / 2, y: L.top + tz + 2, 'font-size': tz, 'font-weight': 500, fill: T.muted, 'text-anchor': 'middle', 'data-fig-tag': '1' }).textContent = 'Illustrative';
    }
    if (keyOp > 0.001 && !L.tiny) txt(L, L.g, L.pad, keyY == null ? G.subYd : keyY, L.phone && L.w < 520 && L.focusGroup ? 'Unusual part of rise, ¢; dots sized by exposure' : GROUP_KEY, { size: G.kz, fill: T.muted, w: L.right - L.pad, halo: 0 }).el.setAttribute('opacity', keyOp.toFixed(3));
  }
  function groupExposureKey(L, cluster, opacity) {
    if (opacity < 0.001 || L.tiny) return;
    const gk = grp(L.g, opacity), r0 = groupRadius(L, 0.5), r1 = groupRadius(L, 2.3);
    const low = Math.max(...cluster.map((pt, i) => pt.y + groupRadius(L, GROUP_DATA.counties[i].e)));
    const span0 = Math.min(...cluster.map((pt, i) => pt.x - groupRadius(L, GROUP_DATA.counties[i].e)));
    const span1 = Math.max(...cluster.map((pt, i) => pt.x + groupRadius(L, GROUP_DATA.counties[i].e)));
    const lessW = 2 * r0 + 6 + measure('less exposed', 12), moreW = 2 * r1 + 6 + measure('more exposed', 12);
    const gap = 12, arrowW = 34, rowW = lessW + gap + arrowW + gap + moreW, stacked = rowW > L.right - L.pad;
    const keyW = stacked ? Math.max(lessW, gap + arrowW + moreW) : rowW;
    const tight = L.phone && L.bottom - L.top < 300, y = Math.min(low + (tight ? 14 : 22), L.bottom - (stacked ? 46 : tight ? 8 : 18));
    const left = clamp((span0 + span1 - keyW) / 2, L.pad, L.right - keyW);
    const lowX = left + r0, moreX = stacked ? left + gap + arrowW + r1 : left + lessW + gap + arrowW + gap + r1;
    const moreY = stacked ? y + 25 : y;
    S(gk, 'circle', { cx: lowX, cy: y, r: r0, fill: L.T.priceLow, stroke: L.T.bg, 'stroke-width': 1 });
    txt(L, gk, lowX + r0 + 6, y + 4, 'less exposed', { size: 12, fill: L.T.muted, halo: 0 });
    if (!stacked) arrow(L, gk, left + lessW + gap, y, left + lessW + gap + arrowW, y, { stroke: L.T.muted, w: 1, head: 7 });
    else arrow(L, gk, left, moreY, left + arrowW, moreY, { stroke: L.T.muted, w: 1, head: 7 });
    S(gk, 'circle', { cx: moreX, cy: moreY, r: r1, fill: L.T.priceLow, stroke: L.T.bg, 'stroke-width': 1 });
    txt(L, gk, moreX + r1 + 6, moreY + 4, 'more exposed', { size: 12, fill: L.T.muted, halo: 0 });
  }
  // the x-axis at yAx over domain D: the axis line, zero, the two tick sets and their titles (opacity oT: whole extra fuel cost, oU: its unusual part)
  function groupXAxis(L, G, yAx, D, oT, oU, op) {
    if (op < 0.001) return;
    const T = L.T, ga = grp(L.g, op), X = v => G.XD(v, D);
    line(L, ga, G.x0, yAx, G.x1, yAx, { stroke: T.muted, w: 1.2 });
    const tick = (v, label, o) => {
      const x = X(v); if (o < 0.01 || x < G.x0 - 2 || x > G.x1 + 2) return;
      const gt = grp(ga, o); line(L, gt, x, yAx, x, yAx + 5, { stroke: T.muted });
      txt(L, gt, x, yAx + 18, label, { anchor: 'middle', size: 12, fill: T.muted, halo: 0, minX: G.x0 - 16, maxX: G.x1 + 6, noTop: true });
    };
    tick(0, '0', 1);
    [1, 2, 3].forEach(v => tick(v, String(v), oT));
    (G.small ? [-0.2, 0.2] : [-0.2, -0.1, 0.1, 0.2]).forEach(v => tick(v, (v < 0 ? MINUS : '+') + Math.abs(v).toFixed(1), oU));
    const title = (ls, o) => { if (o < 0.01) return; const t = S(grp(ga, o), 'text', { 'font-size': G.az, fill: T.muted, 'text-anchor': 'middle' }); ls.forEach((l, k) => { S(t, 'tspan', { x: G.axX, y: yAx + G.axY + k * G.az * 1.3 }).textContent = l; }); };
    title(G.axL[0], oT); title(G.axL[1], oU);
  }
  function groupRegions(L, G, yAx, op) {
    if (op < 0.001 || !G.regL[0].length) return;
    const gr = grp(L.g, op), T = L.T;
    const tl = S(gr, 'text', { 'font-size': G.az, fill: T.muted });
    G.regL[0].forEach((l, k) => { S(tl, 'tspan', { x: L.pad, y: yAx + G.regY + k * G.az * 1.3 }).textContent = l; });
    const tr = S(gr, 'text', { 'font-size': G.az, fill: T.muted, 'text-anchor': 'end' });
    G.regL[1].forEach((l, k) => { S(tr, 'tspan', { x: L.right, y: yAx + G.regY + k * G.az * 1.3 }).textContent = l; });
  }
  // the order of the trails in the band: longest on top
  const GROUP_RANK = (() => { const o = GROUP_DATA.counties.map((d, i) => i).sort((a, b) => GROUP_DATA.counties[b].pred - GROUP_DATA.counties[a].pred), r = []; o.forEach((i, k) => { r[i] = k; }); return r; })();
  function groupHatch(L) {
    if (document.getElementById('dots-hatch')) return 'dots-hatch';
    if (!L.defs.querySelector('#dp-group-hatch')) {
      const pat = S(L.defs, 'pattern', { id: 'dp-group-hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
      S(pat, 'line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: L.T.muted, 'stroke-width': 1, opacity: 0.35 });
    }
    return 'dp-group-hatch';
  }
  // the set-aside band: the hatched frame (frameOp), the trails in their rows (barOp), the label (labelOp)
  function groupBand(L, G, frameOp, barOp, labelOp) {
    const T = L.T;
    if (frameOp > 0.001) S(grp(L.g, frameOp), 'rect', { x: G.x0, y: G.bandY0, width: G.PW, height: G.bandH, fill: 'url(#' + groupHatch(L) + ')', stroke: T.rule, 'stroke-width': 1, opacity: 0.9 });
    if (barOp > 0.001) {
      const gb = grp(L.g, barOp);
      GROUP_DATA.counties.forEach((d, i) => {
        const xa = G.XD(d.x, D0), xb = G.XD(d.tot, D0), y = G.barsTop + GROUP_RANK[i] * G.step;
        S(gb, 'rect', { x: xa.toFixed(2), y: y.toFixed(2), width: (xb - xa).toFixed(2), height: G.barT, rx: G.barT / 2, fill: GREY, opacity: 0.85 });
      });
    }
    if (labelOp > 0.001) {
      const gl = grp(L.g, labelOp), ty = G.bandY0 + 6 + G.lz;
      S(gl, 'rect', { x: G.x0 + 3, y: ty - G.lz - 1, width: G.PW - 6, height: G.labL.length * G.llh + 6, fill: T.bg, opacity: 0.92 });
      const t = S(gl, 'text', { 'font-size': G.lz, 'font-weight': 500, fill: T.ink });
      G.labL.forEach((l, k) => { S(t, 'tspan', { x: G.x0 + 7, y: ty + k * G.llh }).textContent = l; });
    }
  }
  // the column headers of both-sides-total: the shrunk bars (short rules in the market's color), the market and its rise
  function groupHeaders(L, G, bars, u, labelOp, ruleOp, layer) {
    const ro = ruleOp == null ? 1 : ruleOp;
    if (!bars || (ro < 0.001 && labelOp < 0.01)) return;
    const T = L.T, hz = 12, tw = Math.min(bars.slot * 0.42, 54), ty = G.bandY0 + 2, gb = ro > 0.001 ? grp(layer || L.g, ro) : null;
    bars.bars.forEach((b, i) => {
      const cx = bars.x0 + bars.slot * (i + 0.5);
      if (gb) S(gb, 'rect', { x: lerp(b.x, cx - tw / 2, u).toFixed(2), y: lerp(b.y, ty, u).toFixed(2), width: lerp(b.w, tw, u).toFixed(2), height: lerp(b.h, 4, u).toFixed(2), fill: MK[i][1] - MK_AVG >= 0 ? T.price[1] : T.priceLow });
      if (labelOp > 0.01 && !L.tiny) {
        const t = S(grp(L.g, labelOp), 'text', { 'font-size': hz, fill: T.ink, 'text-anchor': 'middle' });
        S(t, 'tspan', { x: cx, y: ty + 4 + hz + 4, 'font-weight': 600 }).textContent = MK[i][0];
        S(t, 'tspan', { x: cx, y: ty + 4 + 2 * hz + 7, fill: T.muted }).textContent = sgn(MK[i][1]);
      }
    });
  }
  // the bracket over the most exposed county at each end of the line
  function groupBracket(L, G, pos, yAx, opacity) {
    if (opacity < 0.001) return;
    const ds = GROUP_DATA.counties, li = 3, ri = 8, x0 = pos[li].x, x1 = pos[ri].x;
    const top = Math.min(...pos.map((q, i) => q.y - groupRadius(L, ds[i].e)));
    const y = top - (G.noKey ? 5 : G.tight ? 9 : L.small ? 10 : 13), gb = grp(L.g, opacity), z = L.small ? 12 : 13;
    line(L, gb, x0, y, x1, y, { stroke: L.T.accent, w: 1.4 });
    [li, ri].forEach(i => line(L, gb, pos[i].x, y, pos[i].x, pos[i].y - groupRadius(L, ds[i].e) - 3, { stroke: L.T.accent, w: 1.4 }));
    const label = 'the most exposed: on both sides', lw = Math.min(G.PW, L.small ? 200 : 320);
    if (G.noKey) return;
    if (G.tight) {
      const above = L.phone && L.w < 520 || L.edge;
      const w = measure(label, z, 500) + 8, cx = clamp((x0 + x1) / 2, G.x0 + w / 2, G.x1 - w / 2);
      S(gb, 'rect', { x: cx - w / 2, y: y - z * (above ? 1.9 : 0.75), width: w, height: z * 1.4, fill: L.T.bg });
      txt(L, gb, cx, above ? y - 8 : y + z * 0.36, label, { anchor: 'middle', size: z, weight: 500, fill: L.T.accent, halo: 0, minX: G.x0, maxX: G.x1 });
      return;
    }
    const n = wrap(label, lw, z, 500).length;
    txt(L, gb, (x0 + x1) / 2, y - 7 - (n - 1) * z * 1.3, label, { anchor: 'middle', size: z, weight: 500, fill: L.T.accent, w: lw, minX: G.x0, maxX: G.x1 });
  }
  function groupGrid(L, G, Y, opacity) {
    if (opacity < 0.001) return;
    const gg = grp(L.g, opacity), T = L.T, vals = L.small ? [4, 0, -4] : [4, 2, 0, -2, -4];
    [4, 2, -2, -4].forEach(v => line(L, gg, G.x0, Y(v), G.x1, Y(v), { stroke: T.rule, op: 0.8 }));
    line(L, gg, G.x0, Y(0), G.x1, Y(0), { stroke: T.muted, w: 1.5 });
    vals.filter(v => !(L.phone && L.w < 520 && v === 0)).forEach(v => txt(L, gg, G.x0 - 8, Y(v) + 4, v === 0 ? '0' : (v < 0 ? MINUS : '+') + Math.abs(v), { anchor: 'end', size: 12, fill: T.muted, halo: 0, minX: L.pad, maxX: G.x0 - 4 }));
    if (L.phone && L.w < 520) txt(L, gg, G.x0 - 8, Y(0) - 4, 'race\navg.', { anchor: 'end', size: 11, fill: T.muted, halo: 0, minX: L.pad, maxX: G.x0 - 8 });
    else txt(L, gg, G.x0 + 5, Y(0) - 6, 'race average', { size: L.small ? 11 : 12, fill: T.muted, halo: 3, minX: G.x0, maxX: G.x1 });
    // the axis title, along the y-axis
    // v9.4 QA: the rotated title may run a little past the ticks (two lines on a phone) so that its first line stays on the screen
    if (L.phone) { txt(L, gg, L.pad, G.yPt - 9, AX_VOTE_S, { size: 12, fill: T.muted, halo: 0 }); return; }
    const ys = (Y(4) + Y(-4)) / 2, str = L.small ? AX_VOTE_S : AX_VOTE, t = S(gg, 'text', { 'font-size': 12, fill: T.muted, 'text-anchor': 'middle', transform: 'translate(' + (L.pad + 4 + (L.small ? 6 : 0)) + ',' + ys.toFixed(1) + ') rotate(-90)' });
    const ln = wrap(str, Math.abs(Y(-4) - Y(4)) + (L.small ? 26 : -6), 12);
    ln.forEach((l, k) => { S(t, 'tspan', { x: 0, y: (k - ln.length + 1) * 14 + 4 }).textContent = l; });
  }
  function groupFitLine(L, G, Y, fit, x0, x1, opacity, accent) {
    if (opacity < 0.001) return;
    const gl = grp(L.g, opacity), yy = x => fit.a + fit.b * x, X = v => G.XD(v, D1);
    line(L, gl, X(x0), Y(yy(x0)), X(x1), Y(yy(x1)), { stroke: accent ? L.T.accent : L.T.ink, w: accent ? 2.5 : 1.5, op: accent ? 1 : 0.35 });
  }
  function groupFitLabel(L, G, Y, fit, x, opacity, accent, label) {
    if (opacity < 0.001 || L.tiny) return;
    const gl = grp(L.g, opacity), z = accent ? 13 : 12, weight = accent ? 500 : 400, X = v => G.XD(v, D1);
    const lw = L.phone ? G.PW - 10 : Math.min(L.small ? 200 : 280, G.PW * 0.75);
    // line breaks only between phrases: the label as given, else split at its listed break points (label: a string or a list of variants)
    const opts = Array.isArray(label) ? label : [label];
    label = opts.find(o => o.split('\n').every(l => measure(l, z, weight) <= lw)) || opts[opts.length - 1];
    const lines = label.split('\n'), lh = z * 1.3, yAx = Y(-4);
    const width = Math.max(...lines.map(s => measure(s, z, weight)));
    const rx = G.x1 - 5, left = rx - width, lineY = Y(fit.a + fit.b * x);
    const candidates = [lineY - 16 - (lines.length - 1) * lh, lineY + 18, lineY - 32 - (lines.length - 1) * lh, lineY + 36, G.yPt + z + 1, G.subEnd + 5 + z * 0.85, yAx - 8 - (lines.length - 1) * lh - z * 0.25];
    let best = null;
    candidates.forEach(y => {
      const top = y - z * 0.85, bottom = y + (lines.length - 1) * lh + z * 0.25;
      if (top < (L.phone ? G.yPt : G.subEnd + 5) || bottom > yAx - 5) return;
      let hits = 0;
      // the label must also clear the fitted line itself over its whole width (the line is lower at the label's left end)
      const xa = X(-0.26), xb = X(0.26), lineAt = px => Y(fit.a + fit.b * (-0.26 + (px - xa) / (xb - xa) * 0.52));
      const l0 = lineAt(left), l1 = lineAt(rx);
      if (Math.min(l0, l1) - 5 < bottom && Math.max(l0, l1) + 5 > top) hits += 2;
      GROUP_DATA.counties.forEach(d => {
        const cx = X(d.x), cy = Y(accent ? d.yR : d.yL), r = groupRadius(L, d.e) + 2;
        const dx = Math.max(left - cx, 0, cx - rx), dy = Math.max(top - cy, 0, cy - bottom);
        if (Math.hypot(dx, dy) < r) hits++;
      });
      const score = hits * 1000 + Math.abs(y - lineY);
      if (!best || score < best.score) best = { y: y, score: score };
    });
    const lab = txt(L, gl, G.x1 - 5, best ? best.y : G.yPt + z + 1, label, { anchor: 'end', size: z, weight: weight, fill: accent ? L.T.accent : L.T.muted, minX: G.x0, maxX: G.x1 });
    if (L.phone && L.w < 520) { const r = S(gl, 'rect', { x: lab.x0 - 3, y: lab.y0 - 1, width: lab.w + 6, height: lab.y1 - lab.y0 + 2, rx: 2, fill: L.T.bg }); gl.insertBefore(r, lab.el); }   // phones: a plate keeps the faint counties of compare-all out from under the label
  }
  // the unusual-why bar chart, squashed by sq, with its own heading and labels at opacity ann (its bars hidden when noBars)
  function groupBarChart(L, state, ctx, sq, ann, opacity, barsFn) {
    if (opacity < 0.001 && !barsFn) return null;
    return renderStatesCore(d3.select(grp(L.g)), Object.assign({}, state, { beat: 'unusual-why', p: 1, sq: sq, headOp: ann, annOp: ann, chartOp: opacity, noBars: !!barsFn, barsFn: barsFn, noTag: true }), Object.assign({}, ctx, { opacity: 1 }));
  }

  function renderGroupCore(g, state, ctx) {
    let beat = state.beat || state.id;
    if (beat === 'both-sides') beat = 'both-sides-line';
    if (beat === 'both-sides-bridge') beat = 'both-sides-total';                    // main.js's v9.4 placeholder alias sends the old id
    if (beat === 'unusual' || beat === 'unusual-why') return renderStates(g, state, ctx);
    const p = state.p, te = ease(state.t || 0), L = setup(g, state, ctx, ''), T = L.T, G = groupLayout(L, ctx), ds = GROUP_DATA.counties;
    if (state.headOnly) { L.headG = L.g; L.g = S(S(document.createElementNS(NS, 'svg'), 'g'), 'g'); }     // reduced motion: only the heading, at the actual p
    else if (state.noHead) L.headG = S(document.createElementNS(NS, 'svg'), 'g');                       // reduced motion: the body without its heading
    const posT = ds.map((d, i) => ({ x: G.XD(d.tot, D0), y: G.yAxBS + G.stT[i] }));     // whole extra fuel cost
    const posF = ds.map((d, i) => ({ x: G.XD(d.x, D1), y: G.yAxBS + G.stF[i] }));       // its unusual part, after the zoom

    if (beat === 'exposure-scale') {
      const u = sm(0.05, 0.25, p), head = sm(0.05, 0.15, p);
      const bars = groupBarChart(L, state, ctx, u, 1 - head, 1);
      groupHead(L, G, [{ text: GROUP_HEAD['exposure-scale'], op: head }], head);
      const cl = groupClusters(L, bars);
      ds.map((d, i) => ({ d: d, i: i })).sort((a, b) => b.d.e - a.d.e).forEach(o => {
        const a = sm(0.08 + o.d.m * 0.008, 0.23 + o.d.m * 0.005, p);
        if (a > 0.001) S(grp(L.g, a), 'circle', { cx: cl[o.i].x, cy: cl[o.i].y, r: groupRadius(L, o.d.e) * a, fill: groupFill(L, o.d), 'fill-opacity': 0.9, stroke: T.bg, 'stroke-width': 1 });
      });
      groupExposureKey(L, cl, sm(0.15, 0.25, p));
      return;
    }

    if (beat === 'both-sides-total') {
      // the bar chart fades (its bars shrink into the column headers instead), the counties drop from under their bars onto the axis
      const u = sm(0.05, 0.25, p), fade = 1 - sm(0.05, 0.13, p), bars = G.bars;
      groupBarChart(L, state, ctx, 1, 0, fade, layer => groupHeaders(L, G, bars, u, 0, 1, layer));
      // stage 2's label: above the dots; phones: the whole width, or, where the dots leave no room above them, over the column headers (which fade for it)
      const nz = L.small ? 12 : 13, nlh = nz * 1.3, aL = sm(0.45, 0.52, p) * (1 - te), nRight = ds.map((d, i) => i).filter(i => ds[i].tot > 2.2);
      const nTx = nRight.reduce((s, i) => s + posT[i].x, 0) / nRight.length, nTop = Math.min(...nRight.map(i => posT[i].y - groupRadius(L, ds[i].e)));
      const nOpts = ['the most exposed, whatever their market', 'the most exposed,\nwhatever their market'], hdrBottom = G.bandY0 + 2 + 4 + 2 * 12 + 9;
      const nStr = nOpts.find(o => o.split('\n').every(l => measure(l, nz, 500) <= (L.phone ? G.PW - 8 : L.small ? 175 : 300))) || nOpts[1], nN = nStr.split('\n').length;
      let nYb = nTop - (L.small ? 24 : 36), nBand = false;
      if (L.phone) {
        const left = G.x1 - Math.max(...nStr.split('\n').map(l => measure(l, nz, 500))) - 4;
        nYb = Math.min(...ds.map((d, i) => posT[i].x + groupRadius(L, d.e) >= left ? posT[i].y - groupRadius(L, d.e) : Infinity)) - 8;
        if (nYb - (nN - 1) * nlh - nz * 0.85 <= hdrBottom + 2) { nBand = true; nYb = G.bandY0 + 10 + nz; }
      }
      groupHeaders(L, G, bars, 1, sm(0.16, 0.26, p) * (nBand ? 1 - aL : 1), 0);
      groupHead(L, G, [{ text: GROUP_HEAD['exposure-scale'], op: 1 - sm(0.05, 0.12, p) }, { text: GROUP_HEAD['both-sides-total'], op: sm(0.12, 0.2, p) }], G.noKey ? 1 - sm(0.05, 0.12, p) : 1, false, lerp(G.subYf, G.subYd, sm(0.05, 0.2, p)));   // phones: the key slides down from under the one-line title of exposure-scale as the two-line title comes in
      const cl = groupClusters(L, bars);
      groupExposureKey(L, cl, 1 - sm(0.05, 0.12, p));
      groupXAxis(L, G, G.yAxBS, D0, 1, 0, sm(0.18, 0.32, p));
      groupDots(L, ds.map((d, i) => {
        const s = d.m * 0.01 + (d.e / 2.3) * 0.02, uy = sm(0.06 + s, 0.30 + s, p), ux = sm(0.12 + s, 0.42 + s, p);
        return { x: lerp(cl[i].x, posT[i].x, ux), y: lerp(cl[i].y, posT[i].y, uy) };
      }), 1);
      // stage 2: one arrow to the right end
      if (aL > 0.01 && !L.tiny) {
        const ga = grp(L.g, aL);
        if (L.phone) {
          const lab = txt(L, ga, G.x1, nYb - (nN - 1) * nlh, nStr, { anchor: 'end', size: nz, weight: 500, minX: G.x0 });
          arrow(L, ga, Math.min(lab.x1 - 20, Math.max(lab.x0 + 20, nTx + 20)), lab.y1 + 3, nTx, nTop - 4, { gap: 2 });
        } else if (nYb - (nN - 1) * nlh - nz * 0.85 > hdrBottom + 4) {
          const lab = txt(L, ga, G.x1, nYb - (nN - 1) * nlh, nStr, { anchor: 'end', size: nz, weight: 500, minX: G.x0 });
          arrow(L, ga, Math.min(lab.x1 - 20, Math.max(lab.x0 + 20, nTx + 20)), lab.y1 + 3, nTx, nTop - 4, { gap: 2 });
        } else {
          // a short panel: the label goes to the left of the right end, level with its dots
          const xl = Math.min(...nRight.map(i => posT[i].x - groupRadius(L, ds[i].e))) - 10, yl = Math.max(hdrBottom + nz + 4, nTop + 2 - (nN - 1) * nlh);
          const lab = txt(L, ga, xl - 16, yl, nStr, { anchor: 'end', size: nz, weight: 500, minX: L.pad });
          arrow(L, ga, lab.x1 + 3, lab.y0 + nz * 0.5, xl, lab.y0 + nz * 0.5, { gap: 1 });
        }
      }
      return;
    }

    // from both-sides-remove on: the band, the line, the zoomed axis
    const isRemove = beat === 'both-sides-remove', zoomed = !isRemove || p >= BS.zoom[1];
    const zu = isRemove ? smr(BS.zoom, p) : 1, D = isRemove ? groupDomain(zu) : D1;

    if (isRemove || beat === 'both-sides-line' || beat === 'both-sides-why') {
      const s = isRemove ? smr(BS.slide, p) : 1;
      // headings: the title changes with the zoom
      groupHead(L, G, [{ text: GROUP_HEAD['both-sides-total'], op: isRemove ? 1 - sm(BS.zoom[0] + 0.02, BS.zoom[0] + 0.1, p) : 0 },
        { text: GROUP_HEAD.zoom, op: isRemove ? sm(BS.zoom[0] + 0.1, BS.zoom[0] + 0.18, p) : 1 }], G.noKey ? 0 : 1);
      if (isRemove && p < 0.12) groupHeaders(L, G, G.bars, 1, 1 - sm(0.05, 0.12, p), 1 - sm(0.05, 0.12, p));
      // the band: frame, trails, label
      const lift = isRemove ? smr(BS.lift, p) : 1;
      groupBand(L, G, isRemove ? smr(BS.band, p) : 1, lift >= 0.999 ? 1 : 0, isRemove ? smr(BS.label, p) : 1);
      // the zero rule and the axis
      const yAx = G.yAxBS, zr = isRemove ? sm(0.6, 1, zu) : 1;
      if (zr > 0.01) line(L, L.g, G.XD(0, D), G.bandY0 + G.bandH + 6, G.XD(0, D), yAx, { stroke: T.rule, op: zr });
      groupXAxis(L, G, yAx, D, isRemove ? 1 - sm(0, 0.3, zu) : 0, isRemove ? sm(0.7, 1, zu) : 1, 1);
      groupRegions(L, G, yAx, isRemove ? smr(BS.regions, p) : 1);
      // the dots: slide left on the whole-cost scale (keeping their rows), then spread out with the zoom (moving into the rows of the final line)
      const pos = ds.map((d, i) => ({ x: G.XD(d.tot - s * d.pred, D), y: lerp(posT[i].y, posF[i].y, zu) }));
      // the trails: from each dot back to where it started, then (the lift) up into the band, staggered
      if (isRemove && s > 0.001 && lift < 0.999) {
        const gt = grp(L.g), th = L.small ? 3.5 : 5;
        ds.forEach((d, i) => {
          const k = GROUP_RANK[i], a = BS.lift[0] + k * 0.0035, b = a + (BS.lift[1] - BS.lift[0] - 15 * 0.0035), q = sm(a, b, p);
          // an arrived trail stays drawn in its band position (the band's own bars take over only when all have arrived; PI 2026-10-29: they vanished and came back)
          const xa = q > 0 ? G.XD(d.x, D0) : pos[i].x, xb = G.XD(d.tot, D0), y = lerp(posT[i].y, G.barsTop + k * G.step + G.barT / 2, q), h = lerp(th, G.barT, q);
          S(gt, 'rect', { x: xa.toFixed(2), y: (y - h / 2).toFixed(2), width: Math.max(0, xb - xa).toFixed(2), height: h.toFixed(2), rx: h / 2, fill: GREY, opacity: lerp(0.45, 0.85, q).toFixed(3) });
        });
      }
      groupDots(L, pos, 1);
      if (isRemove) {
        // "what is left": the clump after the slide, before the zoom spreads it out
        const aW = smr(BS.left, p) * (1 - smr(BS.leftOut, p));
        if (aW > 0.01) {
          const z = L.small ? 12 : 13, ga = grp(L.g, aW), xr = Math.max(...pos.map((q, i) => q.x + groupRadius(L, ds[i].e)));
          const yt = Math.min(...pos.map((q, i) => q.y - groupRadius(L, ds[i].e))), yc = (yt + G.yAxBS) / 2;
          const lab = txt(L, ga, xr + (L.small ? 30 : 46), yc + z * 0.35, 'what is left', { size: z, weight: 500, fill: T.accent, halo: 3 });
          arrow(L, ga, lab.x0 - 5, yc, xr + 3, yc, { stroke: T.accent, gap: 1 });
        }
        // after the zoom (PI, 2026-10-29): a double-headed arrow over the spread of the counties, the counterpart of the set-aside band's label.
        // Desktop only: on a phone there is no room between the band and the dots, and the axis title says the same.
        const aS = L.small ? 0 : smr([0.54, 0.62], p) * (1 - te);
        if (aS > 0.01) {
          const gs = grp(L.g, aS);
          const xl = Math.min(...pos.map((q, i) => q.x - groupRadius(L, ds[i].e))), xr = Math.max(...pos.map((q, i) => q.x + groupRadius(L, ds[i].e)));
          const ya = Math.min(...pos.map((q, i) => q.y - groupRadius(L, ds[i].e))) - 16, xm = (xl + xr) / 2;
          arrow(L, gs, xm, ya, xl, ya, { stroke: T.accent, gap: 0 });
          arrow(L, gs, xm, ya, xr, ya, { stroke: T.accent, gap: 0 });
          txt(L, gs, xm, ya - 9, 'What is left: the unusual part of the extra fuel cost', { size: 13, weight: 500, fill: T.accent, anchor: 'middle', halo: 3 });
        }
      } else if (beat === 'both-sides-line') groupBracket(L, G, posF, yAx, sm(0.12, 0.25, p) * (1 - te));
      return;
    }

    // compare and compare-all: the vote shifts
    const f = sm(0.05, 0.25, p), isCmp = beat === 'compare';
    const yAx = isCmp ? lerp(G.yAxBS, G.yAxC, f) : G.yAxC, Y = groupY(G, yAx);
    if (isCmp) {
      groupHead(L, G, [{ text: GROUP_HEAD.zoom, op: 1 - sm(0.05, 0.12, p) }, { text: GROUP_HEAD.compare, op: sm(0.12, 0.2, p) }], L.phone ? 1 - sm(0.05, 0.12, p) : G.noKey ? 0 : 1, false, null, L.phone ? 1 - sm(0.05, 0.12, p) : null);
      groupBand(L, G, 1 - sm(0.05, 0.15, p), 1 - sm(0.05, 0.15, p), 1 - sm(0.05, 0.15, p));
    } else groupHead(L, G, [{ text: GROUP_HEAD.compare, op: 1 - sm(0.05, 0.12, p) }, { text: GROUP_HEAD['compare-all'], op: sm(0.12, 0.2, p) }], L.phone ? 0 : G.noKey ? 0 : 1, L.phone);
    const zt = isCmp ? lerp(G.bandY0 + G.bandH + 6, G.yPt - 4, f) : G.yPt - 4;
    line(L, L.g, G.XD(0, D1), zt, G.XD(0, D1), yAx, { stroke: T.rule });
    groupXAxis(L, G, yAx, D1, 0, 1, 1);
    groupRegions(L, G, yAx, 1);
    groupGrid(L, G, Y, isCmp ? sm(0.08, 0.25, p) : 1);
    if (isCmp) {
      groupFitLine(L, G, Y, GROUP_DATA.fitL, -0.13, 0.24, sm(0.18, 0.28, p), false);
      groupDots(L, ds.map((d, i) => ({ x: posF[i].x, y: lerp(posF[i].y, Y(d.yL), sm(0.05 + i * 0.002, 0.25, p)) })), 1);
      groupFitLabel(L, G, Y, GROUP_DATA.fitL, 0.24, sm(0.25, 0.32, p), false, ['a line through these counties', 'a line through\nthese counties']);
      return;
    }
    // compare-all: faint counties behind the sixteen
    const gc = grp(L.g);
    GROUP_DATA.cloud.forEach((d, i) => {
      const a = sm(0.10 + i / 300 * 0.07, 0.25, p);
      if (a > 0.001) S(gc, 'circle', { cx: G.XD(d.x, D1).toFixed(2), cy: Y(d.yR).toFixed(2), r: L.small ? 2.2 : 2.6, fill: T.ink, opacity: (0.22 * a).toFixed(3) });
    });
    groupFitLine(L, G, Y, GROUP_DATA.fitL, -0.13, 0.24, 1 - sm(0.05, 0.15, p), false);
    groupFitLabel(L, G, Y, GROUP_DATA.fitL, 0.24, 1 - sm(0.05, 0.15, p), false, ['a line through these counties', 'a line through\nthese counties']);
    groupFitLine(L, G, Y, GROUP_DATA.fitR, -0.25, 0.25, sm(0.18, 0.28, p), true);
    groupDots(L, ds.map(d => ({ x: G.XD(d.x, D1), y: lerp(Y(d.yL), Y(d.yR), f) })), 1);
    groupFitLabel(L, G, Y, GROUP_DATA.fitR, 0.25, sm(0.25, 0.32, p), true, ['the slope: the number I estimate, b', 'the slope: the number\nI estimate, b', 'the slope:\nthe number I estimate, b']);
  }
  // reduced motion: within a movement the two end pictures cross-fade instead of the dots travelling
  const GROUP_MOVES = { 'exposure-scale': [[0.05, 0.25]], 'both-sides-total': [[0.05, 0.45]], 'both-sides-bridge': [[0.05, 0.45]], 'both-sides-remove': [[0.05, 0.40], [0.45, 0.65]], 'compare': [[0.05, 0.25]], 'compare-all': [[0.05, 0.25]] };
  function renderGroup(g, state, ctx) {
    const beat = state.beat || state.id, mv = GROUP_MOVES[beat];
    if (!(window.ENGINE && window.ENGINE.reducedMotion) || !mv) return renderGroupCore(g, state, ctx);
    const r = mv.find(a => state.p > a[0] && state.p < a[1]);
    if (!r) return renderGroupCore(g, state, ctx);
    const f = sm(r[0], r[1], state.p);
    g.node().setAttribute('opacity', ctx.opacity == null ? 1 : ctx.opacity);
    // v9.4 QA: one state at a time (the first fades out, then the second fades in), so that two pictures are never drawn over each other.
    // The layer's opacity goes in through ctx (the core sets its own group's opacity from it).
    const oA = 1 - clamp((f - 0.3) / 0.2, 0, 1), oB = clamp((f - 0.5) / 0.2, 0, 1), oH = f < 0.5 ? oA : oB;
    renderGroupCore(d3.select(grp(g.node())), Object.assign({}, state, { p: r[0], noHead: true }), Object.assign({}, ctx, { opacity: oA }));
    renderGroupCore(d3.select(grp(g.node())), Object.assign({}, state, { p: r[1], noHead: true }), Object.assign({}, ctx, { opacity: oB }));
    // the heading follows the same two steps (the old title fades out with the old picture, the new one fades in with the new)
    renderGroupCore(d3.select(grp(g.node())), Object.assign({}, state, { headOnly: true, p: f < 0.5 ? r[0] : r[1] }), Object.assign({}, ctx, { opacity: oH }));
  }
  // the dots of compare-all's finished picture, for the dots module's hand-over to assumption (16 counties of the group, then the 300 faint ones)
  function groupScatterDots(w, h, small, band, T) {
    const svg = document.createElementNS(NS, 'svg'), g = S(svg, 'g');
    const L = setup(d3.select(g), { p: 1 }, { w: w, h: h, small: small, band: band, T: T,
      opacity: 1, free: { x0: 0, y0: 0, x1: w, y1: h }, data: {} }, '');
    const G = groupLayout(L, { w: w, h: h, small: small, band: band, T: T, opacity: 1, free: { x0: 0, y0: 0, x1: w, y1: h }, data: {} }), Y = groupY(G, G.yAxC);
    return {
      persistent: GROUP_DATA.counties.map(d => ({ x: G.XD(d.x, D1), y: Y(d.yR), r: groupRadius(L, d.e), m: d.m })),
      cloud: GROUP_DATA.cloud.map(d => ({ x: G.XD(d.x, D1), y: Y(d.yR), r: small ? 2.2 : 2.6 }))
    };
  }

  /* v9.5: state-question draws the state-comparison figure directly, without the bridge intro */
  function renderStateQuestion(g, state, ctx) {
    const p = state.p;
    drawStateCompare(g, state, ctx, p);
    const tOp = sm(0.08, 0.18, p);
    fadeTitles(g, ctx, [{ text: STATE_TITLE.comp, op: tOp }], { text: 'Illustrative', op: tOp });
  }

    /* states-deviation dispatcher: routes each beat to its renderer */
  function renderStatesDeviationV8(g, state, ctx) {
    const bt = state.beat || state.id;
    // group-votes (comparison is the v7.2 id): the four columns of simulated counties
    if (bt === 'group-votes' || bt === 'comparison') return renderGroupVotes(g, state, ctx);
    if (bt === 'state-bridge') return renderStateBridge(g, state, ctx);
    if (bt === 'state-comparison') return renderStateComparison(g, state, ctx);
    // v9.5: adj-pt, adj-lag and state-question route to the state panel renderers (these come before the old routes they supersede)
    if (bt === 'adj-pt') return renderStateAdjPt(g, state, ctx);
    if (bt === 'adj-lag') return renderStateAdjLag(g, state, ctx);
    if (bt === 'state-question') return renderStateQuestion(g, state, ctx);
    if (bt === 'state-adj-pt') return renderStateAdjPt(g, state, ctx);
    if (bt === 'state-adj-lag') return renderStateAdjLag(g, state, ctx);
    // the v8 ids (unrouted since v9.3): the finished picture of the matching stage
    if (bt === 'state-layer') return renderStateComparison(g, Object.assign({}, state, { beat: 'state-comparison', p: 0.4 }), ctx);
    if (bt === 'state-layer-2' || bt === 'state-q') return renderStateComparison(g, Object.assign({}, state, { beat: 'state-comparison', p: 0.8 }), ctx);
    if (bt === 'adj-pt-2') return renderAdjPt(g, state, ctx);
    // unusual, unusual-rise, unusual-why: the v7.2 deviation bars
    return renderStates(g, state, ctx);
  }

  // per-beat source lines for the dispatcher
  const SD_SRC = {
    'group-votes': ['Illustrative: simulated prices and vote shifts. The effect is drawn much larger, and the scatter much smaller, than in real vote shifts.', 'Illustrative: effect drawn larger, scatter smaller than real.'],
    'comparison': ['Illustrative: simulated prices and vote shifts. The effect is drawn much larger, and the scatter much smaller, than in real vote shifts.', 'Illustrative: effect drawn larger, scatter smaller than real.'],
    'state-layer': ['Illustrative: made-up states.'], 'state-layer-2': ['Illustrative: made-up states and vote shifts, drawn with a large effect and little scatter.'],
    'state-q': ['Illustrative: made-up states and vote shifts, drawn with a large effect and little scatter.', 'Illustrative: effect drawn larger, scatter smaller than real.'], 'state-question': ['Illustrative: made-up states and vote shifts, drawn with a large effect and little scatter.', 'Illustrative: effect drawn larger, scatter smaller than real.'],
    'adj-pt': ['Illustrative: made-up states. Tax types: state tax law.'], 'adj-pt-2': ['Illustrative: made-up states. Tax types: state tax law.'],
    'adj-lag': ['Illustrative: a made-up state.'],
    'state-bridge': null,
    'state-comparison': ['Illustrative: made-up states and vote shifts, drawn with a large effect and little scatter.', 'Illustrative: made-up states.'],
    'state-adj-pt': ['Illustrative: made-up states. Tax types: state tax law.'],
    'state-adj-lag': ['Illustrative: a made-up state.'],
    'adj-pt': ['Illustrative: made-up states. Tax types: state tax law.'],
    'adj-lag': ['Illustrative: a made-up state.']
  };
  const GROUP_SRC = {
    'exposure-scale': ['Illustrative: simulated local prices.'],
    'both-sides-total': ['Illustrative: simulated local prices.'],
    'both-sides-bridge': ['Illustrative: simulated local prices.'],
    'both-sides-line': ['Illustrative: simulated local prices.'],
    'both-sides-remove': ['Illustrative: simulated local prices.'],
    'both-sides-why': ['Illustrative: simulated local prices.'],
    'compare': ['Illustrative: simulated prices and vote shifts. The effect is drawn much larger, and the scatter much smaller, than in real vote shifts.', 'Illustrative: effect drawn larger, scatter smaller than real.'],
    'compare-all': ['Illustrative: simulated prices and vote shifts. The effect is drawn at about the smallest size the analysis could detect.', 'Illustrative: simulated prices and vote shifts.']
  };

  // `source`: candidate texts (longest first) for the dots module's own source-line band, window.sourceLine style.
  window.DOTS_PANELS = {
    'overview': { render: cached('overview', renderOverview, () => MM.ver + ':' + mmActiveTile()), source: null },
    'burden': { render: cached('burden', renderBurden), source: ['Hypothetical counties.'] },
    'burden-v6': { render: cached('burden-v6', renderBurdenV6), source: ['Hypothetical counties.'] },       // unrouted since v7 (beats burden-state, burden-metro)
    'states-deviation': {
      render: cached('states-deviation', renderStatesDeviationV8),
      sourceFor: beat => beat in SD_SRC ? SD_SRC[beat] : ['Illustrative: simulated local prices.'],
      get source() {
        const st = window.BEAT_STATE;
        return st && st.id in SD_SRC ? SD_SRC[st.id] : ['Illustrative: simulated local prices.'];
      }
    },
    'group': {
      render: cached('group', renderGroup),
      sourceFor: beat => GROUP_SRC[beat] || ['Illustrative: simulated local prices.'],
      get source() { const st = window.BEAT_STATE; return (st && GROUP_SRC[st.id]) || ['Illustrative: simulated local prices.']; }
    },
    'checks': { render: cached('checks', renderChecks), source: ['Illustrative numbers, not results. The real checks run on the final prices.', 'Illustrative numbers, not results.'] },
    // v8: equation has no bar, so the source line is null (the slice bar's own label suffices)
    'equation': { render: cached('equation', renderEquation), source: null }
  };
  window.DOTS_PANELS.group.scatterDots = groupScatterDots;
  // These v8 beats have native panel drawings; the shell must pass their v8 ids.
  if (window.V8_ALIAS) ['idea-route', 'unusual', 'unusual-why', 'exposure-scale', 'compare', 'compare-all', 'group-votes', 'state-layer', 'state-layer-2',
    'adj-pt', 'adj-pt-2', 'adj-lag', 'eq-1', 'eq-2', 'eq-3', 'eq-4', 'state-q', 'state-bridge', 'state-comparison', 'state-adj-pt', 'state-adj-lag', 'state-question'].forEach(id => delete window.V8_ALIAS[id]);
})();
