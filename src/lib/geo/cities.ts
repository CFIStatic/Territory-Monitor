/** Lightweight US city centroids for territory mapping (lat, lng). */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "milwaukee,wi": { lat: 43.0389, lng: -87.9065 },
  "waukesha,wi": { lat: 43.0117, lng: -88.2315 },
  "racine,wi": { lat: 42.7261, lng: -87.7829 },
  "madison,wi": { lat: 43.0731, lng: -89.4012 },
  "green bay,wi": { lat: 44.5133, lng: -88.0133 },
  "brookfield,wi": { lat: 43.0606, lng: -88.1065 },
  "kenosha,wi": { lat: 42.5847, lng: -87.8212 },
  "appleton,wi": { lat: 44.2619, lng: -88.4154 },
  "eau claire,wi": { lat: 44.8113, lng: -91.4985 },
  "oshkosh,wi": { lat: 44.0247, lng: -88.5426 },
  "chicago,il": { lat: 41.8781, lng: -87.6298 },
  "evanston,il": { lat: 42.0451, lng: -87.6877 },
  "skokie,il": { lat: 42.0334, lng: -87.7334 },
  "naperville,il": { lat: 41.7508, lng: -88.1535 },
  "rockford,il": { lat: 42.2711, lng: -89.094 },
  "minneapolis,mn": { lat: 44.9778, lng: -93.265 },
  "st paul,mn": { lat: 44.9537, lng: -93.09 },
  "duluth,mn": { lat: 46.7867, lng: -92.1005 },
  "detroit,mi": { lat: 42.3314, lng: -83.0458 },
  "grand rapids,mi": { lat: 42.9634, lng: -85.6681 },
  "indianapolis,in": { lat: 39.7684, lng: -86.1581 },
  "columbus,oh": { lat: 39.9612, lng: -82.9988 },
  "cleveland,oh": { lat: 41.4993, lng: -81.6944 },
  "cincinnati,oh": { lat: 39.1031, lng: -84.512 },
  "st louis,mo": { lat: 38.627, lng: -90.1994 },
  "kansas city,mo": { lat: 39.0997, lng: -94.5786 },
  "des moines,ia": { lat: 41.5868, lng: -93.625 },
  "omaha,ne": { lat: 41.2565, lng: -95.9345 },
  "dallas,tx": { lat: 32.7767, lng: -96.797 },
  "houston,tx": { lat: 29.7604, lng: -95.3698 },
  "austin,tx": { lat: 30.2672, lng: -97.7431 },
  "atlanta,ga": { lat: 33.749, lng: -84.388 },
  "miami,fl": { lat: 25.7617, lng: -80.1918 },
  "tampa,fl": { lat: 27.9506, lng: -82.4572 },
  "orlando,fl": { lat: 28.5383, lng: -81.3792 },
  "charlotte,nc": { lat: 35.2271, lng: -80.8431 },
  "nashville,tn": { lat: 36.1627, lng: -86.7816 },
  "denver,co": { lat: 39.7392, lng: -104.9903 },
  "phoenix,az": { lat: 33.4484, lng: -112.074 },
  "los angeles,ca": { lat: 34.0522, lng: -118.2437 },
  "san diego,ca": { lat: 32.7157, lng: -117.1611 },
  "san francisco,ca": { lat: 37.7749, lng: -122.4194 },
  "seattle,wa": { lat: 47.6062, lng: -122.3321 },
  "portland,or": { lat: 45.5152, lng: -122.6784 },
  "boston,ma": { lat: 42.3601, lng: -71.0589 },
  "new york,ny": { lat: 40.7128, lng: -74.006 },
  "philadelphia,pa": { lat: 39.9526, lng: -75.1652 },
  "pittsburgh,pa": { lat: 40.4406, lng: -79.9959 },
  "baltimore,md": { lat: 39.2904, lng: -76.6122 },
  "washington,dc": { lat: 38.9072, lng: -77.0369 },
  "de pere,wi": { lat: 44.4489, lng: -88.0604 },
};

export function cityKey(city: string, state: string): string {
  return `${city.trim().toLowerCase()},${state.trim().toLowerCase()}`;
}

export function lookupCityCoords(
  city: string,
  state: string
): { lat: number; lng: number } | null {
  return CITY_COORDS[cityKey(city, state)] ?? null;
}

type LooseGeometry = {
  type: string;
  coordinates: unknown;
};

/** Rough centroid of a GeoJSON geometry (Polygon / MultiPolygon / Point). */
export function geometryCentroid(
  geometry: LooseGeometry | null | undefined
): { lat: number; lng: number } | null {
  if (!geometry) return null;
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates as number[];
    return { lng, lat };
  }

  const rings: number[][] = [];
  if (geometry.type === "Polygon") {
    const coords = geometry.coordinates as number[][][];
    rings.push(...(coords[0] || []));
  } else if (geometry.type === "MultiPolygon") {
    const coords = geometry.coordinates as number[][][][];
    for (const poly of coords) rings.push(...(poly[0] || []));
  } else if (geometry.type === "LineString") {
    rings.push(...((geometry.coordinates as number[][]) || []));
  } else {
    return null;
  }

  if (!rings.length) return null;
  let lat = 0;
  let lng = 0;
  for (const [x, y] of rings) {
    lng += x;
    lat += y;
  }
  return { lat: lat / rings.length, lng: lng / rings.length };
}

export function extractCitiesFromAreaDesc(areaDesc: string): string[] {
  // NWS areaDesc like "Milwaukee; Waukesha; Racine"
  return areaDesc
    .split(/;|,/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1 && p.length < 40)
    .slice(0, 40);
}
