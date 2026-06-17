// "La Fórmula" deliverable template.
// The AI generates only the content of the 15 sections; this module wraps
// them in the fixed premium skeleton (CSS + hero + nav + tab logic) so every
// deliverable is consistent and client-ready.

export const FORMULA_NAV_LABELS = [
  '01 Context', '02 Insights', '03 Objectives', '04 Audiences', '05 Brand',
  '06 Benchmark', '07 Strategic Concept', '08 Creative', '09 Media Plan',
  '10 Slogans', '11 Content Grid', '12 SEO / Ads', '13 Big Ideas', '14 Summary', '15 Closing',
];

// Catalog of available clusters. navLabels MUST match the section count the
// edge function emits for that cluster. One run per client per calendar month.
export interface ClusterDef {
  key: string;
  title: string;
  badge: string;
  description: string;
  navLabels: string[];
}

export const CLUSTER_CATALOG: ClusterDef[] = [
  {
    key: 'la_formula_v2',
    title: 'La Fórmula',
    badge: 'Brand Strategy',
    description:
      'A complete brand strategy in 15 sections: insights, SMART objectives, audiences, brand structure, benchmark, strategic & creative concepts, 360° media plan, content grid (20 pieces), SEO + Google Ads, big ideas and an executive summary. Briefing-centered, boosted with live data. Premium client-ready deliverable.',
    navLabels: FORMULA_NAV_LABELS,
  },
  {
    key: 'tactical_optimization',
    title: 'Tactical Optimization',
    badge: 'Weekly Optimization',
    description:
      "A media-buyer-grade optimization plan for the week: root-cause diagnosis by funnel layer, the exact moves to make (pause, scale, reallocate) with the numbers that justify them, what NOT to touch, and a watchlist. Built from this client's real campaign and ad-set data.",
    navLabels: [
      '01 Diagnosis', '02 Funnel Diagnosis', '03 Actions', '04 Don\'t Touch',
      '05 Budget Reallocation', '06 Watchlist',
    ],
  },
  {
    key: 'keywords_google_ads',
    title: 'Keywords & Google Ads',
    badge: 'SEM',
    description:
      'A complete, ready-to-launch SEM plan: keyword clusters by intent, themed ad groups, negative keywords, 15 headlines and 15 descriptions within Google Ads limits, sitelinks & extensions, a SEM benchmark and quick wins. Built from the brief and any live Google Ads data.',
    navLabels: [
      '01 SEM Strategy', '02 Keyword Clusters', '03 Ad Groups', '04 Negatives',
      '05 Headlines', '06 Descriptions', '07 Extensions', '08 SEM Benchmark', '09 Quick Wins',
    ],
  },
];

export function getClusterDef(key: string): ClusterDef {
  return CLUSTER_CATALOG.find(c => c.key === key) ?? CLUSTER_CATALOG[0];
}

export interface FormulaHero {
  eye: string;          // e.g. "La Fórmula™ · Estrategia de Marca 2026"
  title: string;        // brand name; last word is highlighted in gold
  sub: string;          // e.g. "Estrategia completa · Kiosko Agency · Colombia"
  meta: { strong: string; label: string }[]; // up to 5 hero stats
}

const FORMULA_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --gold:#C8973A;--gold-light:#F0D49A;--dark:#140E05;--cream:#FAF6EE;
  --green:#2D5A27;--green-bg:#EBF2E9;--warm:#8B5E3C;--text:#1E1608;
  --muted:#7A6A52;--border:rgba(200,151,58,0.18);--white:#FFFFFF;
}
html{scroll-behavior:smooth}
body{font-family:'DM Sans',sans-serif;background:var(--dark);color:var(--text)}
.hero{background:var(--dark);padding:56px 40px 40px;text-align:center;position:relative;overflow:hidden;border-bottom:1px solid var(--border)}
.hero::after{content:'';position:absolute;top:-100px;left:50%;transform:translateX(-50%);width:500px;height:500px;background:radial-gradient(ellipse,rgba(200,151,58,0.1) 0%,transparent 65%);pointer-events:none}
.hero-eye{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:18px}
.hero-title{font-family:'Playfair Display',serif;font-size:clamp(40px,7vw,80px);font-weight:900;color:var(--cream);line-height:1.03;margin-bottom:6px}
.hero-title span{color:var(--gold)}
.hero-sub{font-size:14px;color:rgba(250,246,238,0.45);font-weight:300;font-style:italic;margin-bottom:36px}
.hero-meta{display:flex;justify-content:center;gap:40px;flex-wrap:wrap}
.hm{text-align:center;color:rgba(250,246,238,0.6);font-size:11px}
.hm strong{display:block;color:var(--gold);font-size:17px;font-weight:500;margin-bottom:2px}
.nav{background:var(--dark);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100;overflow-x:auto;-webkit-overflow-scrolling:touch}
.nav::-webkit-scrollbar{height:2px}
.nav::-webkit-scrollbar-thumb{background:var(--gold);border-radius:2px}
.nav-inner{display:flex;min-width:max-content;padding:0 16px}
.nb{background:none;border:none;border-bottom:2px solid transparent;color:rgba(250,246,238,0.38);font-family:'DM Sans',sans-serif;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;font-weight:500;padding:13px 14px;cursor:pointer;white-space:nowrap;transition:all .2s}
.nb:hover{color:rgba(250,246,238,0.7)}
.nb.on{color:var(--gold);border-bottom-color:var(--gold)}
.main{background:var(--cream);min-height:80vh}
.sec{display:none;padding:52px 44px;max-width:860px;margin:0 auto}
.sec.on{display:block}
.sh{margin-bottom:36px;padding-bottom:22px;border-bottom:1px solid var(--border)}
.sh-num{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:8px}
.sh-title{font-family:'Playfair Display',serif;font-size:30px;font-weight:700;color:var(--dark);line-height:1.2}
.body h3{font-family:'Playfair Display',serif;font-size:19px;font-weight:700;color:var(--dark);margin:32px 0 10px}
.body h4{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);font-weight:500;margin:22px 0 8px}
.body p{font-size:15px;line-height:1.78;color:var(--text);margin-bottom:14px}
.body ul,.body ol{padding-left:20px;margin-bottom:14px}
.body li{font-size:15px;line-height:1.7;color:var(--text);margin-bottom:6px}
.body strong{font-weight:500;color:var(--dark)}
.body em{color:var(--warm);font-style:italic}
.callout{background:var(--dark);border-left:3px solid var(--gold);border-radius:6px;padding:22px 26px;margin:24px 0}
.callout-lbl{font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:8px;font-weight:500}
.callout p{color:rgba(250,246,238,0.85);font-size:15px;line-height:1.7;margin:0}
.iw{background:linear-gradient(135deg,var(--dark) 0%,#2A1A06 100%);border:1px solid var(--gold);border-radius:12px;padding:30px 32px;margin:28px 0;position:relative}
.iw::before{content:'★ INSIGHT SELECCIONADO';position:absolute;top:14px;right:18px;font-size:9px;letter-spacing:2px;color:var(--gold);font-weight:500}
.iw p{font-family:'Playfair Display',serif;font-size:19px;color:var(--cream);line-height:1.55;font-style:italic;margin:0}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:20px 0}
.card{background:var(--white);border:1px solid rgba(200,151,58,0.14);border-radius:10px;padding:18px 20px}
.card-t{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:8px}
.card-b{font-size:14px;color:var(--text);line-height:1.65}
.sl{border-bottom:1px solid var(--border);padding:14px 0;display:flex;gap:14px;align-items:flex-start}
.sl-num{font-size:11px;color:var(--gold);font-weight:500;min-width:22px;padding-top:2px}
.sl-text{font-size:15px;color:var(--text);line-height:1.6}
.sl-ctx{font-size:12px;color:var(--muted);margin-top:3px}
.tbl{width:100%;border-collapse:collapse;font-size:13px;margin:18px 0}
.tbl th{text-align:left;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);font-weight:500;padding:8px 12px;border-bottom:1px solid var(--border)}
.tbl td{padding:9px 12px;border-bottom:1px solid rgba(200,151,58,0.07);color:var(--text);vertical-align:top}
.tbl tr:last-child td{border-bottom:none}
.tbl tr:hover td{background:rgba(200,151,58,0.04)}
.cg{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}
.cg-item{background:var(--white);border:1px solid rgba(200,151,58,0.13);border-radius:8px;padding:16px}
.cg-type{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.cg-name{font-weight:500;font-size:14px;color:var(--dark);margin-bottom:6px}
.cg-desc{font-size:13px;color:var(--muted);line-height:1.55}
.tag{display:inline-block;font-size:10px;font-weight:500;padding:2px 8px;border-radius:20px;margin-top:6px}
.tag-pauta{background:rgba(200,151,58,0.12);color:var(--warm)}
.tag-organic{background:var(--green-bg);color:var(--green)}
.tag-camp{background:rgba(45,90,39,0.08);color:var(--green)}
.bi{background:var(--white);border:1px solid var(--border);border-radius:10px;padding:20px 22px;margin:14px 0}
.bi-name{font-family:'Playfair Display',serif;font-size:16px;font-weight:700;color:var(--dark);margin-bottom:6px}
.bi-desc{font-size:14px;color:var(--text);line-height:1.65}
.bi-winner{border:1.5px solid var(--gold);background:rgba(200,151,58,0.04)}
.hl-item{display:flex;gap:14px;padding:10px 0;border-bottom:1px solid rgba(200,151,58,0.08);font-size:14px}
.hl-num{color:var(--gold);font-weight:500;min-width:24px;font-size:12px;padding-top:2px}
.hl-text{color:var(--text);line-height:1.5}
.hl-chars{font-size:11px;color:var(--muted);margin-top:2px}
.cierre{text-align:center;padding:60px 20px}
.cierre-quote{font-family:'Playfair Display',serif;font-size:22px;font-weight:400;color:var(--dark);line-height:1.6;font-style:italic;max-width:620px;margin:0 auto 32px}
.cierre-firma{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--muted)}
.budget-row{display:flex;align-items:center;gap:14px;margin-bottom:12px}
.budget-label{font-size:13px;color:var(--text);min-width:120px}
.budget-bar{flex:1;height:8px;background:rgba(200,151,58,0.12);border-radius:4px;overflow:hidden}
.budget-fill{height:100%;background:var(--gold);border-radius:4px}
.budget-val{font-size:13px;font-weight:500;color:var(--dark);min-width:90px;text-align:right}
.step{display:flex;gap:16px;margin-bottom:18px;align-items:flex-start}
.step-num{width:30px;height:30px;border-radius:50%;background:var(--gold);color:var(--dark);font-size:13px;font-weight:500;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.step-content h4{font-size:15px;font-weight:500;color:var(--dark);margin-bottom:4px}
.step-content p{font-size:14px;color:var(--muted);line-height:1.6;margin:0}
.kpi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}
.kpi{background:var(--dark);border-radius:8px;padding:16px;text-align:center}
.kpi-val{font-family:'Playfair Display',serif;font-size:24px;color:var(--gold);font-weight:700}
.kpi-lbl{font-size:11px;color:rgba(250,246,238,0.5);margin-top:4px}
.persona{background:var(--white);border:1px solid var(--border);border-radius:12px;padding:24px 26px;margin-bottom:20px}
.persona-header{display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid var(--border)}
.persona-avatar{width:46px;height:46px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:18px;color:var(--dark);font-weight:700;flex-shrink:0}
.persona-name{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--dark)}
.persona-sub{font-size:12px;color:var(--muted);margin-top:2px}
.empathy{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
.emp-box{background:rgba(200,151,58,0.06);border-radius:6px;padding:10px 12px}
.emp-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-bottom:4px}
.emp-txt{font-size:13px;color:var(--text);line-height:1.5}
@media(max-width:640px){
  .sec{padding:32px 20px}
  .g2,.g3,.cg,.kpi-row,.empathy{grid-template-columns:1fr}
  .hero{padding:40px 20px 28px}
  .hero-meta{gap:24px}
}
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildFormulaHtml(
  hero: FormulaHero,
  sections: string[],
  navLabels: string[] = FORMULA_NAV_LABELS,
): string {
  // Last word of the brand title gets the gold highlight
  const words = hero.title.trim().split(/\s+/);
  const last = words.pop() || '';
  const titleHtml = words.length > 0
    ? `${escapeHtml(words.join(' '))} <span>${escapeHtml(last)}</span>`
    : `<span>${escapeHtml(last)}</span>`;

  const metaHtml = hero.meta.slice(0, 5).map(m =>
    `<div class="hm"><strong>${escapeHtml(m.strong)}</strong>${escapeHtml(m.label)}</div>`
  ).join('\n    ');

  const navHtml = navLabels.map((label, i) =>
    `<button class="nb${i === 0 ? ' on' : ''}" onclick="go(${i})">${label}</button>`
  ).join('\n    ');

  // Sections injected as JSON strings — no template-literal escaping issues
  const secsJs = `const SECS = [\n${sections.map(s => JSON.stringify(s)).join(',\n')}\n];`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(hero.title)} — Strategy</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet">
<style>${FORMULA_CSS}</style>
</head>
<body>

<div class="hero">
  <div class="hero-eye">${escapeHtml(hero.eye)}</div>
  <h1 class="hero-title">${titleHtml}</h1>
  <p class="hero-sub">${escapeHtml(hero.sub)}</p>
  <div class="hero-meta">
    ${metaHtml}
  </div>
</div>

<nav class="nav">
  <div class="nav-inner">
    ${navHtml}
  </div>
</nav>

<main class="main" id="main"></main>

<script>
${secsJs}

function go(i) {
  document.querySelectorAll('.nb').forEach((b,j) => b.classList.toggle('on', j===i));
  document.getElementById('main').innerHTML = '<div class="sec on">' + SECS[i] + '</div>';
  window.scrollTo({top: document.querySelector('.nav').offsetTop - 4, behavior:'smooth'});
}

go(0);
</script>
</body>
</html>`;
}

// ===== Stream output protocol shared with the edge function =====
// The AI streams: ===HERO=== {json} then ===SECTION N=== html ... (15 sections)
export const HERO_DELIM = '===HERO===';
export const SECTION_DELIM_RE = /===SECTION\s+(\d+)===/g;

export interface ParsedFormula {
  hero: FormulaHero | null;
  sections: string[];     // sections received so far (in order)
  currentSection: number; // highest section number seen (0 = none yet)
}

export function parseFormulaStream(raw: string): ParsedFormula {
  let hero: FormulaHero | null = null;

  const heroIdx = raw.indexOf(HERO_DELIM);
  const firstSection = raw.search(/===SECTION\s+\d+===/);
  if (heroIdx !== -1) {
    const heroEnd = firstSection !== -1 ? firstSection : raw.length;
    const heroRaw = raw.slice(heroIdx + HERO_DELIM.length, heroEnd).trim();
    const jsonMatch = heroRaw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { hero = JSON.parse(jsonMatch[0]); } catch { /* incomplete while streaming */ }
    }
  }

  const sections: string[] = [];
  let currentSection = 0;
  const parts = raw.split(/===SECTION\s+\d+===/);
  // parts[0] is the hero part; the rest are section bodies in order
  for (let i = 1; i < parts.length; i++) {
    sections.push(parts[i].trim());
    currentSection = i;
  }
  return { hero, sections, currentSection };
}
