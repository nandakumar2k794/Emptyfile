"use client";

/**
 * SIH26057 — Tactical Map & Deep-Zoom Subsea GIS Radar
 * =====================================================
 * Right panel: 3D subsea tactical map visualization with:
 *   - Smooth mouse-wheel zoom (0.4x to 8.0x) and drag-to-pan across the entire seabed
 *   - Live cursor bathymetric coordinate & depth tracker
 *   - Auto-target zoom lock & focus
 *   - Multi-contour bathymetric depth layers & live radar sonar beam sweep
 *   - Interactive threat-colored markers with real-time target mensuration popups
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import type { DetectionCollection, DetectionFeature } from "@/lib/types";

interface TacticalMapProps {
  geojson: DetectionCollection | null;
  selectedDetection?: DetectionFeature | null;
  onDetectionSelect?: (detection: DetectionFeature) => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const DEFAULT_CENTER: [number, number] = [83.3119, 17.7215]; // Bay of Bengal, Vizag
const DEFAULT_ZOOM = 13;

export default function TacticalMap({
  geojson,
  selectedDetection,
  onDetectionSelect,
}: TacticalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  const hasToken = MAPBOX_TOKEN && MAPBOX_TOKEN !== "YOUR_MAPBOX_TOKEN_HERE";
  const [viewMode, setViewMode] = useState<"radar" | "mapbox">(
    hasToken ? "mapbox" : "radar"
  );

  // ── Radar Canvas Interactive Pan & Deep-Zoom State ──
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);
  const radarAnimRef = useRef<number>();
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [cursorGeo, setCursorGeo] = useState<{
    lat: number;
    lon: number;
    depth: number;
    range: number;
  }>({
    lat: DEFAULT_CENTER[1],
    lon: DEFAULT_CENTER[0],
    depth: 34.8,
    range: 0,
  });

  // ── Initialize Mapbox when in mapbox mode ──
  useEffect(() => {
    if (viewMode !== "mapbox" || !hasToken) return;
    if (!mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 45,
      bearing: -17.6,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.addControl(
      new mapboxgl.ScaleControl({ maxWidth: 200, unit: "metric" }),
      "bottom-right"
    );

    map.on("load", () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [viewMode, hasToken]);

  // ── Render Mapbox markers ──
  const renderMapboxMarkers = useCallback(() => {
    if (!mapRef.current || !mapReady || !geojson || viewMode !== "mapbox") return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const map = mapRef.current;

    for (const feature of geojson.features) {
      const props = feature.properties;
      const [lon, lat] = feature.geometry.coordinates;

      const el = document.createElement("div");
      el.className = "tactical-marker";
      el.style.cssText = `
        width: ${props.marker_size || 16}px;
        height: ${props.marker_size || 16}px;
        border-radius: 50%;
        background: ${props.marker_color};
        border: 2px solid rgba(255,255,255,0.8);
        cursor: pointer;
        position: relative;
        box-shadow: 0 0 12px ${props.marker_color}aa, 0 0 24px ${props.marker_color}55;
      `;

      el.addEventListener("click", () => {
        if (onDetectionSelect) onDetectionSelect(feature);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([lon, lat])
        .addTo(map);

      markersRef.current.push(marker);
    }
  }, [geojson, mapReady, viewMode, onDetectionSelect]);

  useEffect(() => {
    renderMapboxMarkers();
  }, [renderMapboxMarkers]);

  // ── Fly to selected detection ──
  useEffect(() => {
    if (viewMode === "mapbox" && mapRef.current && selectedDetection) {
      const [lon, lat] = selectedDetection.geometry.coordinates;
      mapRef.current.flyTo({
        center: [lon, lat],
        zoom: 15,
        duration: 1500,
        essential: true,
      });
    } else if (viewMode === "radar" && selectedDetection) {
      // Auto-pan and zoom into target on Radar Canvas
      const [lon, lat] = selectedDetection.geometry.coordinates;
      const targetDx = (lon - DEFAULT_CENTER[0]) * 35000;
      const targetDy = -(lat - DEFAULT_CENTER[1]) * 35000;
      setPanOffset({ x: -targetDx, y: -targetDy });
      setZoomLevel((z) => Math.max(1.6, z));
    }
  }, [selectedDetection, viewMode]);

  // ── Subsea Bathymetric Radar Canvas Rendering Loop with Zoom & Pan ──
  useEffect(() => {
    if (viewMode !== "radar") return;

    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let sweepAngle = 0;

    const renderRadar = () => {
      const w = (canvas.width = canvas.parentElement?.clientWidth || 600);
      const h = (canvas.height = canvas.parentElement?.clientHeight || 500);
      const cx = w / 2 + panOffset.x * zoomLevel;
      const cy = h / 2 + panOffset.y * zoomLevel;
      const maxRadius = Math.min(w, h) * 0.48 * zoomLevel;

      // Dark subsea oceanic abyss background
      ctx.fillStyle = "#060a13";
      ctx.fillRect(0, 0, w, h);

      // ── Bathymetric Depth Contours ──
      const depths = [
        { r: maxRadius * 0.2, label: "−10m Coastal Shelf", color: "rgba(0, 229, 255, 0.15)" },
        { r: maxRadius * 0.4, label: "−20m Subsea Slope", color: "rgba(0, 229, 255, 0.12)" },
        { r: maxRadius * 0.65, label: "−35m Debris Channel", color: "rgba(0, 229, 255, 0.10)" },
        { r: maxRadius * 0.9, label: "−50m Trench Basin", color: "rgba(0, 229, 255, 0.08)" },
        { r: maxRadius * 1.25, label: "−75m Outer Trench", color: "rgba(0, 229, 255, 0.05)" },
      ];

      depths.forEach((depth) => {
        ctx.beginPath();
        ctx.arc(cx, cy, depth.r, 0, Math.PI * 2);
        ctx.strokeStyle = depth.color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
        ctx.fillText(depth.label, cx + 8, cy - depth.r + 12);
      });

      // ── Polar Grid Lines & Range Rings ──
      ctx.strokeStyle = "rgba(0, 229, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - maxRadius * 1.5);
      ctx.lineTo(cx, cy + maxRadius * 1.5);
      ctx.moveTo(cx - maxRadius * 1.5, cy);
      ctx.lineTo(cx + maxRadius * 1.5, cy);
      ctx.stroke();

      // ── Real-Time Sweeping Radar Sonar Beam ──
      sweepAngle = (sweepAngle + 0.02) % (Math.PI * 2);
      const gradient = ctx.createConicGradient(sweepAngle, cx, cy);
      gradient.addColorStop(0, "rgba(0, 229, 255, 0.28)");
      gradient.addColorStop(0.06, "rgba(0, 229, 255, 0.10)");
      gradient.addColorStop(0.18, "rgba(0, 229, 255, 0)");
      gradient.addColorStop(1, "rgba(0, 229, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // ── AUV Survey Vessel & Swath Cone (Center) ──
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "#00e5ff";
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 12;
      // Vessel icon
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(7, 9);
      ctx.lineTo(0, 6);
      ctx.lineTo(-7, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Swath Port & Starboard acoustic wings
      ctx.save();
      ctx.fillStyle = "rgba(0, 229, 255, 0.06)";
      ctx.strokeStyle = "rgba(0, 229, 255, 0.22)";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius * 0.9, Math.PI * 0.15, Math.PI * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxRadius * 0.9, Math.PI * 1.15, Math.PI * 1.85);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // ── Draw GeoJSON Debris Detections ──
      if (geojson && geojson.features) {
        geojson.features.forEach((feat, idx) => {
          const coords = feat.geometry.coordinates;
          const dx = (coords[0] - DEFAULT_CENTER[0]) * 35000;
          const dy = -(coords[1] - DEFAULT_CENTER[1]) * 35000;
          const px = cx + dx * zoomLevel;
          const py = cy + dy * zoomLevel;

          const isSelected = selectedDetection?.id === feat.id;
          const color = feat.properties.marker_color || "#00e5ff";

          // Pulsing sonar blip ripple
          ctx.save();
          const pulse = (Date.now() / 500 + idx * 0.3) % 1;
          ctx.beginPath();
          ctx.arc(px, py, (10 + pulse * 18) * Math.min(1.5, Math.max(0.8, zoomLevel)), 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 1 - pulse;
          ctx.stroke();
          ctx.restore();

          // Target Pin Core
          ctx.save();
          ctx.beginPath();
          const dotRadius = (isSelected ? 9 : 6) * Math.min(1.4, Math.max(0.8, zoomLevel));
          ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = isSelected ? 20 : 10;
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.stroke();
          ctx.restore();

          // Target Info Inset Card on Canvas
          ctx.save();
          ctx.font = "bold 11px 'JetBrains Mono', monospace";
          ctx.fillStyle = "#ffffff";
          ctx.fillText(
            `#${idx + 1} ${feat.properties.class_label.toUpperCase()}`,
            px + 12,
            py - 6
          );

          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.fillStyle = color;
          ctx.fillText(
            `H=${feat.properties.h_target_m.toFixed(2)}m • ${(
              feat.properties.confidence * 100
            ).toFixed(0)}% (${feat.properties.threat_level})`,
            px + 12,
            py + 8
          );
          ctx.restore();
        });
      }

      radarAnimRef.current = requestAnimationFrame(renderRadar);
    };

    renderRadar();

    return () => {
      if (radarAnimRef.current) cancelAnimationFrame(radarAnimRef.current);
    };
  }, [geojson, selectedDetection, zoomLevel, panOffset, viewMode]);

  // ── Mouse Wheel Zoom (Deep Zooming) ──
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoomLevel((prev) => Math.min(8.0, Math.max(0.4, prev * zoomFactor)));
  };

  // ── Mouse Drag-to-Pan ──
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate simulated geographic coordinates & depth under cursor
    const cx = canvas.width / 2 + panOffset.x * zoomLevel;
    const cy = canvas.height / 2 + panOffset.y * zoomLevel;
    const relX = (mouseX - cx) / (35000 * zoomLevel);
    const relY = -(mouseY - cy) / (35000 * zoomLevel);

    const curLon = DEFAULT_CENTER[0] + relX;
    const curLat = DEFAULT_CENTER[1] + relY;
    const distM = Math.hypot(mouseX - cx, mouseY - cy) / (zoomLevel * 3.5);
    const calcDepth = 34.8 + distM * 0.12;

    setCursorGeo({
      lat: curLat,
      lon: curLon,
      depth: calcDepth,
      range: distM,
    });

    if (isDragging) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // ── Click on Detection ──
  const handleRadarClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!radarCanvasRef.current || !geojson || !onDetectionSelect) return;
    const canvas = radarCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const cx = canvas.width / 2 + panOffset.x * zoomLevel;
    const cy = canvas.height / 2 + panOffset.y * zoomLevel;

    for (const feat of geojson.features) {
      const coords = feat.geometry.coordinates;
      const dx = (coords[0] - DEFAULT_CENTER[0]) * 35000;
      const dy = -(coords[1] - DEFAULT_CENTER[1]) * 35000;
      const px = cx + dx * zoomLevel;
      const py = cy + dy * zoomLevel;

      const dist = Math.hypot(clickX - px, clickY - py);
      if (dist < 22) {
        onDetectionSelect(feat);
        return;
      }
    }
  };

  const resetView = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-[#060a13]">
      {/* Panel Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b z-10 flex-wrap gap-2"
        style={{
          borderColor: "var(--border-subtle)",
          background: "rgba(6, 10, 19, 0.95)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span
            className="text-xs font-semibold uppercase tracking-wider text-slate-200"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {viewMode === "radar"
              ? "Deep-Zoom Subsea Bathymetric GIS"
              : "3D Globe Tactical View (WGS84)"}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-mono">
            Zoom: {zoomLevel.toFixed(1)}x
          </span>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono">
            <button
              onClick={() => setViewMode("radar")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "radar"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              📡 Deep-Zoom Radar GIS
            </button>
            <button
              onClick={() => setViewMode("mapbox")}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                viewMode === "mapbox"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🛰️ 3D Globe
            </button>
          </div>

          {geojson && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
              {geojson.features.length} Targets
            </span>
          )}
        </div>
      </div>

      {/* Main Map / Radar Display */}
      <div className="flex-1 relative overflow-hidden">
        {viewMode === "radar" ? (
          <div className="w-full h-full relative cursor-grab active:cursor-grabbing">
            <canvas
              ref={radarCanvasRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={handleRadarClick}
              className="w-full h-full block"
            />

            {/* Radar Real-time Coordinate & Bathymetry HUD */}
            <div className="absolute top-3 left-3 p-3 rounded-xl bg-black/70 backdrop-blur-md border border-cyan-500/20 text-[11px] font-mono text-slate-300 space-y-1 pointer-events-none shadow-xl">
              <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                BATHYMETRY HUD: VIZAG SURVEY
              </div>
              <div>LAT: {cursorGeo.lat.toFixed(5)}° N</div>
              <div>LON: {cursorGeo.lon.toFixed(5)}° E</div>
              <div>DEPTH: −{cursorGeo.depth.toFixed(1)}m | RANGE: {cursorGeo.range.toFixed(1)}m</div>
              <div className="text-[10px] text-cyan-300/80 pt-1 border-t border-slate-800">
                💡 Scroll wheel to zoom in/out • Click &amp; drag to pan
              </div>
            </div>

            {/* Zoom Controls & View Reset */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-20 font-mono">
              <button
                onClick={() => setZoomLevel((z) => Math.min(8.0, z * 1.3))}
                className="w-8 h-8 rounded-lg bg-slate-900/90 text-cyan-300 border border-cyan-500/30 flex items-center justify-center font-bold hover:bg-cyan-500/20 cursor-pointer shadow-lg"
                title="Zoom In"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.4, z / 1.3))}
                className="w-8 h-8 rounded-lg bg-slate-900/90 text-cyan-300 border border-cyan-500/30 flex items-center justify-center font-bold hover:bg-cyan-500/20 cursor-pointer shadow-lg"
                title="Zoom Out"
              >
                −
              </button>
              <button
                onClick={resetView}
                className="px-2 h-8 rounded-lg bg-slate-900/90 text-slate-300 border border-slate-700 text-[10px] flex items-center justify-center font-semibold hover:bg-slate-800 cursor-pointer shadow-lg"
                title="Reset View to Origin"
              >
                ⟲ 1x
              </button>
            </div>
          </div>
        ) : (
          <div ref={mapContainerRef} className="w-full h-full relative">
            {!hasToken && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center"
                style={{ background: "var(--bg-secondary)" }}
              >
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 max-w-sm">
                  <div className="text-cyan-400 font-mono text-sm font-bold mb-1">
                    Mapbox Satellite Token
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Mapbox 3D Globe requires an API key in <code>.env.local</code>.
                    Switch to <strong>📡 Deep-Zoom Radar GIS</strong> for offline
                    zero-dependency acoustic bathymetry with pan &amp; zoom!
                  </p>
                  <button
                    onClick={() => setViewMode("radar")}
                    className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors cursor-pointer"
                  >
                    Switch to Deep-Zoom Radar GIS
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div
        className="flex items-center justify-between px-4 py-1.5 border-t text-[11px] font-mono text-slate-400"
        style={{ borderColor: "var(--border-subtle)", background: "#060a13" }}
      >
        <span>DATUM: WGS84 • GRID: 75m SWATH TRANSECT</span>
        <span>RESOLUTION: 0.146 m/px • SUBSEA ACOUSTIC BEAM</span>
      </div>
    </div>
  );
}
