import time
import numpy as np
from PIL import Image
import config as cfg
import datasets as ds
import evidence as ev
import segmentation as seg
import store
import templates_engine as tpl

STEP_LABELS = [
    "Input Validation",
    "Query Understanding",
    "Task Identification",
    "Selecting Specialist Model",
    "Processing Imagery",
    "Generating Evidence",
    "Validating Results",
    "Preparing Response",
]
MODELS_BY_MODE = {
    "optical": ["Remote Sensing VQA Model", "Grounding Model"],
    "sar": ["SAR Scene Classification Model", "Remote Sensing VQA Model"],
    "bitemporal": ["Change Detection Model", "Remote Sensing VQA Model"],
    "opt_sar": ["Optical–SAR Fusion Model", "Grounding Model"],
}
TASK_BY_MODE = {"bitemporal": "change_vqa", "opt_sar": "cross_modal_vqa"}

TASK_LABELS = {
    "vqa": "Remote-Sensing Visual Question Answering",
    "change_vqa": "Change-based Visual Question Answering",
    "cross_modal_vqa": "Cross-Modal Optical–SAR Analysis",
}
INPUT_SUMMARY_BY_MODE = {
    "optical": "1 optical/multispectral image",
    "sar": "1 SAR image",
    "bitemporal": "2 images (bi-temporal pair)",
    "opt_sar": "2 co-registered images (optical + SAR)",
}

def _resolve_path(config, slot):
    entry = (config.get("files") or {}).get(slot)
    if not entry:
        return None
    upload = store.UPLOADS.get(entry.get("id"))
    return upload["path"] if upload else None

def _input_paths(config):
    mode = config["mode"]
    if config.get("source") == "dataset":
        dataset = ds.get_dataset((config.get("dataset") or {}).get("id"))
        if not dataset:
            raise ValueError("Unknown dataset selected.")
        return dataset["files"], dataset
    if mode in ("optical", "sar"):
        return {"single": _resolve_path(config, "single")}, None
    if mode == "bitemporal":
        return {"imageA": _resolve_path(config, "imageA"), "imageB": _resolve_path(config, "imageB")}, None
    if mode == "opt_sar":
        return {"optical": _resolve_path(config, "optical"), "sar": _resolve_path(config, "sar")}, None
    raise ValueError(f"Unsupported analysis mode: {mode}")

def run_analysis(analysis_id: str, config: dict):
    total = len(STEP_LABELS)
    store.new_job(analysis_id, total)
    try:
        mode = config["mode"]
        query = (config.get("query") or "").strip()
        store.set_step(analysis_id, 0)
        time.sleep(0.4)
        paths, dataset = _input_paths(config)
        for slot, path in paths.items():
            if not path:
                raise ValueError(f"Missing required image for '{slot}'.")
        store.set_step(analysis_id, 1)
        time.sleep(0.4)
        target_class = tpl.find_target_class(query)
        store.set_step(analysis_id, 2)
        time.sleep(0.3)
        task = TASK_BY_MODE.get(mode, "vqa")
        store.set_step(analysis_id, 3)
        time.sleep(0.3)
        models = MODELS_BY_MODE[mode]
        store.set_step(analysis_id, 4)
        time.sleep(0.6)
        warnings = []
        alerts = []
        bbox = None
        if mode in ("optical", "sar"):
            rgb = seg.load_rgb(paths["single"])
            labels, pct = seg.classify_optical(rgb) if mode == "optical" else seg.classify_sar(rgb)
            overlay = seg.colorize(rgb, labels)
            if target_class:
                bbox = seg.bbox_for_class(labels, seg.CLASS_NAMES.index(target_class))
                if bbox:
                    overlay = ev.draw_bbox(overlay, bbox)
            answer, summary, confidence = tpl.build_single_answer(mode, pct, query, target_class)
            land_cover = {k: round(v, 4) for k, v in pct.items()}
        elif mode == "bitemporal":
            rgb_a = seg.load_rgb(paths["imageA"])
            rgb_b = seg.load_rgb(paths["imageB"])
            if rgb_a.shape[:2] != rgb_b.shape[:2]:
                h = min(rgb_a.shape[0], rgb_b.shape[0])
                w = min(rgb_a.shape[1], rgb_b.shape[1])
                rgb_a = np.array(Image.fromarray(rgb_a).resize((w, h)))
                rgb_b = np.array(Image.fromarray(rgb_b).resize((w, h)))
                warnings.append("Images were resampled to a common grid before comparison (dimensions did not match).")
            labels_a, pct_a = seg.classify_optical(rgb_a)
            labels_b, pct_b = seg.classify_optical(rgb_b)
            overlay_a = seg.colorize(rgb_a, labels_a)
            overlay_b = seg.colorize(rgb_b, labels_b)
            change_mask = labels_a != labels_b
            change_arr = rgb_b.copy()
            red = np.array([230, 50, 50], dtype=np.uint8)
            change_arr[change_mask] = (0.35 * change_arr[change_mask] + 0.65 * red).astype(np.uint8)
            change_img = Image.fromarray(change_arr)
            answer, summary, mode_alerts, confidence = tpl.build_bitemporal_answer(pct_a, pct_b, query)
            alerts.extend(mode_alerts)
            land_cover = {
                "before": {k: round(v, 4) for k, v in pct_a.items()},
                "after": {k: round(v, 4) for k, v in pct_b.items()},
            }
        else:  
            rgb_opt = seg.load_rgb(paths["optical"])
            rgb_sar = seg.load_rgb(paths["sar"])
            labels_opt, pct_opt = seg.classify_optical(rgb_opt)
            labels_sar, pct_sar = seg.classify_sar(rgb_sar)
            overlay_opt = seg.colorize(rgb_opt, labels_opt)
            overlay_sar = seg.colorize(rgb_sar, labels_sar)
            h = min(overlay_opt.height, overlay_sar.height)
            w = min(overlay_opt.width, overlay_sar.width)
            fused = Image.blend(overlay_opt.resize((w, h)), overlay_sar.resize((w, h)), alpha=0.5)
            answer, summary, mode_alerts, confidence = tpl.build_optsar_answer(pct_opt, pct_sar, query)
            alerts.extend(mode_alerts)
            land_cover = {
                "optical": {k: round(v, 4) for k, v in pct_opt.items()},
                "sar": {k: round(v, 4) for k, v in pct_sar.items()},
            }
        store.set_step(analysis_id, 5)
        time.sleep(0.4)
        if mode in ("optical", "sar"):
            raw_p = ev.save_image(Image.fromarray(rgb), analysis_id, "raw")
            classified_p = ev.save_image(overlay, analysis_id, "image")
            evidence = {
                "raw_image": cfg.url_for(raw_p),
                "image": cfg.url_for(classified_p),
                "bounding_boxes": [bbox] if bbox else [],
            }
        elif mode == "bitemporal":
            before_p = ev.save_image(Image.fromarray(rgb_a), analysis_id, "before")
            after_p = ev.save_image(Image.fromarray(rgb_b), analysis_id, "after")
            before_c_p = ev.save_image(overlay_a, analysis_id, "before_classified")
            after_c_p = ev.save_image(overlay_b, analysis_id, "after_classified")
            change_p = ev.save_image(change_img, analysis_id, "change_map")
            evidence = {
                "before_image": cfg.url_for(before_p),
                "after_image": cfg.url_for(after_p),
                "before_classified": cfg.url_for(before_c_p),
                "after_classified": cfg.url_for(after_c_p),
                "change_map": cfg.url_for(change_p),
                "bounding_boxes": [],
            }
        else:
            opt_p = ev.save_image(Image.fromarray(rgb_opt), analysis_id, "optical")
            sar_p = ev.save_image(Image.fromarray(rgb_sar), analysis_id, "sar")
            fused_p = ev.save_image(fused, analysis_id, "fused")
            evidence = {
                "optical_image": cfg.url_for(opt_p),
                "sar_image": cfg.url_for(sar_p),
                "fused_image": cfg.url_for(fused_p),
                "bounding_boxes": [],
            }
        store.set_step(analysis_id, 6)
        time.sleep(0.3)
        for w in warnings:
            alerts.append({"type": "Input Validation Warning", "description": w, "severity": "low", "confidence": 0.5})
        store.set_step(analysis_id, 7)
        time.sleep(0.3)
        location = config.get("location") or {}
        if dataset:
            location = {"lat": dataset["lat"], "lon": dataset["lon"], "label": dataset["location"]}
        params = {"modality": {"optical": "optical", "sar": "sar", "bitemporal": "optical", "opt_sar": "optical+sar"}[mode]}
        if mode == "bitemporal":
            params["change_threshold"] = 0.03
        for k, v in (config.get("dates") or {}).items():
            if v:
                params[f"date_{k}"] = v
        if target_class:
            params["target_class"] = target_class.replace("_", " ")
        result = {
            "analysis_id": analysis_id,
            "task": task,
            "query": query or "Describe the land-cover and major objects visible in this image.",
            "confidence": round(float(confidence), 2),
            "location": {
                "latitude": location.get("lat"),
                "longitude": location.get("lon"),
                "label": location.get("label") or "Unknown location",
            },
            "execution": {
                "task": TASK_LABELS[task],
                "models": models,
                "status": "completed",
                "input_summary": INPUT_SUMMARY_BY_MODE[mode],
                "parameters": params,
            },
            "answer": answer,
            "summary": summary,
            "alerts": alerts,
            "evidence": evidence,
            "land_cover": land_cover,
        }
        store.finish_job(analysis_id, result)

    except Exception as exc:
        store.fail_job(analysis_id, str(exc))
