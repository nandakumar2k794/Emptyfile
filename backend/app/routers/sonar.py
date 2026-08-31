"""
SIH26057 — Sonar Processing API Routes
========================================

RESTful endpoints for the marine debris detection pipeline.
All endpoints are prefixed with /api/v1 for versioning.

PIPELINE FLOW:
    1. POST /upload     → Upload .XTF data (or trigger simulation)
    2. GET  /detections  → Retrieve GeoJSON detection results
    3. GET  /sonar-image → Retrieve processed sonar waterfall as PNG
    4. POST /report      → Generate detection summary for PDF dossier
"""

import io
import cv2
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional

from app.config import (
    WATERFALL_WIDTH_PX, WATERFALL_HEIGHT_PX,
    TOWFISH_ALTITUDE_M, SLANT_RANGE_MAX_M,
    LEE_FILTER_WINDOW_SIZE
)
from app.preprocessing.sonar_simulator import generate_synthetic_sonar_waterfall
from app.preprocessing.lee_filter import adaptive_lee_filter
from app.preprocessing.range_correction import slant_to_ground_range_correction
from app.inference.detector import run_simulated_yolo_pipeline
from app.inference.mensuration import run_mensuration_pipeline
from app.inference.geojson_builder import build_geojson_collection, _to_native

router = APIRouter(prefix="/api/v1", tags=["Sonar Processing"])

# ─────────────────────────────────────────────────────────────
# In-memory cache for the current analysis session
# In production, this would be a database or Redis cache.
# ─────────────────────────────────────────────────────────────
_session_cache = {
    "raw_image": None,          # Raw synthetic sonar waterfall
    "filtered_image": None,     # After Adaptive Lee Filter
    "corrected_image": None,    # After slant-to-ground correction
    "annotated_image": None,    # With bounding box overlays
    "ground_truth": None,       # Simulator target metadata
    "detections": None,         # Enriched detection results
    "geojson": None,            # GeoJSON FeatureCollection
}


def _run_full_pipeline(
    raw_image: np.ndarray,
    ground_truth: list = None
) -> dict:
    """
    Execute the complete acoustic preprocessing + inference pipeline.
    
    PIPELINE STAGES:
      1. Adaptive Lee Filter    → Speckle noise suppression
      2. Range Correction       → Flatten nadir distortion
      3. YOLOv8-Seg Inference   → Detect highlight-shadow pairs
      4. Mensuration            → Calculate physical dimensions
      5. GeoJSON Construction   → Georeference detections
    """
    # ── Stage 1: Adaptive Lee Filter ──
    # Suppresses multiplicative speckle while preserving target edges
    filtered = adaptive_lee_filter(
        raw_image,
        window_size=LEE_FILTER_WINDOW_SIZE,
        noise_var=None,  # Auto-estimate from image
        noise_method="cov"
    )
    _session_cache["filtered_image"] = filtered
    
    # ── Stage 2: Slant-to-Ground Range Correction ──
    # Removes nadir blind zone and corrects geometric distortion
    corrected = slant_to_ground_range_correction(
        filtered,
        towfish_altitude_m=TOWFISH_ALTITUDE_M,
        slant_range_max_m=SLANT_RANGE_MAX_M,
        dual_channel=True
    )
    _session_cache["corrected_image"] = corrected
    
    # ── Stage 3: Simulated YOLOv8-Seg Dual-Head Inference ──
    detections = run_simulated_yolo_pipeline(corrected, ground_truth)
    
    # ── Stage 4: Physical Mensuration ──
    enriched = run_mensuration_pipeline(detections)
    _session_cache["detections"] = enriched
    
    # ── Stage 5: GeoJSON Construction ──
    geojson = build_geojson_collection(enriched)
    _session_cache["geojson"] = geojson
    
    # ── Create annotated image with bounding boxes ──
    annotated = _draw_annotations(corrected, enriched)
    _session_cache["annotated_image"] = annotated
    
    return geojson


def _draw_annotations(image: np.ndarray, detections: list) -> np.ndarray:
    """
    Draw dual bounding boxes (highlight + shadow) on the sonar image.
    
    Color coding:
      - CYAN:  Specular highlight (bright backscatter from target)
      - RED:   Acoustic shadow (blocked beam zone behind target)
      - WHITE: Labels with class name and confidence
    """
    # Convert to BGR for colored annotations
    if len(image.shape) == 2:
        annotated = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    else:
        annotated = image.copy()
    
    h, w = annotated.shape[:2]
    
    for det in detections:
        # Clamp bounding boxes to image dimensions
        hl = det["highlight_bbox"]
        sh = det["shadow_bbox"]
        
        hl_clamped = [
            max(0, min(hl[0], w-1)), max(0, min(hl[1], h-1)),
            max(0, min(hl[2], w-1)), max(0, min(hl[3], h-1))
        ]
        sh_clamped = [
            max(0, min(sh[0], w-1)), max(0, min(sh[1], h-1)),
            max(0, min(sh[2], w-1)), max(0, min(sh[3], h-1))
        ]
        
        # ── Draw highlight bounding box (CYAN) ──
        cv2.rectangle(
            annotated,
            (hl_clamped[0], hl_clamped[1]),
            (hl_clamped[2], hl_clamped[3]),
            color=(255, 255, 0),  # Cyan in BGR
            thickness=2
        )
        
        # ── Draw shadow bounding box (RED) ──
        if sh_clamped[2] > sh_clamped[0] and sh_clamped[3] > sh_clamped[1]:
            cv2.rectangle(
                annotated,
                (sh_clamped[0], sh_clamped[1]),
                (sh_clamped[2], sh_clamped[3]),
                color=(0, 0, 255),  # Red in BGR
                thickness=2
            )
        
        # ── Label with class and confidence ──
        label = f"{det['classification']['class_label']} {det['confidence']:.0%}"
        label_y = max(hl_clamped[1] - 8, 15)
        cv2.putText(
            annotated, label,
            (hl_clamped[0], label_y),
            cv2.FONT_HERSHEY_SIMPLEX, 0.45,
            (255, 255, 255), 1, cv2.LINE_AA
        )
        
        # ── Height annotation ──
        h_label = f"H={det['h_target_m']:.2f}m"
        cv2.putText(
            annotated, h_label,
            (hl_clamped[0], hl_clamped[3] + 15),
            cv2.FONT_HERSHEY_SIMPLEX, 0.35,
            (0, 255, 255), 1, cv2.LINE_AA  # Yellow
        )
    
    return annotated


# ═════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═════════════════════════════════════════════════════════════

@router.post("/upload")
async def upload_sonar_data(file: Optional[UploadFile] = File(None)):
    """
    Upload simulated .XTF sonar data and run the full detection pipeline.
    
    If no file is provided, generates synthetic sonar waterfall data with
    embedded debris targets for demonstration purposes.
    
    Returns:
        GeoJSON FeatureCollection with all detected anomalies
    """
    if file is not None:
        # Read uploaded file as grayscale image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        raw_image = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
        
        if raw_image is None:
            raise HTTPException(
                status_code=400,
                detail="Could not decode uploaded file as an image. "
                       "Please upload a .png, .jpg, or simulated .xtf file."
            )
        
        # Resize to standard waterfall dimensions
        raw_image = cv2.resize(
            raw_image,
            (WATERFALL_WIDTH_PX, WATERFALL_HEIGHT_PX),
            interpolation=cv2.INTER_LINEAR
        )
        
        _session_cache["raw_image"] = raw_image
        _session_cache["ground_truth"] = None
        
        geojson = _run_full_pipeline(raw_image, ground_truth=None)
    else:
        # Generate synthetic sonar data with known targets
        raw_image, ground_truth = generate_synthetic_sonar_waterfall(
            width=WATERFALL_WIDTH_PX,
            height=WATERFALL_HEIGHT_PX,
            num_targets=4
        )
        
        _session_cache["raw_image"] = raw_image
        _session_cache["ground_truth"] = ground_truth
        
        geojson = _run_full_pipeline(raw_image, ground_truth)
    
    return JSONResponse(content=geojson)


@router.get("/detections")
async def get_detections():
    """
    Retrieve the cached GeoJSON detection results from the last analysis.
    
    Returns:
        GeoJSON FeatureCollection, or triggers a new simulation if no cache exists
    """
    if _session_cache["geojson"] is None:
        # Auto-generate synthetic data if no previous analysis
        raw_image, ground_truth = generate_synthetic_sonar_waterfall()
        _session_cache["raw_image"] = raw_image
        _session_cache["ground_truth"] = ground_truth
        _run_full_pipeline(raw_image, ground_truth)
    
    return JSONResponse(content=_session_cache["geojson"])


@router.get("/sonar-image")
async def get_sonar_image(stage: str = "annotated"):
    """
    Retrieve the sonar waterfall image at a specific processing stage.
    
    Query params:
        stage: "raw" | "filtered" | "corrected" | "annotated" (default)
    
    Returns:
        PNG image stream
    """
    stage_map = {
        "raw": "raw_image",
        "filtered": "filtered_image",
        "corrected": "corrected_image",
        "annotated": "annotated_image"
    }
    
    cache_key = stage_map.get(stage, "annotated_image")
    image = _session_cache.get(cache_key)
    
    if image is None:
        # Auto-generate if needed
        raw_image, ground_truth = generate_synthetic_sonar_waterfall()
        _session_cache["raw_image"] = raw_image
        _session_cache["ground_truth"] = ground_truth
        _run_full_pipeline(raw_image, ground_truth)
        image = _session_cache.get(cache_key)
    
    if image is None:
        raise HTTPException(status_code=404, detail=f"Image stage '{stage}' not available")
    
    # Encode as PNG
    _, buffer = cv2.imencode(".png", image)
    return StreamingResponse(
        io.BytesIO(buffer.tobytes()),
        media_type="image/png",
        headers={"Cache-Control": "no-cache"}
    )


@router.post("/report")
async def generate_report():
    """
    Generate a detection summary report for the PDF dossier generator.
    
    Returns the full detection data in a format optimized for the
    client-side jsPDF report builder.
    """
    if _session_cache["detections"] is None:
        # Auto-generate
        raw_image, ground_truth = generate_synthetic_sonar_waterfall()
        _session_cache["raw_image"] = raw_image
        _session_cache["ground_truth"] = ground_truth
        _run_full_pipeline(raw_image, ground_truth)
    
    detections = _session_cache["detections"]
    geojson = _session_cache["geojson"]
    
    # Build report-friendly summary
    report = {
        "title": "SIH26057 — Marine Debris Clearance Dossier",
        "system": "AI-Powered Automated Underwater Marine Debris Detection",
        "sonar_config": {
            "frequency_khz": 600,
            "towfish_altitude_m": TOWFISH_ALTITUDE_M,
            "slant_range_max_m": SLANT_RANGE_MAX_M,
            "survey_origin_lat": 17.7215,
            "survey_origin_lon": 83.3119,
        },
        "preprocessing": {
            "lee_filter_window": LEE_FILTER_WINDOW_SIZE,
            "range_correction": "slant_to_ground",
            "range_correction_formula": "R_ground = sqrt(R_slant² − H_towfish²)",
        },
        "inference_model": "YOLOv8-Seg (Simulated Dual-Head Pipeline)",
        "height_formula": "H_target = (L_shadow × H_towfish) / R_slant",
        "total_detections": len(detections),
        "detections": [
            {
                "id": d["detection_id"],
                "class": d["classification"]["class_label"],
                "threat": d["classification"]["threat_level"],
                "confidence": d["confidence"],
                "dimensions": d["dimensions"],
                "h_target_m": d["h_target_m"],
                "coordinates": geojson["features"][i]["geometry"]["coordinates"],
                "slant_range_m": d["slant_range_m"],
                "mensuration": d["parameters"],
            }
            for i, d in enumerate(detections)
        ],
        "geojson": geojson,
    }
    
    return JSONResponse(content=_to_native(report))


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "operational", "system": "SIH26057 Sonar Processing Engine"}
