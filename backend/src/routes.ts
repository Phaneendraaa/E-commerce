import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';

export const apiRouter = Router();

apiRouter.get('/', (_req, res) => {
  res.json({ name: 'E-commerce API', version: '1.0.0' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
