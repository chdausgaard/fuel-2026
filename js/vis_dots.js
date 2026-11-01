/* window.VIS.dots (v7): about 3,100 county dots as one object, scroll-linked. Beats per STORYBOARD.md v7 (dots-intro … recap-limits); the code of beats removed in v7 stays, unrouted.
   Interface (SPEC.md): init(el, data), render(state), resize(w, h).  state = { id, next, p, t, w, h }.
   render() is a pure function of state plus layouts cached at init/resize. No timers, no transitions.
     - every beat has a start frame and an end frame (identical unless the beat animates inside itself, driven by p);
     - the picture moves from the end frame of beat `id` to the start frame of beat `next` by ease(t);
     - builds are complete by about p = 0.45 and then hold. Two stages (v6): the figure builds over p = 0.05..0.25 and its arrows and callout labels
       come in over p = 0.25..0.45 (late(): sub-groups driven by p); annotations fade out with t;
       "furniture" (axes, legends, the bar) is shared between consecutive beats and cross-fades with t.
   One canvas draws the dots, one SVG draws axes, arrows and labels. Chart panels (burden, states-deviation, checks,
   equation) are drawn by window.DOTS_PANELS inside this module's SVG, over the faded dots. what-is-left and two-slices are drawn here (v6).
   All state-level and local price changes here are SIMULATED and tagged "illustrative" on screen; no real state is named or highlighted next to them.
   Regional price rises (EIA) and regional burden (b22, b26) are real. */
(function () {
  'use strict';
  window.VIS = window.VIS || {};

  // v7 (orchestrator, 2026-10-23): the beats of STORYBOARD v7. Beats removed in v7 keep their frames and code below, unrouted (STORYBOARD_archive.md).
  const BEATS = ['dots-intro', 'dots-example', 'burden-local', 'races-covered', 'dots-question', 'dots-holidays',
    'method-map', 'ideal', 'simplest-axes', 'simplest-slope', 'races', 'races-cost', 'within-race', 'exposure-problem', 'exposure-problem-2', 'price-problem', 'price-problem-2',
    'nearby-markets', 'state-part', 'unusual-rise', 'burden-split', 'burden-split-2', 'comparison', 'comparison-2', 'assumption',
    'adj-oil', 'adj-prior', 'what-is-left', 'recap', 'recap-2', 'recap-3', 'recap-4', 'recap-limits',
    // v8 new/native beats
    'burden-map', 'local-markets', 'exposure', 'price-local', 'markets', 'extra-cost', 'vote-swing', 'the-question', 'idea-tangle', 'idea-ideal', 'idea-aim', 'idea-route',
    'simple', 'simple-why', 'same-race', 'same-race-2', 'same-race-steeper', 'within-exposure', 'within-exposure-2', 'within-price', 'nearby', 'unusual', 'unusual-why', 'group-votes',
    'fan', 'fan-2', 'fan-3', 'all-groups', 'state-layer', 'state-layer-2', 'state-layer-3',
    'adj-pt', 'adj-pt-2', 'adj-lag', 'eq-1', 'eq-2', 'eq-3', 'eq-4', 'state-q',
    // v9 panels: the group figure (frames as unusual) and the overview
    'exposure-scale', 'both-sides', 'compare', 'compare-all', 'route',
    // v9.3 (Part 4): the beats split from nearby and both-sides
    'nearby-intro', 'nearby-groups', 'both-sides-bridge', 'both-sides-line', 'both-sides-remove', 'both-sides-why',
    // v9.3 (Part 6): the States beats (panels in states-deviation, then the supply-region map)
    'state-bridge', 'state-comparison', 'state-adj-pt', 'state-adj-lag', 'state-regions', 'state-map',
    // v9.4: the beats split from simple and ideal; state-regions is the supply-region map in its new place (state-map stays as the id main.js's alias still sends until that line is deleted)
    'simple-votes', 'ideal-shuffle', 'close-to-random', 'both-sides-total', 'stock-take',
    // v9.5: adj-state (the supply-region map, was state-regions), adj-pt and adj-lag (moved from state-adj-pt/state-adj-lag), state-question (the two-state panel)
    'adj-state', 'adj-pt', 'adj-lag', 'state-question',
    // 2026-10-30: the short beat that names the four adjustments and opens them; it takes over the zoom out of adj-oil
    'adj-brief',
    // 2026-10-30: the map of where the variation that is left sits
    'scope-where'];
  const IDX = {}; BEATS.forEach((b, i) => { IDX[b] = i; });
  // v7: two adjustments (oil and gas jobs, the earlier vote shift). The v6 slices for pass-through and the earlier price rise are gone with their beats.
  const ADJ = ['adj-oil', 'adj-prior'];
  // Beats whose chart is drawn by window.DOTS_PANELS (js/dots_panels.js) on top of this module's layer (contract with the panels worker).
  // v8: panel routing includes both v7.2 ids (for aliases) and v8 ids that the panels/dots workers will build
  const PANEL_OF = {
    'method-map': 'overview', 'idea-route': 'overview', 'route': 'overview',
    'burden-local': 'burden', 'burden-split': 'burden', 'burden-split-2': 'burden',
    'unusual-rise': 'states-deviation',
    'comparison': 'states-deviation', 'group-votes': 'states-deviation',
    // v9: one continuous group figure from unusual to compare-all
    'unusual': 'group', 'unusual-why': 'group', 'exposure-scale': 'group', 'both-sides': 'group', 'compare': 'group', 'compare-all': 'group',
    'both-sides-bridge': 'group', 'both-sides-line': 'group', 'both-sides-remove': 'group', 'both-sides-why': 'group',
    'state-layer': 'states-deviation', 'state-layer-2': 'states-deviation',
    'adj-pt': 'states-deviation', 'adj-pt-2': 'states-deviation', 'adj-lag': 'states-deviation',
    'state-q': 'states-deviation',
    'state-bridge': 'states-deviation', 'state-comparison': 'states-deviation', 'state-adj-pt': 'states-deviation', 'state-adj-lag': 'states-deviation',
    // v9.5: the new beat ids route to the same panels
    'adj-pt': 'states-deviation', 'adj-lag': 'states-deviation', 'state-question': 'states-deviation',
    'recap': 'equation', 'recap-2': 'equation', 'recap-3': 'equation', 'recap-4': 'equation',
    'eq-1': 'equation', 'eq-2': 'equation', 'eq-3': 'equation', 'eq-4': 'equation', 'stock-take': 'equation', 'both-sides-total': 'group'
  };
  const SRCH = 22;                                  // height of the band reserved for the source line

  const _TH = window.THEME || {};
  // label sizes are scaled once, here and in measure(); titles, subtitles and tags (14px and up) pass their final size (PI, 2026-10-30)
  const fz = v => (+v >= 14 ? +v : Math.round(+v * _TH.figType.scale[small ? 1 : 0] * 10) / 10);
  const FONT = _TH.fontLabelCanvas || "'Barlow', 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif";
  const DEF = { bg: '#F7F3EC', ink: '#1E1B22', muted: '#5D5862', rule: '#D9D2C7', accent: '#0F6B66', accentSoft: '#D5E8E4', rep: '#B2423A', dem: '#2F5D9B' };
  const DEF_PADD = { '1A': '#6C7FA6', '1B': '#4E9AA8', '1C': '#7FA77A', '2': '#C2A35A', '3': '#B7795A', '4': '#9A7BA6', '5': '#5F8F6E' };
  const PADD_NAME = { '1A': 'New England', '1B': 'Central Atlantic', '1C': 'Lower Atlantic', '2': 'Midwest', '3': 'Gulf Coast', '4': 'Rocky Mountain', '5': 'West Coast' };
  const ST_NAME = { GA: 'Georgia', NC: 'North Carolina', OH: 'Ohio', IN: 'Indiana', UT: 'Utah' };
  // Race strips: the color only tells adjacent strips apart (a strip is one race, ordered by its average shift). Four hues from the region palette that are neither red nor blue,
  // so that none reads as a party; the key under the strips says so.
  const STRIP_COL = _TH.strip || ['#5F6367', '#A3A9B0'];         // v7.2 [4.3]: two alternating neutrals (ink at about 70%, a muted gray); they only separate neighboring strips
  const SLICE_NAME = ['oil and gas jobs', 'earlier vote shift'];
  const BAR_R = [1, 0.96, 0.92];                   // illustrative remaining share after each adjustment; v7.1 (causal review C6): under the design the adjustments remove little of the unusual part of the extra fuel cost
  const NS = 'http://www.w3.org/2000/svg';
  const KFX = [0.24, 0.58], KGX = 0.82, KGX2 = 1.0;   // gaps: x of the lower- and higher-exposure groups, of the gap arrow, and of Place B's widened gap, as a share of the column width
  const KGAP = { A: 1.1, B: 2.7 };                    // the two gaps, in points (the dots are shifted so that the means differ by exactly these)
  // Price-rise tags of the two places [long, short (phones)]: Place A a rise equal to the region’s average; Place B first the same (ghost), then unusually large. Illustrative.
  const KTAG = { A: ['price rise: +$1.20, the region’s average', '+$1.20, the region’s average'], B0: ['price rise: +$1.20, the region’s average', '+$1.20, the region’s average'], B: ['price rise: +$1.45, unusually large', '+$1.45, unusually large'] };
  const ASSUMP_CAP = 'within each group, whether a market’s price rose more or less than the group’s average must be unrelated to how its counties would otherwise have voted';
  const TMIN = 0.14;                               // lowest burden color is not the page color
  // The 44 states with a Senate or governor's race in the analysis (config/races_2026.csv, included_d3 == true; 66 races).
  const STATES44 = ['AL', 'AR', 'AZ', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'IA', 'ID', 'IL', 'KS', 'KY', 'LA', 'MA', 'MD', 'ME', 'MI', 'MN', 'MS', 'MT', 'NC', 'NE', 'NH', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'VA', 'VT', 'WI', 'WV', 'WY'];
  // Pennsylvania CBSAs with local price coverage that are micropolitan (small-town) areas, from the Census delineation file of July 2023 (counties.json carries no CBSA type).
  const MICRO = { '14100': 1, '20700': 1, '25850': 1 };
  const MW = ['IL', 'IN', 'IA', 'KS', 'KY', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'OK', 'SD', 'TN', 'WI'];   // PADD 2
  const MW_PAIRS = [['ND', 'MI', -0.2], ['NE', 'OH', 0.05], ['OK', 'KY', 0.2]];   // states of the region compared with each other (top, middle and bottom arcs; illustration of the rule, no prices)
  const TWO_DIM = 0.35;                            // opacity of the de-emphasized map in two-analyses / two-analyses-2
  const KIND = { metro: _TH.metro || '#46546A', micro: _TH.micro || '#B07D1E', metroFill: _TH.metroFill || '#DDE2E9', microFill: _TH.microFill || '#F1E3C2' };   // metropolitan vs micropolitan areas: not price colors
  KIND.rural = _TH.rural || '#6B8F5E'; KIND.ruralFill = _TH.ruralFill || '#DCE8D5';                 // v7: rural commuting zones, the third kind of local market (not a price color either)
  const KIND_OF = ['metro', 'micro', 'rural'];
  // v7 nearby-markets / assumption: the group of four central Pennsylvania metropolitan areas (data/markets.json), and the caption of assumption.
  const PA_GROUP = 'B:K:42-metropolitan:3';
  const ASSUMP7 = 'within each group, whether a market’s price rose more or less than the group’s average must be unrelated to how its counties would otherwise have voted';
  // v7 comparison: four nearby markets of one group (anonymous), their rises (as in unusual-rise) and the unusual part of each. Illustrative.
  const CMP_RISE = [1.15, 1.30, 1.18, 1.17], CMP_AVG = 1.20, CMP_N = [4, 5, 3, 4];
  const CMP_BETA = 4.5;                             // simulated points of vote shift per point of income taken by the unusual part of the rise (the four markets of `comparison`: drawn larger than real, disclosed in S_CMP)
  const CMP_BG_BETA = 3.0, CMP_BG_SD = 2.0;         // v7.1 (causal review C7): the other counties of comparison-2 at the detectable effect (0.45 points per $10) with realistic scatter (2022 within-race SD about 2 points)

  // One grey source line per figure: [long, short (phones)].
  const S_ACS = ['Source: American Community Survey 2020–2024.', 'Source: ACS 2020–2024.'];
  const S_ACSEIA = ['Source: American Community Survey 2020–2024; U.S. Energy Information Administration.', 'Source: ACS 2020–2024; EIA.'];
  const S_ALL = ['Source: American Community Survey 2020–2024; MIT Election Data and Science Lab; U.S. Energy Information Administration.', 'Source: ACS; MIT Election Lab; EIA.'];
  const S_MIT = ['Source: MIT Election Data and Science Lab.', 'Source: MIT Election Lab.'];
  const S_HYP = ['Hypothetical counties.', 'Hypothetical counties.'];
  const S_COV = ['Race list: provisional, from candidate lists as of Oct 20, 2026. Exposure: American Community Survey 2020–2024.', 'Race list: provisional, from candidate lists as of Oct 20, 2026.', 'Race list: provisional (Oct 20, 2026).'];
  const S_REG = ['Source: U.S. Energy Information Administration, weekly retail prices by supply region.', 'Source: EIA, weekly retail prices by region.'];
  const S_ILLOC = ['Illustrative: simulated local prices.', 'Illustrative: simulated local prices.'];
  const S_ILKEY = ['Illustrative: simulated prices and vote shifts.', 'Illustrative: simulated prices and shifts.'];
  // v7.1 (causal review C7): the comparison figures say how they differ from real vote shifts
  const S_CMP = ['Illustrative: simulated prices and vote shifts. The effect is drawn much larger, and the scatter much smaller, than in real vote shifts.', 'Illustrative: effect drawn larger, scatter smaller than real.'];
  const S_CMP2 = ['Illustrative: simulated. The small dots scatter as real vote shifts do, around the smallest effect the analysis can reliably detect.', 'Illustrative: simulated, with realistic scatter.'];
  const S_ILST = ['State tints: illustrative, simulated. Highlighted: counties in metro areas with local price data.', 'State tints: illustrative, simulated.'];
  const S_ILSTATE = ['Illustrative: simulated state prices.', 'Illustrative: simulated state prices.'];
  const S_EIA = ['Source: U.S. Energy Information Administration, supply regions.', 'Source: EIA supply regions.'];
  const S_CBSA = ['Source: Census Bureau, metropolitan and micropolitan statistical areas (2023 delineation).', 'Source: Census Bureau statistical areas (2023).'];
  const S_ASSUMP = ['Source: EIA supply regions; Census Bureau statistical areas (2023 delineation).', 'Source: EIA regions; Census statistical areas.'];
  const S_PASS = ['Illustrative: simulated state prices. National price: U.S. Energy Information Administration.', 'Illustrative: simulated state prices; national: EIA.'];
  const S_LAG = ['Illustrative: simulated vote shifts.', 'Illustrative: simulated vote shifts.'];
  const S_HOL = ['Source: state tax-holiday orders and announcements (2026).', 'Source: state tax-holiday orders.'];
  const S_LEFT = ['Illustrative: simulated local price rises. Exposure: American Community Survey 2020–2024.', 'Illustrative: simulated local price rises.'];
  const S_MKT = ['Sources: Census Bureau statistical areas (2023 delineation); USDA commuting zones (2020). Groups: project.', 'Sources: Census statistical areas (2023); USDA commuting zones (2020).', 'Sources: Census Bureau; USDA.'];
  const S_CHECKS = ['Illustrative: made-up numbers until the real checks are run.', 'Illustrative: made-up numbers.'];
  const S_SLICES = ['Illustrative: simulated county price rises; shares computed from 2026 prices so far (provisional).', 'Illustrative: simulated price rises; shares from 2026 prices so far.'];
  const S_EQ = ['Shares: project calculations from 2026 prices so far (provisional).', 'Shares: 2026 prices so far (provisional).'];
  const S_OIL = ['Source: Census Bureau, County Business Patterns.', 'Source: Census County Business Patterns.'];
  // Accessible name of the figure for every beat (set on the svg, role="img", when the displayed beat changes).
  const ARIA = {
    'dots-intro': 'Map of the roughly 3,100 U.S. counties as dots, shaded by exposure: what a $1 rise in the price of gas would cost a typical household, as a share of its monthly income. Darker dots are higher exposure, mostly in the rural South and parts of the Mountain West. Dot size shows the number of households.',
    'dots-example': 'The same map with two counties marked: Fairfax County, Virginia, where a $1 rise costs a small share of income, and Robeson County, North Carolina, where it costs a much larger share.',
    'burden-state': 'Worked example with two made-up counties in one state. A $1 rise costs 1.5 percent of a typical household’s income in County A and 0.5 percent in County B. With a state-wide price rise of $1.20, the extra fuel cost is 1.8 percent in A and 0.6 percent in B.',
    'burden-metro': 'The same two made-up counties with local prices. County A’s metro area saw a $1.30 rise and County B’s $1.10, so the extra fuel cost is 1.95 percent in A and 0.55 percent in B.',
    'two-analyses': 'Two small maps of the United States, side by side or stacked on a narrow screen. The main analysis, with local prices, is emphasized: its highlighted dots are the counties in the roughly 390 metro areas with local price data. The state-price map is dimmed.',
    'two-analyses-2': 'The same two small maps with the second analysis, state prices, now emphasized: its highlighted dots are counties in the 44 states with a race, tinted by an illustrative state price rise. The local-price map is dimmed.',
    'races-covered': 'Map of the counties in the 44 states with a Senate or governor’s race in the analysis, shaded by exposure. Counties in the other states are grey.',
    'dots-question': 'Map of the counties in the states with a race, now shaded by extra fuel cost: exposure times the region’s price rise since 2024. The West Coast, where the rise was largest, turns darker than on the exposure map. Counties in states with no race in the analysis are grey.',
    'dots-holidays': 'Map highlighting five states that cut or suspended their gas tax: Georgia, North Carolina, Ohio, Indiana and Utah. Labels give the type of cut and its dates.',
    'ideal': 'Map of the counties in the states with a race, colored by extra fuel cost with the colors shuffled among the counties at random, so that no regional pattern is left.',
    'simplest-axes': 'Scatter plot of the counties in 2022. The horizontal axis is the extra fuel cost of the 2022 price rise as a percentage of monthly income, the vertical axis the shift against the president’s party from 2020 to 2022 in points. One county, Robeson County, is labeled.',
    'simplest-slope': 'The same scatter plot with a fitted line that slopes down a little: about minus 1.0 vote points per extra point of extra fuel cost.',
    'races': 'The scatter plot regrouped into one vertical strip of county dots per statewide race in 2022, ordered by the race’s average shift; neighboring strips alternate dark and light gray. About three-quarters of the differences are between races. The Pennsylvania Senate race is highlighted. Counties beyond the axis are drawn as open circles at its edge.',
    'races-cost': 'The strips with each race’s average shift removed, so every strip is centered on zero. The differences between races move into a hatched set-aside area on the right.',
    'within-race': 'The centered strips, showing only what is left: the differences within each race. The set-aside area is faded on the right.',
    'exposure-problem': 'Scatter plot of Pennsylvania’s counties by extra fuel cost and 2022 Senate shift, with a fitted line, faint lines for earlier elections, and the slopes in vote points per point of extra fuel cost. The set-aside area fades out.',
    'exposure-problem-2': 'The Pennsylvania counties colored by the 2020 Republican share of the two-party vote. High-exposure counties are more Republican, so they were already moving differently before the price rise.',
    'price-problem': 'Map of the United States by supply region, shaded in violet by the price rise since the 2024 election: darkest on the West Coast, lightest in the Lower Atlantic.',
    'price-problem-2': 'Illustrative map of Pennsylvania’s counties, first all at the regional price rise, then with simulated local rises: the rise differs smoothly from one side of the state to the other, and the outlined metropolitan counties sit a little above the countryside. Labels: rises differ across the state; cities and countryside differ.',
    'comparable-states': 'Map colored by the seven fuel supply regions, with the Midwest highlighted and its states outlined. Curved arrows show that states in the same region are compared only with each other.',
    'comparable-metros': 'Map of Pennsylvania with metropolitan and small-town areas outlined and shaded in two colors. Curved arrows show that areas of the same kind are compared with each other.',
    'unusual-rise': 'Illustrative bar chart for one group of four nearby markets, Market 1 to Market 4: price rises of $1.15, $1.30, $1.18 and $1.17 against a line at the group’s average rise, $1.20. Market 1 is County A’s market and Market 2 County B’s. The bars are then re-based to their deviations from the average, minus 5, plus 10, minus 2 and minus 3 cents: the unusual part of each rise.',
    'burden-split': 'Worked example for the two made-up counties, whose markets are in a group with an average rise of $1.20. County A: 1.6% times $1.20 is 1.92%, the part that exposure alone predicts, plus 1.6% times minus $0.05, minus 0.08%, exposure times the unusual part of the rise; together 1.84%. County B: 1.2% times $1.20 is 1.44%, plus 1.2% times $0.10, plus 0.12%; together 1.56%. A small bar under each county shows the two parts.',
    'burden-split-2': 'The same worked example. The parts that exposure alone predicts are dimmed and labeled set aside; the parts from the unusual part of the rise, minus 0.08% for County A and plus 0.12% for County B, are labeled the only part the comparison uses.',
    'gaps-same': 'Two made-up places with the same price rise. In each, county dots are grouped into lower and higher exposure with black lines at the group averages, and an arrow shows the gap between the groups, about 1.1 points in Place A. Simulated shifts.',
    'gaps-bigger': 'The two places again. Place B’s price rise was unusually large, plus $1.45, and its gap between higher and lower exposure counties is wider, about 2.7 points, than Place A’s. Simulated shifts.',
    'gaps-difference': 'Two bars for the gaps, plus 1.1 for Place A and plus 2.7 for Place B. The part both share, from rural, Republican-leaning counties, largely drops out. The difference of plus 1.6 is what the analysis looks for.',
    'assumption': 'The map of Pennsylvania’s counties by kind of local market again, with the group of four central metropolitan areas, Altoona, Johnstown, State College and Williamsport, highlighted and arrows between them. Caption: within each group, whether a market’s price rose more or less than the group’s average must be unrelated to how its counties would otherwise have voted.',
    'adj-passthrough': 'Illustrative line chart of the national gas price with two states, one that moves more than the national price and one that moves less. Below, a bar of the variation in extra fuel cost that is left, with the first slice labeled pass-through.',
    'adj-lagged': 'Illustrative chart of vote shift toward Republicans in 2020, 2024 and 2026 for high-exposure counties. In comparable states the line stays level. In a state whose prices had risen unusually fast before 2024 it rises in 2024, punishing the Democrats, then drifts back by 2026, which looks like a turn against the new president’s party.',
    'adj-oil': 'Map highlighting the oil and gas counties, where oil and gas jobs are above 2 percent of employment, for example in West Texas. A bar below shows the variation in extra fuel cost that is left; its first slice, oil and gas jobs, a few percent, is shaved off. Illustrative sizes.',
    'adj-prior': 'Map of counties shaded by their vote shift from 2020 to 2024, from blue (toward Democrats) to red (toward Republicans). The bar below loses its second slice, the earlier vote shift, a few percent; what remains is what the analysis compares. Illustrative sizes.',
    'checks': 'Illustrative numbers, not results. First chart: a check that counties with higher extra fuel cost had not already voted differently in earlier elections. The second chart, a check on what predicts a state’s price rise, is shown faintly.',
    'checks-2': 'Illustrative numbers, not results. Second chart: four estimates of what might predict a state’s price rise, all close to zero if the assumption holds. The first chart is shown less strongly.',
    'checks-3': 'Illustrative numbers, not results. Both check charts at full strength: the check on earlier elections and the check on what predicts a state’s price rise.',
    'what-is-left': 'Illustrative scatter plot of counties within races: extra fuel cost compared with the state’s average against exposure compared with the state’s average. As the part that exposure alone predicts is removed, the spread collapses toward the zero line, and only exposure times the unusual part of each market’s rise is left: a thin band around zero, above it where the market’s rise was unusually large and below it where it was unusually small. Simulated local price rises.',
    'two-slices': 'Three horizontal strips of county dots placed by simulated price rises: all counties minus the national average, then after removing each region’s average, then after also removing each state’s average. A stacked bar shows the shares: about 41 percent between regions, 48 percent between states and 11 percent between metro areas.',
    'recap': 'The analysis written as an equation: the county’s vote shift against the president’s party equals its extra fuel cost multiplied by a number b.',
    'recap-2': 'The equation with a separate starting point for every race added.',
    'recap-3': 'The equation with the extra fuel cost split into exposure times the group’s average rise, the part that exposure alone predicts, and exposure times the unusual part of the rise. The second part is the only variation in extra fuel cost the comparison uses: about 6 percent of it.',
    'recap-4': 'The equation with the two adjustments added as further terms, oil and gas jobs and the 2020 to 2024 shift, and a small gray note for the two terms of the comparison between states. The number sought is still b.',
    'recap-limits': 'Map of the United States beside a hatched area labeled not measured: nationwide effects, and effects shared within a state.',
    // v7: new beats (the panel beats' own labels, from dots_panels.js, take precedence over these where the panel sets one)
    'method-map': 'Overview of the method in thirteen steps, in six bands: the starting point (the simplest comparison; comparing within each race); two problems (exposure; price rises); comparing comparable places (nearby markets of the same kind; the part of the extra fuel cost that counts; what the comparison looks like; the one assumption it rests on); two adjustments (oil and gas jobs; the earlier shift in the vote); what is left, in short (what is left to compare; the whole method in one equation); and the test on twelve past elections.',
    'burden-local': 'Worked example with two made-up counties in one made-up state, each in its own local market. A $1 rise costs 1.6 percent of a typical household’s income in County A and 1.2 percent in County B. Prices rose $1.15 in County A’s market and $1.30 in County B’s, so the extra fuel cost is 1.84 percent in A and 1.56 percent in B.',
    'nearby-markets': 'Map of Pennsylvania’s 67 counties, colored by the kind of local market they belong to: metropolitan area, micropolitan area or rural commuting zone. Thin lines join the counties of each of the 44 markets. Then one group comes forward and the rest dims: the four metropolitan areas of central Pennsylvania, Altoona, Johnstown, State College and Williamsport, with arrows saying they are compared only with each other, and a label saying they are not compared with Philadelphia, which is in another group.',
    'state-part': 'Map of the United States colored by the seven fuel supply regions, with the Midwest highlighted and its states outlined. Curved arrows show that states in the same region are compared only with each other; a label notes that they share refineries and pipelines.',
    'comparison': 'Illustrative chart of four nearby markets side by side, Market 1 to Market 4, with price rises of $1.15, $1.30 (unusually large), $1.18 and $1.17. Each column holds three to five county dots, placed by their simulated vote shift against the president’s party relative to the race average and shaded by exposure, with a black line at each market’s average. Market 2’s counties sit about one point higher, its most exposed county highest. A bracket at Market 2 reads: if prices matter, further against the president’s party.',
    'comparison-2': 'Illustrative scatter plot: the same counties slide onto a horizontal axis, the unusual part of the extra fuel cost as a percentage of monthly income, centered on zero, keeping their vote shifts. About 300 faint simulated counties from other groups join them, and a fitted line is labeled: the slope, the number the analysis estimates.'
  };
  Object.assign(ARIA, {
    'exposure': 'Map of roughly 3,100 county dots. Their colors show what a $1 rise in the price of gas would cost a typical household as a share of monthly income; darker dots show higher exposure.',
    'price-local': 'Map zoomed to one state’s counties, colored by illustrative local price rises.',
    'markets': 'Zoomed county map. Illustrative price colors fade to neutral before hulls and spokes join counties in each local market; two markets are labeled.',
    'extra-cost': 'National county map shaded by extra fuel cost as a share of monthly income, using regional price rises from the Energy Information Administration.',
    'vote-swing': 'National extra fuel cost map. Counties in the 44 states with a Senate or governor’s race keep their color; counties in other states turn light gray.',
    'the-question': 'National map of extra fuel cost by county in the 44 states with a race; counties in other states are light gray.',
    'simple': 'Dot line-up of the counties in the states with a race, ordered left to right by extra fuel cost and stacked into columns of dots. The dots then rise by made-up vote shifts against the president’s party, on a new vertical axis, with a faint fitted line showing a gentle upward slope.',
    'simple-why': 'The same dots with the made-up vote shifts, now colored by the kind of local market: metropolitan, micropolitan or rural. West Coast counties are ringed, and the key says so.',
    'same-race': 'The county scatter measured from each state’s household-weighted mean on both axes.',
    'same-race-steeper': 'The within-state fitted line is steeper than the dashed national line.',
    'within-exposure': 'Pennsylvania’s 67 counties by exposure and 2012 to 2016 vote shift, colored by 2020 Republican vote share.',
    'within-exposure-2': 'Five fitted lines for Pennsylvania counties: 2016 and 2020 and 2024 presidential elections, and 2018 and 2022 Senate elections.',
    'within-price': 'Pennsylvania’s counties in the real state outline, colored by illustrative local price rises. Metropolitan counties are outlined.',
    'nearby': 'Pennsylvania markets colored by kind, with four nearby metropolitan markets highlighted and arrows joining only those markets.',
    'fan': 'County scatter of exposure and whole extra fuel cost, both measured from the state average. Illustrative local price deviations make a rising cloud.',
    'fan-2': 'The rising cloud drops to exposure times the unusual part of each market’s rise, a thin fan around zero.',
    'fan-3': 'The fan around zero. Even the most exposed counties can lie above or below zero.',
    'all-groups': 'County scatter of the unusual part of the extra fuel cost against simulated vote shifts, with a fitted slope at a detectable effect size.',
    'assumption': 'Pennsylvania market map. Four central metropolitan markets are linked; whether a market’s price rose more or less than the group’s average must be unrelated to how its counties would otherwise have voted.',
    'state-layer-3': 'National county map colored by fuel supply region, with the Midwest states outlined and compared within their region.'
  });
  Object.assign(ARIA, {
    'same-race': 'County vote shifts in 2022 statewide races, ordered by each race’s average shift. A bracket gives the between-race share; the Pennsylvania Senate race is marked.',
    'same-race-2': 'The 2022 statewide race strips centre on each race’s average shift. The race averages move into a hatched set-aside area.',
    'nearby-intro': 'The 2022 race strips pick out the Pennsylvania Senate race. Its 67 county dots then spread over a Pennsylvania map, colored by kind of local market: metropolitan, micropolitan or rural.',
    'nearby-groups': 'Pennsylvania’s local markets by kind. Four central metropolitan markets come forward, linked by arrows: compared only with each other, not with Philadelphia.',
    'nearby': 'Pennsylvania counties colored by metropolitan, micropolitan or rural local market. The central group of four metropolitan markets is highlighted and compared within the group.',
    'assumption': 'Pennsylvania counties colored by local market kind, with Altoona, Johnstown, State College and Williamsport linked within one group.',
    'adj-oil': 'National county map with oil and gas counties highlighted, including an example in West Texas.',
    'adj-prior': 'National county map shaded by each county’s 2020 to 2024 vote shift, with a diverging key.',
    'state-layer-3': 'National county map colored by fuel supply region. Midwest states are outlined and arrows compare them within their region.',
    'state-map': 'National county map. The seven fuel supply regions are colored in one at a time, from the West Coast to New England; the Midwest’s states are then outlined and linked by arrows: compared only with each other.'
  });
  const SRC_OF = {
    'dots-intro': S_ACS, 'dots-example': S_ACS, 'burden-state': S_HYP, 'burden-metro': S_HYP, 'two-analyses': S_ILST, 'two-analyses-2': S_ILST, 'races-covered': S_COV, 'dots-question': S_ACSEIA,
    'dots-holidays': S_HOL, 'ideal': ['Source: ACS 2020–2024; EIA. Illustrative: the colors shuffled at random.', 'Source: ACS; EIA. Illustrative: colors shuffled at random.'], 'simplest-axes': S_ALL, 'simplest-slope': S_ALL, 'races': S_MIT, 'races-cost': S_MIT, 'within-race': S_MIT,
    'exposure-problem': S_ALL, 'exposure-problem-2': S_ALL, 'price-problem': S_REG, 'price-problem-2': S_ILLOC, 'gaps-same': S_ILKEY, 'gaps-bigger': S_ILKEY, 'gaps-difference': S_ILKEY,
    'comparable-states': S_EIA, 'comparable-metros': S_CBSA, 'unusual-rise': S_ILLOC, 'burden-split': S_HYP, 'burden-split-2': S_HYP, 'assumption': S_MKT,
    'adj-passthrough': S_PASS, 'adj-lagged': S_LAG, 'adj-oil': S_OIL, 'adj-prior': S_MIT, 'checks': S_CHECKS, 'checks-2': S_CHECKS, 'checks-3': S_CHECKS, 'what-is-left': S_LEFT, 'two-slices': S_SLICES,
    'recap': S_EQ, 'recap-2': S_EQ, 'recap-3': S_EQ, 'recap-4': S_EQ, 'recap-limits': S_ACS,
    // v7
    'burden-local': S_HYP, 'nearby-markets': S_MKT, 'state-part': S_EIA, 'comparison': S_CMP, 'comparison-2': S_CMP2,
    // v8 map beats
    'burden-map': S_ACSEIA, 'local-markets': S_CBSA, 'races': S_COV,
    'exposure': S_ACS, 'price-local': S_ILLOC, 'markets': S_MKT, 'extra-cost': S_ACSEIA, 'vote-swing': S_COV, 'the-question': S_ACSEIA,
    'idea-tangle': S_ACSEIA, 'idea-ideal': ['Illustrative: shades assigned at random.', 'Illustrative: random shades.'], 'idea-aim': S_ACSEIA,
    'simple': S_ACSEIA, 'simple-why': ['Source: ACS 2020–2024; EIA; Census Bureau and USDA market definitions. Illustrative: made-up vote shifts.', 'Source: ACS; EIA; Census, USDA. Illustrative: made-up vote shifts.'],
    'same-race': S_ALL, 'same-race-steeper': S_ALL,
    'within-exposure': S_ALL, 'within-exposure-2': ['Source: ACS 2020–2024; MIT Election Data and Science Lab.', 'Source: ACS; MIT Election Lab.'],
    'within-price': S_ILLOC, 'nearby': S_MKT, 'fan': S_LEFT, 'fan-2': S_LEFT, 'fan-3': S_LEFT,
    'all-groups': ['Illustrative: simulated prices and vote shifts, drawn at about the smallest effect the analysis can reliably detect.', 'Illustrative: simulated prices and vote shifts.'],
    'state-layer-3': S_EIA, 'state-map': S_EIA
  };
  SRC_OF['same-race'] = S_MIT;
  SRC_OF['same-race-2'] = S_MIT;
  SRC_OF['nearby-intro'] = S_MKT;
  SRC_OF['nearby-groups'] = S_MKT;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const hexRgb = h => { const k = parseInt(h.slice(1), 16); return [(k >> 16) & 255, (k >> 8) & 255, k & 255]; };
  const sgn = (v, d) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d == null ? 1 : d);
  const money = v => '$' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gauss(rnd) { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function quant(arr, p) { const a = Array.from(arr).filter(Number.isFinite).sort((x, y) => x - y); return a[Math.floor(p * (a.length - 1))]; }
  function wfit(xs, ys, ws) {
    let sw = 0, mx = 0, my = 0; const m = xs.length;
    for (let i = 0; i < m; i++) { const w = ws ? ws[i] : 1; sw += w; mx += w * xs[i]; my += w * ys[i]; }
    mx /= sw; my /= sw;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < m; i++) { const w = ws ? ws[i] : 1; sxy += w * (xs[i] - mx) * (ys[i] - my); sxx += w * (xs[i] - mx) * (xs[i] - mx); }
    const b = sxy / sxx; return { a: my - b * mx, b: b, mx: mx, my: my };
  }

  const T = {};                                    // tokens, read at init and resize
  let SEQ = null, DIV = null, RED = null, REG = null, PART = null, PDIV = null;

  /* ---------- module state ---------- */
  let el, wrap, canvas, ctx, svg, defs, gAnn, gFur, gPanels, gSrc, mctx;
  let rows = [], n = 0, W = 0, H = 0, HF = 0, dpr = 1, small = false, phone = false, rBase = 1.5;   // H is the drawing height; HF = H + SRCH is the full panel height
  const targetSide = () => small && W >= 480 && W < 520 && HF < 340 && window.innerWidth >= 900;
  const tierShort = () => small && HF < 230, tierWide = () => small && W >= 480 && HF < 360, tierTablet = () => W >= 520 && W < 640 && window.innerWidth < 900;
  let px, py, bx0, by0, bw, bh, proj;
  let dly, jit, hhF, valid;
  let D = {};                                     // derived data
  let C = {};                                     // color arrays (Uint8Array 3n)
  let GEO = {}, MAP = {};
  let F = {};                                     // frames per beat {s, e}
  let NOUT = { sc: 0, stR: 0, stC: 0, fan: 0 };   // v7.2 [S10]: counties beyond the axis, per scatter
  let EXTRA = {};                                 // a second set of dots drawn with two-analyses and two-analyses-2: { frame, w: opacity per beat } (the state-price map)
  let ANN = {}, FUR = {}, LIVE = {}, SRCEL = {}, USED = [];
  let out = null, inited = false, lastKey = '', lastOp = {}, CUR_HB = 0;
  let rawData = null, paOutline = null, fanFile = null;
  const byFips = {};
  const warned = {};

  /* ---------- tokens and color scales ---------- */
  function readTokens() {
    const th = window.THEME || {};
    Object.assign(T, th);
    Object.keys(DEF).forEach(k => { T[k] = typeof th[k] === 'string' && /^#[0-9a-f]{6}$/i.test(th[k]) ? th[k] : DEF[k]; });
    // Preserve the exact old midpoints for the default palette, including a zero roll.
    const midpoint = (literal, a, b, oldA, oldB, u) =>
      a.toLowerCase() === oldA.toLowerCase() && b.toLowerCase() === oldB.toLowerCase()
        ? literal : d3.color(d3.interpolateRgb(a, b)(u)).formatHex();
    T.paddMissing = midpoint('#999999', T.bg, T.muted, DEF.bg, DEF.muted, 0.6);
    T.padd = Object.assign({}, DEF_PADD, window.PADD_COLORS || {});
    const bs = Array.isArray(th.burden) && th.burden.length === 3 ? th.burden : ['#F5E2BF', '#EA8A00', '#561D00'];      // Two inks: amber -> overprint brown
    const dv0 = Array.isArray(th.diverge) && th.diverge.length === 3 ? th.diverge : ['#5E36C9', '#EEE9E1', '#6E7486'];
    const dv = [dv0[0], midpoint('#DEDED8', T.bg, T.muted, DEF.bg, DEF.muted, 0.18), dv0[2]];           // a slightly darker midpoint so neutral dots stay visible on the page color
    SEQ = d3.scaleLinear().domain([0, 0.5, 1]).range(bs).interpolate(d3.interpolateLab).clamp(true);
    RED = d3.scaleLinear().domain([0, 0.5, 1]).range(th.red || ['#F6E7E3', '#D98477', '#862823']).interpolate(d3.interpolateLab).clamp(true);
    DIV = d3.scaleLinear().domain([-1, 0, 1]).range(dv).interpolate(d3.interpolateLab).clamp(true);
    // v7.2 [S3]: price rises (the regional EIA rise, and the simulated local rises of price-problem-2) in the violet `price` ramp, darker = bigger rise;
    // price deviations above / below an average run violet -> light neutral -> slate (priceLow); partisan direction runs dem -> light neutral -> rep.
    const pr = Array.isArray(th.price) && th.price.length === 2 ? th.price : ['#E9E2F8', '#5E36C9'], prLow = typeof th.priceLow === 'string' ? th.priceLow : '#6E7486';
    REG = d3.scaleLinear().domain([0, 1]).range(pr).interpolate(d3.interpolateLab).clamp(true);
    PDIV = d3.scaleLinear().domain([-1, 0, 1]).range([prLow, midpoint('#E4E2E8', T.bg, pr[0], DEF.bg, '#EEE8F3', 0.5), pr[1]]).interpolate(d3.interpolateLab).clamp(true);
    PART = d3.scaleLinear().domain([-1, 0, 1]).range([T.dem, midpoint('#E6E4DF', T.bg, T.rule, DEF.bg, DEF.rule, 0.5), T.rep]).interpolate(d3.interpolateLab).clamp(true);
  }
  // The map of where the estimate rests (PI, 2026-10-30): five classes of an area's share of the estimate over its share of the votes. "About equal" is a visible gray, not the color of the page.
  const WHERE_CLASSES = [
    { below: 0.5, col: 'rgb(86,101,122)', lab: 'under ½' }, { below: 0.8, col: 'rgb(140,150,165)', lab: '½ to 0.8' },
    { below: 1.25, col: 'rgb(168,162,148)', lab: 'about equal' }, { below: 2.5, col: 'rgb(160,135,220)', lab: '1.25 to 2.5' }, { below: Infinity, col: 'rgb(94,54,201)', lab: 'over 2.5' }];
  const whereCol = ratio => WHERE_CLASSES.find(c => ratio < c.below).col;
  function rgbOf(s) { const m = /rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(s); return [+m[1], +m[2], +m[3]]; }
  const seqRgb = (v, lo, hi) => rgbOf(SEQ(TMIN + (1 - TMIN) * clamp((v - lo) / (hi - lo), 0, 1)));
  const divRgb = (v, m) => rgbOf(DIV(clamp(v / m, -1, 1)));
  const seqCss = (u) => SEQ(TMIN + (1 - TMIN) * u);
  const regU = v => clamp((v - D.regLo) / (D.regHi - D.regLo), 0, 1);
  const regCss = v => REG(regU(v));

  /* ---------- init ---------- */
  function init(container, data) {
    el = container;
    if (!data || !data.counties || !data.eia) { console.error('[dots] data missing'); return; }
    rawData = data;
    readTokens();
    injectStyle();
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    wrap = document.createElement('div'); wrap.className = 'dots-wrap'; el.appendChild(wrap);
    canvas = document.createElement('canvas'); canvas.className = 'dots-canvas'; canvas.setAttribute('aria-hidden', 'true'); wrap.appendChild(canvas);
    ctx = canvas.getContext('2d');
    svg = document.createElementNS(NS, 'svg'); svg.setAttribute('class', 'dots-svg'); svg.setAttribute('role', 'img'); wrap.appendChild(svg);
    mctx = document.createElement('canvas').getContext('2d');
    prepData(data);
    inited = true;
    W = el.clientWidth || 800; HF = el.clientHeight || 700;
    rebuild();
    // These two local assets are used only by this module, so the frozen shell need not load them.
    Promise.all([
      fetch('data/pa_outline.json').then(r => { if (!r.ok) throw new Error('PA outline ' + r.status); return r.json(); }),
      fetch('data/fan.json').then(r => { if (!r.ok) throw new Error('fan ' + r.status); return r.json(); })
    ]).then(([outline, fan]) => {
      paOutline = outline; fanFile = fan;
      prepFan(data); prepV8(data); rebuild(); rerender();
    }).catch(e => console.error('[dots] local visual data', e));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (inited) { rebuild(); rerender(); } });
    // v8: delete aliases for beats built natively so main.js passes the v8 id
    if (window.V8_ALIAS) { ['races', 'the-question', 'within-exposure', 'within-exposure-2', 'within-price', 'nearby', 'unusual', 'group-votes', 'all-groups', 'adj-oil', 'adj-prior'].forEach(k => delete window.V8_ALIAS[k]); }
  }

  function injectStyle() {
    if (document.getElementById('dots-style')) return;
    const s = document.createElement('style'); s.id = 'dots-style';
    s.textContent =
      '.dots-wrap{position:absolute;inset:0;overflow:hidden;pointer-events:none;font-family:' + FONT + '}' +
      '.dots-canvas,.dots-svg{position:absolute;left:0;top:0;width:100%;height:100%}' +
      '.dots-svg{font-family:' + FONT + ';font-variant-numeric:tabular-nums}' +
      '.dots-svg text{font-family:' + FONT + '}';
    document.head.appendChild(s);
  }

  /* ---------- data prep ---------- */
  function prepData(data) {
    rows = data.counties.rows; n = rows.length;
    const eia = data.eia, sim = data.sim || {};
    proj = d3.geoAlbersUsa().scale(1070).translate([0, 0]);
    px = new Float32Array(n); py = new Float32Array(n);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    rows.forEach((r, i) => {
      byFips[r.fips] = i;
      const p = proj([r.lon, r.lat]) || [0, 0];
      px[i] = p[0]; py[i] = p[1];
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    });
    bx0 = x0; by0 = y0; bw = x1 - x0; bh = y1 - y0;
    const rnd = mulberry(7); dly = new Float32Array(n); jit = new Float32Array(n); hhF = new Float32Array(n); valid = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      dly[i] = rnd(); jit[i] = rnd() - 0.5;
      hhF[i] = clamp(0.6 + 0.4 * Math.sqrt(rows[i].hh / 20000), 0.6, 2.2);
      valid[i] = rows[i].e != null ? 1 : 0;
    }

    // Regional rises (real, EIA). Fallback: latest week minus the week of 2024-11-04.
    D.rise26 = eia.rise && eia.rise['2026'] ? eia.rise['2026'] : {};
    D.rise22 = eia.rise && eia.rise['2022'] ? eia.rise['2022'] : {};
    if (!Object.keys(D.rise26).length) {
      Object.keys(eia.padd).forEach(k => {
        const a = eia.padd[k]; const base = a.filter(d => d.date <= '2024-11-04').pop();
        if (base) D.rise26[k] = a[a.length - 1].p - base.p;
      });
    }
    // Window-based regional rises (3 weeks before Election Day 2024 to the open 2026 window; eia.json rise_window) color the price-problem map and its labels.
    D.riseReg = {}; { const rw = eia.rise_window || {}; Object.keys(DEF_PADD).forEach(k => { D.riseReg[k] = rw[k] && Number.isFinite(rw[k].rise) ? rw[k].rise : D.rise26[k]; }); }
    { const v = Object.keys(DEF_PADD).map(k => D.riseReg[k]).filter(Number.isFinite); D.regLo = Math.floor(Math.min.apply(null, v) * 10) / 10; D.regHi = Math.ceil(Math.max.apply(null, v) * 10) / 10; if (!(D.regHi > D.regLo)) { D.regLo = 1; D.regHi = 1.7; } }
    D.e = new Float32Array(n); D.b26 = new Float32Array(n); D.b22 = new Float32Array(n); D.sw22 = new Float32Array(n);
    D.r20 = new Float32Array(n); D.p24 = new Float32Array(n); D.oil = new Float32Array(n); D.shock = new Float32Array(n);
    D.race = new Array(n); D.in44 = new Uint8Array(n); D.oilM = new Float32Array(n);
    const shockMap = sim.state_shock || {}, metroMap = sim.metro_shock || {};
    D.mshock = new Float32Array(n); D.hasM = new Uint8Array(n);       // illustrative local rise vs the state average ($/gal), and whether the county's metro has local prices
    rows.forEach((r, i) => {
      D.e[i] = r.e != null ? r.e : NaN;
      D.b26[i] = r.b26 != null ? r.b26 : (r.e != null ? r.e * (D.rise26[r.padd] || 1.26) : NaN);
      D.b22[i] = r.b22 != null ? r.b22 : (r.e != null ? r.e * (D.rise22[r.padd] || 1.6) : NaN);
      let s22 = r.sw22 != null ? r.sw22 : (r.race22 === undefined && r.sw ? (r.sw.s22 != null ? r.sw.s22 : r.sw.g22) : null);
      D.sw22[i] = s22 != null ? s22 : NaN;
      D.race[i] = s22 != null ? (r.race22 || (r.sw.s22 != null ? 'S-' + r.st : 'G-' + r.st)) : null;
      D.p24[i] = r.sw && r.sw.p24 != null ? r.sw.p24 : NaN;
      D.oil[i] = r.oil != null ? r.oil : 0;
      D.oilM[i] = r.oil_m != null ? r.oil_m : 0;       // v9.4: oil and gas share of jobs in the county's local market (website/tools/build_site_oil_markets.py)
      D.r20[i] = r.r20 != null ? r.r20 : NaN;
      D.shock[i] = shockMap[r.st] || 0;
      D.in44[i] = STATES44.indexOf(r.st) >= 0 ? 1 : 0;
      if (r.cbsa && metroMap[r.cbsa] != null) { D.mshock[i] = metroMap[r.cbsa]; D.hasM[i] = 1; }
    });
    D.oilThr = quant(D.oil, 1) > 1.5 ? 2 : 0.02;       // fractions in the data file; tolerate percent

    // Color domains.
    D.eLo = quant(D.e, 0.02); D.eHi = quant(D.e, 0.98);
    D.b26Lo = quant(D.b26, 0.02); D.b26Hi = quant(D.b26, 0.98);
    D.b22Lo = quant(D.b22, 0.02); D.b22Hi = quant(D.b22, 0.98);
    D.p24M = Math.max(Math.abs(quant(D.p24, 0.02)), Math.abs(quant(D.p24, 0.98)));
    D.shockM = 0.5;

    // States and the Midwest.
    D.byState = {}; rows.forEach((r, i) => { (D.byState[r.st] = D.byState[r.st] || []).push(i); });
    D.mwIds = []; for (let i = 0; i < n; i++) if (valid[i] && rows[i].padd === '2') D.mwIds.push(i);

    prepPA(data);
    prepPA2();
    prepMarkets(data);
    prepLocal();
    buildColors();
    prepRaces(data);
    prepFan(data);
    prepV8(data);
    prepKey(data);
    prepSlices(data);
    prepGeoPoints(data);
    prepBorders();
    prepCmp();
  }

  function buildColors() {
    const mk = () => new Uint8Array(3 * n);
    C.paE = mk(); C.e = mk(); C.b26 = mk(); C.b22 = mk(); C.p24 = mk(); C.shock = mk(); C.pad = mk(); C.calm = mk(); C.pale = mk(); C.acc = mk(); C.paR = mk();
    C.reg = mk(); C.loc2 = mk(); C.kind = mk(); C.mdev = mk(); C.randB = mk(); C.grey = mk(); C.perm = mk(); C.where = mk();
    const acc = hexRgb(T.accent), calm = hexRgb(T.calm || '#8D9AA3'), pale = hexRgb(T.pale), grey = hexRgb(T.greyBar), kCol = KIND_OF.map(k => hexRgb(KIND[k]));
    const eligible = []; for (let i = 0; i < n; i++) if (valid[i] && D.in44[i] && Number.isFinite(D.b26[i])) eligible.push(i);
    // v9.4 (ideal-shuffle): a fixed-seed permutation of the eligible counties; county eligible[k] receives the extra fuel cost of county shufSrc[k] (no county keeps its own)
    const shufSrc = eligible.slice(), rndPerm = mulberry(20261103);
    for (let k = shufSrc.length - 1; k > 0; k--) { const j = Math.floor(rndPerm() * (k + 1)), v = shufSrc[k]; shufSrc[k] = shufSrc[j]; shufSrc[j] = v; }
    for (let k = 0; k < shufSrc.length; k++) if (shufSrc[k] === eligible[k]) { const j = (k + 1) % shufSrc.length, v = shufSrc[k]; shufSrc[k] = shufSrc[j]; shufSrc[j] = v; }
    D.shufE = eligible; D.shufSrc = shufSrc;
    const permAt = new Float32Array(n); eligible.forEach((i, k) => { permAt[i] = D.b26[shufSrc[k]]; });
    // where.json: how much an area counts in the estimate compared with its share of the votes. An area is a supply region crossed with a kind of market; no county has a value of its own.
    const whereOf = {}, WK = ['metropolitan', 'micropolitan', 'rural'];
    ((rawData.where && rawData.where.areas) || []).forEach(a => a.kinds.forEach(k => { whereOf[a.region + '|' + k] = a.ratio; }));
    for (let i = 0; i < n; i++) {
      const set = (A, c) => { A[3 * i] = c[0]; A[3 * i + 1] = c[1]; A[3 * i + 2] = c[2]; };
      const ok = valid[i], r = rows[i];
      set(C.e, ok ? seqRgb(D.e[i], D.eLo, D.eHi) : pale);
      set(C.b26, ok ? seqRgb(D.b26[i], D.b26Lo, D.b26Hi) : pale);
      set(C.b22, ok ? seqRgb(D.b22[i], D.b22Lo, D.b22Hi) : pale);
      set(C.p24, Number.isFinite(D.p24[i]) ? rgbOf(PART(clamp(D.p24[i] / D.p24M, -1, 1))) : pale);
      set(C.shock, divRgb(D.shock[i], D.shockM));
      set(C.paE, ok ? seqRgb(D.e[i], D.paELo, D.paEHi) : pale);
      set(C.pad, hexRgb(T.padd[r.padd] || T.paddMissing));
      set(C.paR, D.paR && Number.isFinite(D.r20[i]) && r.st === 'PA' ? rgbOf(RED(clamp((D.r20[i] - D.paR.lo) / (D.paR.hi - D.paR.lo), 0, 1))) : pale);
      set(C.reg, Number.isFinite(D.riseReg[r.padd]) ? rgbOf(regCss(D.riseReg[r.padd])) : pale);
      set(C.loc2, r.st === 'PA' ? rgbOf(regCss(D.paBase + (D.locDev[i] || 0))) : pale);
      set(C.kind, D.kind && D.kind[i] >= 0 ? kCol[D.kind[i]] : pale);
      set(C.mdev, D.mdev ? rgbOf(PDIV(clamp(D.mdev[i] / 0.12, -1, 1))) : pale);
      const wr = ok && D.in44[i] ? whereOf[r.padd + '|' + WK[D.kind[i]]] : null;
      set(C.where, wr ? rgbOf(whereCol(wr)) : pale);
      set(C.calm, calm); set(C.pale, pale); set(C.grey, grey); set(C.acc, acc);
      set(C.perm, valid[i] && D.in44[i] && Number.isFinite(D.b26[i]) ? seqRgb(permAt[i], D.b26Lo, D.b26Hi) : pale);
      // v8 idea-ideal: a random fuel-burden shade drawn from the real distribution (fixed seed per county via dly)
      set(C.randB, ok ? seqRgb(D.b26Lo + dly[i] * (D.b26Hi - D.b26Lo), D.b26Lo, D.b26Hi) : pale);
    }
    D.paFlat = rgbOf(regCss(D.paBase));
  }

  // Local markets (v7, data/markets.json: geography only, no prices): each county's market, its kind (0 metro, 1 micro, 2 rural), its group and name.
  // Pennsylvania's markets are kept as lists of indexes into D.pa (for the layouts of nearby-markets and assumption). Also, for what-is-left (v7), a simulated
  // unusual rise for every market (cents vs its group's average, $/gal; about half within 4 cents): not data, tagged on screen.
  function prepMarkets(data) {
    const mk = data.markets && data.markets.rows, KI = { metro: 0, micro: 1, rural: 2 };
    D.mkt = new Array(n).fill(null); D.kind = new Int8Array(n).fill(-1); D.blk = new Array(n).fill(null); D.mname = new Array(n).fill('');
    D.hasMkts = !!(mk && mk.length);
    if (D.hasMkts) mk.forEach(r => { const i = byFips[r.fips]; if (i == null) return; D.mkt[i] = r.mkt; D.kind[i] = KI[r.kind] != null ? KI[r.kind] : 2; D.blk[i] = r.blk; D.mname[i] = r.name || ''; });
    else for (let i = 0; i < n; i++) { const r = rows[i]; D.mkt[i] = r.cbsa ? 'C' + r.cbsa : 'S' + r.fips; D.kind[i] = r.cbsa ? (MICRO[r.cbsa] ? 1 : 0) : 2; D.mname[i] = r.cbsa_name || ''; }
    const pm = {}; D.paMk = [];
    D.pa.forEach((i, j) => { const k = D.mkt[i]; if (!pm[k]) { pm[k] = { id: k, kind: D.kind[i], blk: D.blk[i], name: D.mname[i], js: [] }; D.paMk.push(pm[k]); } pm[k].js.push(j); });
    D.paMkOf = pm;
    const rnd = mulberry(20261023), mdev = {};
    D.mdev = new Float32Array(n);
    for (let i = 0; i < n; i++) { const k = D.mkt[i] || ('S' + rows[i].fips); if (mdev[k] == null) mdev[k] = clamp(0.06 * gauss(rnd), -0.16, 0.16); D.mdev[i] = mdev[k]; }
  }

  // Illustrative local price rises for Pennsylvania (price-problem-2, v7): one rise per market, the sum of a smooth gradient from one side of the state to the other
  // (by the market's position along a fixed direction) and a small premium for metropolitan markets over the countryside, plus a little noise. Not data; tagged on screen.
  function prepLocal() {
    D.paBase = Number.isFinite(D.riseReg['1B']) ? D.riseReg['1B'] : 1.21;
    D.locDev = new Float32Array(n); D.locDevHi = 0; D.locDevLo = 0;
    const ang = 0.35, ux = Math.cos(ang), uy = Math.sin(ang), rnd = mulberry(4207);
    let lo = 1e9, hi = -1e9;
    const pos = D.paMk.map(m => { const v = d3.mean(m.js, j => px[D.pa[j]] * ux + py[D.pa[j]] * uy); lo = Math.min(lo, v); hi = Math.max(hi, v); return v; });
    const dev = D.paMk.map((m, k) => 0.17 * ((pos[k] - lo) / (hi - lo || 1) - 0.5) + (m.kind === 0 ? 0.14 : 0) + 0.02 * gauss(rnd));
    const mu = d3.mean(dev);
    D.paMk.forEach((m, k) => { m.dev = dev[k] - mu; m.js.forEach(j => { const i = D.pa[j]; D.locDev[i] = m.dev; D.locDevHi = Math.max(D.locDevHi, m.dev); D.locDevLo = Math.min(D.locDevLo, m.dev); }); });
  }

  // Races: one strip per 2022 statewide race (the county's Senate race, else its governor race).
  function prepRaces(data) {
    const m = new Map();
    for (let i = 0; i < n; i++) if (D.race[i] && Number.isFinite(D.sw22[i])) { if (!m.has(D.race[i])) m.set(D.race[i], []); m.get(D.race[i]).push(i); }
    const groups = [];
    m.forEach((ids, id) => {
      let sw = 0, s = 0; ids.forEach(i => { const w = rows[i].hh; sw += w; s += w * D.sw22[i]; });
      groups.push({ id: id, ids: ids, mean: s / sw });
    });
    groups.sort((a, b) => a.mean - b.mean);
    D.rk = new Int16Array(n).fill(-1); D.rmean = new Float32Array(n);
    groups.forEach((g, k) => { g.ids.forEach(i => { D.rk[i] = k; D.rmean[i] = g.mean; }); });
    D.races = groups; D.nR = groups.length;
    // Share of the variance that lies between races (household weighted), computed on the strips as drawn (one race per county).
    let sw = 0, sy = 0; for (let i = 0; i < n; i++) if (D.rk[i] >= 0) { sw += rows[i].hh; sy += rows[i].hh * D.sw22[i]; }
    const gm = sy / sw; let tot = 0, bet = 0;
    for (let i = 0; i < n; i++) if (D.rk[i] >= 0) { const w = rows[i].hh; tot += w * (D.sw22[i] - gm) ** 2; bet += w * (D.rmean[i] - gm) ** 2; }
    D.between = bet / tot;
    // The drawn strips use one race per county; shares.json instead registers household-weighted county-by-race rows, which match the reader text.
    const registeredShare = data && data.shares && data.shares.between_race_share;
    D.betweenShare = Number.isFinite(registeredShare) ? registeredShare : null;
    // The line of simplest-slope: unweighted least squares of the 2022 shift on the 2022 burden, over the counties drawn in the scatter.
    const ids = []; for (let i = 0; i < n; i++) if (D.rk[i] >= 0 && Number.isFinite(D.b22[i])) ids.push(i);
    D.fit22 = wfit(ids.map(i => D.b22[i]), ids.map(i => D.sw22[i]));
    D.ids22 = ids;
  }

  function prepPA(data) {
    D.pa = []; for (let i = 0; i < n; i++) if (rows[i].st === 'PA' && valid[i] && rows[i].sw && rows[i].sw.s22 != null) D.pa.push(i);
    // Scatter of the 2022 shift on the 2022 burden (every PA county has the state's regional rise, so burden follows exposure).
    D.paRise = D.rise22[rows[D.pa[0]].padd] || 1.56;
    D.paFitB = wfit(D.pa.map(i => D.b22[i]), D.pa.map(i => rows[i].sw.s22));
    D.paSlope = {};
    const sl = data.shares && data.shares.pa_slopes;
    ['p16', 'p20', 'p24', 's18', 's22'].forEach(k => {
      const ids = D.pa.filter(i => rows[i].sw[k] != null), f = wfit(ids.map(i => rows[i].e), ids.map(i => rows[i].sw[k]));
      D.paSlope[k] = (sl && sl[k] != null ? sl[k] : f.b) / D.paRise;       // vote points per point of burden: the slope against exposure divided by the 2022 regional rise
    });
    const pe = D.pa.map(i => D.e[i]); D.paELo = quant(pe, 0.03); D.paEHi = quant(pe, 0.97);
  }

  // v8 fan: real regional EIA rise plus illustrative market deviations; the retained part is exposure times its market deviation.
  function prepFan(data) {
    const rise = Object.keys(D.rise26).length ? D.rise26 : { '1A': 1.6, '1B': 1.56, '1C': 1.31, '2': 1.71, '3': 1.38, '4': 1.56, '5': 2.27 };
    const marketDev = {};
    if (fanFile && Array.isArray(fanFile.rows)) fanFile.rows.forEach(r => { marketDev[r.mkt] = r.dev; });
    D.dE = new Float32Array(n); D.yRaw = new Float32Array(n); D.yRec = new Float32Array(n); D.fanOk = new Uint8Array(n);
    Object.keys(D.byState).forEach(st => {
      const ids = D.byState[st].filter(i => valid[i]);
      const wsum = ids.reduce((a, i) => a + rows[i].hh, 0) || 1;
      const mean = ids.reduce((a, i) => a + rows[i].hh * rows[i].e, 0) / wsum;
      // The whole rise is measured from the state average. A market absent from fan.json has no group contrast and receives zero unusual rise.
      const rOf = i => rise[rows[i].padd] || 1.5;
      const devOf = i => Number.isFinite(marketDev[D.mkt[i]]) ? marketDev[D.mkt[i]] : fanFile ? 0 : D.mdev[i];
      const mRaw = ids.reduce((a, i) => a + rows[i].hh * rows[i].e * (rOf(i) + devOf(i)), 0) / wsum;
      ids.forEach(i => {
        const e = rows[i].e, d = devOf(i);
        D.dE[i] = e - mean; D.yRaw[i] = e * (rOf(i) + d) - mRaw; D.yRec[i] = e * d; D.fanOk[i] = 1;
      });
    });
    { const ids = []; for (let i = 0; i < n; i++) if (D.fanOk[i]) ids.push(i);
      D.fanFit = { raw: wfit(ids.map(i => D.dE[i]), ids.map(i => D.yRaw[i])), rec: wfit(ids.map(i => D.dE[i]), ids.map(i => D.yRec[i])) }; }
    D.recX = [quant(D.dE, 0.01) - 0.05, quant(D.dE, 0.99) + 0.05];      // v7.2 [S10]
    const yy = Array.from(D.yRaw).filter((v, i) => D.fanOk[i]);
    D.recY = [quant(yy, 0.01) - 0.1, quant(yy, 0.99) + 0.1];
  }

  function prepV8(data) {
    D.sw16 = new Float32Array(n); D.cB16 = new Float32Array(n); D.cS16 = new Float32Array(n);
    D.fit16Ids = [];
    for (let i = 0; i < n; i++) {
      D.sw16[i] = rows[i].sw && Number.isFinite(rows[i].sw.p16) ? rows[i].sw.p16 : NaN;
      if (valid[i] && Number.isFinite(D.sw16[i]) && Number.isFinite(D.b26[i])) D.fit16Ids.push(i);
    }
    const I = D.fit16Ids;
    D.fit16 = wfit(I.map(i => D.b26[i]), I.map(i => D.sw16[i]), I.map(i => rows[i].hh));
    Object.keys(D.byState).forEach(st => {
      const ids = D.byState[st].filter(i => Number.isFinite(D.sw16[i]) && valid[i]);
      const wt = ids.reduce((s, i) => s + rows[i].hh, 0) || 1;
      const mb = ids.reduce((s, i) => s + rows[i].hh * D.b26[i], 0) / wt;
      const ms = ids.reduce((s, i) => s + rows[i].hh * D.sw16[i], 0) / wt;
      ids.forEach(i => { D.cB16[i] = D.b26[i] - mb; D.cS16[i] = D.sw16[i] - ms; });
    });
    D.fit16Within = wfit(I.map(i => D.cB16[i]), I.map(i => D.cS16[i]), I.map(i => rows[i].hh));
    const sl = data.shares && data.shares.pa_slopes || {};
    D.paLines = ['p16', 's18', 'p20', 's22', 'p24'].map((key, j) => {
      const ids = D.pa.filter(i => rows[i].sw && Number.isFinite(rows[i].sw[key]));
      const fit = wfit(ids.map(i => D.e[i]), ids.map(i => rows[i].sw[key]));
      const b = Number.isFinite(sl[key]) ? sl[key] : fit.b;
      return { key: key, b: b, a: fit.my - b * fit.mx, label: ['2016 President', '2018 Senate', '2020 President', '2022 Senate', '2024 President'][j] };
    });
    const rnd = mulberry(20261024);
    D.voteSim = new Float32Array(n);
    for (let i = 0; i < n; i++) D.voteSim[i] = 3 * D.yRec[i] + 2 * gauss(rnd);
    Object.keys(D.byState).forEach(st => {
      const ids = D.byState[st].filter(i => D.fanOk[i]);
      const sw = ids.reduce((s, i) => s + rows[i].hh, 0) || 1;
      const mean = ids.reduce((s, i) => s + rows[i].hh * D.voteSim[i], 0) / sw;
      ids.forEach(i => { D.voteSim[i] -= mean; });
    });
    // v9.3 (simple): MOCK vote shifts against the president's party for the line-up, tagged "Illustrative" on screen: a gentle positive slope on the extra fuel cost, with
    // scatter about as wide as real county vote shifts (points). Nothing here comes from real votes or from the project's estimates.
    {
      const r2 = mulberry(20261026), ids = [];
      D.mockSw = new Float32Array(n);
      for (let i = 0; i < n; i++) if (valid[i] && D.in44[i] && Number.isFinite(D.b26[i])) ids.push(i);
      const mb = ids.reduce((s, i) => s + D.b26[i], 0) / Math.max(1, ids.length);
      for (let i = 0; i < n; i++) D.mockSw[i] = valid[i] && D.in44[i] && Number.isFinite(D.b26[i]) ? 1 + 2.6 * (D.b26[i] - mb) + 3.3 * gauss(r2) : NaN;
      D.mockIds = ids;
    }
  }

  // The gaps: two neighboring states of one region stand in for Place A and Place B (never named). Exposure is real; vote shifts are simulated.
  // The pair is the one whose exposure distributions are most alike (the text: "with similar mixes of low- and high-exposure counties"), among pairs
  // whose simulated price rises differ; both places are split by the same exposure cut-offs (the lowest and highest thirds of the two together).
  // Place B also gets a "same price rise" version: its high-exposure group lowered so that its gap equals Place A's.
  function prepKey(data) {
    const sim = data.sim || {}, sh = sim.state_shock || {};
    const pairs = [['KY', 'TN'], ['KY', 'IN'], ['KY', 'OH'], ['KY', 'IL'], ['KY', 'MO'], ['MO', 'IL'], ['KS', 'NE'], ['IA', 'NE'], ['OH', 'MI'], ['MO', 'KS'], ['KS', 'OK'], ['IA', 'MN'], ['IL', 'WI'], ['WI', 'MN'], ['IN', 'IL']];
    const eOf = st => (D.byState[st] || []).filter(i => valid[i]).map(i => rows[i].e);
    let best = null;
    pairs.forEach(p => {
      let a = p[0], b = p[1]; if (sh[a] < sh[b]) { const t = a; a = b; b = t; }     // a = bigger rise
      if (!(sh[a] > 0.08 && sh[b] < -0.08)) return;
      if (!D.byState[a] || !D.byState[b] || D.byState[a].length < 40 || D.byState[b].length < 40) return;
      const ea = eOf(a), eb = eOf(b), dist = Math.max.apply(null, [1 / 3, 0.5, 2 / 3].map(q => Math.abs(quant(ea, q) - quant(eb, q)))), gap = sh[a] - sh[b];
      if (!best || dist < best.dist - 1e-9 || (Math.abs(dist - best.dist) < 1e-9 && gap > best.gap)) best = { big: a, small: b, gap: gap, dist: dist };
    });
    if (!best) best = { big: 'KY', small: 'TN', gap: 0.6 };
    const pooled = eOf(best.small).concat(eOf(best.big)), cutLo = quant(pooled, 1 / 3), cutHi = quant(pooled, 2 / 3);
    const rnd = mulberry(11), TREND = 2.0, BETA = 3.0, SD = 1.3, cells = {};
    D.keyCut = [cutLo, cutHi];
    [['A', best.small], ['B', best.big]].forEach(([lab, st]) => {
      const ids = (D.byState[st] || []).filter(i => valid[i]).sort((i, j) => rows[i].e - rows[j].e);
      const low = ids.filter(i => rows[i].e <= cutLo), high = ids.filter(i => rows[i].e >= cutHi), shock = sh[st] || 0, swing = {};
      ids.forEach(i => { swing[i] = TREND * (rows[i].e - 1.4) + BETA * rows[i].e * shock + SD * gauss(rnd); });
      const mean = arr => arr.reduce((s, i) => s + swing[i], 0) / arr.length;
      { const d0 = KGAP[lab] - (mean(high) - mean(low)); high.forEach(i => { swing[i] += d0; }); }          // the means of the two groups differ by exactly the gap the text states
      cells[lab] = { st: st, low: low, high: high, swing: swing, mLow: mean(low), mHigh: mean(high) };
      cells[lab].gap = cells[lab].mHigh - cells[lab].mLow;
    });
    const dd = KGAP.B - KGAP.A, B = cells.B; B.swingH = {};
    B.low.forEach(i => { B.swingH[i] = B.swing[i]; }); B.high.forEach(i => { B.swingH[i] = B.swing[i] - dd; });
    B.mHighH = B.mHigh - dd;
    D.key = { A: cells.A, B: cells.B, gog: cells.B.gap - cells.A.gap };
  }

  // Two slices: simulated county price rises (cents per gallon) built from three mutually orthogonal parts, a region part, a state part within the region and a
  // metro part within the state (zero outside covered metro areas), scaled so that Cov(part, total) / Var(total), household weighted, equals the shares in
  // shares.json kept_2026.price_variance_shares. The dots are the real counties, so the colors follow the real regions; nothing here is a real price.
  function prepSlices(data) {
    const K = data.shares && data.shares.kept_2026, sh = K && K.price_variance_shares;
    D.sl = null; if (!sh || !(sh.regional > 0)) return;
    const rnd = mulberry(20261022), REGS = ['1A', '1B', '1C', '2', '3', '4', '5'];
    const r = new Float32Array(n), st = new Float32Array(n), m = new Float32Array(n), rv = {}, sv = {}, mv = {}, ids = [];
    for (let i = 0; i < n; i++) {
      if (!D.fanOk[i]) continue;
      const rw = rows[i]; ids.push(i);
      if (rv[rw.padd] == null) rv[rw.padd] = gauss(rnd);
      if (sv[rw.st] == null) sv[rw.st] = gauss(rnd);
      r[i] = rv[rw.padd]; st[i] = sv[rw.st];
      if (rw.metro && rw.cbsa) { if (mv[rw.cbsa] == null) mv[rw.cbsa] = gauss(rnd); m[i] = mv[rw.cbsa]; }
    }
    const w = i => rows[i].hh;
    const centre = (a, key, only) => {
      const sum = {}, ws = {};
      ids.forEach(i => { if (only && !only(i)) return; const k = key(i); sum[k] = (sum[k] || 0) + w(i) * a[i]; ws[k] = (ws[k] || 0) + w(i); });
      ids.forEach(i => { if (only && !only(i)) return; a[i] -= sum[key(i)] / ws[key(i)]; });
    };
    centre(r, () => 0); centre(st, i => rows[i].padd); centre(m, i => rows[i].st, i => rows[i].metro && rows[i].cbsa);
    const vr = a => { let sw = 0, sq = 0; ids.forEach(i => { sw += w(i); sq += w(i) * a[i] * a[i]; }); return sq / sw; };
    const V = 144, f = { r: Math.sqrt(sh.regional * V / (vr(r) || 1)), s: Math.sqrt(sh.state * V / (vr(st) || 1)), m: Math.sqrt(sh.metro * V / (vr(m) || 1)) };
    const v0 = new Float32Array(n), v1 = new Float32Array(n), v2 = new Float32Array(n), ri = new Uint8Array(n), j = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    let mx = 0;
    ids.forEach(i => {
      const a = r[i] * f.r, b = st[i] * f.s, c = m[i] * f.m;
      v0[i] = a + b + c; v1[i] = b + c; v2[i] = c; ri[i] = Math.max(0, REGS.indexOf(rows[i].padd));
      mx = Math.max(mx, Math.abs(v0[i]));
      for (let k = 0; k < 3; k++) j[k][i] = rnd();
    });
    // region averages (the black ticks of the first strip): household weighted mean of the region part
    const ra = {}; ids.forEach(i => { const k = ri[i]; const e = ra[k] || (ra[k] = [0, 0]); e[0] += w(i) * r[i] * f.r; e[1] += w(i); });
    D.sl = { sh: sh, v: [v0, v1, v2], ri: ri, j: j, max: mx, regMean: Object.keys(ra).map(k => ({ ri: +k, v: ra[k][0] / ra[k][1] })) };
  }

  function prepGeoPoints(data) {
    D.places = { delta: [-89.7, 31.2], permian: [-102.1, 32.0] };
    const hol = {}; ((data.holidays && data.holidays.rows) || []).forEach(r => {
      const h = hol[r.st] || (hol[r.st] = { st: r.st, start: r.start, end: r.end, cents: r.cents, full: r.full });
      if (r.start < h.start) h.start = r.start; if (r.end > h.end) h.end = r.end; if (r.cents > h.cents && r.full) h.cents = r.cents;
    });
    D.hol = hol;
  }

  function wcorr(xs, ys, ws) {
    let sw = 0, mx = 0, my = 0; const m = xs.length;
    for (let i = 0; i < m; i++) { sw += ws[i]; mx += ws[i] * xs[i]; my += ws[i] * ys[i]; }
    mx /= sw; my /= sw;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < m; i++) { sxy += ws[i] * (xs[i] - mx) * (ys[i] - my); sxx += ws[i] * (xs[i] - mx) ** 2; syy += ws[i] * (ys[i] - my) ** 2; }
    return sxy / Math.sqrt(sxx * syy);
  }

  // Pennsylvania extras: 2020 Republican share (for the exposure-problem-2 colors), its link to exposure, and the metro-area groups.
  function prepPA2() {
    const ids = D.pa.filter(i => Number.isFinite(D.r20[i]));
    D.paR = { lo: quant(ids.map(i => D.r20[i]), 0.03), hi: quant(ids.map(i => D.r20[i]), 0.97) };
    D.paCorr = ids.length > 3 ? wcorr(ids.map(i => D.e[i]), ids.map(i => D.r20[i]), ids.map(i => rows[i].hh)) : NaN;   // household weighted
    D.metroGroups = {};
    D.pa.forEach((i, j) => {
      const c = rows[i].cbsa; if (!c) return;
      const grp = D.metroGroups[c] || (D.metroGroups[c] = { code: c, name: rows[i].cbsa_name || c, js: [], micro: !!MICRO[c] });
      grp.js.push(j);
    });
  }

  // State and region borders from the county dots: Voronoi cells of the county centroids, keeping the edges between cells of different states
  // (only where the edge lies close to both counties, so no lines run out to sea). Coordinates are in the unscaled projection.
  function prepBorders() {
    D.stList = Object.keys(D.byState).sort(); D.stIdx = {}; D.stList.forEach((s, k) => { D.stIdx[s] = k; });
    D.stC = {}; D.stList.forEach(s => { const ids = D.byState[s]; D.stC[s] = [d3.mean(ids, i => px[i]), d3.mean(ids, i => py[i])]; });
    const pts = []; for (let i = 0; i < n; i++) pts.push([px[i], py[i]]);
    const del = d3.Delaunay.from(pts), vor = del.voronoi([bx0 - 60, by0 - 60, bx0 + bw + 60, by0 + bh + 60]);
    const rad = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const nb = Array.from(del.neighbors(i)).map(j => Math.hypot(px[i] - px[j], py[i] - py[j])).sort((a, b) => a - b).slice(0, 4);
      rad[i] = nb.length ? d3.mean(nb) : 10;
    }
    const edges = new Map();
    for (let i = 0; i < n; i++) {
      const poly = vor.cellPolygon(i); if (!poly) continue;
      for (let k = 0; k < poly.length - 1; k++) {
        const a = poly[k], b = poly[k + 1];
        const ka = Math.round(a[0] * 8) + ',' + Math.round(a[1] * 8), kb = Math.round(b[0] * 8) + ',' + Math.round(b[1] * 8), key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        const e = edges.get(key); if (e) e.j = i; else edges.set(key, { i: i, j: -1, a: a, b: b });
      }
    }
    const X1 = [], Y1 = [], X2 = [], Y2 = [], SA = [], SB = [], PD = [];
    edges.forEach(e => {
      if (e.j < 0) return;
      const i = e.i, j = e.j; if (rows[i].st === rows[j].st) return;
      const a = e.a, b = e.b, L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(L / 2)), rr = 0.85 * Math.max(rad[i], rad[j]);
      let start = null, last = null;
      const push = (p, q) => { X1.push(p[0]); Y1.push(p[1]); X2.push(q[0]); Y2.push(q[1]); SA.push(D.stIdx[rows[i].st]); SB.push(D.stIdx[rows[j].st]); PD.push(rows[i].padd !== rows[j].padd ? 1 : 0); };
      for (let s = 0; s <= m; s++) {
        const x = a[0] + (b[0] - a[0]) * s / m, y = a[1] + (b[1] - a[1]) * s / m, ok = Math.hypot(x - px[i], y - py[i]) <= rr && Math.hypot(x - px[j], y - py[j]) <= rr;
        if (ok) { if (!start) start = [x, y]; last = [x, y]; } else if (start) { push(start, last); start = null; }
      }
      if (start) push(start, last);
    });
    D.bord = { x1: Float32Array.from(X1), y1: Float32Array.from(Y1), x2: Float32Array.from(X2), y2: Float32Array.from(Y2), sa: Uint8Array.from(SA), sb: Uint8Array.from(SB), pd: Uint8Array.from(PD), n: X1.length };
  }
  // SVG path of the borders for a placement m = { k, ox, oy } of the unscaled projection (minus x0, y0). keep(sa, sb, pd) filters the segments.
  function borderPath(m, keep) {
    const B = D.bord, k = m.k, ox = m.ox - (m.x0 == null ? bx0 : m.x0) * k, oy = m.oy - (m.y0 == null ? by0 : m.y0) * k, parts = [];
    for (let s = 0; s < B.n; s++) {
      if (keep && !keep(D.stList[B.sa[s]], D.stList[B.sb[s]], B.pd[s])) continue;
      parts.push('M' + (ox + B.x1[s] * k).toFixed(1) + ',' + (oy + B.y1[s] * k).toFixed(1) + 'L' + (ox + B.x2[s] * k).toFixed(1) + ',' + (oy + B.y2[s] * k).toFixed(1));
    }
    return parts.join('');
  }

  /* ---------- frames ---------- */
  function nf() { return { x: new Float32Array(n), y: new Float32Array(n), r: new Float32Array(n), cr: new Float32Array(n), cg: new Float32Array(n), cb: new Float32Array(n), a: new Float32Array(n), z: new Uint8Array(n), o: new Uint8Array(n) }; }   // o (v7.2 [S10]): 1 = drawn as a small open marker (a county beyond the axis)
  function cpf(f) { const g = nf(); Object.keys(g).forEach(k => g[k].set(f[k])); return g; }
  function setCol(f, i, A) { f.cr[i] = A[3 * i]; f.cg[i] = A[3 * i + 1]; f.cb[i] = A[3 * i + 2]; }
  function setRgb(f, i, c) { f.cr[i] = c[0]; f.cg[i] = c[1]; f.cb[i] = c[2]; }

  function mapPos(box, align) {
    const k = Math.min(box.w / bw, box.h / bh);
    const ox = box.x + (align && align.left ? 0 : (box.w - bw * k) / 2), oy = box.y + (align && align.top ? 0 : (box.h - bh * k) / 2);
    const x = new Float32Array(n), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { x[i] = ox + (px[i] - bx0) * k; y[i] = oy + (py[i] - by0) * k; }
    return { x: x, y: y, k: k, ox: ox, oy: oy, w: bw * k, h: bh * k, box: box };
  }
  // A set of counties fitted into a box: positions (indexed like ids), dot radius, an outline, and a mapper for unscaled projection points.
  function zoomPos(ids, box, rMin) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    ids.forEach(i => { x0 = Math.min(x0, px[i]); x1 = Math.max(x1, px[i]); y0 = Math.min(y0, py[i]); y1 = Math.max(y1, py[i]); });
    const padU = (box.pad == null ? 0.07 : box.pad) * Math.max(x1 - x0, y1 - y0), w0 = x1 - x0 + 2 * padU, h0 = y1 - y0 + 2 * padU;
    const k = Math.min(box.w / w0, box.h / h0), ox = box.x + (box.w - w0 * k) / 2, oy = box.y + (box.h - h0 * k) / 2;
    const at = (ux, uy) => [ox + (ux - x0 + padU) * k, oy + (uy - y0 + padU) * k];
    const x = new Float32Array(ids.length), y = new Float32Array(ids.length), pts = [];
    ids.forEach((i, j) => { const q = at(px[i], py[i]); x[j] = q[0]; y[j] = q[1]; pts.push(q); });
    // mean distance to the nearest neighbour, from the Delaunay neighbours
    let nn = 0; const del = d3.Delaunay.from(pts);
    for (let j = 0; j < ids.length; j++) { let best = 1e9; for (const l of del.neighbors(j)) best = Math.min(best, Math.hypot(x[j] - x[l], y[j] - y[l])); nn += best < 1e9 ? best : 0; }
    nn /= Math.max(1, ids.length);
    const r = clamp(0.38 * nn, rMin == null ? 2.6 : rMin, 12);
    const hull = d3.polygonHull(pts);
    let path = '';
    if (hull) {
      const cx = d3.mean(hull, q => q[0]), cy = d3.mean(hull, q => q[1]);
      const grown = hull.map(q => { const dx = q[0] - cx, dy = q[1] - cy, L = Math.hypot(dx, dy) || 1; return [q[0] + dx / L * (r + 3), q[1] + dy / L * (r + 3)]; });
      path = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(grown);
    }
    return { x: x, y: y, r: r, path: path, box: { x: ox, y: oy, w: w0 * k, h: h0 * k }, k: k, ox: ox + padU * k, oy: oy + padU * k, x0: x0, y0: y0, at: at };
  }
  const paMapPos = box => zoomPos(D.pa, box, 2.6);
  function realPAPath(B) {
    if (!paOutline) return '';
    const projection = d3.geoTransform({ point: function (lon, lat) {
      const p = proj([lon, lat]);
      if (p) { const q = B.at(p[0], p[1]); this.stream.point(q[0], q[1]); }
    } });
    return d3.geoPath(projection)(paOutline) || '';
  }
  function atMap(m, lonlat) { const p = proj(lonlat); return [m.ox + (p[0] - bx0) * m.k, m.oy + (p[1] - by0) * m.k]; }

  function mapFrame(m, cols, alpha, rMul) {
    const f = nf(), rs = small ? clamp(m.w / 230, 1.15, 1.75) : 1;      // phones: the dots grow with the width of the map
    for (let i = 0; i < n; i++) {
      f.x[i] = m.x[i]; f.y[i] = m.y[i]; f.r[i] = rBase * rs * (small ? Math.min(1.4, Math.pow(hhF[i], 0.4)) : hhF[i]) * (rMul || 1);
      setCol(f, i, cols); f.a[i] = valid[i] ? alpha : 0; f.z[i] = 0;
    }
    return f;
  }
  // Apply the Pennsylvania box transform to every county so the map truly zooms; only Pennsylvania remains visible at the end.
  function zoomFrame(B, cols, paAlpha) {
    const f = nf(), paIndex = new Int16Array(n); paIndex.fill(-1);
    D.pa.forEach((i, j) => { paIndex[i] = j; });
    for (let i = 0; i < n; i++) {
      const p = B.at(px[i], py[i]), j = paIndex[i];
      f.x[i] = p[0]; f.y[i] = p[1];
      f.r[i] = j >= 0 ? clamp(4 + 6 * Math.sqrt(Math.max(0, rows[i].hh || 0) / 100000), 4, 10)
        : Math.min(rBase * hhF[i] * B.k / MAP.M0.k, 12);
      setCol(f, i, cols); f.a[i] = j >= 0 && valid[i] ? paAlpha : 0; f.z[i] = 0;
    }
    return f;
  }
  function highlight(f, idxs, o) {
    idxs.forEach(i => {
      if (o.col) setRgb(f, i, o.col); f.a[i] = o.a == null ? 1 : o.a; f.z[i] = 1;
      if (o.rMul) f.r[i] = f.r[i] * o.rMul; if (o.r) f.r[i] = o.r;
    });
  }

  /* ---------- geometry (per width and height) ---------- */
  function geo() {
    small = W < 520; phone = small && window.innerWidth < 900;
    const pad = small ? 12 : 20, top = small ? 66 : 72, bot = small ? 100 : 116;
    GEO.pad = pad; GEO.top = top; GEO.bot = bot;
    // Map variants.
    MAP.M0 = mapPos({ x: pad, y: top, w: W - 2 * pad, h: H - top - bot }, small ? { top: true } : null);
    MAP.P2 = small ? mapPos({ x: pad, y: 50, w: W - 2 * pad, h: H - 88 }) : MAP.M0;
    // v7.2 [4.7]: the adjustments' map uses the panel's width, above the legend inset and the bar
    { const y1 = Math.max(headBottom('oil'), headBottom('prior')) + 8, yB = phone ? H - 12 : H - (small ? 76 : 88) - (small ? 34 + 84 : 34 + 84);   // phones: the legends are above the map, so it runs down to the source line
      MAP.M1 = mapPos({ x: pad, y: y1, w: W - 2 * pad, h: Math.max(60, yB - y1) }, { top: true, left: small }); }
    const m2w = small ? 0.58 * W : 0.54 * W, yM2 = headBottom('lim') + 8;
    MAP.M2 = mapPos({ x: pad, y: yM2, w: m2w - pad, h: small ? 110 : H - 80 - yM2 }, { top: small, left: true });
    // Two analyses: two small multiples, each with a title and one short caption above it. Side by side on one baseline when the panel is wide enough for that to give the
    // larger maps, stacked otherwise (always on phones; on a portrait desktop panel such as 800 x 868, stacking gives maps about 1.6 times as wide).
    {
      const caps = small ? ['counties in the 390 metro areas with local prices', 'one price rise per state (illustrative)'] : ['counties in the 390 metro areas with local prices', 'one price rise per state, 44 states (illustrative tints)'];
      GEO.twoCaps = caps;
      const gap = 44, mw = (W - 2 * pad - gap) / 2, fsC = small ? 12 : 13, lhC = small ? 15 : 17, tOff = small ? 13 : 18, cOff = small ? 29 : 40, cw = W - 2 * pad;
      const nCs = caps.map(c => wrapLines(c, cw, fsC).length), blkS = nCs.map(k => (small ? 17 : 24) + k * lhC + 8), mhs = Math.max(64, (H - blkS[0] - blkS[1] - 22 - 16) / 2);
      const wideW = Math.min(mw, (H - 90) * bw / bh), stackW = Math.min(cw, mhs * bw / bh);
      if (!small && wideW >= stackW / 1.2) {
        const mh0 = bh * (mw / bw), nCap = Math.max(wrapLines(caps[0], mw, 13).length, wrapLines(caps[1], mw, 13).length), block = 20 + 8 + nCap * 17 + 18;
        const y0 = Math.max(top + block - 24, (H - mh0 - block) / 2 + block);
        MAP.L = mapPos({ x: pad, y: y0, w: mw, h: mh0 + 2 }, { top: true, left: true });
        MAP.R = mapPos({ x: pad + mw + gap, y: y0, w: mw, h: mh0 + 2 }, { top: true, left: true });
        GEO.two = { stacked: false, titleY: [y0 - block + 18, y0 - block + 18], capY: [y0 - block + 40, y0 - block + 40], capW: mw };
      } else {
        const yTop = small ? 6 : 14, between = small ? 14 : 22, mhh = small ? Math.max(64, (H - blkS[0] - blkS[1] - 14 - 10) / 2) : mhs;
        const yL = yTop + blkS[0], yR = yL + mhh + between + blkS[1], al = small ? { top: true, left: true } : { top: true };
        MAP.L = mapPos({ x: pad, y: yL, w: cw, h: mhh }, al);
        MAP.R = mapPos({ x: pad, y: yR, w: cw, h: mhh }, al);
        GEO.two = { stacked: true, titleY: [yL - blkS[0] + tOff, yR - blkS[1] + tOff], capY: [yL - blkS[0] + cOff, yR - blkS[1] + cOff], capW: cw };
      }
    }
    // Scatter plot box (shared by the 2022 scatter and the race strips).
    const band = Math.max(small ? 34 : 46, typeof window.SLICE_BAND === 'number' ? window.SLICE_BAND : 0);
    const b = { x0: small ? 54 : 70, x1: W - (small ? 14 : 30), y0: phone ? headBottom('strips') + 12 : Math.max(top + (small ? 6 : 10), Math.max(headBottom('sc22'), headBottom('strips')) + 12), y1: H - band - (phone ? 26 : small ? 62 : 80) };
    GEO.sc = b;
    const sx = [0, quant(D.b22, 0.99) + 0.05], sy = [quant(D.sw22, 0.01) - 0.4, quant(D.sw22, 0.99) + 0.4];      // v7.2 [S10]: about the 1st-99th percentile
    GEO.scX = d3.scaleLinear().domain(sx).range([b.x0 + 6, b.x1]);
    GEO.scY = d3.scaleLinear().domain(sy).range([b.y1, b.y0]);
    // Strips.
    GEO.sideW = tierTablet() ? 140 : small ? 104 : 200;
    GEO.stX0 = b.x0 + 4; GEO.stX1 = b.x1 - GEO.sideW - 8;
    GEO.stW = (GEO.stX1 - GEO.stX0) / Math.max(1, D.nR);
    GEO.areaX0 = b.x1 - GEO.sideW + 6; GEO.areaX1 = b.x1;
    // Pennsylvania scatter: burden (b22) across, 2022 Senate shift up.
    const pb = { x0: small ? 52 : 70, x1: W - (small ? 100 : 170), y0: Math.max(top + (small ? 12 : 16), headBottom('pa') + (small ? 46 : 32)), y1: H - (small ? 62 : 80) };
    const pbur = D.pa.map(i => D.b22[i]), f22 = D.paFitB, mid = f22.a + f22.b * f22.mx, span = small ? 15 : 14;
    GEO.pa = { b: pb, mid: mid, xs: d3.scaleLinear().domain([d3.min(pbur) - 0.12, d3.max(pbur) + 0.12]).range([pb.x0 + 6, pb.x1 - 4]), ys: d3.scaleLinear().domain([mid - span, mid + span]).range([pb.y1, pb.y0]) };
    // Pennsylvania maps: one full panel (price-problem-2), one with room for arcs and keys (comparable-metros).
    {
      const bh2 = H - top - bot - (small ? 10 : 20);
      GEO.paBig = paMapPos({ x: pad + (small ? 0 : 20), y: top + (small ? 10 : 24), w: W - 2 * pad - (small ? 0 : 40), h: bh2 });
      const cy0 = small ? 92 : 104, cy1 = H - (small ? 58 : 80);
      GEO.paC = paMapPos({ x: pad + (small ? 4 : 30), y: cy0, w: W - 2 * pad - (small ? 8 : 60), h: cy1 - cy0 });
    }
    // Assumption: the Midwest (left) and Pennsylvania (right), side by side under one caption (stacked on phones).
    {
      const capW = W - 2 * pad, nCap = wrapLines(ASSUMP_CAP, capW, small ? 13 : 14.5, 600).length;
      const y0 = (small ? 14 : 20) + nCap * (small ? 17 : 19.5) + (small ? 12 : 26), lab = small ? 20 : 26;
      if (!small) {
        const gap = 40, w1 = (W - 2 * pad - gap) / 2, h1 = H - y0 - lab - 16;
        GEO.as = { L: zoomPos(D.mwIds, { x: pad, y: y0, w: w1, h: h1 }, 1.1), R: paMapPos({ x: pad + w1 + gap, y: y0, w: w1, h: h1 }), stacked: false };
      } else {
        const h1 = (H - y0 - 2 * lab - 8) / 2;
        GEO.as = { L: zoomPos(D.mwIds, { x: pad, y: y0, w: W - 2 * pad, h: h1 }, 0.9), R: paMapPos({ x: pad, y: y0 + h1 + lab + 8, w: W - 2 * pad, h: h1 }), stacked: true };
      }
    }
    // v7: one Pennsylvania layout for price-problem-2, nearby-markets and assumption (the dots stay put; colors change). The band above the map holds the
    // assumption caption, the key of nearby-markets or the titles of price-problem-2; the band below, the legend of price-problem-2.
    {
      // v7.2: under the headings; the assumption caption is now the heading's subtitle, the key of nearby-markets sits under its heading
      const fsC = small ? 13 : 14.5, lhC = small ? 17 : 19.5, kRows = kindKeyRows();
      const topR = Math.max(headBottom('as'), headBottom('pp2') + (small ? 28 : 34), headBottom('nm') + 12 + kRows * 19) + (small ? 14 : 30), botR = small ? 92 : 100;
      GEO.paN = paMapPos({ x: pad + (small ? 0 : 10), y: topR, w: W - 2 * pad - (small ? 0 : 20), h: H - topR - botR });
      [GEO.paN, GEO.paBig, GEO.paC, GEO.as.R].forEach(B => { B.path = realPAPath(B); });
      GEO.paN.topR = topR; GEO.paN.fsC = fsC; GEO.paN.lhC = lhC;
      // The v9 map has no illustrative-price legend below it. Keep the county
      // dots large and leave a margin for names above the slice/source bands.
      // v9.4: under the title (and, in assumption, its caption) comes the key of the three kinds of market; the household-size key and the line of nearby-groups share the slot under the plot
      const top9 = (phone ? Math.max(headBottom('pa44'), headBottom('paGrp')) : Math.max(headBottom('paGrpAs'), headBottom('pa44'), headBottom('paGrp'))) + (phone ? 20 + (kRows - 1) * 19 + 12 : 20 + kRows * 19 + 6);
      const paBox = { x: pad, y: top9, w: W - 2 * pad, h: Math.max(phone ? 40 : 60, H - band - (phone ? 6 : 34) - top9), pad: phone ? 0.025 : 0.07 };
      GEO.pa9 = paMapPos(paBox);
      if (restorePhone()) { const k = GEO.pa9.k; GEO.pa9 = paMapPos(Object.assign({}, paBox, { h: Math.max(40, paBox.h - 44) })); GEO.pa9.dotScale = GEO.pa9.k / k; }   // one map placement through intro/groups, with a two-line annotation band below
      GEO.pa9.path = realPAPath(GEO.pa9);
    }
    geoCmp();
    // Gaps: three columns (Place A, Place B, and the bars of gaps-difference).
    const kb = { x0: pad + (small ? 30 : 46), x1: W - pad, y0: top + (small ? 50 : 64), y1: H - (small ? 120 : 140) };
    const inner = kb.x1 - kb.x0, gut = small ? 8 : 18, cw = inner * (small ? 0.29 : 0.27);
    GEO.key = { b: kb, cw: cw, gut: gut, colA: kb.x0, colB: kb.x0 + cw + gut, colR: kb.x0 + 2 * (cw + gut), rw: inner - 2 * (cw + gut) };
    { const fsT = small ? 12 : 13; GEO.key.fsT = fsT; GEO.key.lhT = fz(fsT) * 1.25;
      GEO.key.nTag = Math.max.apply(null, [KTAG.A, KTAG.B0, KTAG.B].map(t => balancedLines(t[small ? 1 : 0], cw + gut - 4, fsT, 600).length)); }
    const K = D.key, all = [];
    ['A', 'B'].forEach(l => { K[l].low.concat(K[l].high).forEach(i => all.push(K[l].swing[i])); });
    K.B.high.forEach(i => all.push(K.B.swingH[i]));
    GEO.key.ys = d3.scaleLinear().domain([d3.min(all) - 1, d3.max(all) + 1]).range([kb.y1, kb.y0]);
    // Fan (what-is-left, v6: the scatter only, no bars).
    const fb = { x0: small ? 54 : 70, x1: W - (small ? 14 : 30), y0: Math.max(top + (small ? 26 : 30), headBottom('fan') + 16), y1: H - (small ? 62 : 80) };
    GEO.fan = { b: fb, xs: d3.scaleLinear().domain(D.recX).range([fb.x0 + 4, fb.x1 - 4]), ys: d3.scaleLinear().domain(D.recY).range([fb.y1, fb.y0]) };
    geoV8();
    // The v9 adjustment maps have room for the vote-shift key, without the removed bottom bar.
    // v9.4: the keys of adj-oil and adj-prior sit in the title area, so the map starts below them and runs nearly to the bottom
    { const y0 = Math.max(headBottom('oil'), headBottom('prior')) + (phone ? 36 : small ? 62 : 66);
      MAP.MAdj = mapPos({ x: pad, y: y0, w: W - 2 * pad, h: Math.max(80, H - band - (phone ? 6 : 20) - y0) }, small ? { top: true, left: true } : null); }
    // phones, adj-state: the supply-region map takes the panel's height, the legend is a column of seven rows at its right and the label stands in one line over the map
    if (phone) {
      const lw = Math.max.apply(null, Object.keys(PADD_NAME).map(k => measure(PADD_NAME[k], 12) + 22)), yR = headBottom('v8region') + 26;
      const box = { x: pad, y: yR, w: W - 2 * pad - lw - 10, h: Math.max(60, H - band - 8 - yR) }, sh = Math.min(28, Math.max(0, (box.h - mapPos(box, { top: true, left: true }).h) / 2));   // a taller panel centers the map in the height it has left
      GEO.regLeg = { x: W - pad - lw, w: lw, y: yR + sh };
      MAP.MReg = mapPos(Object.assign({}, box, { y: yR + sh, h: box.h - sh }), { top: true, left: true });
      // scope-where: the same plan, with the key of the five classes as the column
      const kw = Math.max.apply(null, WHERE_CLASSES.map(c => measure(c.lab, 12) + 20).concat([measure('counts less', 13), measure('counts more', 13)])), yW = headBottom('where') + 8;
      const boxW = { x: pad, y: yW, w: W - 2 * pad - kw - 10, h: Math.max(60, H - band - 8 - yW) }, shW = Math.min(28, Math.max(0, (boxW.h - mapPos(boxW, { top: true, left: true }).h) / 2));
      GEO.whKey = { x: W - pad - kw, w: kw, y: yW + shW };
      MAP.MWh = mapPos(Object.assign({}, boxW, { y: yW + shW, h: boxW.h - shW }), { top: true, left: true });
    }
    // Bar (what is left) and the inset zone above it.
    const barY = H - (small ? 76 : 88);
    GEO.bar = { x0: pad, x1: W - pad, y: barY, h: small ? 12 : 14 };
    const mb = MAP.M1.oy + MAP.M1.h;
    GEO.inset = { x: pad, y: mb + (small ? 16 : 30), w: small ? W - 2 * pad : Math.min(460, W * 0.6), h: Math.max(60, barY - 34 - (mb + (small ? 16 : 30))) };
    // The vote-path schematic of adj-lagged uses the whole panel above the bar.
    GEO.lag = { x0: pad + (small ? 40 : 54), x1: W - pad - 6, y0: small ? 34 : 44, y1: barY - (small ? 46 : 54) };
    geoSlices();
    // Limits area (recap-limits), to the right of the map (below it on phones).
    const NL = 7, rowL = small ? 30 : clamp((H - 170) / NL, 46, 66);
    GEO.limits = small ? { x: pad, y: MAP.M2.oy + MAP.M2.h + 34, w: W - 2 * pad, h: NL * rowL }
      : { x: pad + m2w + 30, y: Math.max(90, (H - NL * rowL) / 2 + 10), w: W - pad - (pad + m2w + 30), h: NL * rowL };
  }

  function geoV8() {
    const band = Math.max(small ? 34 : 46, typeof window.SLICE_BAND === 'number' ? window.SLICE_BAND : 0);
    const mkBox = (head, right, foot) => ({ x0: small ? 55 : 70, x1: W - right,
      y0: Math.max(headBottom(head) + (small ? 30 : 38), small ? 101 : 126),
      y1: Math.max(small ? 180 : 260, H - band - foot) });
    const simple = mkBox('v8simple', small ? 16 : 32, small ? 65 : 80);
    const centered = mkBox('v8same', small ? 16 : 32, small ? 65 : 80);
    const pa = mkBox('v8pa', small ? 88 : 148, small ? 65 : 80);
    const fan = mkBox('v8fan', small ? 16 : 32, small ? 65 : 80);
    const slope = mkBox('v8slope', small ? 16 : 32, small ? 65 : 80);
    const range = (a, p, d) => [quant(a, p) - d, quant(a, 1 - p) + d];
    const s16 = D.fit16Ids.map(i => D.sw16[i]), cb = D.fit16Ids.map(i => D.cB16[i]), cs = D.fit16Ids.map(i => D.cS16[i]);
    const paY = D.pa.map(i => D.sw16[i]);
    D.paLines.forEach(L => { paY.push(L.a + L.b * D.paELo, L.a + L.b * D.paEHi); });
    const mk = (b, xd, yd) => ({ b: b, xs: d3.scaleLinear().domain(xd).range([b.x0 + 4, b.x1 - 4]), ys: d3.scaleLinear().domain(yd).range([b.y1 - 4, b.y0 + 4]) });
    GEO.v8 = {
      simple: mk(simple, [0, quant(D.fit16Ids.map(i => D.b26[i]), 0.99) + 0.08], range(s16, 0.01, 1)),
      same: mk(centered, range(cb, 0.01, 0.08), range(cs, 0.01, 1)),
      pa: mk(pa, [D.paELo - 0.08, D.paEHi + 0.08], [Math.min(quant(paY, 0.01) - 1, -15), Math.max(quant(paY, 0.99) + 1, 18)]),
      fan: mk(fan, D.recX, D.recY),
      slope: mk(slope, [quant(Array.from(D.yRec), 0.01) - 0.02, quant(Array.from(D.yRec), 0.99) + 0.02], range(Array.from(D.voteSim), 0.01, 0.5))
    };
    const y0 = headBottom('lineup') + (small ? 34 : 44) + (phone ? 1 : whyKey().rows - 1) * 17;      // v9.4: room for a second row of the key of simple-why
    const lineup = { x0: small ? 48 : 68, x1: W - (small ? 16 : 32), y0: y0,
      y1: phone ? H - 66 : Math.max(y0 + 120, H - band - (small ? 64 : 76)) };
    const cost = []; for (let i = 0; i < n; i++) if (valid[i] && D.in44[i] && Number.isFinite(D.b26[i])) cost.push(D.b26[i]);
    const hi = cost.length ? quant(cost, 0.995) + 0.05 : 1;
    const mk9 = D.mockIds ? D.mockIds.map(i => D.mockSw[i]) : [0], mlo = quant(mk9, 0.005), mhi = quant(mk9, 0.995), mm = Math.max(5, Math.ceil(Math.max(Math.abs(mlo), Math.abs(mhi)) / 2.5) * 2.5 + 2.5);
    GEO.v9 = { lineup: { b: lineup, xs: d3.scaleLinear().domain([0, hi]).range([lineup.x0 + 4, lineup.x1 - 4]), ys: d3.scaleLinear().domain([-mm, mm]).range([lineup.y1 - 4, lineup.y0 + 4]) } };
  }

  // At each x, take the lowest free dot position above the baseline. Only earlier
  // dots within one diameter in x can collide, so the search stays local.
  function lineupBeeswarm(ids, xs, b, radius) {
    const sep = 2 * radius + 0.3, sep2 = sep * sep, base = b.y1 - radius - (phone ? 5 : 1);
    const order = ids.map(i => ({ i: i, x: clamp(xs(D.b26[i]), b.x0 + 4, b.x1 - 4) }));
    order.sort((a, c) => a.x - c.x || dly[a.i] - dly[c.i] || a.i - c.i);
    const ys = new Float32Array(n); let left = 0, minY = base;
    for (let k = 0; k < order.length; k++) {
      const a = order[k], cand = [base];
      while (left < k && order[left].x < a.x - sep) left++;
      for (let j = left; j < k; j++) {
        const dx = a.x - order[j].x, dy = Math.sqrt(Math.max(0, sep2 - dx * dx));
        cand.push(ys[order[j].i] - dy);
      }
      cand.sort((u, v) => v - u);
      let y = cand[cand.length - 1];
      for (const cy of cand) {
        let free = true;
        for (let j = left; j < k; j++) {
          const dx = a.x - order[j].x, vy = cy - ys[order[j].i];
          if (dx * dx + vy * vy < sep2 - 0.0001) { free = false; break; }
        }
        if (free) { y = cy; break; }
      }
      ys[a.i] = y; minY = Math.min(minY, y);
    }
    return { order: order, y: ys, height: base - minY + 2 * radius };
  }

  // Two slices: three strips of county dots (placed by simulated price rises), the labels between them and the 100% bar of the real shares.
  function geoSlices() {
    const Sg = GEO.sl = {}; if (!D.sl) return;
    const fs = small ? 12 : 13, x0 = GEO.pad, x1 = W - GEO.pad, Wd = x1 - x0, tlh = 1.3 * fs, sh = D.sl.sh, pct = v => Math.round(v * 100) + '%';
    const TT = small ? ['All counties, minus the national average', 'Minus each region’s average', 'Minus each state’s average too: main analysis only']
      : ['All counties: each county’s price rise, minus the national average', 'After removing each region’s average: what is left of the differences', 'After also removing each state’s average: metro areas’ differences from their state'];
    const SIDE = 'used by the main analysis only', sideW = measure(SIDE, fs, 500), tw = [Wd, Wd, small ? Wd : Wd - sideW - 18];
    const tl = TT.map((t, k) => wrapLines(t, tw[k], fs, 600).length);
    const BET = ['region averages: used by neither', 'state differences: used by both'];
    const LAB = small ? ['region averages', 'state differences', 'metro differences'] : ['region averages: used by neither', 'state differences: used by both', 'metro differences: main analysis only'];
    const barTitle = small ? 'Shares of the differences between counties' : 'Shares of the differences in price rises between counties', btN = wrapLines(barTitle, Wd, fs, 600).length;
    const segW = [sh.regional, sh.state, sh.metro].map(v => v * Wd), bhh = small ? 14 : 20;
    const l1n = Math.max(wrapLines(pct(sh.regional) + ' ' + LAB[0], segW[0] - 8, fs).length, wrapLines(pct(sh.state) + ' ' + LAB[1], segW[1] - 8, fs).length);
    const betH = small ? 20 : 30, axisH = small ? 30 : 2 * fs + 14, barH = (small ? 14 : 22) + btN * tlh + 6 + bhh + 8 + l1n * tlh + 6 + tlh;
    const yTitle = small ? 22 : 30, yStart0 = yTitle + (small ? 12 : 20), bottom = H - 4;
    const fixed = tl.reduce((a, b) => a + b, 0) * tlh + 3 * 8 + 2 * betH + axisH + barH;
    const hb = clamp((bottom - yStart0 - fixed) / 3, small ? 20 : 34, small ? 46 : 150), yStart = yStart0 + clamp((bottom - yStart0 - fixed - 3 * hb) / 2, 0, 40);
    const band = []; let y = yStart;
    for (let k = 0; k < 3; k++) { const ty = y + fs, top = ty + (tl[k] - 1) * tlh + 8; band.push({ ty: ty, y0: top, y1: top + hb }); y = top + hb + (k < 2 ? betH : 0); }
    const Dm = Math.ceil(D.sl.max * 1.05 / 10) * 10, xc = x0 + Wd / 2, X = v => xc + v / Dm * (Wd / 2 - 6);
    const lanes = hb / 7 >= 8, laneH = hb / 7, rr = small ? 0.95 : clamp(hb / 55, 1.05, 1.7);
    Object.assign(Sg, { fs: fs, x0: x0, x1: x1, Wd: Wd, tlh: tlh, TT: TT, tw: tw, SIDE: SIDE, BET: BET, LAB: LAB, barTitle: barTitle, btN: btN, bhh: bhh, l1n: l1n, betH: betH, axisH: axisH, yTitle: yTitle,
      hb: hb, band: band, D: Dm, X: X, lanes: lanes, laneH: laneH, rr: rr, pct: pct });
  }

  // v7 comparison and comparison-2: the plot box, the four columns, the vertical scale (vote shift vs the race average) and the horizontal scale of comparison-2.
  function geoCmp() {
    const pad = GEO.pad, K = D.cmp; if (!K) return;
    const b = { x0: pad + (small ? 40 : 60), x1: W - pad - (small ? 46 : 62), y0: Math.max(headBottom('cmp'), headBottom('cmp2')) + (small ? 16 : 20) + (small ? 50 : 62), y1: H - (small ? 80 : 98) };
    const cw = (b.x1 - b.x0) / 4, ys = d3.scaleLinear().domain(K.yDom).range([b.y1, b.y0]), ysA = d3.scaleLinear().domain(K.yDomA).range([b.y1, b.y0]);
    const xs = d3.scaleLinear().domain([-K.xMax, K.xMax]).range([b.x0 + 8, b.x1 - 8]);
    GEO.cmp = { b: b, cw: cw, ys: ys, ysA: ysA, xs: xs, colX: k => b.x0 + (k + 0.5) * cw, rD: small ? 5 : clamp(W * 0.0085, 6.5, 10), rO: small ? 2 : clamp(W * 0.0035, 2.6, 4) };
  }
  // Simulated counties of comparison / comparison-2. The 16 dots of the four markets are real counties taken from the map (none in Pennsylvania, never named), with
  // their real exposure; their vote shifts are simulated: CMP_BETA x exposure x the market's unusual rise, plus fixed within-market scatter, so that Market 2 sits about one
  // point above the other three and its most exposed county highest. About 300 more counties (other groups) get the same rule with a simulated unusual rise and noise.
  function prepCmp() {
    D.cmp = null;
    const rnd = mulberry(20261023), cand = [];
    for (let i = 0; i < n; i++) if (valid[i] && rows[i].st !== 'PA' && Number.isFinite(D.e[i]) && rows[i].hh > 3000) cand.push(i);
    for (let k = cand.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); const t = cand[k]; cand[k] = cand[j]; cand[j] = t; }
    const used = {}, pick = target => { let best = -1, bd = 1e9; for (let k = 0; k < cand.length && k < 2500; k++) { const i = cand[k]; if (used[i]) continue; const d = Math.abs(D.e[i] - target); if (d < bd) { bd = d; best = i; } if (d < 0.02) break; } used[best] = 1; return best; };
    const TGT = [[1.1, 1.5, 1.9, 2.3], [1.0, 1.4, 1.7, 2.0, 2.4], [1.2, 1.6, 2.1], [1.0, 1.3, 1.8, 2.2]];
    const RES = [[0.5, -0.6, 0.2, -0.1], [0.3, -0.4, 0.2, -0.3, 0.2], [-0.5, 0.6, -0.1], [0.4, -0.3, -0.5, 0.4]];
    const ORD = { 3: [1, 0, 2], 4: [1, 3, 0, 2], 5: [2, 0, 4, 1, 3] };       // left-to-right slots within a column, not sorted by exposure
    const dots = [], c0 = 0.12;
    TGT.forEach((tg, m) => {
      const dev = Math.round((CMP_RISE[m] - CMP_AVG) * 100) / 100;
      tg.forEach((t0, j) => { const i = pick(t0); const x = D.e[i] * dev; dots.push({ i: i, m: m, x: x, y: c0 + CMP_BETA * x + RES[m][j], slot: ORD[tg.length][j], nm: tg.length }); });
    });
    let means = [0, 1, 2, 3].map(m => d3.mean(dots.filter(d => d.m === m), d => d.y));
    { const sh = (means[0] + means[2] + means[3]) / 3; dots.forEach(d => { d.y -= sh; }); means = means.map(v => v - sh); }   // the other three average the race average
    const others = []; let c = 0;
    for (let k = 0; k < cand.length && c < 300; k++) { const i = cand[k]; if (used[i]) continue; used[i] = 1; c++; const x = D.e[i] * D.mdev[i]; others.push({ i: i, x: x, y: CMP_BG_BETA * x + CMP_BG_SD * gauss(rnd) }); }
    const all = dots.concat(others), fit = wfit(all.map(d => d.x), all.map(d => d.y));
    const ysA = all.map(d => d.y), x16 = dots.map(d => Math.abs(d.x));
    const xMax = Math.max(0.3, Math.ceil(Math.max(quant(others.map(d => Math.abs(d.x)), 0.985), d3.max(x16)) * 20 + 0.5) / 20);
    const yLo = Math.min(quant(ysA, 0.02), d3.min(dots, d => d.y)) - 0.3, yHi = Math.max(quant(ysA, 0.98), d3.max(dots, d => d.y) + 1.1);
    // comparison has its own, narrow vertical scale (the 16 dots of the four markets, with room above Market 2 for the bracket's label); comparison-2 the wide one
    const aLo = d3.min(dots, d => d.y) - 0.4, aHi = d3.max(dots, d => d.y) + 1.0;
    D.cmp = { dots: dots, others: others, means: means, fit: fit, xMax: xMax, yDom: [Math.floor(yLo * 2) / 2, Math.ceil(yHi * 2) / 2], yDomA: [Math.floor(aLo * 2) / 2, Math.ceil(aHi * 2) / 2] };
  }

  function buildFrames() {
    F = {}; EXTRA = {};
    const M0 = MAP.M0, M1 = MAP.M1, M2 = MAP.M2, P2 = MAP.P2;
    const one = f => ({ s: f, e: f });
    const fai = byFips['51059'], rob = byFips['37155'];

    // v8: dots arrive in PADD_COLORS from scene, then re-shade to exposure over p 0.05–0.25
    F['dots-intro'] = { s: mapFrame(M0, C.pad, 0.9), e: mapFrame(M0, C.e, 0.9) };
    // v9.5: exposure-example builds the dim-and-highlight (was in exposure's t cross-fade)
    { GEO.exX = GEO.pad + 20 + Math.ceil(Math.max(measure('Fairfax County, VA', 12, 600), measure('Robeson County, NC', 12, 600)));
      const m = small ? mapPos({ x: GEO.exX, y: 46, w: W - GEO.pad - GEO.exX, h: H - 82 }) : M0;
      const f = mapFrame(m, C.e, 0.22); highlight(f, [fai, rob], { a: 1, r: small ? 3 : 8.5 }); F['dots-example'] = { s: mapFrame(P2, C.e, 0.9), e: f }; }
    F['burden-state'] = F['burden-metro'] = F['burden-split'] = F['burden-split-2'] = one(mapFrame(M0, C.e, 0.15));
    // Two analyses: the national map twice (side by side on desktop, stacked on phones). The dots of the local-price map are the beat's frame, those of the state-price
    // map an extra layer. The figure is held across two-analyses and two-analyses-2: the first emphasises the local-price map, the second the state-price map (the other
    // map is dimmed to TWO_DIM). The dimming of the local map is a second frame (blended with the first), that of the state map a weight of the extra layer (see render).
    {
      const rm = small ? 0.55 : 0.62, fl = mapFrame(MAP.L, C.pale, 0.5, rm), fr = mapFrame(MAP.R, C.pale, 0.55, rm);
      for (let i = 0; i < n; i++) if (valid[i]) {
        if (rows[i].metro) { setCol(fl, i, C.acc); fl.a[i] = 0.95; fl.z[i] = 1; }
        if (D.in44[i]) { setCol(fr, i, C.shock); fr.a[i] = 0.95; fr.z[i] = 1; }
      }
      const fl2 = cpf(fl); for (let i = 0; i < n; i++) fl2.a[i] *= TWO_DIM;
      F['two-analyses'] = one(fl); F['two-analyses-2'] = one(fl2); EXTRA = { frame: fr, w: { 'two-analyses': TWO_DIM, 'two-analyses-2': 1 } };
    }
    // The 44 states with a race keep their colors; the others turn pale.
    [['races-covered', C.e], ['dots-question', C.b26]].forEach(([id, cols]) => {
      const f = mapFrame(M0, cols, 0.9);
      for (let i = 0; i < n; i++) if (valid[i] && !D.in44[i]) { setCol(f, i, C.pale); f.a[i] = 0.7; }
      F[id] = one(f);
    });
    {
      const f = mapFrame(M0, C.pale, 0.34);
      ['GA', 'NC', 'OH', 'IN', 'UT'].forEach(st => (D.byState[st] || []).forEach(i => { setCol(f, i, C.acc); f.a[i] = valid[i] ? 0.95 : 0; f.z[i] = 1; f.r[i] *= 1.1; }));
      F['dots-holidays'] = one(f);
    }
    F['method-map'] = one(mapFrame(M0, C.b26, 0.06));   // the method overview (v6.3): the map far back behind the tile panel
    { const f = mapFrame(M0, C.b26, 0.11); highlight(f, [rob], { a: 1, r: small ? 6 : 8.5 }); F['ideal'] = one(f); }
    // The 2022 scatter. simplest-axes moves the dots there from the map, over most of the beat (staggered); the axes are drawn first.
    const sc = nf(), s0 = nf(); NOUT = { sc: 0, stR: 0, stC: 0, fan: 0 };
    {
      const b = GEO.sc;
      for (let i = 0; i < n; i++) {
        const ok = D.rk[i] >= 0 && Number.isFinite(D.b22[i]);
        if (ok) {
          const x = GEO.scX(D.b22[i]), y = GEO.scY(D.sw22[i]);
          sc.x[i] = clamp(x, b.x0 + 4, b.x1); sc.y[i] = clamp(y, b.y0, b.y1); sc.a[i] = 0.5;
          if (x > b.x1 || y < b.y0 || y > b.y1) { sc.o[i] = 1; sc.a[i] = 0.75; NOUT.sc++; }      // beyond the axis: an open marker at the edge
        }
        else { sc.x[i] = M0.x[i]; sc.y[i] = M0.y[i]; sc.a[i] = 0; }
        sc.r[i] = rBase * 0.8 * Math.pow(hhF[i], 0.8); setCol(sc, i, C.b22);
        s0.x[i] = M0.x[i]; s0.y[i] = M0.y[i]; s0.r[i] = rBase * hhF[i]; setCol(s0, i, C.b22); s0.a[i] = ok ? 0.62 : 0;
      }
      F['simplest-axes'] = { s: s0, e: sc }; F['simplest-slope'] = one(sc);
    }
    // Race strips: built from the scatter in `races` (then held), equalised in `races-cost` (shift relative to the race's mean), held in `within-race`.
    const stR = nf(), stC = nf();
    {
      const b = GEO.sc, stripR = clamp(Math.min(rBase * 0.8, GEO.stW * 0.42), 1.0, 2.4);
      for (let i = 0; i < n; i++) {
        const k = D.rk[i];
        if (k >= 0) {
          const cx = GEO.stX0 + (k + 0.5) * GEO.stW + jit[i] * GEO.stW * 0.72;
          const yR = GEO.scY(D.sw22[i]), yC = GEO.scY(D.sw22[i] - D.rmean[i]);
          stR.x[i] = stC.x[i] = cx; stR.y[i] = clamp(yR, b.y0, b.y1); stC.y[i] = clamp(yC, b.y0, b.y1);
          stR.a[i] = stC.a[i] = 0.78;
          if (yR < b.y0 || yR > b.y1) { stR.o[i] = 1; NOUT.stR++; }
          if (yC < b.y0 || yC > b.y1) { stC.o[i] = 1; NOUT.stC++; }
          const c = hexRgb(STRIP_COL[k % STRIP_COL.length]); setRgb(stR, i, c); setRgb(stC, i, c);
        } else { stR.x[i] = stC.x[i] = M0.x[i]; stR.y[i] = stC.y[i] = M0.y[i]; stR.a[i] = stC.a[i] = 0; setCol(stR, i, C.pale); setCol(stC, i, C.pale); }
        stR.r[i] = stC.r[i] = stripR * Math.pow(hhF[i], 0.35);
      }
      F['races'] = { s: sc, e: stR }; F['races-cost'] = { s: stR, e: stC }; F['within-race'] = one(stC);
    }
    // Pennsylvania pulled out of the equalised strips: the strip is highlighted, the others fade, its dots spread out by burden into the scatter.
    {
      const s = cpf(stC), e = cpf(stC), g = GEO.pa, rP = small ? 3.6 : 4.8;
      for (let i = 0; i < n; i++) { if (s.a[i] > 0) s.a[i] = 0.4; e.a[i] = 0; }
      D.pa.forEach(i => {
        setCol(s, i, C.acc); s.a[i] = 0.95; s.z[i] = 1; s.r[i] = Math.max(s.r[i] * 1.3, small ? 1.8 : 2.4);
        e.x[i] = g.xs(D.b22[i]); e.y[i] = g.ys(rows[i].sw.s22); e.r[i] = rP; setCol(e, i, C.acc); e.a[i] = 0.92; e.z[i] = 1;
      });
      F['exposure-problem'] = { s: s, e: e };
      const f = mapFrame(M0, C.pale, 0);
      D.pa.forEach(i => { f.x[i] = e.x[i]; f.y[i] = e.y[i]; f.r[i] = rP; setCol(f, i, C.paR); f.a[i] = 0.92; f.z[i] = 1; });
      F['exposure-problem-2'] = one(f);
    }
    // The regional price rise (real, EIA), then Pennsylvania: one flat state rise, then illustrative local rises.
    F['price-problem'] = one(mapFrame(M0, C.reg, 0.92));
    {
      const s = mapFrame(M0, C.reg, 0), e = mapFrame(M0, C.reg, 0), B = GEO.paN;      // v7: the Pennsylvania layout shared with nearby-markets and assumption
      D.pa.forEach((i, j) => {
        [s, e].forEach(f => { f.x[i] = B.x[j]; f.y[i] = B.y[j]; f.r[i] = B.r; f.a[i] = 0.95; f.z[i] = 1; });
        setRgb(s, i, D.paFlat); setCol(e, i, C.loc2);
      });
      F['price-problem-2'] = { s: s, e: e };
    }
    // The gaps, built over three beats: Place A, then Place B as if its price had risen the same (faint), then B's real, wider gap.
    {
      const g = GEO.key, K = D.key, rC = small ? 2.4 : clamp(1.45 * rBase, 3.2, 4.6), hiC = hexRgb(T.accent), loC = hexRgb(T.calm || '#8D9AA3');
      const mk = bMode => {                                   // bMode: 0 hidden, 1 "same price rise" (faint), 2 real
        const f = mapFrame(M0, C.pale, 0);
        [['A', 2, g.colA], ['B', bMode, g.colB]].forEach(([l, show, x0]) => {
          [['low', KFX[0]], ['high', KFX[1]]].forEach(([which, fx]) => {
            K[l][which].forEach(i => {
              f.x[i] = x0 + g.cw * (fx + jit[i] * 0.34); f.y[i] = g.ys(l === 'B' && show === 1 ? K.B.swingH[i] : K[l].swing[i]); f.r[i] = rC;
              setRgb(f, i, which === 'high' ? hiC : loC); f.a[i] = show === 0 ? 0 : show === 1 ? 0.34 : 0.82; f.z[i] = which === 'high' ? 1 : 0;
            });
          });
        });
        return f;
      };
      const f0 = mk(0), f1 = mk(1), f2 = mk(2);
      F['gaps-same'] = { s: f0, e: f1 }; F['gaps-bigger'] = { s: f1, e: f2 }; F['gaps-difference'] = one(f2);
    }
    // Supply regions; the Midwest is the one to look at.
    {
      const f = mapFrame(M0, C.pad, 0.5);
      for (let i = 0; i < n; i++) if (valid[i] && rows[i].padd === '2') { f.a[i] = 0.98; f.z[i] = 1; }
      F['comparable-states'] = one(f);
    }
    // Pennsylvania's metro areas by kind (no prices).
    {
      const f = mapFrame(M0, C.pale, 0), B = GEO.paC;
      D.pa.forEach((i, j) => { f.x[i] = B.x[j]; f.y[i] = B.y[j]; f.r[i] = B.r; setCol(f, i, C.kind); f.a[i] = 0.95; f.z[i] = 1; });
      F['comparable-metros'] = one(f);
    }
    // Backdrops for the chart panels (the charts themselves are drawn by DOTS_PANELS).
    {
      const f = mapFrame(M0, C.pad, 0.06);
      for (let i = 0; i < n; i++) if (valid[i] && rows[i].padd === '2') { f.a[i] = 0.3; f.z[i] = 1; }
      F['unusual-rise'] = one(f);
      const pale = one(mapFrame(M0, C.pale, 0.08));
      F['checks'] = F['checks-2'] = F['checks-3'] = F['recap'] = F['recap-2'] = F['recap-3'] = F['recap-4'] = pale;
    }
    // Assumption: the Midwest and Pennsylvania side by side, faint; the arrows (SVG) carry the picture.
    {
      const f = mapFrame(M0, C.pale, 0), L = GEO.as.L, R = GEO.as.R;
      D.mwIds.forEach((i, j) => { f.x[i] = L.x[j]; f.y[i] = L.y[j]; f.r[i] = L.r; setCol(f, i, C.pad); f.a[i] = 0.42; f.z[i] = 1; });
      D.pa.forEach((i, j) => { f.x[i] = R.x[j]; f.y[i] = R.y[j]; f.r[i] = R.r; setCol(f, i, C.kind); f.a[i] = 0.42; f.z[i] = 1; });
      F['assumption-v6'] = one(f);                    // v6 (unrouted); v7 assumption is built below
    }
    // Within-state recentering.
    {
      const s = nf(), e = nf(), g = GEO.fan, b = g.b;
      for (let i = 0; i < n; i++) {
        if (D.fanOk[i]) {
          const x = clamp(g.xs(D.dE[i]), b.x0 + 2, b.x1 - 2);
          const yr = g.ys(D.yRaw[i]), xr = g.xs(D.dE[i]);
          s.x[i] = e.x[i] = x; s.y[i] = clamp(yr, b.y0 + 2, b.y1 - 2); e.y[i] = clamp(g.ys(D.yRec[i]), b.y0 + 2, b.y1 - 2);
          if (yr < b.y0 + 2 || yr > b.y1 - 2 || xr < b.x0 + 2 || xr > b.x1 - 2) { s.o[i] = 1; NOUT.fan++; }
          s.a[i] = e.a[i] = 0.62;
        } else { s.x[i] = e.x[i] = M0.x[i]; s.y[i] = e.y[i] = M0.y[i]; s.a[i] = e.a[i] = 0; }
        s.r[i] = e.r[i] = rBase * 0.8 * Math.pow(hhF[i], 0.5); setCol(s, i, C.mdev); setCol(e, i, C.mdev);
      }
      F['what-is-left'] = { s: s, e: e };
      buildSliceFrames(e);
    }
    // Adjustments: the map, smaller, with the bar below. The two illustrative figures stand over a faded map (no real state is highlighted).
    F['adj-passthrough'] = one(mapFrame(M1, C.calm, 0.2));
    F['adj-lagged'] = one(mapFrame(M1, C.calm, 0.07));
    {
      const f = mapFrame(M1, C.pale, 0.4);
      for (let i = 0; i < n; i++) if (D.oil[i] > D.oilThr) { setCol(f, i, C.acc); f.a[i] = 0.95; f.z[i] = 1; f.r[i] *= 1.2; }
      F['adj-oil'] = one(f);
    }
    F['adj-prior'] = one(mapFrame(M1, C.p24, 0.92));
    F['recap-limits'] = one(mapFrame(M2, C.acc, 0.72));
    // v7: the faded map behind the burden panel (as v6 burden-state).
    F['burden-local'] = F['burden-split'];
    // nearby-markets: the Pennsylvania dots of price-problem-2 stay where they are. Stage 1 (p 0.05-0.25): they take the color of their market's kind.
    // Stage 2 (p 0.25-0.45): the group of four central metropolitan areas comes forward, the rest dims. assumption ends on the same picture.
    {
      const B = GEO.paN, mid = cpf(F['price-problem-2'].e), fin = cpf(mid);
      D.pa.forEach((i, j) => { setCol(mid, i, C.kind); setCol(fin, i, C.kind); const inG = D.blk[i] === PA_GROUP; fin.a[i] = inG ? 1 : 0.24; fin.z[i] = inG ? 1 : 0; if (inG) fin.r[i] = B.r * 1.08; });
      F['nearby-markets'] = { s: F['price-problem-2'].e, m: mid, e: fin, k: [0.05, 0.25, 0.45] };
      // state-part: from Pennsylvania back to the national map colored by supply region (the v6 comparable-states picture), during its build
      F['state-part'] = { s: fin, e: F['comparable-states'].s };
    }
    // comparison: 16 counties leave the faded map behind the burden panel for four columns (one per market), the rest fades out.
    // comparison-2: they slide sideways onto the axis of the unusual part of the extra fuel cost, keeping their heights; 300 more counties fade in.
    // assumption: the scatter fades out with comparison-2's hand-over (light, in t), and Pennsylvania's counties fade in where nearby-markets left them (the build).
    if (D.cmp && GEO.cmp) {
      const g = GEO.cmp, K = D.cmp, B = GEO.paN;
      const e1 = mapFrame(M0, C.e, 0);
      D.pa.forEach((i, j) => { e1.x[i] = B.x[j]; e1.y[i] = B.y[j]; e1.r[i] = B.r; });       // hidden until assumption, already in place
      K.dots.forEach(d => {
        const i = d.i, dx = Math.min(g.cw * 0.13, small ? 11 : 3 * g.rD);
        e1.x[d.i] = g.colX(d.m) + (d.slot - (d.nm - 1) / 2) * dx; e1.y[i] = g.ysA(d.y); e1.r[i] = g.rD; setCol(e1, i, C.e); e1.a[i] = 1; e1.z[i] = 1;
      });
      const m2 = cpf(e1);
      K.dots.forEach(d => { m2.x[d.i] = g.xs(d.x); m2.y[d.i] = g.ys(d.y); });        // the vertical scale zooms out as they slide (furCmpY follows)
      K.others.forEach(d => { m2.x[d.i] = g.xs(clamp(d.x, -K.xMax, K.xMax)); m2.y[d.i] = clamp(g.ys(d.y), g.b.y0, g.b.y1); m2.r[d.i] = g.rO; m2.a[d.i] = 0; m2.z[d.i] = 0; });
      const e2 = cpf(m2); K.others.forEach(d => { e2.a[d.i] = 0.4; });
      F['comparison'] = { s: F['burden-split-2'].s, e: e1 };
      F['comparison-2'] = { s: e1, m: m2, e: e2, k: [0.05, 0.17, 0.27] };
      const a1 = cpf(e2); K.dots.forEach(d => { a1.a[d.i] = 0; }); K.others.forEach(d => { a1.a[d.i] = 0; });
      F['assumption'] = { s: a1, e: F['nearby-markets'].e };
    } else {
      F['comparison'] = F['comparison-2'] = one(F['burden-split-2'].s);
      F['assumption'] = { s: F['burden-split-2'].s, e: F['nearby-markets'].e };
    }

    /* ===== v8 Round A: map beats ===== */
    // burden-map: re-shade from exposure to b26 extra fuel cost
    F['burden-map'] = { s: mapFrame(M0, C.e, 0.9), e: mapFrame(M0, C.b26, 0.9) };

    // local-markets: zoom to Pennsylvania; dots 4-10px by households
    {
      const B = GEO.paN, fLm = nf();
      for (let i = 0; i < n; i++) {
        if (rows[i].st === 'PA' && valid[i]) {
          const j = D.pa.indexOf(i);
          if (j >= 0) {
            fLm.x[i] = B.x[j]; fLm.y[i] = B.y[j];
            fLm.r[i] = clamp(4 + 6 * Math.sqrt(rows[i].hh / 100000), 4, 10);
            setCol(fLm, i, C.b26); fLm.a[i] = 0.92; fLm.z[i] = 0;
          }
        }
      }
      F['local-markets'] = { s: F['burden-map'].e, e: fLm };
    }

    // races (v8): return to national map; race states in b26 color, others light gray
    {
      const fRc = mapFrame(M0, C.b26, 0.9);
      for (let i = 0; i < n; i++) if (valid[i] && !D.in44[i]) { setCol(fRc, i, C.pale); fRc.a[i] = 0.7; }
      F['races'] = { s: F['local-markets'].e, e: fRc };
    }

    /* ===== v9: map sequence, with separate frames so v8 routes retain their pictures ===== */
    F['exposure'] = { s: mapFrame(P2, small ? C.e : C.grey, 0.9), e: mapFrame(P2, C.e, 0.9) };
    {
      // v9.4 price-local, the zoom in: the dots outside Pennsylvania fade first (p 0.05-0.2), then Pennsylvania's 67 dots expand slowly into the map of the state (0.2-0.45), then they
      // take the colors of the illustrative local rises (0.45-0.6). extra-cost runs the same movement backwards.
      const B = small ? paMapPos({ x: GEO.pad + 4, y: 58, w: W - 2 * GEO.pad - 8, h: H - 108, pad: 0.025 }) : GEO.paN;
      if (small) B.path = realPAPath(B);
      GEO.paPL = B;
      const s = small ? cpf(F['dots-example'].e) : mapFrame(P2, C.e, 0.9), fade = cpf(s), zoom = zoomFrame(B, C.e, 0.96);
      const paSc = small ? clamp(B.box.w / 360, 0.4, 1) : 1;
      const paRadius = i => small ? clamp(4 * paSc, 2.6, 4) : clamp((4 + 5 * Math.sqrt(Math.max(0, rows[i].hh || 0) / 100000)) * paSc, 4, 9);
      for (let i = 0; i < n; i++) if (D.pa.indexOf(i) < 0) fade.a[i] = 0;
      D.pa.forEach(i => { zoom.r[i] = paRadius(i); });
      const e = cpf(zoom); D.pa.forEach(i => { setCol(e, i, C.loc2); });
      F['price-local'] = { s: s, e: e, seq: phone ? [s, zoom, e] : [s, fade, zoom, e], k: phone ? [0.05, 0.28, 0.6] : [0.05, 0.2, 0.45, 0.6] };   // phones: enlarge Pennsylvania while the surrounding counties fade, avoiding a tiny isolated state
      const neutral = zoomFrame(B, C.calm, 0.9);
      D.pa.forEach(i => { neutral.r[i] = paRadius(i); });
      F['markets'] = { s: e, e: neutral };
    }
    // v9.5: the zoom-out from Pennsylvania runs in the build of extra-cost, not during the preceding hand-over (heavy motion belongs in builds)
    {
      const eEnd = mapFrame(P2, C.b26, 0.9), eStart = cpf(eEnd), isPA = new Uint8Array(n);
      D.pa.forEach(i => { isPA[i] = 1; });
      const eExp = mapFrame(P2, C.e, 0.9);
      for (let i = 0; i < n; i++) { if (isPA[i] || phone) { setRgb(eStart, i, [eExp.cr[i], eExp.cg[i], eExp.cb[i]]); } else eStart.a[i] = 0; }
      F['extra-cost'] = { s: F['markets'].e, e: eEnd, m: eStart, k: [0.04, 0.20, 0.40] };
    }
    {
      const covered = cpf(F['extra-cost'].e);
      for (let i = 0; i < n; i++) if (valid[i] && !D.in44[i]) { setCol(covered, i, C.pale); covered.a[i] = 0.7; }
      F['vote-swing'] = { s: F['extra-cost'].e, e: covered };
    }
    F['the-question'] = one(F['vote-swing'].e);

    // idea-tangle: heaviest fifth ringed, others dimmed
    {
      const vals8 = []; for (let i = 0; i < n; i++) if (valid[i] && D.in44[i] && Number.isFinite(D.b26[i])) vals8.push(D.b26[i]);
      vals8.sort((a, b) => a - b); const p80 = vals8[Math.floor(vals8.length * 0.8)];
      const fTg = mapFrame(M0, C.b26, 0.55);
      for (let i = 0; i < n; i++) if (valid[i] && !D.in44[i]) { setCol(fTg, i, C.pale); fTg.a[i] = 0.45; }
      D.tangleRing = [];
      for (let i = 0; i < n; i++) if (valid[i] && D.in44[i] && D.b26[i] >= p80) { fTg.a[i] = 0.95; fTg.z[i] = 1; D.tangleRing.push(i); }
      F['idea-tangle'] = one(fTg);
    }

    // idea-ideal: random fuel-burden shades
    F['idea-ideal'] = { s: mapFrame(M0, C.randB, 0.9), e: mapFrame(M0, C.randB, 0.9) };

    // idea-aim: fuel-burden map under the slice bar
    {
      const fAim = mapFrame(M0, C.b26, 0.9);
      for (let i = 0; i < n; i++) if (valid[i] && !D.in44[i]) { setCol(fAim, i, C.pale); fAim.a[i] = 0.7; }
      F['idea-aim'] = one(fAim);
    }

    // Panel-backdrop frames: dots faint behind the panel's SVG, as v7.2 does for unusual-rise and method-map.
    // idea-route: the map far back behind the overview tiles (as v7.2 method-map)
    F['idea-route'] = one(mapFrame(phone ? P2 : M0, C.b26, phone || tierWide() || tierTablet() ? 0 : 0.3));   // PI 2026-10-30: the map stays visible behind the overview, faded (the outlined dots need more than the old 0.12)
    F['route'] = F['idea-route'];   // v9: the overview is native (no alias)
    // Panel beats where dots are a faint backdrop (the panel draws the figure)
    { const panelBg = one(mapFrame(M0, C.pad, 0.06));
      ['unusual', 'unusual-why', 'group-votes', 'exposure-scale', 'both-sides', 'both-sides-bridge', 'both-sides-total', 'both-sides-line', 'both-sides-remove', 'both-sides-why', 'compare', 'compare-all', 'state-layer', 'state-layer-2', 'adj-pt', 'adj-pt-2', 'adj-lag', 'state-bridge', 'state-comparison', 'state-adj-pt', 'state-adj-lag', 'state-question'].forEach(id => { F[id] = panelBg; }); }
    // state-q: its own run in Part 7; the two-state panel returns, so faint region-colored backdrop
    F['state-q'] = one(mapFrame(M0, C.pad, 0.06));
    // v8 scatter sequence: each index is the same county in every layout.
    const V = GEO.v8;
    const scatter = (g, xv, yv, cols, include, alpha, radius) => {
      const f = nf();
      for (let i = 0; i < n; i++) {
        const ok = include(i) && Number.isFinite(xv[i]) && Number.isFinite(yv[i]);
        const x = ok ? g.xs(xv[i]) : M0.x[i], y = ok ? g.ys(yv[i]) : M0.y[i];
        const cx = clamp(x, g.b.x0 + 3, g.b.x1 - 3), cy = clamp(y, g.b.y0 + 3, g.b.y1 - 3);
        f.x[i] = cx; f.y[i] = cy;
        f.r[i] = radius ? radius(i) : rBase * 0.8 * Math.pow(hhF[i], 0.7);
        f.a[i] = ok ? alpha : 0; f.o[i] = ok && (x !== cx || y !== cy) ? 1 : 0;   // compare in doubles (the Float32 copies never equal x, y)
        if (typeof cols === 'function') setRgb(f, i, cols(i)); else setCol(f, i, cols);
      }
      return f;
    };
    const is16 = i => valid[i] && Number.isFinite(D.sw16[i]);
    const simple = scatter(V.simple, D.b26, D.sw16, C.b26, is16, 0.58);
    F['simple'] = { s: F['idea-aim'].e, e: simple };
    const kinds = cpf(simple);
    for (let i = 0; i < n; i++) setCol(kinds, i, C.kind);
    F['simple-why'] = { s: simple, e: kinds };
    const same = scatter(V.same, D.cB16, D.cS16, C.b26, is16, 0.62);
    F['same-race'] = { s: kinds, e: same };
    F['same-race-steeper'] = one(same);
    const paRadius = i => clamp(4 + 5 * Math.sqrt(rows[i].hh / 100000), 4, 9);
    const pa = scatter(V.pa, D.e, D.sw16, C.paR, i => rows[i].st === 'PA' && is16(i), 0.92, paRadius);
    F['within-exposure'] = { s: same, e: pa };
    const faintPA = cpf(pa); D.pa.forEach(i => { faintPA.a[i] = 0.17; });
    F['within-exposure-2'] = { s: pa, e: faintPA };
    const pricePA = cpf(F['local-markets'].e);
    D.pa.forEach(i => { setCol(pricePA, i, C.loc2); pricePA.a[i] = 0.96; pricePA.r[i] = paRadius(i); });
    F['within-price'] = { s: faintPA, e: pricePA };
    const nearMid = cpf(pricePA), nearEnd = cpf(pricePA);
    D.pa.forEach(i => { setCol(nearMid, i, C.kind); setCol(nearEnd, i, C.kind);
      nearEnd.a[i] = D.blk[i] === PA_GROUP ? 1 : 0.22; nearEnd.z[i] = D.blk[i] === PA_GROUP ? 1 : 0; });
    F['nearby'] = { s: pricePA, m: nearMid, e: nearEnd, k: [0.05, 0.25, 0.40] };

    const fanColor = i => seqRgb(D.yRaw[i], D.recY[0], D.recY[1]);
    const recColor = i => rgbOf(PDIV(clamp(D.yRec[i] / 0.13, -1, 1)));
    const fan = scatter(V.fan, D.dE, D.yRaw, fanColor, i => D.in44[i] && D.fanOk[i], 0.62);
    const fanStart = cpf(fan); for (let i = 0; i < n; i++) fanStart.a[i] = 0;
    F['fan'] = { s: fanStart, e: fan };
    const rec = scatter(V.fan, D.dE, D.yRec, recColor, i => D.in44[i] && D.fanOk[i], 0.7);
    F['fan-2'] = { s: fan, e: rec };
    F['fan-3'] = one(rec);
    const slope = scatter(V.slope, D.yRec, D.voteSim, recColor, i => D.in44[i] && D.fanOk[i], 0.62);
    F['all-groups'] = { s: rec, e: slope };
    const slopeIds = []; for (let i = 0; i < n; i++) if (D.in44[i] && D.fanOk[i]) slopeIds.push(i);
    D.v8Slope = wfit(slopeIds.map(i => D.yRec[i]), slopeIds.map(i => D.voteSim[i]), slopeIds.map(i => rows[i].hh));
    F['assumption'] = { s: slope, e: nearEnd };
    const padMap = mapFrame(M0, C.pad, 0.91);
    const padStart = cpf(padMap); for (let i = 0; i < n; i++) padStart.a[i] = 0;
    F['state-layer-3'] = { s: padStart, e: padMap };
    F['adj-prior'] = { s: F['adj-oil'].e, e: mapFrame(M1, C.p24, 0.92) };

    // eq-1 ... eq-4: the equation panel on a faint county map (as v7.2's recap)
    const eqBg = one(mapFrame(M0, C.pad, 0.06));
    ['eq-1', 'eq-2', 'eq-3', 'eq-4', 'stock-take'].forEach(id => { F[id] = eqBg; });

    // v9 line-up: real extra fuel cost only. The earlier v8 scatter frames stay
    // available to the v8 beats that were built from their local variables.
    {
      const A = GEO.v9.lineup, b = A.b, ids = [];
      for (let i = 0; i < n; i++) if (valid[i] && D.in44[i] && Number.isFinite(D.b26[i])) ids.push(i);
      let r = clamp(rBase, 1.1, 2.6), placed;
      do {
        placed = lineupBeeswarm(ids, A.xs, b, r);
        if (placed.height <= (phone ? 0.88 : 0.7) * (b.y1 - b.y0) || r <= (phone ? 0.55 : 0.9)) break;
        r = Math.max(phone ? 0.55 : 0.9, r * 0.93);
      } while (true);
      A.r = r; A.stackHeight = placed.height; A.count = ids.length;
      const f = nf(), maxX = A.xs.domain()[1];
      for (let i = 0; i < n; i++) {
        f.x[i] = M0.x[i]; f.y[i] = M0.y[i]; f.r[i] = r;
        setCol(f, i, C.b26); f.a[i] = 0;
      }
      let beyond = 0;
      placed.order.forEach(v => {
        const i = v.i;
        f.x[i] = v.x; f.y[i] = placed.y[i]; f.a[i] = 0.85;
        if (D.b26[i] > maxX) { f.o[i] = 1; beyond++; }
      });
      A.beyond = beyond;
      // v9.3: the line-up first (stage 1), then the dots rise to MOCK vote shifts on a new y-axis (stage 2); the mock figure stays through simple-why
      const mock = cpf(f);
      D.mockIds.forEach(i => { mock.y[i] = clamp(A.ys(D.mockSw[i]), b.y0 + 3, b.y1 - 3); mock.a[i] = 0.62; });
      F['simple'] = { s: F['the-question'].e, e: f };
      F['simple-votes'] = { s: f, e: mock };
      const kinds9 = cpf(mock);
      for (let i = 0; i < n; i++) setCol(kinds9, i, C.kind);
      F['simple-why'] = { s: mock, e: kinds9 };
      // least-squares line through the mock values (drawn faintly in the line-up furniture)
      { const ids = D.mockIds, mx = d3.mean(ids, i => D.b26[i]), my = d3.mean(ids, i => D.mockSw[i]);
        let sxy = 0, sxx = 0; ids.forEach(i => { sxy += (D.b26[i] - mx) * (D.mockSw[i] - my); sxx += (D.b26[i] - mx) * (D.b26[i] - mx); });
        const sl = sxy / sxx; A.fit = { a: my - sl * mx, b: sl }; }
    }
    // v9.5: ideal's build is the fly-back (dots return from the line-up to the map); it was in the t of simple-why.
    // ideal-shuffle and close-to-random move the colors as particles (see prepShuffle);
    // these frames are what is left under reduced motion, a cross-fade between the real and the shuffled colors.
    {
      const real = cpf(F['the-question'].e);
      if (phone || tierWide()) { const m = mapPos({ x: GEO.pad, y: 34, w: W - 2 * GEO.pad, h: H - (tierWide() ? Math.max(34, window.SLICE_BAND || 0) + 114 : 98) });
        if (tierWide()) GEO.ideal = m;
        for (let i = 0; i < n; i++) { real.x[i] = m.x[i]; real.y[i] = m.y[i]; real.r[i] = clamp(m.w / 300, 0.7, 1.3) * Math.min(1.2, Math.pow(hhF[i], 0.25)); }
      }
      const shuffled = cpf(real);
      for (let i = 0; i < n; i++) {
        if (!valid[i]) continue;
        if (D.in44[i] && Number.isFinite(D.b26[i])) { setCol(shuffled, i, C.perm); shuffled.a[i] = 0.9; } else { setCol(shuffled, i, C.pale); shuffled.a[i] = 0.7; }
      }
      F['ideal'] = { s: cpf(F['simple-why'].e), e: cpf(real) };
      F['ideal-shuffle'] = { s: cpf(real), e: shuffled };
      F['close-to-random'] = { s: cpf(shuffled), e: cpf(real) };
    }

    // v9 method sequence: keep the v7.2 strip drawings while restoring every
    // hand-over from the routed beat immediately before it.
    F['same-race'] = { s: cpf(F['idea-route'].e), e: cpf(F['races-cost'].s) };
    F['same-race-2'] = { s: cpf(F['same-race'].e), e: cpf(F['races-cost'].e) };
    const isPA = new Uint8Array(n);
    D.pa.forEach(i => { isPA[i] = 1; });
    {
      // v9.4: Pennsylvania in local markets. nearby-intro: the other strips fade (in the t of same-race-2), Pennsylvania's 67 dots move from their strip onto the map (p 0-0.13),
      // slide together by market (0.13-0.22), merge into one dot per market, sized by households (0.22-0.27), and take their kind colors (0.27-0.33).
      // nearby-groups: only the metropolitan markets keep their color. assumption ends on the same picture.
      const B = GEO.pa9, sk = (small ? 0.75 : 1) * (B.dotScale || 1);
      const rc = i => clamp(4 + 5 * Math.sqrt(Math.max(0, rows[i].hh || 0) / 100000), 4, 9) * sk;
      const hhOf = m => d3.sum(m.js, j => rows[D.pa[j]].hh || 0), hhMax = d3.max(D.paMk, hhOf) || 1;
      B.mk = D.paMk.map(m => {                                        // one entry per market: its center on the map, the county whose dot stands for it, and that dot's radius
        const rep = m.js.reduce((a, j) => (rows[D.pa[j]].hh || 0) > (rows[D.pa[a]].hh || 0) ? j : a, m.js[0]);
        return { m: m, x: d3.mean(m.js, j => B.x[j]), y: d3.mean(m.js, j => B.y[j]), rep: D.pa[rep], r: (3.2 + 8.3 * Math.sqrt(hhOf(m) / hhMax)) * sk };
      });
      const focus = cpf(F['same-race-2'].e);
      for (let i = 0; i < n; i++) if (!isPA[i]) focus.a[i] = 0;
      const zoom = cpf(focus);
      D.pa.forEach((i, j) => { zoom.x[i] = B.x[j]; zoom.y[i] = B.y[j]; zoom.r[i] = rc(i); zoom.a[i] = 0.96; });
      const slid = cpf(zoom), merged = cpf(zoom);
      B.mk.forEach(e => e.m.js.forEach(j => { const i = D.pa[j]; slid.x[i] = merged.x[i] = e.x; slid.y[i] = merged.y[i] = e.y; if (i === e.rep) merged.r[i] = e.r; else merged.a[i] = 0; }));
      const kinds = cpf(merged);
      D.pa.forEach(i => { setCol(kinds, i, C.kind); });
      const end = cpf(kinds);
      B.mk.forEach(e => { const metro = e.m.kind === 0; end.a[e.rep] = metro ? 0.96 : 0.25; end.z[e.rep] = metro ? 1 : 0; });
      F['nearby-intro'] = { s: focus, e: kinds, seq: [focus, zoom, slid, merged, kinds], k: [0, 0.10, 0.18, 0.27, 0.33] };   // PI 2026-10-29: the colors while the text names them (was 0.25/0.42/0.5/0.62)
      F['nearby-groups'] = { s: cpf(kinds), e: end };
      F['nearby'] = F['nearby-groups'];                               // v8 id, unrouted
      // v9.5: the zoom-out from Pennsylvania markets runs in unusual's build, not in the preceding hand-over
      { const bg = F['unusual']; F['unusual'] = { s: cpf(end), e: bg.e || bg.s, m: bg.s, k: [0.04, 0.20, 0.20] }; }
      F['assumption'] = { s: cpf(F['unusual'].e), e: cpf(end) };

      // The SVG scatter owns these marks through compare-all; matching canvas dots
      // appear at the same coordinates during its hand-over to assumption.
      const api = window.DOTS_PANELS && window.DOTS_PANELS.group && window.DOTS_PANELS.group.scatterDots;
      if (typeof api === 'function') try {
        const band = window.VIS.slice && typeof window.VIS.slice.bandHeight === 'function' ? window.VIS.slice.bandHeight() : small ? 34 : 46;
        const theme = window.THEME || {}, dots = api(W, H, small, band, theme);
        if (!dots || !dots.persistent || dots.persistent.length !== 16 || !dots.cloud || dots.cloud.length !== 300) throw new Error('scatter dot count');
        // the scatter's first dots stand in for the group's own markets, then for the other markets' main dots, so the ones that fly in are the ones that stay on the map
        const isRep = new Uint8Array(n); B.mk.forEach(e => { isRep[e.rep] = 1; });
        const inG = i => D.blk[i] === PA_GROUP;
        const ids = D.pa.filter(i => valid[i] && inG(i) && isRep[i]).concat(D.pa.filter(i => valid[i] && inG(i) && !isRep[i]),
          D.pa.filter(i => valid[i] && !inG(i) && isRep[i]), D.pa.filter(i => valid[i] && !inG(i) && !isRep[i]));
        const used = new Uint8Array(n); ids.forEach(i => { used[i] = 1; });
        for (let i = 0; i < n; i++) if (valid[i] && !used[i]) ids.push(i);
        const panel = cpf(F['compare-all'].e), scatterFrame = cpf(panel), scatterEnd = cpf(end);
        for (let i = 0; i < n; i++) scatterFrame.a[i] = 0;
        const high = hexRgb(Array.isArray(theme.price) ? theme.price[1] : '#5E4A8B');
        const low = hexRgb(theme.priceLow || '#6B7785'), ink = hexRgb(theme.ink || T.ink);
        dots.persistent.concat(dots.cloud).forEach((d, j) => {
          const i = ids[j], persistent = j < dots.persistent.length, col = persistent ? d.m === 1 ? high : low : ink;
          panel.x[i] = scatterFrame.x[i] = d.x; panel.y[i] = scatterFrame.y[i] = d.y;
          panel.r[i] = scatterFrame.r[i] = d.r; panel.a[i] = 0;
          setRgb(panel, i, col); setRgb(scatterFrame, i, col);
          scatterFrame.a[i] = persistent ? 0.9 : 0.22;
          if (!isPA[i]) {
            scatterEnd.x[i] = d.x; scatterEnd.y[i] = d.y; scatterEnd.r[i] = d.r;
            setRgb(scatterEnd, i, col);
          }
        });
        F['compare-all'] = one(panel);
        F['assumption'] = { s: scatterFrame, e: scatterEnd };
      } catch (e) { console.error('[dots] scatter hand-off', e); }
    }
    {
      // v9.4 adj-oil: the zoom out of extra-cost, from Pennsylvania's markets to the national map (only Pennsylvania's counties stand on the map at first, pale), then the other
      // counties fade in and the counties in local markets where oil and gas are above 2% of jobs are highlighted (oil_m: website/tools/build_site_oil_markets.py)
      const MA = MAP.MAdj, pale = mapFrame(MA, phone ? C.calm : C.pale, phone ? 0.82 : 0.5), oil = cpf(pale), start = cpf(pale);
      for (let i = 0; i < n; i++) {
        if (D.oilM[i] > D.oilThr) { setCol(oil, i, C.acc); oil.a[i] = 0.95; oil.z[i] = 1; oil.r[i] *= 1.2; }
        if (!isPA[i]) { if (!phone) start.a[i] = 0; } else { setCol(start, i, C.kind); start.a[i] = 0.85; }      // phones bring the national context back while Pennsylvania shrinks
      }
      F['adj-brief'] = { s: cpf(F['assumption'].e), e: pale, m: start, k: phone ? [0.02, 0.10, 0.20] : [0.04, 0.20, 0.40] };
      F['adj-oil'] = { s: cpf(pale), e: oil };
      const where = mapFrame(phone ? MAP.MWh : MA, C.where, 0.92);
      for (let i = 0; i < n; i++) if (!D.in44[i]) where.a[i] = 0.3;
      F['scope-where'] = { s: phone ? mapFrame(MAP.MWh, C.calm, 0.82) : cpf(pale), e: where };
      F['adj-prior'] = { s: cpf(oil), e: mapFrame(MA, C.p24, 0.92) };
    }
    F['state-layer-3'] = { s: cpf(F['state-layer-2'].e), e: cpf(padMap) };
    // v9.4: the supply-region map sits between the two state panels; it fades in from the first (the faint backdrop) and out to the second, and the regions come in one at a time (regionProgress)
    F['state-regions'] = { s: cpf(F['state-comparison'].e), e: cpf(padMap) };
    F['state-map'] = F['state-regions'];                              // the id main.js's alias still sends until that line is deleted
    // v9.5: adj-state is the supply-region map entered from adj-prior (the prior map fades into the region colors)
    F['adj-state'] = { s: cpf(F['adj-prior'].e), e: phone ? mapFrame(MAP.MReg, C.pad, 0.91) : cpf(padMap) };

    out = nf();
    prepShuffle();
  }

  // Two slices: the dots of the what-is-left scatter (frame `from`) travel into the first strip; two more layers (copies) travel on into the second and third.
  let SLF = null;
  function buildSliceFrames(from) {
    SLF = null; const Sg = GEO.sl; if (!D.sl || !Sg || !Sg.band) { F['two-slices'] = { s: from, e: from }; return; }
    const fr = [nf(), nf(), nf()], M0 = MAP.M0, rr = Sg.rr;
    for (let k = 0; k < 3; k++) {
      const f = fr[k], b = Sg.band[k], v = D.sl.v[k];
      for (let i = 0; i < n; i++) {
        if (D.fanOk[i]) {
          const r2 = rr * Math.pow(hhF[i], 0.35);
          f.x[i] = Sg.X(v[i]);
          f.y[i] = Sg.lanes ? b.y0 + Sg.laneH * D.sl.ri[i] + r2 + D.sl.j[k][i] * Math.max(0, Sg.laneH - 2 * r2) : b.y0 + r2 + D.sl.j[k][i] * Math.max(0, Sg.hb - 2 * r2);
          f.r[i] = r2; f.a[i] = 0.74;
        } else { f.x[i] = M0.x[i]; f.y[i] = M0.y[i]; f.r[i] = 1; f.a[i] = 0; }
        setCol(f, i, C.pad);
      }
    }
    SLF = { f: fr, L2: cpf(fr[0]), L3: cpf(fr[0]) };
    F['two-slices'] = { s: from, e: fr[0] };
  }

  /* ---------- svg helpers ---------- */
  function S(parent, tag, attrs) { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, k === 'font-size' ? fz(attrs[k]) : attrs[k]); parent.appendChild(e); return e; }
  function measure(str, size, weight) { mctx.font = (weight || 400) + ' ' + fz(size) + 'px ' + FONT; return mctx.measureText(str).width; }
  function wrapLines(str, maxW, size, weight) {
    const out2 = []; String(str).split('\n').forEach(par => {
      const words = par.split(/\s+/); let ln = '';
      words.forEach(w => { const tryL = ln ? ln + ' ' + w : w; if (ln && measure(tryL, size, weight) > maxW) { out2.push(ln); ln = w; } else ln = tryL; });
      out2.push(ln);
    });
    return out2;
  }
  // Wrapped lines of about equal length: the narrowest width that keeps the line count of a wrap at maxW.
  function balancedLines(str, maxW, size, weight) {
    const base = wrapLines(str, maxW, size, weight); if (base.length < 2) return base;
    let lo = maxW / base.length, hi = maxW;
    for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; if (wrapLines(str, mid, size, weight).length > base.length) lo = mid; else hi = mid; }
    return wrapLines(str, hi, size, weight);
  }
  // Text with an optional wrap width and halo. Returns {el, w, h, lines}.
  function text(parent, x, y, str, o) {
    o = o || {};
    const size = o.size || 13, lh = (o.lh || 1.3) * fz(size);
    const lines = o.w ? wrapLines(str, o.w, size, o.weight) : String(str).split('\n');
    const t = S(parent, 'text', { x: x, y: y, 'font-size': size, 'font-weight': o.weight || 400, fill: o.fill || T.ink, 'text-anchor': o.anchor || 'start', 'paint-order': 'stroke', stroke: T.bg, 'stroke-width': o.halo == null ? 3 : o.halo, 'stroke-linejoin': 'round' });
    if (o.italic) t.setAttribute('font-style', 'italic');
    lines.forEach((ln, k) => { const ts = S(t, 'tspan', { x: x, dy: k ? lh : 0 }); ts.textContent = ln; });
    let w = 0; lines.forEach(l => { w = Math.max(w, measure(l, size, o.weight)); });
    if (o.plate && phone) { const left = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x, r = S(parent, 'rect', { x: left - 3, y: y - fz(size) - 1, width: w + 6, height: lines.length * lh + 3, fill: T.bg }); parent.insertBefore(r, t); }
    return { el: t, w: w, h: lines.length * lh, lines: lines.length, lh: lh };
  }
  const restorePhone = () => phone && window.innerHeight > window.innerWidth;
  function phoneCallout(g, x, y, str, w, tgt, col) {
    const ls = wrapLines(str, w, 12, 500), bw = Math.max(...ls.map(l => measure(l, 12, 500))), bottom = y + (ls.length - 1) * fz(12) * 1.3 + 5;
    if (tgt) {
      const sx = clamp(tgt[0], x - 4, x + bw + 4), sy = tgt[1] < y - fz(12) ? y - fz(12) - 5 : bottom + 4;
      arrow(g, sx, sy, tgt[0], tgt[1], { stroke: col || T.ink, gap: 5 });
    }
    text(g, x, y, str, { size: 12, weight: 500, w: w, fill: col || T.ink, halo: 0, plate: true });
  }
  function line(parent, x1, y1, x2, y2, o) {
    o = o || {};
    return S(parent, 'line', { x1: x1, y1: y1, x2: x2, y2: y2, stroke: o.stroke || T.ink, 'stroke-width': o.w || 1, 'stroke-dasharray': o.dash || '', 'stroke-linecap': 'round', opacity: o.op == null ? 1 : o.op });
  }
  const markerOf = col => col === T.accent ? 'dots-ah-acc' : col === T.muted ? 'dots-ah-mut' : 'dots-ah-ink';
  function arrow(parent, x1, y1, x2, y2, o) {
    o = o || {};
    const col = o.stroke || T.ink;
    // stop short of the target by `gap` px
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, gap = o.gap == null ? 3 : o.gap;
    return S(parent, 'line', { x1: x1, y1: y1, x2: x2 - dx / L * gap, y2: y2 - dy / L * gap, stroke: col, 'stroke-width': o.sw || 1, 'stroke-dasharray': o.dash || '', 'stroke-linecap': 'round', 'marker-end': 'url(#' + markerOf(col) + ')' });
  }
  function group(parent, cls) { return S(parent, 'g', { class: cls || '' }); }
  function setupDefs() {
    defs = S(svg, 'defs');
    [['dots-ah-ink', T.ink], ['dots-ah-acc', T.accent], ['dots-ah-mut', T.muted]].forEach(([id, col]) => {
      const m = S(defs, 'marker', { id: id, viewBox: '0 0 10 10', refX: 8.5, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
      S(m, 'path', { d: 'M1.5,1.5 L8.5,5 L1.5,8.5', fill: 'none', stroke: col, 'stroke-width': 1.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    });
    const hp = S(defs, 'pattern', { id: 'dots-hatch', width: 7, height: 7, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    S(hp, 'line', { x1: 0, y1: 0, x2: 0, y2: 7, stroke: T.muted, 'stroke-width': 1, opacity: 0.35 });
  }

  /* occupancy grid of one or more frames, to keep labels and arrows off the dots. extra: points; rects: blocked rectangles [x0, y0, x1, y1] */
  function occOf(frames, thr, extra, rects) {
    const cs = 6, nx = Math.ceil(W / cs) + 1, ny = Math.ceil(HF / cs) + 1, cnt = new Uint16Array(nx * ny);
    (Array.isArray(frames) ? frames : frames ? [frames] : []).forEach(f => {
      for (let i = 0; i < n; i++) if (f.a[i] > (thr == null ? 0.2 : thr)) {
        const cx = clamp(Math.floor(f.x[i] / cs), 0, nx - 1), cy = clamp(Math.floor(f.y[i] / cs), 0, ny - 1); cnt[cy * nx + cx]++;
      }
    });
    (extra || []).forEach(pq => { const cx = clamp(Math.floor(pq[0] / cs), 0, nx - 1), cy = clamp(Math.floor(pq[1] / cs), 0, ny - 1); cnt[cy * nx + cx]++; });
    (rects || []).forEach(r => {
      const a = clamp(Math.floor(r[0] / cs), 0, nx - 1), b = clamp(Math.floor(r[1] / cs), 0, ny - 1), c = clamp(Math.ceil(r[2] / cs), 0, nx), d = clamp(Math.ceil(r[3] / cs), 0, ny);
      for (let y = b; y < d; y++) for (let x = a; x < c; x++) cnt[y * nx + x] += 4;
    });
    const I = new Uint32Array((nx + 1) * (ny + 1));
    for (let y = 0; y < ny; y++) { let rs = 0; for (let x = 0; x < nx; x++) { rs += cnt[y * nx + x]; I[(y + 1) * (nx + 1) + x + 1] = I[y * (nx + 1) + x + 1] + rs; } }
    const rect = (x0, y0, x1, y1) => {
      const a = clamp(Math.floor(x0 / cs), 0, nx), b = clamp(Math.floor(y0 / cs), 0, ny), c = clamp(Math.ceil(x1 / cs), 0, nx), d = clamp(Math.ceil(y1 / cs), 0, ny);
      return I[d * (nx + 1) + c] - I[b * (nx + 1) + c] - I[d * (nx + 1) + a] + I[b * (nx + 1) + a];
    };
    const seg = (x1, y1, x2, y2) => {
      const L = Math.hypot(x2 - x1, y2 - y1), m = Math.max(2, Math.ceil(L / 3)); let c = 0;
      for (let k = 0; k <= m; k++) { const x = lerp(x1, x2, k / m), y = lerp(y1, y2, k / m); c += rect(x - 2, y - 2, x + 2, y + 2); }
      return c;
    };
    return { rect: rect, seg: seg };
  }
  // Find a free w x h box near (tx, ty) inside bounds.
  function emptySpot(occ, w, h, tx, ty, bd) {
    let best = null;
    for (let y = bd.y0; y <= bd.y1 - h; y += 6) for (let x = bd.x0; x <= bd.x1 - w; x += 6) {
      const c = occ.rect(x, y, x + w, y + h); if (best && c * 150 > best.cost) continue;
      const d = Math.hypot(x + w / 2 - tx, y + h / 2 - ty), cost = c * 150 + d;
      if (!best || cost < best.cost) best = { x: x, y: y, c: c, cost: cost };
    }
    return best || { x: bd.x0, y: bd.y0, c: 0 };
  }

  // Rectangles that hold the legends of the exposure maps (bottom left, and the dot-size key at the bottom right).
  function legRects() { return [[0, H - (small ? 78 : 112), small ? W : GEO.pad + 390, H], [W - GEO.pad - 230, H - (small ? 64 : 110), W, H - (small ? 30 : 66)]]; }

  // v9.3: the area taken by the ev8 exposure legend (color bar with its title, and the dot-size key beside the bar); callouts keep out of it
  function legRectsEv8() {
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0), y = H - band - (small ? 60 : 92);
    return [[0, y - 8, small ? W : GEO.pad + 300 + 40 + 230, H]];
  }

  /* ---------- curved arrows, blobs and notes ---------- */
  function curveD(x1, y1, x2, y2, bend) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, b = bend * L;
    return 'M' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' Q' + ((x1 + x2) / 2 - dy / L * b).toFixed(1) + ',' + ((y1 + y2) / 2 + dx / L * b).toFixed(1) + ' ' + x2.toFixed(1) + ',' + y2.toFixed(1);
  }
  // Point at u along the curve of curveD.
  function curveAt(x1, y1, x2, y2, bend, u) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, b = bend * L, cx = (x1 + x2) / 2 - dy / L * b, cy = (y1 + y2) / 2 + dx / L * b;
    return [(1 - u) * (1 - u) * x1 + 2 * u * (1 - u) * cx + u * u * x2, (1 - u) * (1 - u) * y1 + 2 * u * (1 - u) * cy + u * u * y2];
  }
  // A curved arrow from (x1, y1) to (x2, y2) that stops `gap` px short of the target. bend: share of the length the curve bows out by (sign picks the side).
  function carrow(parent, x1, y1, x2, y2, o) {
    o = o || {};
    const col = o.stroke || T.ink, id = markerOf(col);
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, gap = o.gap == null ? 3 : o.gap, g0 = o.both ? gap : 0;
    const p = S(parent, 'path', { d: curveD(x1 + dx / L * g0, y1 + dy / L * g0, x2 - dx / L * gap, y2 - dy / L * gap, o.bend == null ? 0.25 : o.bend), fill: 'none', stroke: col, 'stroke-width': o.sw || 1, 'stroke-linecap': 'round', 'marker-end': 'url(#' + id + ')' });
    if (o.both) p.setAttribute('marker-start', 'url(#' + id + ')');
    return p;
  }
  // Outline path round a set of points: a circle for one, a stadium for two, a grown smooth hull for more.
  function blob(pts, pad) {
    if (pts.length === 1) { const x = pts[0][0], y = pts[0][1]; return 'M' + (x - pad) + ',' + y + ' a' + pad + ',' + pad + ' 0 1,0 ' + 2 * pad + ',0 a' + pad + ',' + pad + ' 0 1,0 ' + (-2 * pad) + ',0Z'; }
    const stad = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L * pad, ny = dx / L * pad;
      return 'M' + (a[0] + nx) + ',' + (a[1] + ny) + ' L' + (b[0] + nx) + ',' + (b[1] + ny) + ' A' + pad + ',' + pad + ' 0 0,0 ' + (b[0] - nx) + ',' + (b[1] - ny) + ' L' + (a[0] - nx) + ',' + (a[1] - ny) + ' A' + pad + ',' + pad + ' 0 0,0 ' + (a[0] + nx) + ',' + (a[1] + ny) + 'Z';
    };
    if (pts.length === 2) return stad(pts[0], pts[1]);
    const hull = d3.polygonHull(pts);
    if (!hull || hull.length < 3) { let a = pts[0], b = pts[0], dm = 0; pts.forEach(p => pts.forEach(q => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d > dm) { dm = d; a = p; b = q; } })); return stad(a, b); }
    const cx = d3.mean(hull, q => q[0]), cy = d3.mean(hull, q => q[1]);
    const grown = hull.map(q => { const dx = q[0] - cx, dy = q[1] - cy, L = Math.hypot(dx, dy) || 1; return [q[0] + dx / L * pad, q[1] + dy / L * pad]; });
    return d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))(grown);
  }
  const statePts = (f, st) => (D.byState[st] || []).filter(i => valid[i]).map(i => [f.x[i], f.y[i]]);

  /* A label near a target, with an arrow to it. lines: [bold, muted...]. The label goes in the free spot closest to the target (by occupancy, then distance), so
     arrows stay short at any width. Options: w (wrap width), dmin/dmax (gap between label and target), ang (preferred direction, radians, y down), pts (candidate
     arrow tips: the arrow ends at the one nearest the label), curve (bend), stroke, gap, bounds, fill. Returns the label box. */
  function note(g, occ, tgt, lines, o) {
    o = o || {};
    const size = o.size || 13, lh = size * 1.3, wMax = o.w || (small ? Math.min(210, W * 0.56) : 250);
    const items = [{ s: lines[0], weight: 600, fill: o.fill || T.ink }].concat(lines.slice(1).map(s => ({ s: s, weight: 400, fill: T.muted })));
    let bw2 = 0, bh2 = 0; const wrapped = items.map(it => { const ls = wrapLines(it.s, wMax, size, it.weight); ls.forEach(l => { bw2 = Math.max(bw2, measure(l, size, it.weight)); }); bh2 += ls.length * lh; return ls; });
    bw2 += 4; bh2 += 2;
    const bd = o.bounds || { x0: GEO.pad, y0: Math.max(24, CUR_HB + 2), x1: W - GEO.pad, y1: H - 2 };
    const dmin = o.dmin == null ? 12 : o.dmin, dmax = o.dmax || (small ? 90 : clamp(W * 0.1, 80, 140));
    let best = null;
    const tryBox = (x, y, d, a) => {
      if (x < bd.x0 || y < bd.y0 || x + bw2 > bd.x1 || y + bh2 > bd.y1) return;
      const c = occ ? occ.rect(x, y, x + bw2, y + bh2) : 0;
      let ov = 0; USED.forEach(u => { if (x < u[2] + 4 && x + bw2 > u[0] - 4 && y < u[3] + 3 && y + bh2 > u[1] - 3) ov++; });
      const sx = clamp(tgt[0], x, x + bw2), sy = clamp(tgt[1], y, y + bh2), ca = occ ? occ.seg(sx, sy, tgt[0], tgt[1]) : 0;
      let cost = c * 150 + ov * 1500 + ca * 25 + d;
      if (o.ang != null) { let da = Math.abs(a - o.ang) % (2 * Math.PI); if (da > Math.PI) da = 2 * Math.PI - da; cost += da * 14; }
      if (!best || cost < best.cost) best = { cost: cost, x: x, y: y };
    };
    for (let d = dmin; d <= dmax; d += 8) for (let k = 0; k < 24; k++) {
      const a = k / 24 * 2 * Math.PI, ux = Math.cos(a), uy = Math.sin(a), ext = Math.abs(ux) * bw2 / 2 + Math.abs(uy) * bh2 / 2;
      tryBox(tgt[0] + ux * (d + ext) - bw2 / 2, tgt[1] + uy * (d + ext) - bh2 / 2, d, a);
    }
    if (!best) {                                               // nothing free in range: take the closest position inside the bounds
      const sp = emptySpot(occ || { rect: () => 0 }, bw2, bh2, tgt[0], tgt[1], bd); best = { x: sp.x, y: sp.y };
    }
    // v9.4 QA: never on top of a label already placed (two labels in a short panel used to land on the same spot)
    const hit = (x, y) => USED.some(u => x < u[2] + 4 && x + bw2 > u[0] - 4 && y < u[3] + 3 && y + bh2 > u[1] - 3);
    if (hit(best.x, best.y)) {
      let alt = null;
      for (let yy2 = bd.y0; yy2 + bh2 <= bd.y1; yy2 += 4) for (let xx = bd.x0; xx + bw2 <= bd.x1; xx += 6) {
        if (hit(xx, yy2)) continue;
        const sx2 = clamp(tgt[0], xx, xx + bw2), sy2 = clamp(tgt[1], yy2, yy2 + bh2), dd = Math.hypot(sx2 - tgt[0], sy2 - tgt[1]) + (occ ? occ.rect(xx, yy2, xx + bw2, yy2 + bh2) * 150 + occ.seg(sx2, sy2, tgt[0], tgt[1]) * 25 : 0);
        if (!alt || dd < alt.d) alt = { d: dd, x: xx, y: yy2 };
      }
      if (alt) best = { x: alt.x, y: alt.y };
    }
    if (o.plate && phone) S(g, 'rect', { x: best.x - 2, y: best.y - 2, width: bw2 + 4, height: bh2 + 4, fill: T.bg });
    let yy = best.y + size;
    items.forEach((it, k) => { wrapped[k].forEach(l => { text(g, best.x + 2, yy, l, { size: size, weight: it.weight, fill: it.fill }); yy += lh; }); });
    USED.push([best.x, best.y, best.x + bw2, best.y + bh2]);
    if (o.noArrow) return { x: best.x, y: best.y, w: bw2, h: bh2 };
    // arrow: from the label's nearest edge to the target (or to the nearest candidate tip)
    let tip = tgt;
    if (o.pts && o.pts.length) { let bd2 = 1e9; const cxm = best.x + bw2 / 2, cym = best.y + bh2 / 2; o.pts.forEach(p => { const d = Math.hypot(p[0] - cxm, p[1] - cym); if (d < bd2) { bd2 = d; tip = p; } }); }
    let sx = clamp(tip[0], best.x, best.x + bw2), sy = clamp(tip[1], best.y, best.y + bh2);
    if (sx > best.x && sx < best.x + bw2 && sy > best.y && sy < best.y + bh2) {          // tip inside the box: leave from the nearest side
      const dl = sx - best.x, dr = best.x + bw2 - sx, dt = sy - best.y, db = best.y + bh2 - sy, m = Math.min(dl, dr, dt, db);
      if (m === dl) sx = best.x; else if (m === dr) sx = best.x + bw2; else if (m === dt) sy = best.y; else sy = best.y + bh2;
    }
    const vx = tip[0] - sx, vy = tip[1] - sy, vl = Math.hypot(vx, vy) || 1;
    sx -= vx / vl * 2; sy -= vy / vl * 2;
    if (vl > 6) { if (o.curve) carrow(g, sx, sy, tip[0], tip[1], { stroke: o.stroke || T.ink, gap: o.gap == null ? 4 : o.gap, bend: o.curve }); else arrow(g, sx, sy, tip[0], tip[1], { stroke: o.stroke || T.ink, gap: o.gap == null ? 4 : o.gap }); }
    return { x: best.x, y: best.y, w: bw2, h: bh2 };
  }

  /* ---------- annotations and furniture ---------- */
  const ANN_ALIAS = { 'two-analyses-2': 'two-analyses' };      // beats whose annotation group is another beat's (the figure is held, not rebuilt)
  const KEYF = ['keyAx', 'keyA', 'keyB', 'keyCap', 'reminder'];
  const FURN = {
    'dots-intro': ['leg-ev8'], 'dots-example': ['leg-ev8'], 'races-covered': ['leg-e'], 'dots-question': ['leg-b26'],
    'simplest-axes': ['ax22'], 'simplest-slope': ['ax22'], 'races': ['strips'], 'races-cost': ['strips', 'aside'], 'within-race': ['strips', 'aside'],
    'exposure-problem': ['strips', 'aside', 'pa', 'reminder'], 'exposure-problem-2': ['pa', 'reminder'], 'price-problem': ['leg-reg', 'reminder'], 'price-problem-2': ['reminder'],
    'gaps-same': KEYF, 'gaps-bigger': KEYF, 'gaps-difference': KEYF.concat(['keyR']),
    'comparable-states': ['leg-pad', 'reminder'], 'comparable-metros': ['reminder'],
    'nearby-markets': ['reminder'], 'state-part': [], 'comparison': ['cmpY', 'cmpCols'], 'comparison-2': ['cmpY', 'cmpCols'], 'assumption': ['reminder'],
    'adj-passthrough': ['bar', 'reminder'], 'adj-lagged': ['bar', 'reminder'], 'adj-oil': ['bar', 'reminder'], 'adj-prior': ['bar', 'reminder'],
    'what-is-left': ['fan', 'reminder'], 'two-slices': ['fan', 'slices'],
    // v8 map beats
    'burden-map': ['leg-b26v8'], 'local-markets': [], 'exposure': ['leg-ev8'], 'price-local': [], 'markets': ['hd:priceLocal'],
    'extra-cost': ['leg-b26v8'], 'vote-swing': ['leg-b26v8'], 'the-question': ['leg-b26v8'], 'idea-aim': [],
    'idea-tangle': [], 'idea-ideal': [],
    'simple': ['lineup'], 'simple-why': ['lineup'], 'ideal': ['leg-b26v8'], 'same-race': ['v8same'], 'same-race-steeper': ['v8same'],
    'within-exposure': ['v8pa'], 'within-exposure-2': ['v8pa'], 'within-price': [], 'nearby': [],
    'fan': ['v8fan'], 'fan-2': ['v8fan'], 'fan-3': ['v8fan'], 'all-groups': ['v8slope'],
    'state-layer-3': ['leg-pad'], 'state-map': ['leg-pad']
  };
  const LIVE_FUR = ['strips', 'aside', 'pa', 'bar', 'keyA', 'keyB', 'keyR', 'slices', 'cmpCols', 'cmpY', 'lineup', 'leg-pad'];       // furniture with a part driven by the progress of the beat that owns it

  /* v7.2 [S2, S1]: figure headings, one grammar. A title (Barlow 600, 16px, 15px on phones, ink) at the top left, an optional muted subtitle, an optional boxed
     tag ("Illustrative") at the top right in the style of charts.js. A heading is furniture shared by the beats that show the same figure, so it stays put across them and
     cross-fades with the figure at a hand-over. Texts are [long, short (phones)]. inP: the heading fades in over this range of p in its first beat (comparison, [4.5]). */
  const HEADS = {
    exp: { t: ['Exposure to the price of gas, by county', 'Exposure to the price of gas'] },
    cov: { t: ['Counties in the races the analysis covers', 'Counties in the races covered'] },
    bq: { t: ['Now shaded by extra fuel cost: exposure × the region’s price rise', 'Now shaded by extra fuel cost'], s: [null, 'Exposure × the region’s price rise'] },
    hol: { t: ['States that cut or suspended their gas tax', 'States that cut their gas tax'] },
    ideal: { t: ['The comparison I would like to make', 'The comparison I would like to make'] },
    sc22: { t: ['Extra fuel cost and vote shift, 2022', 'Extra fuel cost and vote shift, 2022'], s: ['Each dot is a county; 2022 is shown until the 2026 results are in. Vote shift from the 2020 presidential vote; in 2022 that means toward the Republicans.', 'Each dot is a county. Shift from the 2020 presidential vote; in 2022, toward the Republicans.'] },
    strips: { t: ['Vote shifts by statewide race, 2022', 'Vote shifts by race, 2022'], s: ['One strip per race, ordered by its average shift; each dot is a county', 'One strip per race; each dot is a county'] },
    pa: { t: ['Pennsylvania’s 67 counties, 2022 Senate race', 'Pennsylvania, 2022 Senate race'], s: ['Vote shift from the 2020 presidential vote; in 2022 that means toward the Republicans', 'Shift from the 2020 presidential vote (toward the Republicans)'] },
    reg: { t: ['Price rise since the 2024 election, by supply region', 'Price rise since 2024, by region'] },
    pp2: { t: ['Pennsylvania: price rises by local market', 'Pennsylvania: local price rises'], tag: 'Illustrative', s: ['Simulated local prices: each market has its own rise', 'Simulated local prices: each market has its own rise'], sAnn: true },
    nm: { t: ['Pennsylvania’s 44 local markets, by kind', 'Pennsylvania’s local markets, by kind'], s: ['Each market is compared only with a few nearby markets of the same kind', 'Compared only with nearby markets of the same kind'] },
    sp: { t: ['The seven fuel supply regions', 'The seven fuel supply regions'], s: ['States are compared only with the other states in their region', 'States are compared within their region'] },
    cmp: { t: ['Vote shifts in four nearby markets', 'Four nearby markets'], s: ['Simulated: one group of four nearby markets; shifts relative to the race average', 'Simulated: one group of four markets; vs the race average'], tag: 'Illustrative', inP: [0.1, 0.2] },
    cmp2: { t: ['Vote shift and the unusual part of the extra fuel cost', 'Vote shift and the unusual part of extra fuel cost'], s: ['Simulated counties from many groups and races; shifts relative to the race average', 'Simulated counties, many groups and races'], tag: 'Illustrative' },
    as: { t: ['The assumption the comparison rests on', 'The assumption it rests on'], s: [ASSUMP7, ASSUMP7] },
    adjb: { t: ['Counties in the states I study', 'Counties in the states I study'] },
    where: { t: ['How much each area counts in the estimate, compared with its votes', 'How much each area counts, compared with its votes'], tag: 'Provisional', s: ['Pale dots: states with no race in the analysis', 'Pale dots: states with no race in the analysis'] },
    oil: { t: ['Oil and gas jobs, by local market', 'Oil and gas jobs, by local market'] },
    prior: { t: ['Vote shift from 2020 to 2024, by county', 'Vote shift, 2020 to 2024'] },
    fan: { t: ['Each county, measured from its state’s average', 'Each county, from its state’s average'], s: ['Color: the market’s simulated price rise compared with its group', 'Color: simulated rise vs the market’s group'], tag: 'Illustrative' },
    lim: { t: ['What the comparison can’t measure', 'What the comparison can’t measure'] },
    // v8 new headings
    expV8: { t: ['Cost of a $1 rise in the price of gas, by county', 'Cost of a $1 rise, by county'] },
    brnV8: { t: ['Extra fuel cost of the price rise, by county', 'Extra fuel cost of the price rise'] },
    priceLocal: { t: ['Price rise in Pennsylvania’s counties since the 2024 election', 'Price rise by PA county'], tag: 'Illustrative', inP: [0.44, 0.5] },   // v9.4: the price title (and its tag) arrive with the price colors; during the zoom the neutral pa67 title shows
    mkts: { t: ['Pennsylvania’s 67 counties in 44 local markets', 'Pennsylvania’s 67 counties in 44 markets'] },
    racV8: { t: ['Extra fuel cost of the price rise, by county', 'Extra fuel cost of the price rise'] },
    qV8: { t: ['Extra fuel cost of the price rise, by county', 'Extra fuel cost of the price rise'] },
    tangle: { t: ['Extra fuel cost of the price rise, by county', 'Extra fuel cost of the price rise'], s: ['The heaviest fifth are ringed', 'The heaviest fifth are ringed'] },
    idealV8: { t: ['Extra fuel cost assigned at random', 'Extra fuel cost assigned at random'], tag: 'Illustrative' },
    lineup: { t: ['Counties in the states I study, by extra fuel cost', 'Counties by extra fuel cost'], tag: 'Illustrative' },
    v8simple: { t: ['Every county: 2026 extra fuel cost and the 2016 vote', 'Every county: 2026 extra fuel cost and the 2016 vote'], s: ['2016 presidential election, from 2012; in 2016 that means toward the Republicans', '2016 presidential election, from 2012; in 2016 that means toward the Republicans'] },
    v8same: { t: ['Every county, measured from its state’s average', 'Every county, from its state’s average'], s: ['2026 extra fuel cost and the 2016 vote shift', '2026 extra fuel cost and 2016 vote shift'] },
    v8pa: { t: ['Pennsylvania’s 67 counties', 'Pennsylvania’s 67 counties'], s: ['2016 presidential election, from 2012', '2016 presidential election, from 2012'] },
    v8price: { t: ['Pennsylvania’s local price rises, by county', 'Pennsylvania’s local price rises'], tag: 'Illustrative' },
    v8near: { t: ['Pennsylvania’s local markets, by kind', 'Pennsylvania’s local markets'], s: ['Metropolitan, micropolitan and rural markets', 'Metro, micro and rural markets'] },
    v8fan: { t: ['Each county, measured from its state’s average', 'Each county, from its state’s average'], tag: 'Illustrative' },
    v8slope: { t: ['The unusual part of the extra fuel cost and simulated vote shift, by county', 'Unusual part of extra fuel cost and vote shift'], tag: 'Illustrative' },
    v8as: { t: ['Pennsylvania’s local market groups', 'Pennsylvania’s market groups'], s: [ASSUMP7, ASSUMP7] },
    v8region: { t: ['The seven fuel supply regions', 'The seven supply regions'] },
    // v9.4: Pennsylvania in local markets (nearby-intro, nearby-groups, assumption)
    pa67: { t: ['Pennsylvania’s 67 counties', 'Pennsylvania’s 67 counties'] },
    pa44: { t: ['Pennsylvania’s 44 local markets', 'Pennsylvania’s 44 local markets'] },
    paGrp: { t: ['Pennsylvania’s metropolitan markets in their comparison groups', 'Pennsylvania’s metropolitan markets in their groups'] },
    paGrpAs: { t: ['Pennsylvania’s metropolitan markets in their comparison groups', 'Pennsylvania’s metropolitan markets in their groups'], s: [ASSUMP7, ASSUMP7] }
  };
  const HEAD_OF = { 'dots-intro': 'expV8', 'dots-example': 'expV8', 'races-covered': 'cov', 'dots-question': 'bq', 'dots-holidays': 'hol', 'ideal': 'idealV8',
    'simplest-axes': 'sc22', 'simplest-slope': 'sc22', 'races-cost': 'strips', 'within-race': 'strips', 'exposure-problem': 'pa', 'exposure-problem-2': 'pa',
    'price-problem': 'reg', 'price-problem-2': 'pp2', 'nearby-markets': 'nm', 'state-part': 'sp', 'comparison': 'cmp', 'comparison-2': 'cmp2', 'assumption': 'as',
    'adj-oil': 'oil', 'adj-prior': 'prior', 'what-is-left': 'fan', 'recap-limits': 'lim',
    // v8 map beats
    'burden-map': 'brnV8', 'local-markets': 'mkts', 'races': 'racV8',
    'exposure': 'expV8', 'price-local': 'priceLocal', 'markets': 'mkts', 'extra-cost': 'brnV8', 'vote-swing': 'cov', 'the-question': 'qV8',
    'idea-tangle': 'tangle', 'idea-ideal': 'idealV8',
    'simple': 'lineup', 'simple-why': 'lineup', 'same-race': 'v8same', 'same-race-steeper': 'v8same',
    'within-exposure': 'v8pa', 'within-exposure-2': 'v8pa', 'within-price': 'v8price', 'nearby': 'v8near',
    'nearby-intro': 'v8near', 'nearby-groups': 'v8near',
    'fan': 'v8fan', 'fan-2': 'v8fan', 'fan-3': 'v8fan', 'all-groups': 'v8slope',
    'assumption': 'v8as', 'state-layer-3': 'v8region', 'state-map': 'v8region' };
  Object.keys(HEAD_OF).forEach(b => { (FURN[b] = FURN[b] || []).push('hd:' + HEAD_OF[b]); });
  Object.keys(HEADS).forEach(k => { if (HEADS[k].inP || k === 'mkts' || k === 'priceLocal') LIVE_FUR.push('hd:' + k); });
  // v8: override the v7.2 furniture for beats that changed figure
  FURN['races'] = ['hd:racV8'];
  FURN['adj-brief'] = ['hd:adjb'];
  FURN['scope-where'] = ['hd:where'];
  FURN['adj-oil'] = ['hd:oil'];
  FURN['adj-prior'] = ['hd:prior'];
  HEAD_OF['same-race'] = 'strips';
  HEAD_OF['same-race-2'] = 'strips';
  FURN['same-race'] = ['strips', 'hd:strips'];
  FURN['same-race-2'] = ['strips', 'aside', 'hd:strips'];
  FURN['nearby-intro'] = ['strips', 'aside', 'hd:strips', 'hd:v8near'];
  FURN['nearby-groups'] = ['hd:v8near'];
  FURN['assumption'] = ['hd:v8as'];
  // v9.3: ideal shows the real map under the title of the extra-cost map, then the shuffle under its own title (see shuffleAmt)
  FURN['ideal'] = ['leg-b26p3', 'hd:qV8', 'hd:idealV8'];
  ['hd:lineup', 'hd:qV8', 'hd:idealV8', 'hd:v8region', 'hd:paGrp', 'hd:paGrpAs'].forEach(k => { if (LIVE_FUR.indexOf(k) < 0) LIVE_FUR.push(k); });
  const HD = { get tagFs() { return _TH.figType.tag[small ? 1 : 0]; } };
  // Layout of a heading at the current width: wrapped title and subtitle lines, their baselines, the tag box and the bottom of the block.
  function headLay(key) {
    const h = HEADS[key]; if (!h) return { bottom: 0 };
    const fsT = _TH.figType.title[small ? 1 : 0], lhT = Math.round(fsT * 1.28), fsS = _TH.figType.sub[small ? 1 : 0], lhS = Math.round(fsS * 1.28), y0 = small ? 21 : 27;
    const noTag = phone && key === 'where', tagW = h.tag && !noTag ? measure(h.tag, HD.tagFs, 500) + 8 : 0, wT = W - 2 * GEO.pad - (tagW ? tagW + 8 : 0) - (key === 'as' || key === 'paGrpAs' || key === 'paGrp' ? (small ? 98 : 161) : noTag ? 98 : 0);   // phones, where: the source line says "provisional", so the tag goes and the button has its room   // v9.4 QA: assumption's title leaves room for the tag and the "Back to the overview" button
    const tl = wrapLines(tierShort() && key === 'mkts' ? 'Pennsylvania’s local markets' : h.t[small ? 1 : 0], wT, fsT, 600), sTxt = phone && key === 'strips' ? 'One strip per race; each dot a county' : phone && key === 'paGrpAs' ? null : h.s ? h.s[small ? 1 : 0] : null, sl = sTxt ? wrapLines(sTxt, W - 2 * GEO.pad, fsS, 400) : [];
    const yS = y0 + (tl.length - 1) * lhT + (small ? 18 : 24);
    return { tl: tl, sl: sl, y0: y0, lhT: lhT, fsT: fsT, yS: yS, lhS: lhS, fsS: fsS, tagW: tagW, bottom: (sl.length ? yS + (sl.length - 1) * lhS : y0 + (tl.length - 1) * lhT) + 6 };
  }
  const headBottom = key => headLay(key).bottom;
  function furHead(key) {
    return (g, host) => {
      const h = HEADS[key], L = headLay(key), inner = group(g);
      L.tl.forEach((l, k) => text(inner, GEO.pad, L.y0 + k * L.lhT, l, { size: L.fsT, weight: 600, halo: 0 }).el.setAttribute('data-fig-title', '1'));
      if (!h.sAnn) L.sl.forEach((l, k) => {
        const sub = text(inner, GEO.pad, L.yS + k * L.lhS, l, { size: L.fsS, fill: T.muted, halo: 0 }).el; sub.setAttribute('data-fig-sub', '1');
        if (phone && key === 'strips' && k === 0) LIVE['hd:strips'] = id => { sub.querySelector('tspan').textContent = id === 'same-race-2' || id === 'nearby-intro' ? 'Vote shift from race average (pts)' : l; };
      });
      let tagG = null;
      if (h.tag && !(phone && key === 'where')) {
        // Two inks: plain text, no box (Barlow 500, 12px)
        const x = W - GEO.pad; tagG = group(inner);
        text(tagG, x, L.y0, h.tag, { size: HD.tagFs, fill: T.muted, anchor: 'end', weight: 500, halo: 0 }).el.setAttribute('data-fig-tag', '1');
      }
      // v9.3: headings whose look follows the beat's progress (the line-up's tag appears with the mock vote shifts; ideal's two titles swap with the shuffle)
      if (key === 'lineup') LIVE['hd:lineup'] = (id, q, p) => { inner.style.opacity = 1; if (tagG) tagG.style.opacity = id === 'simple' ? 0 : id === 'simple-votes' ? smooth(0.05, 0.15, p) : 1; };   // the Illustrative tag comes with the made-up vote shifts
      // v9.4: the title of the real map gives way to "assigned at random" as the colors lift off, and comes back once they are on their way home
      if (key === 'qV8') LIVE['hd:qV8'] = (id, q, p) => { inner.style.opacity = id === 'ideal' ? phone ? smooth(0.04, 0.10, p) : smooth(0.30, 0.37, p) : id === 'ideal-shuffle' ? 1 - smooth(0.05, 0.11, p) : id === 'close-to-random' ? smooth(phone ? 0.23 : 0.26, phone ? 0.30 : 0.38, p) : 1; };
      if (key === 'idealV8') LIVE['hd:idealV8'] = (id, q, p) => { inner.style.opacity = id === 'ideal-shuffle' ? smooth(0.09, 0.15, p) : id === 'close-to-random' ? 1 - smooth(0.17, phone ? 0.23 : 0.30, p) : 0; };
      // v9.4 state-regions: the title comes in once the figure is on screen (the panel before it has its own), and goes out quickly for the next panel
      if (key === 'v8region') LIVE['hd:v8region'] = (id, q, p, ht) => { const on = id === 'state-regions' || id === 'state-map' || id === 'adj-state'; inner.style.opacity = on ? smooth(0, 0.08, p) * (1 - smooth(0, 0.3, ht || 0)) : 1; };
      // the groups' title goes out quickly for the panel that follows nearby-groups; assumption's title comes in once the figure is on screen (the panel before it has its own)
      if (key === 'paGrp') LIVE['hd:paGrp'] = (id, q, p, ht) => { inner.style.opacity = id === 'nearby-groups' ? 1 - smooth(0, 0.3, ht || 0) : 1; };
      if (key === 'paGrpAs') LIVE['hd:paGrpAs'] = (id, q, p) => { inner.style.opacity = id === 'assumption' ? smooth(0, 0.08, p) : 1; };
      if (key === 'pa67') LIVE['hd:pa67'] = (id, q, p) => { inner.style.opacity = id === 'nearby-intro' ? smooth(0.04, 0.07, p) * (1 - smooth(0.095, 0.115, p)) : id === 'price-local' ? smooth(0.06, 0.12, p) * (1 - smooth(0.42, 0.46, p)) : 0; };
      if (key === 'pa44') LIVE['hd:pa44'] = (id, q, p) => { inner.style.opacity = id === 'nearby-intro' ? smooth(0.11, 0.13, p) : 1; };
      if (h.inP || key === 'mkts' || key === 'priceLocal') LIVE['hd:' + key] = (id, q, p) => {
        // Keep the Illustrative tag until the v9 market map is neutral, then reveal its Pennsylvania heading.
        inner.style.opacity = key === 'priceLocal' && id === 'markets' ? 1 - smooth(0.25, 0.285, p)
          : key === 'mkts' && id === 'markets' ? smooth(0.285, 0.32, p)
          : HEAD_OF[id] === key && h.inP ? smooth(h.inP[0], h.inP[1], p) : 1;
      };
    };
  }

  function buildOverlay() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('width', W); svg.setAttribute('height', HF); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + HF);
    setupDefs();
    gFur = group(svg, 'dots-furniture'); gAnn = group(svg, 'dots-ann'); gPanels = S(svg, 'g', { class: 'panels-layer' }); gSrc = group(svg, 'dots-source');
    FUR = {}; ANN = {}; LIVE = {}; lastOp = {}; SRCEL = {}; lastSrc = '';
    // order = drawing order: the set-aside area sits under the strips' ticks
    const furBuild = {
      'leg-e': furLegE, 'leg-ev8': furLegEv8, 'leg-b26': furLegB, 'leg-b26v8': g => furLegB26v8(g, false), 'leg-b26p3': g => furLegB26v8(g, true), 'leg-reg': furLegReg, 'leg-pad': furLegPad, 'ax22': furAx22, 'aside': furAside, 'strips': furStrips, 'pa': furPA, 'reminder': furReminder,
      'fan': furFan, 'bar': furBar, 'slices': furSlices, 'keyAx': furKeyAx, 'keyA': furKeyA, 'keyB': furKeyB, 'keyR': furKeyR, 'keyCap': furKeyCap,
      'cmpY': furCmpY, 'cmpCols': furCmpCols, 'lineup': furLineup, 'leg-grey': furLegGrey, 'pa-out': furPaOut, 'pa-out-n': furPaOutN,
      'leg-kind': furKind(['pa44', 'paGrp'], false), 'leg-kind-as': furKind(['paGrpAs'], true), 'leg-size': furSize,
      'v8simple': g => furV8Axes(g, 'simple'), 'v8same': g => furV8Axes(g, 'same'),
      'v8pa': g => furV8Axes(g, 'pa'), 'v8fan': g => furV8Axes(g, 'fan'),
      'v8slope': g => furV8Axes(g, 'slope')
    };
    Object.keys(HEADS).forEach(k => { furBuild['hd:' + k] = furHead(k); });
    Object.keys(furBuild).forEach(k => { const g = group(gFur); g.style.opacity = 0; FUR[k] = { g: g, subs: [] }; try { furBuild[k](g, FUR[k]); } catch (e) { console.error('[dots] furniture ' + k, e); } });
    const annBuild = {
      'dots-intro': aIntro, 'dots-example': aExample, 'dots-question': aQuestion, 'two-analyses': aTwoAn, 'races-covered': aCovered, 'dots-holidays': aHolidays,
      'simplest-axes': aAxes, 'simplest-slope': aSlope, 'within-race': aWithin, 'exposure-problem': aWho, 'exposure-problem-2': aWho2,
      'price-problem': aPrice, 'price-problem-2': aPrice2, 'gaps-same': aGapsSame, 'gaps-bigger': aGapsBigger,
      'comparable-states': aRegions, 'comparable-metros': aComparable, 'assumption': aAssump9, 'what-is-left': aLeft,
      'nearby-markets': aNearby, 'state-part': aStatePart, 'comparison': aCmp, 'comparison-2': aCmp2,
      'adj-passthrough': aPass, 'adj-lagged': aLagged, 'adj-oil': aOil9, 'adj-prior': aPrior9, 'recap-limits': aLimits, 'scope-where': aWhere,
      // v8 map beats
      'burden-map': aBurdenMap, 'local-markets': aLocalMarkets,
      'exposure': aExposure, 'price-local': aPriceLocal, 'markets': aMarkets, 'extra-cost': aExtraCost, 'vote-swing': aVoteSwing,
      'idea-tangle': aTangle, 'idea-ideal': aIdealV8,
      'simple-votes': aSimple9, 'simple-why': aSimpleWhy9, 'same-race': aRaces9, 'same-race-2': aRacesCentered9,
      'same-race-steeper': aSteeper8, 'within-exposure': aExposure8,
      'within-exposure-2': aExposureLines8, 'within-price': aWithinPrice8,
      'nearby': aNearby9, 'nearby-groups': aNearbyGroups, 'fan': aFan8, 'fan-2': aFan2_8, 'fan-3': aFan3_8,
      'all-groups': aAllGroups8, 'state-layer-3': aStateLayer8, 'state-regions': aStateRegions
    };
    BEATS.forEach(id => {
      if (ANN_ALIAS[id]) { ANN[id] = ANN[ANN_ALIAS[id]]; return; }                    // a beat that holds another beat's annotations has no group of its own
      const g = group(gAnn); g.style.opacity = 0; ANN[id] = { g: g, subs: [] };
      CUR_HB = HEAD_OF[id] ? headBottom(HEAD_OF[id]) + 2 : 0;
      USED = CUR_HB ? [[0, 0, W, CUR_HB]] : [];        // v7.2: labels keep clear of the figure's heading
      if (annBuild[id]) { try { annBuild[id](g, ANN[id]); } catch (e) { console.error('[dots] annotation ' + id, e); } }
    });
    // One source line per figure, bottom left, in the band below the drawing area, when the shell's window.sourceLine is missing.
    const size = 12, maxW = W - 2 * GEO.pad;
    SRC_TXT = {};
    if (typeof window.sourceLine !== 'function') BEATS.forEach(id => {
      const pr = SRC_OF[id]; if (!pr) return;
      let s = pr[0]; for (let k = 0; k < pr.length; k++) { s = pr[k]; if (measure(s, size) <= maxW) break; }
      SRC_TXT[id] = s;
      if (!SRCEL[s]) { const t = text(gSrc, GEO.pad, HF - 8, s, { size: size, fill: T.muted, halo: 0 }); t.el.style.opacity = 0; SRCEL[s] = t.el; }
    });
  }
  let SRC_TXT = {};

  // Sub-elements with their own visibility inside a beat (function of the beat's inner progress q).
  function sub(host, g, vis) { host.subs.push({ g: g, vis: vis }); return g; }
  // Second stage (v6): arrows and callout labels come in over p = 0.25..0.45, after the figure itself has built (p = 0.05..0.25).
  const late = (g, host) => sub(host, group(g), (q, p) => smooth(0.25, 0.32, p));      // v7.2 [S13]: a short fade, then hold

  /* --- legends --- */
  function gradLegend(g, id, x, y, w, stops, title, ticks, titleW) {
    const lg = S(defs, 'linearGradient', { id: id, x1: 0, x2: 1, y1: 0, y2: 0 });
    stops.forEach(s => { S(lg, 'stop', { offset: s[0], 'stop-color': s[1] }); });
    const tt = text(g, x, y, title, { size: 13, weight: 500, w: titleW || Math.max(w, small ? W - 2 * GEO.pad : 360) });
    const by = y + tt.h - 6 + 6;
    S(g, 'rect', { x: x, y: by, width: w, height: 10, fill: 'url(#' + id + ')' });
    S(g, 'rect', { x: x, y: by, width: w, height: 10, fill: 'none', stroke: T.rule, 'stroke-width': 1 });
    ticks.forEach(tk => {
      const tx = x + tk[0] * w; line(g, tx, by + 10, tx, by + 14, { stroke: T.muted });
      text(g, tx, by + 27, tk[1], { size: 12, fill: T.muted, anchor: tk[0] < 0.02 ? 'start' : tk[0] > 0.98 ? 'end' : 'middle', halo: 0 });
    });
    return by + 30;
  }
  function phoneMapLegend(g, id, title, ticks, lift) {
    const x = GEO.pad, y = H - (lift || 30), rx = x + 146, w = W - GEO.pad - rx;
    if (tierShort()) ticks = ticks.filter((t, k) => k === 0 || k === ticks.length - 1);
    const lg = S(defs, 'linearGradient', { id: id, x1: 0, x2: 1, y1: 0, y2: 0 });
    seqStops(8).forEach(s => S(lg, 'stop', { offset: s[0], 'stop-color': s[1] }));
    text(g, x, y + 9, title + '\n(% of monthly income)', { size: 13, weight: 500, lh: 1.15, halo: 0 });
    S(g, 'rect', { x: rx, y: y, width: w, height: 8, fill: 'url(#' + id + ')' });
    ticks.forEach(t => { const tx = rx + t[0] * w;
      line(g, tx, y + 8, tx, y + 12, { stroke: T.muted });
      text(g, tx, y + 24, t[1], { size: 13, fill: T.muted, anchor: t[0] < 0.1 ? 'start' : t[0] > 0.9 ? 'end' : 'middle', halo: 0 });
    });
  }
  function seqStops(n0) { const a = []; for (let k = 0; k <= n0; k++) a.push([k / n0, seqCss(k / n0)]); return a; }
  function furLegE(g) {
    const w = small ? Math.min(214, W - 2 * GEO.pad) : 300, y = H - (small ? 60 : 92);
    const ticks = [0.5, 1, 1.5, 2, 2.5].filter(v => v >= D.eLo - 0.01 && v <= D.eHi + 0.01).map(v => [(v - D.eLo) / (D.eHi - D.eLo), v.toFixed(1) + '%']);
    ticks[ticks.length - 1][1] += '+';
    const by = gradLegend(g, 'dots-g-e', GEO.pad, y, w, seqStops(8), 'Share of monthly income taken by a $1/gallon rise', ticks) - 30;
    sizeKey(g, GEO.pad + w + (small ? 22 : 40), by + 5);
  }
  // v9.3: the dot-size key, tight beside the color bar: a small dot, an arrow, a large dot, then the words. (x, yMid) is the left end, centered on the bar.
  function sizeKey(g, x, yMid) {
    if (small) return group(g);
    const kg = group(g, 'dots-sizekey'), r0 = 2.5, r1 = 6.5, aw = small ? 16 : 24, lab = small ? 'Households' : 'Number of households';
    S(kg, 'circle', { cx: x + r0, cy: yMid, r: r0, fill: T.muted, opacity: 0.55 });
    arrow(kg, x + 2 * r0 + 3, yMid, x + 2 * r0 + 3 + aw, yMid, { stroke: T.muted, gap: 0 });
    const cx = x + 2 * r0 + 3 + aw + 3 + r1;
    S(kg, 'circle', { cx: cx, cy: yMid, r: r1, fill: T.muted, opacity: 0.55 });
    text(kg, cx + r1 + 7, yMid + 4.5, lab, { size: 13, fill: T.muted, halo: 0 });
    return kg;
  }
  // v8 exposure legend with the updated title
  function furLegEv8(g) {
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0);
    const w = small ? Math.min(214, W - 2 * GEO.pad) : 300, y = H - band - (small ? 60 : 92);
    const ticks = [0.5, 1, 1.5, 2, 2.5].filter(v => v >= D.eLo - 0.01 && v <= D.eHi + 0.01).map(v => [(v - D.eLo) / (D.eHi - D.eLo), v.toFixed(1) + '%']);
    ticks[ticks.length - 1][1] += '+';
    if (small) { phoneMapLegend(g, 'dots-g-ev8', 'Cost of a $1 rise', ticks); return; }
    const by = gradLegend(g, 'dots-g-ev8', GEO.pad, y, w, seqStops(8), 'Cost of a $1 rise in the price of gas (% of monthly income)', ticks) - 30;
    sizeKey(g, GEO.pad + w + (small ? 22 : 40), by + 5);
  }

  function furLegB(g) {
    // v7.2 [3.3]: on phones the legend sits high enough to leave about 10 px above the source line
    const LT = 'Extra fuel cost (% of monthly income)', w = small ? Math.min(240, W - 2 * GEO.pad) : 300;
    const y = small ? H - 5 - 27 - wrapLines(LT, W - 2 * GEO.pad, 13, 500).length * 16.9 : H - 92;
    const lo = D.b26Lo, hi = D.b26Hi, ticks = [0.5, 1, 1.5, 2, 2.5].filter(v => v >= lo - 0.01 && v <= hi + 0.01).map(v => [(v - lo) / (hi - lo), v.toFixed(1) + '%']);
    ticks[ticks.length - 1][1] += '+';
    const by = gradLegend(g, 'dots-g-b', GEO.pad, y, w, seqStops(8), LT, ticks) - 30;
    // key for the grey dots (the states outside the analysis): beside the bar when it fits (long wording, then a short one), else above the legend title
    const KT = ['Gray: no Senate or governor race in the analysis', 'Gray: no race in the analysis'], kxb = GEO.pad + w + 30;
    const side = small ? -1 : KT.findIndex(t => kxb + 16 + measure(t, 13) <= W - GEO.pad);
    const kx = side >= 0 ? kxb : GEO.pad, ky = side >= 0 ? by + 10 : y - 22;
    S(g, 'circle', { cx: kx + 5, cy: ky - 4, r: 4.5, fill: T.pale || '#C9CED3' });
    text(g, kx + 16, ky, side >= 0 ? KT[side] : small ? 'No Senate or governor race in the analysis' : KT[0], { size: 13, fill: T.muted, halo: 0 });
  }
  function furLegReg(g) {
    const w = small ? Math.min(240, W - 2 * GEO.pad) : 300, y = H - (small ? 60 : 92), st = [];
    for (let k = 0; k <= 8; k++) st.push([k / 8, REG(k / 8)]);
    const ticks = []; for (let v = Math.ceil(D.regLo * 10) / 10; v <= D.regHi + 1e-6; v += 0.2) ticks.push([regU(v), '$' + v.toFixed(2)]);
    gradLegend(g, 'dots-g-reg', GEO.pad, y, w, st, small ? 'Price rise since the 2024 election ($/gal)' : 'Price rise since the 2024 election, by supply region ($ per gallon)', ticks, W - 2 * GEO.pad);
  }

  /* --- axes of the 2022 scatter --- */
  function plotAxes(g, b, xs, ys, xTitle, yTitle, o) {
    o = o || {};
    ys.ticks(o.yt || 6).forEach(v => {
      const y = ys(v); if (y < b.y0 - 1 || y > b.y1 + 1) return;
      line(g, b.x0, y, b.x1, y, { stroke: v === 0 ? T.muted : T.rule, w: 1, op: v === 0 ? 0.8 : 0.7 });
      text(g, b.x0 - 7, y + 4, o.fy ? o.fy(v) : String(v), { size: 12, fill: T.muted, anchor: 'end', halo: 0 });
    });
    if (xs) xs.ticks(o.xt || (small ? 5 : 7)).forEach(v => {
      const x = xs(v); if (x < b.x0 || x > b.x1 + 1) return;
      line(g, x, b.y1, x, b.y1 + 4, { stroke: T.muted });
      text(g, x, b.y1 + 17, o.fx ? o.fx(v) : String(v), { size: 12, fill: T.muted, anchor: 'middle', halo: 0 });
    });
    line(g, b.x0, b.y1, b.x1, b.y1, { stroke: T.muted, op: 0.8 });
    if (xTitle) text(g, (b.x0 + b.x1) / 2, b.y1 + (small ? 36 : 40), xTitle, { size: 13, fill: T.ink, anchor: 'middle', halo: 0, w: b.x1 - b.x0 });
    if (yTitle) yAxisTitle(g, yTitle, b);
  }
  // A y-axis title that is longer than the plot is tall (short panels at middle widths) gives way to its short form.
  const SHORT_Y = { 'Vote shift vs president (pts)': 'Vote shift (pts)', 'Vote shift against the president’s party (points)': 'Vote shift vs president (pts)', 'Shift against the president’s party (toward Republicans), 2020 to 2022 (points)': 'Shift against president (pts)', 'Shift against the president’s party (points)': 'Shift against president (pts)', 'Extra fuel cost vs the state’s average (% of income)': 'Extra fuel cost vs state avg. (%)', 'Vote shift against the president’s party, vs the race average (points)': 'Shift vs race average (pts)', 'vote shift toward Republicans (points)': 'toward Republicans (pts)' };
  const fitY = (str, b) => (SHORT_Y[str] && measure(str, 13) > Math.abs(b.y1 - b.y0) - 8 ? SHORT_Y[str] : str);
  function yAxisTitle(g, str, b) { str = fitY(str, b); const t = text(g, 0, 0, str, { size: 13, fill: T.ink, anchor: 'middle', halo: 0 }); t.el.setAttribute('transform', 'translate(' + (small ? 13 : 16) + ',' + (b.y0 + b.y1) / 2 + ') rotate(-90)'); t.el.querySelectorAll('tspan').forEach(ts => ts.setAttribute('x', 0)); }
  function furAx22(g) {
    plotAxes(g, GEO.sc, GEO.scX, GEO.scY, small ? 'Extra fuel cost of the 2022 price rise (% of monthly income)' : 'Extra fuel cost of the 2022 price rise (share of monthly income taken, %)',
      small ? 'Vote shift vs president (pts)' : 'Vote shift against the president’s party (points)', { fx: v => v + '%', fy: v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) });
    outNote(g, NOUT.sc, GEO.sc);
  }
  // v7.2 [S10]: "N counties beyond the axis", at the top left inside the plot (below the row of markers at the top edge), next to a small open marker.
  function outNote(g, k, b, dy) {
    if (!k) return null;
    const msg = k + (k === 1 ? ' county' : ' counties') + ' beyond the axis', br = dy === 'br', x = br ? b.x1 - 6 - measure(msg, 12) : b.x0 + 22, y = br ? b.y1 - 10 : b.y0 + (dy || 22), gg = group(g);
    S(gg, 'circle', { cx: x - 9, cy: y - 4, r: 3, fill: 'none', stroke: T.muted, 'stroke-width': 1 });
    text(gg, x, y, msg, { size: 12, fill: T.muted, halo: 3 });
    return gg;
  }
  /* --- strips (race axis) and the ticks that ride with the dots --- */
  // Opacity of the set-aside area (and of the race means inside it): it appears in races-cost and fades back in within-race.
  function asideOp(id, q, p) {
    if (id === 'races-cost') return smooth(0.15, 0.7, q);
    if (id === 'same-race-2') return smooth(0.25, 0.45, p || 0);
    if (id === 'nearby-intro') return 1;
    if (id === 'within-race') return 1 - 0.62 * smooth(0, 0.5, q);
    if (id === 'exposure-problem') return 0.38 * (1 - smooth(0, 0.4, q));
    return 0;
  }
  function furStrips(g, host) {
    const b = GEO.sc, ys = GEO.scY, inner = group(g); host.inner = inner;
    ys.ticks(phone ? Math.max(2, Math.floor((b.y1 - b.y0) / 27)) : 6).forEach(v => {
      const y = ys(v); if (y < b.y0 - 1 || y > b.y1 + 1) return;
      line(inner, b.x0, y, GEO.stX1, y, { stroke: v === 0 ? T.muted : T.rule, w: 1, op: v === 0 ? 0.8 : 0.7 });
      text(inner, b.x0 - 7, y + 4, (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v), { size: 12, fill: T.muted, anchor: 'end', halo: 0 });
    });
    line(inner, b.x0, b.y1, GEO.stX1, b.y1, { stroke: T.muted, op: 0.8 });
    // v7.2 [4.3]: the strips alternate two neutrals, so no color key is needed; the heading says what a strip is. The y title follows [S4].
    if (tierWide()) text(inner, targetSide() ? GEO.stX1 : b.x0, b.y0 - 10, 'Vote shift (pts)', { size: 13, fill: T.muted, anchor: targetSide() ? 'end' : 'start', halo: 0 });
    const t = text(inner, 0, 0, phone || tierWide() ? '' : small ? 'Vote shift vs president (pts)' : fitY('Vote shift against the president’s party (points)', b), { size: 13, anchor: 'middle', halo: 0 });
    t.el.setAttribute('transform', 'translate(' + (small ? 13 : 16) + ',' + (b.y0 + b.y1) / 2 + ') rotate(-90)'); t.el.querySelectorAll('tspan').forEach(ts => ts.setAttribute('x', 0));
    const bU = { x0: b.x0, y0: b.y1 - 2 }, oR = outNote(inner, NOUT.stR, bU, 18), oC = outNote(inner, NOUT.stC, bU, 18);      // under the strips (they have no x axis)
    // ticks: one per race, at the race's average shift. In races-cost a tick rides with its dots (the same ease(q), from the race's mean to zero), and a second
    // set slides into the set-aside area at each race's original height: the differences between races are kept, not flattened.
    const gt = group(inner), gt2 = group(inner);
    host.ticks = D.races.map(() => S(gt, 'line', { stroke: T.ink, 'stroke-width': 2, 'stroke-linecap': 'butt' }));
    host.ticks2 = D.races.map(() => S(gt2, 'line', { stroke: T.ink, 'stroke-width': 2, 'stroke-linecap': 'butt' }));
    LIVE.strips = (id, q, p) => {
      const uq = ease(clamp(q, 0, 1)), aw = GEO.areaX1 - GEO.areaX0 - 14, N = D.nR;
      const raw = id === 'races' || id === 'same-race', centering = id === 'races-cost' || id === 'same-race-2';
      const eq = raw ? 0 : centering ? uq : 1;
      inner.style.opacity = id === 'exposure-problem' ? 1 - smooth(0, 0.45, q) : 1;
      { const uC = raw ? 0 : centering ? q : 1; if (oR) oR.style.opacity = 1 - smooth(0, 0.5, uC); if (oC) oC.style.opacity = smooth(0.5, 1, uC); }
      gt.style.opacity = raw ? smooth(0.55, 1, q) : 1;
      gt2.style.opacity = raw ? 0 : id === 'same-race-2' ? phone ? asideOp(id, q, p) : smooth(0.05, 0.35, q) : id === 'races-cost' || id === 'nearby-intro' ? 1 : asideOp(id, q, p) / asideOp('races-cost', 1);
      D.races.forEach((r, k) => {
        const sx = GEO.stX0 + (k + 0.5) * GEO.stW, hw = Math.max(1.2, GEO.stW * 0.4), ax = GEO.areaX0 + 7 + (k + 0.5) / N * aw, ahw = Math.max(0.8, aw / N * 0.4);
        const y = lerp(ys(r.mean), ys(0), eq), tk = host.ticks[k], t2 = host.ticks2[k];
        tk.setAttribute('x1', sx - hw); tk.setAttribute('x2', sx + hw); tk.setAttribute('y1', y); tk.setAttribute('y2', y);
        const x = lerp(sx, ax, eq), h2 = lerp(hw, ahw, eq), ym = phone || tierWide() || tierTablet() ? lerp(b.y1 - 5, b.y0 + 48, clamp((r.mean - ys.domain()[0]) / (ys.domain()[1] - ys.domain()[0]), 0, 1)) : ys(r.mean);
        t2.setAttribute('x1', x - h2); t2.setAttribute('x2', x + h2); t2.setAttribute('y1', ym); t2.setAttribute('y2', ym);
        tk.setAttribute('visibility', y < b.y0 - 1 || y > b.y1 + 1 ? 'hidden' : 'visible');      // a race average beyond the axis has no tick (it would sit outside the plot)
        t2.setAttribute('visibility', ym < b.y0 - 1 || ym > b.y1 + 1 ? 'hidden' : 'visible');
      });
    };
  }
  // The set-aside area of races-cost (kept, faded, in within-race).
  function furAside(g, host) {
    const b = GEO.sc, x0 = GEO.areaX0, x1 = GEO.areaX1, inner = group(g), lab = group(g);
    S(inner, 'rect', { x: x0, y: b.y0 + (phone || tierWide() || tierTablet() ? 48 : 0), width: x1 - x0, height: Math.max(1, b.y1 - b.y0 - (phone || tierWide() || tierTablet() ? 48 : 0)), fill: 'url(#dots-hatch)', stroke: T.rule, 'stroke-width': 1, opacity: 0.9 });
    const msg = tierWide() || tierTablet() ? 'Set aside:\nwhole races' : phone ? 'Set aside:\nwhole-race shifts' : small ? 'Set aside: whatever moved whole races' : 'Set aside: whatever moved whole races, including any nationwide effect of gas prices';   // v9.4 QA: short on a phone, where the race averages climb through the narrow band
    const ls = wrapLines(msg, x1 - x0 + (phone ? -14 : small ? -26 : -8), small ? 12 : 13, 500), ty = b.y0 + 14;
    S(lab, 'rect', { x: x0 + 3, y: ty - 13, width: x1 - x0 - 6 - (small ? 22 : 0), height: ls.length * 17 + 8, fill: T.bg, opacity: 0.92 });
    ls.forEach((l, k) => text(lab, x0 + 7, ty + k * 17, l, { size: small ? 12 : 13, weight: 500, halo: 0 }));
    // the hatched area recedes in within-race (to 38%), but its label is text a reader must still read: it keeps full strength until the area leaves
    LIVE.aside = (id, q, p) => { const o = asideOp(id, q, p); inner.style.opacity = o; lab.style.opacity = id === 'races-cost' || id === 'same-race-2' ? o : Math.min(1, o / 0.38); };
  }

  /* --- supply-region legend (colors of the comparable-states map) --- */
  // v9.3 (state-map): the regions come in one at a time, west to east; the legend entries follow (LIVE['leg-pad'])
  const REGION_ORDER = ['5', '4', '3', '2', '1C', '1B', '1A'];
  const regionAt = (k, q) => ease(clamp((q - k * 0.12) / 0.28, 0, 1));
  // v9.4: a grey dot for the states with no race in the analysis, beside the color bar of the extra-fuel-cost map (ideal, ideal-shuffle, close-to-random)
  function furLegGrey(g) {
    const LT = 'Extra fuel cost of the rise (% of monthly income)', w = small ? Math.min(240, W - 2 * GEO.pad) : 300, band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0);
    const y = small ? H - band - 5 - 27 - wrapLines(LT, W - 2 * GEO.pad, 13, 500).length * 16.9 : H - band - 92, by = y + wrapLines(LT, Math.max(w, small ? W - 2 * GEO.pad : 360), 13, 500).length * 16.9;
    const KT = ['Gray: no Senate or governor race in the analysis', 'Gray: no race in the analysis'], kxb = GEO.pad + w + 30, inner = group(g);
    if (tierWide() || tierTablet()) {
      const yK = H - Math.max(34, window.SLICE_BAND || 0) - 12;
      S(inner, 'circle', { cx: GEO.pad + 4, cy: yK - 4, r: 3.5, fill: T.pale || '#C9CED3' });
      text(inner, GEO.pad + 14, yK, 'Gray: no race in the analysis', { size: 12, fill: T.muted, halo: 0 });
    } else if (phone) {
      S(inner, 'circle', { cx: GEO.pad + 4, cy: H - 94, r: 3.5, fill: T.pale || '#C9CED3' });      // above the legend's title, in the empty corner under the West (left of Hawaii's dots)
      text(inner, GEO.pad + 14, H - 90, 'No race in\nthe analysis', { size: 12, fill: T.muted, halo: 0, lh: 1.2 });
    } else if (small) {
      const kx = GEO.pad + w + 12;
      S(inner, 'circle', { cx: kx + 5, cy: by + 4, r: 4.5, fill: T.pale || '#C9CED3' });
      text(inner, kx + 14, by + 5, 'Gray: no race', { size: 12, fill: T.muted, halo: 0 }); text(inner, kx + 14, by + 19, 'in the analysis', { size: 12, fill: T.muted, halo: 0 });
    } else {
      const side = KT.findIndex(t => kxb + 16 + measure(t, 13) <= W - GEO.pad), kx = side >= 0 ? kxb : GEO.pad, ky = side >= 0 ? by + 10 : y - 22;
      S(inner, 'circle', { cx: kx + 5, cy: ky - 4, r: 4.5, fill: T.pale || '#C9CED3' });
      text(inner, kx + 16, ky, side >= 0 ? KT[side] : KT[0], { size: 13, fill: T.muted, halo: 0 });
    }
    // while the colors are off the counties, every county is gray: the key would mislead, so it leaves with the colors and comes back with them
    LIVE['leg-grey'] = (id, q, p) => { if (id === 'ideal') { inner.style.opacity = smooth(0.30, 0.37, p); return; } const tau = id === 'ideal-shuffle' || id === 'close-to-random' ? shufTau(id, p) : 0; inner.style.opacity = 1 - smooth(0.05, 0.1, tau) * (1 - smooth(0.48, 0.55, tau)); };
  }
  // v9.4: Pennsylvania's outline for the market figures, and the key of the kinds of market (with the dot-size key) under their titles
  function furPaOut(g) {
    const B = GEO.pa9, inner = group(g);
    if (B.path) S(inner, 'path', { d: B.path, fill: 'none', stroke: T.muted, 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
    LIVE['pa-out'] = (id, q, p) => { inner.style.opacity = id === 'nearby-intro' ? smooth(0.085, 0.125, p) : id === 'assumption' ? smooth(0.1, 0.25, p) : 1; };
  }
  // the outline in price-local and markets: one piece, so that it stays in place across their hand-over (PI, 2026-10-30)
  function furPaOutN(g) {
    const B = GEO.paPL || GEO.paN, inner = group(g);
    if (B && B.path) S(inner, 'path', { d: B.path, fill: 'none', stroke: T.muted, 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
    LIVE['pa-out-n'] = (id, q, p) => { inner.style.opacity = id === 'price-local' ? smooth(0.45, 0.6, p) : 1; };
  }
  const furKind = (heads, as) => (g, host) => {
    const inner = group(g); kindKey(inner, Math.max.apply(null, heads.map(headBottom)) + 20);      // 20 below the heading: clear of the "Back to the overview" button on the title's row
    LIVE[as ? 'leg-kind-as' : 'leg-kind'] = (id, q, p) => { inner.style.opacity = id === 'nearby-intro' ? smooth(0.27, 0.31, p) : id === 'assumption' ? smooth(0.15, 0.3, p) : 1; };
  };
  // the dot-size key (households) under the plot of the market figures; nearby-groups puts its own line in the same place
  function furSize(g) {
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0), inner = group(g);
    sizeKey(inner, GEO.pad, H - band - 16);
    LIVE['leg-size'] = (id, q, p) => { inner.style.opacity = id === 'nearby-intro' ? smooth(0.27, 0.31, p) : id === 'assumption' ? smooth(0.15, 0.3, p) : 1; };
  }
  function furLegPad(g, host) {
    // v9.4: in the order the regions come in (west to east); 12px rows on phones, so that the legend stays clear of the map's southern tip
    const fs = small ? 12 : 13, keys = REGION_ORDER.slice(), lh = small ? 18 : 20, items = keys.map(k => ({ k: k, w: measure(PADD_NAME[k], fs) + 22 }));
    if (phone) {                                                   // phones: a column at the map's right, without a title (the heading and the source line say it)
      const R = GEO.regLeg, band = Math.max(34, window.SLICE_BAND || 0), step = Math.min(18, (H - band - 12 - R.y - 12) / 6);
      items.forEach((it, k) => { it.g = group(g); const y = R.y + 12 + k * step; S(it.g, 'circle', { cx: R.x + 5, cy: y - 4, r: 5, fill: T.padd[it.k] }); text(it.g, R.x + 15, y, PADD_NAME[it.k], { size: fs, halo: 0, plate: true }); });
      if (host) LIVE['leg-pad'] = (id, q) => { const on = id === 'state-regions' || id === 'state-map' || id === 'adj-state'; items.forEach(it => { it.g.style.opacity = on ? regionAt(REGION_ORDER.indexOf(it.k), q) : 1; }); };
      return;
    }
    let x = GEO.pad, row = 0; items.forEach(it => { if (x + it.w > W - GEO.pad) { x = GEO.pad; row++; } it.x = x; it.row = row; x += it.w + 8; });
    const y0 = H - Math.max(small ? 34 : 46, window.SLICE_BAND || 0) - 12 - row * lh;
    const lt = text(g, GEO.pad, y0 - (small ? 20 : 22), 'Fuel supply region (EIA)', { size: 13, weight: 500, halo: 0 });
    items.forEach(it => { it.g = group(g); S(it.g, 'circle', { cx: it.x + 5, cy: y0 + it.row * lh - 4, r: 5, fill: T.padd[it.k] }); text(it.g, it.x + 15, y0 + it.row * lh, PADD_NAME[it.k], { size: fs, halo: 0 }); });
    // v9.4: the legend's title comes in with the first region, not before
    if (host) LIVE['leg-pad'] = (id, q) => { const on = id === 'state-regions' || id === 'state-map' || id === 'adj-state'; lt.el.style.opacity = on ? regionAt(0, q) : 1; items.forEach(it => { it.g.style.opacity = on ? regionAt(REGION_ORDER.indexOf(it.k), q) : 1; }); };
  }

  /* --- the gaps, built over three beats --- */
  function furKeyAx(g) {
    const gk = GEO.key, b = gk.b, ys = gk.ys;
    ys.ticks(5).forEach(v => { const y = ys(v); line(g, b.x0, y, gk.colR - gk.gut / 2, y, { stroke: T.rule, op: 0.6 }); text(g, b.x0 - 6, y + 4, sgn(v, 0).replace('+0', '0').replace('−0', '0'), { size: 12, fill: T.muted, anchor: 'end', halo: 0 }); });
    yAxisTitle(g, small ? 'Shift against president (pts)' : 'Shift against the president’s party (points)', b);
  }
  // A place's tag under its header: one to three lines, centered on the column.
  function tagText(g, x0, tag, col) {
    const gk = GEO.key, b = gk.b, lh = gk.lhT, yTag = b.y0 - 8 - (gk.nTag - 1) * lh;
    const ls = balancedLines(tag[small ? 1 : 0], gk.cw + gk.gut - 4, gk.fsT, col ? 600 : 400);
    return text(g, x0 + gk.cw / 2, yTag, ls.join('\n'), { size: gk.fsT, weight: col ? 600 : 400, fill: col || T.muted, anchor: 'middle', halo: 0, lh: 1.25 });
  }
  // A place's header, group labels (no counts, v6) and the price-rise tag.
  function keyHead(g, l, x0, tag, tagCol) {
    const gk = GEO.key, b = gk.b, cw = gk.cw, yHead = b.y0 - 8 - (gk.nTag - 1) * gk.lhT - gk.lhT - 4;
    text(g, x0 + cw / 2, yHead, 'Place ' + l, { size: small ? 13 : 14, weight: 600, anchor: 'middle', halo: 0 });
    const xl = x0 + cw * KFX[0], xh = x0 + cw * KFX[1];
    text(g, xl, b.y1 + 17, 'low', { size: 12.5, fill: T.muted, anchor: 'middle', halo: 0 });
    text(g, xh, b.y1 + 17, 'high', { size: 12.5, fill: T.muted, anchor: 'middle', halo: 0 });
    text(g, (xl + xh) / 2, b.y1 + 32, 'exposure', { size: 12.5, fill: T.muted, anchor: 'middle', halo: 0 });
    return tagText(g, x0, tag, tagCol);
  }
  const meanLine = (g, xm, y, dash) => line(g, xm - GEO.key.cw * 0.17, y, xm + GEO.key.cw * 0.17, y, { stroke: T.ink, w: 2.2, dash: dash ? '5 3' : '' });
  // A gap: a vertical arrow from the low average up to the high average, with end caps (no dashed stubs). Returns its parts so they can move.
  function gapMark(g, gx, yl, yh, o) {
    o = o || {};
    const col = o.col || T.accent, gg = group(g);
    const c1 = line(gg, gx - 4, yl, gx + 4, yl, { stroke: col, w: 1.2 }), c2 = line(gg, gx - 4, yh, gx + 4, yh, { stroke: col, w: 1.2 });
    const ar = arrow(gg, gx, yl, gx, yh, { stroke: col, gap: 0, dash: o.dash || '' });
    return { g: gg, set: (x, y1, y2) => { [c1, c2].forEach((c, k) => { c.setAttribute('x1', x - 4); c.setAttribute('x2', x + 4); c.setAttribute('y1', k ? y2 : y1); c.setAttribute('y2', k ? y2 : y1); }); ar.setAttribute('x1', x); ar.setAttribute('x2', x); ar.setAttribute('y1', y1); ar.setAttribute('y2', y2); } };
  }
  function gapLabel(g, x, y, v) {
    if (small) { const t = text(g, x, y - 3, 'gap', { size: 12, fill: T.accent, weight: 600, halo: 3 }); const s2 = S(t.el, 'tspan', { x: x, dy: 14 }); s2.textContent = sgn(v, 1); return t; }
    return text(g, x, y + 4, 'gap ' + sgn(v, 1), { size: 12.5, fill: T.accent, weight: 600, halo: 3 });
  }
  // Place A: the dots and averages are the figure; the gap arrow and its label are the second stage of gaps-same.
  function furKeyA(g) {
    const gk = GEO.key, ys = gk.ys, x0 = gk.colA, cw = gk.cw, A = D.key.A;
    keyHead(g, 'A', x0, KTAG.A);
    const yl = ys(A.mLow), yh = ys(A.mHigh), gx = x0 + cw * KGX;
    meanLine(g, x0 + cw * KFX[0], yl); meanLine(g, x0 + cw * KFX[1], yh);
    const ga = group(g);
    gapMark(ga, gx, yl, yh);
    gapLabel(ga, gx + 6, (yl + yh) / 2, A.gap);
    LIVE.keyA = (id, q, p) => { ga.style.opacity = id === 'gaps-same' ? smooth(0.25, 0.45, p) : 1; };
  }
  // Place B: in gaps-same, faint dots and dashed averages for "the same price rise"; in gaps-bigger its high third rises to the real, wider gap (first stage),
  // then the gap arrow moves out to the widened gap beside the faint "same price rise" gap, which stays as a dashed reference (second stage).
  function furKeyB(g, host) {
    const gk = GEO.key, ys = gk.ys, x0 = gk.colB, cw = gk.cw, B = D.key.B, inner = group(g);
    const gH = group(inner), gR = group(inner);
    const tag0 = keyHead(inner, 'B', x0, KTAG.B0);
    const tag1 = tagText(inner, x0, KTAG.B, T.accent);
    const yl = ys(B.mLow), yhH = ys(B.mHighH), yhR = ys(B.mHigh), xl = x0 + cw * KFX[0], xh = x0 + cw * KFX[1], gx = x0 + cw * KGX, gx2 = x0 + cw * KGX2;
    const lowD = meanLine(gH, xl, yl, true), hiD = meanLine(gH, xh, yhH, true);
    const lowS = meanLine(gR, xl, yl), hiS = meanLine(gR, xh, yhH);
    const ref = gapMark(inner, gx, yl, yhH, { dash: '3 3' });           // the "same price rise" gap
    const cur = gapMark(inner, gx, yl, yhH);                            // the gap as it widens
    const lab = gapLabel(inner, gx2 + 6, (yl + yhR) / 2, B.gap);
    host.geom = { yl: yl, yhH: yhH, yhR: yhR, gx: gx, gx2: gx2 };
    LIVE.keyB = (id, q, p) => {
      const gs = id === 'gaps-same', gb = id === 'gaps-bigger';
      const show = gs ? ease(clamp(q, 0, 1)) : 1, mix = gs ? 0 : gb ? ease(clamp(q, 0, 1)) : 1;     // the dots and averages
      const um = gs ? 0 : gb ? ease(smooth(0.25, 0.45, p)) : 1;                                      // the arrow
      inner.style.opacity = show;
      gH.style.opacity = 1 - mix; gR.style.opacity = mix;
      const yh = lerp(yhH, yhR, mix);
      [hiD, hiS].forEach(e => { e.setAttribute('y1', yh); e.setAttribute('y2', yh); });
      ref.g.style.opacity = gs ? 0 : 0.55 * smooth(0, 0.35, um);
      cur.set(lerp(gx, gx2, smooth(0, 0.35, um)), yl, lerp(yhH, yhR, um));
      cur.g.style.opacity = gs ? 0.6 * smooth(0.25, 0.45, p) : lerp(0.6, 1, um);
      cur.g.querySelector('line:last-child').setAttribute('stroke-dasharray', um < 0.02 ? '3 3' : '');
      lab.el.style.opacity = smooth(0.75, 1, um) * (id === 'gaps-difference' ? 1 - smooth(0, 0.35, q) : 1);
      tag0.el.style.opacity = 1 - smooth(0, 0.5, mix); tag1.el.style.opacity = smooth(0, 0.5, mix);
    };
  }
  function furKeyCap(g) {
    const tw = W - GEO.pad * 2, ty = H - (small ? 66 : 84);
    wrapLines(small ? 'Same exposure cut-offs in both places. Each dot is a county; black lines are each group’s average, arrows each place’s gap.' : 'Both places’ counties are split by the same exposure cut-offs: low below ' + D.keyCut[0].toFixed(2) + '% and high above ' + D.keyCut[1].toFixed(2) + '%. Each dot is a county, black lines are each group’s average, arrows mark each place’s gap.', tw, 13)
      .forEach((l, k) => text(g, GEO.pad, ty + k * 17, l, { size: 13, fill: T.muted, halo: 0 }));
  }
  // The two gaps as bars from one baseline (own scale): the part they share (what sets high-exposure counties apart anyway), and Place B's extra.
  // The bars are the figure; the labels, the shared-part line and the bracket on the difference are the second stage.
  function furKeyR(g, host) {
    const gk = GEO.key, b = gk.b, K = D.key, inner = group(g), fig = group(inner), lbl = group(inner);
    const base = b.y1, top0 = b.y0 + (small ? 18 : 30), sc = Math.max(0, base - top0) * 0.86 / K.B.gap, rx = gk.colR, rw = gk.rw;
    const bwid = small ? 16 : clamp(rw * 0.16, 16, 30), xA = rx + rw * (small ? 0.04 : 0.06), xB = xA + bwid + (small ? 8 : 18), yC = base - K.A.gap * sc, yB = base - K.B.gap * sc;
    text(fig, rx + rw / 2, b.y0 - (small ? 32 : 38), 'the two gaps', { size: small ? 13 : 14, weight: 600, anchor: 'middle', halo: 0 });
    S(fig, 'rect', { x: xA, y: yC, width: bwid, height: base - yC, fill: T.fadedBar || '#AEB8BF' });
    S(fig, 'rect', { x: xB, y: yC, width: bwid, height: base - yC, fill: T.fadedBar || '#AEB8BF' });
    S(fig, 'rect', { x: xB, y: yB, width: bwid, height: yC - yB, fill: T.accent });
    line(fig, rx, base, rx + rw, base, { stroke: T.muted, op: 0.8 });
    text(fig, xA + bwid / 2, base + 17, 'A', { size: 12.5, fill: T.muted, anchor: 'middle', halo: 0 }); text(fig, xB + bwid / 2, base + 17, 'B', { size: 12.5, fill: T.muted, anchor: 'middle', halo: 0 });
    text(fig, xA + bwid / 2, yC - 6, sgn(K.A.gap, 1), { size: 12.5, fill: T.ink, anchor: 'middle', weight: 600, halo: 0 });
    text(fig, xB + bwid / 2, yB - 6, sgn(K.B.gap, 1), { size: 12.5, fill: T.accent, anchor: 'middle', weight: 600, halo: 0 });
    // the shared part: a thin line across both gaps at its height, labeled in the band below it
    const lx = xB + bwid + (small ? 11 : 18), lw = rx + rw - lx, tiny = small || lw < 150;     // narrow label column: the short wordings
    line(lbl, xA - 3, yC, rx + rw, yC, { stroke: T.ink, w: 1, dash: '2 3', op: 0.7 });
    const sl = tiny ? 'in both gaps: largely drops out' : 'rural, Republican-leaning: in both gaps, so it largely drops out', sls = balancedLines(sl, lw, tiny ? 12 : 13, 500);
    sls.forEach((l, k) => text(lbl, lx, yC + (small ? 14 : 17) + k * (small ? 14 : 17), l, { size: small ? 12 : 13, weight: 500, fill: T.ink, halo: 3 }));
    // the difference: a bracket on B's extra
    const bx = xB + bwid + 5, diff = K.B.gap - K.A.gap;
    S(lbl, 'path', { d: 'M' + bx + ',' + yC + ' L' + (bx + 5) + ',' + yC + ' L' + (bx + 5) + ',' + yB + ' L' + bx + ',' + yB, fill: 'none', stroke: T.accent, 'stroke-width': 1.4 });
    const dl = wrapLines((tiny ? 'difference ' : 'difference: ') + sgn(diff, 1), lw, tiny ? 12 : 13.5, 600), d2 = tiny ? [] : balancedLines('what the analysis looks for', lw, 13, 400);
    const hgt = (dl.length + d2.length) * 17, my = (yC + yB) / 2 - hgt / 2 + 13;
    dl.forEach((l, k) => text(lbl, lx, my + k * 17, l, { size: small ? 12 : 13.5, weight: 600, fill: T.accent, halo: 3 }));
    d2.forEach((l, k) => text(lbl, lx, my + (dl.length + k) * 17, l, { size: 13, fill: T.accent, halo: 3 }));
    LIVE.keyR = (id, q, p) => { const on = id === 'gaps-difference'; fig.style.opacity = on ? smooth(0.05, 0.25, p) : 0; lbl.style.opacity = on ? smooth(0.25, 0.45, p) : 0; };
  }

  /* --- Pennsylvania axes and ghost lines --- */
  function paLine(k, xs, ys, mid) {
    const f = D.paFitB, bsl = D.paSlope[k], x0 = xs.domain()[0], x1 = xs.domain()[1], xm = f.mx;
    return [xs(x0), ys(mid + bsl * (x0 - xm)), xs(x1), ys(mid + bsl * (x1 - xm))];
  }
  const PA_LAB = { p16: ['2016 President', '2016'], p20: ['2020 President', '2020'], p24: ['2024 President', '2024'], s18: ['2018 Senate', '2018 Sen.'], s22: ['2022 Senate', '2022 Sen.'] };
  function furPA(g, host) {
    const pa = GEO.pa, b = pa.b, xs = pa.xs, ys = pa.ys, inner = group(g);
    plotAxes(inner, b, xs, ys, small ? 'Extra fuel cost, 2022 (regional EIA rise)' : 'Extra fuel cost, 2022 (regional EIA price rise): share of monthly income taken (%)', small ? 'Vote shift vs president (pts)' : 'Vote shift against the president’s party (points)', { fy: v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v), fx: v => v + '%', yt: 7, xt: small ? 4 : 7 });
    // ghost lines (earlier elections, slopes rescaled to the burden axis)
    const labs = [];
    ['p16', 'p20', 'p24', 's18'].forEach(k => {
      const L = paLine(k, xs, ys, pa.mid);
      line(inner, L[0], L[1], L[2], L[3], { stroke: T.muted, w: 1.2, dash: '4 3', op: 0.5 });
      labs.push({ y: L[3], k: k });
    });
    const L22 = paLine('s22', xs, ys, pa.mid);
    line(inner, L22[0], L22[1], L22[2], L22[3], { stroke: T.accent, w: 2.2 });
    labs.push({ y: L22[3], k: 's22', main: true });
    labs.sort((a, c) => a.y - c.y);
    for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 15) labs[i].y = labs[i - 1].y + 15;
    labs.forEach(l => {
      text(inner, b.x1 + 8, l.y + 4, (small ? PA_LAB[l.k][1] : PA_LAB[l.k][0]) + ' ' + sgn(D.paSlope[l.k], 1), { size: small ? 12 : 13, fill: l.main ? T.accent : T.muted, weight: l.main ? 600 : 400, halo: 0 });
    });
    pa.lines = {}; ['p16', 'p20', 'p24', 's18', 's22'].forEach(k => { pa.lines[k] = paLine(k, xs, ys, pa.mid); });
    LIVE.pa = (id, q) => { inner.style.opacity = id === 'exposure-problem' ? smooth(0.5, 0.95, q) : 1; };
  }

  /* --- reminder of what was set aside --- */
  // v7.2: the reminder moves from the top left (now the heading's place) to the bottom right of the drawing area.
  function furReminder(g) {
    const msg = small ? 'Set aside: whatever moved whole races' : 'Set aside earlier: whatever moved whole races, including any nationwide effect', w = measure(msg, 12.5), x = W - GEO.pad - w, y = H - 4;
    S(g, 'rect', { x: x - 20, y: y - 9, width: 14, height: 10, fill: 'url(#dots-hatch)', stroke: T.muted, 'stroke-width': 0.8, opacity: 0.8 });
    text(g, x, y, msg, { size: 12.5, fill: T.muted, halo: 0 });
  }

  /* --- fan --- */
  function furFan(g) {
    const f = GEO.fan, b = f.b;
    f.ys.ticks(6).forEach(v => {
      const y = f.ys(v); if (y < b.y0 - 1 || y > b.y1 + 1) return;
      line(g, b.x0, y, b.x1, y, { stroke: v === 0 ? T.muted : T.rule, op: v === 0 ? 0.9 : 0.7 });
      text(g, b.x0 - 7, y + 4, (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v), { size: 12, fill: T.muted, anchor: 'end', halo: 0 });
    });
    f.xs.ticks(6).forEach(v => { const x = f.xs(v); line(g, x, b.y1, x, b.y1 + 4, { stroke: T.muted }); text(g, x, b.y1 + 17, (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v), { size: 12, fill: T.muted, anchor: 'middle', halo: 0 }); });
    line(g, b.x0, b.y1, b.x1, b.y1, { stroke: T.muted, op: 0.8 });
    text(g, (b.x0 + b.x1) / 2, b.y1 + (small ? 36 : 40), small ? 'Exposure compared with the state’s average (%)' : 'Exposure compared with the state’s average (% of income per $1 rise)', { size: 13, anchor: 'middle', halo: 0, w: b.x1 - b.x0 });
    yAxisTitle(g, small ? 'Extra fuel cost vs state avg. (%)' : 'Extra fuel cost vs the state’s average (% of income)', b);
  }

  /* --- the "what's left" bar --- */
  // v7.2 [4.7]: one title across both beats; each slice is labeled with its size and a leader to its sliver (fixed rows: the later slice above, so leaders never cross a label).
  const SLICE_LAB = ['oil and gas jobs: a few percent', 'earlier vote shift: a few percent'];
  function furBar(g, host) {
    const B = GEO.bar, w = B.x1 - B.x0;
    text(g, B.x0, B.y - 9, 'What’s left of the differences in extra fuel cost', { size: 13, weight: 500, halo: 0 });
    text(g, B.x1, B.y - 9, 'illustrative sizes', { size: 12.5, fill: T.muted, anchor: 'end', halo: 0 });
    S(g, 'rect', { x: B.x0, y: B.y, width: w, height: B.h, fill: 'none', stroke: T.rule, 'stroke-width': 1 });
    host.slices = ADJ.map((x, j) => S(g, 'rect', { y: B.y, height: B.h, fill: j % 2 ? (T.barAlt && T.barAlt[0] || '#CBD0D6') : (T.barAlt && T.barAlt[1] || '#DCE0E4') }));
    host.rem = S(g, 'rect', { x: B.x0, y: B.y, height: B.h, fill: T.accent });
    host.seps = ADJ.map(() => line(g, 0, B.y, 0, B.y + B.h, { stroke: T.bg, w: 1.5 }));
    const rowY = j => B.y + B.h + (j === ADJ.length - 1 ? 18 : 18 + 17 * (ADJ.length - 1 - j));
    host.labs = ADJ.map((x, j) => {
      const gg = group(g), cx = B.x0 + w * (BAR_R[j] + BAR_R[j + 1]) / 2, ry = rowY(j), lab = small ? SLICE_LAB[j].replace(': a few percent', ': a few %') : SLICE_LAB[j];
      S(gg, 'path', { d: 'M' + cx + ',' + (B.y + B.h + 1) + ' L' + cx + ',' + (ry - 4) + ' L' + (cx - 4) + ',' + (ry - 4), fill: 'none', stroke: T.muted, 'stroke-width': 1 });
      text(gg, cx - 8, ry, lab, { size: 13, fill: T.ink, anchor: 'end', halo: 0 });
      return gg;
    });
    LIVE.bar = (id, q, p) => {
      const si = ADJ.indexOf(id), uq = ease(clamp(q, 0, 1));
      const rem = lerp(BAR_R[si], BAR_R[si + 1], uq);
      host.rem.setAttribute('width', rem * w);
      for (let j = 0; j < ADJ.length; j++) {
        const hi = BAR_R[j], lo = Math.max(BAR_R[j + 1], rem), xr = B.x0 + w * Math.min(hi, 1), xl = B.x0 + w * lo;
        host.slices[j].setAttribute('x', xl); host.slices[j].setAttribute('width', hi > rem ? Math.max(0, xr - xl) : 0);
        host.seps[j].setAttribute('x1', B.x0 + w * BAR_R[j + 1]); host.seps[j].setAttribute('x2', B.x0 + w * BAR_R[j + 1]);
        host.seps[j].setAttribute('opacity', rem < BAR_R[j + 1] - 0.002 || si > j ? 1 : 0);
        // a slice's label comes in with its beat's second stage and stays for the later beats (the bar is held, so it does not fade with t)
        host.labs[j].style.opacity = j < si ? 1 : j === si ? smooth(0.25, 0.32, p || 0) : 0;
      }
    };
  }

  /* --- two-slices: the strips' axes, titles, the labels between them and the 100% bar of the real shares --- */
  function furSlices(g) {
    const Sg = GEO.sl; if (!D.sl || !Sg || !Sg.band) return;
    const fs = Sg.fs, sh = D.sl.sh, x0 = Sg.x0, x1 = Sg.x1, Wd = Sg.Wd, b = Sg.band, X = Sg.X, AMBER = T.amberDark || '#8A4A12';
    const gHead = group(g), gT = [group(g), group(g), group(g)], gAx = group(g), gTk = group(g), gBet = [group(g), group(g)], gSide = group(g), gBarT = group(g), gBarL = group(g);
    text(gHead, x0, Sg.yTitle, small ? 'Each dot is a county; its price rise is simulated' : 'Each dot is a county, placed by a simulated price rise', { weight: 600, size: fs + 1, w: Wd, halo: 0 });
    Sg.TT.forEach((t, k) => wrapLines(t, Sg.tw[k], fs, 600).forEach((l, j) => text(gT[k], x0, b[k].ty + j * Sg.tlh, l, { size: fs, weight: 600, halo: 0 })));
    if (!small) text(gSide, x1, b[2].ty, Sg.SIDE, { anchor: 'end', size: fs, weight: 500, fill: AMBER, halo: 0 });
    // axes: zero line through the strips, the x axis under the last one
    [0, 1, 2].forEach(k => line(gAx, X(0), b[k].y0 - 3, X(0), b[k].y1 + 1, { stroke: T.rule, w: 1 }));
    [0, 1, 2].forEach(k => line(gAx, x0, b[k].y1 + 1, x1, b[k].y1 + 1, { stroke: T.rule, w: 1, op: 0.6 }));
    { const ya = b[2].y1 + 8, step = small || Sg.D > 40 ? 20 : 10;
      line(gAx, X(-Sg.D), ya, X(Sg.D), ya, { stroke: T.muted });
      for (let v = -Sg.D; v <= Sg.D + 1e-6; v += step) {
        line(gAx, X(v), ya, X(v), ya + 4, { stroke: T.muted });
        text(gAx, X(v), ya + fs + 4, v === 0 ? '0' : (v < 0 ? '−' : '+') + Math.abs(v), { anchor: 'middle', size: Math.max(12, fs - 1), fill: T.muted, halo: 0 });
      }
      text(gAx, x1, ya + 2 * fs + 9, small ? 'cents per gallon, vs. the average' : 'price rise relative to the average, cents per gallon', { anchor: 'end', size: Math.max(12, fs - 1), fill: T.muted, halo: 0 }); }
    // the first strip: each region's average as a short dark tick in its lane
    if (Sg.lanes) {
      D.sl.regMean.forEach(m => S(gTk, 'rect', { x: X(m.v) - 1.5, y: b[0].y0 + Sg.laneH * m.ri + 1, width: 3, height: Sg.laneH - 2, fill: T.ink, stroke: T.bg, 'stroke-width': 1 }));
      const tkl = 'black ticks: region averages', tl0 = wrapLines(Sg.TT[0], Sg.tw[0], fs, 600).slice(-1)[0] || '';
      if (!small && measure(tl0, fs, 600) + measure(tkl, Math.max(12, fs - 1)) + 24 < Wd) text(gTk, x1, b[0].y0 - 6, tkl, { anchor: 'end', size: Math.max(12, fs - 1), fill: T.muted, halo: 0 });
    }
    // between the strips: what the next strip removes
    [[Sg.BET[0], T.muted], [Sg.BET[1], T.accent]].forEach((bt, k) => {
      const yy = b[k].y1 + Sg.betH * 0.5 + 1, ax = x0 + 4;
      arrow(gBet[k], ax, yy - fs * 0.6, ax, yy + fs * 0.55, { stroke: bt[1], gap: 1 });
      text(gBet[k], ax + 10, yy + fs * 0.35, bt[0], { size: fs, fill: bt[1], weight: 500 });
    });
    // the 100% bar of the real shares, labeled with the same three names
    const shv = [sh.regional, sh.state, sh.metro], cols = [T.muted, T.accent, AMBER], rects = [];
    let yb = b[2].y1 + Sg.axisH + (small ? 14 : 22) + Sg.btN * Sg.tlh;
    wrapLines(Sg.barTitle, Wd, fs, 600).forEach((l, j) => text(gBarT, x0, yb - (Sg.btN - 1) * Sg.tlh + j * Sg.tlh, l, { weight: 600, size: fs, halo: 0 }));
    yb += 6;
    cols.forEach((c, i) => rects.push(S(gBarT, 'rect', { x: x0, y: yb, width: 0, height: Sg.bhh, fill: i === 0 ? (T.calm || '#8D9AA3') : c })));
    const full = [0, 1, 2].map(i => [x0 + shv.slice(0, i).reduce((a, c) => a + c, 0) * Wd, x0 + shv.slice(0, i + 1).reduce((a, c) => a + c, 0) * Wd]);
    const ly = yb + Sg.bhh + 8 + fs;
    [0, 1].forEach(i => text(gBarL, full[i][0] + 1, ly, Sg.pct(shv[i]) + ' ' + Sg.LAB[i], { w: full[i][1] - full[i][0] - 10, size: fs, weight: 600, halo: 0 }));
    { const ry = ly + Sg.l1n * Sg.tlh + 4, mxc = (full[2][0] + full[2][1]) / 2;
      text(gBarL, x1, ry, Sg.pct(shv[2]) + ' ' + Sg.LAB[2], { anchor: 'end', size: fs, fill: AMBER, weight: 500, halo: 0 });
      line(gBarL, mxc, yb + Sg.bhh + 2, mxc, ry - fs - 2, { stroke: AMBER, w: 1.2 }); }
    LIVE.slices = (id, q, p) => {
      const op = (el, key, v) => setOp(el, 'sl:' + key, v);
      const a1 = smooth(0.1, 0.2, p), aT1 = smooth(0.15, 0.22, p), aT2 = smooth(0.22, 0.29, p);
      op(gHead, 'h', a1); op(gAx, 'ax', a1); op(gTk, 'tk', a1); op(gT[0], 't0', a1); op(gT[1], 't1', aT1); op(gT[2], 't2', aT2);
      op(gBet[0], 'b0', smooth(0.27, 0.35, p)); op(gBet[1], 'b1', smooth(0.31, 0.39, p)); op(gSide, 'sd', smooth(0.31, 0.41, p));
      const aB = smooth(0.32, 0.44, p); op(gBarT, 'bt', aB); op(gBarL, 'bl', smooth(0.4, 0.47, p));
      let cx = x0; shv.forEach((v, i) => { const w2 = v * Wd * aB; rects[i].setAttribute('x', cx); rects[i].setAttribute('width', Math.max(0, w2 - (i < 2 && w2 > 1 ? 1 : 0))); cx += w2; });
    };
  }

  /* --- beat annotations --- */
  const ring = (g, x, y, r, col) => S(g, 'circle', { cx: x, cy: y, r: r, fill: 'none', stroke: col || T.ink, 'stroke-width': 1.3 });

  function aIntro(g, host) {
    const f = F['dots-intro'].s, tgt = atMap(MAP.M0, D.places.delta), occ = occOf(f, 0.25, null, legRects());
    note(late(g, host), occ, tgt, small ? ['Darker: a $1 rise costs', 'a bigger share of income'] : ['Darker dots: a $1 rise costs a bigger share of income', 'e.g. the rural South and parts of the Mountain West'], { w: small ? 200 : 300, ang: Math.PI / 2 });
  }
  function aExposure(g, host) {
    if (restorePhone()) {
      text(late(g, host), GEO.pad, headBottom('expV8') + 18, 'Darker: a $1 rise costs a bigger share of income', { size: 11, fill: T.muted, halo: 0, plate: true });
      return;
    }
    if (small) return;
    const f = F['exposure'].e, tgt = atMap(MAP.M0, D.places.delta), occ = occOf(f, 0.25, null, legRectsEv8());
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0);
    const bounds = { x0: GEO.pad, y0: headBottom('expV8') + 4, x1: W - GEO.pad, y1: H - band - 2 };
    note(late(g, host), occ, tgt, small ? ['Darker: a $1 rise costs', 'a bigger share of income'] : ['Darker dots: a $1 rise costs a bigger share of income', 'e.g. the rural South and parts of the Mountain West'], { w: small ? 200 : 300, ang: Math.PI / 2, bounds: bounds });
  }
  function aExample(g, host) {
    if (small) {
      const f = F['dots-example'].e, gl = late(g, host), gap = 48;
      const top = clamp((f.y[byFips['51059']] + f.y[byFips['37155']]) / 2 - 41, 54, H - 48 - gap - 17);
      [['51059', 'Fairfax County, VA'], ['37155', 'Robeson County, NC']].forEach(([fp, name], j) => {
        const i = byFips[fp], y = top + j * gap, x = GEO.pad;
        text(gl, x, y, name, { size: 12, weight: 600, halo: 0 });
        text(gl, x, y + 17, rows[i].e.toFixed(1) + '% of income', { size: 12, halo: 0 });
        ring(gl, f.x[i], f.y[i], f.r[i] + 2);
        arrow(gl, GEO.exX - 8, y + 17, f.x[i], f.y[i], { gap: f.r[i] + 4 });
      });
      return;
    }
    const f = F['dots-example'].s, occ = occOf(f, 0.5, null, legRectsEv8()), gl = late(g, host);
    [['51059', 'Fairfax County, VA', -Math.PI * 0.3], ['37155', 'Robeson County, NC', Math.PI * 0.18]].forEach(([fp, name, ang]) => {
      const i = byFips[fp], r = rows[i], tgt = [f.x[i], f.y[i]];
      const rEnd = F['dots-example'].e.r[i];   // the marked dot is solid: dots on the desktop canvas are outlines, and an outline inside a ring reads as a double wall
      S(g, 'circle', { cx: tgt[0], cy: tgt[1], r: rEnd + 1, fill: 'rgb(' + C.e[3 * i] + ',' + C.e[3 * i + 1] + ',' + C.e[3 * i + 2] + ')', stroke: T.ink, 'stroke-width': 1.3 });   // one circle: a gap reads differently on a dark dot and a pale one
      const inc = Math.round(r.inc / 12 / 100) * 100;
      note(gl, occ, tgt, [name, Math.round(r.gal) + ' gal/month, ' + money(inc) + ' income', '$1 rise costs ' + r.e.toFixed(1) + '% of income'], { w: small ? 190 : 250, ang: ang, gap: rEnd + 6, dmin: 10, dmax: small ? 56 : 80 });
    });
  }
  // two-analyses and two-analyses-2 (one annotation group, held across both): the national map twice, each with a title and one short caption. The local-price map is
  // emphasized in the first beat and the state-price map in the second (the dots are dimmed in render; here the titles' ink and the outlines follow LIVE.two(w), w = 0 or 1).
  function aTwoAn(g) {
    const G2 = GEO.two, parts = [];
    [[MAP.L, 'Main analysis: local prices', GEO.twoCaps[0]], [MAP.R, 'Second analysis: state prices', GEO.twoCaps[1]]].forEach(([m, title, cap], k) => {
      const t = text(g, m.ox, G2.titleY[k], title, { size: small ? 13 : 14.5, weight: 600, halo: 0 });
      wrapLines(cap, G2.capW, small ? 12 : 13).forEach((l, j) => text(g, m.ox, G2.capY[k] + j * (small ? 15 : 17), l, { size: small ? 12 : 13, fill: T.muted, halo: 0 }));
      const ol = S(g, 'path', { d: borderPath(m, null), fill: 'none', stroke: T.muted, 'stroke-width': 0.8, 'stroke-linecap': 'round' });
      parts.push({ t: t.el, ol: ol });
    });
    LIVE.two = w => parts.forEach((pt, k) => {                      // w: 0 = local-price map emphasized, 1 = state-price map emphasized
      const e = k === 0 ? 1 - w : w;
      pt.t.setAttribute('fill', d3.interpolateRgb(T.muted, T.ink)(e)); pt.ol.setAttribute('stroke-opacity', 0.18 + 0.32 * e);
    });
    LIVE.two(0);
  }
  // races-covered: a small key for the pale states, top left.
  // dots-question (v7.2 [3.1]): the visible change from the exposure map, named on the West Coast (real EIA regional rise, second stage)
  function aQuestion(g, host) {
    const f = F['dots-question'].s, occ = occOf(f, 0.3, null, legRects()), r5 = D.riseReg['5'];
    const pts = []; for (let i = 0; i < n; i++) if (valid[i] && rows[i].padd === '5' && rows[i].st !== 'HI' && rows[i].st !== 'AK' && D.in44[i]) pts.push([f.x[i], f.y[i]]);
    if (!pts.length || !Number.isFinite(r5)) return;
    const c = [d3.mean(pts, p => p[0]), d3.mean(pts, p => p[1])], d = pts.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])), lim = quant(d, 0.45), core = pts.filter((p, k) => d[k] <= lim);
    note(late(g, host), occ, c, ['West Coast: largest rise, +$' + r5.toFixed(2), 'so its counties turn darker'], { w: small ? 150 : 220, pts: core, dmin: 6, dmax: small ? 110 : 160, ang: small ? Math.PI * 0.5 : -Math.PI * 0.25, gap: 4, bounds: small ? { x0: GEO.pad, y0: headBottom('bq') + 4, x1: W - GEO.pad, y1: H - 100 } : { x0: GEO.pad, y0: headBottom('bq') + 4, x1: W - GEO.pad, y1: H - 2 } });
  }
  function aCovered(g) {
    const x = GEO.pad, y = headBottom('cov') + (small ? 16 : 18), lg = S(defs, 'linearGradient', { id: 'dots-g-cov', x1: 0, x2: 1, y1: 0, y2: 0 });
    seqStops(6).forEach(s => S(lg, 'stop', { offset: s[0], 'stop-color': s[1] }));
    S(g, 'rect', { x: x, y: y - 10, width: 26, height: 11, rx: 2, fill: 'url(#dots-g-cov)' });
    if (small) {
      const rl = measure('states with a race (44)', 13, 400);
      text(g, x + 34, y, 'states with a race (44)', { size: 13, halo: 0 });
      const gx = x + 34 + rl + 16;
      S(g, 'circle', { cx: gx, cy: y - 4, r: 4.5, fill: T.pale || '#C9CED3' });
      text(g, gx + 10, y, 'other states', { size: 13, fill: T.muted, halo: 0 });
    } else {
      text(g, x + 34, y, 'states with a Senate or governor\u2019s race in the analysis (44)', { size: 13, halo: 0 });
      S(g, 'circle', { cx: x + 13, cy: y + 15, r: 4.5, fill: T.pale || '#C9CED3' });
      text(g, x + 34, y + 20, 'other states', { size: 13, fill: T.muted, halo: 0 });
    }
  }
  function aHolidays(g, host) {
    const f = F['dots-holidays'].s, occ = occOf(f, 0.5), gl = late(g, host);
    const fm = d => { const dt = new Date(d + 'T12:00:00'); return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
    const sts = ['UT', 'IN', 'OH', 'GA', 'NC'];
    sts.forEach(st => { const pts = statePts(f, st); if (pts.length) S(g, 'path', { d: blob(pts, 6), fill: 'none', stroke: T.accent, 'stroke-width': 1.3, 'stroke-linejoin': 'round' }); });
    sts.forEach(st => {
      const h = D.hol[st], pts = statePts(f, st); if (!h || !pts.length) return;
      const range = fm(h.start) + ' – ' + fm(h.end);
      const l2 = st === 'UT' ? (small ? '6¢ cut, ' + fm(h.start) + '–' + fm(h.end) : 'tax cut 6¢, ' + range) : (small ? fm(h.start) + '–' + fm(h.end) : 'tax suspended, ' + range);
      const ang = st === 'UT' ? -Math.PI * 0.75 : st === 'GA' ? Math.PI * (small ? 0.7 : 0.55) : st === 'NC' ? (small ? Math.PI * 0.25 : -Math.PI * 0.35) : st === 'IN' ? Math.PI : -Math.PI / 2;
      // the arrow ends on the outline, at the point that faces the label's side, so it stays long enough to read at any width
      const ux = Math.cos(ang), uy = Math.sin(ang), e = pts.reduce((a, q) => (q[0] * ux + q[1] * uy > a[0] * ux + a[1] * uy ? q : a), pts[0]);
      note(gl, occ, [e[0] + ux * 8, e[1] + uy * 8], !small && st === 'NC' ? [ST_NAME[st], 'tax suspended', range] : [small && st === 'NC' ? 'N. Carolina' : ST_NAME[st], l2], { w: small ? 150 : st === 'NC' ? 125 : 210, dmin: small ? 12 : clamp(W * 0.022, 20, 40), dmax: small ? 150 : 240, stroke: T.ink, gap: 2, ang: ang });
    });
    if (small) text(g, GEO.pad, H - 6, 'Gas tax suspended on the dates shown; Utah cut it by 6 cents.', { size: 12, fill: T.muted, halo: 0, w: W - 2 * GEO.pad });
  }
  // ideal: Robeson County and its dashed twin. The arrow between them scales with the panel (v6: at least about 60px long on desktop, 40px on phones);
  // the ring and the twin are the figure, the arrow and the two labels the second stage.
  function aIdeal(g, host) {
    const f = F['ideal'].s, i = byFips['37155'], x = f.x[i], y = f.y[i], r = f.r[i], gl = late(g, host);
    const vis = small ? 42 : clamp(W * 0.065, 62, 110), th = 0.44, L = vis + 2 * r + 8;
    const sx = x + L * Math.cos(th) + r + 8 > W - GEO.pad ? -1 : 1;                // the twin goes to the left if there is no room on the right
    const dx = sx * L * Math.cos(th), dy = L * Math.sin(th), gx = x + dx, gy = y + dy;
    ring(g, x, y, r + 3.5);
    S(g, 'circle', { cx: gx, cy: gy, r: r, fill: 'none', stroke: T.ink, 'stroke-width': 1.3, 'stroke-dasharray': '3 2.5' });
    arrow(gl, x + (r + 5) * dx / L, y + (r + 5) * dy / L, gx - (r + 3) * dx / L, gy - (r + 3) * dy / L, { dash: '4 3', gap: 0 });
    const occ = occOf(f, 0.2, null, legRects());
    note(gl, occ, [gx, gy], ['The same county without the price rise', '(we never get to see this)'], { w: small ? 180 : 250, ang: Math.PI / 2, gap: r + 3, dmin: r + 16, dmax: small ? 64 : 90 });
    note(gl, occ, [x, y], ['Robeson County, NC'], { w: 200, ang: -Math.PI * 0.6, gap: r + 6, dmin: r + 12, dmax: small ? 56 : 80 });
  }
  function aAxes(g) {
    const f = F['simplest-axes'].e, occ = occOf(f, 0.3), i = byFips['37155'], b = GEO.sc;
    const tgt = [f.x[i], f.y[i]];
    S(g, 'circle', { cx: tgt[0], cy: tgt[1], r: 5.5, fill: 'none', stroke: T.ink, 'stroke-width': 1.3 });
    const w = measure('one county: Robeson, NC', 13, 600) + 4;
    const sp = emptySpot(occ, w, 20, tgt[0] + 120, tgt[1] - 110, { x0: b.x0 + 8, y0: b.y0 + 2, x1: b.x1 - 4, y1: b.y1 - 4 });
    text(g, sp.x, sp.y + 14, 'one county: Robeson, NC', { size: 13, weight: 600 });
    arrow(g, sp.x + w / 2, sp.y + (sp.y + 10 < tgt[1] ? 20 : 0), tgt[0], tgt[1], { gap: 7 });
  }
  function aSlope(g, host) {
    const b = GEO.sc, fit = D.fit22, x0 = GEO.scX.domain()[0], x1 = GEO.scX.domain()[1];
    const X0 = GEO.scX(x0), X1 = GEO.scX(x1), Y0 = GEO.scY(fit.a + fit.b * x0), Y1 = GEO.scY(fit.a + fit.b * x1);
    const ln = S(g, 'line', { x1: X0, y1: Y0, x2: X1, y2: Y1, stroke: T.accent, 'stroke-width': 2.6, 'stroke-linecap': 'round' });
    const L = Math.hypot(X1 - X0, Y1 - Y0); ln.setAttribute('stroke-dasharray', L + ' ' + L);
    const lg = group(g);
    const f = F['simplest-slope'].s, occ = occOf(f, 0.3);
    const msg = 'Slope: ' + sgn(fit.b, 2) + ' points of vote shift per 1 point of extra fuel cost';
    const w = small ? 150 : 200, ls = wrapLines(msg, w, 13, 600);
    const mid = x0 + (x1 - x0) * 0.9, tgt = [GEO.scX(mid), GEO.scY(fit.a + fit.b * mid)];
    const sp = emptySpot(occ, w, ls.length * 17 + 4, tgt[0] - w / 2, tgt[1] - 150, { x0: b.x0 + 8, y0: b.y0 + (small ? 18 : 2), x1: b.x1 - 4, y1: b.y1 - 4 });
    ls.forEach((l, k) => text(lg, sp.x, sp.y + 14 + k * 17, l, { size: 13, weight: 600, fill: T.accent }));
    arrow(lg, sp.x + w / 2, sp.y + (sp.y + ls.length * 8 < tgt[1] ? ls.length * 17 + 6 : -2), tgt[0], tgt[1], { stroke: T.accent, gap: 3 });
    sub(host, lg, (q, p) => smooth(0.25, 0.32, p));
    LIVE.slope = (q) => { const d = ease(clamp(q, 0, 1)); ln.setAttribute('stroke-dashoffset', L * (1 - d)); };
  }
  // races: the strips are built and hold. A bracket for the differences between races, and one strip named.
  function aRaces(g) {
    const b = GEO.sc, ys = GEO.scY, means = D.races.map(r => r.mean), mn = d3.min(means), mx = d3.max(means);
    const bx = GEO.stX1 + 10;
    S(g, 'path', { d: 'M' + (bx - 5) + ',' + ys(mx) + ' L' + bx + ',' + ys(mx) + ' L' + bx + ',' + ys(mn) + ' L' + (bx - 5) + ',' + ys(mn), fill: 'none', stroke: T.ink, 'stroke-width': 1.2 });
    const msg = 'about three-quarters of the differences are between races (' + Math.round(D.between * 100) + '%)';
    const midY = (ys(mx) + ys(mn)) / 2, ls = wrapLines(msg, GEO.areaX1 - bx - 12, 13, 500), h = ls.length * 17;
    arrow(g, bx + 2, midY, bx + 12, midY, { gap: 0 });
    ls.forEach((l, k) => text(g, bx + 16, midY - h / 2 + 13 + k * 17, l, { size: 13, weight: k === 0 ? 600 : 500, halo: 0 }));
    // one strip, named: a curved arrow to its top dot
    const k = D.races.findIndex(r => r.id === '2022_PA_SEN');
    if (k >= 0) {
      const sx = GEO.stX0 + (k + 0.5) * GEO.stW, e = F['races'].e;
      let tR = 1e9; D.races[k].ids.forEach(i => { tR = Math.min(tR, e.y[i]); });
      S(g, 'rect', { x: sx - GEO.stW / 2 - 1, y: b.y0, width: GEO.stW + 2, height: b.y1 - b.y0, fill: T.accent, opacity: 0.1 });
      const occ = occOf(e, 0.3), bd = { x0: b.x0 + 4, y0: Math.max(24, CUR_HB + 2), x1: GEO.stX1 - 4, y1: b.y1 - 4 };
      const bxl = note(g, occ, [sx, tR], ['Pennsylvania Senate race, 2022', 'this strip is one race; dots are county results'], { noArrow: true, w: small ? 130 : 210, dmin: 30, dmax: 200, bounds: bd, ang: -Math.PI * 0.55 });
      const sx0 = clamp(sx, bxl.x + 6, bxl.x + bxl.w - 6), sy0 = tR < bxl.y ? bxl.y - 2 : bxl.y + bxl.h + 2;
      S(g, 'path', { d: curveD(sx0, sy0, sx, tR - 6, sx0 < sx ? 0.25 : -0.25), fill: 'none', stroke: T.ink, 'stroke-width': 1, 'stroke-linecap': 'round', 'marker-end': 'url(#dots-ah-ink)' });
    }
  }
  function aRaces9(g) {
    const b = GEO.sc, ys = GEO.scY, means = D.races.map(r => r.mean), mn = d3.min(means), mx = d3.max(means);
    const bx = GEO.stX1 + 10, yMx = clamp(ys(mx), b.y0, b.y1), yMn = clamp(ys(mn), b.y0, b.y1);   // the bracket stays inside the plot (the lowest and highest race averages can lie beyond the axis)
    S(g, 'path', { d: 'M' + (bx - 5) + ',' + yMx + ' L' + bx + ',' + yMx + ' L' + bx + ',' + yMn + ' L' + (bx - 5) + ',' + yMn, fill: 'none', stroke: T.ink, 'stroke-width': 1.2 });
    const registered = D.betweenShare != null;
    const share = registered ? D.betweenShare : D.between;
    const msg = tierShort() || tierTablet() ? 'Between races\n' + Math.round(share * 100) + '%' : (registered ? 'nearly nine-tenths' : 'about three-quarters') + ' of the differences are between races (' + Math.round(share * 100) + '%)';
    const fs = small ? 12 : 13, lh = small ? 15 : 17, midY = (yMx + yMn) / 2;
    const ls = wrapLines(msg, GEO.areaX1 - bx - 18, fs, 500), h = ls.length * lh;
    const ty = clamp(midY - h / 2 + fs, b.y0 + fs + 2, b.y1 - h + fs - 2);
    arrow(g, bx + 2, midY, bx + 11, midY, { gap: 0 });
    ls.forEach((l, k) => text(g, bx + 14, ty + k * lh, l, { size: fs, weight: k === 0 ? 600 : 500, halo: 0 }));
    if (tierShort()) return;
    const k = D.races.findIndex(r => r.id === '2022_PA_SEN');
    if (k >= 0) {
      const sx = GEO.stX0 + (k + 0.5) * GEO.stW, e = F['same-race'].e;
      let topDot = Infinity; D.races[k].ids.forEach(i => { topDot = Math.min(topDot, e.y[i]); });
      if (targetSide()) {
        const x = b.x0 + 4, y = b.y0 - 10;
        text(g, x, y, 'Pennsylvania Senate', { size: 13, weight: 600, halo: 0 });
        arrow(g, sx, y + 6, sx, topDot - 6, { gap: 0 });
        return;
      }
      const occ = occOf(e, 0.3), bd = { x0: b.x0 + 4, y0: Math.max(24, CUR_HB + 2), x1: GEO.stX1 - 4, y1: b.y1 - 4 };
      const box = note(g, occ, [sx, topDot], ['Pennsylvania Senate race, 2022'], { noArrow: true, w: small ? 130 : 210, dmin: 30, dmax: 200, bounds: bd, ang: -Math.PI * 0.55 });
      if (phone) { const plate = S(g, 'rect', { x: box.x - 3, y: box.y - 2, width: box.w + 6, height: box.h + 4, fill: T.bg }); g.insertBefore(plate, g.firstChild); }
      const x0 = clamp(sx, box.x + 6, box.x + box.w - 6), y0 = topDot < box.y ? box.y - 2 : box.y + box.h + 2;
      S(g, 'path', { d: curveD(x0, y0, sx, topDot - 6, x0 < sx ? 0.25 : -0.25), fill: 'none', stroke: T.ink, 'stroke-width': 1, 'stroke-linecap': 'round', 'marker-end': 'url(#dots-ah-ink)' });
    }
  }
  function aRacesCentered9() { /* The moving race averages and set-aside label belong to live furniture. */ }
  function aWithin(g) {
    // v7.2 [S2]: an annotation in ink inside the plot (was an accent header above it)
    const b = GEO.sc, msg = 'What’s left: the differences within each race';
    text(g, b.x0 + 8, b.y0 + 14, msg, { size: 13, weight: 600, halo: 3.5, w: GEO.stX1 - b.x0 - 16 });
  }
  function aWho(g) {
    const pa = GEO.pa, b = pa.b, f = F['exposure-problem'].e, occ = occOf(f, 0.5, paPts());
    // the 2018 Senate line out on the left (burden about 1.2%): a curved arrow from a label above it
    const xT = pa.xs(1.2), L = pa.lines.s18, yT = lerpY(L, xT);
    note(g, occ, [xT, yT], small ? ['Faint lines: earlier elections', '(here 2018 Senate)'] : ['Faint lines: the same counties in earlier elections', 'here the 2018 Senate race'], { w: small ? 150 : 230, dmin: 46, dmax: small ? 110 : 150, ang: -Math.PI / 2, curve: 0.3, stroke: T.muted, gap: 2, bounds: { x0: b.x0 + 4, y0: b.y0 + 4, x1: b.x1 - 4, y1: b.y1 - 6 } });
    text(g, GEO.pad, headBottom('pa') + 14, small ? 'Faint lines: shifts toward the Republicans in earlier elections; labels: points per point of extra fuel cost' : 'Faint lines: shifts toward the Republicans in earlier elections. Line labels: points of shift per point of extra fuel cost.', { size: 13, fill: T.muted, halo: 0, w: W - 2 * GEO.pad });
  }
  function paPts() { const pts = []; Object.keys(GEO.pa.lines).forEach(k => { const L = GEO.pa.lines[k], len = Math.hypot(L[2] - L[0], L[3] - L[1]), m = Math.ceil(len / 3); for (let j = 0; j <= m; j++) pts.push([lerp(L[0], L[2], j / m), lerp(L[1], L[3], j / m)]); }); return pts; }
  function lerpY(L, x) { return L[1] + (L[3] - L[1]) * (x - L[0]) / (L[2] - L[0]); }
  // exposure-problem-2: the same dots colored by the 2020 Republican share, a legend, and one arrow from the high-exposure end
  function aWho2(g, host) {
    const pa = GEO.pa, b = pa.b, f = F['exposure-problem-2'].s, bd = { x0: b.x0 + 4, y0: b.y0 + 4, x1: b.x1 - 4, y1: b.y1 - 6 };
    const lo = D.paR.lo, hi = D.paR.hi, wl = small ? 150 : 190;
    const occ = occOf(f, 0.5, paPts());
    const spot = emptySpot(occ, wl + 4, small ? 66 : 62, b.x1 - wl - 10, b.y0 + 30, bd);
    const st = []; for (let k = 0; k <= 8; k++) st.push([k / 8, RED(k / 8)]);
    const tk = [40, 60, 80].filter(v => v >= lo + 2 && v <= hi - 2).map(v => [(v - lo) / (hi - lo), v + '%']);
    gradLegend(g, 'dots-g-r20', spot.x, spot.y + 12, wl, st, small ? 'Republican share, 2020' : 'Republican share of the two-party vote, 2020', tk.length ? tk : [[0, Math.round(lo) + '%'], [1, Math.round(hi) + '%']], wl + 4);
    const top = D.pa.slice().sort((a, c) => D.e[c] - D.e[a]), tgtI = top[2], tgt = [f.x[tgtI], f.y[tgtI]];
    const occ2 = occOf(f, 0.5, paPts(), [[spot.x - 4, spot.y - 4, spot.x + wl + 8, spot.y + 70]]);
    note(late(g, host), occ2, tgt, ['rural, lower-income, more Republican'], { w: small ? 130 : 190, dmin: small ? 38 : 52, dmax: small ? 100 : 130, ang: -Math.PI * 0.2, bounds: bd, gap: 6 });
    const r = D.paCorr;
    if (Number.isFinite(r)) text(g, GEO.pad, headBottom('pa') + 14, small ? 'Exposure and 2020 Republican share: r = ' + r.toFixed(2) : 'Across Pennsylvania’s 67 counties, exposure and the 2020 Republican share move together (correlation ' + r.toFixed(2) + ', weighted by households).', { size: 13, fill: T.muted, halo: 0, w: W - 2 * GEO.pad });
  }
  // price-problem: the two ends of the regional price rise, named with real EIA numbers.
  function aPrice(g, host) {
    const f = F['price-problem'].s, occ = occOf(f, 0.3, null, legRects()), gl = late(g, host);
    const reg = (k, pred) => { const pts = []; for (let i = 0; i < n; i++) if (valid[i] && rows[i].padd === k && (!pred || pred(rows[i]))) pts.push([f.x[i], f.y[i]]); return pts; };
    const r5 = D.riseReg['5'], r1c = D.riseReg['1C'];
    // arrow tips: counties in the inner part of each region, so the arrow lands clearly inside it
    const core = pts => { const c = [d3.mean(pts, p => p[0]), d3.mean(pts, p => p[1])], d = pts.map(p => Math.hypot(p[0] - c[0], p[1] - c[1])), lim = quant(d, 0.45); return { c: c, pts: pts.filter((p, k) => d[k] <= lim) }; };
    const west = core(reg('5', r => r.st !== 'HI')), south = core(reg('1C'));
    note(gl, occ, west.c, ['West Coast +$' + r5.toFixed(2), 'includes some of the most Democratic states'], { w: small ? 140 : 200, bounds: small ? { x0: GEO.pad, y0: Math.max(24, CUR_HB + 2), x1: W * 0.5, y1: H - 2 } : null, pts: west.pts, dmin: 6, dmax: small ? 120 : 170, ang: small ? Math.PI * 0.6 : -Math.PI * 0.35, gap: 4 });
    note(gl, occ, south.c, ['Lower Atlantic +$' + r1c.toFixed(2), 'mostly Republican-leaning states'], { w: small ? 140 : 200, bounds: small ? { x0: W * 0.5 + 6, y0: Math.max(24, CUR_HB + 2), x1: W - GEO.pad, y1: H - 2 } : null, pts: south.pts, dmin: 6, dmax: small ? 120 : 170, ang: Math.PI * 0.1, gap: 4 });
  }
  // price-problem-2: Pennsylvania, first one flat state rise, then illustrative local rises (no names, no numbers on the map).
  function aPrice2v6(g, host) {
    const B = GEO.paBig, y = GEO.top - (small ? 10 : 12), fs = small ? 13 : 14.5;
    S(g, 'path', { d: B.path, fill: 'none', stroke: T.rule, 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
    const gA = group(g), gB = group(g);
    text(gA, GEO.pad, y, 'state prices: one rise for every county in the race', { size: fs, weight: 600, halo: 3, w: W - 2 * GEO.pad });
    text(gB, GEO.pad, y, 'local prices: cities and small towns move differently', { size: fs, weight: 600, halo: 3, w: W - 2 * GEO.pad });
    sub(host, gA, q => 1 - smooth(0.0, 0.35, q));
    sub(host, gB, q => smooth(0.45, 0.9, q));
    // a key in words: darker rose more than the state average, lighter less
    const items = [[D.paBase + 0.8 * D.locDevHi, small ? 'city metro area: rose more than the state' : 'county in a city’s metro area: rose more than the state average'],
      [D.paBase + 0.9 * D.locDevLo, small ? 'small-town area: rose less' : 'county in a small-town area: rose less than the state average'], [D.paBase, small ? 'no local prices: state average' : 'no local prices: the state average']];
    let ky = H - (small ? 52 : 62);
    items.forEach(([v, lab]) => { S(gB, 'circle', { cx: GEO.pad + 6, cy: ky - 4, r: 5, fill: regCss(v) }); text(gB, GEO.pad + 18, ky, lab, { size: 13, fill: T.ink, halo: 0 }); ky += 19; });
  }
  // gaps-same: Place B "if its price had risen by the same amount" is named in the empty third column (second stage).
  function aGapsSame(g, host) {
    const gk = GEO.key, gm = FUR.keyB.geom, rx = gk.colR + 4, w = gk.rw - 10, ym = (gm.yl + gm.yhH) / 2;
    const gs = late(g, host), ls = wrapLines('the same rise: a similar gap', w - 14, 13, 600), h = ls.length * 17;
    arrow(gs, rx + 2, ym, gm.gx + 8, ym, { stroke: T.ink, gap: 2 });
    ls.forEach((l, k) => text(gs, rx + 10, ym - h - 4 + 13 + k * 17, l, { size: 13, weight: 600, halo: 3 }));
  }
  // gaps-bigger: a short curved arrow from the "same price rise" gap to the wider one (second stage).
  function aGapsBigger(g, host) {
    const gk = GEO.key, gm = FUR.keyB.geom, gs = late(g, host);
    const x1 = gm.gx + 2, y1 = gm.yhH - 6, x2 = gm.gx2 - 2, y2 = gm.yhR + 8;
    carrow(gs, x1, y1, x2, y2, { bend: 0.22, gap: 2, stroke: T.ink });
    // the label sits beside the top of the widened gap, above its "gap +2.7"
    const lx = gm.gx2 + 9, ls = wrapLines('widened by the bigger rise?', gk.colR + gk.rw - lx, 13, 600);
    // on phones the label stands above the top of the widened gap, clear of its "gap" label
    ls.forEach((l, k) => text(gs, lx, small ? gm.yhR - 8 - (ls.length - 1 - k) * 16 : gm.yhR + 4 + k * 17, l, { size: small ? 12 : 13, weight: 600, halo: 3 }));
  }
  // comparable-states: supply regions; the Midwest outlined, three pairs of its states linked, the reason named once.
  function regionMarks(g, m, f, o) {
    const mw = {}; MW.forEach(s => { mw[s] = 1; });
    const at = c => m.at ? m.at(c[0], c[1]) : [m.ox + (c[0] - bx0) * m.k, m.oy + (c[1] - by0) * m.k];
    S(g, 'path', { d: borderPath(m, (a, b) => mw[a] && mw[b]), fill: 'none', stroke: T.ink, 'stroke-opacity': o.borderOp, 'stroke-width': 0.8, 'stroke-linecap': 'round' });
    if (o.outline) S(g, 'path', { d: blob(D.mwIds.map(i => [f.x[i], f.y[i]]), 7), fill: 'none', stroke: T.ink, 'stroke-width': 1.5, 'stroke-linejoin': 'round' });
    const arcs = [], ga = o.host ? late(g, o.host) : g;
    MW_PAIRS.forEach(([a, b, bend]) => {
      const ca = D.stC[a], cb = D.stC[b]; if (!ca || !cb) return;
      const p = at(ca), q = at(cb), dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1, cut = small ? 9 : 12;
      const x1 = p[0] + dx / L * cut, y1 = p[1] + dy / L * cut, x2 = q[0] - dx / L * cut, y2 = q[1] - dy / L * cut;
      carrow(ga, x1, y1, x2, y2, { both: true, bend: bend, gap: 1, stroke: o.arrowCol || T.ink, sw: o.sw || 1.1 });
      arcs.push(curveAt(x1, y1, x2, y2, bend, 0.5));
    });
    // state labels on top, so their halo keeps the arrows off the letters
    const pairSt = {}; MW_PAIRS.forEach(pr => { pairSt[pr[0]] = 1; pairSt[pr[1]] = 1; });   // v9.4 QA: a phone's small map names only the states the arrows join
    const placed = [];   // a small map leaves out a name that would land on one already drawn
    MW.forEach(st => { const c = D.stC[st]; if (!c || (small && !pairSt[st])) return; const q = at(c); if (small && placed.some(r => Math.abs(r[0] - q[0]) < 22 && Math.abs(r[1] - q[1]) < 14)) return; placed.push(q); text(g, q[0], q[1] + 4, st, { size: 12, weight: 600, anchor: 'middle', halo: 3.5, plate: true, fill: o.labCol || T.ink }); });
    return arcs;
  }
  function aRegions(g, host) {
    const f = F['comparable-states'].s, m = MAP.M0, gl = late(g, host);
    const arcs = regionMarks(g, m, f, { borderOp: 0.28, outline: true, host: host });
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0);      // v9: the supply-region legend sits above the slice-bar offset and takes up to three rows on a phone
    const occ = occOf(f, 0.4, null, [[0, H - band - (small ? 124 : 100), W, H]]);
    const pts = D.mwIds.map(i => [f.x[i], f.y[i]]), mx = d3.mean(pts, p => p[0]);
    const topP = pts.filter(p => Math.abs(p[0] - mx) < 40).sort((a, c) => a[1] - c[1])[0] || pts[0];
    // phones: one callout (the map is small and the legend takes three rows), so the two labels would collide
    note(gl, occ, [topP[0], topP[1] - 8], small ? ['Midwest: compared only with each other'] : ['Midwest', 'shared refineries and pipelines'], { w: small ? 200 : 220, dmin: 26, dmax: small ? 70 : 100, ang: -Math.PI / 2, curve: 0.25, gap: 4, bounds: small ? { x0: GEO.pad, y0: Math.max(24, CUR_HB + 2), x1: W - GEO.pad, y1: topP[1] - 4 } : null });
    if (arcs[2] && !small) note(gl, occ, arcs[2], ['compared only with each other'], { w: small ? 130 : 200, dmin: 18, dmax: small ? 80 : 120, ang: Math.PI * 0.5, gap: 3 });
  }
  // Metro areas by kind in Pennsylvania: grouped and outlined, two pairs linked. Area names are real geography; no prices here.
  function paAreas(g, B, o) {
    const groups = Object.keys(D.metroGroups).map(k => D.metroGroups[k]);
    S(g, 'path', { d: B.path, fill: 'none', stroke: T.rule, 'stroke-width': 1.2, 'stroke-linejoin': 'round', opacity: o.faint ? 0.7 : 1 });
    groups.forEach(gr => {
      gr.pts = gr.js.map(j => [B.x[j], B.y[j]]);
      // the fill lies over the canvas dots, so it stays faint
      S(g, 'path', { d: blob(gr.pts, B.r + 4.5), fill: gr.micro ? KIND.microFill : KIND.metroFill, 'fill-opacity': o.faint ? 0.12 : 0.22, stroke: gr.micro ? KIND.micro : KIND.metro, 'stroke-opacity': o.faint ? 0.35 : 0.8, 'stroke-width': 1.2, 'stroke-dasharray': gr.micro ? '4 3' : '' });
    });
    const byName = nm => groups.find(q => q.name === nm);
    const micros = groups.filter(q => q.micro).sort((a, c) => d3.mean(a.pts, p => p[0]) - d3.mean(c.pts, p => p[0]));
    const edge = (gr, dir) => { const p = gr.pts.slice().sort((a, c) => dir * (c[1] - a[1]))[0]; return [p[0], p[1] + dir * (B.r + 6)]; };
    const pairs = [];
    const pit = byName('Pittsburgh'), har = byName('Harrisburg');
    // the arcs bow out of the state: metropolitan areas below it, micropolitan areas above it
    if (pit && har) pairs.push([edge(pit, 1), edge(har, 1), 0.34, 'metro', pit, har]);
    if (micros.length >= 2) pairs.push([edge(micros[0], -1), edge(micros[micros.length - 1], -1), -0.3, 'micro', micros[0], micros[micros.length - 1]]);
    const ga = o.host ? late(g, o.host) : g;
    pairs.forEach(pr => carrow(ga, pr[0][0], pr[0][1], pr[1][0], pr[1][1], { both: true, bend: pr[2], gap: 2, stroke: o.arrowCol || T.ink, sw: o.sw || 1.1 }));
    return { groups: groups, byName: byName, pairs: pairs, lateG: ga };
  }
  function aComparable(g, host) {
    const B = GEO.paC, f = F['comparable-metros'].s, A = paAreas(g, B, { host: host });
    // key (top): the two kinds
    const keys = [['metro', small ? 'Metropolitan area (city of 50,000+)' : 'Metropolitan area: around a city of 50,000 or more'], ['micro', small ? 'Micropolitan area (town of 10–50,000)' : 'Micropolitan area: around a town of 10,000 to 50,000']];
    let x = GEO.pad, y = small ? 36 : 40;
    keys.forEach(([k, lab]) => {
      const w = measure(lab, 13) + 30; if (x + w > W - GEO.pad && x > GEO.pad) { x = GEO.pad; y += 19; }
      S(g, 'rect', { x: x, y: y - 11, width: 17, height: 11, rx: 3, fill: k === 'micro' ? KIND.microFill : KIND.metroFill, stroke: k === 'micro' ? KIND.micro : KIND.metro, 'stroke-width': 1.2, 'stroke-dasharray': k === 'micro' ? '3 2' : '' });
      S(g, 'circle', { cx: x + 8.5, cy: y - 5.5, r: 2.6, fill: k === 'micro' ? KIND.micro : KIND.metro });
      text(g, x + 23, y, lab, { size: 13, halo: 0 }); x += w + 14;
    });
    // each arc's label sits outside the state, above (micropolitan) or below (metropolitan) it
    const yTop = d3.min(B.y) - B.r - 12, yBot = d3.max(B.y) + B.r + 26;
    A.pairs.forEach(pr => {
      const ap = curveAt(pr[0][0], pr[0][1], pr[1][0], pr[1][1], pr[2], 0.5);
      const lab = pr[3] === 'metro' ? (small ? 'metro areas: compared' : 'metropolitan areas: compared with each other') : (small ? 'small towns: compared' : 'micropolitan areas: compared with each other');
      const lw = measure(lab, 13, 600);
      text(A.lateG, clamp(ap[0], GEO.pad + lw / 2, W - GEO.pad - lw / 2), pr[3] === 'micro' ? Math.min(ap[1] - 9, yTop) : Math.max(ap[1] + 19, yBot), lab, { size: 13, weight: 600, anchor: 'middle' });
    });
    // names (real geography, no prices): the metropolitan areas the arc links, and Philadelphia; set just above (or below) each area
    const named = [];
    A.pairs.forEach(pr => { if (pr[3] === 'metro') { named.push([pr[4], -1]); named.push([pr[5], -1]); } });
    if (A.byName('Philadelphia')) named.push([A.byName('Philadelphia'), 1]);
    // try the preferred side, then the other, then beside the area; take the first spot that clears the other counties' dots
    const hits = (x, y, lw) => { let c = 0; for (let j = 0; j < B.x.length; j++) { const dx = Math.max(Math.abs(B.x[j] - x) - lw / 2, 0), dy = Math.max(Math.abs(B.y[j] - (y - 4)) - 8, 0); if (dx * dx + dy * dy < (B.r + 1) * (B.r + 1)) c++; } return c; };
    named.forEach(([gr, dir]) => {
      const xs = gr.pts.map(p => p[0]), ys = gr.pts.map(p => p[1]), lw = measure(gr.name, 12.5, 600), cx = d3.mean(xs);
      const above = [cx, d3.min(ys) - B.r - 9], below = [cx, d3.max(ys) + B.r + 19], right = [d3.max(xs) + B.r + 6 + lw / 2, d3.mean(ys) + 4], left = [d3.min(xs) - B.r - 6 - lw / 2, d3.mean(ys) + 4];
      const cands = (dir < 0 ? [above, below] : [below, above]).concat([right, left]).map(c => [clamp(c[0], GEO.pad + lw / 2, W - GEO.pad - lw / 2), c[1]]);
      let pick = cands[0], best = 1e9; cands.forEach((c, k) => { const v = hits(c[0], c[1], lw) * 10 + k; if (v < best) { best = v; pick = c; } });
      text(g, pick[0], pick[1], gr.name, { size: 12.5, weight: 600, anchor: 'middle', halo: 3.5 });
    });
  }
  // assumption: the two kinds of comparison, side by side; the accent arrows are the strongest marks, everything else is faint. No prices.
  function aAssump(g, host) {
    const fs = small ? 13 : 14.5, A = GEO.as, f = F['assumption-v6'].s, lh = small ? 17 : 19.5;
    const ls = balancedLines(ASSUMP_CAP, W - 2 * GEO.pad, fs, 600);
    const mapTop = Math.min(A.L.box.y, A.R.box.y), y0 = Math.max(fs + 4, mapTop - (small ? 14 : 30) - (ls.length - 1) * lh);
    ls.forEach((l, k) => text(g, GEO.pad, y0 + k * lh, l, { size: fs, weight: 600, halo: 0 }));
    const sw = small ? 1.5 : 1.8;
    regionMarks(g, A.L, f, { borderOp: 0.16, outline: false, labCol: T.muted, arrowCol: T.accent, sw: sw, host: host });
    paAreas(g, A.R, { faint: true, arrowCol: T.accent, sw: sw, host: host });
    const yl = A.stacked ? null : Math.max(A.L.box.y + A.L.box.h, A.R.box.y + A.R.box.h) + 18;
    const lab = (m, str) => text(g, m.box.x + m.box.w / 2, yl == null ? m.box.y + m.box.h + 14 : yl, str, { size: small ? 12 : 13, fill: T.muted, anchor: 'middle', halo: 0 });
    lab(A.L, small ? 'states in one supply region (Midwest)' : 'states in one supply region (the Midwest)');
    lab(A.R, small || measure('areas of the same kind in one state (Pennsylvania)', 13) / 2 > Math.min(A.R.box.x + A.R.box.w / 2, W - A.R.box.x - A.R.box.w / 2) - 4 ? 'areas of the same kind (Pennsylvania)' : 'areas of the same kind in one state (Pennsylvania)');
  }

  function aLeft(g, host) {
    const fb = GEO.fan.b, f = GEO.fan;
    const gA = group(g), wA = small ? 150 : 250, msgA = 'Before: extra fuel cost climbs steeply with exposure, mostly because prices rose everywhere';
    const lsA = wrapLines(msgA, wA, 13), occ = occOf(F['what-is-left'].s, 0.3);
    const spA = emptySpot(occ, wA, lsA.length * 17 + 4, fb.x0 + 30, fb.y0 + 30, { x0: fb.x0 + 8, y0: fb.y0 + 4, x1: fb.x1 - 4, y1: fb.y1 - 6 });
    lsA.forEach((l, k) => text(gA, spA.x, spA.y + 14 + k * 17, l, { size: 13, weight: 500 }));
    outNote(gA, NOUT.fan, fb, 'br');                     // bottom right: the empty corner of the steep 'before' cloud
    sub(host, gA, q => 1 - smooth(0, 0.35, q));          // v7.2 [4.2]: full strength until the collapse starts (p 0.30)
    const gB = group(g), msgB = 'After: only exposure times the unusual part of each market’s rise is left', wB = small ? 170 : 300, lsB = wrapLines(msgB, wB, 13, 600);
    const occB = occOf(F['what-is-left'].e, 0.3);
    const spB = emptySpot(occB, wB, lsB.length * 17 + 4, fb.x0 + 60, f.ys(0) - 110, { x0: fb.x0 + 8, y0: fb.y0 + 4, x1: fb.x1 - 4, y1: fb.y1 - 6 });
    lsB.forEach((l, k) => text(gB, spB.x, spB.y + 14 + k * 17, l, { size: 13, weight: 600, fill: T.accent }));
    arrow(gB, spB.x + wB / 2, spB.y + (spB.y < f.ys(0) ? lsB.length * 17 + 6 : -2), spB.x + wB / 2, f.ys(0) + (spB.y < f.ys(0) ? -8 : 8), { stroke: T.accent, gap: 2 });
    sub(host, gB, (q, p) => smooth(0.42, 0.5, p));
    // The line through the dots collapses with them: same ease(q) as the dots, so it never flattens ahead of them.
    const fl = S(g, 'line', { stroke: T.accent, 'stroke-width': 2.2, 'stroke-linecap': 'round' });
    LIVE.left = (q) => {
      const u = ease(clamp(q, 0, 1)), a = lerp(D.fanFit.raw.a, D.fanFit.rec.a, u), bb = lerp(D.fanFit.raw.b, D.fanFit.rec.b, u), xa = f.xs.domain()[0], xb = f.xs.domain()[1];
      fl.setAttribute('x1', f.xs(xa)); fl.setAttribute('x2', f.xs(xb)); fl.setAttribute('y1', clamp(f.ys(a + bb * xa), fb.y0, fb.y1)); fl.setAttribute('y2', clamp(f.ys(a + bb * xb), fb.y0, fb.y1));
    };
    LIVE.left(0);
  }

  /* --- insets for the adjustments (illustrative states, never a real one) --- */
  function insetTitle(g, I, str) { return text(g, I.x, I.y + 12, str, { size: 13, weight: 500, halo: 0, w: I.w }); }
  // A small price chart: lines [{vals, col, w, lab}], dates; end labels kept apart. Returns the scales.
  function insetChart(g, I, title, dates, lines, xLab, pre, labG) {
    const tt = insetTitle(g, I, title), lblW = small ? 70 : 150;
    const bx = { x0: I.x + (small ? 34 : 40), x1: I.x + I.w - lblW - 6, y0: I.y + tt.h + 8, y1: I.y + I.h - 18 };
    const xs = d3.scaleTime().domain([dates[0], dates[dates.length - 1]]).range([bx.x0, bx.x1]), all = [].concat.apply([], lines.map(l => l.vals));
    const ys = d3.scaleLinear().domain([d3.min(all) - 0.1, d3.max(all) + 0.1]).range([bx.y1, bx.y0]);
    ys.ticks(3).forEach(v => { line(g, bx.x0, ys(v), bx.x1, ys(v), { stroke: T.rule, op: 0.7 }); text(g, bx.x0 - 5, ys(v) + 4, '$' + v.toFixed(1), { size: 12, fill: T.muted, anchor: 'end', halo: 0 }); });
    const pth = vals => 'M' + dates.map((d, k) => xs(d).toFixed(1) + ',' + ys(vals[k]).toFixed(1)).join('L');
    if (pre) pre(xs, ys, bx);
    lines.forEach(l => S(g, 'path', { d: pth(l.vals), fill: 'none', stroke: l.col, 'stroke-width': l.w, 'stroke-linejoin': 'round' }));
    text(g, bx.x0, bx.y1 + 15, xLab[0], { size: 12, fill: T.muted, halo: 0 }); text(g, bx.x1, bx.y1 + 15, xLab[1], { size: 12, fill: T.muted, anchor: 'end', halo: 0 });
    const ends = lines.map(l => ({ y: ys(l.vals[l.vals.length - 1]) + 4, s: l.lab, col: l.labCol || l.col })).sort((u, v) => u.y - v.y);
    const gapY = small ? 15 : 18;
    for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < gapY) ends[k].y = ends[k - 1].y + gapY;
    ends.forEach(e => text(labG || g, bx.x1 + 6, e.y, e.s, { size: 12.5, fill: e.col, halo: 0, weight: 500, w: lblW }));
    return { xs: xs, ys: ys, bx: bx };
  }
  function aPass(g, host) {
    const series = rawData.eia.national.filter(d => d.date >= '2025-01-01'), dates = series.map(d => new Date(d.date));
    // The national price runs between the two states; all three start at the same point. State X moves less, State Y more.
    const a = series.map(d => d.p), p0 = a[0], X = a.map(v => p0 + 0.55 * (v - p0)), Y = a.map(v => p0 + 1.7 * (v - p0));
    const c = insetChart(g, GEO.inset, 'Two illustrative states against the national price', dates,
      [{ vals: Y, col: T.rep, w: 1.7, lab: small ? 'State Y' : 'State Y: moves more' }, { vals: a, col: T.muted, w: 3.4, lab: small ? 'national' : 'national price' }, { vals: X, col: T.accent, w: 1.7, lab: small ? 'State X' : 'State X: moves less' }],
      ['Jan 2025', 'Oct 2026'], null, late(g, host));
    S(g, 'circle', { cx: c.xs(dates[0]), cy: c.ys(p0), r: 3, fill: T.ink });
  }
  // adj-lagged (v6): a vote-path schematic, illustrative. High-exposure counties in comparable states stay level; in a state whose prices had risen unusually
  // fast before 2024 they voted further toward the Republicans in 2024 (punishing the Democrats) and drifted part of the way back by 2026, which looks like a turn
  // against the new president's party. The lines draw left to right (first stage); the arrows and labels are the second stage.
  // v6.2 layout (no label touches a line or an arrow at any width): the plot's own height holds the lines and the 2024 label above the peak; the names of the two lines
  // and the 2026 note sit in a band under the zero line, whose height follows their wrapped text; the name of the solid line sits top left, above the line.
  function aLagged(g, host) {
    const I = GEO.lag, fs = small ? 12 : 13, lh = fs * 1.28;
    const wI = I.x1 - I.x0, Hp = I.y1 - Math.max(I.y0, I.y1 - 0.78 * wI);
    const xs = v => I.x0 + (v - 2019.6) / 7.3 * wI, x20 = xs(2020), x24 = xs(2024), x26 = xs(2026);
    const T24 = '2024: punished the Democrats for the earlier rise', T26 = '2026: drifting back, which looks like a turn against the new president’s party';
    const TA = small ? 'high-exposure counties, in a state whose prices had risen unusually fast before 2024' : 'high-exposure counties in a state whose prices had risen unusually fast before 2024';
    const TB = small ? 'high-exposure counties, comparable states' : 'high-exposure counties in comparable states';
    // the band under the zero line: the dashed line's name at the left, the 2026 note at the right
    const lx = I.x0 + wI * 0.46, lsB = wrapLines(TB, lx - I.x0 - 18, fs, 600), lsD = wrapLines(T26, I.x1 - lx, fs, 600);
    const nb = Math.max(lsB.length, lsD.length) * lh + 14;
    // the 2024 label above the peak
    const lsC = wrapLines(T24, wI * 0.3, fs, 600), wC = d3.max(lsC, l => measure(l, fs, 600)), hC = lsC.length * lh;
    const topV = Math.max(small ? 6.8 : 5.6, 3.1 / Math.max(0.2, 1 - (hC + 24) / (Hp - nb)));
    // on wide panels the plot stops growing (about 0.12 of its width per point of vote shift) and sits at the bottom of the area, so the slopes stay readable
    const unit = Math.min((Hp - nb) / topV, 0.12 * wI), y0 = I.y1 - nb - unit * topV, yZ = I.y1 - nb, ys = v => yZ - v * unit;
    [0, 2, 4].forEach(v => { if (ys(v) < y0 - 1) return; line(g, I.x0, ys(v), I.x1, ys(v), { stroke: v === 0 ? T.muted : T.rule, w: 1, op: v === 0 ? 0.8 : 0.7 }); text(g, I.x0 - 7, ys(v) + 4, (v > 0 ? '+' : '') + v, { size: 12, fill: T.muted, anchor: 'end', halo: 0 }); });
    line(g, I.x0, I.y1, I.x1, I.y1, { stroke: T.muted, op: 0.8 });
    [2020, 2024, 2026].forEach(v => { line(g, xs(v), I.y1, xs(v), I.y1 + 4, { stroke: T.muted }); text(g, xs(v), I.y1 + 18, String(v), { size: 12.5, fill: T.ink, anchor: 'middle', halo: 0, weight: 500 }); });
    yAxisTitle(g, small ? 'toward Republicans (pts)' : 'vote shift toward Republicans (points)', { y0: y0, y1: I.y1 });
    text(g, I.x1, y0 + 12, 'Illustrative', { size: 12, fill: T.muted, anchor: 'end', halo: 0, weight: 500 });
    // the two lines, revealed by a clip that grows with the build
    const cid = 'dots-lag-clip', cp = S(defs, 'clipPath', { id: cid }), cr = S(cp, 'rect', { x: I.x0 - 6, y: y0 - 6, width: 0, height: I.y1 - y0 + 12 });
    const cmp = [[2020, 0.2], [2024, 0.15], [2026, 0.3]], st = [[2020, 0.2], [2024, 3.1], [2026, 1.7]], path = a => 'M' + a.map(q => xs(q[0]).toFixed(1) + ',' + ys(q[1]).toFixed(1)).join('L');
    const gl = S(g, 'g', { 'clip-path': 'url(#' + cid + ')' });
    S(gl, 'path', { d: path(cmp), fill: 'none', stroke: T.muted, 'stroke-width': 2.2, 'stroke-dasharray': '6 4', 'stroke-linejoin': 'round' });
    S(gl, 'path', { d: path(st), fill: 'none', stroke: T.accent, 'stroke-width': 2.8, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    cmp.forEach(q => S(gl, 'circle', { cx: xs(q[0]), cy: ys(q[1]), r: 3.6, fill: T.bg, stroke: T.muted, 'stroke-width': 1.6 }));
    st.forEach(q => S(gl, 'circle', { cx: xs(q[0]), cy: ys(q[1]), r: 4, fill: T.accent, stroke: T.bg, 'stroke-width': 1.2 }));
    LIVE.lag = q => { cr.setAttribute('width', (wI + 14) * ease(clamp(q, 0, 1))); };
    LIVE.lag(0);
    // second stage: names of the lines, the 2024 gap, the 2026 drift
    const L2 = late(g, host), yP = ys(3.1), yL = ys(0.15), y26 = ys(1.7), top = y0 + 4;
    // the solid line's name, top left: as wide as the room before the 2024 label allows, and clear of the rising line below it
    { const cxC = clamp(x24, I.x0 + wC / 2 + 2, I.x1 - wC / 2 - 2), xa = I.x0 + 8, room = cxC - wC / 2 - 10 - xa;
      const yLine = x => ys(0.2 + clamp((x - x20) / (x24 - x20), 0, 1) * 2.9);
      let best = null;
      for (let w = Math.max(room, 60); w >= 60; w -= 6) {
        const ls = wrapLines(TA, w, fs, 600), wa = d3.max(ls, l => measure(l, fs, 600)), slack = yLine(xa + wa) - (top + ls.length * lh) - 10;
        if (!best || slack > best.slack) best = { ls: ls, slack: slack };
        if (slack >= 0) { best = { ls: ls, slack: slack }; break; }
      }
      best.ls.forEach((l, k) => text(L2, xa, top + fs + k * lh, l, { size: fs, weight: 600, fill: T.accent, halo: 3 })); }
    // the dashed line's name, in the band under the zero line, with a short leader up to the line when there is room for one
    lsB.forEach((l, k) => text(L2, I.x0 + 8, yZ + 8 + fs + k * lh, l, { size: fs, weight: 600, fill: T.muted, halo: 3 }));
    { const bx = xs(2021.4), by = ys(0.18) + 5; if (yZ + 6 - by >= 12) arrow(L2, bx, yZ + 7, bx, by, { stroke: T.muted, gap: 0 }); }
    // 2024: the gap between the two lines, double arrow just left of the peak, label above
    { const ax = x24 - 13, mid = (yP + yL) / 2;
      arrow(L2, ax, mid, ax, yP, { stroke: T.accent, gap: 0 }); arrow(L2, ax, mid, ax, yL, { stroke: T.accent, gap: 0 });
      const cx = clamp(x24, I.x0 + wC / 2 + 2, I.x1 - wC / 2 - 2);
      lsC.forEach((l, k) => text(L2, cx, top + fs + k * lh, l, { size: fs, weight: 600, anchor: 'middle', halo: 3 }));
      if (yP - 7 - (top + hC + 3) > 8) arrow(L2, x24, top + hC + 3, x24, yP - 7, { stroke: T.ink, gap: 0 }); }
    // 2026: a dotted level from the 2024 peak and an arrow down to the 2026 point; the note sits in the band under the zero line, with a leader that passes just right of the
    // dashed line's last point
    { line(L2, x24 + 6, yP, x26, yP, { stroke: T.accent, w: 1.2, dash: '2 3' });
      arrow(L2, x26, yP, x26, y26 - 7, { stroke: T.accent, gap: 0 });
      lsD.forEach((l, k) => text(L2, lx, yZ + 8 + fs + k * lh, l, { size: fs, weight: 600, fill: T.accent, halo: 3 }));
      const xd = Math.min(I.x1 - 2, x26 + clamp(wI * 0.035, 10, 16));
      arrow(L2, xd, yZ + 6, x26 + 2, y26 + 9, { stroke: T.accent, gap: 0 }); }
  }
  function aOil(g, host) {
    g = late(g, host);
    const m = MAP.M1, f = F['adj-oil'].s, occ = occOf(f, 0.5, null, [[GEO.inset.x - 4, GEO.inset.y - 4, GEO.inset.x + GEO.inset.w, GEO.bar.y + GEO.bar.h + 30]]), tgt = atMap(m, D.places.permian);
    note(g, occ, [tgt[0] - 3, tgt[1] + 6], ['for example, West Texas'], { w: small ? 190 : 260, dmin: 8, dmax: small ? 90 : 120, gap: 3, stroke: T.accent, fill: T.accent, ang: Math.PI * 0.55 });
  }
  function aOil9(g, host) {
    // v9.4: the key sits in the title area (stage 1 shows the highlighted markets); "for example, West Texas" comes in stage 2
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0), m = MAP.MAdj, f = F['adj-oil'].e;
    const K = dotKeyLayout([{ fill: T.accent, lab: 'Local markets where oil and gas make up more than 2% of jobs' }, { fill: T.pale || '#C9CED3', op: 0.8, lab: 'other local markets' }], 13, small ? 14 : 22);
    if (phone) {
      const y = headBottom('oil');
      S(g, 'circle', { cx: GEO.pad + 4, cy: y + 13, r: 3, fill: T.accent }); text(g, GEO.pad + 14, y + 17, 'Oil and gas: over 2% of local jobs', { size: 13, halo: 0 });
    } else dotKeyDraw(group(g), headBottom('oil') + 17, K, 13);
    const occ = occOf(f, 0.5, null, [[0, H - band - 100, W, H]]), tgt = atMap(m, D.places.permian);
    note(late(g, host), occ, [tgt[0] - 3, tgt[1] + 6], ['for example, West Texas'], {
      w: small ? 160 : 220, dmin: 8, dmax: small ? 90 : 120, gap: 3, stroke: T.accent, fill: T.accent,
      plate: true, ang: Math.PI * 0.55, bounds: { x0: GEO.pad, y0: m.oy - 4, x1: W - GEO.pad, y1: H - band - 8 }
    });
  }
  function aPrior(g) {
    const I = Object.assign({}, GEO.inset, { y: GEO.inset.y - (small ? 0 : 28) }), w = Math.min(small ? W - 2 * GEO.pad : 300, I.w);
    const lg = S(defs, 'linearGradient', { id: 'dots-g-p', x1: 0, x2: 1, y1: 0, y2: 0 });
    for (let k = 0; k <= 8; k++) S(lg, 'stop', { offset: k / 8, 'stop-color': PART(-1 + k / 4) });
    const tt = text(g, I.x, I.y + 12, '2020–24 shift (points)', { size: 13, weight: 500, halo: 0 });
    const by = I.y + tt.h + 6;
    S(g, 'rect', { x: I.x, y: by, width: w, height: 10, fill: 'url(#dots-g-p)', stroke: T.rule });
    const M = D.p24M;
    [[0, '−' + M.toFixed(0)], [0.5, '0'], [1, '+' + M.toFixed(0)]].forEach(([u, s]) => { line(g, I.x + u * w, by + 10, I.x + u * w, by + 14, { stroke: T.muted }); text(g, I.x + u * w, by + 27, s, { size: 12, fill: T.muted, anchor: u === 0 ? 'start' : u === 1 ? 'end' : 'middle', halo: 0 }); });
    text(g, I.x, by + 46, 'toward Democrats', { size: 13, fill: T.muted, halo: 0 }); text(g, I.x + w, by + 46, 'toward Republicans', { size: 13, fill: T.muted, anchor: 'end', halo: 0 });
  }
  function aPrior9(g) {
    if (phone) {
      const x = GEO.pad, y = headBottom('prior'), bx = x + 124, bw = W - GEO.pad - bx;
      const lg = S(defs, 'linearGradient', { id: 'dots-g-p9', x1: 0, x2: 1, y1: 0, y2: 0 });
      for (let k = 0; k <= 8; k++) S(lg, 'stop', { offset: k / 8, 'stop-color': PART(-1 + k / 4) });
      text(g, x, y + 17, '2020–24 shift (pts)', { size: 13, weight: 500, halo: 0 });
      S(g, 'rect', { x: bx, y: y + 6, width: bw, height: 6, fill: 'url(#dots-g-p9)' });
      [[0, 'Dem. −' + D.p24M.toFixed(0)], [0.5, '0'], [1, 'Rep. +' + D.p24M.toFixed(0)]].forEach(([u, s]) => text(g, bx + u * bw, y + 28, s, { size: 12, fill: T.muted, anchor: u === 0 ? 'start' : u === 1 ? 'end' : 'middle', halo: 0 }));
      return;
    }
    // v9.4: the key moved up, into the title area, clear of the source line: the title, then "toward Democrats", the color bar and "toward Republicans" on one row, the ticks under the bar
    const x = GEO.pad, y1 = headBottom('prior') + 17, lw = measure('toward Democrats', 13) + 8, rw = measure('toward Republicans', 13) + 8;
    const w = Math.max(90, Math.min(220, W - 2 * GEO.pad - lw - rw)), bx = x + lw, by = y1 + 10;
    const lg = S(defs, 'linearGradient', { id: 'dots-g-p9', x1: 0, x2: 1, y1: 0, y2: 0 });
    for (let k = 0; k <= 8; k++) S(lg, 'stop', { offset: k / 8, 'stop-color': PART(-1 + k / 4) });
    text(g, x, y1, '2020–24 shift (points)', { size: 13, weight: 500, halo: 0 });
    text(g, x, by + 9, 'toward Democrats', { size: 13, fill: T.muted, halo: 0 });
    S(g, 'rect', { x: bx, y: by, width: w, height: 10, fill: 'url(#dots-g-p9)', stroke: T.rule });
    text(g, bx + w + 8, by + 9, 'toward Republicans', { size: 13, fill: T.muted, halo: 0 });
    const M = D.p24M;
    [[0, '−' + M.toFixed(0)], [0.5, '0'], [1, '+' + M.toFixed(0)]].forEach(([u, s]) => {
      line(g, bx + u * w, by + 10, bx + u * w, by + 14, { stroke: T.muted });
      text(g, bx + u * w, by + 27, s, { size: 12, fill: T.muted, anchor: u === 0 ? 'start' : u === 1 ? 'end' : 'middle', halo: 0 });
    });
  }
  function aWhere(g) {
    // 2026-10-30: the key in the title area, as in aPrior9: one box per class of WHERE_CLASSES; a phone has room for the labels of the outer classes and the middle one
    if (tierShort()) {
      const K = GEO.whKey, y = K.y;
      WHERE_CLASSES.forEach((c, k) => S(g, 'rect', { x: K.x, y: y + k * 8, width: 12, height: 8, fill: c.col }));
      [[0, 'counts less'], [20, 'about equal'], [40, 'counts more']].forEach(([dy, lab]) => text(g, K.x + 18, y + dy + 4, lab, { size: 12, fill: T.muted, halo: 0 }));
      return;
    }
    if (phone) {                                                  // phones: a column at the map's right
      const K = GEO.whKey, step = Math.min(20, (H - Math.max(34, window.SLICE_BAND || 0) - 8 - K.y - 40) / 4);
      text(g, K.x, K.y + 12, 'counts less', { size: 13, fill: T.muted, halo: 0 });
      WHERE_CLASSES.forEach((c, k) => { const y = K.y + 32 + k * step; S(g, 'rect', { x: K.x, y: y - 9, width: 12, height: 12, fill: c.col }); text(g, K.x + 18, y + 1, c.lab, { size: 12, fill: T.muted, halo: 0 }); });
      text(g, K.x, K.y + 32 + 4 * step + 20, 'counts more', { size: 13, fill: T.muted, halo: 0 });
      return;
    }
    const x = GEO.pad, by = headBottom('where') + 8, lw = measure('counts less', 13) + 8, rw = measure('counts more', 13) + 8;
    const w = Math.max(90, Math.min(410, W - 2 * GEO.pad - lw - rw)), bx = x + lw, bw = w / WHERE_CLASSES.length, roomy = bw >= 76;
    text(g, x, by + 9, 'counts less', { size: 13, fill: T.muted, halo: 0 });
    WHERE_CLASSES.forEach((c, k) => {
      S(g, 'rect', { x: bx + k * bw, y: by, width: bw - 1, height: 10, fill: c.col });
      if (roomy) text(g, bx + (k + 0.5) * bw, by + 25, c.lab, { size: 12, fill: T.muted, anchor: 'middle', halo: 0 });
      else if (k % 2 === 0) text(g, k === 0 ? bx : k === 2 ? bx + w / 2 : bx + w, by + 25, c.lab, { size: 12, fill: T.muted, anchor: k === 0 ? 'start' : k === 2 ? 'middle' : 'end', halo: 0 });
    });
    text(g, bx + w + 8, by + 9, 'counts more', { size: 13, fill: T.muted, halo: 0 });
  }
  function aLimits(g, host) {
    const L = GEO.limits, x = L.x, w = small ? L.w : L.w - 10, hgt = small ? Math.min(L.h, 150) : Math.min(L.h, 420), y = L.y;
    S(g, 'rect', { x: x, y: y, width: w, height: hgt, fill: 'url(#dots-hatch)', stroke: T.rule, opacity: 0.95 });
    const ls = wrapLines('Not measured: nationwide effects, and effects shared within a state', w - 24, small ? 13 : 14, 500), h = ls.length * 19;
    S(g, 'rect', { x: x + 8, y: y + hgt / 2 - h / 2 - 8, width: w - 16, height: h + 16, fill: T.bg, opacity: 0.94 });
    ls.forEach((l, k) => text(g, x + 16, y + hgt / 2 - h / 2 + 14 + k * 19, l, { size: small ? 13 : 14, weight: 500, halo: 0 }));
    const m = MAP.M2;
    if (!small) arrow(late(g, host), m.ox + m.w + 6, y + hgt / 2, x - 6, y + hgt / 2, { stroke: T.muted, gap: 2 });
  }

  /* ---------- v7: local markets in Pennsylvania (price-problem-2, nearby-markets, assumption) ---------- */
  const paMkPts = (B, m) => m.js.map(j => [B.x[j], B.y[j]]);
  // A label at the first free candidate position (centre x, baseline y): clear of the dots in `pts` (radius r), of USED boxes and of the bounds.
  function placeLabel(g, cands, str, o) {
    const size = o.size || 12.5, wt = o.weight || 600, lw = measure(str, size, wt), hh = size + 2, pts = o.pts || [], r = o.r || 0;
    const cost = (cx, cy) => {
      const x0 = cx - lw / 2 - 2, x1 = cx + lw / 2 + 2, y0 = cy - size, y1 = cy + 3; let c = 0;
      if (x0 < GEO.pad - 2 || x1 > W - GEO.pad + 2 || y0 < 22 || y1 > H) c += 1000;
      pts.forEach(q => { const dx = Math.max(Math.abs(q[0] - cx) - lw / 2 - 2, 0), dy = Math.max(Math.abs(q[1] - (y0 + y1) / 2) - hh / 2, 0); if (dx * dx + dy * dy < r * r) c += 10; });
      USED.forEach(u => { if (x0 < u[2] && x1 > u[0] && y0 < u[3] && y1 > u[1]) c += 100; });
      return c;
    };
    let best = null; cands.forEach((cd, k) => { const c = cost(cd[0], cd[1]) + k * 0.5; if (!best || c < best.c) best = { c: c, x: cd[0], y: cd[1] }; });
    const x = clamp(best.x, GEO.pad + lw / 2, W - GEO.pad - lw / 2);
    USED.push([x - lw / 2 - 2, best.y - size, x + lw / 2 + 2, best.y + 3]);
    return text(g, x, best.y, str, { size: size, weight: wt, anchor: 'middle', halo: o.halo == null ? 3.5 : o.halo, plate: o.plate, fill: o.fill || T.ink });
  }
  // Soft outlines round the counties of each market with more than one county, in the color of its kind (single-county markets are their own dot).
  function mkHulls(g, B) {
    D.paMk.forEach(m => {
      if (m.js.length < 2) return;
      const k = KIND_OF[m.kind] || 'rural';
      S(g, 'path', { d: blob(paMkPts(B, m), B.r + (small ? 2 : 3)), fill: KIND[k + 'Fill'], 'fill-opacity': 0.22, stroke: KIND[k], 'stroke-opacity': 0.7, 'stroke-width': 1.1, 'stroke-linejoin': 'round' });
    });
  }
  // Key to the three kinds of market (top left, wrapping into rows). Returns the baseline of its last row.
  // v9.4: a key of dots and words, left aligned at the margin and wrapping at the right one. items: [{ fill | ring, lab }]. Row height size + 5.
  function dotKeyLayout(items, size, gap, wide) {
    const out = []; let x = GEO.pad, row = 0;
    const right = W - GEO.pad - (wide ? 0 : small ? 76 : 156);                               // the key stops short of the "Back to the overview" button on the title's row
    items.forEach(it => {
      const w = 14 + measure(it.lab, size), lines = w > right - GEO.pad ? wrapLines(it.lab, right - GEO.pad - 14, size) : [it.lab];
      if (lines.length > 1) { if (x > GEO.pad) { x = GEO.pad; row++; } out.push(Object.assign({}, it, { x: x, row: row, lines: lines })); row += lines.length - 1; x = right; return; }     // too long for one row: its own rows
      if (x + w > right && x > GEO.pad) { x = GEO.pad; row++; }
      out.push(Object.assign({}, it, { x: x, row: row, lines: lines })); x += w + gap;
    });
    return { items: out, rows: row + 1, rowH: size + 5 };
  }
  function dotKeyDraw(g, y0, L, size) {
    L.items.forEach(it => {
      const y = y0 + it.row * L.rowH;
      if (it.ring) S(g, 'circle', { cx: it.x + 5, cy: y - 4, r: 4.5, fill: 'none', stroke: T.ink, 'stroke-width': 1.2 });
      else S(g, 'circle', { cx: it.x + 5, cy: y - 4, r: 4.5, fill: it.fill, opacity: it.op == null ? 1 : it.op });
      it.lines.forEach((ln, k) => text(g, it.x + 14, y + k * L.rowH, ln, { size: size, halo: 0 }));
    });
  }
  // the key of simple-why: the three kinds of market and the ring, in the title area above the plot
  const whyKey = () => dotKeyLayout([{ fill: KIND.metro, lab: 'metropolitan' }, { fill: KIND.micro, lab: 'micropolitan' }, { fill: KIND.rural, lab: 'rural' }, { ring: true, lab: phone ? 'West Coast' : 'ringed: West Coast' }], 12, small ? 11 : 16, phone);   // phones: one row of key (the ring says the rest)
  const kindKeyRows = () => { let x = GEO.pad, r = 1; KIND_ITEMS().forEach(([k, lab]) => { const w = measure(lab, 13) + 18; if (x + w > W - GEO.pad && x > GEO.pad) { x = GEO.pad; r++; } x += w + 18; }); return r; };
  const KIND_ITEMS = () => small ? [['metro', 'metropolitan'], ['micro', 'micropolitan'], ['rural', 'rural']] : [['metro', 'metropolitan area: around a city of 50,000 or more'], ['micro', 'micropolitan area: around a town of 10,000 to 50,000'], ['rural', 'rural commuting zone']];
  function kindKey(g, y0) {
    const items = KIND_ITEMS();
    let x = GEO.pad, y = y0;
    items.forEach(([k, lab]) => {
      const w = measure(lab, 13) + 18; if (x + w > W - GEO.pad && x > GEO.pad) { x = GEO.pad; y += 19; }
      S(g, 'circle', { cx: x + 5.5, cy: y - 4.5, r: 5.5, fill: KIND[k] });
      text(g, x + 16, y, lab, { size: 13, halo: 0 }); x += w + 18;
    });
    return y;
  }
  // The group of four central metropolitan areas (PA_GROUP): a dashed outline round the four, curved arrows between neighbours along the group (over the top), the four
  // names (real geography, no prices) and, optionally, the label "compared only with each other". Returns the label box and the group's points.
  function groupMarks(g, gl, B, o) {
    const gm = D.paMk.filter(m => m.blk === PA_GROUP); if (!gm.length) return null;
    const cs = gm.map(m => { const p = paMkPts(B, m); return { m: m, x: d3.mean(p, q => q[0]), y: d3.mean(p, q => q[1]) }; }).sort((a, c) => a.x - c.x);
    const all = [].concat.apply([], gm.map(m => paMkPts(B, m))), rr = B.r * 1.08, col = o.col || T.ink;
    if (!o.noHull) S(gl, 'path', { d: blob(all, rr + (small ? 5 : 8)), fill: T.accentSoft, 'fill-opacity': 0.3, stroke: col, 'stroke-width': 1.2, 'stroke-dasharray': '4 3', 'stroke-linejoin': 'round' });
    // arrows: between neighbours along the group, on one side of it (the side of the normal n to the group's axis that points up); the names go on the other side
    const ax0 = cs[cs.length - 1].x - cs[0].x, ay0 = cs[cs.length - 1].y - cs[0].y, aL = Math.hypot(ax0, ay0) || 1;
    let nx = ay0 / aL, ny = -ax0 / aL; if (ny > 0) { nx = -nx; ny = -ny; }
    const lift = rr + (small ? 5 : 8), apex = [];
    for (let k = 0; k < cs.length - 1; k++) {
      const a = cs[k], c = cs[k + 1], x1 = a.x + nx * lift, y1 = a.y + ny * lift, x2 = c.x + nx * lift, y2 = c.y + ny * lift;
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, bend = ((-dy / L) * nx + (dx / L) * ny) > 0 ? 0.4 : -0.4;
      carrow(gl, x1, y1, x2, y2, { both: true, bend: bend, gap: 1, stroke: col, sw: o.sw || 1.3 });
      apex.push(curveAt(x1, y1, x2, y2, bend, 0.5));
      for (let u = 0.1; u < 1; u += 0.2) { const q = curveAt(x1, y1, x2, y2, bend, u); USED.push([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4]); }
    }
    // names: on the far side from the arrows where free, else beside
    const pts = cs.map(q => [q.x, q.y]);
    cs.forEach(c => {
      const nm = c.m.name || '', lw = measure(nm, 12.5, 600), dd = rr + 6, fx = c.x - nx * (dd + lw / 2 * Math.abs(nx)), fy = c.y - ny * (dd + 6) + 4;
      placeLabel(gl, [[fx, fy], [c.x + dd + lw / 2, c.y + 4], [c.x - dd - lw / 2, c.y + 4], [c.x, c.y + dd + 12], [c.x, c.y - dd - 2], [fx, fy + 16]], nm, { pts: pts, r: rr + 2 });
    });
    const mid = apex[Math.floor((apex.length - 1) / 2)] || [cs[0].x, cs[0].y - lift];
    return { cs: cs, lift: lift, rr: rr, n: [nx, ny], mid: mid };
  }

  // price-problem-2 (v7): Pennsylvania, first one flat rise, then simulated local rises (a smooth gradient across the state, and metropolitan counties a little above
  // the countryside). No names and no numbers; the labels name no direction and no part of the state.
  function aPrice2(g, host) {
    const B = GEO.paN, L = headLay('pp2'), y = L.yS, fs = L.fsS;
    S(g, 'path', { d: B.path, fill: 'none', stroke: T.rule, 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
    const gA = group(g), gB = group(g);
    // v7.2 [S2]: the two states of the figure are the heading's subtitle (was a bold lower-case caption)
    const tA = text(gA, GEO.pad, y, 'State prices: one rise for every county in the race', { size: fs, fill: T.muted, halo: 0, w: W - 2 * GEO.pad });
    text(gB, GEO.pad, y, 'Simulated local prices: each market has its own rise', { size: fs, fill: T.muted, halo: 0, w: W - 2 * GEO.pad });
    sub(host, gA, q => 1 - smooth(0.0, 0.4, q));
    sub(host, gB, q => smooth(0.45, 0.9, q));
    // v7.2 [4.4]: the metropolitan counties outlined (geography from markets.json, no names, no real prices), so that "cities and countryside differ" points at something visible
    D.pa.forEach((i, j) => { if (D.kind[i] === 0) S(gB, 'circle', { cx: B.x[j], cy: B.y[j], r: B.r + 2.2, fill: 'none', stroke: T.ink, 'stroke-width': 1.2, 'stroke-opacity': 0.75 }); });
    // legend (no numbers): the ramp of the simulated rises, from the smallest to the largest, and the one-item key to the outlines
    { const lw = small ? Math.min(200, W - 2 * GEO.pad - 130) : 260, ly = H - (small ? 56 : 50), lg = S(defs, 'linearGradient', { id: 'dots-g-loc', x1: 0, x2: 1, y1: 0, y2: 0 });
      const v0 = D.paBase + D.locDevLo, v1 = D.paBase + D.locDevHi;
      for (let k = 0; k <= 6; k++) S(lg, 'stop', { offset: k / 6, 'stop-color': regCss(lerp(v0, v1, k / 6)) });
      text(gB, GEO.pad, ly, small ? 'Price rise since 2024 (simulated)' : 'Price rise since the 2024 election (simulated)', { size: 13, weight: 500, halo: 0 });
      S(gB, 'rect', { x: GEO.pad, y: ly + 7, width: lw, height: 10, fill: 'url(#dots-g-loc)', stroke: T.rule, 'stroke-width': 1 });
      text(gB, GEO.pad, ly + 32, 'smaller', { size: 12, fill: T.muted, halo: 0 }); text(gB, GEO.pad + lw, ly + 32, 'larger', { size: 12, fill: T.muted, anchor: 'end', halo: 0 });
      const kx = GEO.pad + lw + (small ? 22 : 40), kr = small ? 5 : 6;
      S(gB, 'circle', { cx: kx + kr, cy: ly + 12, r: kr, fill: regCss(D.paBase), stroke: 'none' });
      S(gB, 'circle', { cx: kx + kr, cy: ly + 12, r: kr + 2.2, fill: 'none', stroke: T.ink, 'stroke-width': 1.2, 'stroke-opacity': 0.75 });
      text(gB, kx + 2 * kr + 8, ly + 16.5, 'metro counties', { size: 13, halo: 0 }); }
    // second stage: the two patterns, one label each. "rises differ across the state": a double arrow across the whole state, under the map.
    const gl = late(g, host), xL = d3.min(B.x) - B.r, xR = d3.max(B.x) + B.r, yBot = d3.max(B.y) + B.r;
    USED = [[GEO.pad, y - fs, GEO.pad + tA.w, y + tA.h - fs + 4]];
    { const ya = yBot + (small ? 14 : 22), msg = 'rises differ across the state', lw = measure(msg, 13, 600);
      arrow(gl, (xL + xR) / 2, ya, xL + 2, ya, { stroke: T.ink, gap: 0 }); arrow(gl, (xL + xR) / 2, ya, xR - 2, ya, { stroke: T.ink, gap: 0 });
      S(gl, 'rect', { x: (xL + xR) / 2 - lw / 2 - 6, y: ya - 9, width: lw + 12, height: 18, fill: T.bg });
      text(gl, (xL + xR) / 2, ya + 4.5, msg, { size: 13, weight: 600, anchor: 'middle', halo: 0 });
      USED.push([xL, ya - 10, xR, ya + 10]); }
    // "cities and countryside differ": a metropolitan county beside a countryside county with a clearly smaller rise, in the upper part of the map (the label goes
    // above the map); the label has an arrow to each (the metro county is outlined, v7.2)
    { let best = null; const yMid = d3.mean(B.y);
      let nn = 0; for (let j = 0; j < B.x.length; j++) { let m = 1e9; for (let l = 0; l < B.x.length; l++) if (l !== j) m = Math.min(m, Math.hypot(B.x[j] - B.x[l], B.y[j] - B.y[l])); nn += m / B.x.length; }
      D.pa.forEach((i, j) => {
        if (D.kind[i] !== 0 || B.y[j] > yMid) return;
        D.pa.forEach((i2, j2) => {
          if (D.kind[i2] === 0) return; const d = Math.hypot(B.x[j] - B.x[j2], B.y[j] - B.y[j2]); if (d > 1.45 * nn || B.y[j2] > yMid || Math.abs(B.y[j] - B.y[j2]) > 0.6 * nn) return;
          const c = D.locDev[i] - D.locDev[i2] - 0.05 * Math.abs((B.x[j] + B.x[j2]) / 2 - (xL + xR) / 2) / (xR - xL); if (!best || c > best.c) best = { c: c, a: [B.x[j], B.y[j]], b: [B.x[j2], B.y[j2]] };
        });
      });
      if (best) {
        const msg = 'cities and countryside differ', lw = measure(msg, 13, 600), mx = (best.a[0] + best.b[0]) / 2, yTop = d3.min(B.y) - B.r;
        const ly = Math.max(y + tA.h + 6, yTop - (small ? 22 : 40)), lx = clamp(mx, GEO.pad + lw / 2, W - GEO.pad - lw / 2);
        text(gl, lx, ly, msg, { size: 13, weight: 600, anchor: 'middle', halo: 3 });
        [best.a, best.b].forEach(q => { const sx = clamp(q[0], lx - lw / 2 + 6, lx + lw / 2 - 6); arrow(gl, sx, ly + 5, q[0], q[1], { stroke: T.ink, gap: B.r + 5 }); });
      }
    }
  }

  // nearby-markets: the dots take their market's kind (stage 1, with the key and the outlines of multi-county markets); then the central metropolitan group
  // comes forward (stage 2): its outline, arrows and names, the label "compared only with each other", and a smaller label at Philadelphia.
  function aNearby(g, host) {
    const B = GEO.paN;
    S(g, 'path', { d: B.path, fill: 'none', stroke: T.rule, 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
    const gh = group(g); mkHulls(gh, B);
    sub(host, gh, (q, p) => 1 - 0.7 * smooth(0.25, 0.45, p));
    const ky = kindKey(g, headBottom('nm') + (small ? 16 : 18));
    USED = [[0, 0, W, ky + 6]];
    const gl = late(g, host), gr = groupMarks(g, gl, B, { col: T.ink });
    if (!gr) return;
    const occ = occOf(F['nearby-markets'].e, 0.5, null, [[0, 0, W, ky + 8]]);
    note(gl, occ, [gr.mid[0] + gr.n[0] * 4, gr.mid[1] + gr.n[1] * 4], ['compared only with each other'], { w: small ? 130 : 220, dmin: 8, dmax: small ? 70 : 110, ang: Math.atan2(gr.n[1], gr.n[0]), gap: 2 });
    const ph = D.paMk.find(m => m.name === 'Philadelphia');
    if (ph) {
      const p = paMkPts(B, ph), c = [d3.mean(p, q => q[0]), d3.mean(p, q => q[1])];
      note(gl, occ, c, ['not compared with Philadelphia'], { size: 12.5, fill: T.muted, stroke: T.muted, w: small ? 130 : 220, dmin: B.r + 6, dmax: small ? 70 : 110, ang: Math.PI * 0.55, gap: B.r + 2 });
    }
  }
  // state-part: the v6 comparable-states picture, its legend fading in with the figure (the dots arrive from Pennsylvania during the build).
  function aStatePart(g, host) { furLegPad(g); aRegions(g, host); }
  // assumption (v7): the nearby-markets map again with the caption; the group's outline, arrows and names in the second stage.
  function aAssump7(g, host) {
    const B = GEO.paN;                                    // v7.2 [S2]: the caption is now the heading's subtitle
    S(g, 'path', { d: B.path, fill: 'none', stroke: T.rule, 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
    const gh = group(g); gh.style.opacity = 0.3; mkHulls(gh, B);
    USED = [[0, 0, W, headBottom('as') + 4]];
    groupMarks(g, late(g, host), B, { col: T.accent, sw: small ? 1.5 : 1.7 });
  }

  /* ---------- v8 dots: shared axes and annotations ---------- */
  function furLineup(g) {
    const A = GEO.v9.lineup, b = A.b, inner = group(g);
    line(inner, b.x0, b.y1, b.x1, b.y1, { stroke: T.muted });
    d3.ticks(0, A.xs.domain()[1], small ? 4 : 8).forEach(v => {
      const x = A.xs(v); if (x < b.x0 + 2 || x > b.x1 - 2) return;
      line(inner, x, b.y1, x, b.y1 + 4, { stroke: T.muted });
      text(inner, x, b.y1 + 17, Number(v.toFixed(1)) + '%', { size: 12, fill: T.muted, anchor: 'middle', halo: 0 });
    });
    text(inner, (b.x0 + b.x1) / 2, b.y1 + (small ? 38 : 42),
      small ? 'Extra fuel cost (% of monthly income)' : 'Extra fuel cost of the rise (% of monthly income)',
      { size: 13, fill: T.ink, anchor: 'middle', halo: 0 });
    if (A.beyond) {
      const dy = b.y1 - b.y0 + (small ? 58 : 68);
      const msg = A.beyond + (A.beyond === 1 ? ' county' : ' counties') + ' beyond the axis';
      A.outRect = [b.x0 + 7, b.y0 + dy - 14, b.x0 + 25 + measure(msg, 12), b.y0 + dy + 4];
      outNote(inner, A.beyond, b, dy);
    } else A.outRect = null;
    // v9.3: the y-axis of the mock vote shifts, with a faint fitted line; both come in as the dots rise in simple and hold through simple-why
    const yg = group(g);
    const yd = A.ys.domain(), yTicks = phone && (b.y1 - b.y0) * 5 / (yd[1] - yd[0]) < 17 ? 2 : small ? 4 : 6;      // a short phone plot: every 10 points, so that the labels keep their air
    d3.ticks(yd[0], yd[1], yTicks).forEach(v => {
      const y = A.ys(v); if (y < b.y0 - 1 || y > b.y1 + 1) return;
      line(yg, b.x0, y, b.x1, y, { stroke: v === 0 ? T.muted : T.rule, w: 1, op: v === 0 ? 0.8 : 0.7 });
      text(yg, b.x0 - 7, y + 4, (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v), { size: 12, fill: T.muted, anchor: 'end', halo: 0 });
    });
    if (phone) text(yg, tierShort() ? b.x1 : b.x0, b.y0 - 9, 'Vote shift (pts)', { size: 12, fill: T.muted, anchor: tierShort() ? 'end' : 'start', halo: 0 });
    else if (tierWide()) text(yg, targetSide() ? b.x1 : b.x0, b.y0 - 10, 'Vote shift (pts)', { size: 13, fill: T.muted, anchor: targetSide() ? 'end' : 'start', halo: 0 });
    else yAxisTitle(yg, small ? 'Vote shift vs president (pts)' : 'Vote shift against the president’s party (points)', b);
    let fl = null;
    if (A.fit) {
      const xa = A.xs.domain(), xl = xa[0] + 0.08 * (xa[1] - xa[0]), xr = xa[1] - 0.04 * (xa[1] - xa[0]);
      fl = line(yg, A.xs(xl), A.ys(A.fit.a + A.fit.b * xl), A.xs(xr), A.ys(A.fit.a + A.fit.b * xr), { stroke: T.ink, w: 2 }); fl.setAttribute('stroke-opacity', 0.75);
    }
    // v9.4: simple is the line-up only (the x-axis comes in as the dots set off); the y-axis comes in with the made-up vote shifts of simple-votes, the faint fitted line once the dots are up
    LIVE.lineup = (id, q, p) => { inner.style.opacity = id === 'simple' ? smooth(0.05, 0.25, p) : 1; yg.style.opacity = id === 'simple' ? 0 : id === 'simple-votes' ? smooth(0.05, 0.15, p) : 1; if (fl) fl.style.opacity = id === 'simple' ? 0 : id === 'simple-votes' ? smooth(0.42, 0.52, p) : 1; };
  }

  function furV8Axes(g, which) {
    const A = GEO.v8[which], b = A.b;
    const xName = {
      simple: 'Extra fuel cost of the 2026 rise (% of monthly income)',
      same: 'Extra fuel cost of the 2026 rise (% of monthly income), measured from the state’s average',
      pa: 'Cost of a $1 rise (% of monthly income)',
      fan: 'Cost of a $1 rise (% of monthly income), measured from the state’s average',
      slope: 'Unusual part of the extra fuel cost (% of monthly income)'
    }[which];
    const yName = {
      simple: 'Vote shift against the president’s party (points)',
      same: 'Vote shift against the president’s party (points), measured from the state’s average',
      pa: 'Shift toward the Republicans (points)',
      fan: 'Extra fuel cost (% of monthly income), measured from the state’s average',
      slope: 'Vote shift against the president’s party (points)'
    }[which];
    A.ys.ticks(small ? 4 : 6).forEach(v => {
      const y = A.ys(v); if (y < b.y0 || y > b.y1) return;
      line(g, b.x0, y, b.x1, y, { stroke: v === 0 ? T.muted : T.rule, op: v === 0 ? 0.8 : 0.6 });
      text(g, b.x0 - 7, y + 4, (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(Math.abs(v) < 1 ? 1 : 0), { size: 12, fill: T.muted, anchor: 'end', halo: 0 });
    });
    A.xs.ticks(small ? 4 : 6).forEach(v => {
      const x = A.xs(v); if (x < b.x0 || x > b.x1) return;
      line(g, x, b.y1, x, b.y1 + 4, { stroke: T.muted });
      text(g, x, b.y1 + 17, (v > 0 && which !== 'simple' && which !== 'pa' ? '+' : '') + Number(v.toFixed(1)), { size: 12, fill: T.muted, anchor: 'middle', halo: 0 });
    });
    line(g, b.x0, b.y1, b.x1, b.y1, { stroke: T.muted });
    text(g, b.x0, b.y0 - (small ? 26 : 17), yName, { size: small ? 12 : 13, fill: T.ink, halo: 0, w: b.x1 - b.x0 });
    text(g, (b.x0 + b.x1) / 2, b.y1 + (small ? 35 : 39), xName, { size: small ? 12 : 13, fill: T.ink, anchor: 'middle', halo: 0, w: b.x1 - b.x0 });
    const frame = which === 'simple' ? F['simple'].e : which === 'same' ? F['same-race'].e : which === 'pa' ? F['within-exposure'].e : which === 'fan' ? F['fan'].e : F['all-groups'].e;
    let beyond = 0; for (let i = 0; i < n; i++) if (frame.a[i] > 0 && frame.o[i]) beyond++;
    if (beyond) outNote(g, beyond, b, small ? 16 : 'br');     // phones: top left, the plot is too short for the bottom corner
  }
  function v8FitLine(g, A, fit, col, dash, opacity) {
    const xd = A.xs.domain(), b = A.b;
    const y0 = clamp(A.ys(fit.a + fit.b * xd[0]), b.y0 + 2, b.y1 - 2);
    const y1 = clamp(A.ys(fit.a + fit.b * xd[1]), b.y0 + 2, b.y1 - 2);
    return S(g, 'line', { x1: A.xs(xd[0]), y1: y0, x2: A.xs(xd[1]), y2: y1,
      stroke: col, 'stroke-width': dash ? 1.6 : 2.2, 'stroke-dasharray': dash || '', opacity: opacity == null ? 1 : opacity });
  }
  function aSimple8(g, host) {
    const A = GEO.v8.simple, gl = late(g, host);
    v8FitLine(gl, A, D.fit16, T.ink);
    const xx = A.xs.domain()[1] * 0.7, yy = D.fit16.a + D.fit16.b * xx;
    note(gl, occOf(F['simple'].e, 0.4), [A.xs(xx), A.ys(yy)], ['a slope where there can’t be an effect'],
      { w: small ? 150 : 230, dmin: 25, dmax: small ? 85 : 150, ang: -Math.PI * 0.5,
        bounds: { x0: A.b.x0 + 3, y0: A.b.y0 + 3, x1: A.b.x1 - 3, y1: A.b.y1 - 3 } });
  }
  function aSimpleWhy8(g, host) {
    const A = GEO.v8.simple, f = F['simple-why'].e, key = group(g);
    const items = [['metro', 'metropolitan'], ['micro', 'micropolitan'], ['rural', 'rural']];
    let x = small ? A.b.x1 - 99 : A.b.x1 - 312, y = A.b.y0 + 16;
    items.forEach(([k, lab]) => {
      S(key, 'circle', { cx: x + 5, cy: y - 4, r: 4.5, fill: KIND[k] });
      text(key, x + 13, y, lab, { size: 12, halo: 3 });
      if (small) y += 17; else x += k === 'micro' ? 111 : 103;
    });
    for (let i = 0; i < n; i++) if (f.a[i] > 0 && rows[i].padd === '5') ring(g, f.x[i], f.y[i], f.r[i] + 1.5, T.ink);
    const gl = late(g, host), occ = occOf(f, 0.4, null, [small ? [A.b.x1 - 105, A.b.y0, A.b.x1, A.b.y0 + 57] : [A.b.x1 - 318, A.b.y0, A.b.x1, A.b.y0 + 25], [A.b.x1 - 200, A.b.y1 - 26, A.b.x1, small ? A.b.y1 - 26 : A.b.y1]]), nbd = { x0: A.b.x0 + 3, y0: A.b.y0 + 3, x1: A.b.x1 - 3, y1: A.b.y1 - (small ? 3 : 26) }, rural = D.fit16Ids.filter(i => D.kind[i] === 2 && D.b26[i] > D.b26Hi * 0.72);
    const west = D.fit16Ids.filter(i => rows[i].padd === '5' && D.b26[i] > D.b26Lo);
    const resv = [small ? [A.b.x1 - 105, A.b.y0, A.b.x1, A.b.y0 + 57] : [A.b.x1 - 318, A.b.y0, A.b.x1, A.b.y0 + 25], [A.b.x1 - 200, A.b.y1 - 26, A.b.x1, small ? A.b.y1 - 26 : A.b.y1]];
    let rr = null, occ2 = occ;
    if (rural.length) rr = note(gl, occ, [d3.mean(rural, i => f.x[i]), d3.mean(rural, i => f.y[i])], ['mostly rural'], { w: small ? 105 : 150, dmin: 25, dmax: small ? 190 : 100, ang: small ? -Math.PI * 0.2 : Math.PI * 0.25, bounds: nbd });
    if (rr) occ2 = occOf(f, 0.4, null, resv.concat([[rr.x - 4, rr.y - 4, rr.x + rr.w + 4, rr.y + rr.h + 4]]));     // the second label keeps clear of the first
    if (west.length) note(gl, occ2, [d3.mean(west, i => f.x[i]), d3.mean(west, i => f.y[i])], ['the West Coast'], { w: small ? 105 : 150, dmin: 25, dmax: small ? 190 : 100, ang: small ? Math.PI * 0.85 : -Math.PI * 0.5, bounds: nbd });
  }
  function aSame8(g, host) { v8FitLine(late(g, host), GEO.v8.same, D.fit16Within, T.ink); }
  function aSteeper8(g, host) {
    const A = GEO.v8.same, b = A.b;
    v8FitLine(g, A, D.fit16Within, T.ink);
    const gl = late(g, host);
    v8FitLine(gl, A, { a: 0, b: D.fit16.b }, T.muted, '5 4', 0.75);
    const x = A.xs.domain()[1] * 0.53, y = D.fit16Within.a + D.fit16Within.b * x;
    note(gl, occOf(F['same-race'].e, 0.4), [A.xs(x), A.ys(y)], ['within races: steeper'],
      { w: small ? 130 : 195, dmin: 25, dmax: 110, bounds: { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 } });
  }
  function aExposure8(g, host) {
    const A = GEO.v8.pa, fit = D.paLines[0], gl = late(g, host), f = F['within-exposure'].e;
    v8FitLine(gl, A, fit, T.ink);
    text(gl, A.b.x1 + 5, clamp(A.ys(fit.a + fit.b * D.paEHi), A.b.y0 + 12, A.b.y1 - 8), '2016 President', { size: 12, w: W - A.b.x1 - 10, halo: 3 });
    const low = D.pa.filter(i => D.e[i] < quant(D.pa.map(j => D.e[j]), 0.23));
    const high = D.pa.filter(i => D.e[i] > quant(D.pa.map(j => D.e[j]), 0.77));
    const occ = occOf(f, 0.4), bd = { x0: A.b.x0, y0: A.b.y0, x1: A.b.x1 - 3, y1: A.b.y1 };
    note(gl, occ, [d3.mean(low, i => f.x[i]), d3.mean(low, i => f.y[i])], ['Philadelphia, Pittsburgh', 'and their suburbs'], { w: small ? 115 : 180, dmin: 20, dmax: 100, bounds: bd });
    note(gl, occ, [d3.mean(high, i => f.x[i]), d3.mean(high, i => f.y[i])], ['rural, lower-income'], { w: small ? 110 : 175, dmin: 20, dmax: 100, bounds: bd });
  }
  function aExposureLines8(g, host) {
    const A = GEO.v8.pa, xd = A.xs.domain(), labels = [], paths = [];
    D.paLines.forEach((L, j) => {
      const gg = group(g), x0 = A.xs(xd[0]), x1 = A.xs(xd[1]);
      const y0 = clamp(A.ys(L.a + L.b * xd[0]), A.b.y0 + 2, A.b.y1 - 2), y1 = clamp(A.ys(L.a + L.b * xd[1]), A.b.y0 + 2, A.b.y1 - 2);
      const path = S(gg, 'path', { d: 'M' + x0 + ',' + y0 + ' L' + x1 + ',' + y1, fill: 'none', stroke: j === 0 ? T.ink : T.muted, 'stroke-width': j === 0 ? 2 : 1.4 });
      const len = Math.hypot(x1 - x0, y1 - y0);
      path.setAttribute('stroke-dasharray', len + ' ' + len);
      paths.push({ path: path, len: len, j: j, group: gg });
      labels.push({ y: y1, target: y1, L: L, j: j });
    });
    // label collision: at least 18px between labels (a label may wrap to two lines), top-down then bottom-up inside the plot
    const GAP = small ? 15 : 18, yLo = A.b.y0 + 12, yHi = A.b.y1 - 12;
    labels.sort((a, b) => a.y - b.y);
    labels.forEach((L, k) => { L.y = Math.max(yLo, k ? Math.max(L.y, labels[k - 1].y + GAP) : L.y); });
    for (let k = labels.length - 1; k >= 0; k--) labels[k].y = Math.min(labels[k].y, k < labels.length - 1 ? labels[k + 1].y - GAP : yHi);
    labels.forEach(L => {
      const gg = paths[L.j].group;
      line(gg, A.b.x1 - 3, L.target, A.b.x1 + 4, L.y - 4, { stroke: T.muted });
      text(gg, A.b.x1 + 6, L.y, small ? String(L.L.label).replace('President', 'Pres.').replace('Senate', 'Sen.') : L.L.label, { size: 12, fill: L.j === 0 ? T.ink : T.muted, w: W - A.b.x1 - 10, halo: 0 });
    });
    LIVE.paLines8 = p => paths.forEach(P => {
      const a = 0.05 + P.j * 0.07, b = a + 0.07, u = P.j === 0 ? 1 : smooth(a, b, p);
      P.path.setAttribute('stroke-dashoffset', P.len * (1 - u));
      P.group.style.opacity = P.j === 0 ? 1 : smooth(a, b, p);
    });
  }
  function aWithinPrice8(g, host) {
    const B = GEO.paN, f = F['within-price'].e;
    if (B.path) S(g, 'path', { d: B.path, fill: 'none', stroke: T.muted, 'stroke-width': 1.2 });
    D.pa.forEach((i, j) => { if (D.kind[i] === 0) ring(g, B.x[j], B.y[j], f.r[i] + 2, T.ink); });
    const ww = small ? 150 : 250, x = GEO.pad, y = H - Math.max(small ? 34 : 46, window.SLICE_BAND || 0) - (small ? 57 : 63);
    gradLegend(g, 'dots-g-local8', x, y, ww, Array.from({ length: 7 }, (_, k) => [k / 6, regCss(D.paBase + lerp(D.locDevLo, D.locDevHi, k / 6))]),
      'Local price rise (illustrative)', [[0, 'smaller'], [1, 'larger']]);
    const gl = late(g, host), occ = occOf(f, 0.4, null, [[GEO.pad, y - 14, GEO.pad + ww + 4, H]]), xs = Array.from(B.x), ys = Array.from(B.y);
    note(gl, occ, [d3.mean(xs), d3.mean(ys)], ['rises differ across the state'], { w: small ? 145 : 205, dmin: 30, dmax: 110, ang: -Math.PI / 2 });
    const metro = D.pa.filter(i => D.kind[i] === 0);
    if (metro.length) note(gl, occ, [d3.mean(metro, i => f.x[i]), d3.mean(metro, i => f.y[i])], ['cities and countryside differ'], { w: small ? 145 : 205, dmin: 35, dmax: 120, ang: Math.PI * 0.45 });
  }
  function aNearby8(g, host) {
    const B = GEO.paN;
    if (B.path) S(g, 'path', { d: B.path, fill: 'none', stroke: T.muted, 'stroke-width': 1.2 });
    const gh = group(g); mkHulls(gh, B);
    d3.group(D.paMk, m => m.blk).forEach(markets => {
      if (markets.length < 2) return;
      const pts = markets.flatMap(m => paMkPts(B, m));
      S(gh, 'path', { d: blob(pts, B.r + 7), fill: 'none', stroke: T.rule, 'stroke-width': 1 });
    });
    sub(host, gh, (q, p) => 1 - 0.68 * smooth(0.25, 0.40, p));
    const ky = kindKey(g, headBottom('v8near') + 16);
    USED = [[0, 0, W, ky + 5]];
    const gl = late(g, host), gr = groupMarks(g, gl, B, { col: T.ink });
    if (!gr) return;
    const occ = occOf(F['nearby-groups'].e, 0.5, null, [[0, 0, W, ky + 6]]);
    note(gl, occ, gr.mid, ['compared only with each other'], { w: small ? 125 : 200, dmin: 8, dmax: 90, ang: -Math.PI / 2 });
    const ph = D.paMk.find(m => m.name === 'Philadelphia');
    if (ph) { const pts = paMkPts(B, ph);
      note(gl, occ, [d3.mean(pts, p => p[0]), d3.mean(pts, p => p[1])], ['not compared with Philadelphia'], { w: small ? 125 : 200, dmin: 16, dmax: 95, ang: Math.PI * 0.5 }); }
  }
  function aAssump8(g, host) {
    const B = GEO.paN;
    if (B.path) S(g, 'path', { d: B.path, fill: 'none', stroke: T.muted, 'stroke-width': 1.2 });
    const gh = group(g); gh.style.opacity = 0.27; mkHulls(gh, B);
    USED = [[0, 0, W, headBottom('v8as') + 5]];
    groupMarks(g, late(g, host), B, { col: T.accent, sw: small ? 1.3 : 1.6 });
  }
  // v9.4 nearby-groups and assumption: the markets are the dots of Pennsylvania's market layout (GEO.pa9.mk). Stage 1: the 16 metropolitan markets in their four groups, as soft hulls
  // of one style and color; stage 2: one group (PA_GROUP) comes forward, its markets named and joined by curved arrows, with a short arrow to Philadelphia's dot.
  function groupMarks2(gl, gm, o) {
    const cs = gm.slice().sort((a, c) => a.x - c.x), rr = d3.max(cs, c => c.r) + (small ? 3 : 4), col = o.col || T.ink;
    const ax0 = cs[cs.length - 1].x - cs[0].x, ay0 = cs[cs.length - 1].y - cs[0].y, aL = Math.hypot(ax0, ay0) || 1;
    let nx = ay0 / aL, ny = -ax0 / aL; if (ny > 0) { nx = -nx; ny = -ny; }
    const apex = [], lift = rr + (small ? 3 : 5);
    for (let k = 0; k < cs.length - 1; k++) {
      const a = cs[k], c = cs[k + 1], x1 = a.x + nx * lift, y1 = a.y + ny * lift, x2 = c.x + nx * lift, y2 = c.y + ny * lift;
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, bend = ((-dy / L) * nx + (dx / L) * ny) > 0 ? 0.4 : -0.4;
      carrow(gl, x1, y1, x2, y2, { both: true, bend: bend, gap: 1, stroke: col, sw: o.sw || 1.3 });
      apex.push(curveAt(x1, y1, x2, y2, bend, 0.5));
      for (let u = 0.1; u < 1; u += 0.2) { const q = curveAt(x1, y1, x2, y2, bend, u); USED.push([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4]); }
    }
    const pts = cs.map(q => [q.x, q.y]), leaders = phone ? group(gl) : gl, labels = phone ? group(gl) : gl;
    cs.forEach(c => {
      const nm = c.m.name || '', lw = measure(nm, 12.5, 600), dd = c.r + 6, fx = c.x - nx * (dd + lw / 2 * Math.abs(nx)), fy = c.y - ny * (dd + 6) + 4;
      if (small && H < 360) {
        // Two clear lanes beside the tiny map keep the four names distinct.
        const left = nm === 'Johnstown' || nm === 'Altoona', lower = nm === 'Johnstown' || nm === 'State College';
        const x = left ? d3.min(cs, q => q.x) - 40 : d3.max(cs, q => q.x) + 40;
        const y = d3.mean(cs, q => q.y) + (lower ? 16 : -6), sx = x + (left ? 4 : -4), sy = y - 4;
        const dx = c.x - sx, dy = c.y - sy, len = Math.hypot(dx, dy) || 1;
        line(leaders, sx, sy, c.x - dx / len * (c.r + 2), c.y - dy / len * (c.r + 2), { stroke: T.muted, w: 1 });
        text(labels, x, y, nm, { size: 12.5, weight: 600, anchor: left ? 'end' : 'start', halo: 3.5, plate: true });
        USED.push([left ? x - lw : x, y - 12.5, left ? x : x + lw, y + 3]);
        return;
      }
      const candidates = [[fx, fy], [c.x + dd + lw / 2, c.y + 4], [c.x - dd - lw / 2, c.y + 4], [c.x, c.y + dd + 12], [c.x, c.y - dd - 2], [fx, fy + 16]];
      placeLabel(labels, candidates, nm, { pts: pts, r: rr, plate: true });
    });
    return { cs: cs, rr: rr, n: [nx, ny], mid: apex[Math.floor((apex.length - 1) / 2)] || [cs[0].x, cs[0].y - lift] };
  }
  function metroHulls(g, fillOp, strokeOp) {
    const mk = GEO.pa9.mk || [];
    d3.group(mk.filter(e => e.m.kind === 0), e => e.m.blk).forEach(es => {
      S(g, 'path', { d: blob(es.map(e => [e.x, e.y]), d3.max(es, e => e.r) + (small ? 4 : 6)), fill: KIND.metroFill, 'fill-opacity': fillOp, stroke: KIND.metro, 'stroke-opacity': strokeOp, 'stroke-width': 1, 'stroke-linejoin': 'round' });
    });
  }
  function aNearbyGroups(g, host) {
    const B = GEO.pa9, mk = B.mk || [], gm = mk.filter(e => e.m.blk === PA_GROUP);
    if (!gm.length) return;
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0), keyBottom = Math.max(headBottom('pa44'), headBottom('paGrp')) + 20 + kindKeyRows() * 19 + 4;
    const hulls = sub(host, group(g), (q, p) => smooth(0.05, 0.3, p));
    metroHulls(hulls, 0.3, 0.55);
    const msg = 'Micropolitan and rural markets are grouped the same way.', ln = sub(host, group(g), (q, p) => smooth(0.05, 0.3, p));
    if (!phone) text(ln, GEO.pad, H - band - 12, msg, { size: small ? 12 : 13, fill: T.muted, halo: 0, w: W - 2 * GEO.pad });   // phones: the reader text says it
    const gl = sub(host, group(g), (q, p) => smooth(0.3, 0.38, p));
    S(gl, 'path', { d: blob(gm.map(e => [e.x, e.y]), d3.max(gm, e => e.r) + (small ? 5 : 8)), fill: T.accentSoft, 'fill-opacity': 0.6, stroke: T.accent, 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
    USED = [[0, 0, W, keyBottom]];
    if (restorePhone()) {
      const y = B.box.y + B.box.h + 24, w = (W - 2 * GEO.pad - 16) / 2, ph = mk.find(e => e.m.name === 'Philadelphia');
      const label = (x, str, target, col) => {
        const bw = Math.max(...str.split('\n').map(s => measure(s, 12, 500)));
        arrow(gl, clamp(target.x, x, x + bw), y - fz(12) - 6, target.x, target.y, { stroke: col, gap: target.r + 3 });
        text(gl, x, y, str, { size: 12, weight: 500, fill: col, halo: 0 });
      };
      label(GEO.pad, 'compared only with\neach other', gm.reduce((a, b) => a.y > b.y ? a : b), T.accent);
      if (ph) label(GEO.pad + w + 16, 'not compared with\nPhiladelphia', ph, T.ink);
      return;
    }
    if (phone) return;
    const gr = groupMarks2(gl, gm, { col: T.ink });
    const occ = occOf(F['nearby-groups'].e, 0.2, null, [[0, 0, W, keyBottom], [0, H - band - 28, W, H]]);
    const bounds = { x0: GEO.pad, y0: keyBottom, x1: W - GEO.pad, y1: H - band - 28 };
    note(gl, occ, gr.mid, ['compared only with each other'], { w: small ? 125 : 200, dmin: 8, dmax: 90, ang: -Math.PI / 2, bounds: bounds });
    const ph = mk.find(e => e.m.name === 'Philadelphia');
    if (ph) note(gl, occ, [ph.x, ph.y], ['not compared with Philadelphia'], { w: small ? 125 : 200, dmin: ph.r + 8, dmax: 100, ang: Math.PI * 0.5, bounds: bounds, gap: ph.r + 2 });
  }
  function aNearby9(g, host) {
    const B = GEO.pa9;
    if (B.path) S(g, 'path', { d: B.path, fill: 'none', stroke: T.muted, 'stroke-width': 1.2 });
    const gh = group(g); mkHulls(gh, B);
    d3.group(D.paMk, m => m.blk).forEach(markets => {
      if (markets.length < 2) return;
      const pts = markets.flatMap(m => paMkPts(B, m));
      S(gh, 'path', { d: blob(pts, B.r + 7), fill: 'none', stroke: T.rule, 'stroke-width': 1 });
    });
    sub(host, gh, (q, p) => 1 - 0.68 * smooth(0.25, 0.40, p));
    const ky = kindKey(g, headBottom('v8near') + 16);
    USED = [[0, 0, W, ky + 5]];
    const gl = late(g, host), gr = groupMarks(g, gl, B, { col: T.ink });
    if (!gr) return;
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0);
    const occ = occOf(F['nearby-groups'].e, 0.5, null, [[0, 0, W, ky + 6], [0, H - band - 8, W, H]]);
    const bounds = { x0: GEO.pad, y0: ky + 8, x1: W - GEO.pad, y1: H - band - 8 };
    note(gl, occ, gr.mid, ['compared only with each other'], { w: small ? 125 : 200, dmin: 8, dmax: 90, ang: -Math.PI / 2, bounds: bounds });
    const ph = D.paMk.find(m => m.name === 'Philadelphia');
    if (ph) { const pts = paMkPts(B, ph);
      note(gl, occ, [d3.mean(pts, p => p[0]), d3.mean(pts, p => p[1])], ['not compared with Philadelphia'], { w: small ? 125 : 200, dmin: 16, dmax: 95, ang: Math.PI * 0.5, bounds: bounds }); }
  }
  function aAssump9(g, host) {
    // as nearby-groups' second stage, in the accent color: the group of four metropolitan markets, named and joined by arrows (the caption is the heading's)
    const B = GEO.pa9, mk = B.mk || [], gm = mk.filter(e => e.m.blk === PA_GROUP);
    if (!gm.length) return;
    const hulls = group(g); hulls.style.opacity = 0.7; metroHulls(hulls, 0.3, 0.55);
    const gl = late(g, host);
    USED = [[0, 0, W, headBottom('paGrpAs') + 20 + kindKeyRows() * 19 + 4]];
    S(gl, 'path', { d: blob(gm.map(e => [e.x, e.y]), d3.max(gm, e => e.r) + (small ? 5 : 8)), fill: T.accentSoft, 'fill-opacity': 0.6, stroke: T.accent, 'stroke-width': 1.3, 'stroke-linejoin': 'round' });
    groupMarks2(gl, gm, { col: T.accent, sw: small ? 1.5 : 1.7 });
  }
  function aFan8(g, host) {
    const A = GEO.v8.fan, f = F['fan'].e, x = A.xs.domain()[1] * 0.55;
    note(late(g, host), occOf(f, 0.35), [A.xs(x), A.ys(D.fanFit.raw.a + D.fanFit.raw.b * x)],
      ['the more exposed, the heavier the extra fuel cost'], { w: small ? 145 : 220, dmin: 25, dmax: 110, ang: -Math.PI / 2 });
  }
  // Vertical extent (screen y) of the drawn, in-axis dots of the fan's "after" cloud between x0 and x1; null when empty.
  function fanCloud(x0, x1) {
    const f = F['fan-2'].e; let top = Infinity, bot = -Infinity;
    for (let i = 0; i < n; i++) if (f.a[i] > 0 && !f.o[i] && f.x[i] >= x0 && f.x[i] <= x1) { top = Math.min(top, f.y[i] - f.r[i]); bot = Math.max(bot, f.y[i] + f.r[i]); }
    return top === Infinity ? null : { top: top, bot: bot };
  }
  // fan-2 / fan-3 zero line, labeled in clear space: above the cloud at the left end, on a halo.
  function aFan2_8(g) {
    const A = GEO.v8.fan, b = A.b, y = A.ys(0), msg = 'the part that exposure alone predicts: set aside', fs = 12;
    line(g, b.x0, y, b.x1, y, { stroke: T.muted, w: 1.2 });
    const w = Math.min(small ? 150 : 250, b.x1 - b.x0 - 10), x = b.x0 + 8, lines = wrapLines(msg, w, fs, 400).length, lh = fs * 1.3;
    const c = fanCloud(x - 4, x + w + 4), top = c ? c.top : y - 10;
    const yb = Math.max(b.y0 + 14, Math.min(top - 8 - (lines - 1) * lh, y - 10 - (lines - 1) * lh));
    text(g, x, yb, msg, { size: fs, fill: T.muted, w: w, halo: 3 });
  }
  function aFan3_8(g, host) {
    aFan2_8(g);
    const A = GEO.v8.fan, b = A.b, x = b.x1 - (small ? 11 : 17), y = A.ys(0), span = Math.min((b.y1 - b.y0) * 0.29, 62, b.y1 - 28 - y);   // the bracket stays clear of the corner note
    const gl = late(g, host), fs = 12, lh = fs * 1.3, w = small ? 135 : 200, msg = 'the most exposed: as likely below zero as above';
    S(gl, 'path', { d: 'M' + (x - 7) + ',' + (y - span) + 'H' + x + 'V' + (y + span) + 'H' + (x - 7), fill: 'none', stroke: T.ink, 'stroke-width': 1.2 });
    // the label sits right-aligned under the cloud (above it when there is no room below), joined to the bracket by a thin leader
    const lines = wrapLines(msg, w, fs, 400).length, hgt = (lines - 1) * lh + fs, xr = x + 6, xl = xr - w;
    const c = fanCloud(xl - 4, xr + 4), floor = b.y1 - 24;
    let yb = Math.max(c ? c.bot : 0, y + span) + 18;
    if (yb + (lines - 1) * lh > floor) {
      yb = Math.min(c ? c.top : 1e9, y - span) - 12 - (lines - 1) * lh;
      line(gl, x - 3, y - span - 2, x - 3, yb + (lines - 1) * lh + 4, { stroke: T.ink, w: 1, op: 0.6 });
    } else line(gl, x - 3, y + span + 2, x - 3, yb - fs - 1, { stroke: T.ink, w: 1, op: 0.6 });
    text(gl, xr, yb, msg, { size: fs, anchor: 'end', w: w, halo: 3 });
  }
  function aAllGroups8(g, host) {
    const A = GEO.v8.slope, f = F['all-groups'].e, gl = late(g, host);
    v8FitLine(gl, A, D.v8Slope, T.accent);
    const x = A.xs.domain()[1] * 0.5;
    note(gl, occOf(f, 0.35), [A.xs(x), A.ys(D.v8Slope.a + D.v8Slope.b * x)],
      ['the slope: the number the analysis estimates'], { w: small ? 145 : 220, dmin: 25, dmax: 110, fill: T.accent, stroke: T.accent,
        bounds: { x0: A.b.x0 + 3, y0: A.b.y0 + 3, x1: A.b.x1 - 3, y1: A.b.y1 - 3 } });
  }
  function aStateLayer8(g, host) { aRegions(late(g, host), host); }
  // v9.4 state-regions: the regions come in one at a time (the dots and the legend, west to east); then the Midwest's states are outlined and joined by curved arrows
  function aStateRegions(g, host) {
    const f = phone ? F['adj-state'].e : F['state-regions'].e, m = phone ? MAP.MReg : MAP.M0, gl = sub(host, group(g), (q, p) => smooth(0.5, 0.6, p));
    regionMarks(gl, m, f, { borderOp: 0.28, outline: true });
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0);
    const occ = occOf(f, 0.4, null, phone ? [[GEO.regLeg.x - 4, GEO.regLeg.y - 2, W, H]] : [[0, H - band - (small ? 124 : 100), W, H]]);
    const pts = D.mwIds.map(i => [f.x[i], f.y[i]]), mx = d3.mean(pts, p => p[0]);
    const topP = pts.filter(p => Math.abs(p[0] - mx) < 40).sort((a, c) => a[1] - c[1])[0] || pts[0];
    note(gl, occ, [topP[0], topP[1] - 8], ['Midwest: compared only with each other'], { w: phone ? W - 2 * GEO.pad : small ? 200 : 260, dmin: phone ? 4 : 26, dmax: small ? 70 : 100, ang: -Math.PI / 2, curve: 0.25, gap: 4,
      bounds: { x0: GEO.pad, y0: Math.max(24, CUR_HB + 2), x1: W - GEO.pad, y1: topP[1] - 4 } });
  }

  /* ---------- v8 Round A: legends and annotations for the map beats ---------- */
  // v8 burden legend with the updated title
  function furLegB26v8(g, compact) {
    const LT = 'Extra fuel cost of the rise (% of monthly income)', w = small ? Math.min(240, W - 2 * GEO.pad) : 300;
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0);
    const y = small ? H - band - 5 - 27 - wrapLines(LT, W - 2 * GEO.pad, 13, 500).length * 16.9 : H - band - 92;
    const lo = D.b26Lo, hi = D.b26Hi, ticks = [0.5, 1, 1.5, 2, 2.5].filter(v => v >= lo - 0.01 && v <= hi + 0.01).map(v => [(v - lo) / (hi - lo), v.toFixed(1) + '%']);
    ticks[ticks.length - 1][1] += '+';
    if (tierTablet()) { phoneMapLegend(g, compact ? 'dots-g-b26p3' : 'dots-g-b26v8', 'Extra fuel cost', ticks, Math.max(46, window.SLICE_BAND || 0) + (compact ? 64 : 32)); return; }
    if (small) { phoneMapLegend(g, compact ? 'dots-g-b26p3' : 'dots-g-b26v8', 'Extra fuel cost', ticks, tierWide() && compact ? Math.max(34, window.SLICE_BAND || 0) + 64 : compact ? 67 : 30); return; }
    gradLegend(g, 'dots-g-b26v8', GEO.pad, y, w, seqStops(8), LT, ticks);
  }
  // v8 burden-map: two labels
  function aBurdenMap(g, host) {
    const f = F['burden-map'].e, occ = occOf(f, 0.3, null, legRects()), gl = late(g, host);
    const pts5 = []; for (let i = 0; i < n; i++) if (valid[i] && rows[i].padd === '5' && rows[i].st !== 'HI' && rows[i].st !== 'AK' && D.in44[i]) pts5.push([f.x[i], f.y[i]]);
    if (pts5.length) { const c = [d3.mean(pts5, p => p[0]), d3.mean(pts5, p => p[1])]; note(gl, occ, c, ['West Coast: the largest rise'], { w: small ? 140 : 200, dmin: 6, dmax: small ? 100 : 160, ang: small ? Math.PI * 0.5 : -Math.PI * 0.3, gap: 4 }); }
    const pts3 = []; for (let i = 0; i < n; i++) if (valid[i] && (rows[i].padd === '3' || rows[i].padd === '4') && D.in44[i]) pts3.push([f.x[i], f.y[i]]);
    if (pts3.length) { const c = [d3.mean(pts3, p => p[0]), d3.mean(pts3, p => p[1])]; note(gl, occ, c, ['long drives on modest incomes'], { w: small ? 150 : 210, dmin: 6, dmax: small ? 100 : 160, ang: Math.PI * 0.3, gap: 4 }); }
  }
  function aPriceLocal(g) {
    if (small) {
      const x = GEO.pad + 128, y = H - 28, w = W - GEO.pad - x;
      const lg = S(defs, 'linearGradient', { id: 'dots-g-price-local', x1: 0, x2: 1, y1: 0, y2: 0 });
      for (let k = 0; k <= 6; k++) S(lg, 'stop', { offset: k / 6, 'stop-color': regCss(D.paBase + lerp(D.locDevLo, D.locDevHi, k / 6)) });
      text(g, GEO.pad, y + 9, 'Price rise', { size: 12, weight: 500, halo: 0 });
      S(g, 'rect', { x: x, y: y, width: w, height: 8, fill: 'url(#dots-g-price-local)' });
      text(g, x, y + 25, 'smaller', { size: 12, fill: T.muted, halo: 0 });
      text(g, x + w, y + 25, 'larger', { size: 12, fill: T.muted, anchor: 'end', halo: 0 });
      return;
    }
    const ww = small ? 150 : 250, x = GEO.pad, band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0);
    const title = 'Price rise (illustrative)';
    const y = small ? H - band - 5 - 27 - wrapLines(title, W - 2 * GEO.pad, 13, 500).length * 16.9 : H - band - 63;
    gradLegend(g, 'dots-g-price-local', x, y, ww, Array.from({ length: 7 }, (_, k) => [k / 6, regCss(D.paBase + lerp(D.locDevLo, D.locDevHi, k / 6))]),
      title, [[0, 'smaller'], [1, 'larger']]);
  }
  function aExtraCost(g, host) {
    if (restorePhone()) {
      const f = F['extra-cost'].e, gl = late(g, host), west = [], south = [];
      for (let i = 0; i < n; i++) if (f.a[i] > 0 && valid[i]) {
        if (rows[i].st === 'CA') west.push(i);
        if (rows[i].st === 'MS' || rows[i].st === 'AL' || rows[i].st === 'TN' || rows[i].st === 'KY') south.push(i);
      }
      const target = ids => [d3.mean(ids, i => f.x[i]), d3.mean(ids, i => f.y[i])];
      phoneCallout(gl, GEO.pad + 4, H - 76, 'West Coast: the largest rise', 125, west.length ? target(west) : null);
      // the free corner above the Great Lakes: a plate lower down would erase the Southeast
      const lw = 104, lx = W - GEO.pad - lw; let top = 1e9;
      for (let i = 0; i < n; i++) if (f.a[i] > 0 && valid[i] && f.x[i] >= lx - 4) top = Math.min(top, f.y[i]);
      phoneCallout(gl, lx, Math.max(CUR_HB + 12, top - 26), 'long drives on modest incomes', lw, south.length ? target(south) : null);
      return;
    }
    if (small) return;
    const f = F['extra-cost'].e, occ = occOf(f, 0.3, null, legRects()), gl = late(g, host);
    const band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0), legTop = small ? H - band - 5 - 27 - wrapLines('Extra fuel cost of the rise (% of monthly income)', W - 2 * GEO.pad, 13, 500).length * 16.9 : H - band - 92;
    const bounds = { x0: GEO.pad, y0: headBottom('brnV8') + 4, x1: W - GEO.pad, y1: legTop - 6 };      // the labels stay above the color bar
    const pts5 = []; for (let i = 0; i < n; i++) if (valid[i] && rows[i].padd === '5' && rows[i].st !== 'HI' && rows[i].st !== 'AK' && D.in44[i]) pts5.push([f.x[i], f.y[i]]);
    if (pts5.length) { const c = [d3.mean(pts5, p => p[0]), d3.mean(pts5, p => p[1])]; note(gl, occ, c, ['West Coast: the largest rise'], { w: small ? 140 : 200, dmin: 6, dmax: small ? 100 : 160, ang: small ? Math.PI * 0.5 : -Math.PI * 0.3, gap: 4, bounds: bounds }); }
    const pts3 = []; for (let i = 0; i < n; i++) if (valid[i] && (rows[i].padd === '3' || rows[i].padd === '4') && D.in44[i]) pts3.push([f.x[i], f.y[i]]);
    if (pts3.length) { const c = [d3.mean(pts3, p => p[0]), d3.mean(pts3, p => p[1])]; note(gl, occ, c, ['long drives on modest incomes'], { w: small ? 150 : 210, dmin: 6, dmax: small ? 100 : 160, ang: Math.PI * 0.3, gap: 4, bounds: bounds }); }
  }
  function aVoteSwing(g) {
    const x = GEO.pad, y = headBottom('cov') + (small ? 16 : 18), lg = S(defs, 'linearGradient', { id: 'dots-g-cov-v9', x1: 0, x2: 1, y1: 0, y2: 0 });
    seqStops(6).forEach(s => S(lg, 'stop', { offset: s[0], 'stop-color': s[1] }));
    S(g, 'rect', { x: x, y: y - 10, width: 26, height: 11, rx: 2, fill: 'url(#dots-g-cov-v9)' });
    if (small) {
      const rl = measure('states with a race (44)', 13, 400);
      text(g, x + 34, y, 'states with a race (44)', { size: 13, halo: 0 });
      const gx = x + 34 + rl + 16;
      S(g, 'circle', { cx: gx, cy: y - 4, r: 4.5, fill: T.pale || '#C9CED3' });
      text(g, gx + 10, y, 'other states', { size: 13, fill: T.muted, halo: 0 });
    } else {
      text(g, x + 34, y, 'states with a Senate or governor\u2019s race in the analysis (44)', { size: 13, halo: 0 });
      S(g, 'circle', { cx: x + 13, cy: y + 15, r: 4.5, fill: T.pale || '#C9CED3' });
      text(g, x + 34, y + 20, 'other states', { size: 13, fill: T.muted, halo: 0 });
    }
  }
  function aMarkets(g, host) {
    const B = GEO.paPL || GEO.paN;
    if (!D.hasMkts || !B || !D.paMk) return;
    const hulls = group(g), spokes = group(g);
    D.paMk.forEach(mk => {
      if (!mk.js || mk.js.length < 2) return;
      const pts = mk.js.map(j => [B.x[j], B.y[j]]), cx = d3.mean(pts, p => p[0]), cy = d3.mean(pts, p => p[1]);
      S(hulls, 'path', { d: blob(pts, B.r + 3), fill: T.rule, 'fill-opacity': 0.35, stroke: T.muted, 'stroke-opacity': 0.7, 'stroke-width': 1, 'stroke-linejoin': 'round' });
      pts.forEach(p => line(spokes, p[0], p[1], cx, cy, { stroke: T.muted, w: 0.8, op: 0.55 }));
    });
    sub(host, hulls, (q, p) => smooth(0.05, 0.25, p));
    sub(host, spokes, (q, p) => smooth(0.05, 0.25, p));
    const gl = late(g, host), band = Math.max(small ? 34 : 46, window.SLICE_BAND || 0);
    const occ = occOf(F['markets'].e, 0.3), bounds = { x0: GEO.pad, y0: headBottom('mkts') + 4, x1: W - GEO.pad, y1: H - band - 2 };
    if (small) {
      const pit = D.paMk.find(m => m.name === 'Pittsburgh'), rural = D.paMk.find(m => m.kind === 2 && m.js.length === 1);
      if (pit) {
        const cx = d3.mean(pit.js, j => B.x[j]), cy = d3.mean(pit.js, j => B.y[j]);
        text(gl, GEO.pad, 46, 'Pittsburgh: 8 counties, one market', { size: 13, weight: 600, halo: 0 });
        arrow(gl, cx, 52, cx, cy, { gap: B.r + 4 });
      }
      if (rural) {
        const j = rural.js[0], y = B.box.y + B.box.h + 24;
        text(gl, GEO.pad, y, 'a rural market of one county', { size: 13, weight: 600, halo: 0 });
        arrow(gl, B.x[j], y - 16, B.x[j], B.y[j], { gap: B.r + 4 });
      }
      return;
    }
    const pit = D.paMk.find(m => m.name === 'Pittsburgh');
    if (pit && pit.js.length) { const pts = pit.js.map(j => [B.x[j], B.y[j]]), c = [d3.mean(pts, p => p[0]), d3.mean(pts, p => p[1])]; note(gl, occ, c, ['Pittsburgh: 8 counties, one market'], { w: small ? 200 : 210, dmin: 20, dmax: 100, ang: small ? -Math.PI * 0.5 : -Math.PI * 0.6, gap: 6, bounds: small ? { x0: GEO.pad, y0: bounds.y0, x1: W - GEO.pad, y1: B.oy - 2 } : bounds }); }
    const rural1 = D.paMk.find(m => m.kind === 2 && m.js.length === 1);
    if (rural1) { const j = rural1.js[0], p0 = [B.x[j], B.y[j]];
      const ruralLab = measure('a rural market of one county', 13, 400) <= W - 2 * GEO.pad - 40 ? 'a rural market of one county' : 'a rural market';
      note(gl, occ, p0, [ruralLab], { w: small ? 220 : 190, dmin: small ? 10 : 16, dmax: 80, ang: small ? Math.PI * 0.5 : Math.PI * 0.4, gap: 6, bounds: small ? { x0: GEO.pad, y0: B.oy + B.h + 2, x1: W - GEO.pad, y1: H - band - 2 } : bounds }); }
  }
  // v8 local-markets: PA hull, market outlines, labels
  function aLocalMarkets(g, host) {
    if (!D.hasMkts) return;
    const B = GEO.paN, gl = late(g, host);
    S(g, 'path', { d: B.path, fill: 'none', stroke: T.rule, 'stroke-width': 1.2, 'stroke-linejoin': 'round' });
    const gHulls = group(gl);
    D.paMk.forEach(mk => { if (mk.js.length < 2) return; const pts = mk.js.map(j => [B.x[j], B.y[j]]); S(gHulls, 'path', { d: blob(pts, B.r + 3), fill: 'none', stroke: T.rule, 'stroke-width': 0.8, 'stroke-linejoin': 'round', opacity: 0.7 }); });
    const pit = D.paMk.find(m => m.name === 'Pittsburgh');
    if (pit && pit.js.length) { const pts = pit.js.map(j => [B.x[j], B.y[j]]), c = [d3.mean(pts, p => p[0]), d3.mean(pts, p => p[1])]; note(gl, null, c, ['Pittsburgh: 8 counties, one market'], { w: small ? 140 : 210, dmin: 20, dmax: 100, ang: -Math.PI * 0.6, gap: 6 }); }
    const rural1 = D.paMk.find(m => m.kind === 2 && m.js.length === 1);
    if (rural1) { const j = rural1.js[0], p0 = [B.x[j], B.y[j]]; note(gl, null, p0, ['a rural market of one county'], { w: small ? 130 : 190, dmin: 16, dmax: 80, ang: Math.PI * 0.4, gap: 6 }); }
  }
  // v8 idea-tangle: ring the heaviest-fifth dots, two labels
  function aTangle(g, host) {
    const f = F['idea-tangle'].s, gl = late(g, host);
    if (!D.tangleRing || !D.tangleRing.length) return;
    const occ = occOf(f, 0.3);
    D.tangleRing.forEach(i => { ring(g, f.x[i], f.y[i], f.r[i] + 2, T.ink); });
    const south = D.tangleRing.filter(i => rows[i].padd === '3' || rows[i].padd === '4' || rows[i].padd === '2');
    if (south.length) { const c = [d3.mean(south, i => f.x[i]), d3.mean(south, i => f.y[i])]; note(gl, occ, c, ['mostly rural and lower-income'], { w: small ? 150 : 220, dmin: 10, dmax: small ? 90 : 140, ang: Math.PI * 0.3, gap: 4 }); }
    const wc = D.tangleRing.filter(i => rows[i].padd === '5');
    if (wc.length) { const c = [d3.mean(wc, i => f.x[i]), d3.mean(wc, i => f.y[i])]; note(gl, occ, c, ['the West Coast'], { w: small ? 120 : 180, dmin: 6, dmax: small ? 80 : 120, ang: -Math.PI * 0.4, gap: 4 }); }
  }
  // v8 idea-ideal: one label
  function aIdealV8(g, host) {
    const f = F['idea-ideal'].s, gl = late(g, host);
    const cx = W / 2, cy = H / 2;
    note(gl, occOf(f, 0.3), [cx, cy], ['no pattern that lines up with anything else'], { w: small ? 180 : 250, dmin: 30, dmax: small ? 80 : 120, ang: Math.PI * 0.5 });
  }

  // v9.3: the line-up carries no note of its own; the mock vote shifts, their y-axis and the fitted line are part of the line-up furniture (furLineup).
  function aSimple9(g, host) { late(g, host); }

  // The same county positions, now colored by real market geography.
  function aSimpleWhy9(g, host) {
    const A = GEO.v9.lineup, b = A.b, f = F['simple-why'].e, key = group(g), K = whyKey();
    dotKeyDraw(key, headBottom('lineup') + 17, K, 12);                     // v9.4: the key sits in the title area, above the plot, clear of every dot
    for (let i = 0; i < n; i++) if (f.a[i] > 0 && rows[i].padd === '5') { const rg = ring(g, f.x[i], f.y[i], f.r[i] + (small ? 0.9 : 1.5), T.ink); if (small) rg.setAttribute('stroke-width', 0.8); }
    const gl = late(g, host), rects = [];
    if (restorePhone()) {
      const pick = (kind, x) => {
        const ids = [];
        for (let i = 0; i < n; i++) if (f.a[i] > 0 && f.y[i] > b.y0 + 35 && f.y[i] < b.y1 - 8 && (kind === 'west' ? rows[i].padd === '5' : D.kind[i] === 2 && D.b26[i] > D.b26Hi * 0.72)) ids.push(i);
        return ids.length ? ids.reduce((a, i) => Math.hypot(f.x[i] - x, f.y[i] - b.y0 - 40) < Math.hypot(f.x[a] - x, f.y[a] - b.y0 - 40) ? i : a, ids[0]) : null;
      };
      const x = b.x0 + 42, xr = b.x1 - 104, r = pick('rural', x + 35), w = pick('west', xr + 45);
      phoneCallout(gl, x, b.y0 + 13, 'mostly rural', 95, r == null ? null : [f.x[r], f.y[r]]);
      phoneCallout(gl, xr, b.y0 + 13, 'the West Coast', 100, w == null ? null : [f.x[w], f.y[w]]);
      return;
    }
    if (phone) return;
    if (A.outRect) rects.push(A.outRect);
    const occ = occOf(f, 0.4, null, rects), bounds = { x0: b.x0 + 3, y0: b.y0 + 3, x1: b.x1 - 3, y1: b.y1 - 6 };
    const rural = [], west = [];
    for (let i = 0; i < n; i++) if (f.a[i] > 0) {
      if (D.kind[i] === 2 && D.b26[i] > D.b26Hi * 0.72) rural.push(i);
      if (rows[i].padd === '5' && D.b26[i] > D.b26Lo) west.push(i);
    }
    // each label points at a dot on the right-hand side of its cluster, where the scatter is thin: "mostly rural" at a rural dot in the upper part there (label above), "the West Coast"
    // at a ringed dot in the lower part (label below), so that the two arrows never meet
    const edge = (ids, up) => { const xs = ids.map(i => f.x[i]).sort(d3.ascending), x0 = d3.quantile(xs, 0.85), far0 = ids.filter(i => f.x[i] >= x0 && f.y[i] > b.y0 + 8 && f.y[i] < b.y1 - 8), far = far0.length ? far0 : ids; const yq = d3.quantile(far.map(i => f.y[i]).sort(d3.ascending), up ? 0.12 : 0.88); return far.reduce((a, i) => Math.abs(f.y[i] - yq) < Math.abs(f.y[a] - yq) ? i : a, far[0]); };
    if (rural.length) { const i = edge(rural, true);
      note(gl, occ, [f.x[i], f.y[i]], ['mostly rural'], { w: small ? 105 : 150, dmin: 12, dmax: small ? 90 : 90, ang: -Math.PI * 0.35, bounds: bounds, gap: f.r[i] + 2 }); }
    if (west.length) { const i = edge(west, false);
      note(gl, occ, [f.x[i], f.y[i]], ['the West Coast'], { w: small ? 105 : 150, dmin: 12, dmax: small ? 90 : 90, ang: Math.PI * 0.35, bounds: bounds, gap: f.r[i] + 2 }); }
  }

  /* ---------- v7: comparison and comparison-2 (simulated) ---------- */
  // Zoom of the vertical scale, 0 = comparison's narrow scale, 1 = comparison-2's wide one: it runs with the first stage of comparison-2 (the slide), with the same
  // ease as the dots (no stagger), so that ticks, average lines and dots move together. 0 in comparison and its hand-over, so t = 1 there equals p = 0 here.
  function cmpZoom(id, p) { if (id !== 'comparison-2') return 0; const k = F['comparison-2'] && F['comparison-2'].k; return k ? ease(clamp((p - k[0]) / (k[1] - k[0]), 0, 1)) : 1; }
  // The vertical scale shared by both beats: gridlines, the zero line "race average", the axis title and the key to the shading by exposure. The ticks of both scales are
  // drawn; each moves from its place on the narrow scale to its place on the wide one, the narrow scale's ticks fade out and the wide scale's fade in.
  function furCmpY(g) {
    const G = GEO.cmp; if (!G) return;
    const b = G.b, ys = G.ys, ysA = G.ysA, tA = ysA.ticks(small ? 5 : 7), tW = ys.ticks(small ? 5 : 7), tk = [], g0 = g;
    g = group(g0);                                       // v7.2 [4.5]: the axis comes in with the dots in comparison (p 0.1-0.2), after the map has faded
    Array.from(new Set(tA.concat(tW))).sort((u, v) => u - v).forEach(v => {
      const tg = group(g), inA = tA.indexOf(v) >= 0, inW = tW.indexOf(v) >= 0;
      const ln = line(tg, b.x0, 0, b.x1, 0, { stroke: v === 0 ? T.muted : T.rule, w: 1, op: v === 0 ? 0.9 : 0.6 });
      const lb = text(tg, b.x0 - 7, 0, (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v), { size: 12, fill: T.muted, anchor: 'end', halo: 0 });
      tk.push({ v: v, inA: inA, inW: inW, g: tg, ln: ln, lb: lb.el });
    });
    const ra = text(g, b.x1 + 6, 0, 'race\naverage', { size: 12.5, fill: T.muted, halo: 0, lh: 1.15 });
    LIVE.cmpY = (id, q, p) => {
      const z = cmpZoom(id, p); g.style.opacity = id === 'comparison' ? smooth(0.1, 0.2, p) : 1;
      tk.forEach(t => {
        const y = lerp(ysA(t.v), ys(t.v), z), out = Math.max(b.y0 - y, y - b.y1, 0);
        const o = ((t.inA ? 1 - z : 0) + (t.inW ? z : 0)) * (1 - smooth(0, 14, out));
        t.ln.setAttribute('y1', y); t.ln.setAttribute('y2', y); t.lb.setAttribute('y', y + 4); t.lb.querySelectorAll('tspan').forEach(ts => ts.setAttribute('y', y + 4));
        t.g.style.opacity = o; t.g.style.display = o < 0.004 ? 'none' : '';
      });
      const y0 = lerp(ysA(0), ys(0), z) - 3; ra.el.setAttribute('y', y0); ra.el.querySelectorAll('tspan').forEach((ts, k) => { if (!k) ts.setAttribute('y', y0); });
    };
    LIVE.cmpY('comparison', 0, 0);
    yAxisTitle(g, small ? 'Vote shift vs president (pts)' : 'Vote shift against the president’s party (points)', b);
    // key: the shading by exposure
    const ky = H - (small ? 6 : 8), lab = 'Shade: exposure', x0 = GEO.pad;
    text(g, x0, ky, lab, { size: 12.5, fill: T.muted, halo: 0 });
    let x = x0 + measure(lab, 12.5) + 12; text(g, x, ky, 'less', { size: 12.5, fill: T.muted, halo: 0 }); x += measure('less', 12.5) + 10;
    [0.1, 0.3, 0.5, 0.7, 0.9].forEach(u => { S(g, 'circle', { cx: x + 5, cy: ky - 4.5, r: 5, fill: seqCss(u) }); x += 13; });
    text(g, x + 4, ky, 'more', { size: 12.5, fill: T.muted, halo: 0 });
  }
  // The four columns of comparison: names, price-rise tags, faint separators and each market's average (a short black line). They leave as comparison-2 begins.
  function furCmpCols(g) {
    const G = GEO.cmp, K = D.cmp; if (!G || !K) return;
    const b = G.b, inner = group(g), gm = group(inner), mls = [], fsH = small ? 13 : 15, fsT = small ? 12 : 13, yH = b.y0 - (small ? 50 : 62), yT = yH + (small ? 16 : 20);
    for (let k = 1; k < 4; k++) line(inner, b.x0 + k * G.cw, b.y0 - 6, b.x0 + k * G.cw, b.y1, { stroke: T.rule, op: 0.7 });
    CMP_RISE.forEach((r, m) => {
      const cx = G.colX(m), hot = m === 1, col = hot ? T.accent : T.muted;
      text(inner, cx, yH, 'Market ' + (m + 1), { size: fsH, weight: 600, anchor: 'middle', halo: 0 });
      text(inner, cx, yT, '+$' + r.toFixed(2), { size: fsT, weight: hot ? 600 : 400, fill: col, anchor: 'middle', halo: 0 });
      if (hot) balancedLines('unusually large', G.cw + 6, fsT, 600).forEach((l, j) => text(inner, cx, yT + (j + 1) * (fsT + 3), l, { size: fsT, weight: 600, fill: col, anchor: 'middle', halo: 0 }));
      mls.push(line(gm, cx - G.cw * 0.3, G.ysA(K.means[m]), cx + G.cw * 0.3, G.ysA(K.means[m]), { stroke: T.ink, w: 2.4 }));
    });
    LIVE.cmpCols = (id, q, p) => {
      const z = cmpZoom(id, p); mls.forEach((l, m) => { const y = lerp(G.ysA(K.means[m]), G.ys(K.means[m]), z); l.setAttribute('y1', y); l.setAttribute('y2', y); });
      inner.style.opacity = id === 'comparison-2' ? 1 - smooth(0.05, 0.15, p) : id === 'comparison' ? smooth(0.1, 0.2, p) : 1;
      gm.style.opacity = id === 'comparison' ? smooth(0.2, 0.27, p) : 1;
    };
  }
  // comparison, second stage: a bracket from the race average up to Market 2's average, "if prices matter: further against the president's party".
  function aCmp(g, host) {
    const G = GEO.cmp, K = D.cmp; if (!G || !K) return;
    const gl = late(g, host), x = G.colX(1) + G.cw * (small ? 0.4 : 0.36), y0 = G.ysA(0), y1 = G.ysA(K.means[1]);
    S(gl, 'path', { d: 'M' + (x - 5) + ',' + y0 + ' L' + x + ',' + y0 + ' L' + x + ',' + y1 + ' L' + (x - 5) + ',' + y1, fill: 'none', stroke: T.accent, 'stroke-width': 1.5 });
    const rim = []; K.dots.forEach(d => { const fx = F['comparison'].e.x[d.i], fy = F['comparison'].e.y[d.i]; for (let a = 0; a < 8; a++) rim.push([fx + Math.cos(a * Math.PI / 4) * (G.rD + 2), fy + Math.sin(a * Math.PI / 4) * (G.rD + 2)]); });
    const occ = occOf(F['comparison'].e, 0.3, rim, [[G.colX(1) - G.cw * 0.3 - 4, y1 - 6, x + 8, y1 + 6], [x - 8, y1, x + 8, y0], [G.b.x0, y0 - 8, G.b.x1, y0 + 8]].concat([0, 2, 3].map(m => [G.colX(m) - G.cw * 0.3 - 4, G.ysA(K.means[m]) - 6, G.colX(m) + G.cw * 0.3 + 4, G.ysA(K.means[m]) + 6])));
    note(gl, occ, [x + 3, (y0 + y1) / 2], ['if prices matter: further against the president’s party'], { fill: T.accent, stroke: T.accent, w: small ? 120 : 190, dmin: 6, dmax: small ? 170 : 160, gap: 3, ang: -Math.PI / 4, bounds: { x0: G.b.x0 + 4, y0: G.b.y0 + 2, x1: G.b.x1, y1: G.b.y1 - 4 } });
  }
  // comparison-2: the horizontal axis comes in with the slide (stage 1); the fitted line and its label are the second stage.
  function aCmp2(g, host) {
    const G = GEO.cmp, K = D.cmp; if (!G || !K) return;
    const b = G.b, xs = G.xs, ys = G.ys, xm = K.xMax;
    line(g, xs(0), b.y0, xs(0), b.y1, { stroke: T.rule, w: 1 });
    line(g, b.x0, b.y1, b.x1, b.y1, { stroke: T.muted, op: 0.8 });
    const st = xm > 0.35 ? 0.2 : 0.1;
    for (let v = -Math.floor(xm / st + 1e-6) * st; v <= xm + 1e-6; v += st) {
      const vv = Math.round(v * 100) / 100, x = xs(vv);
      line(g, x, b.y1, x, b.y1 + 4, { stroke: T.muted });
      text(g, x, b.y1 + 17, vv === 0 ? '0' : (vv > 0 ? '+' : '−') + Math.abs(vv).toFixed(1) + '%', { size: 12, fill: T.muted, anchor: 'middle', halo: 0 });
    }
    text(g, (b.x0 + b.x1) / 2, b.y1 + (small ? 34 : 38), 'unusual part of the extra fuel cost (% of monthly income)', { size: 13, anchor: 'middle', halo: 0, w: b.x1 - b.x0 });
    const gl = late(g, host), f = K.fit, xa = -xm, xb = xm;
    const ya = clamp(ys(f.a + f.b * xa), b.y0, b.y1), yb = clamp(ys(f.a + f.b * xb), b.y0, b.y1);
    S(gl, 'line', { x1: xs(xa), y1: ya, x2: xs(xb), y2: yb, stroke: T.accent, 'stroke-width': 2.6, 'stroke-linecap': 'round' });
    // v7.2 [4.6]: the line itself blocks the label (points along it, and a band either side), so the label never sits on it; the arrow keeps a real length
    const lp = []; { const L = Math.hypot(xs(xb) - xs(xa), yb - ya), m = Math.ceil(L / 4); for (let k = 0; k <= m; k++) { const x = lerp(xs(xa), xs(xb), k / m), y = lerp(ya, yb, k / m); for (let d = -10; d <= 10; d += 5) lp.push([x, y + d]); } }
    const occ = occOf(F['comparison-2'].e, 0.3, lp), u = 0.8, tg = [xs(lerp(xa, xb, u)), ys(f.a + f.b * lerp(xa, xb, u))];
    note(gl, occ, tg, ['the slope: the number the analysis estimates'], { fill: T.accent, stroke: T.accent, w: small ? 150 : 230, dmin: small ? 22 : 30, dmax: small ? 120 : 170, gap: 4, ang: Math.PI * 0.5, bounds: { x0: b.x0 + 4, y0: b.y0, x1: b.x1, y1: b.y1 - 4 } });
  }

  /* ---------- layout rebuild ---------- */
  function rebuild() {
    if (!el) return;
    RMF = null;
    dpr = Math.min(W < 520 ? 3 : 2, window.devicePixelRatio || 1);   // phones: fine dots at the screen's own resolution
    H = HF - SRCH;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(HF * dpr);
    readTokens(); buildColors();
    if (T.dotHalftone) { halfCols = Math.ceil(W / 7); halfCells = new Uint8Array(halfCols * Math.ceil(HF / 7)); }
    rBase = W < 520 ? 0.82 : clamp(1.5 * Math.sqrt(W * H / (700 * 560)), 1.0, 2.6);
    geo(); buildFrames(); buildOverlay();
    lastKey = '';
  }

  /* ---------- drawing ---------- */
  const colCache = new Map();
  function colStr(r, g, b, a) {
    const qa = Math.max(0, Math.min(31, Math.round(a * 31)));
    const key = ((r >> 2) << 17) | ((g >> 2) << 11) | ((b >> 2) << 5) | qa;
    let s = colCache.get(key); if (!s) { s = 'rgba(' + (r & 252) + ',' + (g & 252) + ',' + (b & 252) + ',' + (qa / 31).toFixed(2) + ')'; colCache.set(key, s); if (colCache.size > 20000) colCache.clear(); }
    return s;
  }
  let halfCols = 0, halfCells = null;
  // Two inks: dotStroke > 0 means outlined dots (1-1.25px stroke in the dot's color, fill at ~20% of it).
  // dotFillAlpha controls the fill opacity relative to the stroke (default 0.20 per DESIGN.md).
  const DOT_FILL_A = 0.20;
  function drawFrame(f, op, keep) {
    const sb = (typeof window.SLICE_BAND === 'number' ? window.SLICE_BAND : 0) * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, sb); if (!keep) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, HF); ctx.setTransform(dpr, 0, 0, dpr, 0, sb); }
    ctx.globalAlpha = op * T.dotAlpha;
    const outlined = !small && T.dotStroke > 0;
    if (halfCells && !keep) halfCells.fill(0);
    for (let pass = 0; pass < 2; pass++) {
      let lastF = '', lastS = '';
      for (let i = 0; i < n; i++) {
        if (f.z[i] !== pass) continue;
        const a = f.a[i]; if (a < 0.03) continue;
        const cr = f.cr[i] | 0, cg = f.cg[i] | 0, cb = f.cb[i] | 0;
        const s = colStr(cr, cg, cb, a);
        let x = f.x[i], y = f.y[i], r = f.r[i] * (small ? 1 : T.dotScale);
        if (halfCells) {
          const cx = Math.floor(x / 7), cy = Math.floor(y / 7), cell = cy * halfCols + cx;
          if (cx < 0 || cx >= halfCols || cy < 0 || cell >= halfCells.length || halfCells[cell]) continue;
          halfCells[cell] = 1; x = cx * 7 + 3.5; y = cy * 7 + 3.5;
          r = Math.min(3, Math.max(0.5, Math.round(r * 2) / 2));
        }
        if (f.o[i]) { ctx.strokeStyle = s; ctx.lineWidth = T.dotStroke || 1; ctx.beginPath(); ctx.arc(x, y, halfCells ? r : Math.max(1.6, f.r[i] * 0.9) * T.dotScale, 0, 6.2832); ctx.stroke(); continue; }
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832);
        if (outlined) {
          // fill at reduced alpha, stroke at full alpha
          const sf = colStr(cr, cg, cb, a * DOT_FILL_A);
          if (sf !== lastF) { ctx.fillStyle = sf; lastF = sf; }
          ctx.fill();
          if (s !== lastS) { ctx.strokeStyle = s; lastS = s; }
          ctx.lineWidth = T.dotStroke;
          ctx.stroke();
        } else {
          if (s !== lastF) { ctx.fillStyle = s; lastF = s; }
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // v9.3 (state-map): per-dot progress by supply region; set by render() for that beat, null otherwise
  let REGW = null, REGW_A = null, REG_RANK = null;
  function regionProgress(q) {
    if (!REGW_A) { REGW_A = new Float32Array(n); REG_RANK = new Int8Array(n); for (let i = 0; i < n; i++) REG_RANK[i] = Math.max(0, REGION_ORDER.indexOf(rows[i].padd)); }
    for (let i = 0; i < n; i++) REGW_A[i] = regionAt(REG_RANK[i], q);
    return REGW_A;
  }
  // A to B by u (or, with a stagger st > 0, each dot by its own share of q), then toward the next beat's start frame Cn by t (staggered).
  function blend(A, B, u, Cn, t, st, q) {
    const o = out;
    for (let i = 0; i < n; i++) {
      let x = A.x[i], y = A.y[i], r = A.r[i], cr = A.cr[i], cg = A.cg[i], cb = A.cb[i], a = A.a[i], z = A.z[i], ob = A.o[i];
      const ui = REGW ? REGW[i] : st > 0 && A !== B ? ease(clamp((q - st * dly[i]) / (1 - st), 0, 1)) : u;
      if (ui > 0) { x += (B.x[i] - x) * ui; y += (B.y[i] - y) * ui; r += (B.r[i] - r) * ui; cr += (B.cr[i] - cr) * ui; cg += (B.cg[i] - cg) * ui; cb += (B.cb[i] - cb) * ui; a += (B.a[i] - a) * ui; if (ui > 0.5) { z = B.z[i]; ob = B.o[i]; } }
      if (Cn) {
        const v = ease(clamp((t - dly[i] * 0.25) / 0.75, 0, 1));
        x += (Cn.x[i] - x) * v; y += (Cn.y[i] - y) * v; r += (Cn.r[i] - r) * v; cr += (Cn.cr[i] - cr) * v; cg += (Cn.cg[i] - cg) * v; cb += (Cn.cb[i] - cb) * v; a += (Cn.a[i] - a) * v;
        if (v > 0.5) { z = Cn.z[i]; ob = Cn.o[i]; }
      }
      o.x[i] = x; o.y[i] = y; o.r[i] = r; o.cr[i] = cr; o.cg[i] = cg; o.cb[i] = cb; o.a[i] = a; o.z[i] = z; o.o[i] = ob;
    }
    return o;
  }

  // v7.2 [S8]: reduced motion (the shell's flag, else the media query) and the cross-fade of travelling dots between two frames P and Q at weight v.
  function rmOn() { const E = window.ENGINE; if (E && typeof E.reducedMotion === 'boolean') return E.reducedMotion; return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  let RMF = null;
  function cpf2(f) { if (!RMF) RMF = { a: nf(), b: nf(), c: nf() }; Object.keys(f).forEach(k => RMF.c[k].set(f[k])); return RMF.c; }
  function rmMix(P, Q, v, stag, raw, perDot) {
    if (!RMF) RMF = { a: nf(), b: nf(), c: nf() };
    const a = RMF.a, b = RMF.b;
    for (let i = 0; i < n; i++) {
      const vi = perDot ? perDot[i] : stag > 0 ? ease(clamp((raw - stag * dly[i]) / (1 - stag), 0, 1)) : v;
      const moves = Math.abs(Q.x[i] - P.x[i]) + Math.abs(Q.y[i] - P.y[i]) > 1.5;
      if (moves) {
        a.x[i] = P.x[i]; a.y[i] = P.y[i]; a.r[i] = P.r[i]; a.cr[i] = P.cr[i]; a.cg[i] = P.cg[i]; a.cb[i] = P.cb[i]; a.a[i] = P.a[i] * (1 - vi); a.z[i] = P.z[i]; a.o[i] = P.o[i];
        b.x[i] = Q.x[i]; b.y[i] = Q.y[i]; b.r[i] = Q.r[i]; b.cr[i] = Q.cr[i]; b.cg[i] = Q.cg[i]; b.cb[i] = Q.cb[i]; b.a[i] = Q.a[i] * vi; b.z[i] = Q.z[i]; b.o[i] = Q.o[i];
      } else {
        a.x[i] = lerp(P.x[i], Q.x[i], vi); a.y[i] = lerp(P.y[i], Q.y[i], vi); a.r[i] = lerp(P.r[i], Q.r[i], vi); a.cr[i] = lerp(P.cr[i], Q.cr[i], vi); a.cg[i] = lerp(P.cg[i], Q.cg[i], vi); a.cb[i] = lerp(P.cb[i], Q.cb[i], vi);
        a.a[i] = lerp(P.a[i], Q.a[i], vi); a.z[i] = vi > 0.5 ? Q.z[i] : P.z[i]; a.o[i] = vi > 0.5 ? Q.o[i] : P.o[i]; b.a[i] = 0;
      }
    }
  }

  // Inner progress of a beat's build, 0..1, over the range of p given here (default 0.05..0.45), then held.
  // simplest-axes moves the map into the scatter over most of the beat (v4: only the 30% hand-over); races builds the strips and then holds them still;
  // races-cost equalises slowly, once its text is on screen; price-problem-2 holds the flat state first; the gaps build after their text names them.
  // v6: where a beat has arrows or labels, the figure builds over p = 0.05..0.25 and they come in over 0.25..0.45 (late()).
  const QRANGE = { 'dots-intro': [0.05, 0.25], 'dots-example': [0.04, 0.20], 'burden-map': [0.05, 0.25], 'local-markets': [0.05, 0.25],
    'exposure': [0.05, 0.25], 'price-local': [0.05, 0.25], 'markets': [0.05, 0.25], 'extra-cost': [0.05, 0.25], 'vote-swing': [0.05, 0.25],
    'races': [0.05, 0.25], 'idea-tangle': [0.05, 0.25], 'idea-ideal': [0.05, 0.30], 'price-problem-2': [0.1, 0.25], 'assumption': [0.05, 0.25], 'state-part': [0.04, 0.24], 'comparison': [0.05, 0.25], 'adj-oil': [0.05, 0.25], 'adj-prior': [0.05, 0.25], 'simplest-axes': [0.03, 0.46], 'races': [0.03, 0.38], 'races-cost': [0.1, 0.5], 'exposure-problem': [0.06, 0.46], 'gaps-same': [0.05, 0.25], 'gaps-bigger': [0.05, 0.25],
    'simple': [0.05, 0.40], 'simple-why': [0.05, 0.25], 'ideal': [0.04, 0.30], 'same-race': [0.05, 0.25], 'same-race-2': [0.05, 0.25],
    'within-exposure': [0.05, 0.35], 'within-exposure-2': [0.05, 0.25], 'within-price': [0.05, 0.25], 'nearby-groups': [0.05, 0.25],
    'fan': [0.05, 0.25], 'fan-2': [0.30, 0.42], 'all-groups': [0.05, 0.40], 'state-layer-3': [0.05, 0.25], 'state-map': [0.05, 0.25],
    'simplest-slope': [0.05, 0.25], 'adj-passthrough': [0.05, 0.25], 'adj-lagged': [0.05, 0.25], 'what-is-left': [0.30, 0.42], 'two-slices': [0.03, 0.17] };
  const STAG = { 'simplest-axes': 0.35, 'races': 0.25, 'same-race': 0.25, 'same-race-2': 0, 'exposure-problem': 0.2, 'two-slices': 0.3, 'state-part': 0.3, 'comparison': 0.3, 'simple': 0.3, 'ideal': 0.6 };           // per-dot stagger of the build
  const ANN_IN = { 'simplest-axes': [0.4, 0.52], 'races': [0.32, 0.45], 'exposure-problem': [0.4, 0.52], 'state-part': [0.14, 0.26], 'price-problem-2': [0.02, 0.08],
    'simple': [0.40, 0.47], 'simple-why': [0.05, 0.25], 'ideal': [0.30, 0.37], 'same-race': [0.32, 0.45], 'same-race-2': [0.05, 0.25], 'same-race-steeper': [0.05, 0.25],
    'within-exposure': [0.25, 0.32], 'within-exposure-2': [0, 0.01], 'within-price': [0.05, 0.25],
    'nearby': [0.05, 0.25], 'nearby-intro': [0, 0.01], 'fan': [0.25, 0.32], 'fan-2': [0.42, 0.5], 'fan-3': [0, 0.01],
    'all-groups': [0.25, 0.32], 'assumption': [0.05, 0.25], 'state-layer-3': [0.25, 0.32], 'state-map': [0.25, 0.32] };
  // v9.4: timing, sources, accessible names and furniture of the beats rebuilt after the PI's review of version 4.
  // price-local: the zoom runs through F['price-local'].seq (p 0.05-0.6); q (the legend, the outline) starts when the dots take their colors. nearby-intro: seq to p 0.33.
  QRANGE['price-local'] = [0.45, 0.6]; QRANGE['simple'] = [0.05, 0.5]; QRANGE['simple-votes'] = [0.05, 0.45]; QRANGE['ideal-shuffle'] = [0.05, 0.55]; QRANGE['close-to-random'] = [0.02, 0.56];
  QRANGE['nearby-intro'] = [0, 0.33]; QRANGE['nearby-groups'] = [0.05, 0.3]; QRANGE['state-regions'] = [0.05, 0.4]; QRANGE['state-map'] = QRANGE['state-regions'];
  QRANGE['adj-state'] = [0.05, 0.4];
  STAG['simple-votes'] = 0.3;
  ANN_IN['price-local'] = [0.45, 0.6]; ANN_IN['assumption'] = [0.18, 0.26]; ANN_IN['nearby-groups'] = [0, 0.01]; ANN_IN['state-regions'] = [0, 0.01]; ANN_IN['state-map'] = ANN_IN['state-regions'];
  ANN_IN['adj-state'] = [0, 0.01]; ANN_ALIAS['adj-state'] = 'state-regions';
  ANN_ALIAS['the-question'] = 'vote-swing'; ANN_ALIAS['state-map'] = 'state-regions';   // the-question holds the figure of vote-swing exactly; state-map is the id main.js's alias still sends
  HEAD_OF['the-question'] = 'cov'; HEAD_OF['simple-votes'] = 'lineup'; HEAD_OF['ideal'] = 'qV8'; HEAD_OF['ideal-shuffle'] = 'idealV8'; HEAD_OF['close-to-random'] = 'idealV8';
  HEAD_OF['nearby-intro'] = 'pa44'; HEAD_OF['nearby-groups'] = 'paGrp'; HEAD_OF['assumption'] = 'paGrpAs'; HEAD_OF['state-regions'] = 'v8region'; HEAD_OF['state-map'] = 'v8region';
  HEAD_OF['adj-state'] = 'v8region';
  FURN['the-question'] = FURN['vote-swing'].slice();
  FURN['simple'] = ['lineup', 'hd:lineup']; FURN['simple-votes'] = ['lineup', 'hd:lineup']; FURN['simple-why'] = ['lineup', 'hd:lineup'];
  FURN['ideal'] = ['leg-b26p3', 'leg-grey', 'hd:qV8']; FURN['ideal-shuffle'] = ['leg-b26p3', 'leg-grey', 'hd:qV8', 'hd:idealV8']; FURN['close-to-random'] = FURN['ideal-shuffle'].slice();
  FURN['nearby-intro'] = ['strips', 'aside', 'hd:strips', 'hd:pa67', 'hd:pa44', 'pa-out', 'leg-kind', 'leg-size']; FURN['price-local'] = (FURN['price-local'] || []).concat(['hd:pa67']);   // v9.4: neutral title during the zoom
  FURN['nearby-groups'] = ['hd:paGrp', 'pa-out', 'leg-kind'];   // v9.4 QA: this statement had slipped into the comment above; the beat then showed the wrong heading and no kind key
  FURN['assumption'] = ['hd:paGrpAs', 'pa-out', 'leg-kind-as', 'leg-size'];
  FURN['state-regions'] = ['leg-pad', 'hd:v8region']; FURN['state-map'] = FURN['state-regions'];
  FURN['adj-state'] = ['leg-pad', 'hd:v8region'];
  ['price-local', 'markets'].forEach(b => { FURN[b] = (FURN[b] || []).concat(['pa-out-n']); });
  ['hd:pa67', 'hd:pa44', 'hd:qV8', 'hd:idealV8', 'pa-out', 'pa-out-n', 'leg-kind', 'leg-kind-as', 'leg-size', 'leg-grey'].forEach(k => { if (LIVE_FUR.indexOf(k) < 0) LIVE_FUR.push(k); });
  SRC_OF['simple'] = S_ACSEIA; SRC_OF['simple-votes'] = ['Source: ACS 2020–2024; EIA. Illustrative: made-up vote shifts.', 'Source: ACS; EIA. Illustrative: made-up vote shifts.'];
  SRC_OF['simple-why'] = ['Source: ACS 2020–2024; EIA; Census Bureau and USDA market definitions. Illustrative: made-up vote shifts.', 'Source: ACS; EIA; Census, USDA. Illustrative: made-up vote shifts.'];
  SRC_OF['the-question'] = SRC_OF['vote-swing'];
  SRC_OF['ideal'] = SRC_OF['close-to-random'] = ['Source: ACS 2020–2024; EIA.', 'Source: ACS; EIA.'];
  SRC_OF['ideal-shuffle'] = ['Source: ACS 2020–2024; EIA. Illustrative: the extra fuel costs shuffled at random.', 'Source: ACS; EIA. Illustrative: costs shuffled at random.'];
  SRC_OF['nearby-intro'] = ['Sources: Census Bureau statistical areas (2023 delineation); USDA commuting zones (2020).', 'Sources: Census Bureau statistical areas (2023); USDA commuting zones (2020).', 'Sources: Census Bureau; USDA.'];
  SRC_OF['nearby-groups'] = S_MKT; SRC_OF['assumption'] = S_MKT;
  SRC_OF['adj-oil'] = ['Source: Census Bureau, County Business Patterns 2023.', 'Source: Census Bureau, CBP 2023.'];
  SRC_OF['scope-where'] = ['Project calculation on AAA prices, October 13–28, weighted as the regression is. Areas: fuel supply regions by kind of market; provisional.', 'Project calculation; provisional.'];
  SRC_OF['state-regions'] = SRC_OF['state-map'] = SRC_OF['adj-state'] = S_EIA;
  Object.assign(ARIA, {
    'price-local': 'The map of county dots, shaded by exposure. The dots outside Pennsylvania fade, and Pennsylvania’s 67 county dots expand into a map of the state. They are then colored by illustrative local price rises, darker where the rise is larger.',
    'markets': 'Pennsylvania’s counties. The illustrative price colors fade to neutral, then outlines and lines join the counties of each local market; two markets are labeled.',
    'the-question': ARIA['vote-swing'],
    'simple': 'Dot line-up of the counties in the states with a race. The dots move from the map into stacked columns, ordered from left to right by extra fuel cost, from the lightest to the heaviest.',
    'simple-votes': 'The same line-up with a new vertical axis, the vote shift against the president’s party in points. The dots rise by made-up vote shifts, and a faint fitted line shows a gentle upward slope.',
    'simple-why': 'The same dots, now colored by the kind of local market: metropolitan, micropolitan or rural. West Coast counties are ringed, and the key above the plot says so. Labels point to the mostly rural counties and to the West Coast.',
    'ideal': 'National map of the counties in the states with a race, colored by extra fuel cost: heavy on the West Coast and in the rural South, light in the Northeast. Counties in other states are gray.',
    'ideal-shuffle': 'The colors lift off the counties as particles, gather in a cloud over the middle of the map, and fall back onto the map, each onto a different county. The result is a map with the extra fuel costs scattered at random.',
    'close-to-random': 'The same movement in reverse: the colors gather in a cloud and return to their own counties, and the real map comes back. A bar at the top of the figure then shows all the differences in extra fuel cost between counties.',
    'nearby-intro': 'The 2022 race strips fade except Pennsylvania’s. Its 67 county dots move onto a map of the state, slide together by local market and merge into 44 market dots, sized by households. The dots are then colored by the kind of market: metropolitan, micropolitan or rural.',
    'nearby-groups': 'Pennsylvania’s local markets. The micropolitan and rural markets fade, and the 16 metropolitan markets are outlined in four comparison groups. One group, Altoona, Johnstown, State College and Williamsport, comes forward with arrows between its markets: compared only with each other, not with Philadelphia.',
    'assumption': 'Pennsylvania’s metropolitan markets in their comparison groups, with Altoona, Johnstown, State College and Williamsport linked within one group. Caption: within each group, whether a market’s price rose more or less than the group’s average must be unrelated to how its counties would otherwise have voted.',
    'scope-where': 'National county map. Each county has the color of its area, a fuel supply region crossed with a kind of market, from areas that count for less in the estimate than their share of the votes to areas that count for more. Counties in states with no race in the analysis are pale.',
    'adj-brief': 'Pennsylvania’s dots shrink back into their places on the national county map, and the other counties fade in, all in a pale neutral color.',
    'adj-oil': 'National county map. Counties in local markets where oil and gas make up more than 2 percent of jobs are highlighted, for example in West Texas.',
    'adj-prior': 'National county map shaded by each county’s vote shift from 2020 to 2024, from blue (toward the Democrats) to red (toward the Republicans). The key above the map gives the scale.',
    'state-regions': 'National county map. The seven fuel supply regions are colored in one at a time, from the West Coast to New England; the Midwest’s states are then outlined and linked by arrows: compared only with each other.'
  });
  ARIA['state-map'] = ARIA['state-regions'];
  ARIA['adj-state'] = ARIA['state-regions'];
  // v9.4: how far through the reshuffle the colors are, for the headings (0 = the real map, 1 = shuffled)
  const shufAmt = (id, p) => id === 'ideal-shuffle' ? smooth(0.05, 0.55, p) : id === 'close-to-random' ? 1 - smooth(0.02, 0.56, p) : 0;
  const qOf = (p, id) => { const r = QRANGE[id] || [0.05, 0.45]; return clamp((p - r[0]) / (r[1] - r[0]), 0, 1); };

  /* ---------- v9.4: the reshuffle (ideal-shuffle and close-to-random) ---------- */
  // The color of each eligible county lifts off its dot as a particle; the particles gather in a still cloud over the middle of the map (PI, 2026-10-29: it does not turn),
  // and fall back onto the map, each onto a different county (D.shufSrc). close-to-random plays the same movement backwards. The picture is a pure function of tau, the
  // timeline of ideal-shuffle: gather 0.05-0.25, hold 0.25-0.32, reassign 0.32-0.55, then held. Under reduced motion the generic cross-fade of F[id].s and F[id].e is used.
  let SH = null;
  // the cloud: a few overlapping soft puffs, in units of its half-width and half-height, so that it has an uneven, fading edge and no outline (PI, 2026-10-30): [x, y, spread]
  const SHUF_PUFFS = [[-0.62, 0.14, 0.27], [-0.24, -0.30, 0.34], [0.20, -0.36, 0.32], [0.60, 0.04, 0.29], [0.02, 0.24, 0.38]];
  const SHUF_GHOST = 0.7;                                   // opacity of a county dot whose color has lifted off (the same pale gray as the counties outside the races)
  const shufTau = (id, p) => id === 'ideal-shuffle' ? p : 0.55 - clamp((p - 0.02) / 0.54, 0, 1) * 0.5;
  function prepShuffle() {
    const E = D.shufE, M = tierWide() ? GEO.ideal : MAP.M0, rnd = mulberry(20261104);
    SH = { E: E, dst: new Int32Array(n).fill(-1), srcOf: new Int32Array(n).fill(-1), cx: M.ox + M.w / 2, cy: M.oy + M.h * 0.5, rx: M.w * 0.31, ry: M.h * 0.46,
      u: new Float32Array(n), v: new Float32Array(n), d1: new Float32Array(n), d2: new Float32Array(n), b1: new Float32Array(n), b2: new Float32Array(n), soft: new Float32Array(n),
      g: new Float32Array(n), w: new Float32Array(n), base: phone || tierWide() ? F['ideal'].e : F['the-question'].e, c: cpf(phone || tierWide() ? F['ideal'].e : F['the-question'].e), pt: nf() };
    E.forEach((j, k) => { SH.dst[D.shufSrc[k]] = j; SH.srcOf[j] = D.shufSrc[k]; });
    E.forEach(i => {
      const pf = SHUF_PUFFS[Math.floor(rnd() * SHUF_PUFFS.length)], rr = Math.sqrt(-2 * Math.log(1 - rnd())), th = 2 * Math.PI * rnd();   // a Gaussian puff
      SH.u[i] = pf[0] + pf[2] * rr * Math.cos(th); SH.v[i] = pf[1] + pf[2] * rr * Math.sin(th); SH.soft[i] = 0.85 * smooth(1, 2.4, rr); SH.d1[i] = rnd(); SH.d2[i] = rnd(); SH.b1[i] = (rnd() - 0.5) * 0.5; SH.b2[i] = (rnd() - 0.5) * 0.5;
    });
    const pt = SH.pt; E.forEach(i => { pt.x[i] = SH.base.x[i]; pt.y[i] = SH.base.y[i]; pt.r[i] = SH.base.r[i]; setCol(pt, i, C.b26); pt.a[i] = 0; });
  }
  // The counties' frame (SH.c) and the particles' frame (SH.pt) at tau.
  function shuffleFrame(tau) {
    const S0 = SH, base = S0.base, c = S0.c, pt = S0.pt, E = S0.E, pr = C.pale[0], pg = C.pale[1], pb = C.pale[2];
    for (let k = 0; k < E.length; k++) {
      const i = E[k], dj = S0.dst[i];
      const gv = clamp((tau - (0.05 + 0.07 * S0.d1[i])) / 0.13, 0, 1), g = gv * gv * (3 - 2 * gv), wv = clamp((tau - (0.32 + 0.10 * S0.d2[i])) / 0.13, 0, 1), w = wv * wv * (3 - 2 * wv);
      S0.g[i] = g; S0.w[i] = w;
      const sx = base.x[i], sy = base.y[i], cu = S0.cx + S0.rx * S0.u[i], cv = S0.cy + S0.ry * S0.v[i];
      let x, y;
      if (w > 0) {                                                                // falling back: from the cloud to the county it lands on
        const tx = base.x[dj], ty = base.y[dj], dx = tx - cu, dy = ty - cv, L = Math.hypot(dx, dy) || 1, bd = S0.b2[i] * Math.sin(Math.PI * w) * L;
        x = cu + dx * w - dy / L * bd; y = cv + dy * w + dx / L * bd;
      } else {                                                                    // gathering, or held in the cloud
        const dx = cu - sx, dy = cv - sy, L = Math.hypot(dx, dy) || 1, bd = S0.b1[i] * Math.sin(Math.PI * g) * L;
        x = sx + dx * g - dy / L * bd; y = sy + dy * g + dx / L * bd;
      }
      pt.x[i] = phone || tierWide() ? clamp(x, GEO.pad + 2, W - GEO.pad - 2) : x; pt.y[i] = tierWide() ? clamp(y, 36, H - Math.max(34, window.SLICE_BAND || 0) - 80) : phone ? clamp(y, 36, H - 66) : y; pt.r[i] = lerp(base.r[i], base.r[dj], w);
      pt.cr[i] = base.cr[i]; pt.cg[i] = base.cg[i]; pt.cb[i] = base.cb[i];
      pt.a[i] = 0.93 * smooth(0, 0.1, g) * (1 - smooth(0.85, 1, w)) * (1 - S0.soft[i] * g * (1 - w));   // in the cloud the outer particles are fainter
      const lift = smooth(0, 0.15, g);                                            // the county's own color has left
      c.cr[i] = lerp(base.cr[i], pr, lift); c.cg[i] = lerp(base.cg[i], pg, lift); c.cb[i] = lerp(base.cb[i], pb, lift); c.a[i] = lerp(base.a[i], SHUF_GHOST, lift);
    }
    for (let k = 0; k < E.length; k++) {                                          // a particle arrives: the county takes its color
      const j = E[k], i = S0.srcOf[j], arr = smooth(0.85, 1, S0.w[i]);
      if (arr <= 0) continue;
      c.cr[j] = lerp(c.cr[j], base.cr[i], arr); c.cg[j] = lerp(c.cg[j], base.cg[i], arr); c.cb[j] = lerp(c.cb[j], base.cb[i], arr); c.a[j] = lerp(c.a[j], base.a[j], arr);
    }
    return c;
  }

  /* ---------- render ---------- */
  function setOp(node, key, v) {
    v = Math.round(v * 1000) / 1000;
    if (lastOp[key] === v) return; lastOp[key] = v;
    node.style.opacity = v; node.style.display = v < 0.004 ? 'none' : '';
  }

  // two-slices: copies of the dots leave the first strip for the second, then the second for the third (positions and fade are functions of p).
  function drawSliceLayers(p, op) {
    const u2 = smooth(0.16, 0.27, p), u3 = smooth(0.23, 0.34, p);
    [[SLF.L2, SLF.f[0], SLF.f[1], u2], [SLF.L3, SLF.f[1], SLF.f[2], u3]].forEach(([o, a, b, u]) => {
      if (u <= 0.001) return;
      const fade = smooth(0, 0.15, u);
      for (let i = 0; i < n; i++) {
        if (b.a[i] <= 0) { o.a[i] = 0; continue; }
        o.x[i] = a.x[i] + (b.x[i] - a.x[i]) * u; o.y[i] = a.y[i] + (b.y[i] - a.y[i]) * u; o.r[i] = b.r[i]; o.a[i] = b.a[i] * fade;
        o.cr[i] = b.cr[i]; o.cg[i] = b.cg[i]; o.cb[i] = b.cb[i]; o.z[i] = 0;
      }
      drawFrame(o, op, true);
    });
  }

  // The panels module draws its charts inside a group of this layer. One child group per call, so each call keeps its own opacity.
  function callPanel(pid, st, o, free) {
    const api = window.DOTS_PANELS && window.DOTS_PANELS[pid];
    if (!api || !api.render || o < 0.004) return;
    const cg = S(gPanels, 'g', { class: 'panel-' + pid });
    const c = { w: W, h: H, small: small, T: window.THEME || T, data: rawData, opacity: o, free: free || { x0: 0, y0: 0, x1: W, y1: H } };
    try { api.render(d3.select(cg), st, c); } catch (e) { if (!warned[pid]) { warned[pid] = 1; console.error('[dots] panel ' + pid, e); } }
  }

  let lastSrc = '', lastAria = '', lastSrcOp = -1;
  const srcOf = b => { const pid = PANEL_OF[b], pa = pid && window.DOTS_PANELS && window.DOTS_PANELS[pid]; return (pa && (pa.sourceFor ? pa.sourceFor(b) : pa.source)) || SRC_OF[b] || null; };   // v9.3: sourceFor(beat) lets a panel say which line belongs to which beat (the line then cross-fades at a hand-over between two of its beats)
  const PHONE_HOLD = { 'dots-example': 'price-local', 'price-local': 'markets', 'markets': 'extra-cost', 'extra-cost': 'vote-swing', 'the-question': 'simple' };
  function phoneFurniture(b, p) {
    const f = {}; (FURN[b] || []).forEach(k => { f[k] = 1; });
    if (b === 'price-local') { const a = 1 - smooth(0.05, 0.12, p); f['hd:expV8'] = a; f['leg-ev8'] = a; }
    if (b === 'extra-cost') { const a = 1 - smooth(0.04, 0.08, p); f['hd:mkts'] = a; f['pa-out-n'] = a; f['hd:brnV8'] = smooth(0.08, 0.14, p); f['leg-b26v8'] = smooth(0.20, 0.40, p); }
    if (b === 'vote-swing') { f['hd:brnV8'] = 1 - smooth(0.05, 0.12, p); f['hd:cov'] = smooth(0.12, 0.20, p); }
    if (b === 'simple') { const a = 1 - smooth(0.05, 0.12, p); f['hd:cov'] = a; f['leg-b26v8'] = a; f['hd:lineup'] = 1 - a; }
    return f;
  }
  let lastState = null;
  function rerender() { if (lastState) { lastKey = ''; render(lastState); } }
  function render(s) {
    if (!inited || !s) return;
    lastState = s;
    if (s.w && s.h && (Math.round(s.w) !== W || Math.round(s.h) !== HF)) { W = Math.round(s.w); HF = Math.round(s.h); rebuild(); }
    const id = s.id, nx = s.next || null;
    const mine = IDX[id] != null, nextMine = nx != null && IDX[nx] != null;
    if (!mine && !nextMine) { if (wrap.style.display !== 'none') wrap.style.display = 'none'; lastKey = ''; return; }
    if (wrap.style.display === 'none') wrap.style.display = '';
    const p = clamp(+s.p || 0, 0, 1), t = clamp(+s.t || 0, 0, 1);
    const hasP = !!(window.DOTS_PANELS);
    const RM = rmOn(), key = id + '|' + nx + '|' + p.toFixed(4) + '|' + t.toFixed(4) + '|' + W + 'x' + HF + '|' + hasP + '|' + RM;
    if (key === lastKey) return; lastKey = key;
    const et = ease(t);
    // v8: offset SVG groups by SLICE_BAND (canvas offset is in drawFrame)
    const sliceBand = typeof window.SLICE_BAND === 'number' ? window.SLICE_BAND : 0;
    if (gFur) gFur.setAttribute('transform', sliceBand ? 'translate(0,' + sliceBand + ')' : '');
    if (gAnn) gAnn.setAttribute('transform', sliceBand ? 'translate(0,' + sliceBand + ')' : '');
    if (gPanels) gPanels.setAttribute('transform', sliceBand ? 'translate(0,' + sliceBand + ')' : '');
    if (gSrc) gSrc.setAttribute('transform', sliceBand ? 'translate(0,' + sliceBand + ')' : '');

    let A, B, u = 0, Cn = null, hv = 1, q = 0, st = 0;
    // Two inks: when a panel figure owns the beat, fade the dots canvas to 0 (flat paper, no texture).
    // The dots fade out with t as a panel beat approaches and fade back in with t as a non-panel beat follows.
    const cp = mine ? PANEL_OF[id] : null, np = nextMine ? PANEL_OF[nx] : null;
    // 0 when a panel owns the screen, 1 when dots are alone; the overview is the exception, its faded map stays behind it (PI, 2026-10-30)
    const panelDim = phone && (cp === 'overview' || np === 'overview') ? cp === 'overview' ? et : 1 - et : cp === 'overview' || np === 'overview' ? 1 : cp ? (np ? 0 : et) : (np ? 1 - et : 1);
    if (mine) {
      const fr = F[id]; A = fr.s; B = fr.e; q = qOf(p, id); st = STAG[id] || 0;
      // v7: a beat with a middle frame m moves s -> m over p in k[0]..k[1], then m -> e over k[1]..k[2] (two-stage builds of the dots themselves)
      if (fr.m) { const k = fr.k; if (p < k[1]) { B = fr.m; q = clamp((p - k[0]) / (k[1] - k[0]), 0, 1); } else { A = fr.m; q = clamp((p - k[1]) / (k[2] - k[1]), 0, 1); } }
      // v9.4: a chain of frames (the zoom grammar: the other dots fade, then the chosen dots move, then they change color); k[j]..k[j+1] is the range of p of the move from seq[j] to seq[j+1]
      if (fr.seq) { const k = fr.k; let j = 0; while (j < fr.seq.length - 2 && p >= k[j + 1]) j++; A = fr.seq[j]; B = fr.seq[j + 1]; q = clamp((p - k[j]) / (k[j + 1] - k[j]), 0, 1); }
      u = A === B ? 0 : ease(q);
      if (small && !phone && id === 'price-local' && fr.seq && A === fr.seq[1]) u = 1 - Math.pow(1 - u, 6);
      if (nextMine) { if (t > 0) Cn = F[nx].s; } else if (nx != null) hv = 1 - et;
    } else { A = F[nx].s; B = A; hv = phone && id === 'scope-limits' && nx === 'scope-where' ? smooth(0.5, 0.65, t) : et; }
    hv *= panelDim;
    const shuf = mine && !RM && SH && (id === 'ideal-shuffle' || id === 'close-to-random');
    if (shuf) {
      // v9.4: the colors travel as particles (shuffleFrame); the hand-over to the next beat only exists after close-to-random, where the counties are back on the real map
      // Two inks fix: blend tau continuously at the ideal-shuffle -> close-to-random boundary so the more-saturated ramp does not cause a visible seam
      let tau = shufTau(id, p);
      if (id === 'ideal-shuffle' && nx === 'close-to-random' && t > 0) tau = lerp(tau, shufTau('close-to-random', 0), et);
      const fc = shuffleFrame(tau);
      drawFrame(Cn && id === 'close-to-random' ? blend(fc, fc, 0, Cn, t, 0, 0) : fc, hv);
      drawFrame(SH.pt, hv, true);
    } else if (RM && mine && (u > 0 || Cn)) {
      // v7.2 [S8]: under reduced motion, dots that would travel between two layouts cross-fade between them over the same scroll span instead
      // v9.5: per-dot stagger mirrors the normal path — handover stagger (0.25) and region stagger
      const P = Cn ? (u === 0 ? A : blend(A, B, u, null, 0, 0, q)) : A, Q = Cn ? Cn : B, v = Cn ? ease(t) : u;
      const rmReg = !Cn && (id === 'state-regions' || id === 'state-map' || id === 'adj-state') && u > 0 ? regionProgress(q) : null;
      const rmSt = Cn ? 0.25 : st, rmRaw = Cn ? t : q;
      if (v >= 0.999) drawFrame(Q, hv); else if (v <= 0.001) drawFrame(P, hv);       // the end points are exactly the neighboring pictures (same draw order)
      else { rmMix(Cn && u > 0 ? cpf2(P) : P, Q, v, rmSt, rmRaw, rmReg); drawFrame(RMF.a, hv); drawFrame(RMF.b, hv, true); }
    } else {
      REGW = mine && (id === 'state-regions' || id === 'state-map' || id === 'adj-state') && u > 0 ? regionProgress(q) : null;
      const src = (u === 0 && !Cn) ? A : blend(A, B, u, Cn, t, st, q);
      REGW = null;
      drawFrame(src, hv);
    }
    if (mine && (F[id].m || F[id].seq)) q = qOf(p, id);
    // a second layer of dots that belongs to two-analyses and two-analyses-2 (the state-price map): its opacity is interpolated between the two beats' weights
    if (EXTRA.frame) {
      const v = (mine && EXTRA.w[id] != null ? EXTRA.w[id] * (1 - et) : 0) + (nextMine && EXTRA.w[nx] != null ? EXTRA.w[nx] * et : 0);
      if (v > 0.01) drawFrame(EXTRA.frame, clamp(v, 0, 1), true);
    }
    if (mine && id === 'two-slices' && SLF) drawSliceLayers(p, hv * (1 - et));

    // furniture: cross-fade between the current and the next beat's furniture
    const cur = mine ? (FURN[id] || []) : [], nxt = nextMine ? (FURN[nx] || []) : [];
    Object.keys(FUR).forEach(k => {
      const inC = cur.indexOf(k) >= 0 ? 1 : 0, inN = nxt.indexOf(k) >= 0 ? 1 : 0;
      // v7.2: two different headings share one place, so the old one fades out over the first half of the hand-over and the new one in over the second
      if (k.charCodeAt(0) === 104 && k.indexOf('hd:') === 0) setOp(FUR[k].g, 'f:' + k, inC && inN ? 1 : inC ? 1 - smooth(0, 0.5, t) : inN ? smooth(0.5, 1, t) : 0);
      else setOp(FUR[k].g, 'f:' + k, restorePhone() && inC !== inN ? inC ? 1 - smooth(0, 0.35, t) : smooth(0.65, 1, t) : inC * (1 - et) + inN * et);
    });
    if (mine && id === 'nearby-intro') {                                           // the other strips are gone as Pennsylvania's dots set off for the map
      ['strips', 'aside'].forEach(k => setOp(FUR[k].g, 'f:' + k, 1 - smooth(0, 0.065, p)));
      setOp(FUR['hd:strips'].g, 'f:hd:strips', 1 - smooth(0, 0.04, p));
    }
    // annotations
    const ai = ANN_IN[id] || [0.05, 0.25], fadeIn = smooth(ai[0], ai[1], p);
    BEATS.forEach(b => {
      if (ANN_ALIAS[b]) return;                                                       // driven with its base beat below
      const a = ANN[b], grp = [b].concat(Object.keys(ANN_ALIAS).filter(k => ANN_ALIAS[k] === b)), on = mine && grp.indexOf(id) >= 0;
      // a held group stays at full strength from beat to beat; it only fades in at the first beat and out after the last
      const inG = nextMine && grp.indexOf(nx) >= 0, fi = on && id !== b ? 1 : fadeIn;
      setOp(a.g, 'a:' + b, on ? fi * (inG ? 1 : small && b === 'dots-example' ? 1 - smooth(0, 0.35, t) : 1 - et) : 0);
      if (on && a.subs.length) a.subs.forEach((sb, k) => setOp(sb.g, 'a:' + b + ':' + k, sb.vis(q, p)));
    });
    if (LIVE.two) LIVE.two(mine && id === 'two-analyses-2' ? 1 : mine && id === 'two-analyses' && nx === 'two-analyses-2' ? et : 0);
    // live pieces: the beat that owns a piece of furniture drives it; before that, the next beat's start state
    const owner = k2 => (mine && cur.indexOf(k2) >= 0) ? [id, q, p, t] : (nextMine && nxt.indexOf(k2) >= 0) ? [nx, 0, 0, 0] : null;
    LIVE_FUR.forEach(k => { const ow = owner(k); if (ow && LIVE[k]) LIVE[k](ow[0], ow[1], ow[2], ow[3]); });
    // Incoming builds still hold the outgoing map: keep its explanation through the hand-over.
    if (small && (['exposure', 'dots-example', 'price-local', 'markets', 'extra-cost', 'vote-swing', 'the-question'].indexOf(id) >= 0 || id === 'simple' && p < 0.12)) {
      const a = phoneFurniture(id, p), hold = PHONE_HOLD[id] === nx, b = hold ? a : phoneFurniture(nx, 0);
      if (id === 'extra-cost') { LIVE['hd:mkts']('markets', 1, 1, 0); LIVE['pa-out-n']('markets', 1, 1, 0); }
      Object.keys(FUR).forEach(k => {
        const x = a[k] || 0, y = b[k] || 0;
        const v = k.indexOf('hd:') === 0 ? x && y ? x * (1 - et) + y * et : x ? x * (1 - smooth(0, 0.5, t)) : y * smooth(0.5, 1, t) : restorePhone() && !!x !== !!y ? x ? x * (1 - smooth(0, 0.35, t)) : y * smooth(0.65, 1, t) : x * (1 - et) + y * et;
        setOp(FUR[k].g, 'f:' + k, v);
      });
      const carried = id === 'dots-example' && hold ? ['dots-example', fadeIn] : id === 'price-local' ? ['dots-example', 1 - smooth(0.05, 0.12, p)]
        : id === 'markets' && hold ? ['markets', fadeIn] : id === 'extra-cost' ? ['markets', 1 - smooth(0.04, 0.08, p)]
        : id === 'the-question' && hold ? ['vote-swing', 1] : id === 'simple' ? ['vote-swing', 1 - smooth(0.05, 0.12, p)] : null;
      if (id === 'price-local' && hold || id === 'markets') setOp(ANN['price-local'].g, 'a:price-local', id === 'price-local' ? fadeIn : 1 - smooth(0.05, 0.08, p));
      if (carried) { const an = ANN[carried[0]], own = carried[0] === id; setOp(an.g, 'a:' + carried[0], carried[1]); an.subs.forEach((sb, k) => setOp(sb.g, 'a:' + carried[0] + ':' + k, sb.vis(own ? q : 1, own ? p : 1))); }
    }
    if (mine && id === 'simplest-slope' && LIVE.slope) LIVE.slope(q);
    if (mine && id === 'what-is-left' && LIVE.left) LIVE.left(q);
    if (mine && id === 'within-exposure-2' && LIVE.paLines8) LIVE.paLines8(p);
    if (mine && id === 'adj-lagged' && LIVE.lag) LIVE.lag(q);
    // two-slices: the fan's axes leave as the dots set off for the first strip; two copies of the dots travel on into the second and third strip
    if (mine && id === 'two-slices' && FUR.fan) setOp(FUR.fan.g, 'f:fan', 1 - smooth(0.02, 0.12, p));

    // source line: the shell's window.sourceLine when present (one text in the svg, swapped at the midpoint of a hand-off), else drawn here
    if (typeof window.sourceLine === 'function') {
      // v7.2 [S12]: the line changes with its figure. Between two figures with different lines, the old one fades out over the first half of the hand-over and the new
      // one in over the second half; a hand-over to or from another module follows the figure's own alpha. The alpha is passed to window.sourceLine (and set here too).
      let cA = mine ? srcOf(id) : null, cB = nextMine ? srcOf(nx) : null;
      const same = cA && cB && cA.join('|') === cB.join('|'), useB = !cA || (cB && t > 0.5), c = useB ? cB : cA;
      const op = same ? 1 : cA && cB ? (useB ? smooth(0.5, 1, t) : 1 - smooth(0, 0.5, t)) : cA ? 1 - et : et;
      const el2 = svg.querySelector('text.source-line');
      if (c) {
        const k = c.join('|'), o3 = Math.round(op * 100) / 100;
        if (k !== lastSrc || !el2 || o3 !== lastSrcOp) { window.sourceLine(svg, c, W, HF, o3); lastSrc = k; lastSrcOp = o3; }
        const e2 = svg.querySelector('text.source-line');
        if (e2) e2.style.opacity = o3;
      } else if (el2) el2.style.opacity = 0;
    } else {
      const sc = {};
      if (mine && SRC_TXT[id]) sc[SRC_TXT[id]] = (sc[SRC_TXT[id]] || 0) + (1 - et);
      if (nextMine && SRC_TXT[nx]) sc[SRC_TXT[nx]] = (sc[SRC_TXT[nx]] || 0) + et;
      Object.keys(SRCEL).forEach(str => setOp(SRCEL[str], 's:' + str, clamp(sc[str] || 0, 0, 1)));
    }

    // panels (drawn by DOTS_PANELS inside this module's layer). state.id is the panel id, state.beat the beat id.
    // The incoming panel fades in with the previous beat's t and then holds at 1 from p = 0; consecutive beats that share a panel keep it at 1 (one call).
    while (gPanels.firstChild) gPanels.removeChild(gPanels.firstChild);
    {
      const cp = mine ? PANEL_OF[id] : null, np = nextMine ? PANEL_OF[nx] : null;
      const free = pid => ({ x0: 0, y0: 0, x1: W, y1: H });
      const mk = (pid, over) => Object.assign({}, s, { id: pid }, over);
      if (cp) callPanel(cp, mk(cp, { beat: id, next: nx }), np === cp ? 1 : phone && cp === 'equation' && !np ? 1 - smooth(0, 0.4, t) : 1 - et, free(cp));   // phone: the equation is out over the first part of the hand-over to twelve elections, so that the two never share the panel
      if (np && np !== cp) callPanel(np, mk(np, { beat: nx, next: null, p: 0, t: 0 }), phone && !mine && id === 'left' ? smooth(0.5, 0.58, t) : et, free(np));   // phone: in over the second half, after the bar of `left` is out
    }
    // accessible name of the figure: that of the beat on show (the next beat's once the hand-over is past its midpoint). Where a chart panel draws the beat, the panel's own
    // label is used (it names its picture in detail); this module's table is the fallback.
    {
      const ab = nextMine && (!mine || et > 0.5) ? nx : id, pid = PANEL_OF[ab];
      const pg = pid && Array.prototype.find.call(gPanels.children, c => c.classList.contains('panel-' + pid));
      const al = (pg && pg.getAttribute('aria-label')) || ARIA[ab] || '';
      if (al !== lastAria) { svg.setAttribute('aria-label', al); lastAria = al; }
    }

  }

  function resize(w, h) {
    if (!inited) return;
    W = Math.round(w || el.clientWidth) || W; HF = Math.round(h || el.clientHeight) || HF;
    rebuild(); rerender();
  }

  window.VIS.dots = { init: init, render: render, resize: resize, _debug: function () { return { D: D, GEO: GEO, MAP: MAP, F: F, ANN: ANN, FUR: FUR, W: W, H: H, HF: HF }; } };
})();
