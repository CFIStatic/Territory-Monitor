#!/usr/bin/env node
/**
 * Builds data/generated/zip-index.json — the geographic backbone of the tool.
 *
 * Inputs (both vendored via npm, no network required):
 *   zipcodes   ~42k US ZIP centroids with city/state
 *   us-atlas   Census county + state TopoJSON (10m)
 *
 * For every ZIP centroid we resolve the containing county by point-in-polygon.
 * A 1-degree bbox grid keeps that from being a 42k x 3231 brute force.
 *
 * Output shape (compact on purpose — this file ships to the browser):
 *   {
 *     counties: { "47187": { name, stateFips, state } },
 *     zips:     { "37027": [lat, lng, city, state, countyFips] }
 *   }
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as turf from '@turf/turf';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'data', 'generated');

// FIPS -> USPS. Needed because us-atlas county ids carry only the numeric FIPS.
const STATE_FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
  '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
  '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
  '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
  '55': 'WI', '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP', '72': 'PR', '78': 'VI',
};

console.log('[zip-index] loading vendored geography…');
const zipcodes = require('zipcodes');
const countiesTopo = require('us-atlas/counties-10m.json');
const countyFC = feature(countiesTopo, countiesTopo.objects.counties);

// ---------------------------------------------------------------- county grid
// Bucket each county into every 1-degree cell its bbox touches, so a ZIP only
// has to be tested against the handful of counties near it.
const CELL = 1;
const cellKey = (lng, lat) => `${Math.floor(lng / CELL)}:${Math.floor(lat / CELL)}`;

const grid = new Map();
const counties = {};
let indexed = 0;

for (const f of countyFC.features) {
  const fips = String(f.id).padStart(5, '0');
  const stateFips = fips.slice(0, 2);
  if (!f.geometry) continue;

  counties[fips] = {
    name: f.properties?.name ?? fips,
    stateFips,
    state: STATE_FIPS[stateFips] ?? '??',
  };

  const [minX, minY, maxX, maxY] = turf.bbox(f);
  const entry = { fips, feature: f, bbox: [minX, minY, maxX, maxY] };
  for (let x = Math.floor(minX / CELL); x <= Math.floor(maxX / CELL); x++) {
    for (let y = Math.floor(minY / CELL); y <= Math.floor(maxY / CELL); y++) {
      const k = `${x}:${y}`;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(entry);
    }
  }
  indexed++;
}
console.log(`[zip-index] indexed ${indexed} counties into ${grid.size} grid cells`);

// ------------------------------------------------------------------ zip sweep
// Drive the sweep off STATE_FIPS so we pick up US states/territories only —
// the `zipcodes` package also carries Canadian provinces.
const allZips = [];
for (const usps of Object.values(STATE_FIPS)) {
  for (const z of zipcodes.lookupByState(usps)) allZips.push(z);
}
console.log(`[zip-index] resolving counties for ${allZips.length} ZIP centroids…`);

const zips = {};
let matched = 0;
let unmatched = 0;

for (const z of allZips) {
  const lat = Number(z.latitude);
  const lng = Number(z.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;

  const candidates = grid.get(cellKey(lng, lat)) ?? [];
  const pt = turf.point([lng, lat]);
  let countyFips = null;

  for (const c of candidates) {
    const [minX, minY, maxX, maxY] = c.bbox;
    if (lng < minX || lng > maxX || lat < minY || lat > maxY) continue;
    if (turf.booleanPointInPolygon(pt, c.feature)) { countyFips = c.fips; break; }
  }

  // ZIP centroids sometimes sit just offshore of the county polygon (coastal and
  // Great Lakes ZIPs). Fall back to the nearest candidate county centroid.
  if (!countyFips && candidates.length) {
    let best = null, bestD = Infinity;
    for (const c of candidates) {
      const d = turf.distance(pt, turf.centroid(c.feature), { units: 'miles' });
      if (d < bestD) { bestD = d; best = c.fips; }
    }
    if (bestD < 60) countyFips = best;
  }

  if (countyFips) matched++; else unmatched++;
  zips[z.zip] = [lat, lng, z.city, z.state, countyFips];
}

console.log(`[zip-index] county resolved for ${matched} ZIPs (${unmatched} unresolved)`);

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, 'zip-index.json');
writeFileSync(outPath, JSON.stringify({ counties, zips }));
console.log(`[zip-index] wrote ${outPath}`);
