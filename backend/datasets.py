DATASETS = [
    {
        "id": "ds-urban-pune",
        "name": "Pune Urban Growth Corridor",
        "image_type": "bitemporal",
        "location": "Pune, Maharashtra",
        "lat": 18.5204,
        "lon": 73.8567,
        "acquisition_date": "2025-01-12 → 2026-01-12",
        "description": "A rapidly urbanising district on the northern edge of Pune, useful for demonstrating built-up change detection.",
        "thumbnail": "assets/images/dataset-urban-growth.jpg",
        "files": {"imageA": "static/datasets/demo_before.png", "imageB": "static/datasets/demo_after.png"},
    },
    {
        "id": "ds-flood-sar",
        "name": "Kosi Basin — SAR Flood Extent",
        "image_type": "sar",
        "location": "Kosi River Basin, Bihar",
        "lat": 25.9,
        "lon": 86.7,
        "acquisition_date": "2025-08-03",
        "description": "Single-date SAR acquisition over a flood-prone river basin. Suited to surface-water and inundation queries.",
        "thumbnail": "assets/images/dataset-flood-sar.jpg",
        "files": {"single": "static/datasets/demo-sar.jpg"},
    },
    {
        "id": "ds-coastal",
        "name": "Konkan Coastal Strip",
        "image_type": "optical",
        "location": "Ratnagiri, Maharashtra",
        "lat": 16.994,
        "lon": 73.3,
        "acquisition_date": "2025-11-20",
        "description": "Optical multispectral scene of a coastal strip with mixed vegetation and settlement, for general VQA and grounding demos.",
        "thumbnail": "assets/images/dataset-coastal.jpg",
        "files": {"single": "static/datasets/dataset-coastal.jpg"},
    },
    {
        "id": "ds-agri",
        "name": "Vidarbha Agricultural Belt",
        "image_type": "optical",
        "location": "Nagpur District, Maharashtra",
        "lat": 21.15,
        "lon": 79.09,
        "acquisition_date": "2025-09-05",
        "description": "Cropland-dominated optical scene, useful for land-cover description and vegetation-focused queries.",
        "thumbnail": "assets/images/dataset-agri.jpg",
        "files": {"single": "static/datasets/dataset-agri.jpg"},
    },
    {
        "id": "ds-optsar-fusion",
        "name": "Ahmedabad Co-registered Pair",
        "image_type": "opt_sar",
        "location": "Ahmedabad, Gujarat",
        "lat": 23.0225,
        "lon": 72.5714,
        "acquisition_date": "2025-10-02",
        "description": "Co-registered optical + SAR pair over a dense urban area, for cross-modal fusion queries.",
        "thumbnail": "assets/images/dataset-urban-growth.jpg",
        "files": {"optical": "static/datasets/demo-optical.jpg", "sar": "static/datasets/demo-sar.jpg"},
    },
]

def get_dataset(dataset_id):
    for d in DATASETS:
        if d["id"] == dataset_id:
            return d
    return None

def public_list():
    return [{k: v for k, v in d.items() if k != "files"} for d in DATASETS]
