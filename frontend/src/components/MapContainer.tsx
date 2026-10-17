import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CATEGORY_INFO, DEFAULT_META } from '../config';
import type { CategoryId, Point, Report, Route } from '../types';

interface MapContainerProps {
  reports: Report[];
  userLocation: Point | null;
  activeRoute: Route | null;
  simulationPosition: Point | null;
  selectedReport: Report | null;
  onSelectReport: (report: Report | null) => void;
  pendingReportCoords: Point | null;
  onMapClickForReport?: (coords: Point) => void;
  isPickingLocation?: boolean;
}

export const MapContainer: React.FC<MapContainerProps> = ({
  reports,
  userLocation,
  activeRoute,
  simulationPosition,
  selectedReport,
  onSelectReport,
  pendingReportCoords,
  onMapClickForReport,
  isPickingLocation,
}) => {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const pendingMarkerRef = useRef<L.Marker | null>(null);

  // The Leaflet click listener is attached once, so read the latest handler through a ref.
  // Otherwise it keeps the first render's handler, which ignores clicks (not picking yet).
  const onMapClickRef = useRef(onMapClickForReport);
  useEffect(() => {
    onMapClickRef.current = onMapClickForReport;
  }, [onMapClickForReport]);

  // Initialize Map
  useEffect(() => {
    if (!mapElementRef.current || mapInstanceRef.current) return;

    const center = DEFAULT_META.demo_area.center;
    const map = L.map(mapElementRef.current, {
      center: [center[0], center[1]],
      zoom: 16,
      zoomControl: false,
    });

    // Add high quality tile layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Add zoom controls at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    // Map click handler
    map.on('click', (e: L.LeafletMouseEvent) => {
      onMapClickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      // map.remove() also drops these markers; forget them so the next map recreates them
      // (otherwise React StrictMode / remounts leave us moving markers on a dead map).
      userMarkerRef.current = null;
      pendingMarkerRef.current = null;
    };
  }, []);

  // Update Hazard Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    reports.forEach((report) => {
      const catInfo = CATEGORY_INFO[report.category] || CATEGORY_INFO.other;
      const isSelected = selectedReport?.id === report.id;

      // Custom SVG Pin Marker
      const iconHtml = `
        <div class="custom-hazard-pin ${isSelected ? 'selected' : ''} ${report.is_stale ? 'stale' : ''}" style="--pin-color: ${catInfo.color}">
          <div class="pin-bubble">
            <span class="pin-symbol">${getCategoryInitial(report.category)}</span>
            ${report.is_stale ? '<span class="stale-dot" title="Older than 5 days">!</span>' : ''}
          </div>
          <div class="pin-arrow"></div>
          <div class="pin-pulse"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: iconHtml,
        iconSize: [36, 42],
        iconAnchor: [18, 40],
      });

      const marker = L.marker([report.lat, report.lng], { icon: customIcon });
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectReport(report);
      });

      markersLayerRef.current?.addLayer(marker);
    });
  }, [reports, selectedReport, onSelectReport]);

  // Update Route Polyline and Steps
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;

    routeLayerRef.current.clearLayers();

    if (activeRoute) {
      // Coords are [lng, lat] in GeoJSON; convert to [lat, lng] for Leaflet
      const latLngs: [number, number][] = activeRoute.geometry.coordinates.map((c) => [c[1], c[0]]);

      // Outer glow line
      const glowLine = L.polyline(latLngs, {
        color: '#6366f1',
        weight: 8,
        opacity: 0.4,
        lineCap: 'round',
      });

      // Core route line
      const coreLine = L.polyline(latLngs, {
        color: '#4f46e5',
        weight: 4,
        opacity: 0.95,
        dashArray: '1, 8',
        lineCap: 'round',
      });

      routeLayerRef.current.addLayer(glowLine);
      routeLayerRef.current.addLayer(coreLine);

      // Add Start Marker
      const startCoord = latLngs[0];
      const startIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="route-endpoint-pin start"><div class="endpoint-circle">A</div></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      routeLayerRef.current.addLayer(L.marker(startCoord, { icon: startIcon }));

      // Add End Marker
      const endCoord = latLngs[latLngs.length - 1];
      const endIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `<div class="route-endpoint-pin finish"><div class="endpoint-circle">🏁</div></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      routeLayerRef.current.addLayer(L.marker(endCoord, { icon: endIcon }));

      // Add Turn Step Cues
      activeRoute.steps.forEach((step) => {
        if (step.cue !== 'arrived') {
          const stepIcon = L.divIcon({
            className: 'custom-leaflet-marker',
            html: `<div class="route-turn-badge cue-${step.cue}">${getCueArrow(step.cue)}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          });
          const stepMarker = L.marker([step.location.lat, step.location.lng], { icon: stepIcon });
          stepMarker.bindTooltip(step.instruction, { direction: 'top', offset: [0, -10] });
          routeLayerRef.current?.addLayer(stepMarker);
        }
      });
    }
  }, [activeRoute]);

  // Update Walker / Simulation Position Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentPos = simulationPosition || userLocation;
    if (!currentPos) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    const posLatLng: [number, number] = [currentPos.lat, currentPos.lng];

    if (!userMarkerRef.current) {
      const walkerIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="user-walker-marker">
            <div class="radar-halo"></div>
            <div class="walker-dot"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      userMarkerRef.current = L.marker(posLatLng, { icon: walkerIcon, zIndexOffset: 1000 }).addTo(
        mapInstanceRef.current
      );
    } else {
      userMarkerRef.current.setLatLng(posLatLng);
    }
  }, [userLocation, simulationPosition]);

  // Update Pending Report Drag/Click Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (pendingReportCoords) {
      const icon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="pending-placement-pin">
            <div class="placement-bubble">📍</div>
            <div class="placement-arrow"></div>
          </div>
        `,
        iconSize: [36, 42],
        iconAnchor: [18, 40],
      });

      if (!pendingMarkerRef.current) {
        pendingMarkerRef.current = L.marker([pendingReportCoords.lat, pendingReportCoords.lng], {
          icon,
          zIndexOffset: 1500,
        }).addTo(mapInstanceRef.current);
      } else {
        pendingMarkerRef.current.setLatLng([pendingReportCoords.lat, pendingReportCoords.lng]);
      }
    } else if (pendingMarkerRef.current) {
      pendingMarkerRef.current.remove();
      pendingMarkerRef.current = null;
    }
  }, [pendingReportCoords]);

  return (
    <div className={`map-wrapper ${isPickingLocation ? 'picking-location-active' : ''}`}>
      <div ref={mapElementRef} className="leaflet-map-element" id="stepsafe-leaflet-map" />

      {isPickingLocation && (
        <div className="location-picker-banner">
          <span>Tap on the map or drag to set the exact hazard barrier spot</span>
        </div>
      )}
    </div>
  );
};

function getCategoryInitial(cat: CategoryId): string {
  switch (cat) {
    case 'blocked_sidewalk':
      return '🚫';
    case 'pothole':
      return '🕳️';
    case 'uneven_surface':
      return '⚠️';
    case 'standing_water':
      return '💧';
    case 'construction_closure':
      return '🚧';
    case 'missing_curb_ramp':
      return '♿';
    case 'other':
    default:
      return '📍';
  }
}

function getCueArrow(cue: string): string {
  switch (cue) {
    case 'left':
      return '↰';
    case 'right':
      return '↱';
    case 'caution':
      return '!';
    default:
      return '•';
  }
}
