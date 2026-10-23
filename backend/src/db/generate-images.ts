/**
 * Generates the demo artwork (SVG) into frontend/public/images:
 *   products/   studio shots of each fertilizer pack (bag, bottle, pouch, tub, box)
 *   categories/ category tiles
 *   crops/      "Shop by crop" icons
 *   banners/    landscape hero banners
 *
 * Images live in the frontend (served statically by Next.js); the database stores
 * only their paths. Replace any file with a real photo (keep the filename, or update
 * the path from the admin panel).
 *
 *   npm run images -w backend
 */
import fs from 'fs';
import path from 'path';
import slugify from 'slugify';
import { banners, categories, crops, products, type PackKind, type SeedProduct } from './seed-data';

const OUT = path.resolve(__dirname, '../../../frontend/public/images');
const slug = (s: string) => slugify(s, { lower: true, strict: true });

const GOLD = '#e5a117';
const FOREST = '#0f2e1d';

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = c(n >> 16),
    g = c((n >> 8) & 255),
    b = c(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = `font-family="Helvetica, Arial, sans-serif"`;

/** Rough glyph advance (em) for bold Helvetica — used to size text so it always fits. */
function advance(ch: string) {
  if (/[A-Z]/.test(ch)) return ch === 'I' ? 0.34 : ch === 'M' || ch === 'W' ? 0.95 : 0.74;
  if (/[a-z]/.test(ch)) return ch === 'i' || ch === 'l' ? 0.28 : ch === 'm' || ch === 'w' ? 0.9 : 0.6;
  if (/[0-9]/.test(ch)) return 0.62;
  if (ch === ' ') return 0.3;
  if (/[.:,·'|]/.test(ch)) return 0.3;
  return 0.6;
}

/** Single-line text that always fits `maxW`. */
function fit(text: string, x: number, y: number, maxW: number, base: number, fill: string, opts: { weight?: number; spacing?: number; anchor?: string } = {}) {
  const sp = opts.spacing ?? 0;
  const em = [...text].reduce((n, ch) => n + advance(ch), 0) || 1;
  const fs = Math.max(5, Math.min(base, Math.floor(((maxW - text.length * sp) / em) * 10) / 10));
  return `<text x="${x}" y="${y}" ${FONT} font-size="${fs}" font-weight="${opts.weight ?? 800}" fill="${fill}" text-anchor="${opts.anchor ?? 'middle'}" letter-spacing="${sp}">${esc(text)}</text>`;
}

const leaf = (x: number, y: number, s: number, rot: number, fill = '#3f8f56') =>
  `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0 C-14 -12 -14 -34 0 -48 C14 -34 14 -12 0 0Z" fill="${fill}"/><path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 0 L0 -40" stroke="${shade(fill, -0.15)}" stroke-width="1.6" fill="none"/>`;

function sprout(x: number, y: number, s = 1) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 C0 -14 0 -22 2 -30" stroke="#2f7d3a" stroke-width="3" fill="none" stroke-linecap="round"/>${leaf(2, -30, 0.55, 40, '#4aa05a')}${leaf(2, -26, 0.5, -45, '#3a8a47')}</g>`;
}

// ───────────────────────── Pack drawings (400×400 box) ─────────────────────────

interface PackSpec {
  kind: PackKind;
  tone: string;
  badge: string;
  sub: string;
  brand: string;
  weight: string;
}

function bag(p: PackSpec) {
  const d = shade(p.tone, -0.2);
  const body = 'M106 64 C93 140 91 262 106 342 L294 342 C309 262 307 140 294 64 Z';
  const crimp = (y: number, h: number) =>
    `<rect x="90" y="${y}" width="220" height="${h}" fill="${d}"/>` +
    Array.from({ length: 36 }, (_, i) => `<line x1="${96 + i * 6}" y1="${y}" x2="${96 + i * 6}" y2="${y + h}" stroke="#fff" stroke-opacity=".13" stroke-width="1.5"/>`).join('');
  return `<defs><clipPath id="bagclip"><path d="${body}"/></clipPath>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset=".28" stop-color="#fff" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient></defs>
<g clip-path="url(#bagclip)">
<rect x="80" y="50" width="240" height="310" fill="${p.tone}"/>
${crimp(60, 30)}${crimp(318, 28)}
<path d="M90 100 H310" stroke="${GOLD}" stroke-width="3"/>
${fit(p.brand.toUpperCase(), 200, 122, 150, 15, '#ffffff', { spacing: 2.5 })}
<rect x="124" y="136" width="152" height="162" rx="10" fill="#fffdf5"/>
<rect x="124" y="136" width="152" height="8" rx="4" fill="${GOLD}"/>
${fit(p.sub.toUpperCase(), 200, 166, 128, 10.5, p.tone, { weight: 700, spacing: 1 })}
${fit(p.badge, 200, 214, 132, 38, d)}
<path d="M150 232 H250" stroke="${p.tone}" stroke-opacity=".35" stroke-width="1.5"/>
${leaf(172, 270, 0.5, 0, p.tone)}
${fit('SEALED PACK', 172, 286, 78, 8.5, '#6b7a70', { weight: 700, spacing: 0.8 })}
<path d="M100 150 C140 160 170 150 300 168 M98 230 C150 236 220 224 302 240" stroke="#fff" stroke-opacity=".08" stroke-width="3" fill="none"/>
<rect x="80" y="50" width="240" height="310" fill="url(#sheen)"/>
</g>
<path d="${body}" fill="none" stroke="${shade(p.tone, -0.38)}" stroke-width="1.5" stroke-opacity=".7"/>
<circle cx="268" cy="296" r="27" fill="${GOLD}" stroke="#fff" stroke-width="3"/>
${fit(p.weight, 268, 301, 40, 15, FOREST)}`;
}

function bottle(p: PackSpec) {
  const d = shade(p.tone, -0.2);
  const body = 'M138 160 C138 128 156 116 178 112 L222 112 C244 116 262 128 262 160 L262 326 Q262 344 244 344 L156 344 Q138 344 138 326 Z';
  return `<defs><clipPath id="botclip"><path d="${body}"/></clipPath>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
<rect x="176" y="86" width="48" height="30" fill="${shade(p.tone, 0.12)}"/>
<rect x="168" y="50" width="64" height="42" rx="7" fill="#f6f2e6" stroke="#cfc8b2" stroke-width="1.5"/>
${Array.from({ length: 9 }, (_, i) => `<line x1="${176 + i * 6}" y1="54" x2="${176 + i * 6}" y2="88" stroke="#cfc8b2" stroke-width="1.5"/>`).join('')}
<g clip-path="url(#botclip)">
<rect x="130" y="100" width="140" height="250" fill="${p.tone}"/>
<rect x="130" y="176" width="140" height="132" fill="#fffdf5"/>
<rect x="130" y="176" width="140" height="7" fill="${GOLD}"/>
${fit(p.brand.toUpperCase(), 200, 152, 100, 12, '#ffffff', { spacing: 2 })}
${fit(p.sub.toUpperCase(), 200, 204, 104, 9.5, p.tone, { weight: 700, spacing: 0.8 })}
${fit(p.badge, 200, 244, 110, 28, d)}
${leaf(200, 284, 0.42, 0, p.tone)}
<rect x="130" y="100" width="140" height="250" fill="url(#sheen)"/>
</g>
<path d="${body}" fill="none" stroke="${shade(p.tone, -0.38)}" stroke-width="1.5" stroke-opacity=".7"/>
<rect x="206" y="312" width="52" height="22" rx="11" fill="${GOLD}" stroke="#fff" stroke-width="2"/>
${fit(p.weight, 232, 328, 44, 12, FOREST)}`;
}

function pouch(p: PackSpec) {
  const d = shade(p.tone, -0.22);
  const body = 'M110 78 L290 78 C298 150 302 250 297 330 Q296 348 280 348 L120 348 Q104 348 103 330 C98 250 102 150 110 78 Z';
  const grains = Array.from({ length: 70 }, (_, i) => {
    const x = 152 + ((i * 61 + i * i * 7) % 92);
    const y = 266 + ((i * 29 + i * i * 3) % 46);
    return `<circle cx="${x}" cy="${y}" r="${1.6 + (i % 3) * 0.9}" fill="${i % 4 === 0 ? '#e9e2cf' : '#fff'}" opacity=".95"/>`;
  }).join('');
  return `<defs><clipPath id="pouchclip"><path d="${body}"/></clipPath>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
<g clip-path="url(#pouchclip)">
<rect x="90" y="70" width="220" height="290" fill="${p.tone}"/>
<rect x="90" y="70" width="220" height="30" fill="${d}"/>
<path d="M90 96 H310" stroke="#fff" stroke-opacity=".25" stroke-width="2" stroke-dasharray="3 3"/>
<circle cx="200" cy="84" r="5" fill="#fff" fill-opacity=".5"/>
${fit(p.brand.toUpperCase(), 200, 128, 150, 14, '#ffffff', { spacing: 2.5 })}
<path d="M150 138 H250" stroke="${GOLD}" stroke-width="3"/>
${fit(p.badge, 200, 190, 160, 40, '#ffffff')}
${fit(p.sub.toUpperCase(), 200, 216, 176, 11, '#ffffff', { weight: 700, spacing: 1.2 })}
<rect x="144" y="252" width="112" height="70" rx="12" fill="#10241a" fill-opacity=".35" stroke="#fff" stroke-opacity=".6" stroke-width="2"/>
<clipPath id="win"><rect x="146" y="254" width="108" height="66" rx="10"/></clipPath><g clip-path="url(#win)"><rect x="146" y="254" width="108" height="66" fill="#d9d4c3" fill-opacity=".25"/>${grains}</g>
<path d="M104 336 Q200 322 296 336" stroke="${d}" stroke-width="10" fill="none" stroke-opacity=".5"/>
<rect x="90" y="70" width="220" height="290" fill="url(#sheen)"/>
</g>
<path d="${body}" fill="none" stroke="${shade(p.tone, -0.4)}" stroke-width="1.5" stroke-opacity=".7"/>
<circle cx="272" cy="318" r="26" fill="${GOLD}" stroke="#fff" stroke-width="3"/>
${fit(p.weight, 272, 323, 38, 14, FOREST)}`;
}

function tub(p: PackSpec) {
  const d = shade(p.tone, -0.2);
  const body = 'M118 124 L282 124 L270 330 Q269 344 255 344 L145 344 Q131 344 130 330 Z';
  return `<defs><clipPath id="tubclip"><path d="${body}"/></clipPath>
<linearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>
<rect x="110" y="88" width="180" height="40" rx="9" fill="${d}"/>
${Array.from({ length: 22 }, (_, i) => `<line x1="${118 + i * 8}" y1="92" x2="${118 + i * 8}" y2="124" stroke="#fff" stroke-opacity=".12" stroke-width="1.5"/>`).join('')}
<rect x="110" y="88" width="180" height="40" rx="9" fill="url(#sheen)"/>
<g clip-path="url(#tubclip)">
<rect x="110" y="120" width="180" height="230" fill="${p.tone}"/>
<rect x="110" y="168" width="180" height="140" fill="#fffdf5"/>
<rect x="110" y="168" width="180" height="7" fill="${GOLD}"/>
${fit(p.brand.toUpperCase(), 200, 152, 120, 12.5, '#ffffff', { spacing: 2 })}
${fit(p.sub.toUpperCase(), 200, 200, 130, 9.5, p.tone, { weight: 700, spacing: 0.8 })}
${fit(p.badge, 200, 246, 140, 30, d)}
${leaf(200, 288, 0.42, 0, p.tone)}
<rect x="110" y="120" width="180" height="230" fill="url(#sheen)"/>
</g>
<path d="${body}" fill="none" stroke="${shade(p.tone, -0.38)}" stroke-width="1.5" stroke-opacity=".7"/>
<circle cx="262" cy="316" r="25" fill="${GOLD}" stroke="#fff" stroke-width="3"/>
${fit(p.weight, 262, 321, 36, 14, FOREST)}`;
}

function box(p: PackSpec) {
  const d = shade(p.tone, -0.2);
  const tube = (x: number, c: string, h: number) => `<rect x="${x}" y="${224 - h}" width="15" height="${h}" rx="7" fill="${c}" opacity=".95"/><rect x="${x - 2}" y="${220 - h}" width="19" height="7" rx="3" fill="#cfd8cf"/>`;
  return `<polygon points="96,118 126,92 316,92 286,118" fill="${shade(p.tone, 0.16)}"/>
<polygon points="286,118 316,92 316,296 286,322" fill="${d}"/>
<rect x="96" y="118" width="190" height="204" rx="3" fill="${p.tone}"/>
${fit(p.brand.toUpperCase(), 180, 146, 130, 12, '#ffffff', { spacing: 2.5 })}
<path d="M120 156 H240" stroke="${GOLD}" stroke-width="3"/>
<rect x="116" y="168" width="150" height="112" rx="8" fill="#fffdf5"/>
${tube(132, '#e5a117', 28)}${tube(155, '#2f9e5a', 40)}${tube(178, '#d1432a', 34)}${tube(201, '#2b6cb0', 44)}${tube(224, '#7a4fb0', 30)}
<rect x="126" y="228" width="130" height="3" rx="1.5" fill="${p.tone}" opacity=".35"/>
${fit(p.badge, 191, 252, 124, 20, d)}
${fit(p.sub.toUpperCase(), 191, 270, 124, 9, '#6b7a70', { weight: 700, spacing: 0.8 })}
${fit('IN-FIELD SOIL TESTING KIT', 191, 304, 150, 9.5, '#ffffff', { weight: 700, spacing: 1 })}
<circle cx="276" cy="124" r="22" fill="${GOLD}" stroke="#fff" stroke-width="3"/>
${fit(p.weight.replace(' tests', ''), 276, 129, 28, 14, FOREST)}`;
}

function packGroup(p: PackSpec) {
  switch (p.kind) {
    case 'bag':
      return bag(p);
    case 'bottle':
      return bottle(p);
    case 'pouch':
      return pouch(p);
    case 'tub':
      return tub(p);
    case 'box':
      return box(p);
  }
}

const specOf = (p: SeedProduct): PackSpec => ({
  kind: p.pack,
  tone: p.tone,
  badge: p.badge,
  sub: p.sub,
  brand: p.brand,
  weight: p.packs[p.packs.length - 1][0],
});

// ───────────────────────── Scenes ─────────────────────────

const SHADOW_FILTER = `<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#0b2415" flood-opacity=".22"/></filter>`;

function productSvg(p: PackSpec, variant: number) {
  const tint = shade(p.tone, 0.42);
  const bgs = [
    ['#fbfbf6', '#e9eddc'],
    ['#f6f8ec', shade(tint, 0.1)],
    [shade(tint, 0.18), shade(tint, -0.02)],
  ];
  const [b1, b2] = bgs[variant % 3];
  const scale = variant === 0 ? 1 : variant === 1 ? 0.84 : p.kind === 'pouch' ? 1.12 : 1.3;
  const tx = variant === 2 ? -4 : 0;
  const ty = variant === 2 ? (p.kind === 'pouch' ? 14 : 30) : 0;
  const rot = variant === 1 ? -4 : 0;
  const extras =
    variant === 1
      ? `<path d="M0 330 Q100 292 200 318 T400 306 V400 H0Z" fill="#c9dcb4" opacity=".7"/><path d="M0 352 Q120 322 240 344 T400 334 V400 H0Z" fill="#a9c98e" opacity=".75"/>${sprout(60, 358, 1.3)}${sprout(336, 362, 1.5)}${sprout(310, 372, 1)}`
      : variant === 2
        ? `<circle cx="340" cy="60" r="110" fill="#fff" opacity=".25"/>`
        : `<circle cx="330" cy="70" r="100" fill="#fff" opacity=".5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800">
<defs><radialGradient id="bg" cx="50%" cy="38%" r="80%"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></radialGradient>${SHADOW_FILTER}</defs>
<rect width="400" height="400" fill="url(#bg)"/>${extras}
<ellipse cx="200" cy="${variant === 2 ? 392 : 350}" rx="${variant === 2 ? 190 : 118}" ry="12" fill="#0b2415" opacity=".1"/>
<g filter="url(#sh)" transform="translate(${200 + tx} ${200 + ty}) rotate(${rot}) scale(${scale}) translate(-200 -200)">${packGroup(p)}</g>
</svg>`;
}

const CATEGORY_BADGE: Record<string, string> = { Nitrogen: 'N', 'DAP, SSP & Potash': 'P · K', 'NPK Complex': 'NPK', 'Water Soluble': 'SOLUBLE', Micronutrients: 'Zn · B · Fe', 'Organic & Bio': 'ORGANIC', 'Growth Boosters': 'BOOST', 'Soil Care': 'SOIL' };

function categorySvg(kind: PackKind, tint: string, tone: string, name: string) {
  const spec: PackSpec = { kind, tone, badge: CATEGORY_BADGE[name] ?? name.toUpperCase(), sub: name, brand: 'Verdant', weight: kind === 'bottle' ? '1 L' : '25 kg' };
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="600" height="600">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(tint, 0.06)}"/><stop offset="1" stop-color="${shade(tint, -0.08)}"/></linearGradient>${SHADOW_FILTER}</defs>
<rect width="400" height="400" fill="url(#bg)"/><circle cx="335" cy="64" r="96" fill="#fff" opacity=".35"/><circle cx="50" cy="360" r="80" fill="#fff" opacity=".25"/>
${sprout(70, 350, 1.4)}${sprout(340, 358, 1.2)}
<g filter="url(#sh)" transform="translate(200 206) scale(1.04) translate(-200 -200)">${packGroup(spec)}</g></svg>`;
}

// ───────────────────────── Crop icons ─────────────────────────

function cropIcon(name: string) {
  const stem = (d: string, w = 7, c = '#3f8f56') => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  const ell = (cx: number, cy: number, rx: number, ry: number, rot: number, fill: string, stroke = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${cx} ${cy})" fill="${fill}" ${stroke}/>`;
  switch (name) {
    case 'paddy': {
      const pts = [[240, 112], [262, 118], [281, 130], [296, 148], [305, 170], [226, 128], [246, 138], [264, 152], [276, 172], [212, 148], [228, 162], [242, 178]];
      return `${stem('M170 350 C170 250 180 170 232 118 C268 84 316 100 318 160', 7, '#5a8f3c')}${stem('M170 350 C120 300 90 250 70 210', 5, '#6fb04a')}${stem('M176 340 C230 300 262 270 296 240', 5, '#6fb04a')}${pts.map(([x, y], i) => ell(x, y, 8, 17, 30 + i * 8, i % 2 ? '#d9b53a' : '#e8c95a')).join('')}`;
    }
    case 'wheat': {
      const rows = Array.from({ length: 8 }, (_, i) => `${ell(184, 150 + i * 24, 9, 19, -28, i % 2 ? '#d6a93a' : '#e3bc52')}${ell(216, 150 + i * 24, 9, 19, 28, i % 2 ? '#e3bc52' : '#d6a93a')}`).join('');
      const awns = Array.from({ length: 7 }, (_, i) => `<path d="M${184 - 6} ${140 + i * 24} L${150} ${96 + i * 24}M${216 + 6} ${140 + i * 24} L${250} ${96 + i * 24}" stroke="#c99a2a" stroke-width="2.4"/>`).join('');
      return `${stem('M200 352 L200 190', 6, '#6a9a3c')}${awns}${rows}${ell(200, 116, 9, 20, 0, '#e3bc52')}<path d="M200 96 L200 50" stroke="#c99a2a" stroke-width="2.4"/>${stem('M200 340 C160 310 130 290 104 250', 5, '#6fb04a')}`;
    }
    case 'cotton':
      return `${stem('M200 360 L200 250', 7, '#4f8a3a')}<path d="M130 240 L162 214 L178 176 L200 206 L222 176 L238 214 L270 240 L226 262 L200 252 L174 262Z" fill="#7a5230"/><circle cx="168" cy="190" r="42" fill="#fff" stroke="#dfe6ee" stroke-width="3"/><circle cx="232" cy="190" r="42" fill="#fff" stroke="#dfe6ee" stroke-width="3"/><circle cx="200" cy="148" r="42" fill="#fff" stroke="#dfe6ee" stroke-width="3"/><circle cx="200" cy="206" r="40" fill="#fff" stroke="#dfe6ee" stroke-width="3"/>${leaf(200, 330, 1.1, -55, '#5a9a45')}${leaf(200, 318, 1, 60, '#4a8a3a')}`;
    case 'maize': {
      const kernels = Array.from({ length: 9 }, (_, r) => Array.from({ length: 5 }, (_, c) => `<circle cx="${178 + c * 11}" cy="${94 + r * 20}" r="5.5" fill="${(r + c) % 2 ? '#f4c430' : '#e8b520'}"/>`).join('')).join('');
      return `<path d="M150 360 C100 280 110 200 170 120 C150 200 160 290 200 360Z" fill="#6fb04a"/><path d="M250 360 C300 280 290 200 230 120 C250 200 240 290 200 360Z" fill="#5a9a3c"/><rect x="164" y="76" width="72" height="200" rx="34" fill="#f4c430"/>${kernels}<path d="M190 70 C196 40 214 36 222 22" stroke="#c9a15a" stroke-width="4" fill="none"/>`;
    }
    case 'sugarcane': {
      const cane = (x: number, rot: number, c: string) => {
        const nodes = Array.from({ length: 7 }, (_, i) => `<rect x="-11" y="${-i * 44}" width="22" height="5" rx="2" fill="${shade(c, -0.18)}"/>`).join('');
        return `<g transform="translate(${x} 360) rotate(${rot})"><rect x="-10" y="-300" width="20" height="300" rx="9" fill="${c}"/>${nodes}</g>`;
      };
      return `${cane(150, -6, '#8a9a4a')}${cane(250, 6, '#7f4f7a')}${cane(200, 0, '#6a9a3a')}${leaf(200, 66, 1.5, -40, '#4f8a3a')}${leaf(200, 66, 1.5, 40, '#4f8a3a')}${leaf(200, 70, 1.3, 0, '#5a9a45')}`;
    }
    case 'vegetables':
      return `<circle cx="162" cy="238" r="76" fill="#d93a2a"/><path d="M162 164 L146 186 L120 178 L140 198 L128 220 L162 208 L196 220 L184 198 L204 178 L178 186Z" fill="#3f8f3f" transform="translate(0 -12)"/><path d="M290 150 C330 170 336 280 262 336 C272 280 270 200 290 150Z" fill="#e0412f"/><path d="M290 150 C292 128 306 118 322 120" stroke="#3f8f3f" stroke-width="9" fill="none" stroke-linecap="round"/><ellipse cx="146" cy="214" rx="14" ry="24" transform="rotate(30 146 214)" fill="#fff" opacity=".25"/>`;
    case 'fruits':
      return `<path d="M120 230 C110 150 190 110 250 140 C320 176 300 290 220 318 C160 338 126 290 120 230Z" fill="#f2a31b"/><path d="M120 230 C110 150 190 110 250 140 C200 150 150 190 140 270 C128 262 122 248 120 230Z" fill="#e8851a" opacity=".6"/><path d="M236 126 C240 100 262 86 286 88" stroke="#5a8a3a" stroke-width="7" fill="none" stroke-linecap="round"/>${leaf(262, 98, 1.6, 62, '#3f8f3f')}<ellipse cx="170" cy="190" rx="14" ry="30" transform="rotate(35 170 190)" fill="#fff" opacity=".28"/>`;
    case 'pulses': {
      const pea = (cx: number, cy: number) => `<circle cx="${cx}" cy="${cy}" r="26" fill="#7cc04a" stroke="#5aa03a" stroke-width="3"/><circle cx="${cx - 7}" cy="${cy - 8}" r="7" fill="#fff" opacity=".3"/>`;
      return `<path d="M70 250 C70 130 250 90 340 160 C340 260 160 330 70 250Z" fill="#4f9a3a"/><path d="M96 240 C100 150 240 124 316 170 C312 244 176 296 96 240Z" fill="#2f7d3a"/>${pea(146, 224)}${pea(204, 212)}${pea(262, 192)}${leaf(332, 160, 1.4, 50, '#4f9a3a')}`;
    }
    default:
      return '';
  }
}

function cropSvg(name: string, tint: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
<defs><radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${shade(tint, 0.05)}"/><stop offset="1" stop-color="${shade(tint, -0.07)}"/></radialGradient></defs>
<rect width="400" height="400" fill="url(#bg)"/><ellipse cx="200" cy="364" rx="120" ry="10" fill="#0b2415" opacity=".08"/>
<g transform="translate(200 210) scale(.82) translate(-200 -210)">${cropIcon(name)}</g></svg>`;
}

// ───────────────────────── Banners ─────────────────────────

const PALETTES = {
  sunrise: { sky: ['#0f2e1d', '#2d6a43', '#f0c25a'], sun: '#ffe9a8', hills: ['#2a6b44', '#1f5a39'], rows: ['#2f7d3a', '#276c32'], glow: '#ffdf8a' },
  field: { sky: ['#2a2417', '#8a4a22', '#f0b04a'], sun: '#ffe2a0', hills: ['#7a6a2e', '#5f5524'], rows: ['#c9a23a', '#b48f2c'], glow: '#ffd27a' },
  organic: { sky: ['#1f1a10', '#5a3d22', '#d9a05a'], sun: '#f6d79a', hills: ['#4d6a34', '#3d5a2a'], rows: ['#6a4a2a', '#5a3e22'], glow: '#f0c27a' },
} as const;

function bannerSvg(art: keyof typeof PALETTES, main: PackSpec, side: PackSpec) {
  const c = PALETTES[art];
  const rows = Array.from({ length: 22 }, (_, i) => {
    const a = (i - 11) * 190;
    const b = (i - 10) * 190;
    return `<polygon points="800,318 ${800 + a},640 ${800 + b},640" fill="${i % 2 ? c.rows[0] : c.rows[1]}"/>`;
  }).join('');
  const dots = Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 97) % 1600}" cy="${330 + ((i * 53) % 280)}" r="${1.5 + (i % 3)}" fill="#fff" opacity=".06"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 560" width="1600" height="560" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.sky[0]}"/><stop offset=".6" stop-color="${c.sky[1]}"/><stop offset="1" stop-color="${c.sky[2]}"/></linearGradient>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${c.glow}" stop-opacity=".85"/><stop offset="1" stop-color="${c.glow}" stop-opacity="0"/></radialGradient>
<linearGradient id="scrim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".55" stop-color="#000" stop-opacity="0"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#000" flood-opacity=".35"/></filter></defs>
<rect width="1600" height="560" fill="url(#sky)"/>
<g transform="translate(0 -40)">
<circle cx="1180" cy="300" r="300" fill="url(#glow)"/><circle cx="1180" cy="296" r="92" fill="${c.sun}"/>
<path d="M0 300 C200 240 360 250 560 282 C760 312 900 236 1100 258 C1300 280 1460 250 1600 270 V330 H0Z" fill="${c.hills[0]}" opacity=".85"/>
<path d="M0 316 C220 276 420 290 640 310 C860 330 1040 286 1240 300 C1400 310 1500 296 1600 304 V340 H0Z" fill="${c.hills[1]}"/>
<rect x="0" y="318" width="1600" height="322" fill="${c.rows[1]}"/>${rows}${dots}
</g>
<rect width="1600" height="560" fill="url(#scrim)"/>
<ellipse cx="1170" cy="526" rx="270" ry="16" fill="#000" opacity=".28"/>
<g filter="url(#sh)" transform="translate(${1250 - 200 * 1.08} ${524 - 342 * 1.08}) scale(1.08)">${packGroup(main)}</g>
<g filter="url(#sh)" transform="translate(${1030 - 200 * 0.84} ${528 - 344 * 0.84}) scale(.84)">${packGroup(side)}</g>
</svg>`;
}

// ───────────────────────── Output ─────────────────────────

function write(rel: string, content: string) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export function productImagePaths(p: SeedProduct): { images: string[]; byColor: Record<string, string> } {
  const s = slug(p.name);
  return { images: [1, 2, 3].map((n) => `/images/products/${s}-${n}.svg`), byColor: {} };
}

export function run() {
  for (const dir of ['products', 'categories', 'crops', 'banners']) fs.rmSync(path.join(OUT, dir), { recursive: true, force: true });
  let n = 0;
  for (const p of products) {
    const s = slug(p.name);
    [0, 1, 2].forEach((v) => write(`products/${s}-${v + 1}.svg`, productSvg(specOf(p), v)));
    n += 3;
  }
  for (const c of categories) write(`categories/${c.slug}.svg`, categorySvg(c.icon, c.tint, c.tone, c.name));
  for (const c of crops) write(`crops/${c.slug}.svg`, cropSvg(c.slug, c.tint));
  const bannerPacks: [PackSpec, PackSpec][] = [
    [
      { kind: 'bag', tone: '#2f7d3a', badge: '10:26:26', sub: 'Complex fertilizer', brand: 'TerraGro', weight: '50 kg' },
      { kind: 'bottle', tone: '#b07a0a', badge: 'SEAWEED', sub: 'Plant growth stimulant', brand: 'NutriCrop', weight: '1 L' },
    ],
    [
      { kind: 'bag', tone: '#b4532a', badge: '18-46-0', sub: 'Diammonium phosphate', brand: 'KisanGold', weight: '50 kg' },
      { kind: 'bag', tone: '#1f5fa8', badge: 'N 46%', sub: 'Neem-coated urea', brand: 'KisanGold', weight: '45 kg' },
    ],
    [
      { kind: 'bag', tone: '#7a5230', badge: 'ORGANIC', sub: 'Vermicompost', brand: 'BioHarvest', weight: '50 kg' },
      { kind: 'bottle', tone: '#5e8c3a', badge: 'RHIZOBIUM', sub: 'Nitrogen-fixing culture', brand: 'BioHarvest', weight: '1 L' },
    ],
  ];
  banners.forEach((b, i) => write(`banners/banner-${i + 1}.svg`, bannerSvg(b.art, bannerPacks[i][0], bannerPacks[i][1])));
  write('placeholder.svg', productSvg({ kind: 'bag', tone: '#8da08f', badge: 'PACK', sub: 'Coming soon', brand: 'Verdant', weight: '' }, 0));
  console.log(`✅ Generated ${n} product images, ${categories.length} categories, ${crops.length} crops, ${banners.length} banners → ${OUT}`);
}

if (require.main === module) run();
