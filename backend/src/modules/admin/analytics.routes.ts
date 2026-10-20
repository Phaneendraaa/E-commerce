import { Router } from 'express';
import { z } from 'zod';
import { ah } from '../../utils/http';
import { validate } from '../../middleware/validate';
import * as A from '../analytics/analytics.service';

export const adminAnalyticsRouter = Router();

const rangeQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  days: z.coerce.number().int().min(1).max(730).optional(),
  granularity: z.enum(['day', 'week', 'month']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
});

const handler = (fn: (q: any) => Promise<unknown>) => [validate({ query: rangeQuery }), ah(async (req, res) => res.json(await fn(req.query)))];

adminAnalyticsRouter.get('/overview', ...handler(A.overview));
adminAnalyticsRouter.get('/sales', ...handler(A.sales));
adminAnalyticsRouter.get('/forecast', ...handler(() => A.forecast(14)));
adminAnalyticsRouter.get('/funnel', ...handler(A.funnel));
adminAnalyticsRouter.get('/products', ...handler(A.topProducts));
adminAnalyticsRouter.get('/categories', ...handler(A.categoryBreakdown));
adminAnalyticsRouter.get('/customers', ...handler(A.customers));
adminAnalyticsRouter.get('/cohorts', ...handler(() => A.cohorts(6)));
adminAnalyticsRouter.get('/geography', ...handler(A.geography));
adminAnalyticsRouter.get('/traffic', ...handler(A.traffic));
adminAnalyticsRouter.get('/heatmap', ...handler(A.heatmap));
adminAnalyticsRouter.get('/payments', ...handler(A.payments));
adminAnalyticsRouter.get('/coupons', ...handler(A.couponPerformance));
adminAnalyticsRouter.get('/inventory', ...handler(() => A.inventory()));
adminAnalyticsRouter.get('/abandoned-carts', ...handler(() => A.abandonedCartStats()));
adminAnalyticsRouter.get('/notifications', ...handler(A.notificationStats));
adminAnalyticsRouter.get('/realtime', ...handler(() => A.realtime()));
