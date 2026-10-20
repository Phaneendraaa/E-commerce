// ─────────────────────────────────────────────────────────────
//  E-commerce platform — data model (Drizzle ORM / PostgreSQL)
//  All money values are integers in the smallest currency unit
//  (paise for INR) to avoid floating point errors.
// ─────────────────────────────────────────────────────────────
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const ts = (name: string) => timestamp(name, { withTimezone: true });
const textArr = (name: string) => text(name).array().notNull().default(sql`'{}'::text[]`);

// ───────────────────────── Enums ─────────────────────────

export const roleEnum = pgEnum('role', ['CUSTOMER', 'SUPPORT', 'MANAGER', 'ADMIN']);
export const otpPurposeEnum = pgEnum('otp_purpose', ['LOGIN', 'VERIFY_PHONE', 'VERIFY_EMAIL', 'RESET_PASSWORD']);
export const addressTypeEnum = pgEnum('address_type', ['HOME', 'WORK', 'OTHER']);
export const reviewStatusEnum = pgEnum('review_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const couponTypeEnum = pgEnum('coupon_type', ['PERCENT', 'FLAT', 'FREE_SHIPPING']);
export const orderStatusEnum = pgEnum('order_status', [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
  'REFUNDED',
  'FAILED',
]);
export const paymentStatusEnum = pgEnum('payment_status', ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']);
export const paymentMethodEnum = pgEnum('payment_method', ['RAZORPAY', 'COD']);
export const returnStatusEnum = pgEnum('return_status', ['REQUESTED', 'APPROVED', 'REJECTED', 'PICKED_UP', 'REFUNDED']);
export const bannerPositionEnum = pgEnum('banner_position', ['HERO', 'PROMO_STRIP', 'MID', 'CATEGORY']);
export const channelEnum = pgEnum('notification_channel', ['EMAIL', 'SMS', 'WHATSAPP']);
export const notificationStatusEnum = pgEnum('notification_status', ['QUEUED', 'SENT', 'FAILED', 'SKIPPED']);
export const reminderTypeEnum = pgEnum('reminder_type', [
  'ORDER_CONFIRMED',
  'ORDER_SHIPPED',
  'TRACKING_REMINDER',
  'OUT_FOR_DELIVERY',
  'DELIVERY_FOLLOWUP',
  'REVIEW_REQUEST',
  'ABANDONED_CART',
  'PAYMENT_PENDING',
]);
export const reminderStatusEnum = pgEnum('reminder_status', ['PENDING', 'SENT', 'CANCELLED', 'FAILED']);
export const eventTypeEnum = pgEnum('event_type', [
  'PAGE_VIEW',
  'PRODUCT_VIEW',
  'SEARCH',
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'WISHLIST_ADD',
  'BEGIN_CHECKOUT',
  'ADD_PAYMENT_INFO',
  'PURCHASE',
]);

export type Role = (typeof roleEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number];
export type ReminderType = (typeof reminderTypeEnum.enumValues)[number];
export type EventType = (typeof eventTypeEnum.enumValues)[number];
export type Channel = (typeof channelEnum.enumValues)[number];

// ───────────────────────── Users & Auth ─────────────────────────

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').unique(),
    phone: text('phone').unique(),
    name: text('name').notNull(),
    passwordHash: text('password_hash'),
    role: roleEnum('role').notNull().default('CUSTOMER'),
    avatar: text('avatar'),
    googleId: text('google_id').unique(),
    emailVerified: boolean('email_verified').notNull().default(false),
    phoneVerified: boolean('phone_verified').notNull().default(false),
    isBlocked: boolean('is_blocked').notNull().default(false),
    whatsappOptIn: boolean('whatsapp_opt_in').notNull().default(true),
    marketingOptIn: boolean('marketing_opt_in').notNull().default(true),
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    referralCode: text('referral_code').notNull().unique(),
    referredById: uuid('referred_by_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    lastLoginAt: ts('last_login_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('users_role_idx').on(t.role), index('users_created_idx').on(t.createdAt)],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_user_idx').on(t.userId)],
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: id(),
    target: text('target').notNull(), // E.164 phone or email
    codeHash: text('code_hash').notNull(),
    purpose: otpPurposeEnum('purpose').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('otp_target_idx').on(t.target, t.purpose)],
);

export const addresses = pgTable(
  'addresses',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    line1: text('line1').notNull(),
    line2: text('line2'),
    landmark: text('landmark'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    pincode: text('pincode').notNull(),
    country: text('country').notNull().default('India'),
    type: addressTypeEnum('type').notNull().default('HOME'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('addresses_user_idx').on(t.userId)],
);

// ───────────────────────── Catalog ─────────────────────────

export const categories = pgTable(
  'categories',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    image: text('image'),
    parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    isFeatured: boolean('is_featured').notNull().default(false),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('categories_parent_idx').on(t.parentId)],
);

export const brands = pgTable('brands', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
});

export type Spec = { label: string; value: string };

export const products = pgTable(
  'products',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    shortDescription: text('short_description'),
    description: text('description'),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    images: textArr('images'), // paths served by the frontend /public folder
    tags: textArr('tags'),
    specs: jsonb('specs').$type<Spec[]>().notNull().default([]),
    optionNames: textArr('option_names'), // e.g. ["Size","Color"]
    // Denormalized from variants (min active price) for fast sorting/filtering
    price: integer('price').notNull(),
    compareAtPrice: integer('compare_at_price'),
    taxRate: integer('tax_rate').notNull().default(18), // GST %
    hsnCode: text('hsn_code'),
    weightGrams: integer('weight_grams'),
    isActive: boolean('is_active').notNull().default(true),
    isFeatured: boolean('is_featured').notNull().default(false),
    isNewArrival: boolean('is_new_arrival').notNull().default(false),
    ratingAvg: doublePrecision('rating_avg').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    soldCount: integer('sold_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),
    dealEndsAt: ts('deal_ends_at'), // flash-sale countdown
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('products_category_idx').on(t.categoryId),
    index('products_brand_idx').on(t.brandId),
    index('products_active_featured_idx').on(t.isActive, t.isFeatured),
    index('products_price_idx').on(t.price),
    index('products_created_idx').on(t.createdAt),
    index('products_search_idx').using(
      'gin',
      sql`to_tsvector('english', coalesce(${t.name}, '') || ' ' || coalesce(${t.shortDescription}, ''))`,
    ),
  ],
);

export const productVariants = pgTable(
  'product_variants',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull().unique(),
    title: text('title').notNull(), // "M / Black" or "Default"
    options: jsonb('options').$type<Record<string, string>>().notNull().default({}),
    price: integer('price').notNull(),
    compareAtPrice: integer('compare_at_price'),
    costPrice: integer('cost_price'), // for margin analytics
    stock: integer('stock').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    image: text('image'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('variants_product_idx').on(t.productId)],
);

export const reviews = pgTable(
  'reviews',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    title: text('title'),
    body: text('body'),
    images: textArr('images'),
    isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
    status: reviewStatusEnum('status').notNull().default('PENDING'),
    helpfulCount: integer('helpful_count').notNull().default(0),
    adminReply: text('admin_reply'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('reviews_product_user_uq').on(t.productId, t.userId), index('reviews_product_status_idx').on(t.productId, t.status)],
);

export const reviewVotes = pgTable(
  'review_votes',
  {
    id: id(),
    reviewId: uuid('review_id')
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('review_votes_uq').on(t.reviewId, t.userId)],
);

export const questions = pgTable(
  'questions',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    answer: text('answer'),
    answeredAt: ts('answered_at'),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('questions_product_idx').on(t.productId)],
);

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('wishlist_uq').on(t.userId, t.productId)],
);

export const recentlyViewed = pgTable(
  'recently_viewed',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    viewedAt: ts('viewed_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('recently_viewed_uq').on(t.userId, t.productId), index('recently_viewed_user_idx').on(t.userId, t.viewedAt)],
);

export const stockAlerts = pgTable(
  'stock_alerts',
  {
    id: id(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email'),
    phone: text('phone'),
    notifiedAt: ts('notified_at'),
    createdAt: createdAt(),
  },
  (t) => [index('stock_alerts_variant_idx').on(t.variantId, t.notifiedAt)],
);

// ───────────────────────── Cart ─────────────────────────

export const carts = pgTable(
  'carts',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    couponCode: text('coupon_code'),
    lastActivityAt: ts('last_activity_at').notNull().defaultNow(),
    reminderCount: integer('reminder_count').notNull().default(0),
    lastReminderAt: ts('last_reminder_at'),
    recoveredAt: ts('recovered_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('carts_activity_idx').on(t.lastActivityAt)],
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: id(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('cart_items_uq').on(t.cartId, t.variantId)],
);

// ───────────────────────── Promotions ─────────────────────────

export const coupons = pgTable('coupons', {
  id: id(),
  code: text('code').notNull().unique(),
  description: text('description'),
  type: couponTypeEnum('type').notNull(),
  value: integer('value').notNull(), // percent (0-100) or flat paise
  maxDiscount: integer('max_discount'), // cap for percent coupons
  minOrderValue: integer('min_order_value').notNull().default(0),
  usageLimit: integer('usage_limit'),
  perUserLimit: integer('per_user_limit').notNull().default(1),
  usedCount: integer('used_count').notNull().default(0),
  firstOrderOnly: boolean('first_order_only').notNull().default(false),
  applicableCategoryIds: textArr('applicable_category_ids'),
  isActive: boolean('is_active').notNull().default(true),
  isPublic: boolean('is_public').notNull().default(true),
  startsAt: ts('starts_at'),
  endsAt: ts('ends_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: id(),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: 'cascade' }),
    discount: integer('discount').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('redemptions_coupon_idx').on(t.couponId), index('redemptions_user_idx').on(t.userId)],
);

export const loyaltyTransactions = pgTable(
  'loyalty_transactions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    points: integer('points').notNull(), // + earned / - redeemed
    reason: text('reason').notNull(),
    orderId: uuid('order_id'),
    createdAt: createdAt(),
  },
  (t) => [index('loyalty_user_idx').on(t.userId)],
);

// ───────────────────────── Orders ─────────────────────────

export type AddressSnapshot = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

export const orders = pgTable(
  'orders',
  {
    id: id(),
    orderNumber: text('order_number').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum('status').notNull().default('PENDING_PAYMENT'),
    paymentStatus: paymentStatusEnum('payment_status').notNull().default('PENDING'),
    paymentMethod: paymentMethodEnum('payment_method').notNull(),
    subtotal: integer('subtotal').notNull(),
    discount: integer('discount').notNull().default(0),
    shippingFee: integer('shipping_fee').notNull().default(0),
    codFee: integer('cod_fee').notNull().default(0),
    tax: integer('tax').notNull().default(0), // GST included in prices; stored for invoice
    loyaltyDiscount: integer('loyalty_discount').notNull().default(0),
    total: integer('total').notNull(),
    couponCode: text('coupon_code'),
    loyaltyPointsUsed: integer('loyalty_points_used').notNull().default(0),
    loyaltyPointsEarned: integer('loyalty_points_earned').notNull().default(0),
    shippingAddress: jsonb('shipping_address').$type<AddressSnapshot>().notNull(),
    customerNote: text('customer_note'),
    razorpayOrderId: text('razorpay_order_id').unique(),
    razorpayPaymentId: text('razorpay_payment_id'),
    // Third-party tracking: we store details and send reminders; the courier does the tracking
    carrier: text('carrier'),
    trackingNumber: text('tracking_number'),
    trackingUrl: text('tracking_url'),
    expectedDeliveryAt: ts('expected_delivery_at'),
    shippedAt: ts('shipped_at'),
    outForDeliveryAt: ts('out_for_delivery_at'),
    deliveredAt: ts('delivered_at'),
    cancelledAt: ts('cancelled_at'),
    cancelReason: text('cancel_reason'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    device: text('device'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('orders_user_idx').on(t.userId),
    index('orders_status_idx').on(t.status),
    index('orders_created_idx').on(t.createdAt),
    index('orders_payment_status_idx').on(t.paymentStatus),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id),
    name: text('name').notNull(),
    variantTitle: text('variant_title').notNull(),
    sku: text('sku').notNull(),
    image: text('image'),
    price: integer('price').notNull(), // unit price at purchase
    costPrice: integer('cost_price'),
    quantity: integer('quantity').notNull(),
    total: integer('total').notNull(),
    taxRate: integer('tax_rate').notNull().default(18),
  },
  (t) => [index('order_items_order_idx').on(t.orderId), index('order_items_product_idx').on(t.productId)],
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    status: orderStatusEnum('status').notNull(),
    note: text('note'),
    createdById: uuid('created_by_id'),
    createdAt: createdAt(),
  },
  (t) => [index('order_history_order_idx').on(t.orderId)],
);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // razorpay | cod
    providerOrderId: text('provider_order_id'),
    providerPaymentId: text('provider_payment_id'),
    amount: integer('amount').notNull(),
    status: paymentStatusEnum('status').notNull(),
    method: text('method'), // upi, card, netbanking...
    raw: jsonb('raw'),
    createdAt: createdAt(),
  },
  (t) => [index('payments_order_idx').on(t.orderId)],
);

export const returnRequests = pgTable(
  'return_requests',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    details: text('details'),
    itemIds: textArr('item_ids'),
    status: returnStatusEnum('status').notNull().default('REQUESTED'),
    refundAmount: integer('refund_amount'),
    adminNote: text('admin_note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('returns_status_idx').on(t.status)],
);

// ───────────────────────── CMS & Settings ─────────────────────────

export const banners = pgTable('banners', {
  id: id(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  image: text('image').notNull(),
  link: text('link'),
  ctaText: text('cta_text'),
  position: bannerPositionEnum('position').notNull().default('HERO'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  startsAt: ts('starts_at'),
  endsAt: ts('ends_at'),
  createdAt: createdAt(),
});

export const pages = pgTable('pages', {
  id: id(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  content: text('content').notNull(), // markdown
  isPublished: boolean('is_published').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: updatedAt(),
});

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: id(),
  email: text('email').notNull().unique(),
  createdAt: createdAt(),
});

// ───────────────────────── Notifications ─────────────────────────

export const notificationLogs = pgTable(
  'notification_logs',
  {
    id: id(),
    channel: channelEnum('channel').notNull(),
    to: text('to').notNull(),
    template: text('template').notNull(),
    subject: text('subject'),
    body: text('body'),
    status: notificationStatusEnum('status').notNull().default('QUEUED'),
    error: text('error'),
    providerMessageId: text('provider_message_id'),
    deliveryStatus: text('delivery_status'), // delivered/read (from WhatsApp webhook)
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    sentAt: ts('sent_at'),
  },
  (t) => [
    index('notif_channel_status_idx').on(t.channel, t.status),
    index('notif_created_idx').on(t.createdAt),
    index('notif_order_idx').on(t.orderId),
    index('notif_provider_msg_idx').on(t.providerMessageId),
  ],
);

export const scheduledReminders = pgTable(
  'scheduled_reminders',
  {
    id: id(),
    type: reminderTypeEnum('type').notNull(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    runAt: ts('run_at').notNull(),
    status: reminderStatusEnum('status').notNull().default('PENDING'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    sentAt: ts('sent_at'),
    createdAt: createdAt(),
  },
  (t) => [index('reminders_due_idx').on(t.status, t.runAt), index('reminders_order_idx').on(t.orderId)],
);

// ───────────────────────── Analytics & Audit ─────────────────────────

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: id(),
    type: eventTypeEnum('type').notNull(),
    sessionId: text('session_id').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    path: text('path'),
    referrer: text('referrer'),
    query: text('query'), // search term
    value: integer('value'), // paise
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    device: text('device'), // mobile | tablet | desktop
    meta: jsonb('meta'),
    createdAt: createdAt(),
  },
  (t) => [
    index('events_type_created_idx').on(t.type, t.createdAt),
    index('events_session_idx').on(t.sessionId),
    index('events_product_type_idx').on(t.productId, t.type),
  ],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    meta: jsonb('meta'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_entity_idx').on(t.entity, t.entityId), index('audit_created_idx').on(t.createdAt)],
);

// ───────────────────────── Relations ─────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  addresses: many(addresses),
  orders: many(orders),
  reviews: many(reviews),
  wishlist: many(wishlistItems),
  cart: one(carts),
  referredBy: one(users, { fields: [users.referredById], references: [users.id], relationName: 'referrals' }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, { fields: [categories.parentId], references: [categories.id], relationName: 'tree' }),
  children: many(categories, { relationName: 'tree' }),
  products: many(products),
}));

export const brandsRelations = relations(brands, ({ many }) => ({ products: many(products) }));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  brand: one(brands, { fields: [products.brandId], references: [brands.id] }),
  variants: many(productVariants),
  reviews: many(reviews),
  questions: many(questions),
}));

export const variantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  product: one(products, { fields: [questions.productId], references: [products.id] }),
  user: one(users, { fields: [questions.userId], references: [users.id] }),
}));

export const wishlistRelations = relations(wishlistItems, ({ one }) => ({
  user: one(users, { fields: [wishlistItems.userId], references: [users.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}));

export const recentlyViewedRelations = relations(recentlyViewed, ({ one }) => ({
  product: one(products, { fields: [recentlyViewed.productId], references: [products.id] }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  history: many(orderStatusHistory),
  payments: many(payments),
  returns: many(returnRequests),
  notifications: many(notificationLogs),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const orderHistoryRelations = relations(orderStatusHistory, ({ one }) => ({
  order: one(orders, { fields: [orderStatusHistory.orderId], references: [orders.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const returnsRelations = relations(returnRequests, ({ one }) => ({
  order: one(orders, { fields: [returnRequests.orderId], references: [orders.id] }),
  user: one(users, { fields: [returnRequests.userId], references: [users.id] }),
}));

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  order: one(orders, { fields: [notificationLogs.orderId], references: [orders.id] }),
  user: one(users, { fields: [notificationLogs.userId], references: [users.id] }),
}));
