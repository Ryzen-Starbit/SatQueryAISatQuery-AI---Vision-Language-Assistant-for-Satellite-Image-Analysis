document.addEventListener("DOMContentLoaded", () => {
  SatQuerySession.requireAuth();
  const state = {
    source: null,        // "upload" | "dataset"
    mode: null,           // "single" | "bitemporal" | "opt_sar"
    imageType: null,       // "optical" | "sar"  (only for mode === "single")
    files: {},             // slotKey -> { name, size, previewUrl }
    dataset: null,          // selected dataset object (source === "dataset")
    location: null,          // { lat, lon, label }
    dates: {},                // slotKey -> "YYYY-MM-DD"
    query: "",
  };

  const STEP_ORDER = ["source", "configure", "location", "query"];
  let currentStep = "source";
  const MOCK_PLACES = {
    pune: { lat: 18.5204, lon: 73.8567, label: "Pune, Maharashtra" },
    mumbai: { lat: 19.076, lon: 72.8777, label: "Mumbai, Maharashtra" },
    ahmedabad: { lat: 23.0225, lon: 72.5714, label: "Ahmedabad, Gujarat" },
    nagpur: { lat: 21.1458, lon: 79.0882, label: "Nagpur, Maharashtra" },
    ratnagiri: { lat: 16.9902, lon: 73.312, label: "Ratnagiri, Maharashtra" },
    delhi: { lat: 28.7041, lon: 77.1025, label: "New Delhi, Delhi" },
    kosi: { lat: 25.9, lon: 86.7, label: "Kosi River Basin, Bihar" },
    bihar: { lat: 25.9, lon: 86.7, label: "Kosi River Basin, Bihar" },
  };
  function goToStep(step) {
    currentStep = step;
    document.querySelectorAll(".wizard-panel").forEach((p) => {
      p.classList.toggle("active", p.dataset.panel === step);
    });
    document.querySelectorAll(".wizard-step").forEach((s) => {
      const idx = STEP_ORDER.indexOf(s.dataset.step);
      const curIdx = STEP_ORDER.indexOf(step);
      s.classList.remove("done", "active");
      if (idx < curIdx) s.classList.add("done");
      else if (idx === curIdx) s.classList.add("active");
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (step === "location") {
      ensurePickerMap();
    }
    if (step === "query") {
      renderReviewSummary();
    }
  }

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => goToStep(btn.dataset.back));
  });

  const toConfigureBtn = document.getElementById("to-configure-btn");
  document.querySelectorAll("[data-source]").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll("[data-source]").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.source = card.dataset.source;
      toConfigureBtn.disabled = false;
    });
  });
  toConfigureBtn.addEventListener("click", () => {
    applySourceVisibility();
    goToStep("configure");
  });

  const urlParams = new URLSearchParams(window.location.search);
  const preselect = urlParams.get("source");
  if (preselect === "upload" || preselect === "dataset") {
    state.source = preselect;
    const card = document.querySelector(`[data-source="${preselect}"]`);
    if (card) card.classList.add("selected");
    toConfigureBtn.disabled = false;
  }
  function applySourceVisibility() {
    const modeCardsPanel = document.querySelectorAll(".mode-card[data-mode]")[0].closest(".sq-panel");
    const uploadPanel = document.getElementById("upload-panel");
    const datasetPanel = document.getElementById("dataset-panel");
    if (state.source === "upload") {
      modeCardsPanel.classList.remove("d-none");
      uploadPanel.classList.remove("d-none");
      datasetPanel.classList.add("d-none");
      renderUploadSlots();
    } else {
      modeCardsPanel.classList.add("d-none");
      document.getElementById("image-type-panel").classList.add("d-none");
      uploadPanel.classList.add("d-none");
      datasetPanel.classList.remove("d-none");
      loadDatasets();
    }
  }
  document.querySelectorAll("[data-mode]").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll("[data-mode]").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.mode = card.dataset.mode;
      state.files = {};
      state.imageType = null;
      const imageTypePanel = document.getElementById("image-type-panel");
      if (state.mode === "single") {
        imageTypePanel.classList.remove("d-none");
      } else {
        imageTypePanel.classList.add("d-none");
      }
      renderUploadSlots();
    });
  });
  document.querySelectorAll("[data-imgtype]").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll("[data-imgtype]").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.imageType = card.dataset.imgtype;
      renderUploadSlots();
    });
  });

  function slotsForMode() {
    if (state.mode === "single") {
      return [{ key: "single", label: state.imageType === "sar" ? "SAR Image" : "Optical / Multispectral Image" }];
    }
    if (state.mode === "bitemporal") {
      return [
        { key: "imageA", label: "Image A (Before)" },
        { key: "imageB", label: "Image B (After)" },
      ];
    }
    if (state.mode === "opt_sar") {
      return [
        { key: "optical", label: "Optical / Multispectral Image" },
        { key: "sar", label: "SAR Image" },
      ];
    }
    return [];
  }

  function renderUploadSlots() {
    const container = document.getElementById("upload-slots");
    container.innerHTML = "";
    if (!state.mode) {
      container.innerHTML = '<div class="col-12 text-muted small">Select an analysis mode above to continue.</div>';
      return;
    }
    if (state.mode === "single" && !state.imageType) {
      container.innerHTML = '<div class="col-12 text-muted small">Select an image type above to continue.</div>';
      return;
    }
    const slots = slotsForMode();
    const colClass = slots.length === 1 ? "col-12" : "col-md-6";
    slots.forEach((slot) => {
      const col = document.createElement("div");
      col.className = colClass;
      col.innerHTML = buildDropzoneHTML(slot);
      container.appendChild(col);
      wireDropzone(slot.key);
    });
  }

  function buildDropzoneHTML(slot) {
    const existing = state.files[slot.key];
    return `
      <span class="field-label">${slot.label}</span>
      <div class="dropzone" id="dz-${slot.key}" tabindex="0" role="button" aria-label="Upload ${slot.label}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
        <div class="dz-title">Drag &amp; drop, or click to browse</div>
        <div class="dz-sub">Supported remote-sensing formats: GeoTIFF / TIFF</div>
        <input type="file" id="input-${slot.key}" class="d-none" accept=".tif,.tiff,.png,.jpg,.jpeg" />
      </div>
      <div id="chip-${slot.key}">${existing ? fileChipHTML(slot.key, existing) : ""}</div>
    `;
  }

  function fileChipHTML(key, file) {
    const sizeKb = (file.size / 1024).toFixed(0);
    return `
      <div class="file-chip">
        <div class="fi">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/></svg>
        </div>
        <div class="flex-grow-1" style="min-width:0;">
          <div class="fname">${file.name}</div>
          <div class="fmeta">${sizeKb} KB · ready</div>
        </div>
        <button type="button" class="remove-file" data-remove="${key}" aria-label="Remove file">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
    `;
  }

  function wireDropzone(key) {
    const dz = document.getElementById(`dz-${key}`);
    const input = document.getElementById(`input-${key}`);
    if (!dz || !input) return;

    dz.addEventListener("click", () => input.click());
    dz.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("dragover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));
    dz.addEventListener("drop", (e) => {
      e.preventDefault();
      dz.classList.remove("dragover");
      if (e.dataTransfer.files.length) handleFile(key, e.dataTransfer.files[0]);
    });
    input.addEventListener("change", () => {
      if (input.files.length) handleFile(key, input.files[0]);
    });
  }

  async function handleFile(key, file) {
    const validExt = /\.(tif|tiff|png|jpe?g)$/i.test(file.name);
    if (!validExt) {
      SatQueryToast.show("Unsupported file format. Please upload a GeoTIFF or TIFF image.", "error");
      return;
    }
    if (/\.(png|jpe?g)$/i.test(file.name)) {
      SatQueryToast.show("PNG/JPEG accepted for demo purposes only — use GeoTIFF/TIFF for real geospatial analysis.", "error", 6000);
    }
    try {
      const uploaded = await SatQueryAPI.uploadImage(file);
      state.files[key] = uploaded;
      const chip = document.getElementById(`chip-${key}`);
      if (chip) chip.innerHTML = fileChipHTML(key, uploaded);
      wireRemoveButtons();
    } catch (err) {
      SatQueryToast.show("Upload failed. Please try again.", "error");
    }
  }

  function wireRemoveButtons() {
    document.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.onclick = () => {
        const key = btn.dataset.remove;
        delete state.files[key];
        const chip = document.getElementById(`chip-${key}`);
        if (chip) chip.innerHTML = "";
      };
    });
  }

  async function loadDatasets() {
    const grid = document.getElementById("dataset-grid");
    grid.innerHTML = '<div class="col-12 text-center text-muted py-4">Loading datasets…</div>';
    try {
      const datasets = await SatQueryAPI.getDatasets();
      grid.innerHTML = "";
      datasets.forEach((ds) => {
        const col = document.createElement("div");
        col.className = "col-md-4 col-sm-6";
        col.innerHTML = `
          <div class="dataset-card" data-dataset-id="${ds.id}">
            <img src="${ds.thumbnail}" alt="">
            <div class="dc-body">
              <h4>${ds.name}</h4>
              <div class="dc-meta">${labelForImageType(ds.image_type)} · ${ds.acquisition_date}</div>
              <p class="desc">${ds.description}</p>
              <button type="button" class="btn-sq-secondary mt-2 w-100" data-use-dataset="${ds.id}">Use This Dataset</button>
            </div>
          </div>
        `;
        grid.appendChild(col);
      });
      grid.querySelectorAll("[data-use-dataset]").forEach((btn) => {
        btn.addEventListener("click", () => selectDataset(datasets.find((d) => d.id === btn.dataset.useDataset)));
      });
    } catch (err) {
      grid.innerHTML = '<div class="col-12"><div class="state-panel">Could not load datasets. Please try again.</div></div>';
    }
  }

  function labelForImageType(t) {
    return { optical: "Optical / Multispectral", sar: "SAR", bitemporal: "Bi-Temporal Pair", opt_sar: "Optical + SAR" }[t] || t;
  }

  function selectDataset(ds) {
    if (!ds) return;
    state.dataset = ds;
    state.mode = ds.image_type;
    state.location = { lat: ds.lat, lon: ds.lon, label: ds.location };
    document.querySelectorAll(".dataset-card").forEach((c) => c.classList.toggle("selected", c.dataset.datasetId === ds.id));
  }

  // ---- Continue from configure step ----
  document.getElementById("to-location-btn").addEventListener("click", () => {
    const err = document.getElementById("configure-error");
    if (!validateConfigure()) {
      err.classList.add("show");
      return;
    }
    err.classList.remove("show");
    renderTimestampFields();
    goToStep("location");
  });

  function validateConfigure() {
    if (state.source === "dataset") return !!state.dataset;
    if (!state.mode) return false;
    if (state.mode === "single" && !state.imageType) return false;
    return slotsForMode().every((s) => !!state.files[s.key]);
  }

  let pickerMapHandle = null;
  function ensurePickerMap() {
    if (pickerMapHandle) {
      setTimeout(() => pickerMapHandle.map.invalidateSize(), 150);
      return;
    }
    pickerMapHandle = SatQueryMap.createPickerMap(
      "picker-map",
      ({ lat, lon }) => {
        document.getElementById("lat-input").value = lat.toFixed(4);
        document.getElementById("lon-input").value = lon.toFixed(4);
        state.location = { lat, lon, label: state.location?.label || "Custom point" };
      },
      state.location
    );
    if (state.location) {
      document.getElementById("lat-input").value = state.location.lat.toFixed(4);
      document.getElementById("lon-input").value = state.location.lon.toFixed(4);
      document.getElementById("location-search").value = state.location.label || "";
    }
  }

  document.getElementById("location-search-btn").addEventListener("click", runLocationSearch);
  document.getElementById("location-search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); runLocationSearch(); }
  });

  function runLocationSearch() {
    const q = document.getElementById("location-search").value.trim().toLowerCase();
    const match = Object.keys(MOCK_PLACES).find((k) => q.includes(k));
    if (!match) {
      SatQueryToast.show("Location not found in the demo geocoder. Enter coordinates manually or click the map.", "error");
      return;
    }
    const place = MOCK_PLACES[match];
    state.location = { ...place };
    document.getElementById("lat-input").value = place.lat.toFixed(4);
    document.getElementById("lon-input").value = place.lon.toFixed(4);
    if (pickerMapHandle) pickerMapHandle.setPoint(place.lat, place.lon);
  }

  ["lat-input", "lon-input"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      const lat = parseFloat(document.getElementById("lat-input").value);
      const lon = parseFloat(document.getElementById("lon-input").value);
      if (!isNaN(lat) && !isNaN(lon)) {
        state.location = { lat, lon, label: state.location?.label || document.getElementById("location-search").value || "Custom point" };
        if (pickerMapHandle) pickerMapHandle.setPoint(lat, lon);
      }
    });
  });

  function renderTimestampFields() {
    const body = document.getElementById("timestamp-body");
    if (state.mode === "bitemporal") {
      body.innerHTML = `
        <div class="mb-3">
          <span class="badge-sq badge-slate mb-1 d-inline-block">BEFORE</span>
          <label class="field-label" for="date-imageA">Image A date</label>
          <input type="date" id="date-imageA" class="sq-input" value="${state.dates.imageA || ""}">
        </div>
        <div>
          <span class="badge-sq badge-slate mb-1 d-inline-block">AFTER</span>
          <label class="field-label" for="date-imageB">Image B date</label>
          <input type="date" id="date-imageB" class="sq-input" value="${state.dates.imageB || ""}">
        </div>
      `;
      document.getElementById("date-imageA").addEventListener("change", (e) => (state.dates.imageA = e.target.value));
      document.getElementById("date-imageB").addEventListener("change", (e) => (state.dates.imageB = e.target.value));
    } else if (state.mode === "opt_sar") {
      body.innerHTML = `
        <div class="mb-3">
          <label class="field-label" for="date-optical">Optical image date</label>
          <input type="date" id="date-optical" class="sq-input" value="${state.dates.optical || ""}">
        </div>
        <div>
          <label class="field-label" for="date-sar">SAR image date</label>
          <input type="date" id="date-sar" class="sq-input" value="${state.dates.sar || ""}">
        </div>
      `;
      document.getElementById("date-optical").addEventListener("change", (e) => (state.dates.optical = e.target.value));
      document.getElementById("date-sar").addEventListener("change", (e) => (state.dates.sar = e.target.value));
    } else {
      body.innerHTML = `
        <div class="mb-3">
          <label class="field-label" for="date-single">Acquisition date</label>
          <input type="date" id="date-single" class="sq-input" value="${state.dates.single || ""}">
        </div>
        <div>
          <label class="field-label" for="time-single">Acquisition time (optional)</label>
          <input type="time" id="time-single" class="sq-input" value="${state.dates.singleTime || ""}">
        </div>
      `;
      document.getElementById("date-single").addEventListener("change", (e) => (state.dates.single = e.target.value));
      document.getElementById("time-single").addEventListener("change", (e) => (state.dates.singleTime = e.target.value));
    }
  }

  document.getElementById("to-query-btn").addEventListener("click", () => {
    const err = document.getElementById("location-error");
    if (!validateLocation()) {
      err.classList.add("show");
      return;
    }
    err.classList.remove("show");
    renderExampleChips();
    goToStep("query");
  });

  function validateLocation() {
    if (!state.location) return false;
    if (state.mode === "bitemporal") return !!(state.dates.imageA && state.dates.imageB);
    if (state.mode === "opt_sar") return !!(state.dates.optical && state.dates.sar);
    return !!state.dates.single;
  }

  const EXAMPLE_QUERIES = [
    "Describe the land-cover and major objects visible in this image.",
    "What changed between these two dates, and where did the change occur?",
    "Highlight the water body referred to in the query.",
    "Use the optical and SAR images together to identify built-up and water-covered regions.",
    "Has the built-up area increased, decreased, or remained unchanged?",
  ];

  const QUERIES_BY_MODE = {
    optical: [0, 2],
    sar: [0, 2],
    bitemporal: [1, 4],
    opt_sar: [3],
  };

  function effectiveMode() {
    return state.mode === "single" ? state.imageType : state.mode;
  }

  function renderExampleChips() {
    const wrap = document.getElementById("example-chips");
    wrap.innerHTML = "";
    const indices = QUERIES_BY_MODE[effectiveMode()] || EXAMPLE_QUERIES.map((_, i) => i);
    indices.forEach((i) => {
      const q = EXAMPLE_QUERIES[i];
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "example-chip";
      chip.textContent = q;
      chip.addEventListener("click", () => {
        document.getElementById("query-input").value = q;
        state.query = q;
      });
      wrap.appendChild(chip);
    });
  }

  document.getElementById("query-input").addEventListener("input", (e) => {
    state.query = e.target.value;
  });

  function renderReviewSummary() {
    const el = document.getElementById("review-summary");
    const rows = [];
    rows.push(["Data source", state.source === "upload" ? "User-uploaded imagery" : "Example dataset"]);
    if (state.dataset) rows.push(["Dataset", state.dataset.name]);
    rows.push(["Analysis mode", labelForImageType(state.mode)]);
    if (state.mode === "single") rows.push(["Image type", state.imageType === "sar" ? "SAR" : "Optical / Multispectral"]);
    rows.push(["Location", state.location ? `${state.location.label} (${state.location.lat.toFixed(3)}, ${state.location.lon.toFixed(3)})` : "—"]);
    if (state.mode === "bitemporal") rows.push(["Dates", `${state.dates.imageA || "—"} → ${state.dates.imageB || "—"}`]);
    else if (state.mode === "opt_sar") rows.push(["Dates", `Optical ${state.dates.optical || "—"} · SAR ${state.dates.sar || "—"}`]);
    else rows.push(["Date", state.dates.single || "—"]);

    el.innerHTML = rows
      .map(([k, v]) => `<div class="exec-summary-row"><div class="k">${k}</div><div class="v">${v}</div></div>`)
      .join("");
  }

  // -------------------------------------------------------------------
  // ANALYZE + PROCESSING SCREEN
  // -------------------------------------------------------------------
  document.getElementById("analyze-btn").addEventListener("click", async () => {
    const errEl = document.getElementById("query-error");
    if (!state.query || !state.query.trim()) {
      errEl.classList.add("show");
      return;
    }
    errEl.classList.remove("show");

    document.getElementById("wizard-view").classList.add("d-none");
    document.getElementById("processing-view").classList.remove("d-none");

    try {
      const normalizedMode = state.mode === "single" ? state.imageType : state.mode;
      const config = {
        mode: normalizedMode,
        source: state.source,
        imageType: state.imageType,
        files: state.files,
        dataset: state.dataset,
        location: state.location,
        dates: state.dates,
        query: state.query,
      };
      const { analysis_id } = await SatQueryAPI.analyzeImagery(config);
      await runProcessingSequence(analysis_id);
      window.location.href = `results.html?id=${encodeURIComponent(analysis_id)}`;
    } catch (err) {
      document.getElementById("processing-view").classList.add("d-none");
      document.getElementById("wizard-view").classList.remove("d-none");
      SatQueryToast.show("Analysis could not be completed. Please verify the uploaded imagery and try again.", "error");
    }
  });

  async function runProcessingSequence(analysisId) {
    const container = document.getElementById("exec-steps");
    let stepIndex = 0;
    let complete = false;
    while (!complete) {
      const status = await SatQueryAPI.getAnalysisStatus(analysisId, stepIndex);
      renderExecSteps(container, status.steps);
      complete = status.complete;
      stepIndex += 1;
    }
  }

  function renderExecSteps(container, steps) {
    container.innerHTML = steps
      .map((s) => {
        const cls = s.status === "done" ? "done" : s.status === "active" ? "active" : "pending";
        let markerInner = "";
        if (s.status === "done") {
          markerInner = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
        } else if (s.status === "active") {
          markerInner = '<span class="pulse"></span>';
        }
        return `
          <div class="exec-step ${cls}">
            <div class="marker">${markerInner}</div>
            <div>
              <div class="label">${s.label}</div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  if (state.source) {
    applySourceVisibility();
  }
  goToStep("source");
});