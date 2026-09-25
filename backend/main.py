import os
import shutil
import uuid
from typing import Any, Dict, Optional
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel
import config as cfg
import datasets as ds
import pipeline
import segmentation as seg
import store

app = FastAPI(title="SatQuery AI — Prototype Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)
os.makedirs("static/uploads", exist_ok=True)
os.makedirs("static/outputs", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

class AnalyzeRequest(BaseModel):
    mode: str
    source: str
    imageType: Optional[str] = None
    files: Dict[str, Any] = {}
    dataset: Optional[Dict[str, Any]] = None
    location: Optional[Dict[str, Any]] = None
    dates: Dict[str, Any] = {}
    query: str = ""

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/datasets")
def get_datasets():
    return ds.public_list()

@app.post("/images/upload")
async def upload_image(file: UploadFile = File(...)):
    upload_id = "upload-" + uuid.uuid4().hex[:10]
    ext = os.path.splitext(file.filename or "")[1] or ".bin"
    raw_path = f"static/uploads/{upload_id}{ext}"
    with open(raw_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    size = os.path.getsize(raw_path)
    preview_url = None
    try:
        rgb = seg.load_rgb(raw_path)
        preview_path = f"static/uploads/{upload_id}_preview.png"
        Image.fromarray(rgb).save(preview_path)
        preview_url = cfg.url_for(preview_path)
    except Exception:
        preview_url = None 
    store.UPLOADS[upload_id] = {"path": raw_path, "name": file.filename, "size": size}
    return {"id": upload_id, "name": file.filename, "size": size, "previewUrl": preview_url}

@app.post("/analyze")
def analyze(req: AnalyzeRequest, background_tasks: BackgroundTasks):
    analysis_id = "run-" + uuid.uuid4().hex[:10]
    background_tasks.add_task(pipeline.run_analysis, analysis_id, req.model_dump())
    return {"analysis_id": analysis_id}

@app.get("/analysis/{analysis_id}/status")
def get_status(analysis_id: str):
    job = store.JOBS.get(analysis_id)
    if not job:
        return {"steps": [{"label": l, "status": "pending"} for l in pipeline.STEP_LABELS], "complete": False}
    steps = []
    for i, label in enumerate(pipeline.STEP_LABELS):
        if job["complete"] or i < job["step_index"]:
            status = "done"
        elif i == job["step_index"]:
            status = "active"
        else:
            status = "pending"
        steps.append({"label": label, "status": status})
    return {"steps": steps, "complete": job["complete"]}

@app.get("/analysis/{analysis_id}")
def get_result(analysis_id: str):
    job = store.JOBS.get(analysis_id)
    if not job or not job["complete"]:
        raise HTTPException(status_code=409, detail="Analysis is still processing.")
    if job.get("error"):
        raise HTTPException(status_code=422, detail=job["error"])
    return job["result"]

@app.get("/stats")
def get_stats():
    completed = [j for j in store.JOBS.values() if j["complete"] and j.get("result")]
    alerts_flagged = sum(len(j["result"].get("alerts", [])) for j in completed)
    avg_confidence = (
        sum(j["result"].get("confidence", 0) for j in completed) / len(completed) if completed else 0.0
    )
    return {
        "analyses_run": len(completed),
        "datasets_available": len(ds.DATASETS),
        "alerts_flagged": alerts_flagged,
        "avg_confidence": round(avg_confidence, 2),
    }
