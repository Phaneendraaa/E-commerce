/* Demo catalog used by the seed script and the image generator. Prices in rupees. */

export type Icon =
  | 'tshirt'
  | 'hoodie'
  | 'dress'
  | 'jeans'
  | 'sneaker'
  | 'watch'
  | 'bag'
  | 'backpack'
  | 'sunglasses'
  | 'phone'
  | 'headphones'
  | 'earbuds'
  | 'laptop'
  | 'smartwatch'
  | 'speaker'
  | 'mug'
  | 'lamp'
  | 'pan'
  | 'bottle'
  | 'jar'
  | 'dumbbell'
  | 'yogamat'
  | 'plant'
  | 'cushion';

export const COLORS: Record<string, string> = {
  Black: '#1f2937',
  White: '#f1f5f9',
  Navy: '#1e3a8a',
  Red: '#dc2626',
  Olive: '#4d7c0f',
  Beige: '#d6c4a8',
  Pink: '#ec4899',
  Blue: '#2563eb',
  Grey: '#9ca3af',
  Green: '#16a34a',
  Silver: '#cbd5e1',
  Gold: '#d4a017',
  Teal: '#0d9488',
  Purple: '#7c3aed',
  Orange: '#ea580c',
  Brown: '#92400e',
};

export interface SeedCategory {
  name: string;
  slug: string;
  parent?: string;
  description: string;
  icon: Icon;
  tint: string;
  featured?: boolean;
}

export const categories: SeedCategory[] = [
  { name: 'Fashion', slug: 'fashion', description: 'Clothing, footwear and accessories for every style.', icon: 'tshirt', tint: '#fde68a', featured: true },
  { name: 'Men', slug: 'men', parent: 'fashion', description: 'T-shirts, hoodies, jeans and more for men.', icon: 'hoodie', tint: '#bfdbfe' },
  { name: 'Women', slug: 'women', parent: 'fashion', description: 'Dresses, tops and everyday essentials.', icon: 'dress', tint: '#fbcfe8' },
  { name: 'Footwear', slug: 'footwear', parent: 'fashion', description: 'Sneakers and shoes built for comfort.', icon: 'sneaker', tint: '#fed7aa' },
  { name: 'Accessories', slug: 'accessories', parent: 'fashion', description: 'Watches, bags and sunglasses.', icon: 'watch', tint: '#e9d5ff' },
  { name: 'Electronics', slug: 'electronics', description: 'Phones, audio, laptops and wearables.', icon: 'phone', tint: '#c7d2fe', featured: true },
  { name: 'Mobiles', slug: 'mobiles', parent: 'electronics', description: 'Latest smartphones at the best prices.', icon: 'phone', tint: '#bae6fd' },
  { name: 'Audio', slug: 'audio', parent: 'electronics', description: 'Headphones, earbuds and speakers.', icon: 'headphones', tint: '#a5f3fc' },
  { name: 'Laptops', slug: 'laptops', parent: 'electronics', description: 'Ultrabooks and performance laptops.', icon: 'laptop', tint: '#ddd6fe' },
  { name: 'Wearables', slug: 'wearables', parent: 'electronics', description: 'Smartwatches and fitness bands.', icon: 'smartwatch', tint: '#bbf7d0' },
  { name: 'Home & Kitchen', slug: 'home-kitchen', description: 'Cookware, decor and home essentials.', icon: 'lamp', tint: '#fecaca', featured: true },
  { name: 'Beauty', slug: 'beauty', description: 'Skincare and personal care.', icon: 'bottle', tint: '#fce7f3', featured: true },
  { name: 'Sports & Fitness', slug: 'sports-fitness', description: 'Gear for workouts, yoga and the outdoors.', icon: 'dumbbell', tint: '#d9f99d', featured: true },
];

export const brands = ['Urbanloom', 'Northpeak', 'Velora', 'Stridex', 'Aurix', 'Nimbus', 'Pixelon', 'Kitchora', 'Glowlab', 'FitForge', 'Terra Home', 'Chronova'];

export interface SeedProduct {
  name: string;
  category: string;
  brand: string;
  icon: Icon;
  price: number;
  mrp?: number;
  cost?: number;
  colors?: string[];
  sizes?: string[];
  storage?: string[];
  short: string;
  description: string;
  specs: [string, string][];
  tags: string[];
  featured?: boolean;
  newArrival?: boolean;
  dealHours?: number;
  stock?: number;
  taxRate?: number;
}

const tee = ['S', 'M', 'L', 'XL', 'XXL'];

export const products: SeedProduct[] = [
  // ── Men
  { name: 'Essential Cotton Crew T-Shirt', category: 'men', brand: 'Urbanloom', icon: 'tshirt', price: 499, mrp: 999, cost: 180, colors: ['Black', 'White', 'Navy', 'Olive'], sizes: tee, short: '100% combed cotton, breathable everyday tee.', description: 'Our bestselling crew-neck tee in 180 GSM combed cotton. Pre-shrunk, bio-washed for a soft hand-feel, and cut for a modern regular fit that holds its shape wash after wash.', specs: [['Fabric', '100% Combed Cotton'], ['Fit', 'Regular'], ['GSM', '180'], ['Care', 'Machine wash cold']], tags: ['tshirt', 'cotton', 'basics', 'men'], featured: true, taxRate: 5 },
  { name: 'Oversized Graphic Hoodie', category: 'men', brand: 'Northpeak', icon: 'hoodie', price: 1499, mrp: 2499, cost: 620, colors: ['Black', 'Grey', 'Olive'], sizes: tee, short: 'Brushed fleece hoodie with a relaxed drop-shoulder fit.', description: 'Heavyweight 320 GSM brushed fleece, kangaroo pocket, ribbed cuffs and a double-layer hood. Built for chilly evenings and long flights.', specs: [['Fabric', '80% Cotton, 20% Poly'], ['Fit', 'Oversized'], ['GSM', '320']], tags: ['hoodie', 'winter', 'streetwear'], newArrival: true, taxRate: 12 },
  { name: 'Slim Fit Stretch Jeans', category: 'men', brand: 'Urbanloom', icon: 'jeans', price: 1799, mrp: 2999, cost: 700, colors: ['Blue', 'Black'], sizes: ['28', '30', '32', '34', '36'], short: 'Mid-rise slim jeans with 2% stretch for all-day comfort.', description: 'Crafted from rigid-look stretch denim with a clean wash. Five-pocket styling, YKK zip and a tapered leg that pairs with everything.', specs: [['Fabric', '98% Cotton, 2% Elastane'], ['Rise', 'Mid'], ['Fit', 'Slim']], tags: ['jeans', 'denim'], taxRate: 12 },
  { name: 'Classic Oxford Polo', category: 'men', brand: 'Velora', icon: 'tshirt', price: 899, mrp: 1599, cost: 340, colors: ['White', 'Navy', 'Red'], sizes: tee, short: 'Piqué polo with a crisp collar.', description: 'A smart-casual staple in breathable cotton piqué with a two-button placket and side vents.', specs: [['Fabric', 'Cotton Piqué'], ['Collar', 'Ribbed']], tags: ['polo', 'smart casual'], dealHours: 30, taxRate: 5 },
  // ── Women
  { name: 'Floral Wrap Midi Dress', category: 'women', brand: 'Velora', icon: 'dress', price: 1899, mrp: 3299, cost: 720, colors: ['Pink', 'Navy', 'Beige'], sizes: ['XS', 'S', 'M', 'L', 'XL'], short: 'Flowy viscose wrap dress with a flattering tie waist.', description: 'Lightweight viscose crepe in an all-over floral print. Adjustable wrap tie, flutter sleeves and a midi hem that moves beautifully.', specs: [['Fabric', '100% Viscose'], ['Length', 'Midi'], ['Neck', 'V-neck']], tags: ['dress', 'summer', 'floral'], featured: true, newArrival: true, taxRate: 12 },
  { name: 'Ribbed Knit Crop Top', category: 'women', brand: 'Urbanloom', icon: 'tshirt', price: 599, mrp: 1199, cost: 210, colors: ['White', 'Black', 'Pink', 'Green'], sizes: ['XS', 'S', 'M', 'L'], short: 'Second-skin rib knit with a square neckline.', description: 'Soft stretch rib knit that layers under jackets or shines on its own.', specs: [['Fabric', '95% Cotton, 5% Spandex'], ['Fit', 'Slim']], tags: ['top', 'crop', 'basics'], taxRate: 5 },
  { name: 'High-Rise Wide Leg Jeans', category: 'women', brand: 'Northpeak', icon: 'jeans', price: 2199, mrp: 3499, cost: 860, colors: ['Blue', 'Beige'], sizes: ['24', '26', '28', '30', '32'], short: 'Retro wide leg with a cinched high waist.', description: 'Non-stretch cotton denim in a vintage wash with a full-length wide leg.', specs: [['Fabric', '100% Cotton'], ['Rise', 'High']], tags: ['jeans', 'wide leg'], dealHours: 52, taxRate: 12 },
  // ── Footwear
  { name: 'AirFlex Running Sneakers', category: 'footwear', brand: 'Stridex', icon: 'sneaker', price: 2999, mrp: 4999, cost: 1300, colors: ['White', 'Black', 'Blue'], sizes: ['6', '7', '8', '9', '10', '11'], short: 'Responsive foam midsole with breathable mesh upper.', description: 'Engineered mesh upper, cushioned EVA midsole and a grippy rubber outsole for road runs and daily miles.', specs: [['Upper', 'Engineered mesh'], ['Midsole', 'EVA foam'], ['Drop', '8 mm']], tags: ['shoes', 'running', 'sneakers'], featured: true, taxRate: 18 },
  { name: 'Retro Court Canvas Shoes', category: 'footwear', brand: 'Stridex', icon: 'sneaker', price: 1299, mrp: 1999, cost: 520, colors: ['White', 'Red', 'Navy'], sizes: ['6', '7', '8', '9', '10'], short: 'Timeless low-top canvas with vulcanized sole.', description: 'Durable cotton canvas, padded collar and a classic vulcanized rubber sole.', specs: [['Upper', 'Canvas'], ['Sole', 'Rubber']], tags: ['shoes', 'casual', 'canvas'], taxRate: 12 },
  { name: 'Trail Pro Hiking Boots', category: 'footwear', brand: 'Northpeak', icon: 'sneaker', price: 4499, mrp: 6999, cost: 2100, colors: ['Brown', 'Olive'], sizes: ['7', '8', '9', '10', '11'], short: 'Waterproof membrane and lugged outsole for rough terrain.', description: 'Seam-sealed waterproof construction, ankle support and a 5 mm lugged outsole for confident footing.', specs: [['Waterproof', 'Yes'], ['Weight', '540 g / shoe']], tags: ['boots', 'hiking', 'outdoor'], newArrival: true, taxRate: 18 },
  // ── Accessories
  { name: 'Chronova Heritage Automatic Watch', category: 'accessories', brand: 'Chronova', icon: 'watch', price: 8999, mrp: 14999, cost: 4200, colors: ['Silver', 'Gold', 'Black'], short: 'Sapphire crystal, 40-hour power reserve, 5 ATM.', description: 'A self-winding automatic movement visible through an exhibition caseback, sapphire crystal and a stainless steel bracelet.', specs: [['Movement', 'Automatic'], ['Case', '41 mm steel'], ['Water resistance', '5 ATM']], tags: ['watch', 'automatic', 'gift'], featured: true, taxRate: 18 },
  { name: 'Everyday Leather Tote', category: 'accessories', brand: 'Velora', icon: 'bag', price: 2499, mrp: 3999, cost: 1050, colors: ['Brown', 'Black', 'Beige'], short: 'Full-grain leather tote that fits a 14" laptop.', description: 'Structured full-grain leather with a zip pocket, padded laptop sleeve and comfortable shoulder drop.', specs: [['Material', 'Full-grain leather'], ['Fits', '14" laptop']], tags: ['bag', 'tote', 'leather'], taxRate: 18 },
  { name: 'Polarized Aviator Sunglasses', category: 'accessories', brand: 'Aurix', icon: 'sunglasses', price: 1199, mrp: 2499, cost: 380, colors: ['Gold', 'Black', 'Silver'], short: 'UV400 polarized lenses with lightweight metal frame.', description: 'Glare-cutting polarized lenses with full UV400 protection and spring hinges.', specs: [['Lens', 'Polarized UV400'], ['Frame', 'Metal']], tags: ['sunglasses', 'summer'], dealHours: 20, taxRate: 18 },
  { name: 'Commuter Anti-Theft Backpack', category: 'accessories', brand: 'Northpeak', icon: 'backpack', price: 1999, mrp: 3499, cost: 800, colors: ['Black', 'Grey', 'Navy'], short: 'Hidden zips, USB port and a water-resistant shell.', description: '25 L capacity with a padded 15.6" laptop compartment, hidden back pocket and an external USB charging port.', specs: [['Capacity', '25 L'], ['Laptop', 'Up to 15.6"']], tags: ['backpack', 'travel', 'laptop bag'], taxRate: 18 },
  // ── Mobiles
  { name: 'Pixelon X12 Pro 5G', category: 'mobiles', brand: 'Pixelon', icon: 'phone', price: 34999, mrp: 41999, cost: 28000, colors: ['Black', 'Blue', 'Silver'], storage: ['8GB/128GB', '12GB/256GB'], short: '6.7" 120Hz AMOLED, 50MP OIS camera, 5000mAh.', description: 'A flagship-grade experience: 6.7" LTPO AMOLED, 50 MP stabilized main camera, 67 W fast charging and 4 years of OS updates.', specs: [['Display', '6.7" AMOLED 120Hz'], ['Camera', '50 MP + 12 MP + 10 MP'], ['Battery', '5000 mAh, 67 W'], ['Network', '5G']], tags: ['smartphone', '5g', 'android'], featured: true, taxRate: 18 },
  { name: 'Pixelon A5 Lite', category: 'mobiles', brand: 'Pixelon', icon: 'phone', price: 11999, mrp: 14999, cost: 9500, colors: ['Green', 'Black'], storage: ['4GB/64GB', '6GB/128GB'], short: 'Big battery, bright display, budget friendly.', description: '6.5" HD+ display, 6000 mAh battery and a 48 MP dual camera at an incredible price.', specs: [['Display', '6.5" HD+'], ['Battery', '6000 mAh']], tags: ['smartphone', 'budget'], dealHours: 44, taxRate: 18 },
  { name: 'Nimbus Fold Z', category: 'mobiles', brand: 'Nimbus', icon: 'phone', price: 89999, mrp: 109999, cost: 76000, colors: ['Black', 'Silver'], storage: ['12GB/256GB', '12GB/512GB'], short: 'Foldable 7.6" inner display, flagship performance.', description: 'Unfold a tablet-sized 7.6" display. Flagship chipset, IPX8, and a hinge tested for 200,000 folds.', specs: [['Inner display', '7.6" AMOLED'], ['Water resistance', 'IPX8']], tags: ['foldable', 'flagship', '5g'], newArrival: true, taxRate: 18 },
  // ── Audio
  { name: 'Aurix Studio ANC Headphones', category: 'audio', brand: 'Aurix', icon: 'headphones', price: 7999, mrp: 12999, cost: 3800, colors: ['Black', 'Silver', 'Navy'], short: 'Hybrid ANC, 40-hour battery, LDAC hi-res audio.', description: 'Adaptive hybrid noise cancellation, plush memory-foam ear cushions and a 40-hour battery with 10-minute quick charge for 5 hours.', specs: [['ANC', 'Hybrid adaptive'], ['Battery', '40 h'], ['Codec', 'LDAC / AAC / SBC']], tags: ['headphones', 'anc', 'wireless'], featured: true, taxRate: 18 },
  { name: 'Aurix Buds Air 3', category: 'audio', brand: 'Aurix', icon: 'earbuds', price: 2499, mrp: 4999, cost: 1100, colors: ['White', 'Black'], short: 'True wireless earbuds with ENC mics and 30h total.', description: '10 mm drivers, quad-mic ENC for clear calls, low-latency game mode and IPX5 sweat resistance.', specs: [['Playtime', '30 h with case'], ['Rating', 'IPX5']], tags: ['earbuds', 'tws', 'wireless'], dealHours: 18, taxRate: 18 },
  { name: 'Boombox Mini Bluetooth Speaker', category: 'audio', brand: 'Nimbus', icon: 'speaker', price: 1799, mrp: 2999, cost: 750, colors: ['Black', 'Red', 'Teal'], short: '20W punchy sound, IPX7 waterproof, 12h play.', description: 'Rugged, waterproof and loud. Pair two for stereo sound.', specs: [['Output', '20 W'], ['Waterproof', 'IPX7']], tags: ['speaker', 'bluetooth', 'party'], taxRate: 18 },
  // ── Laptops
  { name: 'Nimbus Book Air 14', category: 'laptops', brand: 'Nimbus', icon: 'laptop', price: 64999, mrp: 79999, cost: 54000, colors: ['Silver', 'Grey'], storage: ['16GB/512GB', '16GB/1TB'], short: '14" 2.8K OLED, 1.2 kg, all-day battery.', description: 'An ultralight aluminium laptop with a 2.8K OLED display, backlit keyboard, Wi-Fi 6E and up to 18 hours of battery.', specs: [['Display', '14" 2.8K OLED'], ['Weight', '1.2 kg'], ['Battery', 'Up to 18 h']], tags: ['laptop', 'ultrabook', 'oled'], featured: true, taxRate: 18 },
  { name: 'Pixelon Creator 16 Pro', category: 'laptops', brand: 'Pixelon', icon: 'laptop', price: 119999, mrp: 139999, cost: 98000, colors: ['Black'], storage: ['32GB/1TB'], short: 'RTX graphics, 165Hz 16" display for creators.', description: 'Dedicated RTX graphics, a colour-accurate 16" 165 Hz panel and advanced vapor-chamber cooling.', specs: [['GPU', 'RTX 4070'], ['Display', '16" QHD+ 165Hz']], tags: ['laptop', 'gaming', 'creator'], newArrival: true, taxRate: 18 },
  // ── Wearables
  { name: 'FitForge Pulse Smartwatch', category: 'wearables', brand: 'FitForge', icon: 'smartwatch', price: 3499, mrp: 6999, cost: 1500, colors: ['Black', 'Pink', 'Teal'], short: 'AMOLED, SpO2, 100+ sport modes, BT calling.', description: '1.43" AMOLED always-on display, heart rate and SpO2 tracking, Bluetooth calling and 10-day battery.', specs: [['Display', '1.43" AMOLED'], ['Battery', '10 days'], ['Calling', 'Bluetooth']], tags: ['smartwatch', 'fitness'], featured: true, dealHours: 60, taxRate: 18 },
  { name: 'FitForge Band 7', category: 'wearables', brand: 'FitForge', icon: 'smartwatch', price: 1999, mrp: 2999, cost: 800, colors: ['Black', 'Purple'], short: 'Slim fitness band with 14-day battery.', description: 'Track steps, sleep, stress and workouts with a lightweight band that lasts two weeks.', specs: [['Battery', '14 days'], ['Water', '5 ATM']], tags: ['fitness band', 'tracker'], taxRate: 18 },
  // ── Home & Kitchen
  { name: 'Kitchora Granite Non-Stick Pan', category: 'home-kitchen', brand: 'Kitchora', icon: 'pan', price: 1299, mrp: 2199, cost: 520, sizes: ['24 cm', '28 cm'], short: 'PFOA-free granite coating, induction compatible.', description: 'Five-layer granite non-stick coating, cool-touch handle and an induction-ready base.', specs: [['Coating', 'Granite, PFOA-free'], ['Induction', 'Yes']], tags: ['cookware', 'kitchen', 'pan'], featured: true, taxRate: 18 },
  { name: 'Ceramic Stoneware Mug Set (4)', category: 'home-kitchen', brand: 'Terra Home', icon: 'mug', price: 799, mrp: 1299, cost: 280, colors: ['Teal', 'Beige', 'Black'], short: 'Hand-glazed 350 ml mugs, microwave safe.', description: 'Set of four reactive-glaze stoneware mugs, each slightly unique.', specs: [['Capacity', '350 ml each'], ['Microwave safe', 'Yes']], tags: ['mugs', 'gift', 'kitchen'], newArrival: true, taxRate: 12 },
  { name: 'Nordic Arc Floor Lamp', category: 'home-kitchen', brand: 'Terra Home', icon: 'lamp', price: 3999, mrp: 5999, cost: 1800, colors: ['Black', 'Gold'], short: 'Arched metal lamp with linen shade, warm LED.', description: 'A sculptural arc lamp that throws soft, warm light across sofas and reading nooks.', specs: [['Height', '165 cm'], ['Bulb', 'E27 LED included']], tags: ['lamp', 'decor', 'lighting'], taxRate: 18 },
  { name: 'Insulated Steel Water Bottle', category: 'home-kitchen', brand: 'Kitchora', icon: 'bottle', price: 699, mrp: 1199, cost: 240, colors: ['Black', 'Teal', 'Pink', 'Silver'], sizes: ['750 ml', '1 L'], short: 'Keeps drinks cold 24h / hot 12h.', description: 'Double-wall vacuum insulated 304 stainless steel with a leak-proof cap.', specs: [['Material', '304 Stainless steel'], ['Cold', '24 h'], ['Hot', '12 h']], tags: ['bottle', 'hydration', 'gym'], dealHours: 26, taxRate: 18 },
  { name: 'Handwoven Cotton Cushion Covers (Set of 2)', category: 'home-kitchen', brand: 'Terra Home', icon: 'cushion', price: 649, mrp: 999, cost: 230, colors: ['Beige', 'Teal', 'Orange'], short: 'Textured 16x16" covers with hidden zip.', description: 'Handwoven cotton covers with a tactile texture to refresh any sofa.', specs: [['Size', '16 x 16 in'], ['Material', 'Cotton']], tags: ['cushion', 'decor'], taxRate: 12 },
  { name: 'Self-Watering Indoor Planter', category: 'home-kitchen', brand: 'Terra Home', icon: 'plant', price: 899, mrp: 1499, cost: 320, colors: ['White', 'Green'], short: 'Built-in reservoir keeps plants happy for weeks.', description: 'A minimal planter with a hidden water reservoir and level indicator.', specs: [['Diameter', '18 cm'], ['Reservoir', '600 ml']], tags: ['planter', 'decor', 'garden'], taxRate: 18 },
  // ── Beauty
  { name: 'Glowlab Vitamin C Serum 30ml', category: 'beauty', brand: 'Glowlab', icon: 'bottle', price: 599, mrp: 899, cost: 150, short: '15% Vitamin C + Ferulic acid for radiant skin.', description: 'A stable 15% ethyl ascorbic acid serum with ferulic acid and vitamin E to brighten and protect.', specs: [['Volume', '30 ml'], ['Skin type', 'All']], tags: ['serum', 'skincare', 'vitamin c'], featured: true, taxRate: 18 },
  { name: 'Glowlab Hydrating Ceramide Moisturizer', category: 'beauty', brand: 'Glowlab', icon: 'jar', price: 449, mrp: 699, cost: 120, sizes: ['50 g', '100 g'], short: 'Barrier-repair cream with ceramides & hyaluronic acid.', description: 'Lightweight gel-cream that restores the skin barrier and locks in moisture for 72 hours.', specs: [['Key ingredients', 'Ceramides, HA'], ['Fragrance', 'Free']], tags: ['moisturizer', 'skincare'], newArrival: true, taxRate: 18 },
  { name: 'Glowlab SPF 50 Sunscreen Gel', category: 'beauty', brand: 'Glowlab', icon: 'bottle', price: 399, mrp: 599, cost: 100, short: 'Invisible PA++++ protection, no white cast.', description: 'A water-light gel sunscreen with broad-spectrum SPF 50 PA++++.', specs: [['SPF', '50 PA++++'], ['Finish', 'Matte']], tags: ['sunscreen', 'skincare', 'summer'], dealHours: 40, taxRate: 18 },
  // ── Sports
  { name: 'FitForge Adjustable Dumbbells', category: 'sports-fitness', brand: 'FitForge', icon: 'dumbbell', price: 5999, mrp: 8999, cost: 3200, sizes: ['2-12 kg', '2-24 kg'], short: 'Replace 6 pairs of dumbbells with one dial.', description: 'Twist the dial to change weight in seconds. Durable steel plates with anti-slip handles.', specs: [['Range', '2-24 kg'], ['Increments', '2 kg']], tags: ['dumbbell', 'home gym', 'strength'], featured: true, taxRate: 18 },
  { name: 'Pro Grip Yoga Mat 6mm', category: 'sports-fitness', brand: 'FitForge', icon: 'yogamat', price: 999, mrp: 1799, cost: 380, colors: ['Purple', 'Teal', 'Black', 'Pink'], short: 'Non-slip TPE with alignment lines and strap.', description: 'Eco-friendly TPE mat with dual-texture grip, alignment guides and a carry strap.', specs: [['Thickness', '6 mm'], ['Material', 'TPE']], tags: ['yoga', 'mat', 'fitness'], taxRate: 12 },
  { name: 'Gym Duffel Bag with Shoe Pocket', category: 'sports-fitness', brand: 'Northpeak', icon: 'bag', price: 1299, mrp: 2299, cost: 520, colors: ['Black', 'Navy', 'Olive'], short: '40L duffel with ventilated shoe compartment.', description: 'Water-resistant, with a separate ventilated shoe pocket and wet pocket.', specs: [['Capacity', '40 L']], tags: ['gym bag', 'duffel', 'travel'], taxRate: 18 },
];

export const banners = [
  { title: 'The Festive Edit', subtitle: 'Up to 60% off on fashion, footwear & accessories', link: '/shop?category=fashion', ctaText: 'Shop the sale', palette: ['#111827', '#7c3aed', '#f472b6'] },
  { title: 'Upgrade Your Tech', subtitle: 'Flagship phones, laptops & audio — no-cost EMI available', link: '/shop?category=electronics', ctaText: 'Explore electronics', palette: ['#0f172a', '#2563eb', '#22d3ee'] },
  { title: 'Home, Reimagined', subtitle: 'Cookware, lighting & decor starting ₹499', link: '/shop?category=home-kitchen', ctaText: 'Refresh your space', palette: ['#1c1917', '#ea580c', '#fbbf24'] },
];

export const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Pari', 'Anika', 'Navya', 'Meera', 'Kavya', 'Riya', 'Priya', 'Neha', 'Rahul', 'Karthik', 'Sneha', 'Lakshmi', 'Harsha', 'Divya', 'Varun', 'Pooja'];
export const lastNames = ['Sharma', 'Reddy', 'Patel', 'Iyer', 'Nair', 'Gupta', 'Rao', 'Singh', 'Kumar', 'Menon', 'Das', 'Joshi', 'Verma', 'Naidu', 'Pillai'];
export const cities: [string, string, string][] = [
  ['Hyderabad', 'Telangana', '500081'],
  ['Bengaluru', 'Karnataka', '560034'],
  ['Mumbai', 'Maharashtra', '400050'],
  ['Delhi', 'Delhi', '110017'],
  ['Chennai', 'Tamil Nadu', '600040'],
  ['Pune', 'Maharashtra', '411014'],
  ['Kolkata', 'West Bengal', '700091'],
  ['Ahmedabad', 'Gujarat', '380015'],
  ['Jaipur', 'Rajasthan', '302017'],
  ['Kochi', 'Kerala', '682024'],
  ['Visakhapatnam', 'Andhra Pradesh', '530017'],
  ['Lucknow', 'Uttar Pradesh', '226010'],
  ['Karimnagar', 'Telangana', '505001'],
  ['Indore', 'Madhya Pradesh', '452010'],
];

export const reviewSnippets: [number, string, string][] = [
  [5, 'Absolutely love it', 'Exceeded my expectations. Quality is top notch and delivery was super quick.'],
  [5, 'Worth every rupee', 'Great value for money. Packaging was premium and the product feels durable.'],
  [4, 'Very good', 'Really good overall. Took a day longer to arrive but the product itself is excellent.'],
  [4, 'Nice quality', 'Good build and finish. Would recommend to friends and family.'],
  [5, 'Perfect gift', 'Bought this as a gift and they loved it. Will order again.'],
  [3, 'Decent', 'It is okay for the price. Expected slightly better finishing.'],
  [4, 'Comfortable and stylish', 'Fits well and looks exactly like the pictures.'],
  [2, 'Not as expected', 'Colour was a little different from the photos. Support helped with the exchange though.'],
  [5, 'Best purchase this year', 'Using it daily and it still feels brand new. Highly recommended!'],
];
