import './style.css';
import type { Brand, ColorMode, Market, TerritoryFeature, ZipPoint } from './types';
import { buildOwnerColors, type ColorContext, isDark, OTHER_GRAY, SATURATION_LEGEND } from './colors';
import { TerritoryMap } from './mapLayers';
import { renderMarket, renderTerritory } from './panels';
import { compact, esc, num } from './format';

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`missing element: ${sel}`);
  return el;
};

// ------------------------------------------------------------------- state
interface State {
  mode: ColorMode;
  hiddenBrands: Set<string>;
  hiddenOwners: Set<string>;
  selected: string | null;
}

const state: State = {
  mode: 'brand',
  hiddenBrands: new Set(),
  hiddenOwners: new Set(),
  selected: null,
};

const MODE_HINT: Record<ColorMode, string> = {
  brand: 'One hue per franchise brand, assigned in a fixed colorblind-safe order.',
  owner: 'One hue per operating entity — shows multi-unit owners holding several territories.',
  saturation: 'Darker = more operators claiming the same ZIPs. Sequential, not categorical.',
};

// -------------------------------------------------------------------- load
async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

const [geo, market, brandsFile, zipPoints] = await Promise.all([
  loadJson<{ features: TerritoryFeature[] }>('/data/territories.geo.json'),
  loadJson<Market>('/data/market.json'),
  loadJson<{ brands: Brand[] }>('/data/brands.json'),
  loadJson<Record<string, ZipPoint>>('/data/zip-points.json'),
]);

const allFeatures = geo.features;
const byId = new Map(allFeatures.map((f) => [f.properties.id, f]));
const brandById = new Map(brandsFile.brands.map((b) => [b.id, b]));

// Owner colors are assigned once, from the full owner list, so filtering never
// repaints the territories that remain visible.
const ownerColors = buildOwnerColors(allFeatures.map((f) => f.properties.owner));

const ctx = (): ColorContext => ({ mode: state.mode, ownerColors });

// --------------------------------------------------------------------- map
const tmap = new TerritoryMap($('#map'), {
  onSelect: (id) => {
    state.selected = id;
    renderPanel();
  },
});

function visibleFeatures(): TerritoryFeature[] {
  return allFeatures.filter((f) =>
    !state.hiddenBrands.has(f.properties.brandId)
    && !state.hiddenOwners.has(f.properties.owner));
}

function redraw(fit = false): void {
  const features = visibleFeatures();
  tmap.renderTerritories(features, ctx());
  tmap.renderZipPoints(features, zipPoints, market, ctx());
  tmap.renderWhitespace(market);
  $('#map-empty').hidden = features.length > 0;
  if (fit && features.length) tmap.fitAll();
  renderLegend();
  renderPanel();
}

// ------------------------------------------------------------------ panels
function renderPanel(): void {
  const panel = $('#panel');
  const sel = state.selected ? byId.get(state.selected) : null;
  panel.innerHTML = sel
    ? renderTerritory(sel, byId, ctx(), market)
    : renderMarket(market, visibleFeatures(), ctx());
  panel.scrollTop = 0;

  panel.querySelectorAll<HTMLElement>('[data-select]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.select || null;
      state.selected = id;
      tmap.select(id);
      if (id) tmap.zoomTo(id);
      renderPanel();
    });
  });

  // Clicking a brand/owner row in the overview isolates that group.
  panel.querySelectorAll<HTMLElement>('[data-filter-brand]').forEach((el) => {
    el.addEventListener('click', () => isolate('brand', el.dataset.filterBrand!));
  });
  panel.querySelectorAll<HTMLElement>('[data-filter-owner]').forEach((el) => {
    el.addEventListener('click', () => isolate('owner', el.dataset.filterOwner!));
  });
  panel.querySelectorAll<HTMLElement>('[data-zoom-lat]').forEach((el) => {
    el.addEventListener('click', () => {
      tmap.zoomToPoint(Number(el.dataset.zoomLat), Number(el.dataset.zoomLng), 12);
      ($('#layer-whitespace') as HTMLInputElement).checked = true;
      tmap.setLayerVisible('whitespace', true);
    });
  });
}

function isolate(kind: 'brand' | 'owner', key: string): void {
  if (kind === 'brand') {
    const others = new Set(allFeatures.map((f) => f.properties.brandId));
    others.delete(key);
    // Toggle: a second click on an already-isolated group restores everything.
    state.hiddenBrands = state.hiddenBrands.size === others.size ? new Set() : others;
    state.hiddenOwners = new Set();
    state.mode = 'brand';
  } else {
    const others = new Set(allFeatures.map((f) => f.properties.owner));
    others.delete(key);
    state.hiddenOwners = state.hiddenOwners.size === others.size ? new Set() : others;
    state.hiddenBrands = new Set();
    state.mode = 'owner';
  }
  syncModeButtons();
  redraw(true);
}

// ------------------------------------------------------------------ legend
function renderLegend(): void {
  const legend = $('#legend');
  const title = $('#legend-title');

  if (state.mode === 'saturation') {
    title.textContent = 'Operators per ZIP';
    legend.innerHTML = SATURATION_LEGEND.map((s) => `
      <div class="legend-item" style="cursor:default">
        <span class="swatch" style="background:${s.color}"></span>
        <span class="lbl">${esc(s.label)}</span>
      </div>`).join('');
    $('#filter-all').hidden = true;
    return;
  }

  $('#filter-all').hidden = false;

  if (state.mode === 'brand') {
    title.textContent = 'Brands';
    const counts = new Map<string, number>();
    for (const f of allFeatures) {
      counts.set(f.properties.brandId, (counts.get(f.properties.brandId) ?? 0) + 1);
    }
    legend.innerHTML = [...counts.entries()]
      .sort((a, b) => (brandById.get(a[0])?.slot ?? 99) - (brandById.get(b[0])?.slot ?? 99))
      .map(([id, count]) => {
        const b = brandById.get(id);
        const color = b ? (isDark() ? b.colorDark : b.color) : OTHER_GRAY;
        const off = state.hiddenBrands.has(id);
        return `
          <button type="button" class="legend-item${off ? ' off' : ''}" data-toggle-brand="${esc(id)}"
                  aria-pressed="${!off}">
            <span class="swatch" style="background:${color}"></span>
            <span class="lbl">${esc(b?.name ?? id)}</span>
            <span class="cnt">${num(count)}</span>
          </button>`;
      }).join('');
  } else {
    title.textContent = 'Owners';
    const counts = new Map<string, number>();
    for (const f of allFeatures) {
      counts.set(f.properties.owner, (counts.get(f.properties.owner) ?? 0) + 1);
    }
    legend.innerHTML = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([owner, count]) => {
        const off = state.hiddenOwners.has(owner);
        return `
          <button type="button" class="legend-item${off ? ' off' : ''}" data-toggle-owner="${esc(owner)}"
                  aria-pressed="${!off}" title="${esc(owner)}">
            <span class="swatch" style="background:${ownerColors.get(owner) ?? OTHER_GRAY}"></span>
            <span class="lbl">${esc(owner)}</span>
            <span class="cnt">${num(count)}</span>
          </button>`;
      }).join('');
  }

  legend.querySelectorAll<HTMLElement>('[data-toggle-brand]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.toggleBrand!;
      state.hiddenBrands.has(id) ? state.hiddenBrands.delete(id) : state.hiddenBrands.add(id);
      redraw();
    });
  });
  legend.querySelectorAll<HTMLElement>('[data-toggle-owner]').forEach((el) => {
    el.addEventListener('click', () => {
      const o = el.dataset.toggleOwner!;
      state.hiddenOwners.has(o) ? state.hiddenOwners.delete(o) : state.hiddenOwners.add(o);
      redraw();
    });
  });
}

// ------------------------------------------------------------ data status
function renderStatus(): void {
  const t = market.totals;
  const badges: string[] = [];

  badges.push(market.demographicsLoaded
    ? `<span class="badge ok" title="${esc(market.demographicsVintage ?? '')}"><span class="ico">●</span>${esc(market.demographicsVintage ?? 'Census loaded')}</span>`
    : '<span class="badge warn"><span class="ico">▲</span>No demographics — run npm run data:census</span>');

  badges.push(market.geometryMode === 'zcta'
    ? '<span class="badge ok"><span class="ico">●</span>Exact ZIP boundaries</span>'
    : '<span class="badge warn"><span class="ico">▲</span>Approximate boundaries</span>');

  if (t.unverifiedTerritories > 0) {
    badges.push(`<span class="badge bad"><span class="ico">⚑</span>${num(t.unverifiedTerritories)} unverified</span>`);
  }

  $('#data-status').innerHTML = badges.join('');
}

// ------------------------------------------------------------------ search
function runSearch(q: string): void {
  const box = $('#search-results');
  const query = q.trim().toLowerCase();
  if (query.length < 2) { box.hidden = true; box.innerHTML = ''; return; }

  type Hit = { label: string; sub: string; act: () => void };
  const hits: Hit[] = [];

  for (const f of allFeatures) {
    const p = f.properties;
    if (p.name.toLowerCase().includes(query)
      || p.owner.toLowerCase().includes(query)
      || p.brandName.toLowerCase().includes(query)) {
      hits.push({
        label: p.name,
        sub: p.owner,
        act: () => { state.selected = p.id; tmap.select(p.id); tmap.zoomTo(p.id); renderPanel(); },
      });
    }
  }

  if (/^\d{3,5}$/.test(query)) {
    for (const [zip, pt] of Object.entries(zipPoints)) {
      if (!zip.startsWith(query)) continue;
      const owners = pt.owners.map((id) => byId.get(id)?.properties.name).filter(Boolean);
      hits.push({
        label: zip,
        sub: owners.length ? `${owners.length} operator${owners.length > 1 ? 's' : ''}` : 'no coverage',
        act: () => {
          tmap.zoomToPoint(pt.lat, pt.lng, 11);
          if (pt.owners[0]) { state.selected = pt.owners[0]; tmap.select(pt.owners[0]); renderPanel(); }
        },
      });
    }
  } else {
    const seenPlace = new Set<string>();
    for (const [zip, pt] of Object.entries(zipPoints)) {
      const place = `${pt.city}, ${pt.state}`;
      if (!place.toLowerCase().includes(query) || seenPlace.has(place)) continue;
      seenPlace.add(place);
      hits.push({
        label: place,
        sub: pt.owners.length ? `${pt.owners.length} operator${pt.owners.length > 1 ? 's' : ''}` : 'no coverage',
        act: () => tmap.zoomToPoint(pt.lat, pt.lng, 10),
      });
      void zip;
    }
  }

  const top = hits.slice(0, 12);
  box.hidden = top.length === 0;
  box.innerHTML = '';
  top.forEach((h) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `<span>${esc(h.label)}</span><span class="r-sub">${esc(h.sub)}</span>`;
    btn.addEventListener('click', () => {
      h.act();
      box.hidden = true;
      ($('#search') as HTMLInputElement).value = '';
    });
    box.appendChild(btn);
  });
}

// -------------------------------------------------------------------- wire
function syncModeButtons(): void {
  document.querySelectorAll<HTMLButtonElement>('.segmented button').forEach((b) => {
    const on = b.dataset.mode === state.mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
  $('#mode-hint').textContent = MODE_HINT[state.mode];
}

document.querySelectorAll<HTMLButtonElement>('.segmented button').forEach((b) => {
  b.addEventListener('click', () => {
    state.mode = b.dataset.mode as ColorMode;
    syncModeButtons();
    redraw();
  });
});

const LAYERS: [string, Parameters<TerritoryMap['setLayerVisible']>[0]][] = [
  ['#layer-territories', 'territories'],
  ['#layer-labels', 'labels'],
  ['#layer-zips', 'zips'],
  ['#layer-contested', 'contested'],
  ['#layer-whitespace', 'whitespace'],
];
for (const [sel, name] of LAYERS) {
  const input = $(sel) as HTMLInputElement;
  input.addEventListener('change', () => tmap.setLayerVisible(name, input.checked));
}

$('#filter-all').addEventListener('click', () => {
  state.hiddenBrands.clear();
  state.hiddenOwners.clear();
  redraw(true);
});

$('#search').addEventListener('input', (e) => runSearch((e.target as HTMLInputElement).value));
$('#search').addEventListener('blur', () => setTimeout(() => { $('#search-results').hidden = true; }, 150));

$('#theme-toggle').addEventListener('click', () => {
  document.documentElement.dataset.theme = isDark() ? 'light' : 'dark';
  tmap.refreshBasemap();
  redraw();
});

if (market.warnings.length) {
  $('#warnings-group').hidden = false;
  $('#warnings').innerHTML = market.warnings
    .slice(0, 40)
    .map((w) => `<li>${esc(w)}</li>`)
    .join('');
}

// ------------------------------------------------------------------- start
syncModeButtons();
renderStatus();
redraw(true);

// eslint-disable-next-line no-console
console.info(
  `[territory-monitor] ${allFeatures.length} territories · ${market.totals.zipsCovered} ZIPs · `
  + `${market.totals.contestedZips} contested · demographics=${market.demographicsLoaded} · `
  + `population=${compact(market.totals.populationCovered)}`,
);
