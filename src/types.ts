export interface Brand {
  id: string;
  name: string;
  short: string;
  parent: string | null;
  slot: number | null;
  color: string;
  colorDark: string;
  category: string;
}

export interface TerritoryMetrics {
  zipCount: number;
  cityCount: number;
  countyCount: number;
  areaSqMi: number;
  popDensity: number | null;
  population: number | null;
  households: number | null;
  housingUnits: number | null;
  medianIncome: number | null;
  medianHomeValue: number | null;
  ownerOccupiedPct: number | null;
  coveredZips: number;
  dataCoveragePct: number | null;
  contestedZipCount: number;
  contestedPct: number;
  competitorCount: number;
}

export interface TerritoryProps {
  id: string;
  name: string;
  brandId: string;
  brandName: string;
  brandShort: string;
  brandColor: string;
  brandColorDark: string;
  owner: string;
  franchiseNumber: string | null;
  website: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  source: string;
  unverified: boolean;
  zips: string[];
  metrics: TerritoryMetrics;
  contestedZips: string[];
  competitors: string[];
  counties: { fips: string; name: string; state: string }[];
  states: string[];
}

export type TerritoryFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, TerritoryProps>;

export interface GroupRollup {
  key: string;
  label: string;
  color: string;
  territoryCount: number;
  zipCount: number;
  areaSqMi: number;
  population: number | null;
  owners: number;
}

export interface CountyRollup {
  fips: string;
  name: string;
  state: string;
  territoryCount: number;
  brands: string[];
  zipCount: number;
  coveredZips: number;
  coveragePct: number;
  population: number | null;
}

export interface WhitespaceZip {
  zip: string;
  city: string;
  state: string;
  countyFips: string;
  countyName: string;
  lat: number;
  lng: number;
  population: number | null;
}

export interface Market {
  generatedAt: string;
  demographicsLoaded: boolean;
  demographicsVintage: string | null;
  geometryMode: 'zcta' | 'centroid-hull';
  totals: {
    territories: number;
    brands: number;
    owners: number;
    zipsCovered: number;
    populationCovered: number | null;
    contestedZips: number;
    whitespaceZips: number;
    unverifiedTerritories: number;
  };
  byBrand: GroupRollup[];
  byOwner: GroupRollup[];
  byCounty: CountyRollup[];
  saturation: Record<string, number>;
  whitespace: WhitespaceZip[];
  warnings: string[];
}

export interface ZipPoint {
  lat: number;
  lng: number;
  city: string;
  state: string;
  county: string | null;
  population: number | null;
  medianIncome: number | null;
  owners: string[];
}

export type ColorMode = 'brand' | 'owner' | 'saturation';
