import { Router } from 'express';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ name: 'E-commerce API', version: '1.0.0' });
});
