import { Router } from 'express';
import { requireStaff } from '../../middleware/auth';
import { adminAnalyticsRouter } from './analytics.routes';
import { adminCatalogRouter } from './catalog.routes';
import { adminOrdersRouter } from './orders.routes';
import { adminCustomersRouter } from './customers.routes';
import { adminContentRouter } from './content.routes';

/**
 * Admin API. Every route requires a staff role (SUPPORT, MANAGER or ADMIN);
 * mutating catalog/marketing routes additionally require MANAGER, and
 * settings/roles/jobs require ADMIN.
 */
export const adminRouter = Router();
adminRouter.use(...requireStaff);

adminRouter.use('/analytics', adminAnalyticsRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/customers', adminCustomersRouter);
adminRouter.use('/', adminCatalogRouter);
adminRouter.use('/', adminContentRouter);
