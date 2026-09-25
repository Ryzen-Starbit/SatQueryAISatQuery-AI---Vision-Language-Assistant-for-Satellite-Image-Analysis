import os
from PIL import ImageDraw
OUTPUT_DIR = "static/outputs"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def save_image(img, analysis_id: str, name: str) -> str:
    folder = os.path.join(OUTPUT_DIR, analysis_id)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, f"{name}.png")
    img.save(path)
    return path

def draw_bbox(img, bbox, color=(255, 60, 60)):
    if not bbox:
        return img
    img = img.copy()
    draw = ImageDraw.Draw(img)
    x0, y0, x1, y1 = bbox
    draw.rectangle([x0, y0, x1, y1], outline=color, width=3)
    return img
