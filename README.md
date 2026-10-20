# ShopNest — Full-Stack E-commerce Platform

A production-grade, theme-able e-commerce platform.

- **Backend:** Node.js + TypeScript (Express), Drizzle ORM, PostgreSQL
- **Frontend:** Next.js (App Router) storefront + admin panel
- **Integrations:** Razorpay, Gmail (SMTP), SMS (Twilio / MSG91), WhatsApp Cloud API

> 🚧 Being built in small increments — see commit history. Full setup docs land with the final push.

## Quick start (backend)

```bash
npm install
cp backend/.env.example backend/.env   # fill in DATABASE_URL at minimum
npm run db:migrate
npm run dev -w backend                  # http://localhost:4000/health
```
