import numpy as np
from PIL import Image
try:
    import rasterio  
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False
MAX_DIM = 512
CLASS_NAMES = ["water", "vegetation", "built_up", "bare_land"]
_REF_ROWS = np.array(
    [
        [40, 80, 130],    # water 
        [12, 25, 45],     # water 
        [40, 110, 40],    # vegetation
        [150, 145, 140],  # built-up
        [180, 150, 110],  # bare land
    ],
    dtype=np.float32,
)
_WATER_ROWS = {0, 1}
_ROW_TO_CLASS = np.array([0, 0, 1, 2, 3])
VIS_COLORS = np.array(
    [
        [30, 110, 220],   # water
        [40, 170, 70],    # vegetation
        [220, 90, 60],    # built-up
        [210, 180, 120],  # bare land
    ],
    dtype=np.uint8,
)

def load_rgb(path: str) -> np.ndarray:
    try:
        img = Image.open(path).convert("RGB")
    except Exception:
        if not HAS_RASTERIO:
            raise ValueError(
                "Could not read this file as a standard image. For true multi-band "
                "GeoTIFFs, install rasterio (see requirements.txt)."
            )
        with rasterio.open(path) as src:
            bands = min(3, src.count)
            arr = src.read(list(range(1, bands + 1))).astype(np.float32)
            arr = np.transpose(arr, (1, 2, 0))
            if bands == 1:
                arr = np.repeat(arr, 3, axis=2)
            arr = arr - arr.min()
            maxv = arr.max() or 1.0
            arr = (arr / maxv * 255).astype(np.uint8)
            img = Image.fromarray(arr, mode="RGB")

    img.thumbnail((MAX_DIM, MAX_DIM))
    return np.array(img)

def classify_optical(rgb: np.ndarray):
    flat = rgb.reshape(-1, 3).astype(np.float32)
    dists = np.linalg.norm(flat[:, None, :] - _REF_ROWS[None, :, :], axis=2)
    raw = np.argmin(dists, axis=1)
    labels = _ROW_TO_CLASS[raw].reshape(rgb.shape[:2])
    return labels, _percentages(labels)

def classify_sar(rgb: np.ndarray):
    gray = rgb.astype(np.float32).mean(axis=2)
    labels = np.zeros(gray.shape, dtype=np.int64)  # water 
    labels[(gray >= 70) & (gray < 160)] = 1  # vegetation
    labels[gray >= 160] = 2  # built-up 
    return labels, _percentages(labels)

def _percentages(labels: np.ndarray) -> dict:
    total = labels.size
    return {name: float((labels == i).sum()) / total for i, name in enumerate(CLASS_NAMES)}

def colorize(rgb: np.ndarray, labels: np.ndarray, alpha: float = 0.55) -> Image.Image:
    vis = VIS_COLORS[labels]
    blended = (rgb.astype(np.float32) * (1 - alpha) + vis.astype(np.float32) * alpha).astype(np.uint8)
    return Image.fromarray(blended)

def bbox_for_class(labels: np.ndarray, class_idx: int):
    mask = labels == class_idx
    if not mask.any():
        return None
    rows = np.any(mask, axis=1)
    cols = np.any(mask, axis=0)
    y0, y1 = np.where(rows)[0][[0, -1]]
    x0, x1 = np.where(cols)[0][[0, -1]]
    return [int(x0), int(y0), int(x1), int(y1)]
