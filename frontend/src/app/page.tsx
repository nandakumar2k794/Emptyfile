"use client";

/**
 * SIH26057 — Main Tactical Dashboard Page (Light Professional Theme)
 * ===================================================================
 * Clean, high-contrast, professional oceanographic research portal:
 *   LEFT:  600kHz Side-Scan Sonar Acoustic Waterfall Feed with 7 Preprocessing Stages
 *   RIGHT: Subsea Deep-Zoom Bathymetric Radar GIS & 3D Globe Tactical View
 *
 * Full Feature Set:
 *   1. 12 Diverse Object Sonar Datasets (Ghost Fishing Nets, Containers, UXO, Mines, Fuselage, Wrecks, etc.)
 *   2. 7-Stage Preprocessing: Raw → TVG Gain → SRAD Diffusion → Lee Filter → Slant Correction → YOLOv8 → 3D MVB
 *   3. YOLOv8 Pixel-Level Segmentation Polygon Masks (Highlights & Shadows)
 *   4. 3D Minimum Volumetric Bounding (MVB) Wireframe & Volumetric Calculations (V = L × W × H)
 *   5. Mathematical Acoustic Physics & Shadow Mensuration Modal
 *   6. Autonomous Live AUV Survey Scanning with Real-Time Audio SFX
 *   7. Hydrographic Clearance Dossier PDF Export
 */

import React, { useState, useCallback, useEffect } from "react";

import ControlPanel from "@/components/ControlPanel";
import SonarWaterfall from "@/components/SonarWaterfall";
import TacticalMap from "@/components/TacticalMap";
import DetectionCard from "@/components/DetectionCard";
import PhysicsModal from "@/components/PhysicsModal";
import MVBModal from "@/components/MVBModal";
import { generateClearanceDossier } from "@/components/DossierGenerator";

import { uploadSonarData, generateReport, getDetections, createMockScenario } from "@/lib/api";
import type {
  DetectionCollection,
  DetectionFeature,
  PipelineStage,
  PipelineStatus,
} from "@/lib/types";

export default function DashboardPage() {
  // ── State ──
  const [status, setStatus] = useState<PipelineStatus>("idle");
  const [geojson, setGeojson] = useState<DetectionCollection | null>(null);
  const [selectedDetection, setSelectedDetection] =
    useState<DetectionFeature | null>(null);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("annotated");
  const [selectedScenario, setSelectedScenario] = useState("gost_net1");
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const [isPhysicsModalOpen, setIsPhysicsModalOpen] = useState(false);
  const [isMVBModalOpen, setIsMVBModalOpen] = useState(false);
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
    setCustomImageSrc(null);
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
        if (file) {
          const localUrl = URL.createObjectURL(file);
          setCustomImageSrc(localUrl);
          setSelectedScenario("custom_upload");
          const result = await uploadSonarData(file, "custom_upload");
          setGeojson(result);
        } else {
          const result = await uploadSonarData(null, selectedScenario);
          setGeojson(result);
        }
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
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)]">
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
        onOpenMVBModal={() => setIsMVBModalOpen(true)}
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
            customImageSrc={customImageSrc}
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
              borderRight: selectedDetection ? "1px solid var(--border-subtle)" : "none",
            }}
          >
            <TacticalMap
              geojson={geojson}
              selectedDetection={selectedDetection}
              onDetectionSelect={handleDetectionSelect}
            />
          </div>

          {/* Detection Detail Sidebar (Light Theme) */}
          {selectedDetection && (
            <div
              className="overflow-y-auto bg-[var(--bg-secondary)] border-l border-[var(--border-subtle)]"
              style={{
                width: 320,
              }}
            >
              <div className="p-3.5">
                <DetectionCard
                  detection={selectedDetection}
                  onClose={() => setSelectedDetection(null)}
                  onOpenMVB={() => setIsMVBModalOpen(true)}
                />

                {/* Target Registry List */}
                <div className="mt-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider block mb-2 font-mono text-[var(--text-muted)]">
                    Target Registry ({detections.length})
                  </span>
                  <div className="space-y-1.5">
                    {detections.map((det) => (
                      <button
                        key={det.id}
                        onClick={() => handleDetectionSelect(det)}
                        className={`w-full text-left p-2.5 rounded-lg transition-all duration-200 cursor-pointer border ${
                          selectedDetection?.id === det.id
                            ? "bg-[var(--bg-tertiary)] border-[var(--border-subtle)]"
                            : "bg-transparent hover:bg-[var(--bg-tertiary)] border-[var(--border-subtle)]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                              background: det.properties.marker_color,
                              boxShadow: `0 0 4px ${det.properties.marker_color}`,
                            }}
                          />
                          <span className="text-xs font-semibold uppercase font-mono text-[var(--text-primary)]">
                            {det.properties.class_label.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs ml-auto font-mono font-bold text-[var(--accent-primary)]">
                            {(det.properties.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="text-xs mt-1 ml-4 font-mono flex items-center justify-between text-[var(--text-muted)] text-[10px]">
                          <span>
                            H={det.properties.h_target_m.toFixed(2)}m •{" "}
                            {det.properties.mvb?.volume_m3.toFixed(2)}m³
                          </span>
                          <span
                            className="px-1.5 py-0.2 rounded font-bold text-[9px]"
                            style={{
                              background: `${det.properties.marker_color}18`,
                              color: det.properties.marker_color,
                              border: `1px solid ${det.properties.marker_color}33`,
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

      

      {/* ── Interactive Physics & Mensuration Modal ── */}
      <PhysicsModal
        isOpen={isPhysicsModalOpen}
        onClose={() => setIsPhysicsModalOpen(false)}
      />

      {/* ── Interactive 3D MVB Modal ── */}
      <MVBModal
        isOpen={isMVBModalOpen}
        onClose={() => setIsMVBModalOpen(false)}
        detection={selectedDetection || (detections.length > 0 ? detections[0] : createMockScenario(selectedScenario).features[0])}
      />
    </div>
  );
}
