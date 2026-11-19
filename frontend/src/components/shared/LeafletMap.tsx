import L from 'leaflet';
import React, { useEffect, useRef } from 'react';
import { GeofenceConfig, TripHalt, VehicleGateway } from '../../types/coldchain';

export interface MapPolyline {
  coords: [number, number][];
  color?: string;
  weight?: number;
  dashArray?: string;
}

interface LeafletMapProps {
  center?: [number, number];
  zoom?: number;
  heightClass?: string;
  mapStyle?: 'dark' | 'satellite';
  vehicles?: VehicleGateway[];
  selectedGatewayId?: string;
  onSelectVehicle?: (gatewayId: string) => void;
  polyline?: MapPolyline;
  replayMarker?: { lat: number; lng: number; label: string; tempC: number } | null;
  halts?: TripHalt[];
  geofences?: GeofenceConfig[];
  fitBoundsCoords?: [number, number][];
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  center = [39.5, -96.5],
  zoom = 4,
  heightClass = 'h-72',
  mapStyle = 'dark',
  vehicles = [],
  selectedGatewayId,
  onSelectVehicle,
  polyline,
  replayMarker,
  halts = [],
  geofences = [],
  fitBoundsCoords,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const referenceLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    const overlay = L.layerGroup().addTo(map);
    mapRef.current = map;
    overlayLayerRef.current = overlay;

    // ResizeObserver prevents clipped tiles when switching tabs
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      referenceLayerRef.current = null;
      overlayLayerRef.current = null;
    };
  }, []);

  // Update tile layer when mapStyle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    if (referenceLayerRef.current) {
      map.removeLayer(referenceLayerRef.current);
      referenceLayerRef.current = null;
    }

    const url =
      mapStyle === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';

    const attribution =
      mapStyle === 'satellite'
        ? 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
        : 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ';

    const layer = L.tileLayer(url, {
      attribution,
      maxZoom: 16,
    }).addTo(map);

    tileLayerRef.current = layer;

    if (mapStyle === 'dark') {
      const refLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 16 }
      ).addTo(map);
      referenceLayerRef.current = refLayer;
    }
  }, [mapStyle]);

  // Fit bounds or recenter when target coords change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (fitBoundsCoords && fitBoundsCoords.length > 1) {
      const bounds = L.latLngBounds(fitBoundsCoords);
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 11, animate: false });
    } else if (center) {
      map.setView(center, zoom, { animate: false });
    }
  }, [center[0], center[1], zoom, JSON.stringify(fitBoundsCoords)]);

  // Render overlays (vehicles, polylines, halts, geofences, replay marker)
  useEffect(() => {
    const overlay = overlayLayerRef.current;
    if (!overlay) return;
    overlay.clearLayers();

    // Polyline route
    if (polyline && polyline.coords.length > 1) {
      L.polyline(polyline.coords, {
        color: polyline.color || '#38bdf8',
        weight: polyline.weight || 3,
        opacity: 0.9,
        dashArray: polyline.dashArray,
      }).addTo(overlay);
    }

    // Geofences
    geofences.forEach((gf) => {
      if (!gf.enabled) return;
      const strokeColor = gf.currentlyInside ? '#38bdf8' : '#f59e0b';
      if (gf.shape === 'circle' && gf.centerLat !== undefined && gf.centerLng !== undefined) {
        L.circle([gf.centerLat, gf.centerLng], {
          radius: gf.radiusMeters || 1500,
          color: strokeColor,
          fillColor: strokeColor,
          fillOpacity: 0.14,
          weight: 2,
          dashArray: '5 4',
        })
          .bindPopup(
            `<div style="font-size:12px;"><strong>${gf.name}</strong><br/>Circle (${gf.radiusMeters}m) · ${
              gf.currentlyInside ? 'Inside Zone' : 'Outside Zone'
            }</div>`
          )
          .addTo(overlay);
      } else if (gf.shape === 'polygon' && gf.polygonCoords && gf.polygonCoords.length >= 3) {
        L.polygon(gf.polygonCoords, {
          color: strokeColor,
          fillColor: strokeColor,
          fillOpacity: 0.15,
          weight: 2,
        })
          .bindPopup(`<div style="font-size:12px;"><strong>${gf.name}</strong><br/>Polygon Boundary</div>`)
          .addTo(overlay);
      } else if (gf.shape === 'corridor' && polyline && polyline.coords.length > 1) {
        L.polyline(polyline.coords, {
          color: '#22d3ee',
          weight: 16,
          opacity: 0.18,
        })
          .bindPopup(
            `<div style="font-size:12px;"><strong>${gf.name}</strong><br/>Corridor Buffer (${gf.corridorWidthMeters}m)</div>`
          )
          .addTo(overlay);
      }
    });

    // Halt pins
    halts.forEach((halt) => {
      const marker = L.circleMarker([halt.lat, halt.lng], {
        radius: 7,
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.85,
        weight: 2,
      }).addTo(overlay);
      marker.bindPopup(
        `<div style="font-size:12px;">
          <div style="font-weight:600;color:#fbbf24;">${halt.locationName}</div>
          <div>${halt.reason} · ${halt.durationMin}m</div>
          <div>Temp at halt: <strong>${halt.tempAtHaltC}°C</strong></div>
        </div>`
      );
    });

    // Vehicle markers
    vehicles.forEach((v) => {
      const isSelected = v.id === selectedGatewayId;
      const color =
        v.condition === 'Critical'
          ? '#ef4444'
          : v.condition === 'Warning'
          ? '#f59e0b'
          : v.connectivity === 'Offline'
          ? '#64748b'
          : '#10b981';

      const marker = L.circleMarker([v.lat, v.lng], {
        radius: isSelected ? 9 : 6.5,
        color: isSelected ? '#ffffff' : color,
        fillColor: color,
        fillOpacity: 0.92,
        weight: isSelected ? 2.5 : 1.5,
      }).addTo(overlay);

      marker.bindPopup(
        `<div style="font-size:12px;line-height:1.45;">
          <div style="font-weight:600;color:#f8fafc;">${v.id} · ${v.vehiclePlate}</div>
          <div style="color:#94a3b8;">${v.cargoType}</div>
          <div style="margin-top:4px;">Temp: <strong style="color:${color};">${v.currentTempC}°C</strong> · ${v.operationalState}</div>
          <div style="color:#94a3b8;">${v.locationTier.city}</div>
        </div>`
      );

      if (onSelectVehicle) {
        marker.on('click', () => onSelectVehicle(v.id));
      }
    });

    // Route replay animated marker
    if (replayMarker) {
      const rm = L.circleMarker([replayMarker.lat, replayMarker.lng], {
        radius: 9,
        color: '#ffffff',
        fillColor: '#38bdf8',
        fillOpacity: 1,
        weight: 3,
      }).addTo(overlay);
      rm.bindPopup(
        `<div style="font-size:12px;"><strong>${replayMarker.label}</strong><br/>Cargo Temp: <strong>${replayMarker.tempC}°C</strong></div>`
      );
    }
  }, [vehicles, selectedGatewayId, polyline, replayMarker, halts, geofences, onSelectVehicle]);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border border-slate-800 bg-[#0d131f] ${heightClass}`}
    >
      {/* Subtle tactical coordinate backdrop in case external tiles load slowly */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(56,189,248,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.12) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />
      <div ref={containerRef} className="relative z-10 h-full w-full" />
    </div>
  );
};
