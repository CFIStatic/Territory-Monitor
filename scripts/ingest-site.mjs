#!/usr/bin/env node
/**
 * Scrapes a restoration franchise's site for its stated service area and emits a
 * territory record you can paste into data/territories.json.
 *
 *   npm run ingest -- https://www.servproofsomewhere.com
 *   npm run ingest -- https://… --brand servpro --owner "Acme Restoration LLC"
 *   npm run ingest -- https://… --append          # write straight into territories.json
 *
 * How it works: fetches the landing page, follows likely "service area" links one
 * hop deep, then harvests 5-digit ZIPs and "City, ST" pairs from the text. Every
 * ZIP is validated against the vendored ZIP index, so page furniture like phone
 * fragments and years get filtered out.
 *
 * This is a first-pass extractor, not an oracle. Franchise sites describe their
 * areas inconsistently, so the output is written with source "website:<date>"
 * and the app badges it UNVERIFIED until you confirm it against a franchise
 * disclosure document or the franchisor's locator.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 ? args[i + 1] : fallback;
};

const target = args.find((a) => /^https?:\/\//.test(a));
if (!target) {
  console.error('usage: npm run ingest -- <url> [--brand id] [--owner "Name"] [--append]');
  process.exit(1);
}

const zipIndexPath = join(ROOT, 'data', 'generated', 'zip-index.json');
if (!existsSync(zipIndexPath)) {
  console.error('missing data/generated/zip-index.json — run `npm run build:zips` first');
  process.exit(1);
}
const { zips: ZIPS } = JSON.parse(readFileSync(zipIndexPath, 'utf8'));
const brands = JSON.parse(readFileSync(join(ROOT, 'data', 'brands.json'), 'utf8')).brands;

const cityKeys = new Set();
for (const [, r] of Object.entries(ZIPS)) cityKeys.add(`${r[2].toLowerCase()}|${r[3]}`);

async function getText(url) {
  const res = await fetch(url, {
    headers: {
      // Plain fetch gets 403'd by most franchise CDNs; a normal UA gets through.
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

const stripTags = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ');

/** Links whose href or anchor text suggests a service-area page. */
function serviceAreaLinks(html, base) {
  const out = new Set();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const hint = /(service|coverage|areas?[-_ ]we[-_ ]serve|we[-_ ]serve|locations?|cities|counties|neighborhoods)/i;
  let m;
  while ((m = re.exec(html))) {
    const [, href, label] = m;
    if (!hint.test(href) && !hint.test(stripTags(label))) continue;
    try {
      const u = new URL(href, base);
      if (u.hostname === new URL(base).hostname) out.add(u.href.split('#')[0]);
    } catch { /* malformed href */ }
  }
  return [...out].slice(0, 6);
}

function harvest(text) {
  const zips = new Set();
  const cities = new Set();

  for (const m of text.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)) {
    const z = m[1];
    // Validate against the real ZIP list — kills years, prices, phone chunks.
    if (ZIPS[z]) zips.add(z);
  }

  for (const m of text.matchAll(/\b([A-Z][A-Za-z.'-]+(?: [A-Z][A-Za-z.'-]+){0,3}),\s*([A-Z]{2})\b/g)) {
    const city = m[1].trim();
    const st = m[2];
    if (cityKeys.has(`${city.toLowerCase()}|${st}`)) cities.add(`${city}, ${st}`);
  }

  return { zips: [...zips].sort(), cities: [...cities].sort() };
}

console.log(`[ingest] fetching ${target}`);
const pages = new Map();
try {
  const home = await getText(target);
  pages.set(target, home);
  const links = serviceAreaLinks(home, target);
  console.log(`[ingest] following ${links.length} service-area link(s)`);
  for (const l of links) {
    try {
      pages.set(l, await getText(l));
      console.log(`  + ${l}`);
    } catch (e) {
      console.log(`  ! ${l} — ${e.message}`);
    }
  }
} catch (e) {
  console.error(`[ingest] could not fetch ${target}: ${e.message}`);
  process.exit(1);
}

const combined = [...pages.values()].map(stripTags).join(' \n ');
const { zips, cities } = harvest(combined);

// Guess the brand from the hostname/copy unless told otherwise.
const guessBrand = () => {
  const hay = `${target} ${combined.slice(0, 4000)}`.toLowerCase();
  for (const b of brands) {
    const needle = b.name.toLowerCase().split(' ')[0];
    if (needle.length > 3 && hay.includes(needle)) return b.id;
  }
  return 'independent';
};

const host = new URL(target).hostname.replace(/^www\./, '');
const record = {
  id: host.replace(/\./g, '-'),
  name: host,
  brandId: flag('brand') ?? guessBrand(),
  owner: flag('owner') ?? 'UNKNOWN — fill in',
  franchiseNumber: null,
  website: target,
  status: 'active',
  zips,
  cities: zips.length ? [] : cities, // prefer ZIPs; cities are the fallback signal
  notes: `Auto-extracted from ${pages.size} page(s). ${zips.length} ZIP(s), ${cities.length} city mention(s). Verify before use.`,
  source: `website:${new Date().toISOString().slice(0, 10)}`,
};

console.log(`\n[ingest] found ${zips.length} ZIPs, ${cities.length} cities`);
if (!zips.length && !cities.length) {
  console.log('[ingest] nothing usable — the site probably renders its service area with JS.');
  console.log('[ingest] fall back to the franchisor locator or paste ZIPs in by hand.');
}

if (args.includes('--append')) {
  const tp = join(ROOT, 'data', 'territories.json');
  const file = JSON.parse(readFileSync(tp, 'utf8'));
  const existing = file.territories.findIndex((t) => t.id === record.id);
  if (existing > -1) file.territories[existing] = record;
  else file.territories.push(record);
  writeFileSync(tp, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`[ingest] ${existing > -1 ? 'updated' : 'appended'} "${record.id}" in data/territories.json`);
  console.log('[ingest] run `npm run build:data` to remap.');
} else {
  console.log('\nPaste into data/territories.json → territories[]:\n');
  console.log(JSON.stringify(record, null, 2));
}
