import { useEffect, useRef, useCallback, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import maplibregl from 'maplibre-gl';
import { fetchTrafficFlowGeoJSON } from '../services/trafficFlowApi';
import { TRAFFIC_FLOW_COLORS } from '../types';
import type { MapLibreMap, Popup, TrafficFlowStatus } from '../types';

// =============================================================================
// Constants
// =============================================================================

const TRAFFIC_LAYER_ID = 'traffic-flow-lines';
const TRAFFIC_GLOW_LAYER_ID = 'traffic-flow-glow';
const TRAFFIC_SOURCE_ID = 'traffic-flow-source';
const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes

// =============================================================================
// Types
// =============================================================================

interface TrafficFlowLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  isDark: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getStatusColor(status: TrafficFlowStatus): string {
  return TRAFFIC_FLOW_COLORS[status]?.line ?? TRAFFIC_FLOW_COLORS.unknown.line;
}

function formatSpeed(speed: number | null): string {
  if (speed === null) return 'No data';
  return `${Math.round(speed)} mph`;
}

function formatTimestamp(timestamp: string): string {
  if (!timestamp) return 'Unknown';

  // Parse NE 511 timestamp format: "2026:01:22:20:13:09"
  const parts = timestamp.split(':');
  if (parts.length >= 5) {
    const [year, month, day, hour, minute] = parts;
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10)
    );
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  return timestamp;
}

// =============================================================================
// Component
// =============================================================================

function TrafficFlowLayer({ map, visible, isDark }: TrafficFlowLayerProps) {
  const popupRef = useRef<Popup | null>(null);

  // Fetch traffic flow data
  const { data: trafficData } = useQuery({
    queryKey: ['traffic-flow'],
    queryFn: fetchTrafficFlowGeoJSON,
    staleTime: REFRESH_INTERVAL,
    refetchInterval: REFRESH_INTERVAL,
    enabled: visible && !!map,
  });

  // Create popup HTML
  const createPopupContent = useCallback(
    (properties: Record<string, unknown>): string => {
      const roadName = String(properties.roadName ?? 'Unknown Road');
      const status = String(properties.status ?? 'unknown') as TrafficFlowStatus;
      const currentSpeed = properties.currentSpeed as number | null;
      const speedLimit = properties.speedLimit as number;
      const timestamp = String(properties.timestamp ?? '');

      const statusColor = getStatusColor(status);
      const statusName = TRAFFIC_FLOW_COLORS[status]?.name ?? 'Unknown';
      const bgColor = isDark ? '#1a1a1a' : '#ffffff';
      const textColor = isDark ? '#e5e5e5' : '#1f2937';
      const mutedColor = isDark ? '#9ca3af' : '#6b7280';

      return `
        <div style="
          font-family: 'Public Sans', -apple-system, sans-serif;
          padding: 12px;
          min-width: 180px;
          background: ${bgColor};
          color: ${textColor};
        ">
          <div style="
            font-weight: 600;
            font-size: 14px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
          ">
            <span style="
              width: 10px;
              height: 10px;
              border-radius: 50%;
              background: ${statusColor};
              display: inline-block;
            "></span>
            ${roadName}
          </div>
          <div style="
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 4px 12px;
            font-size: 13px;
          ">
            <span style="color: ${mutedColor};">Status:</span>
            <span style="color: ${statusColor}; font-weight: 500;">${statusName}</span>
            <span style="color: ${mutedColor};">Speed:</span>
            <span>${formatSpeed(currentSpeed)}</span>
            <span style="color: ${mutedColor};">Limit:</span>
            <span>${speedLimit} mph</span>
            <span style="color: ${mutedColor};">Updated:</span>
            <span>${formatTimestamp(timestamp)}</span>
          </div>
        </div>
      `;
    },
    [isDark]
  );

  // Initialize map layers
  useEffect(() => {
    if (!map) return;

    // Add source if it doesn't exist
    if (!map.getSource(TRAFFIC_SOURCE_ID)) {
      map.addSource(TRAFFIC_SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });
    }

    // Add glow layer (wider, semi-transparent)
    if (!map.getLayer(TRAFFIC_GLOW_LAYER_ID)) {
      map.addLayer({
        id: TRAFFIC_GLOW_LAYER_ID,
        type: 'line',
        source: TRAFFIC_SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          visibility: visible ? 'visible' : 'none',
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'status'],
            'free', TRAFFIC_FLOW_COLORS.free.glow,
            'moderate', TRAFFIC_FLOW_COLORS.moderate.glow,
            'slow', TRAFFIC_FLOW_COLORS.slow.glow,
            'congested', TRAFFIC_FLOW_COLORS.congested.glow,
            TRAFFIC_FLOW_COLORS.unknown.glow,
          ],
          'line-width': 8,
          'line-opacity': 0.4,
          'line-blur': 3,
        },
      });
    }

    // Add main line layer
    if (!map.getLayer(TRAFFIC_LAYER_ID)) {
      map.addLayer({
        id: TRAFFIC_LAYER_ID,
        type: 'line',
        source: TRAFFIC_SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          visibility: visible ? 'visible' : 'none',
        },
        paint: {
          'line-color': [
            'match',
            ['get', 'status'],
            'free', TRAFFIC_FLOW_COLORS.free.line,
            'moderate', TRAFFIC_FLOW_COLORS.moderate.line,
            'slow', TRAFFIC_FLOW_COLORS.slow.line,
            'congested', TRAFFIC_FLOW_COLORS.congested.line,
            TRAFFIC_FLOW_COLORS.unknown.line,
          ],
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });
    }

    // Add click handler for popups
    const handleClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ): void => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      const properties = feature.properties;
      if (!properties) return;

      // Close existing popup
      if (popupRef.current) {
        popupRef.current.remove();
      }

      // Create new popup
      popupRef.current = new maplibregl.Popup({
        closeButton: true,
        closeOnClick: true,
        maxWidth: '300px',
        className: isDark ? 'traffic-popup-dark' : 'traffic-popup-light',
      })
        .setLngLat(e.lngLat)
        .setHTML(createPopupContent(properties))
        .addTo(map);
    };

    // Add hover effect
    const handleMouseEnter = (): void => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const handleMouseLeave = (): void => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', TRAFFIC_LAYER_ID, handleClick);
    map.on('mouseenter', TRAFFIC_LAYER_ID, handleMouseEnter);
    map.on('mouseleave', TRAFFIC_LAYER_ID, handleMouseLeave);

    return () => {
      map.off('click', TRAFFIC_LAYER_ID, handleClick);
      map.off('mouseenter', TRAFFIC_LAYER_ID, handleMouseEnter);
      map.off('mouseleave', TRAFFIC_LAYER_ID, handleMouseLeave);

      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    };
  }, [map, visible, isDark, createPopupContent]);

  // Update layer visibility
  useEffect(() => {
    if (!map) return;

    const visibility = visible ? 'visible' : 'none';

    if (map.getLayer(TRAFFIC_LAYER_ID)) {
      map.setLayoutProperty(TRAFFIC_LAYER_ID, 'visibility', visibility);
    }
    if (map.getLayer(TRAFFIC_GLOW_LAYER_ID)) {
      map.setLayoutProperty(TRAFFIC_GLOW_LAYER_ID, 'visibility', visibility);
    }

    // Close popup when hiding layer
    if (!visible && popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
  }, [map, visible]);

  // Update data when it changes
  useEffect(() => {
    if (!map || !trafficData) return;

    const source = map.getSource(TRAFFIC_SOURCE_ID);
    if (source && 'setData' in source) {
      source.setData(trafficData);
    }
  }, [map, trafficData]);

  // This component doesn't render any DOM elements
  // It only manages map layers
  return null;
}

export default memo(TrafficFlowLayer);
