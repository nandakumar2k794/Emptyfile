"use client";

/**
 * SIH26057 — Control Panel
 * =========================
 * Top-level tactical command bar with pipeline controls:
 *   - Mission Scenario Selector (Visakhapatnam, Gulf of Mannar, UXO Grid, Aircraft Wreck)
 *   - Autonomous AUV Scan Mode with Web Audio Sonar Ping SFX
 *   - Upload .XTF / Image data
 *   - Run AI Analysis
 *   - Acoustic Physics & Mensuration Inspector Modal Trigger
 *   - Generate Clearance Dossier PDF
 */

import React, { useRef, useState } from "react";
import type { PipelineStatus } from "@/lib/types";
import { DEMO_SCENARIOS } from "@/lib/api";

interface ControlPanelProps {
  status: PipelineStatus;
  detectionCount: number;
  selectedScenario: string;
  onScenarioChange: (scenarioId: string) => void;
  onUpload: (file?: File | null) => void;
  onAnalyze: () => void;
  onGenerateDossier: () => void;
  onOpenPhysicsModal: () => void;
  isLiveScanning: boolean;
  onToggleLiveScan: () => void;
}

export default function ControlPanel({
  status,
  detectionCount,
  selectedScenario,
  onScenarioChange,
  onUpload,
  onAnalyze,
  onGenerateDossier,
  onOpenPhysicsModal,
  isLiveScanning,
  onToggleLiveScan,
}: ControlPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Synthesize realistic submarine/sonar acoustic ping sound
  const playSonarPing = () => {
    if (!audioEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // High frequency sonar ping sweep (1200Hz -> 800Hz)
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.4);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    onUpload(file || null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const statusConfig: Record<
    PipelineStatus,
    { label: string; className: string }
  > = {
    idle: { label: "STANDBY", className: "status-badge" },
    uploading: { label: "UPLOADING", className: "status-badge status-processing" },
    processing: { label: "INFERENCE", className: "status-badge status-processing" },
    complete: { label: "OPERATIONAL", className: "status-badge status-operational" },
    error: { label: "ALERT", className: "status-badge status-error" },
  };

  const currentStatus = statusConfig[status];
  const isProcessing = status === "uploading" || status === "processing";

  return (
    <header
      className="glass-panel-accent flex items-center justify-between px-4 py-2.5 flex-wrap gap-2"
      style={{
        borderRadius: 0,
        borderLeft: "none",
        borderRight: "none",
        borderTop: "none",
        background: "rgba(10, 14, 26, 0.95)",
      }}
    >
      {/* ── Left: Logo & System Identity ── */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{
            background:
              "linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))",
            boxShadow: "0 0 14px var(--accent-glow)",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0a0e1a"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 10 10" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-xs font-bold tracking-wider text-cyan-400 font-mono"
              style={{ letterSpacing: "0.08em" }}
            >
              SIH26057 • UNDERWATER DEBRIS DETECTION
            </h1>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/40">
              600kHz SSS
            </span>
          </div>
          <p
            className="text-[10px] text-slate-400 font-mono"
          >
            Adaptive Lee Filter → Slant-to-Ground → YOLOv8-Seg Dual-Head → Shadow Mensuration
          </p>
        </div>
      </div>

      {/* ── Center: Mission Preset & Controls ── */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* Mission Scenario Dropdown */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 rounded-lg px-2.5 py-1">
          <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase">
            Mission:
          </span>
          <select
            value={selectedScenario}
            onChange={(e) => onScenarioChange(e.target.value)}
            className="bg-transparent text-xs font-mono text-slate-200 outline-none cursor-pointer"
          >
            {DEMO_SCENARIOS.map((sc) => (
              <option key={sc.id} value={sc.id} className="bg-slate-900 text-slate-200">
                {sc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xtf,.png,.jpg,.jpeg,.tif,.tiff"
          onChange={handleFileSelect}
          className="hidden"
          id="sonar-upload"
        />

        {/* Upload XTF Button */}
        <button
          className="btn-secondary !py-1.5 !px-3 !text-xs cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          title="Upload real raw side-scan sonar image or XTF ping stream"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          Upload XTF
        </button>

        {/* Run AI Analysis Button */}
        <button
          className="btn-primary !py-1.5 !px-3 !text-xs cursor-pointer flex items-center gap-1.5"
          onClick={() => {
            playSonarPing();
            onAnalyze();
          }}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
          ) : (
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          )}
          {isProcessing ? "Inferring..." : "Run AI Analysis"}
        </button>

        {/* Live AUV Scan Simulation Button */}
        <button
          onClick={() => {
            playSonarPing();
            onToggleLiveScan();
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
            isLiveScanning
              ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse"
              : "bg-slate-900/90 text-slate-300 border-slate-800 hover:border-slate-700"
          }`}
          title="Toggle live autonomous AUV sonar survey simulation"
        >
          <span className={`w-2 h-2 rounded-full ${isLiveScanning ? "bg-amber-400 animate-ping" : "bg-slate-500"}`} />
          {isLiveScanning ? "AUV Scan: ACTIVE" : "Live AUV Scan"}
        </button>

        {/* Acoustic Physics & Mensuration Modal Button */}
        <button
          onClick={onOpenPhysicsModal}
          className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-500/40 transition-all cursor-pointer flex items-center gap-1.5"
          title="Inspect mathematical shadow trigonometry & Lee filter formulas"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Physics Formula
        </button>

        {/* Generate Dossier Button */}
        <button
          className="btn-danger !py-1.5 !px-3 !text-xs cursor-pointer flex items-center gap-1.5"
          onClick={onGenerateDossier}
          disabled={isProcessing || detectionCount === 0}
          style={{
            opacity: detectionCount === 0 ? 0.4 : 1,
          }}
          title="Export official SIH26057 hydrographic clearance dossier as PDF"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Clearance PDF
        </button>
      </div>

      {/* ── Right: Audio Toggle & Status ── */}
      <div className="flex items-center gap-3">
        {/* Audio Ping SFX Toggle */}
        <button
          onClick={() => setAudioEnabled(!audioEnabled)}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer"
          title={audioEnabled ? "Sonar Audio: ON" : "Sonar Audio: MUTED"}
        >
          {audioEnabled ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
        </button>

        {/* Anomaly Badge */}
        {detectionCount > 0 && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] font-bold"
            style={{
              background: "var(--accent-dim)",
              border: "1px solid var(--border-accent)",
              color: "var(--accent-primary)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            {detectionCount} ANOMALIES
          </div>
        )}

        {/* Pipeline Status */}
        <span className={`${currentStatus.className} !text-[10px]`}>
          {currentStatus.label}
        </span>
      </div>
    </header>
  );
}
