CLASS_LABEL = {
    "water": "water bodies",
    "vegetation": "vegetation",
    "built_up": "built-up structures",
    "bare_land": "bare/exposed land",
}

KEYWORDS = {
    "water": "water", "river": "water", "flood": "water", "lake": "water",
    "sea": "water", "coast": "water", "inundat": "water",
    "built": "built_up", "urban": "built_up", "building": "built_up",
    "city": "built_up", "structure": "built_up", "settlement": "built_up",
    "vegetation": "vegetation", "forest": "vegetation", "tree": "vegetation",
    "crop": "vegetation", "green": "vegetation", "agricult": "vegetation",
    "bare": "bare_land", "barren": "bare_land", "soil": "bare_land", "sand": "bare_land",
}

def find_target_class(query: str):
    q = (query or "").lower()
    for kw, cls in KEYWORDS.items():
        if kw in q:
            return cls
    return None

def _sorted_classes(pct: dict):
    return sorted(pct.items(), key=lambda kv: kv[1], reverse=True)

def build_single_answer(mode: str, pct: dict, query: str, target_class):
    ordered = _sorted_classes(pct)
    dominant, dom_pct = ordered[0]
    parts = [f"{CLASS_LABEL[name]} ({p*100:.0f}%)" for name, p in ordered if p > 0.04]
    modality_note = "SAR backscatter analysis" if mode == "sar" else "optical land-cover analysis"
    answer = f"Based on {modality_note}, the scene is dominated by {CLASS_LABEL[dominant]} ({dom_pct*100:.0f}%)."
    if len(parts) > 1:
        answer += " Other visible cover includes " + ", ".join(parts[1:]) + "."
    if target_class and pct.get(target_class, 0) > 0.01:
        answer = (
            f"Highlighting {CLASS_LABEL[target_class]} as requested: it covers approximately "
            f"{pct[target_class]*100:.0f}% of the scene. "
        ) + answer
    elif target_class:
        answer = f"No significant {CLASS_LABEL[target_class]} was detected in this scene. " + answer
    summary = [f"{CLASS_LABEL[name]} covers approximately {p*100:.0f}% of the scene." for name, p in ordered if p > 0.03]
    summary.append("No cross-referenced anomalies were detected outside the classified regions.")
    confidence = min(0.95, max(0.55, 0.55 + 0.4 * dom_pct))
    return answer, summary, confidence

def build_bitemporal_answer(pct_a: dict, pct_b: dict, query: str):
    deltas = {k: pct_b[k] - pct_a[k] for k in pct_a}
    built_delta = deltas["built_up"]
    threshold = 0.03 
    if built_delta > threshold:
        direction = "increased"
    elif built_delta < -threshold:
        direction = "decreased"
    else:
        direction = "remained largely unchanged"
    answer = f"Built-up area {direction} between the two observations"
    answer += f", changing by approximately {abs(built_delta)*100:.1f} percentage points." if abs(built_delta) > 0.005 else "."
    ranked = sorted(deltas.items(), key=lambda kv: abs(kv[1]), reverse=True)
    summary = []
    for name, d in ranked:
        if abs(d) < 0.01:
            continue
        dirword = "increased" if d > 0 else "decreased"
        summary.append(f"{CLASS_LABEL[name]} {dirword} by {abs(d)*100:.1f} percentage points.")
    if not summary:
        summary.append("No significant land-cover changes were detected between the two dates.")
    alerts = []
    if abs(built_delta) >= threshold:
        alerts.append({
            "type": "Significant Built-up Change Detected",
            "description": (
                f"Built-up area {direction} by {abs(built_delta)*100:.1f} percentage points, "
                f"exceeding the configured change threshold ({threshold*100:.0f}%)."
            ),
            "severity": "high" if abs(built_delta) > 2 * threshold else "medium",
            "confidence": round(min(0.95, 0.6 + abs(built_delta) * 2), 2),
        })
    confidence = min(0.93, max(0.6, 0.65 + abs(built_delta)))
    return answer, summary, alerts, confidence

def build_optsar_answer(pct_opt: dict, pct_sar: dict, query: str):
    built_diff = abs(pct_opt["built_up"] - pct_sar["built_up"])
    agreement = max(0.0, 1 - built_diff)
    answer = (
        f"Combining optical and SAR evidence, built-up regions cover approximately "
        f"{pct_opt['built_up']*100:.0f}% in the optical image and {pct_sar['built_up']*100:.0f}% in the SAR image "
        f"({agreement*100:.0f}% cross-modal agreement)."
    )
    if pct_sar["water"] > 0.03 or pct_opt["water"] > 0.03:
        answer += f" A water body is visible, covering approximately {max(pct_opt['water'], pct_sar['water'])*100:.0f}% of the scene."
    summary = [
        f"Optical imagery shows built-up structures covering {pct_opt['built_up']*100:.0f}% of the scene.",
        f"SAR imagery shows built-up/rough-return regions covering {pct_sar['built_up']*100:.0f}% of the scene.",
        f"Cross-modal agreement on built-up extent is approximately {agreement*100:.0f}%.",
    ]
    alerts = []
    if built_diff > 0.15:
        alerts.append({
            "type": "Cross-Modal Disagreement",
            "description": f"Optical and SAR estimates of built-up extent differ by {built_diff*100:.0f} percentage points.",
            "severity": "medium",
            "confidence": 0.6,
        })
    confidence = min(0.92, max(0.55, 0.85 - built_diff))
    return answer, summary, alerts, confidence
