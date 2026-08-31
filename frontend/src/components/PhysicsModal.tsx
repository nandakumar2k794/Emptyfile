"use client";

import React, { useState } from "react";

interface PhysicsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PhysicsModal({ isOpen, onClose }: PhysicsModalProps) {
  // Interactive slider states for live mensuration formula demonstration
  const [towfishAlt, setTowfishAlt] = useState<number>(8.0); // H_towfish (m)
  const [shadowLen, setShadowLen] = useState<number>(6.5); // L_shadow (m)
  const [slantRange, setSlantRange] = useState<number>(38.2); // R_slant (m)

  if (!isOpen) return null;

  // Formula: H_target = (L_shadow * H_towfish) / R_slant
  const calculatedHeight = (shadowLen * towfishAlt) / (slantRange || 1);
  // Ground range: R_ground = sqrt(max(0, R_slant^2 - H_towfish^2))
  const calculatedGroundRange = Math.sqrt(
    Math.max(0, slantRange * slantRange - towfishAlt * towfishAlt)
  );
  // Grazing angle (theta) = arcsin(H_towfish / R_slant)
  const grazingAngleDeg =
    slantRange > towfishAlt
      ? (Math.asin(towfishAlt / slantRange) * 180) / Math.PI
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 border shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #0d1527 0%, #080d1a 100%)",
          borderColor: "var(--border-accent)",
          boxShadow: "0 0 40px rgba(0, 229, 255, 0.2)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-cyan-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 3v18M3 12h18" />
                <path d="M7 7l10 10M17 7L7 17" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide font-mono flex items-center gap-2">
                ACOUSTIC PHYSICS &amp; SHADOW MENSURATION
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  SIH26057 FORMULATION
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Mathematical trigonometry &amp; speckle noise reduction principles for hydrographic judges
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Left Column: Interactive Calculator */}
          <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                1. Live Mensuration Calculator
              </h3>
              <span className="text-[11px] font-mono text-amber-400 font-semibold">
                H_target = (L_shadow × H_towfish) / R_slant
              </span>
            </div>

            {/* Sliders */}
            <div className="space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Towfish Altitude (H_alt):</span>
                  <span className="text-cyan-400 font-bold">{towfishAlt.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="0.5"
                  value={towfishAlt}
                  onChange={(e) => setTowfishAlt(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Acoustic Shadow Length (L_shadow):</span>
                  <span className="text-red-400 font-bold">{shadowLen.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="20"
                  step="0.1"
                  value={shadowLen}
                  onChange={(e) => setShadowLen(parseFloat(e.target.value))}
                  className="w-full accent-red-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Slant Range to Target (R_slant):</span>
                  <span className="text-emerald-400 font-bold">{slantRange.toFixed(1)} m</span>
                </div>
                <input
                  type="range"
                  min={Math.max(towfishAlt + 1, 10)}
                  max="80"
                  step="0.5"
                  value={slantRange}
                  onChange={(e) => setSlantRange(parseFloat(e.target.value))}
                  className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Calculated Output Card */}
            <div className="mt-2 p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/30 font-mono">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-black/40">
                  <div className="text-[10px] text-slate-400">TARGET HEIGHT</div>
                  <div className="text-base font-bold text-amber-300 mt-0.5">
                    {calculatedHeight.toFixed(3)} m
                  </div>
                  <div className="text-[9px] text-slate-500">{(calculatedHeight * 100).toFixed(1)} cm</div>
                </div>
                <div className="p-2 rounded-lg bg-black/40">
                  <div className="text-[10px] text-slate-400">GROUND RANGE</div>
                  <div className="text-base font-bold text-cyan-300 mt-0.5">
                    {calculatedGroundRange.toFixed(2)} m
                  </div>
                  <div className="text-[9px] text-slate-500">Corrected</div>
                </div>
                <div className="p-2 rounded-lg bg-black/40">
                  <div className="text-[10px] text-slate-400">GRAZING ANGLE</div>
                  <div className="text-base font-bold text-emerald-300 mt-0.5">
                    {grazingAngleDeg.toFixed(1)}°
                  </div>
                  <div className="text-[9px] text-slate-500">θ incidence</div>
                </div>
              </div>
            </div>

            {/* Visual Ray-trace diagram */}
            <div className="relative h-32 rounded-lg bg-black/60 border border-slate-800 overflow-hidden flex items-center justify-center p-2">
              <svg viewBox="0 0 360 120" className="w-full h-full">
                {/* Water surface */}
                <line x1="10" y1="20" x2="350" y2="20" stroke="#0284c7" strokeWidth="1" strokeDasharray="4 2" />
                <text x="15" y="16" fill="#0284c7" fontSize="8" fontFamily="monospace">WATER SURFACE</text>

                {/* Seafloor */}
                <line x1="10" y1="105" x2="350" y2="105" stroke="#475569" strokeWidth="2" />
                <text x="15" y="116" fill="#64748b" fontSize="8" fontFamily="monospace">SEAFLOOR BATHYMETRY</text>

                {/* Towfish */}
                <circle cx="60" cy="45" r="5" fill="#00e5ff" />
                <text x="70" y="47" fill="#00e5ff" fontSize="9" fontWeight="bold" fontFamily="monospace">AUV TOWFISH (Alt: {towfishAlt.toFixed(1)}m)</text>

                {/* Acoustic Beam Rays */}
                <line x1="60" y1="45" x2="200" y2="92" stroke="#eab308" strokeWidth="1.5" strokeDasharray="3 3" />
                <line x1="60" y1="45" x2="270" y2="105" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="2 2" />

                {/* Debris Target */}
                <rect x="200" y="90" width="16" height="15" fill="#00e5ff" rx="2" />
                <text x="180" y="85" fill="#00e5ff" fontSize="8" fontFamily="monospace">HIGHLIGHT</text>

                {/* Acoustic Shadow Zone */}
                <rect x="216" y="103" width="54" height="4" fill="#ef4444" opacity="0.8" />
                <text x="220" y="116" fill="#ef4444" fontSize="8" fontFamily="monospace">SHADOW ({shadowLen.toFixed(1)}m)</text>
              </svg>
            </div>
          </div>

          {/* Right Column: Preprocessing & Neural Pipeline */}
          <div className="flex flex-col gap-4">
            {/* Adaptive Lee Filter */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  2. Adaptive Lee Filter Formulation
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Removes Rayleigh multiplicative speckle noise while preserving sub-pixel debris boundaries and acoustic shadow terminations.
              </p>
              <div className="p-3 rounded-lg bg-black/50 border border-slate-800 font-mono text-[11px] text-cyan-300 space-y-1.5">
                <div>Î(x,y) = μ_L + K · (I(x,y) - μ_L)</div>
                <div className="text-slate-400">K = σ²_L / (σ²_L + σ²_n), where σ²_n = (CoV_homo)²</div>
              </div>
            </div>

            {/* Slant-to-Ground Correction */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  3. Slant-to-Ground Geometric Correction
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Rectifies hyperbolic slant range compression caused by towfish altitude above the seafloor, eliminating the nadir blind track.
              </p>
              <div className="p-3 rounded-lg bg-black/50 border border-slate-800 font-mono text-[11px] text-emerald-300">
                R_ground = √(R_slant² - H_towfish²)
              </div>
            </div>

            {/* YOLOv8-Seg Dual Head */}
            <div className="p-5 rounded-xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                  4. YOLOv8-Seg Dual-Head Segmentation
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Simultaneously predicts specular highlight backscatter (M_hl) and acoustic shadow masks (M_sh) paired via collinear acoustic projection rays.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
          <div>Hydrographic Reference: IEEE Oceanic Engineering / Blondel Handbook of Side-Scan Sonar</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-semibold transition-all cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
