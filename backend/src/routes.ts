import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { catalogRouter } from './modules/catalog/catalog.routes';
import { cmsRouter } from './modules/cms/cms.routes';
import { cartRouter } from './modules/cart/cart.routes';
import { ordersRouter } from './modules/orders/orders.routes';
import { paymentsRouter } from './modules/payments/payments.routes';
import { trackRouter } from './modules/analytics/track.routes';
import { whatsappWebhookRouter } from './modules/notifications/whatsapp.webhook';
import { adminRouter } from './modules/admin';
import { runDailyJobs, runDueJobs } from './jobs';
import { env } from './config/env';
import { forbidden } from './utils/errors';
import { ah } from './utils/http';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ name: 'E-commerce API', version: '1.0.0' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/track', trackRouter);
apiRouter.use('/webhooks/whatsapp', whatsappWebhookRouter);
apiRouter.use('/admin', adminRouter);

/**
 * Cron entry points for serverless hosting (Vercel Cron or any external pinger).
 * Auth: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this automatically).
 */
apiRouter.get(
  '/cron/:which',
  ah(async (req, res) => {
    const auth = req.get('authorization');
    if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) throw forbidden('Invalid cron secret');
    if (req.params.which === 'daily') {
      await runDailyJobs();
      return void res.json({ ok: true, ran: ['cleanup', 'admin-digest'] });
    }
    const ran = await runDueJobs(req.query.force === '1');
    res.json({ ok: true, ran });
  }),
);
apiRouter.use('/', catalogRouter);
apiRouter.use('/cms', cmsRouter);
