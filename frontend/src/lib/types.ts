/* Shapes returned by the API. Money is always in paise. */

export type Role = 'CUSTOMER' | 'SUPPORT' | 'MANAGER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  avatar: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  whatsappOptIn: boolean;
  marketingOptIn: boolean;
  loyaltyPoints: number;
  referralCode: string;
  hasPassword: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  isFeatured: boolean;
  productCount?: number;
  children?: Category[];
}

export interface ProductCard {
  id: string;
  name: string;
  slug: string;
  images: string[];
  price: number;
  compareAtPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  isNewArrival: boolean;
  isFeatured: boolean;
  dealEndsAt: string | null;
  shortDescription: string | null;
  brandName: string | null;
  stock: number;
  inStock: boolean;
  discountPercent: number;
}

export interface Variant {
  id: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  image: string | null;
  inStock: boolean;
  lowStock: boolean;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  images: string[];
  tags: string[];
  specs: { label: string; value: string }[];
  optionNames: string[];
  optionValues: Record<string, string[]>;
  price: number;
  compareAtPrice: number | null;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  dealEndsAt: string | null;
  isNewArrival: boolean;
  taxRate: number;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string };
  breadcrumb: { name: string; slug: string }[];
  ratingBreakdown: { rating: number; count: number }[];
  variants: Variant[];
  inStock: boolean;
  discountPercent: number;
  inWishlist?: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
}

export interface Facets {
  brands: { name: string; slug: string; count: number }[];
  price: { min: number; max: number };
  options: Record<string, string[]>;
  ratings: { rating: number; count: number }[];
}

export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  images: string[];
  isVerifiedPurchase: boolean;
  helpfulCount: number;
  adminReply: string | null;
  createdAt: string;
  user: { name: string; avatar: string | null };
  votedHelpful?: boolean;
}

export interface CartLine {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantTitle: string;
  options: Record<string, string>;
  sku: string;
  image: string | null;
  price: number;
  compareAtPrice: number | null;
  quantity: number;
  total: number;
  stock: number;
  available: boolean;
  issue?: string;
}

export interface Cart {
  id: string | null;
  couponCode: string | null;
  lines: CartLine[];
  itemCount: number;
  mrpTotal: number;
  subtotal: number;
  savings: number;
  discount: number;
  coupon: { code: string; valid: boolean; discount: number; freeShipping: boolean; message: string } | null;
  shippingFee: number;
  codFee: number;
  loyaltyDiscount: number;
  loyaltyPointsUsed: number;
  loyaltyPointsAvailable: number;
  maxLoyaltyPoints: number;
  tax: number;
  total: number;
  freeShippingRemaining: number;
  pointsToEarn: number;
  hasIssues: boolean;
  codAvailable: boolean;
}

export interface Address {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  type: 'HOME' | 'WORK' | 'OTHER';
  isDefault: boolean;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'REFUNDED'
  | 'FAILED';

export interface OrderItem {
  id: string;
  productId: string;
  productSlug?: string | null;
  variantId: string;
  name: string;
  variantTitle: string;
  sku: string;
  image: string | null;
  price: number;
  quantity: number;
  total: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  paymentMethod: 'RAZORPAY' | 'COD';
  subtotal: number;
  discount: number;
  shippingFee: number;
  codFee: number;
  tax: number;
  loyaltyDiscount: number;
  loyaltyPointsUsed: number;
  loyaltyPointsEarned: number;
  total: number;
  couponCode: string | null;
  shippingAddress: Omit<Address, 'id' | 'type' | 'isDefault'>;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  expectedDeliveryAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  items: OrderItem[];
  history?: { id: string; status: OrderStatus; note: string | null; createdAt: string }[];
  returns?: { id: string; status: string; reason: string; refundAmount: number | null; createdAt: string }[];
  canCancel?: boolean;
  canReturn?: boolean;
  canPay?: boolean;
  returnWindowEndsAt?: string | null;
}

export interface StoreSettings {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  address: string;
  freeShippingThreshold: number;
  shippingFee: number;
  codEnabled: boolean;
  codFee: number;
  loyaltyPointValue: number;
  loyaltyEarnPer100: number;
  returnWindowDays: number;
  social: Record<string, string | undefined>;
  announcement: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image: string;
  link: string | null;
  ctaText: string | null;
  position: string;
}

export interface Offer {
  code: string;
  description: string | null;
  type: 'PERCENT' | 'FLAT' | 'FREE_SHIPPING';
  value: number;
  maxDiscount: number | null;
  minOrderValue: number;
  endsAt: string | null;
  firstOrderOnly?: boolean;
}

export interface PaymentIntent {
  provider: 'razorpay';
  mock: boolean;
  keyId: string | null;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
}
