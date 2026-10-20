/**
 * Vercel serverless entry point. Every request is rewritten here (see vercel.json)
 * and handled by the same Express app used by `npm run dev` / `npm start`.
 */
import { createApp } from '../src/app';

export default createApp();
