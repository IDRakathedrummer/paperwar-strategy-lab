"""Screen capture worker (Phase 2).

Uses mss for fast screenshot capture and optional OpenCV processing
to detect game state elements like ink count, unit counts, and map regions.
Install extras: pip install mss opencv-python-headless
"""


def capture_frame():
    """
    Capture a single frame from the primary monitor.
    Returns a numpy array (H, W, C) or None if mss is not available.
    """
    try:
        import mss
        import numpy as np
        with mss.mss() as sct:
            monitor = sct.monitors[1]
            shot = sct.grab(monitor)
            return np.array(shot)
    except ImportError:
        return None
