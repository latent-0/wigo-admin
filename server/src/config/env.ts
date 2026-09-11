/**
 * Central, validated configuration. Every secret is read from the environment —
 * nothing is hardcoded (see the 11 Sep report: "no .env, credentials, or hardcoded
 * secrets committed"). Missing values fall back to safe dev defaults so the app boots
 * on the deterministic fakes with zero real credentials.
 */

function str(key: string, fallback = ''): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

function int(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export type Driver = 'fake' | 'live';

function driver(key: string): Driver {
  return str(key, 'fake') === 'live' ? 'live' : 'fake';
}

export const config = {
  env: str('NODE_ENV', 'development'),
  port: int('PORT', 4000),
  isProd: str('NODE_ENV', 'development') === 'production',

  jwt: {
    accessSecret: str('JWT_ACCESS_SECRET', 'dev-access-secret-change-me'),
    refreshSecret: str('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me'),
    accessTtlMinutes: int('JWT_ACCESS_TTL_MINUTES', 30),
    refreshTtlDays: int('JWT_REFRESH_TTL_DAYS', 7),
  },

  corsOrigins: str('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  whatsapp: {
    driver: driver('WHATSAPP_DRIVER'),
    phoneNumberId: str('WHATSAPP_PHONE_NUMBER_ID'),
    accessToken: str('WHATSAPP_ACCESS_TOKEN'),
    webhookVerifyToken: str('WHATSAPP_WEBHOOK_VERIFY_TOKEN', 'dev-verify-token'),
    appSecret: str('WHATSAPP_APP_SECRET'),
  },

  n1co: {
    driver: driver('N1CO_DRIVER'),
    baseUrl: str('N1CO_BASE_URL'),
    apiKey: str('N1CO_API_KEY'),
  },
} as const;

/**
 * Fail fast in production if a live driver is selected without its credentials.
 * In dev/test we stay on the fakes and never throw.
 */
export function assertProductionSecrets(): void {
  if (!config.isProd) return;
  const problems: string[] = [];
  if (config.jwt.accessSecret.startsWith('dev-')) problems.push('JWT_ACCESS_SECRET is unset/dev');
  if (config.jwt.refreshSecret.startsWith('dev-')) problems.push('JWT_REFRESH_SECRET is unset/dev');
  if (config.whatsapp.driver === 'live' && !config.whatsapp.accessToken)
    problems.push('WHATSAPP_DRIVER=live but WHATSAPP_ACCESS_TOKEN is empty');
  if (config.n1co.driver === 'live' && !config.n1co.apiKey)
    problems.push('N1CO_DRIVER=live but N1CO_API_KEY is empty');
  if (problems.length > 0) {
    throw new Error(`Refusing to boot in production with insecure config:\n - ${problems.join('\n - ')}`);
  }
}
