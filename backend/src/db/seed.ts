/**
 * Seeds a realistic demo store: catalog, customers, ~4 months of orders,
 * reviews and analytics sessions (so the admin dashboards have real shape).
 *
 *   npm run db:seed            # wipes demo data and reseeds
 */
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import slugify from 'slugify';
import { db, pool, schema } from './index';
import * as data from './seed-data';
import { productImagePaths } from './generate-images';
import { defaultSettings } from '../modules/settings/settings.service';

const s = schema;
const slug = (v: string) => slugify(v, { lower: true, strict: true });

// Deterministic PRNG so every seed produces the same store
let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const DAY = 86_400_000;

async function chunkInsert<T>(table: any, rows: T[], size = 1000) {
  for (let i = 0; i < rows.length; i += size) await db.insert(table).values(rows.slice(i, i + size) as any);
}

async function reset() {
  const tables = Object.values(s)
    .filter((t: any) => t && typeof t === 'object' && Symbol.for('drizzle:IsDrizzleTable') in t)
    .map((t: any) => `"${t[Symbol.for('drizzle:Name')]}"`);
  await db.execute(sql.raw(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`));
}

async function main() {
  console.log('🌱 Resetting database…');
  await reset();

  await db.insert(s.settings).values({ key: 'store', value: defaultSettings });

  // ───────── Users ─────────
  console.log('👤 Users');
  const pw = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 10);
  const customerPw = await bcrypt.hash('Customer@123', 10);
  const now = Date.now();

  const [admin] = await db
    .insert(s.users)
    .values({ name: 'Store Admin', email: (process.env.ADMIN_EMAIL || 'admin@shopnest.dev').toLowerCase(), phone: '+919999900000', passwordHash: pw, role: 'ADMIN', emailVerified: true, referralCode: 'ADMIN001' })
    .returning();
  await db.insert(s.users).values([
    { name: 'Store Manager', email: 'manager@shopnest.dev', passwordHash: pw, role: 'MANAGER', emailVerified: true, referralCode: 'MANAGER1' },
    { name: 'Support Agent', email: 'support@shopnest.dev', passwordHash: pw, role: 'SUPPORT', emailVerified: true, referralCode: 'SUPPORT1' },
  ]);

  const customerRows = Array.from({ length: 140 }, (_, i) => {
    const first = pick(data.firstNames);
    const last = pick(data.lastNames);
    // More signups recently (growth curve)
    const daysAgo = Math.floor(Math.pow(rand(), 1.6) * 150);
    return {
      name: `${first} ${last}`,
      email: i === 0 ? 'customer@shopnest.dev' : `${first}.${last}${i}@example.com`.toLowerCase(),
      phone: `+91${int(70000, 99999)}${String(i).padStart(5, '0')}`,
      passwordHash: customerPw,
      emailVerified: true,
      phoneVerified: chance(0.7),
      referralCode: `REF${String(i).padStart(5, '0')}`,
      createdAt: new Date(now - daysAgo * DAY - int(0, 86_000) * 1000),
    };
  });
  const customers = await db.insert(s.users).values(customerRows).returning();

  const addressRows = customers.map((c) => {
    const [city, state, pincode] = pick(data.cities);
    return { userId: c.id, fullName: c.name, phone: c.phone!.slice(3), line1: `${int(1, 999)}, ${pick(['Main Road', 'Temple Street', 'Market Yard Road', 'Canal Road', 'Bus Stand Road', 'Panchayat Office Road', 'Rythu Bazaar Road', 'Mandal Office Road'])}`, line2: `Near ${pick(['Bus Stand', 'Grain Market', 'Primary School', 'Rythu Seva Kendram'])}`, city, state, pincode, isDefault: true };
  });
  const addresses = await db.insert(s.addresses).values(addressRows).returning();
  const addressByUser = new Map(addresses.map((a) => [a.userId, a]));

  // ───────── Catalog ─────────
  console.log('🗂  Catalog');
  const catIds = new Map<string, string>();
  for (const [i, c] of data.categories.entries()) {
    const [row] = await db
      .insert(s.categories)
      .values({ name: c.name, slug: c.slug, description: c.description, image: `/images/categories/${c.slug}.svg`, parentId: c.parent ? catIds.get(c.parent) : null, sortOrder: i, isFeatured: Boolean(c.featured) })
      .returning();
    catIds.set(c.slug, row.id);
  }
  const brandRows = await db
    .insert(s.brands)
    .values(data.brands.map((b) => ({ name: b, slug: slug(b) })))
    .returning();
  const brandIds = new Map(brandRows.map((b) => [b.name, b.id]));

  type VariantInfo = { id: string; productId: string; price: number; costPrice: number | null; title: string; sku: string; image: string | null; productName: string; taxRate: number; images: string[] };
  const allVariants: VariantInfo[] = [];
  const productRows: (typeof s.products.$inferSelect)[] = [];

  for (const [pi, p] of data.products.entries()) {
    const { images } = productImagePaths(p);
    const dims: { name: string; values: string[] }[] = [{ name: 'Pack size', values: p.packs.map((x) => x[0]) }];
    const optionNames = dims.map((d) => d.name);

    // One variant per pack size
    const combos: Record<string, string>[] = p.packs.map(([label]) => ({ 'Pack size': label }));

    const createdAt = new Date(now - (p.newArrival ? int(2, 20) : int(60, 200)) * DAY);
    const [prod] = await db
      .insert(s.products)
      .values({
        name: p.name,
        slug: slug(p.name),
        shortDescription: p.short,
        description: p.description,
        categoryId: catIds.get(p.category)!,
        brandId: brandIds.get(p.brand),
        images,
        tags: p.tags,
        specs: p.specs.map(([label, value]) => ({ label, value })),
        optionNames,
        price: p.price * 100,
        compareAtPrice: p.mrp ? p.mrp * 100 : null,
        taxRate: p.taxRate ?? 18,
        isFeatured: Boolean(p.featured),
        isNewArrival: Boolean(p.newArrival),
        dealEndsAt: p.dealHours ? new Date(now + p.dealHours * 3_600_000) : null,
        metaTitle: `${p.name} | ${p.brand}`,
        metaDescription: p.short,
        createdAt,
      })
      .returning();
    productRows.push(prod);

    const variantRows = combos.map((combo, vi) => {
      const [, packPrice, packMrp] = p.packs[vi];
      const price = packPrice * 100;
      const stockRoll = rand();
      return {
        productId: prod.id,
        sku: `${p.brand.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${String(pi + 1).padStart(3, '0')}-${String(vi + 1).padStart(2, '0')}`,
        title: combo['Pack size'],
        options: combo,
        price,
        compareAtPrice: packMrp > packPrice ? packMrp * 100 : null,
        costPrice: Math.round(packPrice * 0.74) * 100,
        stock: stockRoll < 0.06 ? 0 : stockRoll < 0.16 ? int(1, 6) : int(10, 120),
        image: null,
      };
    });
    const variants = await db.insert(s.productVariants).values(variantRows).returning();
    variants.forEach((v) => allVariants.push({ id: v.id, productId: prod.id, price: v.price, costPrice: v.costPrice, title: v.title, sku: v.sku, image: v.image ?? images[0], productName: prod.name, taxRate: prod.taxRate, images }));
  }

  // ───────── Promotions & CMS ─────────
  console.log('🏷  Coupons, banners, pages');
  await db.insert(s.coupons).values([
    { code: 'WELCOME10', description: '10% off your first order (up to ₹300)', type: 'PERCENT', value: 10, maxDiscount: 30000, firstOrderOnly: true },
    { code: 'FLAT200', description: '₹200 off on orders above ₹1,499', type: 'FLAT', value: 20000, minOrderValue: 149900, perUserLimit: 3 },
    { code: 'SEASON10', description: '10% off on orders above ₹3,000 (up to ₹600)', type: 'PERCENT', value: 10, maxDiscount: 60000, minOrderValue: 300000, perUserLimit: 2, endsAt: new Date(now + 20 * DAY) },
    { code: 'FREESHIP', description: 'Free shipping on any order', type: 'FREE_SHIPPING', value: 0, perUserLimit: 5 },
    { code: 'ORGANIC100', description: '₹100 off organic & bio products above ₹999', type: 'FLAT', value: 10000, minOrderValue: 99900, applicableCategoryIds: [catIds.get('organic-bio')!], perUserLimit: 1 },
    { code: 'VIP15', description: 'Private: 15% off for loyal customers', type: 'PERCENT', value: 15, maxDiscount: 150000, isPublic: false, perUserLimit: 1 },
  ]);

  await db.insert(s.banners).values(
    data.banners.map((b, i) => ({ title: b.title, subtitle: b.subtitle, image: `/images/banners/banner-${i + 1}.svg`, link: b.link, ctaText: b.ctaText, position: 'HERO' as const, sortOrder: i })),
  );

  const policy = (title: string, body: string) => `# ${title}\n\n${body}`;
  await db.insert(s.pages).values([
    { slug: 'about', title: 'About Us', content: policy('About Us', `We supply farmers and gardeners with genuine fertilizers, micronutrients and bio-inputs at fair prices, delivered to the farm gate.\n\n## Our promise\n\n- **Genuine stock** — sealed bags with batch numbers, bought from licensed manufacturers.\n- **Right advice** — dosage notes on every product and WhatsApp support from agri-trained staff.\n- **Fast delivery** — most orders ship within 24 hours.\n- **Easy payments** — UPI, cards, netbanking and Cash on Delivery.`) },
    { slug: 'shipping-policy', title: 'Shipping Policy', content: policy('Shipping Policy', '- Orders are processed within 24 hours on business days.\n- Free shipping on orders above ₹999; a flat ₹79 fee applies otherwise.\n- Nearby districts: 2–3 days. Rest of India: 4–8 days.\n- You will receive tracking details by SMS and WhatsApp as soon as your order ships.\n- Please check the bags at the time of delivery and tell us about any damage within 48 hours.') },
    { slug: 'returns-policy', title: 'Returns & Refunds', content: policy('Returns & Refunds', `- Sealed, unopened packs can be returned within ${defaultSettings.returnWindowDays} days of delivery.\n- Damaged, leaking or wrong items are replaced or refunded in full. Share a photo on WhatsApp.\n- Opened fertilizers, liquids and bio-cultures cannot be returned because they are perishable.\n- Refunds for prepaid orders go back to the original payment method within 5–7 business days.`) },
    { slug: 'privacy-policy', title: 'Privacy Policy', content: policy('Privacy Policy', 'We collect only the information needed to process your orders and improve your experience. We never sell your data. Payment details are processed by our PCI-DSS compliant payment partner and are never stored on our servers. You can request deletion of your account at any time by contacting support.') },
    { slug: 'terms', title: 'Terms & Conditions', content: policy('Terms & Conditions', 'By using this website you agree to these terms. Prices and availability are subject to change without notice. We reserve the right to cancel orders in case of pricing errors or suspected fraud, with a full refund. Fertilizer dosages shown on the site are indicative; follow your soil test report and local agriculture department advice.') },
    { slug: 'faq', title: 'FAQs', content: policy('Frequently Asked Questions', '### Are the fertilizers genuine?\nYes. Every pack is sealed and carries the manufacturer batch number, manufacturing date and fertilizer grade.\n\n### How much should I apply?\nDosage notes are on each product page. For best results, test your soil first and follow the report. WhatsApp us your crop and acreage if you need help.\n\n### Is Cash on Delivery available?\nYes, on most pincodes for orders up to ₹10,000.\n\n### How do I track my order?\nGo to **My Orders** and open your order. You will find the courier and tracking link, and we also send updates on WhatsApp.\n\n### How do I use a coupon?\nApply it in your cart or at checkout. Only one coupon can be used per order.') },
  ]);

  // ───────── Orders (≈4 months, growing) ─────────
  console.log('📦 Orders');
  const popularity = productRows.map((p) => (p.isFeatured ? 3 : 1) * (0.5 + rand()));
  const totalPop = popularity.reduce((a, b) => a + b, 0);
  const pickProduct = () => {
    let r = rand() * totalPop;
    for (let i = 0; i < productRows.length; i++) if ((r -= popularity[i]) <= 0) return productRows[i];
    return productRows[0];
  };
  const variantsByProduct = new Map<string, VariantInfo[]>();
  allVariants.forEach((v) => variantsByProduct.set(v.productId, [...(variantsByProduct.get(v.productId) ?? []), v]));

  const settings = defaultSettings;
  const orderRows: any[] = [];
  const itemRows: any[] = [];
  const historyRows: any[] = [];
  const paymentRows: any[] = [];
  const sold = new Map<string, number>();
  const purchasesByUser = new Map<string, { productId: string; at: Date }[]>();
  const firstOrderDone = new Set<string>();
  const DAYS = 120;
  let seq = 1;
  const sources = ['google', 'instagram', 'facebook', 'direct', 'whatsapp', 'email', 'youtube'];

  for (let d = DAYS; d >= 0; d--) {
    const day = new Date(now - d * DAY);
    const weekday = day.getDay();
    const growth = 1 + (DAYS - d) / 70; // ~2.7x growth over the period
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.35 : 1;
    const festival = d < 25 && d > 12 ? 1.6 : 1; // a recent sale spike
    const count = Math.max(0, Math.round((2 + rand() * 3) * growth * weekendBoost * festival));

    for (let k = 0; k < count; k++) {
      const eligible = customers.filter((c) => c.createdAt.getTime() < day.getTime());
      if (!eligible.length) continue;
      // Repeat customers: bias toward early customers sometimes
      const user = chance(0.35) ? eligible[Math.floor(Math.pow(rand(), 2) * eligible.length)] : pick(eligible);
      const hour = pick([9, 10, 11, 12, 13, 13, 14, 15, 17, 18, 19, 20, 20, 21, 21, 22, 22, 23, 0, 1, 8]);
      const createdAt = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, int(0, 59), int(0, 59));
      if (createdAt.getTime() > now) continue;
      const orderId = crypto.randomUUID();

      const lines = new Map<string, { v: VariantInfo; qty: number }>();
      const nItems = chance(0.6) ? 1 : chance(0.7) ? 2 : 3;
      for (let i = 0; i < nItems; i++) {
        const prod = pickProduct();
        const v = pick(variantsByProduct.get(prod.id)!);
        const existing = lines.get(v.id);
        lines.set(v.id, { v, qty: (existing?.qty ?? 0) + (chance(0.55) ? 1 : chance(0.6) ? 2 : int(3, 5)) });
      }

      let subtotal = 0;
      let tax = 0;
      for (const { v, qty } of lines.values()) {
        const total = v.price * qty;
        subtotal += total;
        tax += Math.round((total * v.taxRate) / (100 + v.taxRate));
        itemRows.push({ orderId, productId: v.productId, variantId: v.id, name: v.productName, variantTitle: v.title, sku: v.sku, image: v.image, price: v.price, costPrice: v.costPrice, quantity: qty, total, taxRate: v.taxRate });
        sold.set(v.productId, (sold.get(v.productId) ?? 0) + qty);
      }

      let couponCode: string | null = null;
      let discount = 0;
      if (!firstOrderDone.has(user.id) && chance(0.5)) {
        couponCode = 'WELCOME10';
        discount = Math.min(Math.round(subtotal * 0.1), 30000);
      } else if (subtotal >= 300000 && chance(0.25)) {
        couponCode = 'SEASON10';
        discount = Math.min(Math.round(subtotal * 0.1), 60000);
      } else if (subtotal >= 149900 && chance(0.2)) {
        couponCode = 'FLAT200';
        discount = 20000;
      }
      firstOrderDone.add(user.id);

      const paymentMethod = chance(subtotal > 1500000 ? 0.05 : 0.3) ? 'COD' : 'RAZORPAY';
      const shippingFee = subtotal - discount >= settings.freeShippingThreshold ? 0 : settings.shippingFee;
      const codFee = paymentMethod === 'COD' ? settings.codFee : 0;
      const total = subtotal - discount + shippingFee + codFee;

      // Lifecycle by age
      const age = d;
      const roll = rand();
      let status: schema.OrderStatus;
      if (age > 8) status = roll < 0.82 ? 'DELIVERED' : roll < 0.9 ? 'CANCELLED' : roll < 0.95 ? 'RETURNED' : roll < 0.97 ? 'REFUNDED' : 'DELIVERED';
      else if (age > 4) status = roll < 0.5 ? 'DELIVERED' : roll < 0.75 ? 'SHIPPED' : roll < 0.85 ? 'OUT_FOR_DELIVERY' : roll < 0.93 ? 'CANCELLED' : 'PACKED';
      else if (age > 1) status = roll < 0.35 ? 'SHIPPED' : roll < 0.6 ? 'PACKED' : roll < 0.85 ? 'PROCESSING' : roll < 0.92 ? 'CONFIRMED' : 'CANCELLED';
      else status = roll < 0.6 ? 'CONFIRMED' : roll < 0.75 ? 'PROCESSING' : roll < 0.88 ? 'PENDING_PAYMENT' : 'CONFIRMED';
      if (status === 'PENDING_PAYMENT' && paymentMethod === 'COD') status = 'CONFIRMED';

      const paid = paymentMethod === 'RAZORPAY' ? status !== 'PENDING_PAYMENT' : status === 'DELIVERED' || status === 'RETURNED' || status === 'REFUNDED';
      const paymentStatus: schema.PaymentStatus = status === 'PENDING_PAYMENT' ? 'PENDING' : status === 'REFUNDED' || status === 'RETURNED' ? 'REFUNDED' : status === 'CANCELLED' ? (paymentMethod === 'RAZORPAY' ? 'REFUNDED' : 'PENDING') : paid ? 'PAID' : 'PENDING';

      const flow: schema.OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
      const shipped = ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'REFUNDED'].includes(status);
      const shippedAt = shipped ? new Date(createdAt.getTime() + int(18, 40) * 3_600_000) : null;
      const deliveredAt = ['DELIVERED', 'RETURNED', 'REFUNDED'].includes(status) ? new Date(shippedAt!.getTime() + int(1, 5) * DAY) : null;
      const carrier = shipped ? pick(['Delhivery', 'Blue Dart', 'Ekart', 'XpressBees', 'DTDC']) : null;
      const trackingNumber = shipped ? `${carrier!.slice(0, 2).toUpperCase()}${int(100000000, 999999999)}` : null;

      const addr = addressByUser.get(user.id)!;
      const src = pick(sources);
      const orderNumber = `SN${createdAt.toISOString().slice(2, 10).replace(/-/g, '')}${String(seq++).padStart(4, '0')}`;
      const earned = paid && status === 'DELIVERED' ? Math.floor(total / 10000) * settings.loyaltyEarnPer100 : 0;

      orderRows.push({
        id: orderId,
        orderNumber,
        userId: user.id,
        status,
        paymentStatus,
        paymentMethod,
        subtotal,
        discount,
        shippingFee,
        codFee,
        tax,
        total,
        couponCode,
        loyaltyPointsEarned: earned,
        shippingAddress: { fullName: addr.fullName, phone: addr.phone, line1: addr.line1, line2: addr.line2, landmark: null, city: addr.city, state: addr.state, pincode: addr.pincode, country: 'India' },
        razorpayOrderId: paymentMethod === 'RAZORPAY' ? `order_seed${String(seq).padStart(8, '0')}` : null,
        razorpayPaymentId: paymentMethod === 'RAZORPAY' && paid ? `pay_seed${String(seq).padStart(8, '0')}` : null,
        carrier,
        trackingNumber,
        trackingUrl: trackingNumber ? `https://www.google.com/search?q=${encodeURIComponent(`${carrier} tracking ${trackingNumber}`)}` : null,
        expectedDeliveryAt: shippedAt ? new Date(shippedAt.getTime() + 4 * DAY) : null,
        shippedAt,
        outForDeliveryAt: deliveredAt ? new Date(deliveredAt.getTime() - 5 * 3_600_000) : status === 'OUT_FOR_DELIVERY' ? new Date(now - 3 * 3_600_000) : null,
        deliveredAt,
        cancelledAt: status === 'CANCELLED' ? new Date(createdAt.getTime() + int(1, 20) * 3_600_000) : null,
        cancelReason: status === 'CANCELLED' ? pick(['Ordered by mistake', 'Found a better price', 'Delivery taking too long', 'Changed my mind']) : null,
        utmSource: src === 'direct' ? null : src,
        utmMedium: src === 'google' ? 'cpc' : src === 'instagram' || src === 'facebook' ? 'social' : src === 'email' ? 'email' : src === 'whatsapp' ? 'chat' : null,
        utmCampaign: src === 'direct' ? null : pick(['festive_sale', 'new_arrivals', 'retargeting', 'brand']),
        device: pick(['mobile', 'mobile', 'mobile', 'desktop', 'tablet']),
        createdAt,
        updatedAt: deliveredAt ?? shippedAt ?? createdAt,
      });

      if (couponCode) (orderRows.at(-1) as any).__coupon = { code: couponCode, discount };
      // Status history
      historyRows.push({ orderId, status: status === 'PENDING_PAYMENT' ? 'PENDING_PAYMENT' : 'CONFIRMED', note: 'Order placed', createdAt });
      if (status !== 'PENDING_PAYMENT' && status !== 'CANCELLED') {
        const target = ['RETURNED', 'REFUNDED'].includes(status) ? 'DELIVERED' : status;
        const idx = flow.indexOf(target as schema.OrderStatus);
        for (let i = 1; i <= idx; i++) {
          const at = flow[i] === 'SHIPPED' ? shippedAt! : flow[i] === 'DELIVERED' ? deliveredAt! : new Date(createdAt.getTime() + i * 6 * 3_600_000);
          historyRows.push({ orderId, status: flow[i], note: flow[i] === 'SHIPPED' ? `Shipped via ${carrier} (${trackingNumber})` : null, createdAt: at });
        }
        if (status === 'RETURNED' || status === 'REFUNDED') historyRows.push({ orderId, status, note: 'Return processed', createdAt: new Date(deliveredAt!.getTime() + 3 * DAY) });
      }
      if (status === 'CANCELLED') historyRows.push({ orderId, status: 'CANCELLED', note: 'Cancelled by customer', createdAt: new Date(createdAt.getTime() + 3_600_000) });

      if (paymentMethod === 'RAZORPAY') {
        paymentRows.push({ orderId, provider: 'razorpay', providerOrderId: orderRows.at(-1).razorpayOrderId, providerPaymentId: orderRows.at(-1).razorpayPaymentId, amount: total, status: paid ? 'PAID' : 'PENDING', method: pick(['upi', 'upi', 'upi', 'card', 'netbanking', 'wallet']), createdAt });
      }

      if (status === 'DELIVERED') {
        const list = purchasesByUser.get(user.id) ?? [];
        for (const { v } of lines.values()) list.push({ productId: v.productId, at: deliveredAt! });
        purchasesByUser.set(user.id, list);
      }
    }
  }

  const coupons = await db.select().from(s.coupons);
  const couponIdByCode = new Map(coupons.map((c) => [c.code, c.id]));
  const redemptions = orderRows
    .filter((o) => o.__coupon && !['CANCELLED', 'PENDING_PAYMENT'].includes(o.status))
    .map((o) => ({ couponId: couponIdByCode.get(o.__coupon.code)!, userId: o.userId, orderId: o.id, discount: o.__coupon.discount, createdAt: o.createdAt }));
  orderRows.forEach((o) => delete o.__coupon);

  await chunkInsert(s.orders, orderRows, 500);
  await chunkInsert(s.orderItems, itemRows);
  await chunkInsert(s.orderStatusHistory, historyRows);
  await chunkInsert(s.payments, paymentRows);
  if (redemptions.length) await chunkInsert(s.couponRedemptions, redemptions);
  for (const [code, id] of couponIdByCode) {
    const n = redemptions.filter((r) => r.couponId === id).length;
    if (n) await db.update(s.coupons).set({ usedCount: n }).where(sql`${s.coupons.id} = ${id}`);
    void code;
  }
  for (const [productId, n] of sold) await db.update(s.products).set({ soldCount: n }).where(sql`${s.products.id} = ${productId}`);

  // Loyalty balances
  const earnedByUser = new Map<string, number>();
  orderRows.forEach((o) => o.loyaltyPointsEarned && earnedByUser.set(o.userId, (earnedByUser.get(o.userId) ?? 0) + o.loyaltyPointsEarned));
  const loyaltyRows = orderRows.filter((o) => o.loyaltyPointsEarned).map((o) => ({ userId: o.userId, points: o.loyaltyPointsEarned, reason: `Earned on order ${o.orderNumber}`, orderId: o.id, createdAt: o.deliveredAt }));
  await chunkInsert(s.loyaltyTransactions, loyaltyRows);
  for (const [userId, pts] of earnedByUser) await db.update(s.users).set({ loyaltyPoints: pts }).where(sql`${s.users.id} = ${userId}`);

  // Return requests for returned orders
  const returnRows = orderRows
    .filter((o) => o.status === 'RETURNED' || o.status === 'REFUNDED')
    .map((o) => ({ orderId: o.id, userId: o.userId, reason: pick(['Size issue', 'Damaged product', 'Not as described', 'Quality not as expected']), status: 'REFUNDED' as const, refundAmount: o.total, createdAt: new Date(o.deliveredAt.getTime() + DAY) }));
  const latestDelivered = orderRows.filter((o) => o.status === 'DELIVERED').slice(-3);
  latestDelivered.forEach((o) => returnRows.push({ orderId: o.id, userId: o.userId, reason: 'Size issue', status: 'REQUESTED' as any, refundAmount: null as any, createdAt: new Date() }));
  if (returnRows.length) await chunkInsert(s.returnRequests, returnRows);

  // ───────── Reviews ─────────
  console.log('⭐ Reviews');
  const reviewRows: any[] = [];
  const seen = new Set<string>();
  for (const [userId, list] of purchasesByUser) {
    for (const p of list) {
      const key = `${userId}:${p.productId}`;
      if (seen.has(key) || !chance(0.45)) continue;
      seen.add(key);
      const [rating, title, body] = chance(0.7) ? pick(data.reviewSnippets.filter((r) => r[0] >= 4)) : pick(data.reviewSnippets);
      reviewRows.push({ productId: p.productId, userId, rating, title, body, isVerifiedPurchase: true, status: chance(0.92) ? 'APPROVED' : 'PENDING', helpfulCount: int(0, 40), createdAt: new Date(p.at.getTime() + int(1, 6) * DAY) });
    }
  }
  await chunkInsert(s.reviews, reviewRows);
  await db.execute(sql`
    update products p set
      rating_avg = coalesce(r.avg, 0), rating_count = coalesce(r.n, 0)
    from (select product_id, round(avg(rating)::numeric, 1) as avg, count(*) as n from reviews where status = 'APPROVED' group by product_id) r
    where r.product_id = p.id`);

  // Q&A
  const qaRows = productRows.slice(0, 12).map((p, i) => ({
    productId: p.id,
    userId: customers[i].id,
    question: pick(['Is this suitable for paddy?', 'How much should I use per acre?', 'Can I mix this with other fertilizers?', 'What is the shelf life?', 'Can I use it through drip irrigation?']),
    answer: chance(0.75) ? pick(['Yes, it works well for paddy. Follow the dosage on the product page.', 'Typically 40–50 kg per acre as a basal dose. For exact quantity please follow your soil test.', 'It can be mixed with most fertilizers, but do not pre-mix with calcium-based products.', 'Shelf life is printed on the bag. Store in a cool, dry place away from moisture.', 'Yes, it dissolves fully and is suitable for drip and foliar use.']) : null,
    answeredAt: new Date(),
  }));
  await db.insert(s.questions).values(qaRows);

  // ───────── Analytics sessions ─────────
  console.log('📈 Analytics events');
  const events: any[] = [];
  const devices = ['mobile', 'mobile', 'mobile', 'desktop', 'desktop', 'tablet'];
  const ordersByDay = new Map<string, any[]>();
  orderRows.forEach((o) => {
    const k = o.createdAt.toISOString().slice(0, 10);
    ordersByDay.set(k, [...(ordersByDay.get(k) ?? []), o]);
  });
  const searchTerms = ['tshirt', 'headphones', 'running shoes', 'smartwatch', 'dress', 'laptop', 'vitamin c serum', 'yoga mat', 'backpack', 'phone 5g', 'jeans', 'water bottle', 'earbuds', 'hoodie', 'non stick pan'];

  for (let d = 60; d >= 0; d--) {
    const day = new Date(now - d * DAY);
    const k = day.toISOString().slice(0, 10);
    const dayOrders = ordersByDay.get(k) ?? [];
    const sessions = Math.round(dayOrders.length * (28 + rand() * 10)) + int(20, 40);
    for (let i = 0; i < sessions; i++) {
      const sessionId = `s_${k}_${i}`;
      const at = (m: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), pick([9, 11, 13, 14, 18, 19, 20, 21, 22]), m, int(0, 59));
      const src = pick(sources);
      const base = { sessionId, device: pick(devices), utmSource: src === 'direct' ? null : src, utmMedium: src === 'google' ? 'cpc' : null, referrer: src === 'direct' ? null : `https://${src}.com/` };
      const userId = chance(0.3) ? pick(customers).id : null;
      events.push({ ...base, userId, type: 'PAGE_VIEW', path: '/', createdAt: at(1) });
      if (chance(0.25)) events.push({ ...base, userId, type: 'SEARCH', query: pick(searchTerms), path: '/shop', createdAt: at(2) });
      if (!chance(0.62)) continue;
      const prod = pickProduct();
      events.push({ ...base, userId, type: 'PRODUCT_VIEW', productId: prod.id, path: `/product/${prod.slug}`, createdAt: at(3) });
      if (chance(0.4)) {
        const p2 = pickProduct();
        events.push({ ...base, userId, type: 'PRODUCT_VIEW', productId: p2.id, path: `/product/${p2.slug}`, createdAt: at(5) });
      }
      if (!chance(0.22)) continue;
      events.push({ ...base, userId, type: 'ADD_TO_CART', productId: prod.id, value: prod.price, createdAt: at(7) });
      if (chance(0.15)) events.push({ ...base, userId, type: 'WISHLIST_ADD', productId: prod.id, createdAt: at(8) });
      if (!chance(0.45)) continue;
      events.push({ ...base, userId, type: 'BEGIN_CHECKOUT', value: prod.price, createdAt: at(10) });
      if (chance(0.75)) events.push({ ...base, userId, type: 'ADD_PAYMENT_INFO', createdAt: at(12) });
    }
    // Purchases map 1:1 to real orders
    dayOrders
      .filter((o) => o.status !== 'PENDING_PAYMENT')
      .forEach((o, i) => {
        const sessionId = `p_${k}_${i}`;
        const base = { sessionId, userId: o.userId, device: o.device, utmSource: o.utmSource, utmMedium: o.utmMedium };
        events.push({ ...base, type: 'PAGE_VIEW', path: '/', createdAt: new Date(o.createdAt.getTime() - 900_000) });
        const first = itemRows.find((it) => it.orderId === o.id);
        events.push({ ...base, type: 'PRODUCT_VIEW', productId: first?.productId, createdAt: new Date(o.createdAt.getTime() - 700_000) });
        events.push({ ...base, type: 'ADD_TO_CART', productId: first?.productId, value: first?.price, createdAt: new Date(o.createdAt.getTime() - 500_000) });
        events.push({ ...base, type: 'BEGIN_CHECKOUT', value: o.total, createdAt: new Date(o.createdAt.getTime() - 300_000) });
        events.push({ ...base, type: 'ADD_PAYMENT_INFO', createdAt: new Date(o.createdAt.getTime() - 120_000) });
        events.push({ ...base, type: 'PURCHASE', value: o.total, meta: { orderId: o.id }, createdAt: o.createdAt });
      });
  }
  await chunkInsert(s.analyticsEvents, events, 2000);

  const productViews = new Map<string, number>();
  events.filter((e) => e.type === 'PRODUCT_VIEW' && e.productId).forEach((e) => productViews.set(e.productId, (productViews.get(e.productId) ?? 0) + 1));
  for (const [id, n] of productViews) await db.update(s.products).set({ viewCount: n }).where(sql`${s.products.id} = ${id}`);

  // ───────── Abandoned carts ─────────
  console.log('🛒 Carts');
  const cartUsers = customers.slice(10, 22);
  for (const [i, u] of cartUsers.entries()) {
    const [cart] = await db
      .insert(s.carts)
      .values({ userId: u.id, lastActivityAt: new Date(now - (i < 6 ? int(4, 40) : int(0, 2)) * 3_600_000), reminderCount: i < 3 ? 1 : 0, lastReminderAt: i < 3 ? new Date(now - 3_600_000) : null })
      .returning();
    const picks = new Set([pick(allVariants).id, pick(allVariants).id]);
    await db.insert(s.cartItems).values([...picks].map((variantId) => ({ cartId: cart.id, variantId, quantity: int(1, 2) })));
  }

  // Sample notification log
  await db.insert(s.notificationLogs).values(
    orderRows.slice(-25).flatMap((o) => [
      { channel: 'WHATSAPP' as const, to: `+91${o.shippingAddress.phone}`, template: 'ORDER_CONFIRMED', body: `Your order ${o.orderNumber} is confirmed!`, status: 'SENT' as const, userId: o.userId, orderId: o.id, sentAt: o.createdAt, createdAt: o.createdAt, deliveryStatus: pick(['delivered', 'read', 'read']) },
      { channel: 'EMAIL' as const, to: customers.find((c) => c.id === o.userId)!.email!, template: 'ORDER_CONFIRMED', subject: `Order confirmed — ${o.orderNumber}`, status: 'SENT' as const, userId: o.userId, orderId: o.id, sentAt: o.createdAt, createdAt: o.createdAt },
    ]),
  );

  console.log(`\n✅ Seed complete
   Products:  ${productRows.length} (${allVariants.length} variants)
   Customers: ${customers.length}
   Orders:    ${orderRows.length}
   Reviews:   ${reviewRows.length}
   Events:    ${events.length}

   Admin login:    ${admin.email} / ${process.env.ADMIN_PASSWORD || 'Admin@12345'}
   Customer login: customer@shopnest.dev / Customer@123`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
