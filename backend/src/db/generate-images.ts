/**
 * Generates lightweight SVG artwork for the demo catalog into frontend/public/images.
 * Images live in the frontend (served statically by Next.js); the database stores
 * only their paths. Replace these files with real photos any time — keep the paths
 * or update them from the admin panel.
 *
 *   npm run images -w backend
 */
import fs from 'fs';
import path from 'path';
import slugify from 'slugify';
import { banners, categories, COLORS, products, type Icon } from './seed-data';

const OUT = path.resolve(__dirname, '../../../frontend/public/images');
const slug = (s: string) => slugify(s, { lower: true, strict: true });

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = c(n >> 16),
    g = c((n >> 8) & 255),
    b = c(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 180;
};

/** Each icon is drawn in a 400×400 box, centred around (200, 200). */
function icon(kind: Icon, c: string): string {
  const d = shade(c, -0.18);
  const l = shade(c, 0.12);
  const stroke = isLight(c) ? `stroke="${shade(c, -0.35)}" stroke-width="3"` : '';
  switch (kind) {
    case 'tshirt':
      return `<path d="M140 95 L95 120 L60 175 L105 200 L120 180 L120 320 L280 320 L280 180 L295 200 L340 175 L305 120 L260 95 Q200 135 140 95Z" fill="${c}" ${stroke}/><path d="M160 98 Q200 125 240 98" fill="none" stroke="${d}" stroke-width="8"/>`;
    case 'hoodie':
      return `<path d="M145 105 L90 130 L58 250 L100 262 L120 200 L120 330 L280 330 L280 200 L300 262 L342 250 L310 130 L255 105Z" fill="${c}" ${stroke}/><path d="M150 108 Q200 40 250 108 Q200 160 150 108Z" fill="${d}"/><rect x="160" y="250" width="80" height="45" rx="10" fill="${d}"/><line x1="190" y1="130" x2="186" y2="185" stroke="${l}" stroke-width="4"/><line x1="210" y1="130" x2="214" y2="185" stroke="${l}" stroke-width="4"/>`;
    case 'dress':
      return `<path d="M170 80 L230 80 L240 150 L310 330 L90 330 L160 150Z" fill="${c}" ${stroke}/><path d="M160 150 L240 150 L236 168 L164 168Z" fill="${d}"/><path d="M170 80 L150 95 L160 150 M230 80 L250 95 L240 150" fill="none" stroke="${d}" stroke-width="6"/><circle cx="150" cy="260" r="10" fill="${l}"/><circle cx="230" cy="290" r="12" fill="${l}"/><circle cx="200" cy="215" r="9" fill="${l}"/>`;
    case 'jeans':
      return `<path d="M135 75 L265 75 L280 335 L215 335 L200 165 L185 335 L120 335Z" fill="${c}" ${stroke}/><rect x="135" y="75" width="130" height="22" fill="${d}"/><path d="M150 100 Q165 135 195 110 M250 100 Q235 135 205 110" fill="none" stroke="${l}" stroke-width="4"/>`;
    case 'sneaker':
      return `<path d="M70 250 L90 175 Q130 180 160 150 L210 150 Q240 215 330 225 Q350 230 345 265 L75 265Z" fill="${c}" ${stroke}/><rect x="70" y="262" width="278" height="22" rx="10" fill="${isLight(c) ? '#334155' : '#f8fafc'}"/><path d="M165 168 L185 200 M180 160 L205 192 M195 155 L222 187" stroke="${l}" stroke-width="6" stroke-linecap="round"/><path d="M95 230 Q200 230 300 240" stroke="${d}" stroke-width="5" fill="none"/>`;
    case 'watch':
      return `<rect x="165" y="70" width="70" height="70" rx="10" fill="${d}"/><rect x="165" y="260" width="70" height="70" rx="10" fill="${d}"/><circle cx="200" cy="200" r="80" fill="${c}" ${stroke}/><circle cx="200" cy="200" r="62" fill="#0f172a"/><line x1="200" y1="200" x2="200" y2="158" stroke="#fff" stroke-width="5" stroke-linecap="round"/><line x1="200" y1="200" x2="232" y2="210" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="200" cy="200" r="5" fill="${c}"/><rect x="278" y="190" width="14" height="20" rx="4" fill="${d}"/>`;
    case 'bag':
      return `<path d="M150 150 Q150 80 200 80 Q250 80 250 150" fill="none" stroke="${d}" stroke-width="14"/><path d="M95 150 L305 150 L325 330 L75 330Z" fill="${c}" ${stroke}/><rect x="95" y="150" width="210" height="26" fill="${d}"/><rect x="185" y="190" width="30" height="12" rx="4" fill="${l}"/>`;
    case 'backpack':
      return `<rect x="110" y="95" width="180" height="240" rx="50" fill="${c}" ${stroke}/><path d="M160 95 Q160 60 200 60 Q240 60 240 95" fill="none" stroke="${d}" stroke-width="12"/><rect x="135" y="215" width="130" height="95" rx="20" fill="${d}"/><line x1="150" y1="240" x2="250" y2="240" stroke="${l}" stroke-width="5"/><circle cx="200" cy="150" r="10" fill="${l}"/>`;
    case 'sunglasses':
      return `<path d="M60 175 L340 175" stroke="${c}" stroke-width="12"/><path d="M75 175 Q75 255 140 255 Q190 255 190 190 L190 175Z" fill="#0f172a" stroke="${c}" stroke-width="10"/><path d="M325 175 Q325 255 260 255 Q210 255 210 190 L210 175Z" fill="#0f172a" stroke="${c}" stroke-width="10"/><path d="M105 195 Q120 185 140 192" stroke="#64748b" stroke-width="5" fill="none"/><path d="M235 195 Q250 185 270 192" stroke="#64748b" stroke-width="5" fill="none"/>`;
    case 'phone':
      return `<rect x="130" y="55" width="140" height="290" rx="26" fill="${c}" ${stroke}/><rect x="141" y="68" width="118" height="264" rx="18" fill="#0f172a"/><rect x="141" y="68" width="118" height="264" rx="18" fill="url(#screen)"/><rect x="180" y="76" width="40" height="9" rx="4.5" fill="#0f172a"/><circle cx="200" cy="200" r="34" fill="none" stroke="#ffffff55" stroke-width="3"/>`;
    case 'headphones':
      return `<path d="M100 230 Q100 90 200 90 Q300 90 300 230" fill="none" stroke="${c}" stroke-width="22" stroke-linecap="round" ${''}/><rect x="72" y="205" width="66" height="110" rx="30" fill="${c}" ${stroke}/><rect x="262" y="205" width="66" height="110" rx="30" fill="${c}" ${stroke}/><rect x="120" y="215" width="22" height="90" rx="10" fill="${d}"/><rect x="258" y="215" width="22" height="90" rx="10" fill="${d}"/>`;
    case 'earbuds':
      return `<rect x="110" y="215" width="180" height="110" rx="45" fill="${c}" ${stroke}/><line x1="110" y1="255" x2="290" y2="255" stroke="${d}" stroke-width="4"/><circle cx="200" cy="295" r="6" fill="#22c55e"/><g transform="translate(150 120) rotate(-15)"><circle r="32" fill="${c}" ${stroke}/><rect x="-10" y="20" width="20" height="60" rx="10" fill="${c}" ${stroke}/><circle r="14" fill="${d}"/></g><g transform="translate(250 120) rotate(15)"><circle r="32" fill="${c}" ${stroke}/><rect x="-10" y="20" width="20" height="60" rx="10" fill="${c}" ${stroke}/><circle r="14" fill="${d}"/></g>`;
    case 'laptop':
      return `<rect x="95" y="95" width="210" height="145" rx="12" fill="${c}" ${stroke}/><rect x="107" y="107" width="186" height="121" rx="6" fill="url(#screen)"/><path d="M60 250 L340 250 L322 285 L78 285Z" fill="${d}"/><rect x="170" y="252" width="60" height="8" rx="4" fill="${l}"/>`;
    case 'smartwatch':
      return `<rect x="168" y="62" width="64" height="80" rx="12" fill="${d}"/><rect x="168" y="258" width="64" height="80" rx="12" fill="${d}"/><rect x="132" y="128" width="136" height="144" rx="36" fill="${c}" ${stroke}/><rect x="146" y="142" width="108" height="116" rx="26" fill="#0f172a"/><text x="200" y="200" font-family="Arial" font-size="28" font-weight="700" fill="#fff" text-anchor="middle">10:09</text><path d="M168 228 L182 228 L188 214 L198 240 L206 222 L232 222" stroke="#22c55e" stroke-width="4" fill="none"/><rect x="268" y="175" width="10" height="30" rx="4" fill="${d}"/>`;
    case 'speaker':
      return `<rect x="85" y="140" width="230" height="140" rx="70" fill="${c}" ${stroke}/><circle cx="150" cy="210" r="42" fill="${d}"/><circle cx="150" cy="210" r="18" fill="${l}"/><circle cx="250" cy="210" r="42" fill="${d}"/><circle cx="250" cy="210" r="18" fill="${l}"/><rect x="170" y="128" width="60" height="16" rx="8" fill="${d}"/>`;
    case 'mug':
      return `<path d="M260 160 Q330 160 330 215 Q330 265 260 265" fill="none" stroke="${c}" stroke-width="22"/><path d="M100 120 L270 120 L258 310 Q256 325 240 325 L130 325 Q114 325 112 310Z" fill="${c}" ${stroke}/><ellipse cx="185" cy="120" rx="85" ry="15" fill="${d}"/><path d="M160 90 Q150 70 165 55 M195 90 Q185 65 200 48 M230 90 Q220 70 235 55" stroke="#94a3b8" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    case 'lamp':
      return `<path d="M150 335 L250 335" stroke="${d}" stroke-width="16" stroke-linecap="round"/><path d="M200 335 L200 160 Q200 85 280 95" fill="none" stroke="${c}" stroke-width="10"/><path d="M235 100 L325 100 L345 165 L215 165Z" fill="${c}" ${stroke}/><ellipse cx="280" cy="172" rx="40" ry="10" fill="#fde68a"/><path d="M250 185 L225 260 M280 185 L280 270 M310 185 L335 260" stroke="#fde68a88" stroke-width="5"/>`;
    case 'pan':
      return `<ellipse cx="170" cy="215" rx="115" ry="105" fill="${d}"/><ellipse cx="170" cy="210" rx="98" ry="88" fill="#334155"/><ellipse cx="150" cy="190" rx="40" ry="22" fill="#47556988"/><rect x="270" y="196" width="110" height="26" rx="13" fill="#111827" transform="rotate(-12 270 209)"/>`;
    case 'bottle':
      return `<rect x="170" y="55" width="60" height="40" rx="8" fill="${d}"/><rect x="178" y="88" width="44" height="20" fill="${d}"/><rect x="140" y="105" width="120" height="240" rx="38" fill="${c}" ${stroke}/><rect x="140" y="185" width="120" height="80" fill="${l}"/><rect x="160" y="205" width="80" height="10" rx="5" fill="${d}"/><rect x="170" y="225" width="60" height="8" rx="4" fill="${d}"/>`;
    case 'jar':
      return `<rect x="110" y="140" width="180" height="180" rx="40" fill="${c}" ${stroke}/><rect x="100" y="105" width="200" height="55" rx="18" fill="${d}"/><rect x="140" y="200" width="120" height="70" rx="12" fill="${l}"/><rect x="160" y="222" width="80" height="10" rx="5" fill="${d}"/><rect x="172" y="242" width="56" height="8" rx="4" fill="${d}"/>`;
    case 'dumbbell':
      return `<rect x="110" y="190" width="180" height="22" rx="6" fill="#64748b"/><rect x="70" y="130" width="40" height="142" rx="12" fill="${c}" ${stroke}/><rect x="40" y="155" width="34" height="92" rx="10" fill="${d}"/><rect x="290" y="130" width="40" height="142" rx="12" fill="${c}" ${stroke}/><rect x="326" y="155" width="34" height="92" rx="10" fill="${d}"/>`;
    case 'yogamat':
      return `<rect x="80" y="230" width="250" height="70" rx="10" fill="${c}" ${stroke}/><circle cx="310" cy="210" r="70" fill="${c}" ${stroke}/><circle cx="310" cy="210" r="48" fill="${d}"/><circle cx="310" cy="210" r="26" fill="${c}"/><line x1="100" y1="265" x2="240" y2="265" stroke="${l}" stroke-width="4" stroke-dasharray="10 8"/>`;
    case 'plant':
      return `<path d="M200 220 Q140 200 120 120 Q190 130 200 220 Q205 110 265 90 Q270 180 200 220 Q230 160 300 165 Q280 225 200 225" fill="#16a34a"/><path d="M200 225 L200 140" stroke="#15803d" stroke-width="5"/><path d="M130 225 L270 225 L250 335 L150 335Z" fill="${c}" ${stroke}/><rect x="125" y="218" width="150" height="22" rx="8" fill="${d}"/>`;
    case 'cushion':
      return `<path d="M95 105 Q200 80 305 105 Q330 200 305 295 Q200 320 95 295 Q70 200 95 105Z" fill="${c}" ${stroke}/><path d="M120 140 Q200 125 280 140 M115 200 Q200 185 285 200 M120 260 Q200 245 280 260" stroke="${d}" stroke-width="7" fill="none"/>`;
  }
}

function productSvg(kind: Icon, color: string, variant: number, label: string) {
  const bgs = [
    ['#f8fafc', '#e2e8f0'],
    ['#fdf4ff', '#f5d0fe'],
    ['#ecfeff', '#cffafe'],
    ['#fefce8', '#fef08a'],
  ];
  const [b1, b2] = bgs[variant % bgs.length];
  const scale = variant === 0 ? 1 : variant === 1 ? 0.82 : 1.12;
  const rot = variant === 2 ? -8 : variant === 1 ? 6 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800">
<defs><radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></radialGradient>
<linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset=".5" stop-color="#ec4899"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#0f172a" flood-opacity=".18"/></filter></defs>
<rect width="400" height="400" fill="url(#bg)"/>
<ellipse cx="200" cy="352" rx="120" ry="12" fill="#0f172a" opacity=".08"/>
<g filter="url(#sh)" transform="translate(200 200) rotate(${rot}) scale(${scale}) translate(-200 -200)">${icon(kind, color)}</g>
<text x="20" y="384" font-family="Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="2" fill="#0f172a" opacity=".35">${label.toUpperCase()}</text>
</svg>`;
}

function categorySvg(kind: Icon, tint: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="600" height="600">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tint}"/><stop offset="1" stop-color="${shade(tint, -0.12)}"/></linearGradient>
<linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6366f1"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs>
<rect width="400" height="400" fill="url(#bg)"/><circle cx="330" cy="70" r="90" fill="#ffffff" opacity=".25"/><circle cx="60" cy="350" r="70" fill="#ffffff" opacity=".2"/>
<g transform="translate(200 210) scale(.85) translate(-200 -200)">${icon(kind, shade(tint, -0.45))}</g></svg>`;
}

function bannerSvg(title: string, subtitle: string, palette: string[], icons: Icon[]) {
  const [a, b, c] = palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 640" width="1600" height="640" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".65" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
<linearGradient id="screen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs>
<rect width="1600" height="640" fill="url(#bg)"/>
<circle cx="1300" cy="320" r="300" fill="#ffffff" opacity=".08"/><circle cx="1350" cy="300" r="200" fill="#ffffff" opacity=".08"/>
<circle cx="120" cy="560" r="160" fill="#ffffff" opacity=".05"/>
<g transform="translate(1000 140) scale(.9)">${icon(icons[0], '#f8fafc')}</g>
<g transform="translate(1250 260) scale(.7)">${icon(icons[1], c)}</g>
<!-- ${title} — ${subtitle} -->
</svg>`;
}

function write(rel: string, content: string) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export function productImagePaths(p: (typeof products)[number]): { images: string[]; byColor: Record<string, string> } {
  const s = slug(p.name);
  const colors = p.colors ?? [];
  const byColor: Record<string, string> = {};
  const images: string[] = [];
  if (colors.length) {
    colors.forEach((c) => {
      const f = `/images/products/${s}-${slug(c)}.svg`;
      byColor[c] = f;
      images.push(f);
    });
    images.push(`/images/products/${s}-detail.svg`);
  } else {
    images.push(`/images/products/${s}-1.svg`, `/images/products/${s}-2.svg`, `/images/products/${s}-3.svg`);
  }
  return { images, byColor };
}

export function run() {
  let n = 0;
  for (const p of products) {
    const s = slug(p.name);
    const colors = p.colors ?? [];
    if (colors.length) {
      colors.forEach((c) => write(`products/${s}-${slug(c)}.svg`, productSvg(p.icon, COLORS[c] ?? '#64748b', 0, p.brand)));
      write(`products/${s}-detail.svg`, productSvg(p.icon, COLORS[colors[0]] ?? '#64748b', 2, p.brand));
      n += colors.length + 1;
    } else {
      const base = categories.find((c) => c.slug === p.category)?.tint ?? '#94a3b8';
      [0, 1, 2].forEach((v) => write(`products/${s}-${v + 1}.svg`, productSvg(p.icon, shade(base, -0.4), v, p.brand)));
      n += 3;
    }
  }
  for (const c of categories) write(`categories/${c.slug}.svg`, categorySvg(c.icon, c.tint));
  const bannerIcons: Icon[][] = [
    ['dress', 'sneaker'],
    ['laptop', 'headphones'],
    ['lamp', 'mug'],
  ];
  banners.forEach((b, i) => write(`banners/banner-${i + 1}.svg`, bannerSvg(b.title, b.subtitle, b.palette, bannerIcons[i])));
  write('placeholder.svg', productSvg('bag', '#94a3b8', 0, ''));
  console.log(`✅ Generated ${n} product images, ${categories.length} category images, ${banners.length} banners → ${OUT}`);
}

if (require.main === module) run();
