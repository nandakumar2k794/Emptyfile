"use client";

/**
 * SIH26057 — Detection Detail Card
 * ==================================
 * Displays full metadata for a selected debris detection:
 *   - Classification with threat badge
 *   - Physical dimensions (W × L × H)
 *   - Calculated H_target with formula provenance
 *   - WGS84 coordinates
 *   - Acoustic parameters (R_slant, channel)
 *   - Confidence score with visual bar
 */

import React from "react";
import type { DetectionFeature } from "@/lib/types";

interface DetectionCardProps {
  detection: DetectionFeature;
  onClose?: () => void;
}

export default function DetectionCard({ detection, onClose }: DetectionCardProps) {
  const props = detection.properties;
  const [lon, lat] = detection.geometry.coordinates;

  const threatClass = `threat-${props.threat_level.toLowerCase()}`;

  return (
    <div className="glass-panel-accent p-4 fade-in" style={{ maxWidth: 320 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: props.marker_color,
              boxShadow: `0 0 8px ${props.marker_color}`,
            }}
          />
          <span
            className="text-sm font-bold uppercase tracking-wide"
            style={{ color: "var(--text-primary)" }}
          >
            {props.class_label.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`status-badge ${threatClass}`}
            style={{ fontSize: "0.6rem" }}
          >
            {props.threat_level}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="text-sm hover:opacity-70 transition-opacity"
              style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-xs"
            style={{
              color: "var(--text-muted)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Confidence
          </span>
          <span
            className="text-xs font-bold"
            style={{
              color: "var(--accent-primary)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {(props.confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--bg-primary)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${props.confidence * 100}%`,
              background: `linear-gradient(90deg, var(--accent-secondary), var(--accent-primary))`,
              boxShadow: "0 0 8px var(--accent-glow)",
            }}
          />
        </div>
      </div>

      {/* Data Grid */}
      <div
        className="space-y-2"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {/* Target Height — PRIMARY MEASUREMENT */}
        <div
          className="p-2.5 rounded-lg"
          style={{
            background: "rgba(255, 215, 0, 0.08)",
            border: "1px solid rgba(255, 215, 0, 0.2)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "#ffd700" }}>
              H_target (calculated)
            </span>
            <span
              className="text-base font-bold"
              style={{ color: "#ffd700" }}
            >
              {props.h_target_m.toFixed(3)} m
            </span>
          </div>
          <div
            className="text-xs mt-1"
            style={{ color: "var(--text-muted)", fontSize: "0.6rem" }}
          >
            {props.mensuration.formula}
          </div>
        </div>

        {/* Dimensions */}
        <DataRow
          label="Dimensions"
          value={`${props.dimensions.width_m} × ${props.dimensions.length_m} × ${props.dimensions.height_m} m`}
        />

        {/* Acoustic Parameters */}
        <DataRow
          label="R_slant"
          value={`${props.slant_range_m.toFixed(1)} m`}
        />
        <DataRow label="Channel" value={props.channel.toUpperCase()} />
        <DataRow label="Depth" value={`${props.depth_m} m`} />

        {/* Coordinates */}
        <DataRow
          label="Latitude"
          value={`${lat.toFixed(6)}° N`}
        />
        <DataRow
          label="Longitude"
          value={`${lon.toFixed(6)}° E`}
        />

        {/* Mensuration Parameters */}
        <div
          className="pt-2 mt-2"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <span
            className="text-xs font-semibold uppercase mb-1 block"
            style={{ color: "var(--text-muted)", fontSize: "0.6rem", letterSpacing: "0.1em" }}
          >
            Mensuration Parameters
          </span>
          <DataRow
            label="L_shadow"
            value={`${props.mensuration.parameters.L_shadow_m.toFixed(3)} m (${props.mensuration.parameters.L_shadow_px} px)`}
          />
          <DataRow
            label="H_towfish"
            value={`${props.mensuration.parameters.H_towfish_m} m`}
          />
          <DataRow
            label="R_slant"
            value={`${props.mensuration.parameters.R_slant_m.toFixed(1)} m`}
          />
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      <span
        className="text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {value}
      </span>
    </div>
  );
}
