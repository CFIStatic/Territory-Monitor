#!/usr/bin/env node
/**
 * Pulls ACS 5-year demographics for every ZCTA and writes data/zip-metrics.json.
 *
 *   npm run data:census                 # latest default vintage
 *   npm run data:census -- --year 2023
 *   CENSUS_API_KEY=xxxx npm run data:census
 *
 * An API key is optional (the Census allows a modest anonymous quota) but
 * recommended: https://api.census.gov/data/key_signup.html
 *
 * Run this on a machine with outbound access to api.census.gov. It is NOT
 * required — the app renders geographic metrics without it — but population,
 * households and income all stay null until you do.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const argYear = process.argv.indexOf('--year');
const YEAR = argYear > -1 ? process.argv[argYear + 1] : '2023';
const KEY = process.env.CENSUS_API_KEY;

// ACS variable -> friendly name. Keep in sync with `demographics()` in build-territories.mjs.
const VARS = {
  B01003_001E: 'population',
  B11001_001E: 'households',
  B25001_001E: 'housingUnits',
  B19013_001E: 'medianIncome',
  B25077_001E: 'medianHomeValue',
  B25003_002E: 'ownerOccupied',
};

const url = new URL(`https://api.census.gov/data/${YEAR}/acs/acs5`);
url.searchParams.set('get', Object.keys(VARS).join(','));
url.searchParams.set('for', 'zip code tabulation area:*');
if (KEY) url.searchParams.set('key', KEY);

console.log(`[census] fetching ACS5 ${YEAR} for all ZCTAs…`);
if (!KEY) console.log('[census] no CENSUS_API_KEY set — using the anonymous quota');

async function getJson(u, attempt = 1) {
  try {
    const res = await fetch(u, { headers: { 'user-agent': 'territory-monitor' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 4) throw err;
    const wait = 2 ** attempt * 1000;
    console.log(`[census] ${err.message} — retrying in ${wait / 1000}s (${attempt}/3)`);
    await new Promise((r) => setTimeout(r, wait));
    return getJson(u, attempt + 1);
  }
}

const rows = await getJson(url);
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const zctaCol = idx['zip code tabulation area'] ?? header.length - 1;

// The ACS uses large negative sentinels (-666666666 and friends) for suppressed
// values. Treat anything implausible as missing rather than letting it poison sums.
const clean = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= -666666) return null;
  return n;
};

const zips = {};
let kept = 0;
for (const row of rows.slice(1)) {
  const zcta = row[zctaCol];
  if (!/^\d{5}$/.test(zcta)) continue;
  const rec = {};
  for (const [code, name] of Object.entries(VARS)) rec[name] = clean(row[idx[code]]);
  zips[zcta] = rec;
  kept++;
}

const out = {
  vintage: `ACS 5-year ${YEAR}`,
  source: `https://api.census.gov/data/${YEAR}/acs/acs5`,
  fetchedAt: new Date().toISOString(),
  variables: VARS,
  zips,
};

const path = join(ROOT, 'data', 'zip-metrics.json');
writeFileSync(path, JSON.stringify(out));
console.log(`[census] wrote ${kept} ZCTAs to ${path}`);
console.log('[census] now run `npm run build:data` to fold these into the map.');
