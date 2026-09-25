JOBS = {}      
UPLOADS = {}   

def new_job(analysis_id: str, total_steps: int):
    JOBS[analysis_id] = {
        "step_index": 0,
        "total_steps": total_steps,
        "complete": False,
        "result": None,
        "error": None,
    }

def set_step(analysis_id: str, idx: int):
    if analysis_id in JOBS:
        JOBS[analysis_id]["step_index"] = idx

def finish_job(analysis_id: str, result: dict):
    job = JOBS.get(analysis_id)
    if job is None:
        return
    job["complete"] = True
    job["result"] = result
    job["step_index"] = job["total_steps"]

def fail_job(analysis_id: str, message: str):
    job = JOBS.get(analysis_id)
    if job is None:
        return
    job["complete"] = True
    job["error"] = message
