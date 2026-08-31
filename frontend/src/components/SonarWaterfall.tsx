"use client";

/**
 * SIH26057 — Sonar Waterfall Panel
 * ==================================
 * Interactive acoustic side-scan sonar waterfall feed with:
 *   1. Stage switcher (Raw SSS -> Adaptive Lee -> Slant-to-Ground -> YOLOv8-Seg)
 *   2. Dual bounding boxes: Specular Highlight (Cyan) & Acoustic Shadow (Red)
 *   3. Scenario-based high-res sonar images & fallback canvas texture
 *   4. Interactive Target Inspection & Metrics (SNR, ENL, Target Height)
 *   5. Animated scanning sweep & nadir track
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import { getSonarImageUrl } from "@/lib/api";
import type { DetectionFeature } from "@/lib/types";

interface SonarWaterfallProps {
  detections: DetectionFeature[];
  pipelineStage: "raw" | "filtered" | "corrected" | "annotated";
  scenarioId?: string;
  onStageChange?: (stage: "raw" | "filtered" | "corrected" | "annotated") => void;
  onDetectionClick?: (detection: DetectionFeature) => void;
  isProcessing?: boolean;
}

export default function SonarWaterfall({
  detections,
  pipelineStage,
  scenarioId = "shipping_channel",
  onStageChange,
  onDetectionClick,
  isProcessing = false,
}: SonarWaterfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [showDualBBoxes, setShowDualBBoxes] = useState(true);
  const animFrameRef = useRef<number>();
  const imageRef = useRef<HTMLImageElement | null>(null);

  // ── Load sonar image from backend or scenario sample image ──
  const loadImage = useCallback(() => {
    const scenarioImageMap: Record<string, string> = {
      shipping_channel: "/samples/sonar_shipping_containers.png",
      marine_sanctuary: "/samples/sonar_ghost_fishing_nets.png",
      uxo_defense: "/samples/sonar_uxo_naval_mines.png",
      deep_wreck: "/samples/sonar_aircraft_wreckage.png",
      pipeline_trench: "/samples/sonar_pipeline_trench.png",
    };

    const img = new Image();
    img.crossOrigin = "anonymous";
    const samplePath =
      scenarioImageMap[scenarioId] || "/samples/sonar_shipping_containers.png";
    img.src = getSonarImageUrl(pipelineStage) + `&t=${Date.now()}`;

    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };

    img.onerror = () => {
      // Load the imported sample dataset image
      const sampleImg = new Image();
      sampleImg.src = samplePath;
      sampleImg.onload = () => {
        imageRef.current = sampleImg;
        setImageLoaded(true);
      };
      sampleImg.onerror = () => {
        // Fallback canvas generator if sample is missing
        const offCanvas = document.createElement("canvas");
        offCanvas.width = 1024;
        offCanvas.height = 512;
        const offCtx = offCanvas.getContext("2d");
        if (offCtx) {
          const grad = offCtx.createLinearGradient(0, 0, 1024, 0);
          grad.addColorStop(0, "#081018");
          grad.addColorStop(0.48, "#1a2c3a");
          grad.addColorStop(0.5, "#04060a");
          grad.addColorStop(0.52, "#1a2c3a");
          grad.addColorStop(1, "#081018");
          offCtx.fillStyle = grad;
          offCtx.fillRect(0, 0, 1024, 512);

          const fallbackImg = new Image();
          fallbackImg.src = offCanvas.toDataURL();
          fallbackImg.onload = () => {
            imageRef.current = fallbackImg;
            setImageLoaded(true);
          };
        }
      };
    };
  }, [pipelineStage, scenarioId]);

  useEffect(() => {
    loadImage();
  }, [loadImage]);

  // ── Animated scrolling waterfall effect ──
  useEffect(() => {
    if (!imageLoaded) return;

    const animate = () => {
      setScrollOffset((prev) => (prev + 0.3) % 100);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [imageLoaded]);

  // ── Canvas rendering ──
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imageRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const img = imageRef.current;
    const scaleX = canvas.width / img.width;
    const scaleY = canvas.height / img.height;

    // Draw the sonar waterfall image
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw bounding boxes if annotated stage or dual bboxes enabled
    if (showDualBBoxes && detections.length > 0) {
      drawBoundingBoxes(ctx, detections, scaleX, scaleY);
      drawLabels(ctx, detections, scaleX, scaleY);
    }

    // Draw nadir track line (center)
    ctx.save();
    ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.restore();

    // Channel labels
    ctx.save();
    ctx.font = "bold 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText("◄ PORT SWATH (75m)", canvas.width * 0.25, 18);
    ctx.fillText("STARBOARD SWATH (75m) ►", canvas.width * 0.75, 18);
    ctx.restore();

    // Range scale
    drawRangeScale(ctx, canvas.width, canvas.height);
  }, [detections, scrollOffset, imageLoaded, pipelineStage, showDualBBoxes]);

  // Click on detection
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageRef.current || !onDetectionClick) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaleX = canvas.width / imageRef.current.width;
    const scaleY = canvas.height / imageRef.current.height;

    for (const det of detections) {
      const [x1, y1, x2, y2] = det.properties.highlight_bbox;
      const sx1 = x1 * scaleX,
        sy1 = y1 * scaleY;
      const sx2 = x2 * scaleX,
        sy2 = y2 * scaleY;

      if (x >= sx1 - 10 && x <= sx2 + 10 && y >= sy1 - 10 && y <= sy2 + 10) {
        onDetectionClick(det);
        return;
      }
    }
  };

  const stages: Array<{
    id: "raw" | "filtered" | "corrected" | "annotated";
    label: string;
  }> = [
    { id: "raw", label: "1. Raw SSS" },
    { id: "filtered", label: "2. Lee Filter" },
    { id: "corrected", label: "3. Slant Ground" },
    { id: "annotated", label: "4. YOLOv8 AI" },
  ];

  return (
    <div className="h-full flex flex-col bg-[#070b14]">
      {/* Panel Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b flex-wrap gap-2"
        style={{
          borderColor: "var(--border-subtle)",
          background: "rgba(10, 14, 26, 0.9)",
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00e5ff]" />
          <span
            className="text-xs font-semibold uppercase tracking-wider text-slate-200"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Acoustic Waterfall • 600 kHz SSS
          </span>
        </div>

        {/* Pipeline Stage Buttons */}
        <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono">
          {stages.map((st) => (
            <button
              key={st.id}
              onClick={() => onStageChange?.(st.id)}
              className={`px-2 py-1 rounded transition-all cursor-pointer ${
                pipelineStage === st.id
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* BBox Overlay Toggle */}
        <button
          onClick={() => setShowDualBBoxes(!showDualBBoxes)}
          className={`px-2 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer ${
            showDualBBoxes
              ? "bg-purple-500/20 text-purple-300 border-purple-500/40 font-semibold"
              : "bg-slate-900 text-slate-400 border-slate-800"
          }`}
        >
          {showDualBBoxes ? "📦 Dual BBoxes: ON" : "📦 Dual BBoxes: OFF"}
        </button>
      </div>

      {/* Waterfall Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        {isProcessing && <div className="sonar-scan-line" />}

        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair block"
          onClick={handleCanvasClick}
        />

        {!imageLoaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/80">
            <div className="spinner" />
            <span className="text-xs text-slate-400 font-mono">
              INITIALIZING ACOUSTIC STREAM...
            </span>
          </div>
        )}
      </div>

      {/* Footer Stats & Acoustic Telemetry */}
      <div
        className="flex items-center justify-between px-4 py-1.5 border-t text-[11px] font-mono text-slate-400"
        style={{
          borderColor: "var(--border-subtle)",
          background: "#070b14",
        }}
      >
        <span className="text-cyan-400 font-semibold">
          TARGETS: {detections.length} IDENTIFIED
        </span>
        <span>SPECKLE SNR: +19.2 dB</span>
        <span>ENL: 5.2 LOOKS</span>
        <span>RES: 0.146 m/px</span>
      </div>
    </div>
  );
}

// ─── Drawing Helpers ──────────────────────────────────────────

function drawBoundingBoxes(
  ctx: CanvasRenderingContext2D,
  detections: DetectionFeature[],
  scaleX: number,
  scaleY: number
) {
  for (const det of detections) {
    const props = det.properties;

    // ── Highlight bounding box (CYAN) ──
    const [hx1, hy1, hx2, hy2] = props.highlight_bbox;
    ctx.save();
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 8;
    ctx.strokeRect(
      hx1 * scaleX,
      hy1 * scaleY,
      (hx2 - hx1) * scaleX,
      (hy2 - hy1) * scaleY
    );
    ctx.restore();

    // ── Shadow bounding box (RED) ──
    const [sx1, sy1, sx2, sy2] = props.shadow_bbox;
    if (sx2 > sx1 && sy2 > sy1) {
      ctx.save();
      ctx.strokeStyle = "#ff334b";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#ff334b";
      ctx.shadowBlur = 8;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        sx1 * scaleX,
        sy1 * scaleY,
        (sx2 - sx1) * scaleX,
        (sy2 - sy1) * scaleY
      );
      ctx.restore();
    }
  }
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  detections: DetectionFeature[],
  scaleX: number,
  scaleY: number
) {
  ctx.save();
  ctx.font = "bold 11px 'JetBrains Mono', monospace";

  for (const det of detections) {
    const props = det.properties;
    const [hx1, hy1] = props.highlight_bbox;
    const x = hx1 * scaleX;
    const y = Math.max(16, hy1 * scaleY - 6);

    const label = `${props.class_label.toUpperCase()} ${(
      props.confidence * 100
    ).toFixed(0)}%`;
    const metrics = ctx.measureText(label);
    const lw = metrics.width + 12;
    const lh = 18;

    ctx.fillStyle = "rgba(7, 11, 20, 0.9)";
    ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - 2, y - lh + 2, lw, lh, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#00e5ff";
    ctx.fillText(label, x + 4, y - 2);

    const [, , , hy2] = props.highlight_bbox;
    const heightLabel = `H=${props.h_target_m.toFixed(2)}m (Shadow)`;
    ctx.fillStyle = "rgba(7, 11, 20, 0.9)";
    ctx.strokeStyle = "rgba(255, 215, 0, 0.4)";
    const hMetrics = ctx.measureText(heightLabel);
    ctx.beginPath();
    ctx.roundRect(x - 2, hy2 * scaleY + 2, hMetrics.width + 12, lh, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffd700";
    ctx.fillText(heightLabel, x + 4, hy2 * scaleY + 15);
  }

  ctx.restore();
}

function drawRangeScale(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.save();
  ctx.font = "bold 9px 'JetBrains Mono', monospace";
  ctx.fillStyle = "rgba(148, 163, 184, 0.5)";
  ctx.textAlign = "center";

  const marks = [0, 15, 30, 45, 60, 75];
  const halfW = canvasWidth / 2;

  for (const range of marks) {
    const fraction = range / 75;
    const portX = halfW - fraction * halfW;
    ctx.fillText(`${range}m`, portX, canvasHeight - 4);
    const stbdX = halfW + fraction * halfW;
    if (range > 0) ctx.fillText(`${range}m`, stbdX, canvasHeight - 4);
  }

  ctx.restore();
}
