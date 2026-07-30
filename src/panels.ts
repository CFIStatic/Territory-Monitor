import type { Market, TerritoryFeature } from './types';
import { type ColorContext, colorFor, STATUS } from './colors';
import { compact, esc, num, pct, sqmi, usd } from './format';

const tile = (k: string, v: string, sub = '', wide = false, isNull = false): string => `
  <div class="tile${wide ? ' wide' : ''}">
    <div class="k">${esc(k)}</div>
    <div class="v${isNull ? ' null' : ''}">${v}</div>
    ${sub ? `<div class="s">${sub}</div>` : ''}
  </div>`;

const nullTile = (k: string, sub: string) => tile(k, 'not loaded', sub, false, true);

/** The market-wide view, shown when nothing is selected. */
export function renderMarket(
  market: Market,
  features: TerritoryFeature[],
  ctx: ColorContext,
): string {
  const t = market.totals;
  const demo = market.demographicsLoaded;

  const brandRows = market.byBrand.map((b) => `
    <tr class="clickable" data-filter-brand="${esc(b.key)}">
      <td><span class="name"><span class="swatch" style="background:${esc(b.color)}"></span>${esc(b.label)}</span></td>
      <td class="num">${num(b.territoryCount)}</td>
      <td class="num">${num(b.zipCount)}</td>
      <td class="num">${demo ? compact(b.population) : '—'}</td>
    </tr>`).join('');

  const ownerRows = market.byOwner.slice(0, 25).map((o) => `
    <tr class="clickable" data-filter-owner="${esc(o.key)}">
      <td><span class="name"><span class="swatch" style="background:${esc(ctx.ownerColors.get(o.key) ?? '#898781')}"></span>${esc(o.label)}</span></td>
      <td class="num">${num(o.territoryCount)}</td>
      <td class="num">${num(o.zipCount)}</td>
      <td class="num">${demo ? compact(o.population) : '—'}</td>
    </tr>`).join('');

  const countyRows = market.byCounty.slice(0, 30).map((c) => `
    <tr>
      <td><span class="name">${esc(c.name)}, ${esc(c.state)}</span></td>
      <td class="num">${num(c.territoryCount)}</td>
      <td class="num">${pct(c.coveragePct)}</td>
      <td class="num">${demo ? compact(c.population) : '—'}</td>
    </tr>`).join('');

  const whitespaceRows = market.whitespace.slice(0, 20).map((w) => `
    <tr class="clickable" data-zoom-lat="${w.lat}" data-zoom-lng="${w.lng}">
      <td><span class="name">${esc(w.zip)}</span></td>
      <td>${esc(w.city)}, ${esc(w.state)}</td>
      <td class="num">${demo ? compact(w.population) : '—'}</td>
    </tr>`).join('');

  const contestedShare = t.zipsCovered ? (t.contestedZips / t.zipsCovered) * 100 : 0;

  return `
    <div class="panel-head">
      <div class="eyebrow">Market overview</div>
      <h2>${num(t.territories)} territories · ${num(t.owners)} owners</h2>
      <div class="meta">${num(t.brands)} brands · showing ${num(features.length)} of ${num(t.territories)}</div>
    </div>

    <div class="tiles">
      ${demo
        ? tile('Population covered', compact(t.populationCovered), `${esc(market.demographicsVintage ?? '')}`)
        : nullTile('Population covered', 'run npm run data:census')}
      ${tile('ZIPs covered', num(t.zipsCovered))}
      ${tile('Contested ZIPs', num(t.contestedZips), `${contestedShare.toFixed(1)}% of footprint`)}
      ${tile('Whitespace ZIPs', num(t.whitespaceZips), 'uncovered, in-footprint counties')}
    </div>

    ${t.unverifiedTerritories > 0 ? `
      <div class="section">
        <div class="note">
          <strong>⚑ ${num(t.unverifiedTerritories)} of ${num(t.territories)} territories are unverified.</strong>
          They came from sample seed data or an automated website scrape. Confirm against a
          franchise disclosure document or the franchisor locator before using these numbers
          in a decision.
        </div>
      </div>` : ''}

    <div class="section">
      <h3>Coverage by brand</h3>
      <table class="data">
        <thead><tr><th>Brand</th><th class="num">Terr.</th><th class="num">ZIPs</th><th class="num">Pop.</th></tr></thead>
        <tbody>${brandRows || '<tr><td colspan="4" class="empty">No data</td></tr>'}</tbody>
      </table>
    </div>

    <div class="section">
      <h3>Coverage by owner</h3>
      <table class="data">
        <thead><tr><th>Owner</th><th class="num">Terr.</th><th class="num">ZIPs</th><th class="num">Pop.</th></tr></thead>
        <tbody>${ownerRows || '<tr><td colspan="4" class="empty">No data</td></tr>'}</tbody>
      </table>
      ${market.byOwner.length > 25 ? `<p class="hint">Showing top 25 of ${num(market.byOwner.length)} owners.</p>` : ''}
    </div>

    <div class="section">
      <h3>County penetration</h3>
      <table class="data">
        <thead><tr><th>County</th><th class="num">Terr.</th><th class="num">ZIP cov.</th><th class="num">Pop.</th></tr></thead>
        <tbody>${countyRows || '<tr><td colspan="4" class="empty">No data</td></tr>'}</tbody>
      </table>
      ${market.byCounty.length > 30 ? `<p class="hint">Showing top 30 of ${num(market.byCounty.length)} counties.</p>` : ''}
    </div>

    <div class="section">
      <h3>Largest whitespace</h3>
      <table class="data">
        <thead><tr><th>ZIP</th><th>Place</th><th class="num">Pop.</th></tr></thead>
        <tbody>${whitespaceRows || '<tr><td colspan="3" class="empty">No uncovered ZIPs in footprint counties</td></tr>'}</tbody>
      </table>
      ${!demo ? '<p class="hint">Whitespace is ranked by population — load Census data to rank it meaningfully.</p>' : ''}
    </div>

    <p class="hint">Built ${esc(new Date(market.generatedAt).toLocaleString())} · geometry: ${
      market.geometryMode === 'zcta' ? 'exact ZCTA boundaries' : 'approximated from ZIP centroids'
    }</p>
  `;
}

/** The single-territory drilldown. */
export function renderTerritory(
  f: TerritoryFeature,
  all: Map<string, TerritoryFeature>,
  ctx: ColorContext,
  market: Market,
): string {
  const p = f.properties;
  const m = p.metrics;
  const color = colorFor(p, ctx);
  const demo = market.demographicsLoaded;

  const competitorRows = p.competitors.map((id) => {
    const c = all.get(id);
    if (!c) return '';
    const shared = c.properties.zips.filter((z) => p.zips.includes(z));
    return `
      <tr class="clickable" data-select="${esc(id)}">
        <td><span class="name"><span class="swatch" style="background:${colorFor(c.properties, ctx)}"></span>${esc(c.properties.name)}</span></td>
        <td>${esc(c.properties.brandShort ?? c.properties.brandName)}</td>
        <td class="num">${num(shared.length)}</td>
      </tr>`;
  }).join('');

  const contestedPop = demo
    ? p.contestedZips.reduce((a, z) => a + (market.saturation[z] ? 0 : 0), 0)
    : null;
  void contestedPop; // per-ZIP population lives in zip-points, surfaced on hover instead

  return `
    <button class="back-btn" type="button" data-select="">← Market overview</button>

    <div class="panel-head">
      <div class="eyebrow">${esc(p.brandName)}</div>
      <h2>${esc(p.name)}</h2>
      <div class="meta">
        <span class="swatch" style="background:${color}"></span>
        ${esc(p.owner)}
        ${p.franchiseNumber ? ` · #${esc(p.franchiseNumber)}` : ''}
      </div>
    </div>

    ${p.unverified ? `
      <div class="section">
        <div class="note">
          <strong>⚑ Unverified.</strong> Source: <code>${esc(p.source)}</code>. These boundaries have not
          been confirmed against a primary source.
        </div>
      </div>` : ''}

    <div class="tiles">
      ${demo
        ? tile('Population', num(m.population), m.popDensity != null ? `${num(m.popDensity)} / mi²` : '')
        : nullTile('Population', 'npm run data:census')}
      ${demo ? tile('Households', num(m.households)) : nullTile('Households', '')}
      ${demo ? tile('Median income', usd(m.medianIncome), 'household-weighted') : nullTile('Median income', '')}
      ${demo ? tile('Median home value', usd(m.medianHomeValue), 'owner-occ. weighted') : nullTile('Median home value', '')}
      ${tile('ZIP codes', num(m.zipCount), `${num(m.cityCount)} cities · ${num(m.countyCount)} counties`)}
      ${tile('Service area', sqmi(m.areaSqMi))}
    </div>

    <div class="section">
      <h3>Competitive overlap</h3>
      <div class="tiles">
        ${tile('Contested ZIPs', `${num(m.contestedZipCount)}`, `${pct(m.contestedPct)} of territory`)}
        ${tile('Overlapping operators', num(m.competitorCount))}
      </div>
      ${m.competitorCount > 0 ? `
        <table class="data">
          <thead><tr><th>Operator</th><th>Brand</th><th class="num">Shared</th></tr></thead>
          <tbody>${competitorRows}</tbody>
        </table>`
      : `<p class="empty" style="color:${STATUS.good}">✓ Exclusive — no other tracked operator claims these ZIPs.</p>`}
    </div>

    ${demo && m.dataCoveragePct != null && m.dataCoveragePct < 100 ? `
      <div class="section">
        <div class="note">
          Demographics resolved for ${num(m.coveredZips)} of ${num(m.zipCount)} ZIPs
          (${pct(m.dataCoveragePct)}). Totals understate the true figures — some ZIPs are
          PO-box-only or have no matching ZCTA.
        </div>
      </div>` : ''}

    <div class="section">
      <h3>Housing</h3>
      <dl class="kv">
        <dt>Housing units</dt><dd>${demo ? num(m.housingUnits) : '—'}</dd>
        <dt>Owner-occupied</dt><dd>${demo ? pct(m.ownerOccupiedPct) : '—'}</dd>
        <dt>States</dt><dd>${esc(p.states.join(', '))}</dd>
        <dt>Status</dt><dd>${esc(p.status)}</dd>
      </dl>
    </div>

    <div class="section">
      <h3>Counties</h3>
      <div class="chips">
        ${p.counties.map((c) => `<span class="chip">${esc(c.name)}, ${esc(c.state)}</span>`).join('')}
      </div>
    </div>

    <div class="section">
      <h3>ZIP codes (${num(p.zips.length)})</h3>
      <div class="chips">
        ${p.zips.map((z) => `<span class="chip${p.contestedZips.includes(z) ? ' contested' : ''}">${esc(z)}</span>`).join('')}
      </div>
      ${p.contestedZips.length ? `<p class="hint">Red = claimed by another tracked operator.</p>` : ''}
    </div>

    ${p.website ? `<div class="section"><a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website)}</a></div>` : ''}
    ${p.notes ? `<div class="section"><h3>Notes</h3><p class="hint">${esc(p.notes)}</p></div>` : ''}
  `;
}
