/**
 * Store-specific merchandising for the home page. Together with
 * src/styles/theme.css and the catalog itself, this is what turns the platform
 * into a fertilizer shop — swap these lists to re-skin for another vertical.
 */

/** "Shop by crop" tiles. `q` is the search term the tile links to. */
export const CROPS = [
  { name: 'Paddy', q: 'paddy', image: '/images/crops/paddy.svg' },
  { name: 'Wheat', q: 'wheat', image: '/images/crops/wheat.svg' },
  { name: 'Cotton', q: 'cotton', image: '/images/crops/cotton.svg' },
  { name: 'Maize', q: 'maize', image: '/images/crops/maize.svg' },
  { name: 'Sugarcane', q: 'sugarcane', image: '/images/crops/sugarcane.svg' },
  { name: 'Vegetables', q: 'vegetables', image: '/images/crops/vegetables.svg' },
  { name: 'Fruits', q: 'fruits', image: '/images/crops/fruits.svg' },
  { name: 'Pulses', q: 'pulses', image: '/images/crops/pulses.svg' },
];

/** "What does your crop need?" cards, each pointing at a category slug. */
export const NEEDS = [
  { title: 'Basal dose at sowing', body: 'DAP, SSP & potash', category: 'phosphatic-potassic' },
  { title: 'Top dressing', body: 'Urea & nitrogen', category: 'nitrogen' },
  { title: 'Balanced feeding', body: 'NPK complex grades', category: 'npk-complex' },
  { title: 'Drip & foliar', body: 'Water-soluble grades', category: 'water-soluble' },
  { title: 'Fix deficiencies', body: 'Zinc, boron, iron, Mg', category: 'micronutrients' },
  { title: 'Go organic', body: 'Compost & bio-cultures', category: 'organic-bio' },
];

export const TRUST = [
  { icon: 'shield', title: 'Genuine, sealed stock', body: 'Batch-numbered packs' },
  { icon: 'truck', title: 'Farm-gate delivery', body: 'Pan-India shipping' },
  { icon: 'wallet', title: 'Cash on Delivery', body: 'Pay when it arrives' },
  { icon: 'sprout', title: 'Dosage guidance', body: 'On every product' },
] as const;
