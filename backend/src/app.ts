import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/error';
import { apiRouter } from './routes';
import { runDueJobs } from './jobs';
import { waitUntil } from '@vercel/functions';

/** Exact origins, or patterns with a single `*` (e.g. https://shop-*.vercel.app). */
function originAllowed(origin: string) {
  return env.corsOrigins.some((o) => {
    if (!o.includes('*')) return o === origin;
    const [pre, post] = o.split('*');
    return origin.startsWith(pre) && origin.endsWith(post);
  });
}

let lastJobKick = 0;

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || originAllowed(origin)) return cb(null, true);
        cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    }),
  );
  app.use(compression());

  // Raw body is needed for webhook signature verification — must run before express.json()
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
  app.use('/api/webhooks/whatsapp', express.raw({ type: 'application/json' }));

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Serverless: run due background jobs after responding (at most once a minute per instance)
  if (env.serverless && env.ENABLE_JOBS) {
    app.use((_req, _res, next) => {
      if (Date.now() - lastJobKick > 60_000) {
        lastJobKick = Date.now();
        waitUntil(runDueJobs().catch(() => undefined));
      }
      next();
    });
  }

  app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api', apiLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
