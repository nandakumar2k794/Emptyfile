"use client";

/**
 * SIH26057 — Main Tactical Dashboard Page
 * ========================================
 * High-performance tactical layout for marine debris hydrographic inspection:
 *   LEFT:  600kHz Side-Scan Sonar Acoustic Waterfall Feed with dual bboxes
 *   RIGHT: Subsea Bathymetric Radar GIS & 3D Globe Tactical View
 *
 * Full Judge Interactive Flow:
 *   1. Switch Mission Scenarios (Shipping Channel, Coral Sanctuary, UXO Defense, Wreck Mensuration)
 *   2. Inspect Acoustic Pipeline Stages (Raw -> Adaptive Lee -> Slant-to-Ground -> YOLOv8)
 *   3. Autonomous AUV Live Survey Scanning with Sonar Audio Feedback
 *   4. Mathematical Acoustic Shadow Trigonometry Formula Inspector
 *   5. Export Official Clearance Dossier PDF Report
 */

import React, { useState, useCallback, useEffect } from "react";

import ControlPanel from "@/components/ControlPanel";
import SonarWaterfall from "@/components/SonarWaterfall";
import TacticalMap from "@/components/TacticalMap";
import DetectionCard from "@/components/DetectionCard";
import PhysicsModal from "@/components/PhysicsModal";
import { generateClearanceDossier } from "@/components/DossierGenerator";

import { uploadSonarData, generateReport, getDetections } from "@/lib/api";
import type {
  DetectionCollection,
  DetectionFeature,
  PipelineStatus,
} from "@/lib/types";

export default function DashboardPage() {
  // ── State ──
  const [status, setStatus] = useState<PipelineStatus>("idle");
  const [geojson, setGeojson] = useState<DetectionCollection | null>(null);
  const [selectedDetection, setSelectedDetection] =
    useState<DetectionFeature | null>(null);
  const [pipelineStage, setPipelineStage] = useState<
    "raw" | "filtered" | "corrected" | "annotated"
  >("annotated");
  const [selectedScenario, setSelectedScenario] = useState("shipping_channel");
  const [isPhysicsModalOpen, setIsPhysicsModalOpen] = useState(false);
  const [isLiveScanning, setIsLiveScanning] = useState(false);

  // ── Initialize on Mount ──
  useEffect(() => {
    async function init() {
      try {
        const initialData = await getDetections(selectedScenario);
        setGeojson(initialData);
        setStatus("complete");
      } catch (err) {
        console.error("Init failed:", err);
      }
    }
    init();
  }, [selectedScenario]);

  // ── Scenario Change Handler ──
  const handleScenarioChange = useCallback(async (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    setStatus("processing");
    setSelectedDetection(null);
    try {
      const data = await uploadSonarData(null, scenarioId);
      setGeojson(data);
      setStatus("complete");
    } catch {
      setStatus("error");
    }
  }, []);

  // ── Upload Handler ──
  const handleUpload = useCallback(
    async (file?: File | null) => {
      try {
        setStatus("uploading");
        setSelectedDetection(null);
        const result = await uploadSonarData(file, selectedScenario);
        setGeojson(result);
        setStatus("complete");
      } catch (error) {
        console.error("Upload failed:", error);
        setStatus("error");
      }
    },
    [selectedScenario]
  );

  // ── Analyze Handler ──
  const handleAnalyze = useCallback(async () => {
    try {
      setStatus("processing");
      setSelectedDetection(null);
      const result = await uploadSonarData(null, selectedScenario);
      setGeojson(result);
      setStatus("complete");
    } catch (error) {
      console.error("Analysis failed:", error);
      setStatus("error");
    }
  }, [selectedScenario]);

  // ── Dossier PDF Generation ──
  const handleGenerateDossier = useCallback(async () => {
    try {
      const reportData = await generateReport(geojson);
      generateClearanceDossier(reportData);
    } catch (error) {
      console.error("Dossier generation failed:", error);
    }
  }, [geojson]);

  // ── Detection Selection Handler ──
  const handleDetectionSelect = useCallback(
    (detection: DetectionFeature) => {
      setSelectedDetection((prev) =>
        prev?.id === detection.id ? null : detection
      );
    },
    []
  );

  // ── Live AUV Scanning Simulation Loop ──
  useEffect(() => {
    if (!isLiveScanning || !geojson || geojson.features.length === 0) return;

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % geojson.features.length;
      setSelectedDetection(geojson.features[currentIndex]);
    }, 4000);

    return () => clearInterval(interval);
  }, [isLiveScanning, geojson]);

  const detections = geojson?.features || [];

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0a0e1a]">
      {/* ── Top: Command & Control Panel ── */}
      <ControlPanel
        status={status}
        detectionCount={detections.length}
        selectedScenario={selectedScenario}
        onScenarioChange={handleScenarioChange}
        onUpload={handleUpload}
        onAnalyze={handleAnalyze}
        onGenerateDossier={handleGenerateDossier}
        onOpenPhysicsModal={() => setIsPhysicsModalOpen(true)}
        isLiveScanning={isLiveScanning}
        onToggleLiveScan={() => setIsLiveScanning(!isLiveScanning)}
      />

      {/* ── Main: Split-Screen Layout ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Left Panel: Sonar Acoustic Waterfall Feed ── */}
        <div
          className="flex flex-col"
          style={{
            width: "50%",
            borderRight: "1px solid var(--border-subtle)",
          }}
        >
          <SonarWaterfall
            detections={detections}
            pipelineStage={pipelineStage}
            scenarioId={selectedScenario}
            onStageChange={setPipelineStage}
            onDetectionClick={handleDetectionSelect}
            isProcessing={
              status === "processing" ||
              status === "uploading" ||
              isLiveScanning
            }
          />
        </div>

        {/* ── Right Panel: Subsea Tactical GIS Map + Detail Sidebar ── */}
        <div className="flex" style={{ width: "50%" }}>
          {/* Map / Radar GIS */}
          <div
            className="flex-1 flex flex-col"
            style={{
              borderRight: selectedDetection
                ? "1px solid var(--border-subtle)"
                : "none",
            }}
          >
            <TacticalMap
              geojson={geojson}
              selectedDetection={selectedDetection}
              onDetectionSelect={handleDetectionSelect}
            />
          </div>

          {/* Detection Detail Sidebar */}
          {selectedDetection && (
            <div
              className="overflow-y-auto"
              style={{
                width: 320,
                background: "var(--bg-secondary)",
                borderLeft: "1px solid var(--border-subtle)",
              }}
            >
              <div className="p-3">
                <DetectionCard
                  detection={selectedDetection}
                  onClose={() => setSelectedDetection(null)}
                />

                {/* All Detections List */}
                <div className="mt-4">
                  <span
                    className="text-xs font-semibold uppercase tracking-wider block mb-2"
                    style={{
                      color: "var(--text-muted)",
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Target Registry ({detections.length})
                  </span>
                  <div className="space-y-1.5">
                    {detections.map((det) => (
                      <button
                        key={det.id}
                        onClick={() => handleDetectionSelect(det)}
                        className="w-full text-left p-2.5 rounded-lg transition-all duration-200 cursor-pointer"
                        style={{
                          background:
                            selectedDetection?.id === det.id
                              ? "var(--accent-dim)"
                              : "rgba(15, 23, 42, 0.6)",
                          border:
                            selectedDetection?.id === det.id
                              ? "1px solid var(--border-accent)"
                              : "1px solid rgba(148, 163, 184, 0.1)",
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              background: det.properties.marker_color,
                              boxShadow: `0 0 6px ${det.properties.marker_color}`,
                            }}
                          />
                          <span
                            className="text-xs font-semibold uppercase font-mono"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {det.properties.class_label.replace(/_/g, " ")}
                          </span>
                          <span
                            className="text-xs ml-auto font-mono font-bold"
                            style={{
                              color: "var(--accent-primary)",
                            }}
                          >
                            {(det.properties.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div
                          className="text-xs mt-1 ml-4 font-mono flex items-center justify-between"
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "0.65rem",
                          }}
                        >
                          <span>H = {det.properties.h_target_m.toFixed(3)}m</span>
                          <span
                            className="px-1.5 py-0.2 rounded text-[9px] font-bold"
                            style={{
                              background: `${det.properties.marker_color}22`,
                              color: det.properties.marker_color,
                              border: `1px solid ${det.properties.marker_color}44`,
                            }}
                          >
                            {det.properties.threat_level}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Hydrographic Status Bar ── */}
      <footer
        className="flex items-center justify-between px-4 py-1 text-[11px] font-mono"
        style={{
          background: "#070b14",
          borderTop: "1px solid var(--border-subtle)",
          color: "var(--text-muted)",
        }}
      >
        <span className="text-cyan-400 font-semibold">
          SIH26057 • Smart India Hackathon • Ministry of Earth Sciences
        </span>
        <span className="hidden md:inline">
          Hydrographic Engine: Speckle Lee Denoising → Slant-Ground Flattening → Dual-Head Seg → Shadow Mensuration
        </span>
        <span>
          LAT: 17.7215°N | LON: 83.3119°E (Bay of Bengal)
        </span>
      </footer>

      {/* ── Interactive Physics & Mensuration Modal ── */}
      <PhysicsModal
        isOpen={isPhysicsModalOpen}
        onClose={() => setIsPhysicsModalOpen(false)}
      />
    </div>
  );
}
