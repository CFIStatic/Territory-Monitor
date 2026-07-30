#!/usr/bin/env node
/**
 * Builds data/generated/territories.geo.json and data/generated/market.json.
 *
 * Pipeline per territory:
 *   1. resolve the ZIP set  (explicit zips  U  cities->zips  U  counties->zips)
 *   2. build a service-area polygon from the member ZIP centroids
 *   3. attach demographics from data/zip-metrics.json when present
 *   4. cross-reference every other territory to find contested ZIPs
 *
 * Then rolls the whole book up into market.json: coverage by brand, by owner,
 * by county, plus saturation counts and whitespace (uncovered ZIPs inside
 * counties where somebody already operates).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as turf from '@turf/turf';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const GEN_DIR = join(DATA, 'generated'); // build-time intermediates
const OUT_DIR = join(ROOT, 'public', 'data'); // what the browser actually loads

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const brandsFile = readJson(join(DATA, 'brands.json'));
const territoriesFile = readJson(join(DATA, 'territories.json'));
const zipIndex = readJson(join(GEN_DIR, 'zip-index.json'));

// Demographics are optional: `npm run data:census` produces this on a machine
// with access to api.census.gov. Everything degrades gracefully without it.
const metricsPath = join(DATA, 'zip-metrics.json');
const zipMetrics = existsSync(metricsPath) ? readJson(metricsPath) : null;
if (zipMetrics) {
  console.log(`[territories] demographics loaded for ${Object.keys(zipMetrics.zips ?? {}).length} ZIPs (${zipMetrics.vintage ?? 'unknown vintage'})`);
} else {
  console.log('[territories] no data/zip-metrics.json — demographic metrics will be null. Run `npm run data:census` to populate.');
}

// Real ZIP boundaries, also optional: `node scripts/fetch-zcta.mjs`. Present =>
// territories are the true dissolved union of their ZIPs instead of a centroid hull.
const zctaPath = join(DATA, 'zcta.geojson');
const zctaByZip = new Map();
if (existsSync(zctaPath)) {
  for (const f of readJson(zctaPath).features ?? []) {
    const p = f.properties ?? {};
    const zip = String(p.ZCTA5CE20 ?? p.GEOID20 ?? p.ZCTA5CE10 ?? p.GEOID10 ?? '').padStart(5, '0');
    if (/^\d{5}$/.test(zip)) zctaByZip.set(zip, f);
  }
  console.log(`[territories] ZCTA boundaries loaded for ${zctaByZip.size} ZIPs — using exact geometry`);
} else {
  console.log('[territories] no data/zcta.geojson — approximating territories from ZIP centroids. Run `node scripts/fetch-zcta.mjs` for exact boundaries.');
}

const brandById = new Map(brandsFile.brands.map((b) => [b.id, b]));
const { zips: ZIPS, counties: COUNTIES } = zipIndex;

// ------------------------------------------------------------------ lookups
const zipsByCity = new Map();   // "murfreesboro, tn" -> [zip]
const zipsByCounty = new Map(); // "47187" -> [zip]
for (const [zip, rec] of Object.entries(ZIPS)) {
  const [, , city, state, countyFips] = rec;
  const ck = `${String(city).toLowerCase()}, ${String(state).toLowerCase()}`;
  if (!zipsByCity.has(ck)) zipsByCity.set(ck, []);
  zipsByCity.get(ck).push(zip);
  if (countyFips) {
    if (!zipsByCounty.has(countyFips)) zipsByCounty.set(countyFips, []);
    zipsByCounty.get(countyFips).push(zip);
  }
}

const warnings = [];

/** Expand a territory definition into a deduped, validated ZIP list. */
function resolveZips(t) {
  const set = new Set();

  for (const raw of t.zips ?? []) {
    const zip = String(raw).trim().padStart(5, '0');
    if (ZIPS[zip]) set.add(zip);
    else warnings.push(`${t.id}: unknown ZIP "${raw}" — dropped`);
  }

  for (const city of t.cities ?? []) {
    const key = String(city).toLowerCase().trim();
    const hits = zipsByCity.get(key);
    if (hits?.length) hits.forEach((z) => set.add(z));
    else warnings.push(`${t.id}: city "${city}" matched no ZIPs (expected "City, ST") — skipped`);
  }

  for (const fips of t.counties ?? []) {
    const key = String(fips).trim().padStart(5, '0');
    const hits = zipsByCounty.get(key);
    if (hits?.length) hits.forEach((z) => set.add(z));
    else warnings.push(`${t.id}: county FIPS "${fips}" matched no ZIPs — skipped`);
  }

  return [...set].sort();
}

/**
 * Turn member ZIP centroids into a service-area polygon.
 *
 * Centroids are points, not boundaries, so this is deliberately an approximation:
 * a concave hull, padded outward so edge ZIPs sit inside the shape rather than
 * exactly on its border. Set `geometryMode: "zcta"` once you supply real ZCTA
 * boundaries (see scripts/fetch-zcta.mjs) if you need survey-grade edges.
 */
function buildPolygon(zipList) {
  // Exact path: dissolve the member ZCTA polygons into one multipolygon.
  if (zctaByZip.size) {
    const parts = zipList.map((z) => zctaByZip.get(z)).filter(Boolean);
    if (parts.length) {
      let merged = parts[0];
      for (let i = 1; i < parts.length; i++) {
        try {
          merged = turf.union(turf.featureCollection([merged, parts[i]])) ?? merged;
        } catch {
          // Self-intersecting source polygons can break a single union step;
          // skipping that ZIP is better than dropping the whole territory.
        }
      }
      return turf.simplify(merged, { tolerance: 0.0008, highQuality: true, mutate: true });
    }
  }

  // Approximate path: hull of centroids.
  const coords = zipList.map((z) => [ZIPS[z][1], ZIPS[z][0]]); // [lng, lat]
  if (!coords.length) return null;

  const PAD_MILES = 2.5;

  if (coords.length === 1) {
    return turf.circle(coords[0], 5, { units: 'miles', steps: 48 });
  }
  if (coords.length === 2) {
    return turf.buffer(turf.lineString(coords), 4, { units: 'miles' });
  }

  const fc = turf.featureCollection(coords.map((c) => turf.point(c)));
  let hull = null;
  // Widen maxEdge until the concave hull closes; very spread-out rural
  // territories need a long leash before they stop returning null.
  for (const maxEdge of [8, 12, 20, 30, 50, 80, 140]) {
    try {
      hull = turf.concave(fc, { maxEdge, units: 'miles' });
    } catch {
      hull = null;
    }
    if (hull) break;
  }
  if (!hull) hull = turf.convex(fc);
  if (!hull) return turf.buffer(turf.lineString(coords), 4, { units: 'miles' });

  const padded = turf.buffer(hull, PAD_MILES, { units: 'miles' }) ?? hull;
  return turf.simplify(padded, { tolerance: 0.004, highQuality: true, mutate: true });
}

/** Sum the demographic columns across a ZIP list. Returns nulls when unloaded. */
function demographics(zipList) {
  const empty = {
    population: null, households: null, housingUnits: null,
    medianIncome: null, medianHomeValue: null, ownerOccupiedPct: null,
    coveredZips: 0, dataCoveragePct: null,
  };
  if (!zipMetrics?.zips) return empty;

  let pop = 0, hh = 0, hu = 0, ownerOcc = 0, covered = 0;
  let incomeWeighted = 0, incomeWeight = 0;
  let valueWeighted = 0, valueWeight = 0;

  for (const z of zipList) {
    const m = zipMetrics.zips[z];
    if (!m) continue;
    covered++;
    pop += m.population ?? 0;
    hh += m.households ?? 0;
    hu += m.housingUnits ?? 0;
    ownerOcc += m.ownerOccupied ?? 0;
    // Weight income by households and home value by owner-occupied units — a
    // flat average across ZIPs would let a 200-household ZIP outvote a 12,000-
    // household one.
    if (m.medianIncome != null && m.households) {
      incomeWeighted += m.medianIncome * m.households;
      incomeWeight += m.households;
    }
    if (m.medianHomeValue != null && m.ownerOccupied) {
      valueWeighted += m.medianHomeValue * m.ownerOccupied;
      valueWeight += m.ownerOccupied;
    }
  }

  if (!covered) return empty;
  return {
    population: pop,
    households: hh,
    housingUnits: hu,
    medianIncome: incomeWeight ? Math.round(incomeWeighted / incomeWeight) : null,
    medianHomeValue: valueWeight ? Math.round(valueWeighted / valueWeight) : null,
    ownerOccupiedPct: hu ? +((ownerOcc / hu) * 100).toFixed(1) : null,
    coveredZips: covered,
    dataCoveragePct: +((covered / zipList.length) * 100).toFixed(1),
  };
}

// --------------------------------------------------------------- resolve pass
const resolved = [];
for (const t of territoriesFile.territories) {
  if (!brandById.has(t.brandId)) {
    warnings.push(`${t.id}: unknown brandId "${t.brandId}" — falling back to "independent"`);
  }
  const zipList = resolveZips(t);
  if (!zipList.length) {
    warnings.push(`${t.id}: resolved to zero ZIPs — excluded from the map`);
    continue;
  }
  resolved.push({ def: t, zips: zipList });
}

// --------------------------------------------------------------- overlap pass
const territoriesByZip = new Map();
for (const { def, zips } of resolved) {
  for (const z of zips) {
    if (!territoriesByZip.has(z)) territoriesByZip.set(z, []);
    territoriesByZip.get(z).push(def.id);
  }
}

// --------------------------------------------------------------- feature pass
const features = [];
for (const { def, zips } of resolved) {
  const brand = brandById.get(def.brandId) ?? brandById.get('independent');
  const poly = buildPolygon(zips);
  if (!poly) { warnings.push(`${def.id}: could not build geometry — excluded`); continue; }

  const areaSqMi = turf.area(poly) / 2_589_988.11;
  const demo = demographics(zips);

  const contested = zips.filter((z) => territoriesByZip.get(z).length > 1);
  const competitorIds = new Set();
  for (const z of contested) {
    for (const id of territoriesByZip.get(z)) if (id !== def.id) competitorIds.add(id);
  }

  const countyFipsSet = new Set(zips.map((z) => ZIPS[z][4]).filter(Boolean));
  const cityNames = new Set(zips.map((z) => `${ZIPS[z][2]}, ${ZIPS[z][3]}`));
  const stateSet = new Set(zips.map((z) => ZIPS[z][3]));

  features.push({
    type: 'Feature',
    geometry: poly.geometry,
    properties: {
      id: def.id,
      name: def.name,
      brandId: brand.id,
      brandName: brand.name,
      brandShort: brand.short ?? brand.name,
      brandColor: brand.color,
      brandColorDark: brand.colorDark ?? brand.color,
      owner: def.owner ?? 'Unknown',
      franchiseNumber: def.franchiseNumber ?? null,
      website: def.website ?? null,
      phone: def.phone ?? null,
      status: def.status ?? 'active',
      notes: def.notes ?? null,
      source: def.source ?? 'unspecified',
      unverified: (def.source ?? '') === 'sample' || !def.source,
      zips,
      metrics: {
        zipCount: zips.length,
        cityCount: cityNames.size,
        countyCount: countyFipsSet.size,
        areaSqMi: +areaSqMi.toFixed(1),
        popDensity: demo.population != null && areaSqMi > 0
          ? Math.round(demo.population / areaSqMi) : null,
        ...demo,
        contestedZipCount: contested.length,
        contestedPct: +((contested.length / zips.length) * 100).toFixed(1),
        competitorCount: competitorIds.size,
      },
      contestedZips: contested,
      competitors: [...competitorIds],
      counties: [...countyFipsSet].map((f) => ({
        fips: f, name: COUNTIES[f]?.name ?? f, state: COUNTIES[f]?.state ?? '??',
      })),
      states: [...stateSet].sort(),
    },
  });
}

// --------------------------------------------------------------- market rollup
const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) ?? 0), 0);

/** Population counted once per ZIP, so overlapping territories don't double-count. */
function uniquePopulation(zipSet) {
  if (!zipMetrics?.zips) return null;
  let p = 0;
  for (const z of zipSet) p += zipMetrics.zips[z]?.population ?? 0;
  return p;
}

function groupBy(keyFn, labelFn) {
  const groups = new Map();
  for (const f of features) {
    const k = keyFn(f.properties);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  }
  return [...groups.entries()].map(([key, fs]) => {
    const zipSet = new Set(fs.flatMap((f) => f.properties.zips));
    return {
      key,
      label: labelFn(fs[0].properties),
      color: fs[0].properties.brandColor,
      territoryCount: fs.length,
      zipCount: zipSet.size,
      areaSqMi: +sum(fs, (f) => f.properties.metrics.areaSqMi).toFixed(1),
      population: uniquePopulation(zipSet),
      owners: [...new Set(fs.map((f) => f.properties.owner))].length,
    };
  }).sort((a, b) => (b.population ?? b.zipCount) - (a.population ?? a.zipCount));
}

const allCoveredZips = new Set(features.flatMap((f) => f.properties.zips));

// Saturation: how many territories claim each ZIP. Drives the contested overlay.
const saturation = {};
for (const [z, ids] of territoriesByZip) if (ids.length > 1) saturation[z] = ids.length;

// Whitespace: ZIPs with zero coverage inside counties where somebody operates.
// This is the "where could we expand next" list.
const operatingCounties = new Set(
  features.flatMap((f) => f.properties.counties.map((c) => c.fips)),
);
const whitespace = [];
for (const fips of operatingCounties) {
  for (const z of zipsByCounty.get(fips) ?? []) {
    if (allCoveredZips.has(z)) continue;
    whitespace.push({
      zip: z,
      city: ZIPS[z][2],
      state: ZIPS[z][3],
      countyFips: fips,
      countyName: COUNTIES[fips]?.name ?? fips,
      lat: ZIPS[z][0],
      lng: ZIPS[z][1],
      population: zipMetrics?.zips?.[z]?.population ?? null,
    });
  }
}
whitespace.sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

const market = {
  generatedAt: new Date().toISOString(),
  demographicsLoaded: Boolean(zipMetrics),
  demographicsVintage: zipMetrics?.vintage ?? null,
  geometryMode: zctaByZip.size ? 'zcta' : 'centroid-hull',
  totals: {
    territories: features.length,
    brands: new Set(features.map((f) => f.properties.brandId)).size,
    owners: new Set(features.map((f) => f.properties.owner)).size,
    zipsCovered: allCoveredZips.size,
    populationCovered: uniquePopulation(allCoveredZips),
    contestedZips: Object.keys(saturation).length,
    whitespaceZips: whitespace.length,
    unverifiedTerritories: features.filter((f) => f.properties.unverified).length,
  },
  byBrand: groupBy((p) => p.brandId, (p) => p.brandName),
  byOwner: groupBy((p) => p.owner, (p) => p.owner),
  byCounty: [...operatingCounties].map((fips) => {
    const inCounty = features.filter((f) => f.properties.counties.some((c) => c.fips === fips));
    const countyZips = zipsByCounty.get(fips) ?? [];
    const covered = countyZips.filter((z) => allCoveredZips.has(z));
    return {
      fips,
      name: COUNTIES[fips]?.name ?? fips,
      state: COUNTIES[fips]?.state ?? '??',
      territoryCount: inCounty.length,
      brands: [...new Set(inCounty.map((f) => f.properties.brandName))],
      zipCount: countyZips.length,
      coveredZips: covered.length,
      coveragePct: countyZips.length ? +((covered.length / countyZips.length) * 100).toFixed(1) : 0,
      population: uniquePopulation(countyZips),
    };
  }).sort((a, b) => b.territoryCount - a.territoryCount),
  saturation,
  whitespace: whitespace.slice(0, 500),
  warnings,
};

// Ship only the ZIP centroids the UI actually plots (territory members, contested
// ZIPs, whitespace) rather than the whole 2.3MB national index.
const neededZips = new Set([
  ...features.flatMap((f) => f.properties.zips),
  ...Object.keys(saturation),
  ...whitespace.slice(0, 500).map((w) => w.zip),
]);
const zipPoints = {};
for (const z of neededZips) {
  const r = ZIPS[z];
  if (!r) continue;
  zipPoints[z] = {
    lat: r[0], lng: r[1], city: r[2], state: r[3],
    county: r[4] ? (COUNTIES[r[4]]?.name ?? null) : null,
    population: zipMetrics?.zips?.[z]?.population ?? null,
    medianIncome: zipMetrics?.zips?.[z]?.medianIncome ?? null,
    owners: territoriesByZip.get(z) ?? [],
  };
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, 'territories.geo.json'),
  JSON.stringify({ type: 'FeatureCollection', features }),
);
writeFileSync(join(OUT_DIR, 'market.json'), JSON.stringify(market));
writeFileSync(join(OUT_DIR, 'brands.json'), JSON.stringify(brandsFile));
writeFileSync(join(OUT_DIR, 'zip-points.json'), JSON.stringify(zipPoints));

console.log(`[territories] built ${features.length} territories across ${market.totals.brands} brands / ${market.totals.owners} owners`);
console.log(`[territories] ${market.totals.zipsCovered} ZIPs covered, ${market.totals.contestedZips} contested, ${market.totals.whitespaceZips} whitespace ZIPs in-footprint`);
if (warnings.length) {
  console.log(`[territories] ${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 25)) console.log(`  ! ${w}`);
  if (warnings.length > 25) console.log(`  … ${warnings.length - 25} more (see market.json)`);
}
