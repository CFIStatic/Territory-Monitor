#!/usr/bin/env node
/**
 * OPTIONAL accuracy upgrade: downloads real ZCTA (ZIP-ish) boundaries from the
 * Census cartographic-boundary files and writes data/zcta.geojson.
 *
 *   node scripts/fetch-zcta.mjs                  # whole US (large)
 *   node scripts/fetch-zcta.mjs --states TN,KY   # trim to the states you cover
 *
 * When data/zcta.geojson exists, build-territories.mjs stops approximating with
 * centroid hulls and instead dissolves each territory's actual ZIP polygons.
 * That is the difference between a rough blob and a boundary you can hand to
 * someone in a meeting.
 *
 * Requires outbound access to www2.census.gov. Needs `mapshaper` for the
 * shapefile->GeoJSON conversion: npx mapshaper (installed on demand below).
 */
import { existsSync, mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, '.cache');
const YEAR = '2020';
const URL_SHP = `https://www2.census.gov/geo/tiger/GENZ${YEAR}/shp/cb_${YEAR}_us_zcta520_500k.zip`;

const argStates = process.argv.indexOf('--states');
const STATES = argStates > -1
  ? process.argv[argStates + 1].split(',').map((s) => s.trim().toUpperCase())
  : null;

if (!existsSync(TMP)) mkdirSync(TMP, { recursive: true });
const zipPath = join(TMP, 'zcta.zip');

if (!existsSync(zipPath)) {
  console.log(`[zcta] downloading ${URL_SHP} (~60MB)…`);
  const res = await fetch(URL_SHP);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ZCTA shapefile`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zipPath));
} else {
  console.log('[zcta] using cached .cache/zcta.zip');
}

const outPath = join(ROOT, 'data', 'zcta.geojson');
console.log('[zcta] converting + simplifying via mapshaper…');

// 8% simplification keeps shapes recognisable at metro zoom while cutting the
// file to something a browser will actually load.
execFileSync('npx', [
  '--yes', 'mapshaper',
  `zip://${zipPath}`,
  '-simplify', '8%', 'keep-shapes',
  '-o', 'format=geojson', 'precision=0.00001', outPath,
], { stdio: 'inherit' });

if (STATES) {
  console.log(`[zcta] trimming to ${STATES.join(', ')}…`);
  const { readFileSync } = await import('node:fs');
  const zipIndexPath = join(ROOT, 'data', 'generated', 'zip-index.json');
  if (!existsSync(zipIndexPath)) {
    throw new Error('run `npm run build:zips` first so ZIPs can be matched to states');
  }
  const { zips } = JSON.parse(readFileSync(zipIndexPath, 'utf8'));
  const fc = JSON.parse(readFileSync(outPath, 'utf8'));
  const keep = new Set(
    Object.entries(zips).filter(([, r]) => STATES.includes(r[3])).map(([z]) => z),
  );
  fc.features = fc.features.filter((f) => {
    const z = f.properties?.ZCTA5CE20 ?? f.properties?.GEOID20 ?? f.properties?.ZCTA5CE10;
    return keep.has(String(z));
  });
  writeFileSync(outPath, JSON.stringify(fc));
  console.log(`[zcta] kept ${fc.features.length} ZCTA polygons`);
}

console.log(`[zcta] wrote ${outPath}`);
console.log('[zcta] now run `npm run build:data` — territories will use exact ZIP boundaries.');
