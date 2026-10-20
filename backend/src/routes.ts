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
apiRouter.use('/', catalogRouter);
apiRouter.use('/cms', cmsRouter);
