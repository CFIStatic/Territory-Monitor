"use client";

import { Fragment, useEffect, useMemo } from "react";
import {
  CircleMarker,
  Circle,
  GeoJSON,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

export type TerritoryPoint = {
  key: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  contactCount: number;
  sampleNames: string[];
};

export type StormFeature = {
  id: string;
  name: string;
  type: string;
  severity: string;
  status: string;
  source: string;
  latitude: number | null;
  longitude: number | null;
  radiusMiles: number;
  affectedCities: string[];
  matchedContacts: number;
  geometry: unknown | null;
};

function FitBounds({
  territories,
  storms,
}: {
  territories: TerritoryPoint[];
  storms: StormFeature[];
}) {
  const map = useMap();
  useEffect(() => {
    // Prefer contact territory bounds so Alaska/national noise doesn't zoom the map out
    const territoryPoints = territories.map(
      (t) => [t.lat, t.lng] as [number, number]
    );
    const stormPointsNearTerritory = storms
      .filter((s) => s.latitude != null && s.longitude != null)
      .filter((s) => {
        if (!territoryPoints.length) return true;
        return territoryPoints.some(([lat, lng]) => {
          const dLat = Math.abs((s.latitude as number) - lat);
          const dLng = Math.abs((s.longitude as number) - lng);
          return dLat < 4 && dLng < 6;
        });
      })
      .map((s) => [s.latitude as number, s.longitude as number] as [number, number]);

    const points =
      territoryPoints.length > 0
        ? [...territoryPoints, ...stormPointsNearTerritory]
        : stormPointsNearTerritory;

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 8);
      return;
    }
    map.fitBounds(points, { padding: [40, 40], maxZoom: 9 });
  }, [map, territories, storms]);
  return null;
}

function severityColor(severity: string): string {
  if (severity === "extreme") return "#b42318";
  if (severity === "warning") return "#c9851a";
  if (severity === "watch") return "#0f8a7a";
  return "#5b6b7c";
}

export function TerritoryMap({
  center,
  territories,
  storms,
  selectedCities,
  selectedStormId,
  onSelectTerritory,
  onSelectStorm,
}: {
  center: { lat: number; lng: number };
  territories: TerritoryPoint[];
  storms: StormFeature[];
  selectedCities: string[];
  selectedStormId: string | null;
  onSelectTerritory: (t: TerritoryPoint) => void;
  onSelectStorm: (s: StormFeature) => void;
}) {
  const selectedSet = useMemo(
    () => new Set(selectedCities.map((c) => c.toLowerCase())),
    [selectedCities]
  );

  return (
    <MapContainer
      center={[center.lat, center.lng] as LatLngExpression}
      zoom={7}
      className="h-full w-full rounded-2xl"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds territories={territories} storms={storms} />

      {storms.map((storm) => {
        const color = severityColor(storm.severity);
        const selected = selectedStormId === storm.id;
        return (
          <Fragment key={storm.id}>
            {storm.geometry ? (
              <GeoJSON
                data={storm.geometry as never}
                style={() => ({
                  color,
                  weight: selected ? 3 : 2,
                  fillColor: color,
                  fillOpacity: selected ? 0.35 : 0.18,
                })}
                eventHandlers={{
                  click: () => onSelectStorm(storm),
                }}
              />
            ) : null}
            {storm.latitude != null && storm.longitude != null ? (
              <Circle
                center={[storm.latitude, storm.longitude]}
                radius={(storm.radiusMiles || 40) * 1609.34}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: selected ? 0.25 : 0.12,
                  weight: selected ? 3 : 1.5,
                }}
                eventHandlers={{ click: () => onSelectStorm(storm) }}
              >
                <Popup>
                  <strong>{storm.name}</strong>
                  <br />
                  {storm.severity} · {storm.matchedContacts} contacts in path
                  <br />
                  source: {storm.source}
                </Popup>
              </Circle>
            ) : null}
          </Fragment>
        );
      })}

      {territories.map((t) => {
        const selected = selectedSet.has(t.city.toLowerCase());
        const radius = Math.min(18, 6 + Math.sqrt(t.contactCount) * 2);
        return (
          <CircleMarker
            key={t.key}
            center={[t.lat, t.lng]}
            radius={radius}
            pathOptions={{
              color: selected ? "#0a6b5f" : "#0b1c2c",
              fillColor: selected ? "#0f8a7a" : "#163247",
              fillOpacity: 0.85,
              weight: selected ? 3 : 1,
            }}
            eventHandlers={{ click: () => onSelectTerritory(t) }}
          >
            <Popup>
              <strong>
                {t.city}, {t.state}
              </strong>
              <br />
              {t.contactCount.toLocaleString()} contacts
              <br />
              {t.sampleNames.join(", ")}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
