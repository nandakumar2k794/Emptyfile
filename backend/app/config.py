"""
SIH26057 — Configuration & Physical Constants
=============================================

All values are grounded in real-world side-scan sonar survey parameters.
These constants drive the preprocessing pipeline, simulated inference,
and GeoJSON coordinate generation.
"""

import numpy as np

# ─────────────────────────────────────────────────────────────
# SONAR HARDWARE PARAMETERS
# Modeled after a typical 600 kHz side-scan (e.g., EdgeTech 4125)
# ─────────────────────────────────────────────────────────────
SONAR_FREQUENCY_KHZ = 600               # Operating frequency (kHz)
TOWFISH_ALTITUDE_M = 8.0                 # Height of towfish above seabed (meters)
SLANT_RANGE_MAX_M = 75.0                 # Maximum slant range per channel (meters)
SPEED_OF_SOUND_MS = 1500.0               # Speed of sound in seawater (m/s)
PING_RATE_HZ = 10.0                      # Ping repetition rate (Hz)
ALONG_TRACK_SPEED_MS = 1.5              # Survey vessel speed (m/s) — ~3 knots

# ─────────────────────────────────────────────────────────────
# IMAGE GEOMETRY
# Defines the pixel-to-physical mapping of the sonar waterfall
# ─────────────────────────────────────────────────────────────
WATERFALL_WIDTH_PX = 1024                # Cross-track pixels (both channels combined)
WATERFALL_HEIGHT_PX = 512                # Along-track pixels (scroll buffer depth)
PIXEL_RESOLUTION_M = (2 * SLANT_RANGE_MAX_M) / WATERFALL_WIDTH_PX  # ~0.146 m/px

# ─────────────────────────────────────────────────────────────
# SURVEY AREA — Simulated WGS84 Origin
# Set to a realistic coastal survey zone in the Bay of Bengal
# (off the coast of Visakhapatnam, India — relevant for MoES)
# ─────────────────────────────────────────────────────────────
SURVEY_ORIGIN_LAT = 17.7215              # Latitude (degrees N)
SURVEY_ORIGIN_LON = 83.3119              # Longitude (degrees E)
SURVEY_HEADING_DEG = 45.0                # Survey line bearing (degrees from N)

# Approximate meters-per-degree at this latitude
METERS_PER_DEG_LAT = 111_320.0
METERS_PER_DEG_LON = 111_320.0 * np.cos(np.radians(SURVEY_ORIGIN_LAT))

# ─────────────────────────────────────────────────────────────
# DEBRIS CLASSIFICATION TAXONOMY
# Based on UNEP/NOAA marine debris classification standards
# ─────────────────────────────────────────────────────────────
DEBRIS_CLASSES = {
    0: {"label": "ghost_net",   "description": "Derelict fishing net / trawl gear",       "threat": "HIGH"},
    1: {"label": "tire",        "description": "Discarded vehicle / industrial tire",      "threat": "MEDIUM"},
    2: {"label": "drum",        "description": "Metal or plastic barrel / drum",           "threat": "HIGH"},
    3: {"label": "pipe",        "description": "Industrial pipe segment",                  "threat": "MEDIUM"},
    4: {"label": "pallet",      "description": "Wooden or plastic shipping pallet",        "threat": "LOW"},
    5: {"label": "anchor_chain","description": "Lost anchor or chain segment",             "threat": "MEDIUM"},
    6: {"label": "unknown",     "description": "Unclassified anthropogenic anomaly",       "threat": "UNKNOWN"},
}

# ─────────────────────────────────────────────────────────────
# ADAPTIVE LEE FILTER DEFAULTS
# ─────────────────────────────────────────────────────────────
LEE_FILTER_WINDOW_SIZE = 7               # Kernel size (must be odd)
LEE_FILTER_NOISE_VAR = None              # None = auto-estimate from image

# ─────────────────────────────────────────────────────────────
# SIMULATED DETECTIONS SEED
# Controls reproducibility of synthetic sonar data generation
# ─────────────────────────────────────────────────────────────
RANDOM_SEED = 42
