import L from 'leaflet';
import type { Market, TerritoryFeature, ZipPoint } from './types';
import { type ColorContext, colorFor, isDark, STATUS } from './colors';
import { compact, esc, num } from './format';

// Muted analytic basemaps — the territory fills carry the signal, the map underneath
// should stay out of the way. Falls back to a plain plane if tiles can't load.
const BASEMAP = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};
const ATTRIB = '&copy; OpenStreetMap &copy; CARTO';

export interface MapCallbacks {
  onSelect(id: string | null): void;
}

export class TerritoryMap {
  readonly map: L.Map;

  private tiles: L.TileLayer;
  private territoryLayer = L.layerGroup();
  private labelLayer = L.layerGroup();
  private zipLayer = L.layerGroup();
  private contestedLayer = L.layerGroup();
  private whitespaceLayer = L.layerGroup();

  private paths = new Map<string, L.GeoJSON>();
  private labels = new Map<string, L.Marker>();
  private selectedId: string | null = null;

  constructor(el: HTMLElement, private cb: MapCallbacks) {
    this.map = L.map(el, { zoomControl: true, preferCanvas: false }).setView([39.5, -98.35], 4);
    this.tiles = L.tileLayer(isDark() ? BASEMAP.dark : BASEMAP.light, {
      attribution: ATTRIB, maxZoom: 18, subdomains: 'abcd',
    }).addTo(this.map);

    this.territoryLayer.addTo(this.map);
    this.labelLayer.addTo(this.map);

    // Clicking bare map clears the selection.
    this.map.on('click', () => this.select(null, true));
  }

  refreshBasemap(): void {
    this.tiles.setUrl(isDark() ? BASEMAP.dark : BASEMAP.light);
  }

  setLayerVisible(name: 'territories' | 'labels' | 'zips' | 'contested' | 'whitespace', on: boolean): void {
    const layer = {
      territories: this.territoryLayer,
      labels: this.labelLayer,
      zips: this.zipLayer,
      contested: this.contestedLayer,
      whitespace: this.whitespaceLayer,
    }[name];
    if (on) layer.addTo(this.map);
    else layer.remove();
  }

  /** Full redraw of the territory polygons for the given filtered set. */
  renderTerritories(features: TerritoryFeature[], ctx: ColorContext): void {
    this.territoryLayer.clearLayers();
    this.labelLayer.clearLayers();
    this.paths.clear();
    this.labels.clear();

    for (const f of features) {
      const p = f.properties;
      const color = colorFor(p, ctx);

      const poly = L.geoJSON(f as GeoJSON.Feature, {
        style: {
          color,
          weight: 2,
          opacity: 0.95,
          // Semi-transparent so overlapping claims read as a darker band rather
          // than one territory simply hiding another.
          fillColor: color,
          fillOpacity: 0.3,
        },
      });

      poly.bindTooltip(this.hoverCard(f, color), {
        className: 'hover-card', sticky: true, direction: 'top', offset: [0, -6],
      });

      poly.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        this.select(p.id, true);
      });
      poly.on('mouseover', () => {
        if (p.id !== this.selectedId) poly.setStyle({ weight: 3, fillOpacity: 0.42 });
      });
      poly.on('mouseout', () => {
        if (p.id !== this.selectedId) poly.setStyle({ weight: 2, fillOpacity: 0.3 });
      });

      poly.addTo(this.territoryLayer);
      this.paths.set(p.id, poly);

      // Always-on label at the polygon's centre — the secondary encoding.
      const c = poly.getBounds().getCenter();
      const label = L.marker(c, {
        icon: L.divIcon({
          className: 'terr-label',
          html: `<span>${esc(p.brandShort ?? p.brandName)}</span>`,
          iconSize: [0, 0],
        }),
        interactive: false,
        keyboard: false,
      });
      label.addTo(this.labelLayer);
      this.labels.set(p.id, label);
    }

    if (this.selectedId && !this.paths.has(this.selectedId)) {
      this.selectedId = null;
      this.cb.onSelect(null);
    } else if (this.selectedId) {
      this.applySelectionStyle();
    }
  }

  private hoverCard(f: TerritoryFeature, color: string): string {
    const p = f.properties;
    const m = p.metrics;
    const pop = m.population != null ? `${compact(m.population)} pop · ` : '';
    return `
      <div class="hc-title"><span class="hc-swatch" style="background:${color}"></span>${esc(p.name)}</div>
      <div class="hc-row">${esc(p.brandName)} — ${esc(p.owner)}</div>
      <div class="hc-row">${pop}${num(m.zipCount)} ZIPs · ${Math.round(m.areaSqMi).toLocaleString()} mi²</div>
      ${m.contestedZipCount > 0
        ? `<div class="hc-row" style="color:${STATUS.critical}">⚠ ${m.contestedZipCount} contested ZIP${m.contestedZipCount === 1 ? '' : 's'} · ${m.competitorCount} overlapping operator${m.competitorCount === 1 ? '' : 's'}</div>`
        : ''}
      ${p.unverified ? '<div class="hc-row">⚑ unverified source</div>' : ''}
    `;
  }

  renderZipPoints(
    features: TerritoryFeature[],
    zipPoints: Record<string, ZipPoint>,
    market: Market,
    ctx: ColorContext,
  ): void {
    this.zipLayer.clearLayers();
    this.contestedLayer.clearLayers();

    const visible = new Set(features.map((f) => f.properties.id));
    const seen = new Set<string>();

    for (const f of features) {
      const color = colorFor(f.properties, ctx);
      for (const z of f.properties.zips) {
        const pt = zipPoints[z];
        if (!pt || seen.has(z)) continue;
        seen.add(z);
        L.circleMarker([pt.lat, pt.lng], {
          radius: 4, // >= 8px diameter
          color: 'transparent',
          weight: 2,
          fillColor: color,
          fillOpacity: 0.9,
        })
          .bindTooltip(
            `<div class="hc-title">${esc(z)}</div><div class="hc-row">${esc(pt.city)}, ${esc(pt.state)}${pt.population != null ? ` · ${compact(pt.population)} pop` : ''}</div>`,
            { className: 'hover-card', direction: 'top' },
          )
          .addTo(this.zipLayer);
      }
    }

    // Contested ZIPs use the reserved critical status color plus a ring and an
    // explicit label in the tooltip — state is never carried by hue alone.
    for (const [zip, count] of Object.entries(market.saturation)) {
      const pt = zipPoints[zip];
      if (!pt) continue;
      const claimants = pt.owners.filter((id) => visible.has(id));
      if (claimants.length < 2) continue;
      L.circleMarker([pt.lat, pt.lng], {
        radius: 5 + Math.min(count, 5),
        color: 'var(--surface-1)',
        weight: 2, // 2px surface ring on overlapping marks
        fillColor: STATUS.critical,
        fillOpacity: 0.8,
      })
        .bindTooltip(
          `<div class="hc-title">⚠ ${esc(zip)} — contested</div>
           <div class="hc-row">${esc(pt.city)}, ${esc(pt.state)}${pt.population != null ? ` · ${compact(pt.population)} pop` : ''}</div>
           <div class="hc-row">${claimants.length} operators claim this ZIP</div>`,
          { className: 'hover-card', direction: 'top' },
        )
        .addTo(this.contestedLayer);
    }
  }

  renderWhitespace(market: Market): void {
    this.whitespaceLayer.clearLayers();
    for (const w of market.whitespace) {
      L.circleMarker([w.lat, w.lng], {
        radius: 4,
        color: 'var(--surface-1)',
        weight: 2,
        fillColor: '#898781',
        fillOpacity: 0.75,
        dashArray: '2,2',
      })
        .bindTooltip(
          `<div class="hc-title">${esc(w.zip)} — no coverage</div>
           <div class="hc-row">${esc(w.city)}, ${esc(w.state)} · ${esc(w.countyName)} County</div>
           ${w.population != null ? `<div class="hc-row">${compact(w.population)} population unserved</div>` : ''}`,
          { className: 'hover-card', direction: 'top' },
        )
        .addTo(this.whitespaceLayer);
    }
  }

  select(id: string | null, notify = false): void {
    this.selectedId = id;
    this.applySelectionStyle();
    if (notify) this.cb.onSelect(id);
  }

  private applySelectionStyle(): void {
    for (const [id, path] of this.paths) {
      const on = id === this.selectedId;
      path.setStyle({
        weight: on ? 4 : 2,
        fillOpacity: on ? 0.5 : 0.3,
        opacity: this.selectedId && !on ? 0.55 : 0.95,
      });
      if (on) path.bringToFront();
    }
  }

  zoomTo(id: string): void {
    const path = this.paths.get(id);
    if (!path) return;
    this.map.fitBounds(path.getBounds(), { padding: [60, 60], maxZoom: 11 });
  }

  zoomToPoint(lat: number, lng: number, zoom = 11): void {
    this.map.setView([lat, lng], zoom);
  }

  fitAll(): void {
    const bounds = L.latLngBounds([]);
    for (const path of this.paths.values()) bounds.extend(path.getBounds());
    if (bounds.isValid()) this.map.fitBounds(bounds, { padding: [40, 40] });
  }
}
