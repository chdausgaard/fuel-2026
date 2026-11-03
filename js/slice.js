/* window.VIS.slice (v9): the slice bar — a persistent overlay and a figure module.
   The bar sits at the top of the drawing area. Numbers from data/stages.json (stages.regression.ratios).
   Interface: init(el, data), render(state), resize(w, h), overlay(state), bandHeight().
   render() handles the beats the slice module owns; overlay() is called on every frame within range.
   window.SLICE_BAND: computed height reserved for the current beat.
   window.SLICE.thumb(svgSel, stage, x, y, w, h): draws a tiny bar thumbnail for overview tiles / ladder rows.
   v9.4: the bar appears in close-to-random; no lasting notes; the equation beats outline what is left; stock-take belongs to the equation panel;
   scope / scope-outcomes draw an arrow from the kept part to b (the arrow itself lives in the overlay, the rest in the figure). */
(function () {
  'use strict';
  window.VIS = window.VIS || {};
  const NS = 'http://www.w3.org/2000/svg';
  const F = (window.THEME && window.THEME.fontLabelCanvas) || "'Barlow', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sm = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const ease = t => { const u = clamp(t, 0, 1); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const f1 = v => v.toFixed(1), f2 = v => v.toFixed(2);
  const lerp = (a, b, u) => a + (b - a) * u;

  /* ---- layout constants ---- */
  const EQ_MOVE = Object.freeze([0.04, 0.30]); // equation terms travel and the matching bar outline morph (build p)
  const BAND_D = 54, BAND_P = 38;             // overlay band height: desktop, phone
  const BAR_D = 10, BAR_P = 6;                // bar thickness
  const PAD = 12;                              // side gutter
  let NOTE_FS = 13, LABEL_FS = 13;            // font sizes for the note row and cut labels (set with small)
  const SRC = 22;                              // source-line band
  const SET_ASIDE = [0.28, 0.42];              // both-sides-remove: the range of p over which what exposure predicts is set aside (the group figure in dots_panels.js moves its dots over the same range)

  /* ---- state ---- */
  let W = 0, H = 0, small = false;
  let overlayEl, svgOv, figSvg;
  let R = {};                                  // ratios from stages.json
  let beatIds = [];
  let mctx = null;                             // canvas context for text measuring

  /* ---- helpers ---- */
  function idx(id) { return beatIds.indexOf(id); }
  function between(id, a, b) { const c = idx(id); return c >= 0 && c >= idx(a) && c <= idx(b); }
  function textW(str, size) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = '400 ' + size + 'px ' + F; return mctx.measureText(str).width;
  }
  // SVG text that stays inside [lo, hi]. Anchor and position chosen to fit.
  function fitText(str, x, y, size, fill, op, lo, hi) {
    const w = textW(str, size);
    let ax = x, anc = 'middle';
    if (x - w / 2 < lo) { ax = lo; anc = 'start'; }
    else if (x + w / 2 > hi) { ax = hi; anc = 'end'; }
    return '<text x="' + f1(ax) + '" y="' + f1(y) + '" text-anchor="' + anc + '" fill="' + fill + '" font-family="' + F + '" font-size="' + size + '" opacity="' + f2(op) + '">' + esc(str) + '</text>';
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, '&#39;'); }
  // Tag at top-right of a figure (Two inks: plain text, no box; Barlow 500, 12px)
  function tag(text, x, y, muted, rule, op) {
    return '<text x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="end" fill="' + muted + '" font-family="' + F + '" font-size="' + window.THEME.figType.tag[small ? 1 : 0] + '" font-weight="500" opacity="' + f2(op) + '" data-fig-tag="1">' + esc(text) + '</text>';
  }
  // Leader line from (x1,y1) to (x2,y2)
  function leader(x1, y1, x2, y2, col, op) {
    return '<line x1="' + f1(x1) + '" y1="' + f1(y1) + '" x2="' + f1(x2) + '" y2="' + f1(y2) + '" stroke="' + col + '" stroke-width="0.7" opacity="' + f2(op) + '"/>';
  }
  // Wrapped text: returns array of lines
  function wrap(str, maxW, size) {
    const words = str.split(' '), lines = []; let cur = '';
    words.forEach(w => {
      const n = cur ? cur + ' ' + w : w;
      if (cur && textW(n, size) > maxW) { lines.push(cur); cur = w; } else cur = n;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  // Balanced wrap: the fewest lines that wrap() needs, with the line lengths evened out (no lone last word)
  function wrapBal(str, maxW, size) {
    const L = wrap(str, maxW, size);
    if (L.length < 2) return L;
    let w = Math.ceil(textW(str, size) / L.length) + 8, B = wrap(str, w, size);
    while (B.length > L.length && w < maxW) { w += 6; B = wrap(str, w, size); }
    return B.length > L.length ? L : B;
  }

  /* ---- load ratios from stages.json ---- */
  function loadRatios(d) {
    if (!d) return;
    const r = d.stages && d.stages.regression && d.stages.regression.ratios;
    if (!r) return;
    R.bet  = 1 - r.V1_over_V0;                // ~0.506  between races
    R.with = r.V1_over_V0;                     // ~0.494  within races
    R.kept = r.V2_over_V0;                     // ~0.0381 recentred
    R.pred = R.with - R.kept;                   // ~0.456  predictable
    R.loc  = r.V7_local_over_V7;               // ~0.913  local share of what is left after all the adjustments
    R.sta  = 1 - R.loc;                         // ~0.087
  }

  /* ---- computed bar geometry (in px, for the overlay) ---- */
  // Layout within the overlay band (top to bottom):
  //   label baseline (12px) at y ~13 desktop / ~11 phone
  //   bar top at y ~17 desktop / ~14 phone, height 10 / 7
  //   note row baseline at y ~47 desktop / ~34 phone
  //   band bottom at 54 / 38
  function compactBar() {
    const s = window.BEAT_STATE;
    if (!small || W >= 520 || H >= 280 || !s || !between(s.id, 'check-idea', 'power-benchmark')) return 0;   // the charts run of Part 5 (power-benchmark added 2026-11-02)
    return s.id === 'check-idea' ? sm(0, 1, s.t || 0) : s.id === 'power-benchmark' ? 1 - sm(0, 1, s.t || 0) : 1;
  }
  function barGeo() {
    const c = compactBar(), bh = small ? lerp(BAR_P, 3, c) : BAR_D;
    const bw = W - 2 * PAD;
    const by = small ? lerp(17, 3, compactBar()) : 21;               // bar sits mid-band, leaving room for label above and notes below (phone: the label clears the 1.5px outline of the equation beats by 3px)
    const noteY = small ? 34 : 47;            // note row baseline
    const lblY = small ? 12 : 15;             // label baseline
    const betW = bw * R.bet;
    const predW = bw * R.pred;
    const keptW = Math.max(3, bw * R.kept);
    const keptX = PAD + betW + predW;
    return { bh, bw, by, noteY, lblY, betW, predW, keptW, keptX };
  }
  function BAND() { return small ? lerp(BAND_P, 12, compactBar()) : BAND_D; }

  /* ==================================================================
     overlay(): the persistent thin bar, called every frame in range
     ================================================================== */
  let lastOvKey = '';
  function overlay(state) {
    if (!svgOv || !R.bet) return;
    const id = state.id, p = state.p, t = state.t || 0;
    const ci = idx(id);
    arrowPts = null;
    if (ci < idx('close-to-random') || ci >= idx('report-variants')) {
      overlayEl.style.display = 'none';
      return;
    }
    overlayEl.style.display = '';
    // fade the overlay out during report-ladder's t (transition to report-variants)
    const exitOp = id === 'report-ladder' ? 1 - ease(t) : 1;
    overlayEl.style.opacity = exitOp < 0.999 ? exitOp.toFixed(3) : '';
    overlayEl.style.height = BAND() + 'px';
    svgOv.setAttribute('width', W);
    const bnd = BAND();
    svgOv.setAttribute('height', bnd);
    svgOv.setAttribute('viewBox', '0 0 ' + W + ' ' + bnd);

    const T = window.THEME || {};
    const accent = T.accent || '#0E5F6B', rule = T.rule || '#D9DCE0', muted = T.muted || '#5E6773', ink = T.ink || '#1C2128';
    const G = barGeo();
    // v9.4: the tax-cut beats (hol-*) were cut, so the bar is never dimmed (state-precision hands over to report-ladder at full strength)
    const gOp = 1;
    // close-to-random, stage 2: the bar grows in from the left (the real map is back by p 0.56)
    const topOp = id === 'close-to-random' ? sm(0.56, 0.6, p) : 1;
    const fullOp = id === 'close-to-random' ? sm(0.57, 0.68, p) : 1;
    const betCut = id === 'same-race-2' ? sm(0.20, 0.35, p) : 1;
    const predCut = id === 'both-sides-remove' ? sm(SET_ASIDE[0], SET_ASIDE[1], p) : 1;
    const bg = T.bg || '#FAFAF8';
    let svg = '<rect x="0" y="0" width="' + W + '" height="' + bnd + '" fill="' + bg + '"/>';
    svg += '<rect x="' + PAD + '" y="' + f1(G.by) + '" width="' + f1(G.bw) + '" height="' + G.bh + '" rx="1" fill="' + rule + '" opacity="' + f2(gOp * topOp * 0.25) + '"/>';
    svg += fitText(small ? 'Extra-fuel-cost differences used' : 'Differences in extra fuel cost used in the comparison', PAD, G.lblY, LABEL_FS, muted, gOp * topOp * (1 - compactBar()), PAD, W - PAD);
    svg += '<g opacity="' + f2(gOp) + '">';
    if (fullOp > 0) svg += '<rect x="' + PAD + '" y="' + f1(G.by) + '" width="' + f1(G.bw * fullOp) + '" height="' + G.bh + '" rx="1" fill="' + accent + '"/>';
    if (ci >= idx('same-race-2')) svg += '<rect x="' + PAD + '" y="' + f1(G.by) + '" width="' + f1(G.betW) + '" height="' + G.bh + '" rx="1" fill="' + rule + '" opacity="' + f2(betCut) + '"/>';
    if (ci >= idx('both-sides-remove')) svg += '<rect x="' + f1(PAD + G.betW) + '" y="' + f1(G.by) + '" width="' + f1(G.predW) + '" height="' + G.bh + '" rx="1" fill="' + rule + '" opacity="' + f2(predCut) + '"/>';
    svg += '</g>';

    // v9.5: compute state tick fade early so bar notes can yield to the state label
    const stateHi1 = id === 'adj-state';
    const stateHi2 = id === 'state-question';
    const stFade = stateHi1 ? sm(0.05, 0.25, p) * (1 - ease(t)) : stateHi2 ? sm(0.05, 0.25, p) * (1 - ease(t)) : 0;

    if (id === 'close-to-random' || (ci > idx('close-to-random') && ci < idx('same-race-2'))) {
      const la = id === 'close-to-random' ? sm(0.64, 0.70, p) : 1;
      if (la > 0) svg += fitText(small ? 'All the differences' : 'All the differences in extra fuel cost between counties', PAD + G.bw / 2, G.noteY, NOTE_FS, muted, la * gOp, PAD, W - PAD);
    } else if (ci >= idx('same-race-2') && ci < idx('both-sides-remove')) {
      const la = id === 'same-race-2' ? sm(0.25, 0.32, p) : 1;
      if (la > 0) svg += fitText('between races', PAD + G.betW / 2, G.noteY, NOTE_FS, muted, la * gOp, PAD, W - PAD);
    } else if (ci >= idx('both-sides-remove') && ci < idx('eq-1')) {
      // the labels fade out over the hand-over to the equation
      const fadeOut = state.next === 'eq-1' ? 1 - ease(t) : 1;
      const la = id === 'both-sides-remove' ? sm(SET_ASIDE[1], SET_ASIDE[1] + 0.07, p) : fadeOut;
      // v9.5: when the state tick label is showing, fade the bar notes out so they do not overlap
      const noteHide = stFade;
      // v9.4: "between races" has been on the bar since same-race-2, so it keeps its full strength through the set-aside (no blink at both-sides-remove p 0)
      if ((la > 0.001 || fadeOut > 0.001) && noteHide < 0.999) {
        const row = mkRows([G.noteY], 'b', false);
        const fullKeptNote = 'about 4% of all';   // PI 2026-10-29: the share of all only (was '; 8% of the differences within races')
        const keptNote = small && W - PAD - textW(fullKeptNote, NOTE_FS) - 8 < PAD + G.betW
          ? '4% of all' : fullKeptNote;
        const predEnd = Math.min(PAD + G.betW + G.predW / 2, W - PAD - textW(keptNote, NOTE_FS) - 11);
        // placed in this order: the kept note, "between races" (it has been on the bar since same-race-2), then the predicted part, which takes a shorter wording if it must
        svg += placeLabels([
          { txt: keptNote, alts: ['4% of all'], ax: G.keptX + G.keptW, align: 'end', fill: muted, op: la * gOp * (1 - noteHide), size: NOTE_FS },
          { txt: 'between races', ax: PAD + G.betW / 2, fill: muted, op: fadeOut * gOp * (1 - noteHide), size: NOTE_FS },
          { txt: 'what exposure alone predicts', alts: ['predicted by exposure alone', 'predicted'], ax: predEnd, align: 'end', fill: muted, op: la * gOp * (1 - noteHide), size: NOTE_FS }
        ], row, PAD, W - PAD, G.by, G.by + G.bh, 8);
      }
    }
    if (stateHi1 || stateHi2) {
      const tickX = G.keptX + G.keptW * R.loc;
      const tw = 0.7 + 0.8 * stFade;
      const top2 = 0.5 + 0.5 * stFade;
      svg += '<line x1="' + f1(tickX) + '" y1="' + f1(G.by) + '" x2="' + f1(tickX) + '" y2="' + f1(G.by + G.bh) + '" stroke="' + ink + '" stroke-width="' + tw.toFixed(1) + '" opacity="' + f2(gOp * top2) + '"/>';
    }
    if (stFade > 0.001) {
      // v9.5: adj-state shows 'the state part', state-question shows 'the state part on its own'
      const stLabel = id === 'state-question' ? 'the state part on its own' : 'the state part';
      svg += fitText(stLabel, G.keptX + G.keptW / 2, G.noteY, NOTE_FS, accent, gOp * stFade, PAD, W - PAD);
    }

    // v9.4: the equation beats replay what is left, only ever forward: the whole bar (eq-1), the part within races (eq-2), the kept part (eq-3, eq-4, stock-take).
    // Each new outline builds with its equation, from the preceding held outline; it goes in stock-take's t.
    if (between(id, 'eq-1', 'stock-take')) {
      const parts = [{ x: PAD, w: G.bw }, { x: PAD + G.betW, w: G.bw - G.betW }, { x: G.keptX, w: G.keptW }, { x: G.keptX, w: G.keptW }, { x: G.keptX, w: G.keptW }];
      const k = ci - idx('eq-1'), a = parts[Math.max(0, k - 1)], b = parts[k];
      const m = k === 1 || k === 2 ? sm(EQ_MOVE[0], EQ_MOVE[1], p) : 1;
      const oOp = (k === 0 ? sm(0.25, 0.32, p) : 1) * (k === parts.length - 1 ? 1 - ease(t) : 1) * gOp;
      const outline = (q, alpha) => '<rect x="' + f1(q.x - 1) + '" y="' + f1(G.by - 1) + '" width="' + f1(q.w + 2) + '" height="' + (G.bh + 2) + '" rx="2" fill="none" stroke="' + ink + '" stroke-width="1.5" opacity="' + f2(alpha) + '"/>';
      if (window.ENGINE && window.ENGINE.reducedMotion && (k === 1 || k === 2)) {
        svg += outline(a, oOp * (1 - m)) + outline(b, oOp * m);
      } else svg += outline({ x: lerp(a.x, b.x, m), w: lerp(a.w, b.w, m) }, oOp);
    }
    if (id === 'report-ladder') {
      const stages = [
        { x: PAD, w: G.bw }, { x: PAD + G.betW, w: G.bw - G.betW },
        { x: G.keptX, w: G.keptW }, { x: G.keptX, w: G.keptW }
      ];
      stages.forEach((part, k) => {
        const at = 0.05 + 0.07 * k;
        if (p >= at) svg += '<rect x="' + f1(part.x - 1) + '" y="' + f1(G.by - 1) + '" width="' + f1(part.w + 2) + '" height="' + (G.bh + 2) + '" rx="2" fill="none" stroke="' + accent + '" stroke-width="1.5" opacity="' + f2(sm(at, at + 0.04, p)) + '"/>';
      });
    }

    // v9.4: scope / scope-outcomes: an arrow grows from the kept part of the bar down to b (it is drawn here because it starts on the bar; the overlay svg does not clip)
    const enteringScope = small && W < 520 && state.next === 'scope' && id !== 'scope';
    if (id === 'scope' || id === 'scope-outcomes' || enteringScope) {
      const g = small && W < 520 ? 1 : id === 'scope' ? sm(0.05, 0.25, p) : 1;
      const aOp = id === 'scope' ? small && W < 520 && state.next === 'scope-outcomes' ? lerp(1, 0.4, sm(0, 0.20, 0.48 * sm(0, 0.65, t))) : 1 : (1 - 0.6 * sm(0.05, 0.20, small && W < 520 ? p + 0.48 : p)) * (1 - ease(t));
      const phase = id === 'scope-outcomes' ? 1 : id === 'scope' ? sm(0, 0.20, 0.48 * sm(0, 0.65, t)) : 0;
      const S = small && W < 520 ? scopeGeo(G, phase) : scopeLayout || scopeGeo(G);
      svg += curveArrow([G.keptX + G.keptW / 2, G.by + G.bh + 4], [S.cx, S.arrowEndY], 'v', g, accent, 1.6, enteringScope ? sm(0.5, 0.58, t) : aOp, true);
    }

    // Aria
    const pct = R.kept ? Math.round(R.kept * 100) : 3;
    const key = svg + W;
    if (key === lastOvKey) return;
    lastOvKey = key;
    svgOv.setAttribute('aria-label', 'About ' + pct + ' percent of the differences in extra fuel cost between counties are used in the comparison.');
    svgOv.innerHTML = svg;
  }

  /* ==================================================================
     render(): figure module for owned beats
     ================================================================== */
  function render(state) {
    if (!figSvg || !R.bet) return;
    const id = state.id, p = state.p, t = state.t;
    const T = window.THEME || {};
    const accent = T.accent || '#0E5F6B', rule = T.rule || '#D9DCE0', muted = T.muted || '#5E6773', ink = T.ink || '#1C2128';
    const sb = window.SLICE_BAND || 0;
    const dH = H - sb - SRC, dY = sb;   // drawing area: below slice bar, above source band
    figSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

    let svg = '';
    const ph = small && W < 520, incoming = ph && ['scope', 'scope-limits'].includes(state.next) && !['scope', 'scope-outcomes', 'scope-limits'].includes(id);
    if (incoming) {
      const body = state.next === 'scope' ? drawScope('scope', dY, dH, 0.22, 0, accent, rule, muted, ink) : drawLimits(dY, dH, 0.26, 0, accent, rule, muted, ink);
      svg = '<g opacity="' + f2(sm(0.5, 0.58, t)) + '">' + body + '</g>';
    }
    else if (ph && id === 'scope' && state.next === 'scope-outcomes' && t > 0) svg = drawScope('scope-outcomes', dY, dH, 0.48 * sm(0, 0.65, t), 0, accent, rule, muted, ink);
    else if (id === 'scope' || id === 'scope-outcomes') svg = drawScope(id, dY, dH, ph ? id === 'scope' ? Math.max(0.22, p) : Math.min(1, p + 0.48) : p, t, accent, rule, muted, ink);
    else if (id === 'scope-limits') svg = drawLimits(dY, dH, ph ? Math.max(0.26, p) : p, t, accent, rule, muted, ink);
    if (ph && id === 'scope-outcomes' && state.next === 'scope-limits' && t > 0) svg += '<g opacity="' + f2(sm(0.5, 0.58, t)) + '">' + drawLimits(dY, dH, 0.26, 0, accent, rule, muted, ink) + '</g>';
    figSvg.innerHTML = svg;
    figSvg.setAttribute('aria-label', id === 'scope' ? 'An arrow runs from the part of the top bar that is left down to the letter b, the number I estimate, followed by a question mark.'
      : id === 'scope-limits' ? 'Two bars on one scale. The rising cost everyone shared, about 88 dollars a month for a typical household, fills the width. The differences I compare, under about 3.30 dollars a month for half of all markets, make a sliver.'
      : 'From b, the number I estimate, one arrow leads to close to zero, which would mean that local differences in fuel costs moved few votes, and one to a clear effect, which would show that voters punish local price rises, and how much.');
    if (id === 'scope-limits') srcLine(['EIA; American Community Survey 2020–2024; project calculation on AAA prices, October 13–November 2.', 'EIA; ACS; project calculation.'], sm(0.04, 0.14, p) * (1 - ease(t)));
  }

  /* ================================================================
     Label placement: rows, collision avoidance, leaders
     ================================================================ */
  let LBL = 15;                                // segment label font size (set with small)

  function txt(str, x, y, size, fill, op, anchor, weight, extra) {
    return '<text' + (extra ? ' ' + extra : '') + ' x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="' + (anchor || 'start') + '" fill="' + fill + '" font-family="' + F + '"' + (weight ? ' font-weight="' + weight + '"' : '') + ' font-size="' + size + '" opacity="' + f2(op) + '">' + esc(str) + '</text>';
  }
  // Rows of label baselines. side 'a' labels sit above the feature, 'b' below. lead: draw a leader from the feature edge.
  function mkRows(ys, side, lead) { return ys.map(y => ({ y: y, side: side, lead: lead, boxes: [] })); }
  // Place labels left to right, each in the first row (from its preferred row) where it fits; try shorter variants in a row before moving on.
  // Item: { txt, alts, ax (feature x), align 'mid'|'end'|'start', fill, op, size, row }. A label that fits nowhere is not drawn.
  function placeLabels(items, rows, lo, hi, edgeA, edgeB, gap) {
    gap = gap == null ? 8 : gap;
    let s = '';
    items.forEach(it => {
      const size = it.size || LABEL_FS, variants = [it.txt].concat(it.alts || []);
      for (let r = it.row || 0; r < rows.length; r++) {
        const row = rows[r]; let hit = null;
        for (let v = 0; v < variants.length && !hit; v++) {
          const w = textW(variants[v], size);
          let l = it.align === 'end' ? it.ax + 2 - w : it.align === 'start' ? it.ax - 2 : it.ax - w / 2;
          l = clamp(l, lo, Math.max(lo, hi - w));
          const rg = l + w;
          if (w <= hi - lo && !row.boxes.some(b => l < b[1] + gap && rg > b[0] - gap)) hit = { v: variants[v], w: w, l: l, rg: rg };
        }
        if (!hit) continue;
        row.boxes.push([hit.l, hit.rg]);
        s += txt(hit.v, hit.l, row.y, size, it.fill, it.op, 'start');
        if (row.lead && !it.noLead) {
          let lx = clamp(it.ax, hit.l + 1, hit.rg - 1);
          const fromY = row.side === 'b' ? edgeB : edgeA, toY = row.side === 'b' ? row.y - size * 0.85 : row.y + 3;
          // skip the leader if it would cross a label in a nearer row of the same side
          let crosses = false;
          rows.forEach((o, j) => { if (j < r && o.side === row.side && o.boxes.some(b => lx > b[0] - 2 && lx < b[1] + 2)) crosses = true; });
          if (!crosses) s += leader(lx, fromY, lx, toY, it.fill, it.op * 0.5);
        }
        break;
      }
    });
    return s;
  }
  // Wrapped text in a column [x0, x1]; anchor 'start' (at x0) or 'end' (at x1). Returns { svg, n }.
  function wrapCol(str, x0, x1, y, size, fill, op, anchor, step) {
    const lines = wrap(str, x1 - x0, size); let s = '';
    lines.forEach((ln, i) => { s += txt(ln, anchor === 'end' ? x1 : x0, y + i * (step || size + 2), size, fill, op, anchor); });
    return { svg: s, n: lines.length };
  }
  /* ---- scope, scope-outcomes: one figure over two beats (v9.4) ----
     The title "The number I estimate". scope: an arrow (drawn by overlay(), it starts on the bar) grows from the kept part of the top bar to a large italic b with a "?" beside it.
     scope-outcomes: the same SVG; the "?" fades and two arrows grow from b to the two kinds of outcome. Nothing is redrawn between the two beats; only the stage changes. */
  function textWf(str, font) {
    if (!mctx) mctx = document.createElement('canvas').getContext('2d');
    mctx.font = font; return mctx.measureText(str).width;
  }
  // Cubic curve from p0 to p1 that leaves and arrives vertically ('v'), or leaves vertically and arrives along the chord ('d'). g = how much of it is drawn (0-1), the arrowhead when g is 1.
  let arrowPts = null;   // the drawn part of the arrow from the bar, in panel coordinates (main.js keeps the overview button clear of it)
  function curveArrow(p0, p1, mode, g, col, sw, op, record) {
    if (record) arrowPts = null;
    if (g <= 0.002 || op <= 0.002) return '';
    const dy = p1[1] - p0[1];
    const c1 = [p0[0] + (p1[0] - p0[0]) * (mode === 'd' ? 0.12 : 0), p0[1] + dy * (mode === 'd' ? 0.55 : 0.5)];
    // 'd' arrives along the chord, so the line runs straight into its head (PI 2026-10-29: one wing of the head overlapped the bending line)
    const c2 = mode === 'd' ? [p1[0] - (p1[0] - p0[0]) * 0.30, p1[1] - dy * 0.30] : [p1[0], p1[1] - dy * 0.45];
    const at = u => { const v = 1 - u; return [v * v * v * p0[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * p1[0], v * v * v * p0[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * p1[1]]; };
    const N = 36, n = Math.max(2, Math.ceil(N * g)); let d = '';
    if (record) arrowPts = [];
    for (let i = 0; i <= n; i++) { const q = at(Math.min(g, i / N)); d += (i ? 'L' : 'M') + f1(q[0]) + ' ' + f1(q[1]); if (record) arrowPts.push(q); }
    let out = '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" opacity="' + f2(op) + '"/>';
    if (g > 0.985) {
      const ang = Math.atan2(p1[1] - c2[1], p1[0] - c2[0]), hl = 9, hw = 0.45;   // the head follows the curve's end direction
      out += '<path d="M' + f1(p1[0] - hl * Math.cos(ang - hw)) + ' ' + f1(p1[1] - hl * Math.sin(ang - hw)) + ' L' + f1(p1[0]) + ' ' + f1(p1[1]) + ' L' + f1(p1[0] - hl * Math.cos(ang + hw)) + ' ' + f1(p1[1] - hl * Math.sin(ang + hw)) + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linecap="round" stroke-linejoin="round" opacity="' + f2(op) + '"/>';
    }
    return out;
  }
  const OUT_L = 'close to zero: local differences in fuel costs moved few votes', OUT_R = 'a clear effect: voters punish local price rises (and how much)';   // PI 2026-10-30
  // Positions shared by the overlay (the arrow from the bar) and the figure (b and its outcomes), from the panel size alone.
  let scopeLayout = null;
  function scopeGeo(G, phase = 1) {
    const ph = small && W < 520, endB = small ? (ph && H < 260 ? 44 : 64) : 96, fsB = ph ? lerp(Math.min(96, H * 0.34), endB, phase) : endB, fsL = small ? 13 : 15, lhL = Math.round(fsL * 1.3);
    const colW = small ? Math.floor((W - 2 * PAD - 12) / 2) : Math.min(260, Math.floor(W * 0.29));
    const lL = wrapBal(OUT_L, colW, fsL), lR = wrapBal(OUT_R, colW, fsL);
    const labH = Math.max(lL.length, lR.length) * lhL;
    const top = BAND() + (small ? 40 : 52), bot = H - SRC - 6;
    // phones: no caption under b (the title says the same), so the arrows start right under it; b sits as high as the title and the arrow allow, and the boxes end above the source band
    const off = ph ? (H < 260 ? 44 : 48) : small ? 70 : 112;      // from b's baseline to the top of the outcome labels
    const below = off + labH + (ph ? 8 : 0);                      // from b's baseline to the bottom of the outcome labels
    const asc = endB * 0.74;
    const endY = ph ? clamp(top + asc + (bot - top - asc - below) * 0.45, BAND() + 27 + 14 + asc, bot - below) : clamp(top + asc + (bot - top - asc - below) * 0.45, top + asc + (small ? 30 : 56), Math.max(top + asc + 20, bot - below));
    const yb = ph ? lerp(top + (bot - top) * 0.66, endY, phase) : endY, cx = W / 2;
    return { ph: ph, bW: textWf('b', 'italic 400 ' + fsB + 'px ' + F), cx: cx, yb: yb, fsB: fsB, fsL: fsL, lhL: lhL, colW: colW, lL: lL, lR: lR, yL: yb + off, arrowEndY: yb - fsB * 0.74 - 8,
      xL: small ? PAD + colW / 2 : cx - Math.min(W * 0.24, 250), xR: small ? W - PAD - colW / 2 : cx + Math.min(W * 0.24, 250) };
  }
  function drawScope(beatId, y0, h, p, t, accent, rule, muted, ink) {
    const T = window.THEME || {};
    const outc = beatId === 'scope-outcomes';
    const tFade = outc ? small && W < 520 ? 1 - sm(0.42, 0.5, t) : 1 - ease(t) : 1;
    const G = barGeo(), S = small && W < 520 ? scopeGeo(G, outc ? sm(0, 0.20, p) : 0) : scopeLayout || scopeGeo(G);
    const fa = (outc || W < 520 ? 1 : sm(0.05, 0.15, p)) * tFade;                        // the title (phone: there from the start, so that it takes over from the chart before it)
    const ph = W < 520, ba = (outc ? 1 : ph ? sm(0.03, 0.15, p) : sm(0.22, 0.32, p)) * tFade;                                   // b
    const qa = (outc ? 1 - sm(0.05, 0.15, p) : ph ? sm(0.10, 0.22, p) : sm(0.28, 0.38, p)) * tFade;                // the "?"
    const ca = (outc ? 1 : sm(0.30, 0.38, p)) * tFade;                                   // the caption under b
    const g1 = outc ? sm(0.12, 0.32, p) : 0, g2 = outc ? sm(0.20, 0.40, p) : 0;      // the two arrows (no second easing)
    const l1 = outc ? sm(0.28, 0.40, p) * tFade : 0, l2 = outc ? sm(0.36, 0.48, p) * tFade : 0;   // the two labels
    let s = '';
    s += txt('The number I estimate', PAD, y0 + (small ? 22 : 27), window.THEME.figType.title[small ? 1 : 0], ink, fa, 'start', 600, 'data-fig-title="1"');
    // b and the question mark
    const bW = S.bW;
    const sc = 0.92 + 0.08 * ba;                                                         // b settles into place as it fades in
    s += '<text x="' + f1(S.cx) + '" y="' + f1(S.yb) + '" text-anchor="middle" fill="' + ink + '" font-family="' + F + '" font-style="italic" font-size="' + S.fsB + '" opacity="' + f2(ba) + '" transform="translate(' + f1(S.cx) + ' ' + f1(S.yb) + ') scale(' + sc.toFixed(3) + ') translate(' + f1(-S.cx) + ' ' + f1(-S.yb) + ')">b</text>';
    s += '<text x="' + f1(S.cx + bW / 2 + S.fsB * 0.16) + '" y="' + f1(S.yb) + '" fill="' + muted + '" font-family="' + F + '" font-size="' + f1(S.fsB * 0.85) + '" opacity="' + f2(qa) + '">?</text>';
    if (!S.ph) s += txt('the number I estimate', S.cx, S.yb + (small ? 20 : 26), small ? 12 : 13, muted, ca, 'middle');
    // the two outcomes
    const y1 = S.yb + (S.ph ? 12 : small ? 30 : 36), tipY = S.yL - 8;
    s += curveArrow([S.cx - 18, y1], [S.xL, tipY], 'd', g1, ink, 1.4, tFade);
    s += curveArrow([S.cx + 18, y1], [S.xR, tipY], 'd', g2, accent, 1.4, tFade);
    // PI 2026-10-29: each outcome label on a highlight (gray for close to zero, teal for a clear effect), matched by the same highlights in the beat text (.hl-zero, .hl-effect in site.css)
    const hl = (lines, x, fill, op) => { if (op <= 0.002) return ''; const w = Math.max(...lines.map(l => textW(l, S.fsL))) + 12, h = lines.length * S.lhL + 8;
      return '<rect x="' + f1(x - w / 2) + '" y="' + f1(S.yL + 1) + '" width="' + f1(w) + '" height="' + f1(h) + '" rx="3" fill="' + fill + '" opacity="' + f2(op) + '"/>'; };
    s += hl(S.lL, S.xL, T.hlZero || '#E6E8EB', l1) + hl(S.lR, S.xR, T.hlEffect || '#D7E9EB', l2);
    S.lL.forEach((ln, i) => { s += txt(ln, S.xL, S.yL + S.fsL + i * S.lhL, S.fsL, ink, l1, 'middle', 500); });
    S.lR.forEach((ln, i) => { s += txt(ln, S.xR, S.yL + S.fsL + i * S.lhL, S.fsL, accent, l2, 'middle', 500); });
    return s;
  }

  /* ---- scope-limits (2026-10-30): the differences I compare next to the rising cost everyone shared, on one scale ----
     Monthly dollars for a typical household of 73 gallons: the $1.20 rise (EIA) and 4.5 cents, the unusual part of the rise for half of all markets.
     Gray is what the comparison can't use and teal what it uses, as on the top bar. */
  const SHARED_USD = 88, COMPARED_USD = 3.3;
  function drawLimits(y0, h, p, t, accent, rule, muted, ink) {
    const fade = 1 - (small && W < 520 ? sm(0.25, 0.48, t) : ease(t)), tfs = window.THEME.figType.title[small ? 1 : 0], fsL = small ? 15 : 17, lh = Math.round(fsL * 1.3);
    const tiny = small && W < 520 && H < 230, tablet = small && W >= 520 && W < 640;
    const ph = W < 520, fa = sm(0.04, 0.14, p) * fade, g1 = sm(0.08, 0.26, p), la1 = sm(0.16, 0.26, p) * fade, g2 = sm(ph ? 0.32 : 0.28, ph ? 0.42 : 0.40, p), la2 = sm(ph ? 0.28 : 0.32, ph ? 0.38 : 0.42, p) * fade;   // phone: the second label comes before its bar
    const mx = PAD + 4, mw = W - 2 * mx;
    let bh = ph ? 18 : small ? 28 : 40, gap = ph ? 24 : small ? 40 : 56, pd = 8, lead = ph ? 8 : 20;
    // phones: the source line says "provisional", so the tag goes and the title has the row to itself apart from the button; on a short panel the title is one line
    const L1 = wrap(tiny ? 'Shared cost: about $' + SHARED_USD + '/month for a typical household' : 'The rising cost everyone shared: about $' + SHARED_USD + ' a month for a typical household', mw, fsL);
    const L2 = wrap(tiny ? 'Compared: under about $' + COMPARED_USD.toFixed(2) + '/month for half of all markets' : 'The differences I compare: under about $' + COMPARED_USD.toFixed(2) + ' a month for half of all markets', mw, fsL);
    const tw = W - PAD - mx - (ph ? 98 : small ? 186 : 120);
    let tl = wrap(small ? 'What I compare, next to the shared cost' : 'The differences I compare, next to the rising cost everyone shared', tw, tfs);
    const need = () => (small ? 22 : 27) * (1 + tl.length) + L1.length * lh + L2.length * lh + 2 * (pd + bh) + gap + lead + 6;
    if (ph && need() > h) tl = ['Next to the shared cost'];
    if (ph && need() > h) { bh = 14; gap = 14; pd = 4; lead = 4; }                       // the shortest panels: slimmer bars and tighter rows
    if (tiny) { bh = 6; gap = 8; pd = 2; lead = 8; }
    const blockH = L1.length * lh + pd + bh + gap + L2.length * lh + pd + bh, titleH = (tiny ? 0 : small ? 22 : 27) + tl.length * (small ? 22 : 27);
    let y = y0 + titleH + Math.max(lead, (h - titleH - blockH) * 0.42);
    let s = '';
    tl.forEach((ln, i) => { s += txt(ln, mx, y0 + (small ? 22 : 27) * (i + 1), tfs, ink, fa, 'start', 600, 'data-fig-title="1"'); });
    L1.forEach((ln, i) => { s += txt(ln, mx, y + fsL + i * lh, fsL, ink, la1, 'start', 500); });
    y += L1.length * lh + pd;
    s += '<rect x="' + f1(mx) + '" y="' + f1(y) + '" width="' + f1(mw * g1) + '" height="' + bh + '" rx="2" fill="' + rule + '" opacity="' + f2(fade) + '"/>';
    y += bh + gap;
    L2.forEach((ln, i) => { s += txt(ln, mx, y + fsL + i * lh, fsL, accent, la2, 'start', 500); });
    y += L2.length * lh + pd;
    s += '<rect x="' + f1(mx) + '" y="' + f1(y) + '" width="' + f1(Math.max(4, mw * COMPARED_USD / SHARED_USD) * g2) + '" height="' + bh + '" rx="2" fill="' + accent + '" opacity="' + f2(fade) + '"/>';
    return s;
  }

  /* ---- source line helper ---- */
  function srcLine(text, op) {
    if (typeof window.sourceLine === 'function') window.sourceLine(figSvg, text, W, H, op);
  }

  /* ==================================================================
     init / resize
     ================================================================== */
  function init(el, data) {
    loadRatios(data.stages);
    beatIds = (window.BEATS || []).map(b => b.id);

    overlayEl = document.getElementById('slice-overlay');
    if (overlayEl) {
      svgOv = document.createElementNS(NS, 'svg');
      svgOv.style.cssText = 'display:block;width:100%;overflow:visible;';
      overlayEl.appendChild(svgOv);
    }
    figSvg = document.createElementNS(NS, 'svg');
    figSvg.style.cssText = 'display:block;width:100%;height:100%;overflow:visible;';
    el.appendChild(figSvg);
  }

  function resize(w, h) {
    W = w; H = h;
    small = window.matchMedia('(max-width: 899px), (orientation: landscape) and (max-height: 500px)').matches;
    NOTE_FS = LABEL_FS = small ? 12 : 13; LBL = small ? 13 : 15;
    scopeLayout = scopeGeo(barGeo()); // remeasure wrapped labels and italic b after fonts load
    lastOvKey = '';   // force redraw after resize
  }

  function bandHeight() { return BAND(); }
  // Horizontal extent [min, max] of the arrow from the bar between two panel y values, or null: the overview button keeps clear of it.
  function avoid(y0, y1) {
    if (!arrowPts || overlayEl.style.display === 'none') return null;
    let lo = Infinity, hi = -Infinity;
    arrowPts.forEach(q => { if (q[1] >= y0 - 4 && q[1] <= y1 + 4) { lo = Math.min(lo, q[0]); hi = Math.max(hi, q[0]); } });
    return lo <= hi ? [lo, hi] : null;
  }

  /* ==================================================================
     window.SLICE.thumb(svgSel, stage, x, y, w, h)
     Draws a tiny bar thumbnail at a given stage.
     Stages: 0 full, 1 between-races cut, 2 slice, 3 slice + state tick, 4 hairlines, 5 final.
     ================================================================== */
  function thumb(svgSel, stage, x, y, w, h) {
    if (!R.bet) return;
    let svg = svgSel;
    if (typeof svg === 'string') svg = document.querySelector(svg);
    else if (svg && typeof svg.node === 'function') svg = svg.node();
    if (!svg) return;

    const T = window.THEME || {};
    const accent = T.accent || '#0E5F6B', rl = T.rule || '#D9DCE0', ik = T.ink || '#1C2128';
    const g = document.createElementNS(NS, 'g');

    const betW = w * R.bet, predW = w * R.pred, keptW = Math.max(1, w * R.kept);

    if (stage === 0) {
      // Full accent
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', h);
      r.setAttribute('rx', 1); r.setAttribute('fill', accent);
      g.appendChild(r);
    } else {
      // Grey: between races (all stages >= 1)
      let r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', f1(betW)); r.setAttribute('height', h);
      r.setAttribute('rx', 1); r.setAttribute('fill', rl); r.setAttribute('opacity', '0.6');
      g.appendChild(r);

      if (stage >= 2) {
        // Grey: predictable
        r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', f1(x + betW)); r.setAttribute('y', y); r.setAttribute('width', f1(predW)); r.setAttribute('height', h);
        r.setAttribute('fill', rl); r.setAttribute('opacity', '0.4');
        g.appendChild(r);
        // Accent: kept
        r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', f1(x + betW + predW)); r.setAttribute('y', y); r.setAttribute('width', f1(keptW)); r.setAttribute('height', h);
        r.setAttribute('rx', 1); r.setAttribute('fill', accent);
        g.appendChild(r);
      } else {
        // Accent: within races (stage 1)
        r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', f1(x + betW)); r.setAttribute('y', y); r.setAttribute('width', f1(w - betW)); r.setAttribute('height', h);
        r.setAttribute('rx', 1); r.setAttribute('fill', accent);
        g.appendChild(r);
      }

      // State tick (stage >= 3)
      if (stage >= 3) {
        const tX = x + betW + predW + keptW * R.loc;
        const ln = document.createElementNS(NS, 'line');
        ln.setAttribute('x1', f1(tX)); ln.setAttribute('y1', y);
        ln.setAttribute('x2', f1(tX)); ln.setAttribute('y2', y + h);
        ln.setAttribute('stroke', ik); ln.setAttribute('stroke-width', '0.5');
        g.appendChild(ln);
      }

      // Hairlines (stage >= 4): visible ticks inside the kept part
      if (stage >= 4) {
        const adjInState = [true, true, false, false];
        for (let k = 0; k < 4; k++) {
          const frac = adjInState[k]
            ? R.loc + R.sta * (k === 0 ? 0.33 : 0.67)
            : R.loc * (k === 2 ? 0.4 : 0.7);
          const tx = x + betW + predW + keptW * frac;
          const ln = document.createElementNS(NS, 'line');
          ln.setAttribute('x1', f1(tx)); ln.setAttribute('y1', y);
          ln.setAttribute('x2', f1(tx)); ln.setAttribute('y2', y + h);
          ln.setAttribute('stroke', ik); ln.setAttribute('stroke-width', '0.5'); ln.setAttribute('opacity', '0.5');
          g.appendChild(ln);
        }
      }
    }
    svg.appendChild(g);
  }

  /* ---- exports ---- */
  window.VIS.slice = { init, render, resize, overlay, bandHeight, avoid, equationMoveRange: EQ_MOVE };
  window.SLICE = { thumb };
  Object.defineProperty(window, 'SLICE_BAND', {
    configurable: true,
    get() {
      const state = window.BEAT_STATE;
      if (!state || idx('close-to-random') < 0) return 0;
      const ci = idx(state.id);
      // The band is reserved from ideal on, growing during ideal's build (the fly-back from the line-up), so the figure keeps its place from
      // ideal through close-to-random, where the bar grows in (PI, 2026-10-29: the map shifted down as close-to-random appeared).
      if (ci === idx('ideal')) return BAND() * sm(0.04, 0.30, state.p);
      if (ci === idx('ideal-shuffle')) return BAND();
      if (ci === idx('report-ladder')) return BAND() * (1 - ease(state.t || 0));
      return ci >= idx('close-to-random') && ci < idx('report-ladder') ? BAND() : 0;
    },
    set(_value) {}
  });
  window.SLICE_STRIP_H = 0;
})();
