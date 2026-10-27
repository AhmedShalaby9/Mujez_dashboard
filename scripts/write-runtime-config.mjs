import { mkdirSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';

// Only public settings may enter the browser bundle. Never copy the full env.
const overrides = parseEnv(process.env.STAGING_ENV || '');
const allowed = ['API_URL', 'DASHBOARD_URL'];
if (Object.keys(overrides).some((key) => !allowed.includes(key))) {
  throw new Error('Dashboard STAGING_ENV may contain only API_URL and DASHBOARD_URL');
}
const values = {};
for (const key of allowed) {
  const value = overrides[key] || process.env[key];
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) {
    throw new Error(`${key} must be an HTTPS origin without a path or credentials`);
  }
  values[key] = value;
}
mkdirSync('public', { recursive: true });
writeFileSync('public/runtime-config.json', JSON.stringify({
  apiUrl: values.API_URL,
  dashboardUrl: values.DASHBOARD_URL,
}, null, 2) + '\n');
console.log('Public dashboard runtime configuration generated');
