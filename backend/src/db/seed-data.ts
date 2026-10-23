/*
 * Demo catalog used by the seed script and the image generator (fertilizer & crop-nutrition skin).
 * Prices are in rupees; each product lists its pack sizes as [label, price, MRP].
 * Brand names are fictional — replace them with the brands you actually stock.
 */

export type PackKind = 'bag' | 'bottle' | 'pouch' | 'tub' | 'box';

export interface SeedCategory {
  name: string;
  slug: string;
  parent?: string;
  description: string;
  icon: PackKind;
  /** Pastel backdrop for category art */
  tint: string;
  /** Pack colour drawn on the backdrop */
  tone: string;
  featured?: boolean;
}

export const categories: SeedCategory[] = [
  { name: 'Nitrogen', slug: 'nitrogen', description: 'Urea, CAN, ammonium sulphate and liquid nitrogen for leafy growth.', icon: 'bag', tint: '#dbe8f7', tone: '#1f5fa8', featured: true },
  { name: 'DAP, SSP & Potash', slug: 'phosphatic-potassic', description: 'Phosphatic and potassic fertilizers for roots, flowering and fruit quality.', icon: 'bag', tint: '#f6e0d3', tone: '#b4532a', featured: true },
  { name: 'NPK Complex', slug: 'npk-complex', description: 'Balanced granular complex fertilizers for basal and top dressing.', icon: 'bag', tint: '#dcefd9', tone: '#2f7d3a', featured: true },
  { name: 'Water Soluble', slug: 'water-soluble', description: '100% soluble grades for drip irrigation, fertigation and foliar sprays.', icon: 'pouch', tint: '#d6efee', tone: '#0e8a8a', featured: true },
  { name: 'Micronutrients', slug: 'micronutrients', description: 'Zinc, boron, iron, magnesium and chelated mixes to fix hidden hunger.', icon: 'pouch', tint: '#e8dff3', tone: '#7a4fb0', featured: true },
  { name: 'Organic & Bio', slug: 'organic-bio', description: 'Vermicompost, neem cake, manure and bio-fertilizer cultures.', icon: 'bag', tint: '#eadfce', tone: '#7a5230', featured: true },
  { name: 'Growth Boosters', slug: 'growth-boosters', description: 'Seaweed, humic and amino-acid boosters for vigour and fruit set.', icon: 'bottle', tint: '#f7ebc4', tone: '#b07a0a', featured: true },
  { name: 'Soil Care', slug: 'soil-care', description: 'Gypsum, lime and test kits to fix soil structure and pH.', icon: 'tub', tint: '#e5e7da', tone: '#5b6b4e', featured: true },
];

export const brands = ['TerraGro', 'NutriCrop', 'AgroPlus', 'KisanGold', 'BioHarvest', 'GreenLeaf Labs', 'CropMax', 'Vasundhara'];

export interface SeedProduct {
  name: string;
  category: string;
  brand: string;
  /** Packaging drawn in the product art */
  pack: PackKind;
  /** Label colour of the pack */
  tone: string;
  /** Big text on the pack, e.g. "19:19:19" */
  badge: string;
  /** Small line on the pack, e.g. "Water soluble NPK" */
  sub: string;
  /** [pack size, price ₹, MRP ₹] — first entry is the entry-level pack shown in listings */
  packs: [string, number, number][];
  short: string;
  description: string;
  specs: [string, string][];
  tags: string[];
  featured?: boolean;
  newArrival?: boolean;
  dealHours?: number;
  taxRate?: number;
  // Derived below
  price: number;
  mrp: number;
  cost: number;
}

type Raw = Omit<SeedProduct, 'price' | 'mrp' | 'cost'>;

const raw: Raw[] = [
  // ── Nitrogen
  {
    name: 'Neem-Coated Urea (46% N)', category: 'nitrogen', brand: 'KisanGold', pack: 'bag', tone: '#1f5fa8', badge: 'N 46%', sub: 'Neem-coated urea',
    packs: [['5 kg', 62, 80], ['10 kg', 118, 150], ['45 kg', 266, 270]],
    short: 'Slow-release neem-coated urea for paddy, wheat, maize and sugarcane.',
    description: 'Neem-coated prilled urea with 46% nitrogen. The neem coat slows nitrification, so more nitrogen reaches the crop and less is lost to leaching and air. Use as a top dressing in 2–3 splits instead of one heavy dose.',
    specs: [['Nutrient', 'Nitrogen (N) 46%'], ['Form', 'Neem-coated prills'], ['Best for', 'Paddy, wheat, maize, sugarcane, vegetables'], ['Typical dose', '90–120 kg/acre in 2–3 splits (follow soil-test advice)'], ['Shelf life', '24 months']],
    tags: ['urea', 'nitrogen', 'paddy', 'wheat'], featured: true, taxRate: 5,
  },
  {
    name: 'Ammonium Sulphate (20.6% N + 24% S)', category: 'nitrogen', brand: 'TerraGro', pack: 'bag', tone: '#2b6cb0', badge: 'N 20.6 · S 24', sub: 'Nitrogen + sulphur',
    packs: [['5 kg', 140, 190], ['25 kg', 640, 800], ['50 kg', 1180, 1500]],
    short: 'Nitrogen plus sulphur in one bag, ideal for paddy, groundnut, mustard and tea.',
    description: 'A fast-acting source of nitrogen with 24% sulphur, which oilseeds and pulses need for protein and oil formation. The acidifying effect also suits alkaline soils.',
    specs: [['Nutrient', 'N 20.6%, S 24%'], ['Form', 'Crystalline granules'], ['Best for', 'Paddy, groundnut, mustard, cotton, tea'], ['Typical dose', '40–60 kg/acre'], ['Shelf life', '36 months']],
    tags: ['ammonium sulphate', 'sulphur', 'nitrogen'], taxRate: 5,
  },
  {
    name: 'Calcium Ammonium Nitrate (CAN 25% N)', category: 'nitrogen', brand: 'AgroPlus', pack: 'bag', tone: '#3b7bb8', badge: 'N 25%', sub: 'Calcium ammonium nitrate',
    packs: [['5 kg', 135, 180], ['25 kg', 640, 820]],
    short: 'Non-acidifying nitrogen with calcium for vegetables, fruits and cotton.',
    description: 'Half nitrate, half ammonium nitrogen with a calcium carrier, so it works fast without souring the soil. A good choice for vegetables and fruit crops on acidic soils.',
    specs: [['Nutrient', 'N 25% (with calcium)'], ['Form', 'Free-flowing granules'], ['Best for', 'Vegetables, fruits, cotton, potato'], ['Typical dose', '40–60 kg/acre'], ['Shelf life', '24 months']],
    tags: ['can', 'calcium', 'nitrogen'], taxRate: 5,
  },
  {
    name: 'Liquid Nano Nitrogen (4% N)', category: 'nitrogen', brand: 'NutriCrop', pack: 'bottle', tone: '#2a8bd0', badge: 'N 4%', sub: 'Nano liquid nitrogen',
    packs: [['250 ml', 125, 135], ['500 ml', 225, 240]],
    short: 'Foliar nano nitrogen spray for paddy, wheat, maize and vegetables.',
    description: 'A nano-sized nitrogen formulation applied as a foliar spray at tillering and pre-flowering. Cuts the number of urea bags needed and is easy to carry to the field.',
    specs: [['Nutrient', 'Nitrogen 4% w/w (nano)'], ['Form', 'Liquid'], ['Best for', 'Paddy, wheat, maize, vegetables'], ['Dose', '2–4 ml per litre of water, two sprays'], ['Shelf life', '24 months']],
    tags: ['nano', 'liquid', 'foliar'], newArrival: true, dealHours: 30, taxRate: 5,
  },

  // ── DAP, SSP & Potash
  {
    name: 'DAP (18-46-0) Diammonium Phosphate', category: 'phosphatic-potassic', brand: 'KisanGold', pack: 'bag', tone: '#b4532a', badge: '18-46-0', sub: 'Diammonium phosphate',
    packs: [['5 kg', 150, 175], ['25 kg', 700, 760], ['50 kg', 1350, 1350]],
    short: 'Basal phosphorus and nitrogen for paddy, wheat, cotton, pulses and vegetables.',
    description: 'The standard basal fertilizer for sowing. 46% phosphate drives early root growth and tillering while 18% nitrogen gives seedlings a quick start. Place near the seed row or mix into the soil before sowing.',
    specs: [['Nutrient', 'N 18%, P₂O₅ 46%'], ['Form', 'Dark granules'], ['Best for', 'Paddy, wheat, cotton, pulses, vegetables'], ['Typical dose', '40–50 kg/acre as basal dose'], ['Shelf life', '24 months']],
    tags: ['dap', 'phosphorus', 'basal'], featured: true, taxRate: 5,
  },
  {
    name: 'Single Super Phosphate (16% P₂O₅)', category: 'phosphatic-potassic', brand: 'Vasundhara', pack: 'bag', tone: '#c26a3a', badge: 'P 16%', sub: 'SSP · with S & Ca',
    packs: [['10 kg', 135, 180], ['50 kg', 520, 640]],
    short: 'Phosphorus with sulphur and calcium for groundnut, soybean, pulses and paddy.',
    description: 'Provides 16% phosphate along with 11% sulphur and 19% calcium, making it a favourite for oilseeds and legumes. Best mixed into the soil before sowing.',
    specs: [['Nutrient', 'P₂O₅ 16%, S 11%, Ca 19%'], ['Form', 'Granular'], ['Best for', 'Groundnut, soybean, pulses, paddy'], ['Typical dose', '100–150 kg/acre basal'], ['Shelf life', '24 months']],
    tags: ['ssp', 'phosphate', 'sulphur'], taxRate: 5,
  },
  {
    name: 'Muriate of Potash MOP (60% K₂O)', category: 'phosphatic-potassic', brand: 'AgroPlus', pack: 'bag', tone: '#a43f5a', badge: 'K 60%', sub: 'Muriate of potash',
    packs: [['5 kg', 125, 160], ['25 kg', 575, 700], ['50 kg', 1100, 1300]],
    short: 'Potash for sugarcane, banana, potato, paddy and fruit crops.',
    description: 'The most economical source of potassium. Improves grain filling, sugar content, fruit size and resistance to lodging and drought.',
    specs: [['Nutrient', 'K₂O 60%'], ['Form', 'Red granules'], ['Best for', 'Sugarcane, banana, potato, paddy, fruits'], ['Typical dose', '20–40 kg/acre'], ['Shelf life', '36 months']],
    tags: ['mop', 'potash', 'potassium'], taxRate: 5,
  },
  {
    name: 'Sulphate of Potash SOP (50% K₂O + 18% S)', category: 'phosphatic-potassic', brand: 'CropMax', pack: 'bag', tone: '#c04d6f', badge: 'K 50 · S 18', sub: 'Chloride-free potash',
    packs: [['1 kg', 75, 110], ['5 kg', 340, 450], ['25 kg', 1550, 1950]],
    short: 'Chloride-free potash for chilli, tomato, grapes, mango and other fruits.',
    description: 'Premium potassium for chloride-sensitive crops such as chilli, tobacco, grapes and potato. The sulphur improves flavour, colour and shelf life of produce.',
    specs: [['Nutrient', 'K₂O 50%, S 18%'], ['Form', 'Fine granules'], ['Best for', 'Chilli, tomato, grapes, mango, potato'], ['Typical dose', '15–30 kg/acre'], ['Shelf life', '36 months']],
    tags: ['sop', 'potash', 'chloride free'], newArrival: true, taxRate: 5,
  },

  // ── NPK Complex
  {
    name: 'NPK 10:26:26 Complex Fertilizer', category: 'npk-complex', brand: 'TerraGro', pack: 'bag', tone: '#2f7d3a', badge: '10:26:26', sub: 'Complex fertilizer',
    packs: [['5 kg', 165, 210], ['25 kg', 780, 950], ['50 kg', 1470, 1750]],
    short: 'High phosphorus and potash complex for cotton, groundnut, chilli and vegetables.',
    description: 'A balanced granular complex that feeds all three primary nutrients in every granule. The high P and K ratio suits root, flower and fruit development.',
    specs: [['Nutrient', 'N 10%, P₂O₅ 26%, K₂O 26%'], ['Form', 'Granular'], ['Best for', 'Cotton, groundnut, chilli, vegetables, fruits'], ['Typical dose', '50–75 kg/acre basal'], ['Shelf life', '24 months']],
    tags: ['npk', 'complex', '10-26-26'], featured: true, taxRate: 5,
  },
  {
    name: 'NPK 12:32:16 Complex Fertilizer', category: 'npk-complex', brand: 'NutriCrop', pack: 'bag', tone: '#3a8a45', badge: '12:32:16', sub: 'Complex fertilizer',
    packs: [['5 kg', 160, 205], ['25 kg', 760, 920], ['50 kg', 1430, 1700]],
    short: 'Phosphorus-rich starter complex for paddy, maize, wheat and sugarcane.',
    description: 'A strong starter blend: high phosphorus for rooting and tillering, with enough nitrogen and potash to carry the crop through early growth.',
    specs: [['Nutrient', 'N 12%, P₂O₅ 32%, K₂O 16%'], ['Form', 'Granular'], ['Best for', 'Paddy, maize, wheat, sugarcane'], ['Typical dose', '50–70 kg/acre basal'], ['Shelf life', '24 months']],
    tags: ['npk', 'complex', '12-32-16'], taxRate: 5,
  },
  {
    name: 'NPK 20:20:0:13 Ammonium Phosphate Sulphate', category: 'npk-complex', brand: 'Vasundhara', pack: 'bag', tone: '#4a9a4e', badge: '20:20:0:13', sub: 'With 13% sulphur',
    packs: [['5 kg', 155, 195], ['25 kg', 720, 880], ['50 kg', 1360, 1620]],
    short: 'Nitrogen, phosphorus and sulphur for cotton, groundnut, maize and chilli.',
    description: 'Water-soluble nitrogen and phosphorus with 13% sulphur, well suited to oilseeds, cotton and chilli where sulphur is often short.',
    specs: [['Nutrient', 'N 20%, P₂O₅ 20%, S 13%'], ['Form', 'Granular'], ['Best for', 'Cotton, groundnut, maize, chilli, sunflower'], ['Typical dose', '50–75 kg/acre'], ['Shelf life', '24 months']],
    tags: ['npk', '20-20-0-13', 'sulphur'], taxRate: 5,
  },
  {
    name: 'NPK 17:17:17 Balanced Complex', category: 'npk-complex', brand: 'AgroPlus', pack: 'bag', tone: '#27733a', badge: '17:17:17', sub: 'Balanced NPK',
    packs: [['5 kg', 170, 215], ['25 kg', 800, 980], ['50 kg', 1510, 1800]],
    short: 'All-round equal-ratio NPK for vegetables, fruits, paddy and pulses.',
    description: 'Equal parts nitrogen, phosphorus and potash for crops that need steady feeding all season. Works for basal or first top dressing.',
    specs: [['Nutrient', 'N 17%, P₂O₅ 17%, K₂O 17%'], ['Form', 'Granular'], ['Best for', 'Vegetables, fruits, paddy, pulses, flowers'], ['Typical dose', '50–75 kg/acre'], ['Shelf life', '24 months']],
    tags: ['npk', '17-17-17', 'balanced'], taxRate: 5, dealHours: 52,
  },

  // ── Water Soluble
  {
    name: 'NPK 19:19:19 Water Soluble', category: 'water-soluble', brand: 'GreenLeaf Labs', pack: 'pouch', tone: '#0e8a8a', badge: '19:19:19', sub: '100% water soluble',
    packs: [['1 kg', 320, 420], ['5 kg', 1450, 1900], ['25 kg', 6800, 8500]],
    short: 'All-purpose soluble NPK for drip, fertigation and foliar spray on vegetables and fruits.',
    description: 'The workhorse of fertigation. Dissolves completely with no residue, so it will not clog drip emitters. Use through drip every 7–10 days, or as a 5 g/litre foliar spray.',
    specs: [['Nutrient', 'N 19%, P₂O₅ 19%, K₂O 19%'], ['Form', 'Crystalline powder'], ['Best for', 'Vegetables, fruits, flowers, chilli, tomato'], ['Dose', '2–3 kg/acre via drip, or 5 g/L foliar'], ['Shelf life', '36 months']],
    tags: ['19-19-19', 'water soluble', 'fertigation', 'drip'], featured: true, newArrival: true, taxRate: 5,
  },
  {
    name: 'MKP 00:52:34 Water Soluble', category: 'water-soluble', brand: 'GreenLeaf Labs', pack: 'pouch', tone: '#17999b', badge: '00:52:34', sub: 'Mono potassium phosphate',
    packs: [['1 kg', 380, 520], ['5 kg', 1750, 2300]],
    short: 'Flowering and fruit-set booster for grapes, pomegranate, mango and vegetables.',
    description: 'High phosphorus and potash with no nitrogen — used at flowering to improve fruit set, size and sugar content without pushing leafy growth.',
    specs: [['Nutrient', 'P₂O₅ 52%, K₂O 34%'], ['Form', 'White crystals'], ['Best for', 'Grapes, pomegranate, mango, tomato, chilli'], ['Dose', '2–3 kg/acre via drip, or 3–5 g/L foliar'], ['Shelf life', '36 months']],
    tags: ['mkp', '00-52-34', 'flowering'], dealHours: 36, taxRate: 5,
  },
  {
    name: 'Potassium Nitrate 13:00:45', category: 'water-soluble', brand: 'CropMax', pack: 'pouch', tone: '#1f9d8a', badge: '13:00:45', sub: 'Potassium nitrate',
    packs: [['1 kg', 140, 190], ['5 kg', 640, 820], ['25 kg', 2950, 3600]],
    short: 'Nitrate nitrogen with high potash for banana, chilli, grapes and sugarcane.',
    description: 'Chloride-free source of potassium and nitrate nitrogen. Improves fruit weight, colour and shelf life, and helps crops through heat or water stress.',
    specs: [['Nutrient', 'N 13%, K₂O 45%'], ['Form', 'White prills'], ['Best for', 'Banana, chilli, grapes, sugarcane, vegetables'], ['Dose', '3–5 kg/acre via drip, or 5–10 g/L foliar'], ['Shelf life', '36 months']],
    tags: ['13-0-45', 'potassium nitrate', 'fertigation'], taxRate: 5,
  },
  {
    name: 'MAP 12:61:00 Water Soluble', category: 'water-soluble', brand: 'NutriCrop', pack: 'pouch', tone: '#2a8f9c', badge: '12:61:00', sub: 'Mono ammonium phosphate',
    packs: [['1 kg', 310, 400], ['5 kg', 1420, 1800]],
    short: 'Rooting starter for transplanted vegetables, paddy nursery and young fruit trees.',
    description: 'Very high phosphorus for strong early roots. Apply through drip or as a drench a week after transplanting.',
    specs: [['Nutrient', 'N 12%, P₂O₅ 61%'], ['Form', 'Crystalline powder'], ['Best for', 'Vegetable seedlings, paddy nursery, young orchards'], ['Dose', '2–3 kg/acre'], ['Shelf life', '36 months']],
    tags: ['map', '12-61-0', 'rooting'], taxRate: 5,
  },
  {
    name: 'Calcium Nitrate (15.5% N + 19% Ca)', category: 'water-soluble', brand: 'AgroPlus', pack: 'pouch', tone: '#3aa08f', badge: 'N 15.5 · Ca 19', sub: 'Calcium nitrate',
    packs: [['1 kg', 120, 160], ['5 kg', 540, 700], ['25 kg', 2500, 3100]],
    short: 'Calcium for tomato, chilli, capsicum and pomegranate to prevent blossom-end rot and cracking.',
    description: 'Highly soluble calcium and nitrate nitrogen. Prevents blossom-end rot in tomato and capsicum and reduces fruit cracking in pomegranate.',
    specs: [['Nutrient', 'N 15.5%, Ca 19%'], ['Form', 'White granules'], ['Best for', 'Tomato, chilli, capsicum, pomegranate, grapes'], ['Dose', '3–5 kg/acre via drip'], ['Shelf life', '24 months']],
    tags: ['calcium nitrate', 'calcium', 'fertigation'], taxRate: 5,
  },

  // ── Micronutrients
  {
    name: 'Zinc Sulphate Heptahydrate (Zn 21%)', category: 'micronutrients', brand: 'Vasundhara', pack: 'pouch', tone: '#7a4fb0', badge: 'Zn 21%', sub: 'Zinc sulphate',
    packs: [['1 kg', 85, 120], ['5 kg', 390, 520], ['25 kg', 1750, 2200]],
    short: 'Corrects zinc deficiency in paddy, maize, wheat and fruit trees.',
    description: 'Fixes khaira disease in paddy and white-bud in maize. Mix with soil at transplanting or sowing, or spray 0.5% solution on standing crops.',
    specs: [['Nutrient', 'Zinc (Zn) 21%'], ['Form', 'Free-flowing crystals'], ['Best for', 'Paddy, maize, wheat, citrus, mango'], ['Dose', '10 kg/acre soil, or 5 g/L foliar'], ['Shelf life', '36 months']],
    tags: ['zinc', 'zn', 'micronutrient'], featured: true, dealHours: 40, taxRate: 5,
  },
  {
    name: 'Chelated Multi-Micronutrient Mix (Grade II)', category: 'micronutrients', brand: 'GreenLeaf Labs', pack: 'pouch', tone: '#8a5cc0', badge: 'Zn Fe Mn Cu B', sub: 'EDTA chelated mix',
    packs: [['250 g', 195, 260], ['1 kg', 620, 820]],
    short: 'EDTA-chelated foliar mix of zinc, iron, manganese, copper and boron for vegetables, fruits and cotton.',
    description: 'A complete foliar micronutrient blend in chelated form for fast absorption. Use at vegetative stage and again at flowering to prevent hidden hunger.',
    specs: [['Nutrient', 'Zn 3%, Fe 2.5%, Mn 1%, Cu 1%, B 0.5%, Mo 0.1%'], ['Form', 'Fine powder'], ['Best for', 'Vegetables, fruits, cotton, sugarcane'], ['Dose', '1–2 g per litre of water'], ['Shelf life', '24 months']],
    tags: ['multi micronutrient', 'chelated', 'foliar'], newArrival: true, taxRate: 5,
  },
  {
    name: 'Boron 20% (Disodium Octaborate)', category: 'micronutrients', brand: 'CropMax', pack: 'pouch', tone: '#6b46a3', badge: 'B 20%', sub: 'Boron',
    packs: [['500 g', 90, 120], ['1 kg', 165, 220], ['5 kg', 760, 980]],
    short: 'Improves flowering, fruit set and seed filling in cotton, groundnut, vegetables and fruits.',
    description: 'Boron is vital for pollen germination and fruit set. Spray at pre-flowering to reduce flower drop and hollow stem.',
    specs: [['Nutrient', 'Boron (B) 20%'], ['Form', 'White powder'], ['Best for', 'Cotton, groundnut, cauliflower, mango, pomegranate'], ['Dose', '1 g per litre foliar'], ['Shelf life', '36 months']],
    tags: ['boron', 'b', 'flowering'], taxRate: 5,
  },
  {
    name: 'Ferrous Sulphate (Fe 19%)', category: 'micronutrients', brand: 'Vasundhara', pack: 'pouch', tone: '#5f3f94', badge: 'Fe 19%', sub: 'Ferrous sulphate',
    packs: [['1 kg', 55, 80], ['5 kg', 240, 320], ['25 kg', 1050, 1350]],
    short: 'Cures iron chlorosis (yellow leaves) in groundnut, paddy, sugarcane and fruit trees.',
    description: 'Corrects yellowing of young leaves caused by iron deficiency, common in calcareous and alkaline soils.',
    specs: [['Nutrient', 'Iron (Fe) 19%'], ['Form', 'Green crystals'], ['Best for', 'Groundnut, paddy, sugarcane, citrus'], ['Dose', '2.5 g/L foliar, repeated after 10 days'], ['Shelf life', '24 months']],
    tags: ['iron', 'fe', 'chlorosis'], taxRate: 5,
  },
  {
    name: 'Magnesium Sulphate (Mg 9.6%)', category: 'micronutrients', brand: 'AgroPlus', pack: 'pouch', tone: '#8e68c2', badge: 'Mg 9.6 · S 12', sub: 'Epsom salt grade',
    packs: [['1 kg', 60, 90], ['5 kg', 260, 350], ['25 kg', 1150, 1500]],
    short: 'Magnesium and sulphur for banana, chilli, tomato, cotton and sugarcane.',
    description: 'Magnesium sits at the centre of chlorophyll. Correct inter-veinal yellowing of older leaves with a soil dose or foliar spray.',
    specs: [['Nutrient', 'Mg 9.6%, S 12%'], ['Form', 'Crystalline'], ['Best for', 'Banana, chilli, tomato, cotton, sugarcane'], ['Dose', '5 g/L foliar, or 10–15 kg/acre soil'], ['Shelf life', '36 months']],
    tags: ['magnesium', 'mg', 'epsom'], taxRate: 5,
  },

  // ── Organic & Bio
  {
    name: 'Premium Vermicompost', category: 'organic-bio', brand: 'BioHarvest', pack: 'bag', tone: '#7a5230', badge: 'ORGANIC', sub: 'Vermicompost',
    packs: [['5 kg', 140, 200], ['25 kg', 520, 700], ['50 kg', 950, 1250]],
    short: 'Sieved earthworm compost for vegetables, fruits, kitchen garden, paddy and pots.',
    description: 'Dark, odour-free vermicompost that builds soil structure and feeds microbes. Mix into planting pits, nursery beds or pots.',
    specs: [['Organic carbon', 'Min 18%'], ['Moisture', '15–20%'], ['Best for', 'Vegetables, fruits, flowers, kitchen garden, pots'], ['Dose', '1–2 tonnes/acre, or a handful per plant'], ['Shelf life', '12 months']],
    tags: ['vermicompost', 'organic', 'compost'], featured: true, newArrival: true, dealHours: 28, taxRate: 0,
  },
  {
    name: 'Neem Cake Powder', category: 'organic-bio', brand: 'BioHarvest', pack: 'bag', tone: '#8a6238', badge: 'N 5%', sub: 'Neem cake',
    packs: [['5 kg', 170, 230], ['25 kg', 720, 950]],
    short: 'Organic nitrogen that also deters soil pests and nematodes in vegetables, paddy and fruit trees.',
    description: 'Cold-pressed neem cake feeds the soil and reduces nematodes and termites. Apply before planting and around the root zone of fruit trees.',
    specs: [['Nutrient', 'N 5%, P 1%, K 1.5%'], ['Form', 'Fine powder'], ['Best for', 'Vegetables, paddy, fruit trees, turmeric'], ['Dose', '100–200 kg/acre'], ['Shelf life', '12 months']],
    tags: ['neem cake', 'organic', 'nematode'], taxRate: 5,
  },
  {
    name: 'Organic Manure Granules (Cow-Dung Based)', category: 'organic-bio', brand: 'Vasundhara', pack: 'bag', tone: '#6c4a2c', badge: 'ORGANIC', sub: 'Granular manure',
    packs: [['10 kg', 220, 300], ['50 kg', 880, 1150]],
    short: 'Easy-to-spread granular manure for paddy, vegetables, sugarcane and orchards.',
    description: 'Composted cow-dung manure enriched with rock phosphate and pressmud, pelletised so it spreads evenly and stays odour-free.',
    specs: [['Organic carbon', 'Min 14%'], ['Form', 'Pelletised granules'], ['Best for', 'Paddy, vegetables, sugarcane, orchards'], ['Dose', '200–400 kg/acre'], ['Shelf life', '12 months']],
    tags: ['organic manure', 'cow dung', 'granules'], taxRate: 0,
  },
  {
    name: 'Rhizobium Bio-Fertilizer (Liquid)', category: 'organic-bio', brand: 'BioHarvest', pack: 'bottle', tone: '#5e8c3a', badge: 'RHIZOBIUM', sub: 'Nitrogen-fixing culture',
    packs: [['500 ml', 190, 250], ['1 L', 340, 450]],
    short: 'Seed treatment culture that fixes nitrogen in groundnut, soybean, pulses and gram.',
    description: 'Live Rhizobium culture for legumes. Treat seed just before sowing so roots form nodules that fix nitrogen from the air, cutting urea needs.',
    specs: [['Organism', 'Rhizobium spp. (10⁸ CFU/ml)'], ['Form', 'Liquid culture'], ['Best for', 'Groundnut, soybean, pulses, gram'], ['Dose', '10 ml per kg of seed'], ['Shelf life', '6 months — store cool']],
    tags: ['rhizobium', 'bio fertilizer', 'legume'], taxRate: 5,
  },
  {
    name: 'PSB Phosphate Solubilising Bacteria (Liquid)', category: 'organic-bio', brand: 'BioHarvest', pack: 'bottle', tone: '#6a9a3e', badge: 'PSB', sub: 'Unlocks soil phosphorus',
    packs: [['500 ml', 180, 240], ['1 L', 320, 420]],
    short: 'Unlocks locked-up phosphorus in the soil for paddy, wheat, vegetables and cotton.',
    description: 'Beneficial bacteria that convert fixed phosphate into forms roots can absorb. Reduces the DAP bill when used regularly.',
    specs: [['Organism', 'Bacillus / Pseudomonas (10⁸ CFU/ml)'], ['Form', 'Liquid culture'], ['Best for', 'Paddy, wheat, vegetables, cotton'], ['Dose', '1 L/acre with manure or drip'], ['Shelf life', '6 months — store cool']],
    tags: ['psb', 'bio fertilizer', 'phosphorus'], taxRate: 5,
  },
  {
    name: 'Mycorrhiza Root Booster', category: 'organic-bio', brand: 'GreenLeaf Labs', pack: 'tub', tone: '#8b6a3a', badge: 'MYCORRHIZA', sub: 'Root colonising fungi',
    packs: [['1 kg', 360, 480], ['5 kg', 1650, 2100]],
    short: 'Beneficial root fungi for fruit trees, vegetables and sugarcane that stretch water and nutrient uptake.',
    description: 'Arbuscular mycorrhizal fungi colonise roots and extend their reach, improving drought tolerance and phosphorus uptake.',
    specs: [['Organism', 'Glomus spp. (100 propagules/g)'], ['Form', 'Granular carrier'], ['Best for', 'Fruit trees, vegetables, sugarcane, nursery'], ['Dose', '4–5 kg/acre at planting'], ['Shelf life', '12 months']],
    tags: ['mycorrhiza', 'root', 'bio'], newArrival: true, taxRate: 5,
  },

  // ── Growth Boosters
  {
    name: 'Seaweed Extract Liquid (Kappaphycus)', category: 'growth-boosters', brand: 'NutriCrop', pack: 'bottle', tone: '#b07a0a', badge: 'SEAWEED', sub: 'Plant growth stimulant',
    packs: [['250 ml', 210, 290], ['500 ml', 380, 520], ['1 L', 690, 920]],
    short: 'Natural seaweed biostimulant that improves flowering, fruit set and stress tolerance in vegetables, grapes and paddy.',
    description: 'Cold-extracted seaweed rich in natural cytokinins and betaines. Spray at tillering or flowering to improve vigour and recovery from heat and drought stress.',
    specs: [['Source', 'Kappaphycus alvarezii extract'], ['Form', 'Liquid'], ['Best for', 'Vegetables, grapes, paddy, cotton'], ['Dose', '2–3 ml per litre foliar'], ['Shelf life', '24 months']],
    tags: ['seaweed', 'biostimulant', 'foliar'], featured: true, dealHours: 20, taxRate: 18,
  },
  {
    name: 'Humic + Fulvic Acid Liquid', category: 'growth-boosters', brand: 'GreenLeaf Labs', pack: 'bottle', tone: '#a06a10', badge: 'HUMIC', sub: 'Humic + fulvic acids',
    packs: [['500 ml', 260, 350], ['1 L', 470, 640], ['5 L', 2150, 2800]],
    short: 'Boosts root growth and nutrient uptake in sugarcane, banana, vegetables and fruit trees.',
    description: 'A potassium-humate and fulvic blend that loosens soil, chelates nutrients and drives white-root growth. Apply with drip or as a root drench.',
    specs: [['Content', 'Humic 12%, Fulvic 3%'], ['Form', 'Dark liquid'], ['Best for', 'Sugarcane, banana, vegetables, fruit trees'], ['Dose', '1 L/acre drip, or 2 ml/L drench'], ['Shelf life', '24 months']],
    tags: ['humic', 'fulvic', 'root'], dealHours: 44, taxRate: 18,
  },
  {
    name: 'Amino Acid Plant Booster', category: 'growth-boosters', brand: 'CropMax', pack: 'bottle', tone: '#c28a1a', badge: 'AMINO', sub: 'Protein hydrolysate',
    packs: [['250 ml', 180, 250], ['500 ml', 330, 450], ['1 L', 610, 820]],
    short: 'Quick-recovery amino acids for stressed cotton, chilli, tomato and paddy.',
    description: 'Free amino acids that plants absorb directly through leaves — a fast pick-me-up after transplanting shock, hail, heat or pesticide stress.',
    specs: [['Content', 'Free amino acids 40%'], ['Form', 'Liquid'], ['Best for', 'Cotton, chilli, tomato, paddy, vegetables'], ['Dose', '2 ml per litre foliar'], ['Shelf life', '24 months']],
    tags: ['amino acid', 'stress', 'foliar'], taxRate: 18,
  },
  {
    name: 'Flowering & Fruit-Set Booster', category: 'growth-boosters', brand: 'AgroPlus', pack: 'bottle', tone: '#d19a2a', badge: 'FRUIT SET', sub: 'Reduces flower drop',
    packs: [['100 ml', 150, 210], ['250 ml', 340, 470]],
    short: 'Cuts flower drop and improves fruit set in tomato, chilli, brinjal, mango and pomegranate.',
    description: 'A balanced plant growth regulator blend with boron and zinc to hold flowers and set more fruit during hot weather.',
    specs: [['Content', 'Triacontanol + B + Zn'], ['Form', 'Liquid'], ['Best for', 'Tomato, chilli, brinjal, mango, pomegranate'], ['Dose', '1 ml per litre at flowering'], ['Shelf life', '24 months']],
    tags: ['flowering', 'fruit set', 'pgr'], newArrival: true, taxRate: 18,
  },

  // ── Soil Care
  {
    name: 'Agricultural Gypsum (Ca 22% + S 17%)', category: 'soil-care', brand: 'Vasundhara', pack: 'bag', tone: '#5b6b4e', badge: 'Ca 22 · S 17', sub: 'Gypsum soil conditioner',
    packs: [['10 kg', 90, 130], ['50 kg', 360, 480]],
    short: 'Loosens clay and sodic soils; supplies calcium and sulphur for groundnut, paddy and vegetables.',
    description: 'Improves water infiltration in compacted or sodic soils and feeds groundnut pods with calcium. Apply at sowing or pegging stage.',
    specs: [['Nutrient', 'Ca 22%, S 17%'], ['Form', 'Fine granules'], ['Best for', 'Groundnut, paddy, sodic and clay soils'], ['Dose', '200–400 kg/acre'], ['Shelf life', 'Indefinite']],
    tags: ['gypsum', 'calcium', 'sodic soil'], taxRate: 5,
  },
  {
    name: 'Dolomite Lime (Soil pH Corrector)', category: 'soil-care', brand: 'TerraGro', pack: 'bag', tone: '#6f7d5c', badge: 'Ca · Mg', sub: 'Lime for acidic soils',
    packs: [['10 kg', 100, 140], ['50 kg', 420, 560]],
    short: 'Raises pH of acidic soils and adds calcium and magnesium for tea, coffee, paddy and vegetables.',
    description: 'Ground dolomite that neutralises soil acidity and supplies calcium plus magnesium. Apply 2–3 weeks before sowing.',
    specs: [['Nutrient', 'CaO 30%, MgO 18%'], ['Form', 'Fine powder'], ['Best for', 'Acidic soils, tea, coffee, paddy, vegetables'], ['Dose', '200–400 kg/acre (based on soil pH)'], ['Shelf life', 'Indefinite']],
    tags: ['lime', 'dolomite', 'ph', 'acidic soil'], taxRate: 5,
  },
  {
    name: 'Soil Health Test Kit (pH, N, P, K)', category: 'soil-care', brand: 'GreenLeaf Labs', pack: 'box', tone: '#4f6a46', badge: 'SOIL TEST', sub: '25 tests · pH N P K',
    packs: [['25 tests', 599, 799], ['50 tests', 1049, 1399]],
    short: 'Test your field soil in minutes and get a fertilizer plan for paddy, cotton, vegetables and fruits.',
    description: 'A field-ready kit with reagents and colour charts for pH, nitrogen, phosphorus and potassium. Know what the soil needs before you spend on bags.',
    specs: [['Tests', 'pH, N, P, K'], ['Includes', 'Reagents, colour charts, spoon, guide'], ['Best for', 'All crops'], ['Time per test', 'About 10 minutes'], ['Shelf life', '18 months']],
    tags: ['soil test', 'kit', 'ph'], featured: true, taxRate: 18,
  },
];

export const products: SeedProduct[] = raw.map((r) => ({
  ...r,
  price: r.packs[0][1],
  mrp: r.packs[0][2],
  cost: Math.round(r.packs[0][1] * 0.74),
}));

/** Crops shown as "Shop by crop" tiles; `q` is the search term used for the link. */
export interface SeedCrop {
  name: string;
  q: string;
  slug: string;
  tint: string;
}
export const crops: SeedCrop[] = [
  { name: 'Paddy', q: 'paddy', slug: 'paddy', tint: '#e9efc8' },
  { name: 'Wheat', q: 'wheat', slug: 'wheat', tint: '#f6e6b8' },
  { name: 'Cotton', q: 'cotton', slug: 'cotton', tint: '#e8eef6' },
  { name: 'Maize', q: 'maize', slug: 'maize', tint: '#fbeab0' },
  { name: 'Sugarcane', q: 'sugarcane', slug: 'sugarcane', tint: '#dcefd0' },
  { name: 'Vegetables', q: 'vegetables', slug: 'vegetables', tint: '#fbe0d6' },
  { name: 'Fruits', q: 'fruits', slug: 'fruits', tint: '#fbe3c8' },
  { name: 'Pulses', q: 'pulses', slug: 'pulses', tint: '#efe3cf' },
];

export const banners = [
  { title: 'Healthier soil. Bigger harvest.', subtitle: 'Genuine fertilizers delivered to your farm gate. Cash on Delivery available.', link: '/shop', ctaText: 'Shop fertilizers', art: 'sunrise' as const, pack: 'bag' as PackKind, tone: '#2f7d3a', badge: '10:26:26' },
  { title: 'Kharif season, sorted.', subtitle: 'DAP, NPK and Urea in 5 kg to 50 kg packs. Stock up before sowing.', link: '/shop?category=npk-complex', ctaText: 'Shop NPK complex', art: 'field' as const, pack: 'bag' as PackKind, tone: '#b4532a', badge: '18-46-0' },
  { title: 'Grow organic.', subtitle: 'Vermicompost, neem cake and bio-fertilizers from ₹140.', link: '/shop?category=organic-bio', ctaText: 'Shop organic', art: 'organic' as const, pack: 'bag' as PackKind, tone: '#7a5230', badge: 'ORGANIC' },
];

export const firstNames = ['Ramesh', 'Suresh', 'Mahesh', 'Venkat', 'Srinivas', 'Raju', 'Narsimha', 'Ravi', 'Anil', 'Prakash', 'Lakshmi', 'Sunitha', 'Padma', 'Savitha', 'Radha', 'Kavitha', 'Rahul', 'Karthik', 'Harsha', 'Naresh', 'Bhaskar', 'Mallesh', 'Sai', 'Vijay', 'Anand', 'Swathi', 'Divya', 'Manoj', 'Ganesh', 'Yadagiri'];
export const lastNames = ['Reddy', 'Naidu', 'Rao', 'Goud', 'Patel', 'Singh', 'Yadav', 'Kumar', 'Chowdary', 'Gowda', 'Verma', 'Patil', 'Shetty', 'Pillai', 'Das'];
export const cities: [string, string, string][] = [
  ['Karimnagar', 'Telangana', '505001'],
  ['Warangal', 'Telangana', '506002'],
  ['Nizamabad', 'Telangana', '503001'],
  ['Guntur', 'Andhra Pradesh', '522001'],
  ['Vijayawada', 'Andhra Pradesh', '520010'],
  ['Nashik', 'Maharashtra', '422001'],
  ['Pune', 'Maharashtra', '411014'],
  ['Belagavi', 'Karnataka', '590001'],
  ['Mysuru', 'Karnataka', '570001'],
  ['Coimbatore', 'Tamil Nadu', '641001'],
  ['Ludhiana', 'Punjab', '141001'],
  ['Karnal', 'Haryana', '132001'],
  ['Indore', 'Madhya Pradesh', '452010'],
  ['Hyderabad', 'Telangana', '500081'],
];

export const reviewSnippets: [number, string, string][] = [
  [5, 'Genuine and fresh stock', 'Bag was sealed with a proper batch number. Granules were dry and free-flowing. Crop response was visible in two weeks.'],
  [5, 'Good yield this season', 'Used as a basal dose and saw better tillering than last year. Delivery to the village came in four days.'],
  [4, 'Value for money', 'Price is lower than the local shop and packing was strong. One bag had a small tear but support replaced it quickly.'],
  [4, 'Works as described', 'Dissolves fully in the drip tank with no clogging. Plants greened up within a week of the first dose.'],
  [5, 'Very helpful guidance', 'The dosage notes and WhatsApp support helped me avoid over-application. Will order again for rabi.'],
  [3, 'Okay, slow delivery', 'Product is fine but the courier took a week to reach us. Packaging was good.'],
  [4, 'Good quality', 'Matches the grade on the label. Easy to spread and no dust.'],
  [2, 'Pack was damaged', 'Outer bag was torn on arrival. Support refunded the amount without much hassle.'],
  [5, 'Best purchase for my field', 'Soil test kit and fertilizer plan saved me money this season. Highly recommended.'],
];
