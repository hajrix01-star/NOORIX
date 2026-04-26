/**
 * Runs before any `*.integration.spec.ts` is loaded, so it runs before
 * `prisma-connect-retry` reads env at module init.
 * Keeps "DB down" failures in Jest to a few seconds instead of ~80s+.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function withShortConnectTimeoutForJest(databaseUrl) {
  if (!databaseUrl || !/^postgres(ql)?:/i.test(databaseUrl)) {
    return databaseUrl;
  }
  try {
    const u = new URL(databaseUrl);
    if (!u.searchParams.has('connect_timeout')) {
      u.searchParams.set('connect_timeout', '2');
    }
    return u.toString();
  } catch {
    return databaseUrl;
  }
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = withShortConnectTimeoutForJest(process.env.DATABASE_URL);
}

if (!process.env.DATABASE_CONNECT_RETRIES) {
  process.env.DATABASE_CONNECT_RETRIES = '1';
}
if (!process.env.DATABASE_CONNECT_RETRY_MS) {
  process.env.DATABASE_CONNECT_RETRY_MS = '500';
}
