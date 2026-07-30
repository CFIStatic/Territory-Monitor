# Territory Monitor

Internal market-intelligence map for restoration-industry territories — SERVPRO,
ServiceMaster Restore, Paul Davis, PuroClean, BELFOR and whoever else you track.

You give it a list of territories (or a franchise website to scrape). It overlays them
on a map, colour-codes them by brand or by owner, and reports metrics per territory and
across the whole book: population, households, income, area, competitive overlap, county
penetration, and uncovered whitespace.

```bash
npm install
npm run dev          # http://localhost:5173
```

`npm run dev` regenerates the derived data first, so a fresh clone just works.

---

## What you see

| Control | What it does |
|---|---|
| **Color by → Brand** | One hue per franchise brand. |
| **Color by → Owner** | One hue per operating entity — makes multi-unit owners obvious. |
| **Color by → Saturation** | Sequential ramp: darker = more operators claiming the same ZIPs. |
| **Layers** | Territory areas, always-on labels, member ZIP centroids, contested ZIPs, whitespace. |
| **Legend** | Click any brand/owner to show or hide it. |
| **Search** | Territory, owner, brand, ZIP, or "City, ST". |
| **Click a territory** | Full drilldown: demographics, area, overlap, the operators you share ZIPs with, and the ZIP list. |

The right-hand panel with nothing selected is the market rollup — coverage by brand, by
owner, county penetration, and the largest whitespace ZIPs.

---

## Adding territories

`data/territories.json` is the source of truth. Add a record, then `npm run build:data`.

```json
{
  "id": "servpro-brentwood",
  "name": "SERVPRO of Brentwood / Franklin",
  "brandId": "servpro",
  "owner": "Cumberland Restoration Partners LLC",
  "zips": ["37027", "37064", "37067"],
  "source": "franchise-disclosure-doc:2026-06"
}
```

A territory can be defined three ways, and they combine — the ZIP set is the union:

- `zips`: `["37027", "37064"]` — most precise, and how franchise agreements are actually written.
- `cities`: `["Murfreesboro, TN"]` — expanded to every ZIP in that city.
- `counties`: `["47187"]` — 5-digit county FIPS, expanded to every ZIP in that county.

`brandId` must match an entry in `data/brands.json`. Unknown ZIPs, unmatched cities, and
bad FIPS codes are dropped with a warning that shows up in the sidebar rather than failing
the build.

### Scraping a website

```bash
npm run ingest -- https://www.servproofsomewhere.com
npm run ingest -- https://www.example.com --brand servpro --owner "Acme LLC" --append
```

It fetches the landing page, follows likely "areas we serve" links one hop, and harvests
5-digit ZIPs and "City, ST" pairs — validating every ZIP against the real ZIP list so page
furniture (years, prices, phone fragments) gets filtered out. Without `--append` it prints
the record for you to paste; with it, the record is written straight into
`data/territories.json`.

**This is a first-pass extractor, not an oracle.** Franchise sites describe coverage
inconsistently and many render it with JavaScript, in which case you'll get nothing back
and should fall back to the franchisor's locator or the FDD. Anything it produces is
tagged `source: "website:<date>"` and badged **UNVERIFIED** in the UI until you confirm it.

---

## Data accuracy — read this before quoting numbers

The repo ships in its least accurate configuration so it runs offline. Two commands move
it to real data, and the header badges tell you which mode you're in at all times.

### 1. Demographics (population, households, income, home values)

Until you run this, every demographic metric reads **"not loaded"** — the tool shows
geography only and never guesses.

```bash
npm run data:census                     # ACS 5-year, all ZCTAs
CENSUS_API_KEY=xxx npm run data:census  # recommended: api.census.gov/data/key_signup.html
npm run build:data
```

### 2. Exact ZIP boundaries

By default a territory's shape is a **padded concave hull of its member ZIP centroids** —
right neighbourhood, approximate edges. Good enough to see who owns what; not survey-grade.
For real boundaries:

```bash
node scripts/fetch-zcta.mjs --states TN,KY   # trim to states you cover; omit for all US
npm run build:data
```

The badge flips from "Approximate boundaries" to "Exact ZIP boundaries" and territories
become the true dissolved union of their ZIP polygons.

### 3. The seed data is fake

`data/territories.json` ships with six **invented** Middle-Tennessee records so the map
renders on first run. The ZIP assignments do not reflect real franchise boundaries. They
carry `"source": "sample"` and every one is badged UNVERIFIED. Delete them as soon as you
have real records.

---

## Metrics

Per territory: ZIP / city / county counts, service area (mi²), population and density,
households, housing units, median household income (household-weighted), median home value
(owner-occupied-weighted), owner-occupancy %, contested ZIP count and share, and the list of
operators you overlap with plus how many ZIPs you share with each.

Across the book: population and ZIPs covered (each ZIP counted once, so overlaps don't
double-count), coverage by brand and by owner, county penetration, ZIP saturation, and
whitespace — uncovered ZIPs inside counties where somebody already operates, i.e. the
expansion list.

Where demographic coverage is partial, the drilldown says so explicitly rather than
silently understating a total.

---

## Layout

```
data/
  brands.json            brand registry + the validated colour slots
  territories.json       SOURCE OF TRUTH — edit this
  zip-metrics.json       generated by npm run data:census (optional, gitignored)
  zcta.geojson           generated by scripts/fetch-zcta.mjs (optional, gitignored)
  generated/             build intermediates (gitignored)
scripts/
  build-zip-index.mjs    ZIP centroids -> county, via point-in-polygon
  build-territories.mjs  resolve -> geometry -> metrics -> overlap -> rollups
  fetch-census.mjs       ACS demographics
  fetch-zcta.mjs         real ZIP boundaries
  ingest-site.mjs        website -> territory record
public/data/             what the browser loads (gitignored, regenerated)
src/                     Leaflet + TypeScript app
```

Geography is vendored through npm (`zipcodes` for 41,898 ZIP centroids, `us-atlas` for
Census county polygons), so `npm run build:data` needs no network.

### Colour

The eight categorical hues in `data/brands.json` are a validated set — assigned in a fixed
order that keeps adjacent brands separable for colourblind viewers (worst adjacent CVD
ΔE 9.1 light / 8.4 dark), and never cycled. Where a brand's real identity colour had a
matching hue it was kept (SERVPRO orange, ServiceMaster blue, Paul Davis green); the rest
are assigned for separation, not likeness. Territory labels are always on and the panel
carries a table view, so identity never rests on colour alone.

Adding a ninth brand: give it `"slot": null` and it renders in the neutral "Other" grey.
Don't invent a hue — re-run the palette validator if you need a genuinely new slot.
