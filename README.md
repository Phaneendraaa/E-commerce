# ShopNest — full-stack e-commerce platform

A production-ready, re-skinnable online store with a customer storefront, an admin panel with advanced
analytics, and email/SMS/WhatsApp automation.

| Layer | Tech |
|---|---|
| API | Node.js 20+, TypeScript, Express, Drizzle ORM, Zod |
| Database | PostgreSQL 14+ |
| Storefront & admin | Next.js 15 (App Router), React 19, Tailwind CSS v4, Recharts |
| Payments | Razorpay (UPI, cards, netbanking, wallets) + Cash on Delivery |
| Messaging | Gmail SMTP, SMS (Twilio or MSG91), WhatsApp Cloud API |

```
├── backend/                 Express API
│   ├── src/db/              schema, migrations runner, seed, image generator
│   ├── src/modules/         auth, catalog, cart, orders, payments, notifications, analytics, admin…
│   ├── src/jobs/            reminder queue + scheduled jobs
│   └── drizzle/             SQL migrations
├── frontend/                Next.js storefront (/) and admin panel (/admin)
│   ├── public/images/       product, category and banner images (stored here, paths in the DB)
│   └── src/styles/theme.css ← re-skin the whole store from this one file
└── docs/WHATSAPP_TEMPLATES.md
```

---

## Quick start (local)

**Requirements:** Node.js 20+ and PostgreSQL running locally (or `docker compose up db -d`).

```bash
npm install

# 1. Configure
cp backend/.env.example backend/.env          # set DATABASE_URL + two JWT secrets
cp frontend/.env.example frontend/.env.local

# 2. Database
createdb ecommerce                            # or create it in pgAdmin
npm run db:migrate
npm run db:seed                               # demo catalog, customers, 4 months of orders

# 3. Run both apps
npm run dev
```

- Storefront → <http://localhost:3000>
- Admin → <http://localhost:3000/admin> — `admin@shopnest.dev` / `Admin@12345`
- Demo customer → `customer@shopnest.dev` / `Customer@123`
- API health → <http://localhost:4000/health>

> **Change the admin password** (Account → Profile & security) before going live, or set
> `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env` before seeding.

Everything works **without any third-party keys**: payments use a test-payment dialog, and
email/SMS/WhatsApp messages are printed to the API console and logged in Admin → Messaging. In
development, OTP codes also appear as an on-screen toast.

---

## Environment variables

All backend settings are documented in [`backend/.env.example`](backend/.env.example). Minimum to run:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ecommerce
JWT_ACCESS_SECRET=<48+ random chars>
JWT_REFRESH_SECRET=<48+ random chars>
```

Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

| Integration | Variables | Notes |
|---|---|---|
| **Razorpay** | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Webhook URL `https://API/api/payments/webhook`, events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed` |
| **Gmail** | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM_NAME` | Needs 2-step verification + an [App Password](https://myaccount.google.com/apppasswords) |
| **SMS** | `SMS_PROVIDER=twilio` + `TWILIO_*` **or** `SMS_PROVIDER=msg91` + `MSG91_*` | MSG91 requires DLT-approved templates for India |
| **WhatsApp** | `WHATSAPP_PROVIDER=meta`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Create the templates in [docs/WHATSAPP_TEMPLATES.md](docs/WHATSAPP_TEMPLATES.md) |
| **Google sign-in** | `GOOGLE_CLIENT_ID` (API) + `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend) | OAuth client of type *Web*, add your domain to authorised origins |
| **Jobs** | `ENABLE_JOBS`, `ABANDONED_CART_HOURS` | Set `ENABLE_JOBS=false` on extra API replicas (jobs also use DB locks) |

Frontend: `API_URL` (where the API runs), `NEXT_PUBLIC_SITE_URL` (canonical URL for SEO).

---

## Features

### Storefront
- Home: hero carousel, category tiles, deals of the day with live countdowns, bestsellers, coupons, new arrivals, top rated, recently viewed
- Shop: faceted filters (category tree, brand, price, colour swatches, sizes, rating, in stock, on sale), 7 sort modes, full-text search with autocomplete and recent searches
- Product page: variant picker that follows colour images, stock urgency, pincode delivery estimate, back-in-stock alerts, reviews (verified purchase, helpful votes, store replies), Q&A, frequently bought together, structured data for Google
- Cart for guests and members (merged on sign-in), coupons, reward points, free-delivery meter
- Checkout: saved addresses, Razorpay or COD (with fee and limits), buy-now, GST breakdown
- Sign in with password, **OTP via WhatsApp/SMS/email**, or Google; referral codes
- Account: orders with live status and courier tracking link, cancel, returns, invoice PDF, buy again, wishlist, addresses, rewards & referrals, phone verification, notification preferences
- SEO: SSR/ISR, sitemap.xml, robots.txt, Open Graph, JSON-LD

### Admin (`/admin`)
- **Dashboard:** live visitors, today's sales, 8 KPIs vs previous period, revenue trend, 14-day forecast, conversion funnel, work queue, top products, category share
- **Analytics:** customer lifetime value, repeat rate, new vs returning, **RFM segments**, **cohort retention**, product profitability & conversion, traffic sources & devices, top searches, geography, weekday × hour heatmap, payment mix & success rate, fulfilment speed and on-time %, cancellation reasons, coupon ROI, abandoned carts, WhatsApp read rates
- **Orders:** filters, bulk status, ship with courier + AWB (auto tracking link), one-tap WhatsApp/SMS reminders, free-form messages, notes, invoices, CSV export
- Returns workflow, customers 360° (orders, live cart, messages, points, block, roles), abandoned carts
- Products with variant generator, media library (uploads into `public/images/uploads`), inventory with days-of-cover, categories & brands
- Coupons, review moderation, Q&A, banners, pages, segmented broadcasts, message log, settings, audit log, ⌘K search
- Roles: **Support** (orders/customers) · **Manager** (+ catalog & marketing) · **Admin** (+ settings, roles, jobs)

### Automation (runs inside the API)
| Job | When |
|---|---|
| Reminder queue: payment pending, tracking reminders, late-delivery follow-up, review requests | every minute |
| Cancel unpaid online orders (frees stock, coupon, points) | every 5 min |
| Back-in-stock alerts | every 10 min |
| Abandoned-cart email + WhatsApp (2nd nudge includes a coupon) | every 15 min |
| Daily admin digest email | 9:00 IST |
| Clean expired sessions & OTPs | 3:30 IST |

---

## Re-skinning for a different store

1. **Colours, radius and fonts:** edit `frontend/src/styles/theme.css`; swap the two `@fontsource` imports in `frontend/src/app/layout.tsx` (install another with `npm i @fontsource-variable/<font> -w frontend`).
2. **Name, announcement, contact, shipping rules:** Admin → Settings (no code).
3. **Catalog:** start from an empty database: `npm run db:migrate`, skip the seed, then create your admin with
   `npm run admin:create -- you@yourstore.com "Strong#Pass123" "Your Name"` and add categories and products in the admin. Replace images in `frontend/public/images/`.
4. **Policies & pages:** Admin → Banners & pages.
5. **Variant options** are free-form (Size, Color, Storage, Weight, Flavour…), so the same code works for fashion, electronics, grocery or beauty.

---

## Images

Images are files in `frontend/public/images/` served by Next.js; the database stores their paths
(e.g. `/images/products/my-shoe.jpg`). Add them by:
- **Admin → Products → Add images → Upload** (saved to `public/images/uploads/`), or
- copying files into `public/images/` and picking them in the media library.

The demo artwork is generated by `npm run images -w backend`. On serverless hosts with a read-only
disk (e.g. Vercel), commit images to the repo or move uploads to S3/Cloudinary
(`frontend/src/app/media-api/route.ts` is the only file to change).

---

## Deploying

### Docker (VPS, Railway, Render, Fly…)
```bash
cp backend/.env.example backend/.env    # production values, NODE_ENV=production
docker compose up -d --build
docker compose exec api node dist/db/seed.js   # optional demo data
```
Put a reverse proxy (Caddy/Nginx) with HTTPS in front of port 3000. The API runs migrations on start.

### Separate hosting
- **API:** `npm run build -w backend && npm run db:migrate:prod -w backend && npm start -w backend`
- **Frontend:** set `API_URL` to the API's URL, then `npm run build -w frontend && npm start -w frontend`
- Set `CORS_ORIGINS` and `FRONTEND_URL` on the API to the storefront's domain.

The browser talks to the API **through the Next.js server** (`/api/*` is proxied), so auth cookies
are first-party and no CORS setup is needed for the storefront itself.

---

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | API + web with hot reload |
| `npm run db:migrate` | Apply migrations |
| `npm run db:generate -w backend` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:seed` | **Wipes** the database and loads demo data |
| `npm run admin:create -- <email> <password> [name]` | Create or promote an admin (no demo data) |
| `npm run db:studio -w backend` | Browse the database |
| `npm run images -w backend` | Regenerate demo artwork |
| `npm run typecheck` | Type-check both apps |

## API overview

Public: `/api/products`, `/api/products/:slug`, `/api/categories`, `/api/cms/*`, `/api/track`
Customer: `/api/auth/*`, `/api/users/me/*`, `/api/cart/*`, `/api/orders/*`, `/api/wishlist`
Admin: `/api/admin/*` (staff roles)
Webhooks: `/api/payments/webhook` (Razorpay), `/api/webhooks/whatsapp` (Meta)

All money values are integers in **paise** (₹1 = 100).
