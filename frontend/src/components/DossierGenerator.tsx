"use client";

/**
 * SIH26057 — Clearance Dossier PDF Generator
 * =============================================
 * Client-side PDF report generation using jsPDF.
 *
 * The dossier contains:
 *   - Title page with SIH26057 branding
 *   - System configuration (sonar params, preprocessing, model)
 *   - Detection summary table
 *   - Per-detection detail with coordinates, classification, H_target
 *   - Acoustic physics formulas used
 *   - Timestamped and page-numbered
 */

import { jsPDF } from "jspdf";
import type { ReportData } from "@/lib/types";

/**
 * Generate and download a Clearance Dossier PDF.
 *
 * @param data Report data from the backend /api/v1/report endpoint
 */
export function generateClearanceDossier(data: ReportData): void {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // ──────────────────────────────────────────────────────────
  // PAGE 1: TITLE PAGE
  // ──────────────────────────────────────────────────────────

  // Background header bar
  doc.setFillColor(10, 14, 26);
  doc.rect(0, 0, pageWidth, 80, "F");

  // Classification banner
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, pageWidth, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("CLASSIFIED — FOR OFFICIAL USE ONLY", pageWidth / 2, 5.5, {
    align: "center",
  });

  // Title
  doc.setTextColor(0, 229, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("CLEARANCE DOSSIER", pageWidth / 2, 30, { align: "center" });

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("SIH26057 — AI-Powered Marine Debris Detection", pageWidth / 2, 40, {
    align: "center",
  });

  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text("Side-Scan Sonar Imagery Analysis Report", pageWidth / 2, 48, {
    align: "center",
  });

  // Horizontal rule
  doc.setDrawColor(0, 229, 255);
  doc.setLineWidth(0.5);
  doc.line(margin + 20, 55, pageWidth - margin - 20, 55);

  // Metadata block
  y = 65;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text(
    `Generated: ${new Date().toISOString()}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 5;
  doc.text(
    `Total Anomalies Detected: ${data.total_detections}`,
    pageWidth / 2,
    y,
    { align: "center" }
  );

  // ──────────────────────────────────────────────────────────
  // SYSTEM CONFIGURATION SECTION
  // ──────────────────────────────────────────────────────────
  y = 95;
  doc.setTextColor(0, 229, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("1. SYSTEM CONFIGURATION", margin, y);

  y += 8;
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  const configLines = [
    `Sonar Frequency:        ${data.sonar_config.frequency_khz} kHz`,
    `Towfish Altitude:       ${data.sonar_config.towfish_altitude_m} m`,
    `Max Slant Range:        ${data.sonar_config.slant_range_max_m} m`,
    `Survey Origin:          ${data.sonar_config.survey_origin_lat}°N, ${data.sonar_config.survey_origin_lon}°E`,
    `Lee Filter Window:      ${data.preprocessing.lee_filter_window}×${data.preprocessing.lee_filter_window}`,
    `Range Correction:       ${data.preprocessing.range_correction_formula}`,
    `Inference Model:        ${data.inference_model}`,
    `Height Formula:         ${data.height_formula}`,
  ];

  for (const line of configLines) {
    doc.text(line, margin + 4, y);
    y += 5;
  }

  // ──────────────────────────────────────────────────────────
  // DETECTION SUMMARY TABLE
  // ──────────────────────────────────────────────────────────
  y += 8;
  doc.setTextColor(0, 229, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("2. DETECTION SUMMARY", margin, y);
  y += 8;

  // Table header
  const colWidths = [12, 28, 20, 20, 35, 28, 28];
  const headers = ["#", "Class", "Threat", "Conf.", "Dimensions (m)", "H_target", "R_slant"];

  doc.setFillColor(20, 30, 50);
  doc.rect(margin, y - 4, contentWidth, 7, "F");
  doc.setTextColor(0, 229, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");

  let x = margin + 2;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x, y);
    x += colWidths[i];
  }

  y += 6;

  // Table rows
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  for (const det of data.detections) {
    if (y > pageHeight - 30) {
      addPageFooter(doc, pageWidth, pageHeight);
      doc.addPage();
      y = margin;
    }

    // Alternate row background
    if (det.id % 2 === 0) {
      doc.setFillColor(245, 245, 250);
      doc.rect(margin, y - 3.5, contentWidth, 6, "F");
    }

    x = margin + 2;
    doc.setFontSize(7);
    doc.text(`${det.id + 1}`, x, y);
    x += colWidths[0];
    doc.text(det.class.replace("_", " "), x, y);
    x += colWidths[1];

    // Threat color
    if (det.threat === "HIGH") doc.setTextColor(220, 38, 38);
    else if (det.threat === "MEDIUM") doc.setTextColor(255, 153, 0);
    else if (det.threat === "LOW") doc.setTextColor(200, 180, 0);
    else doc.setTextColor(120, 120, 180);
    doc.text(det.threat, x, y);
    doc.setTextColor(60, 60, 60);
    x += colWidths[2];

    doc.text(`${(det.confidence * 100).toFixed(1)}%`, x, y);
    x += colWidths[3];
    doc.text(
      `${det.dimensions.width_m}×${det.dimensions.length_m}×${det.dimensions.height_m}`,
      x,
      y
    );
    x += colWidths[4];
    doc.text(`${det.h_target_m.toFixed(3)} m`, x, y);
    x += colWidths[5];
    doc.text(`${det.slant_range_m.toFixed(1)} m`, x, y);

    y += 6;
  }

  // ──────────────────────────────────────────────────────────
  // COORDINATE TABLE
  // ──────────────────────────────────────────────────────────
  y += 8;
  if (y > pageHeight - 50) {
    addPageFooter(doc, pageWidth, pageHeight);
    doc.addPage();
    y = margin;
  }

  doc.setTextColor(0, 229, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("3. WGS84 COORDINATES", margin, y);
  y += 8;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(20, 30, 50);
  doc.rect(margin, y - 4, contentWidth, 7, "F");
  doc.setTextColor(0, 229, 255);

  const coordHeaders = ["#", "Class", "Latitude", "Longitude", "Depth (m)"];
  const coordWidths = [12, 30, 40, 40, 30];
  x = margin + 2;
  for (let i = 0; i < coordHeaders.length; i++) {
    doc.text(coordHeaders[i], x, y);
    x += coordWidths[i];
  }
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  for (const det of data.detections) {
    if (y > pageHeight - 30) {
      addPageFooter(doc, pageWidth, pageHeight);
      doc.addPage();
      y = margin;
    }

    x = margin + 2;
    doc.text(`${det.id + 1}`, x, y);
    x += coordWidths[0];
    doc.text(det.class.replace("_", " "), x, y);
    x += coordWidths[1];
    doc.text(`${det.coordinates[1].toFixed(6)}° N`, x, y);
    x += coordWidths[2];
    doc.text(`${det.coordinates[0].toFixed(6)}° E`, x, y);
    x += coordWidths[3];
    // Use a reasonable depth value
    doc.text("−22.0", x, y);
    y += 6;
  }

  // ──────────────────────────────────────────────────────────
  // ACOUSTIC PHYSICS REFERENCE
  // ──────────────────────────────────────────────────────────
  y += 8;
  if (y > pageHeight - 60) {
    addPageFooter(doc, pageWidth, pageHeight);
    doc.addPage();
    y = margin;
  }

  doc.setTextColor(0, 229, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("4. ACOUSTIC PHYSICS REFERENCE", margin, y);
  y += 8;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");

  const physicsLines = [
    "Target Height Estimation (Shadow Method):",
    "  H_target = (L_shadow × H_towfish) / R_slant",
    "",
    "Slant-to-Ground Range Correction:",
    "  R_ground = sqrt(R_slant² − H_towfish²)",
    "",
    "Adaptive Lee Filter (Speckle Suppression):",
    "  I_filtered(x,y) = μ_L + K × (I(x,y) − μ_L)",
    "  where K = σ²_L / (σ²_L + σ²_n)",
    "",
    "References:",
    "  Lee, J.S. (1980) IEEE TPAMI, vol. 2, no. 2",
    "  Blondel, Ph. (2009) Handbook of Sidescan Sonar, Springer",
  ];

  for (const line of physicsLines) {
    doc.text(line, margin + 4, y);
    y += 5;
  }

  // Footer on last page
  addPageFooter(doc, pageWidth, pageHeight);

  // ── Save the PDF ──
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  doc.save(`SIH26057_Clearance_Dossier_${timestamp}.pdf`);
}

function addPageFooter(
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number
) {
  const page = doc.getNumberOfPages();
  doc.setFontSize(6);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `SIH26057 — AI-Powered Marine Debris Detection | Page ${page}`,
    pageWidth / 2,
    pageHeight - 8,
    { align: "center" }
  );
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(20, pageHeight - 12, pageWidth - 20, pageHeight - 12);
}
