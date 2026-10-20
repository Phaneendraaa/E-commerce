/* Minimal structured logger — swap for pino/winston if you need log shipping. */
type Level = 'debug' | 'info' | 'warn' | 'error';

const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const minLevel: Level = (process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

function log(level: Level, msg: string, meta?: unknown) {
  if (order[level] < order[minLevel]) return;
  const line: Record<string, unknown> & { t: string } = {
    t: new Date().toISOString(),
    level,
    msg,
    ...(meta instanceof Error ? { error: meta.message, stack: meta.stack } : meta ? { meta } : {}),
  };
  const out = process.env.NODE_ENV === 'production' ? JSON.stringify(line) : `[${line.t}] ${level.toUpperCase()} ${msg}${meta ? ' ' + JSON.stringify(line.error ?? line.meta) : ''}`;
  // eslint-disable-next-line no-console
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(out);
}

export const logger = {
  debug: (m: string, meta?: unknown) => log('debug', m, meta),
  info: (m: string, meta?: unknown) => log('info', m, meta),
  warn: (m: string, meta?: unknown) => log('warn', m, meta),
  error: (m: string, meta?: unknown) => log('error', m, meta),
};
