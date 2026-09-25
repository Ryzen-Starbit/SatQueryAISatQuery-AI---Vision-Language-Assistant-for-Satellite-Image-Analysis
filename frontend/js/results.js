/**
 * results.js
 * ---------------------------------------------------------------------------
 * Loads a completed analysis (SatQueryAPI.getAnalysisResult) and renders the
 * results dashboard: summary, answer, findings, evidence, map, alerts,
 * confidence, and execution summary. Designed to gracefully handle missing
 * fields, since real backend responses may not always include everything.
 * ---------------------------------------------------------------------------
 */

document.addEventListener("DOMContentLoaded", async () => {
  SatQuerySession.requireAuth();

  // Colors match segmentation.py's VIS_COLORS exactly, so this legend also
  // explains the overlay/classified images (which otherwise have no key).
  const LC_COLORS = {
    water: "rgb(30,110,220)",
    vegetation: "rgb(40,170,70)",
    built_up: "rgb(220,90,60)",
    bare_land: "rgb(210,180,120)",
  };
  const LC_LABELS = {
    water: "Water",
    vegetation: "Vegetation",
    built_up: "Built-up",
    bare_land: "Bare / exposed land",
  };
  const LC_ORDER = ["water", "vegetation", "built_up", "bare_land"];
  let landCoverChart = null;

  const params = new URLSearchParams(window.location.search);
  const analysisId = params.get("id");

  const loadingState = document.getElementById("loading-state");
  const errorState = document.getElementById("error-state");
  const content = document.getElementById("content");

  document.getElementById("nav-datasets-link").addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "analysis.html?source=dataset";
  });
  document.getElementById("nav-history-link").addEventListener("click", (e) => e.preventDefault());

  if (!analysisId) {
    showError();
    return;
  }
  document.getElementById("crumb-id").textContent = `satquery-ai / results / ${analysisId}`;

  let result;
  try {
    result = await SatQueryAPI.getAnalysisResult(analysisId);
    if (!result) throw new Error("empty result");
  } catch (err) {
    showError();
    return;
  }

  renderResult(result);
  loadingState.classList.add("d-none");
  content.classList.remove("d-none");

  // ---- Download report ----
  document.getElementById("download-report-btn").addEventListener("click", async () => {
    try {
      const report = await SatQueryAPI.generateReport(result);
      SatQueryReport.openReport(report);
    } catch (err) {
      SatQueryToast.show("Report generation failed. Please try again.", "error");
    }
  });

  // -------------------------------------------------------------------
  function showError() {
    loadingState.classList.add("d-none");
    errorState.classList.remove("d-none");
  }

  function taskLabel(task) {
    return (
      {
        change_vqa: "Bi-Temporal Change Analysis",
        cross_modal_vqa: "Optical + SAR Cross-Modal Analysis",
        vqa: "Visual Question Answering",
      }[task] || task || "Analysis"
    );
  }

  function renderResult(r) {
    document.getElementById("task-badge").textContent = taskLabel(r.task);

    // A. Analysis summary ------------------------------------------------
    const summaryRows = [
      ["Location", r.location?.label || (r.location ? `${r.location.latitude?.toFixed(3)}, ${r.location.longitude?.toFixed(3)}` : "Not available")],
      ["Coordinates", r.location ? `${fmtCoord(r.location.latitude)}, ${fmtCoord(r.location.longitude)}` : "—"],
      ["Analysis type", taskLabel(r.task)],
      ["Query", r.query || "—"],
    ];
    document.getElementById("summary-body").innerHTML = summaryRows
      .map(([k, v]) => `<div class="exec-summary-row"><div class="k">${k}</div><div class="v">${escapeHtml(v)}</div></div>`)
      .join("");

    // AI Answer ------------------------------------------------------------
    document.getElementById("answer-text").textContent = r.answer || "No answer was returned for this analysis.";

    // Key findings ---------------------------------------------------------
    const findingsBody = document.getElementById("findings-body");
    if (Array.isArray(r.summary) && r.summary.length) {
      findingsBody.innerHTML = r.summary
        .map((s) => `<div class="finding-item"><span class="bullet">●</span><span>${escapeHtml(s)}</span></div>`)
        .join("");
    } else {
      findingsBody.innerHTML = emptyState("No key findings were returned for this analysis.");
    }

    // Confidence -------------------------------------------------------------
    if (typeof r.confidence === "number") {
      const pct = Math.round(r.confidence * 100);
      document.getElementById("confidence-value").textContent = `${pct}%`;
      const fill = document.getElementById("confidence-fill");
      fill.style.width = `${pct}%`;
      fill.classList.toggle("low", pct < 60);
    } else {
      document.getElementById("confidence-value").textContent = "N/A";
      document.getElementById("confidence-note").textContent = "not provided by backend";
    }

    // Visual evidence -----------------------------------------------------
    renderEvidence(r);

    // Land-cover breakdown chart -------------------------------------------
    renderLandCoverChart(r);

    // Map -------------------------------------------------------------------
    if (r.location) {
      document.getElementById("map-coords").textContent = `${fmtCoord(r.location.latitude)}, ${fmtCoord(r.location.longitude)}`;
      SatQueryMap.createResultMap("results-map", {
        lat: r.location.latitude,
        lon: r.location.longitude,
        label: r.location.label || "Analysis location",
      });
    } else {
      document.getElementById("results-map").outerHTML = emptyState("No location data available for this analysis.");
    }

    // Alerts -------------------------------------------------------------
    const alertsBody = document.getElementById("alerts-body");
    const alerts = Array.isArray(r.alerts) ? r.alerts : [];
    document.getElementById("alerts-count").textContent = alerts.length;
    if (alerts.length) {
      alertsBody.innerHTML = alerts
        .map(
          (a) => `
        <div class="alert-card ${a.severity === "high" ? "severity-high" : ""}">
          <div class="ai">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
          </div>
          <div>
            <div class="at">${escapeHtml(a.type || "Alert")}</div>
            <div class="ad">${escapeHtml(a.description || "")}</div>
            ${typeof a.confidence === "number" ? `<div class="ad mt-1">Confidence: ${Math.round(a.confidence * 100)}%</div>` : ""}
          </div>
        </div>`
        )
        .join("");
    } else {
      alertsBody.innerHTML = emptyState("No alerts were flagged for this analysis.");
    }

    // Execution summary ------------------------------------------------------
    const exec = r.execution || {};
    const execRows = [
      ["Task", exec.task || taskLabel(r.task)],
      ["Models / tools", Array.isArray(exec.models) ? exec.models.join(", ") : "—"],
      ["Input", exec.input_summary || "—"],
      ["Status", exec.status || "—"],
    ];
    if (exec.parameters) {
      Object.entries(exec.parameters).forEach(([k, v]) => {
        if (v !== undefined) execRows.push([k.replace(/_/g, " "), String(v)]);
      });
    }
    document.getElementById("exec-summary-body").innerHTML = execRows
      .map(([k, v]) => `<div class="exec-summary-row"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`)
      .join("");

    const execToggle = document.getElementById("exec-toggle");
    const execBody = document.getElementById("exec-summary-body");
    const execLabel = document.getElementById("exec-toggle-label");
    execToggle.addEventListener("click", () => {
      const hidden = execBody.classList.toggle("d-none");
      execLabel.textContent = hidden ? "Show details ▾" : "Hide details ▴";
    });
  }

  function renderLegend() {
    document.getElementById("lc-legend").innerHTML = LC_ORDER.map(
      (k) => `<span class="sw"><span class="dot" style="background:${LC_COLORS[k]};"></span>${LC_LABELS[k]}</span>`
    ).join("");
  }

  function renderLandCoverChart(r) {
    const panel = document.getElementById("landcover-panel");
    const canvas = document.getElementById("landcover-chart");
    const lc = r.land_cover;
    if (!lc) {
      panel.classList.add("d-none");
      return;
    }
    panel.classList.remove("d-none");
    renderLegend();

    if (landCoverChart) {
      landCoverChart.destroy();
      landCoverChart = null;
    }
    if (typeof Chart === "undefined") return; // CDN blocked/offline — chart just won't render

    const labels = LC_ORDER.map((k) => LC_LABELS[k]);
    let datasets;

    if (lc.before && lc.after) {
      datasets = [
        { label: "Before", data: LC_ORDER.map((k) => +(lc.before[k] * 100).toFixed(1)), backgroundColor: "rgba(124,136,148,0.55)" },
        { label: "After", data: LC_ORDER.map((k) => +(lc.after[k] * 100).toFixed(1)), backgroundColor: LC_ORDER.map((k) => LC_COLORS[k]) },
      ];
    } else if (lc.optical && lc.sar) {
      datasets = [
        { label: "Optical", data: LC_ORDER.map((k) => +(lc.optical[k] * 100).toFixed(1)), backgroundColor: "rgba(124,136,148,0.55)" },
        { label: "SAR", data: LC_ORDER.map((k) => +(lc.sar[k] * 100).toFixed(1)), backgroundColor: LC_ORDER.map((k) => LC_COLORS[k]) },
      ];
    } else {
      datasets = [{ label: "Coverage", data: LC_ORDER.map((k) => +(lc[k] * 100).toFixed(1)), backgroundColor: LC_ORDER.map((k) => LC_COLORS[k]) }];
    }

    landCoverChart = new Chart(canvas, {
      type: "bar",
      data: { labels, datasets },
      options: {
        indexAxis: "y",
        responsive: true,
        plugins: {
          legend: { display: datasets.length > 1, position: "top", labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x}%` } },
        },
        scales: {
          x: { min: 0, max: 100, ticks: { callback: (v) => v + "%" } },
        },
      },
    });
  }

  function renderEvidence(r) {
    const body = document.getElementById("evidence-body");
    const ev = r.evidence || {};

    if (ev.before_image && ev.after_image) {
      const hasClassified = ev.before_classified && ev.after_classified;
      // Bi-temporal: tabs for side-by-side vs slider, plus change map.
      body.innerHTML = `
        ${hasClassified ? `
        <div class="ev-toggle" id="ev-view-toggle">
          <button type="button" class="active" data-view="raw">Raw</button>
          <button type="button" data-view="classified">Classified</button>
        </div>` : ""}
        <div class="evidence-tabs">
          <button class="evidence-tab active" data-tab="slider">Slider Comparison</button>
          <button class="evidence-tab" data-tab="sidebyside">Side-by-Side</button>
          <button class="evidence-tab" data-tab="changemap">Change Map</button>
        </div>
        <div data-tabpanel="slider">
          <div class="compare-slider" id="compare-slider">
            <img src="${ev.before_image}" data-raw="${ev.before_image}" data-classified="${ev.before_classified || ev.before_image}" alt="Before" class="ev-swap">
            <div class="after-wrap" id="after-wrap">
              <img src="${ev.after_image}" data-raw="${ev.after_image}" data-classified="${ev.after_classified || ev.after_image}" alt="After" id="after-img" class="ev-swap">
            </div>
            <span class="compare-tag" style="left:0.6rem;">BEFORE</span>
            <span class="compare-tag" style="right:0.6rem;">AFTER</span>
            <div class="compare-handle" id="compare-handle">
              <div class="grip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 7-5 5 5 5M15 7l5 5-5 5"/></svg>
              </div>
            </div>
          </div>
        </div>
        <div data-tabpanel="sidebyside" class="d-none">
          <div class="row g-2">
            <div class="col-md-6">
              <div class="evidence-frame"><span class="ev-caption">Before</span><img src="${ev.before_image}" data-raw="${ev.before_image}" data-classified="${ev.before_classified || ev.before_image}" alt="Before" class="ev-swap"></div>
            </div>
            <div class="col-md-6">
              <div class="evidence-frame"><span class="ev-caption">After</span><img src="${ev.after_image}" data-raw="${ev.after_image}" data-classified="${ev.after_classified || ev.after_image}" alt="After" class="ev-swap"></div>
            </div>
          </div>
        </div>
        <div data-tabpanel="changemap" class="d-none">
          <div class="evidence-frame"><span class="ev-caption">Change Map</span>${ev.change_map ? `<img src="${ev.change_map}" alt="Change map">` : emptyState("No change map was returned.")}</div>
        </div>
      `;
      wireEvidenceTabs(body);
      wireCompareSlider();
      wireEvidenceToggle(body);
    } else if (ev.optical_image && ev.sar_image) {
      body.innerHTML = `
        <div class="evidence-tabs">
          <button class="evidence-tab active" data-tab="side">Optical | SAR</button>
          ${ev.fused_image ? '<button class="evidence-tab" data-tab="fused">Fused / Analysis Result</button>' : ""}
        </div>
        <div data-tabpanel="side">
          <div class="row g-2">
            <div class="col-md-6">
              <div class="evidence-frame"><span class="ev-caption">Optical</span><img src="${ev.optical_image}" alt="Optical"></div>
            </div>
            <div class="col-md-6">
              <div class="evidence-frame"><span class="ev-caption">SAR</span><img src="${ev.sar_image}" alt="SAR"></div>
            </div>
          </div>
        </div>
        ${ev.fused_image ? `<div data-tabpanel="fused" class="d-none"><div class="evidence-frame"><span class="ev-caption">Fused</span><img src="${ev.fused_image}" alt="Fused"></div></div>` : ""}
      `;
      wireEvidenceTabs(body);
    } else if (ev.image) {
      const hasRaw = !!ev.raw_image;
      body.innerHTML = `
        ${hasRaw ? `
        <div class="ev-toggle" id="ev-view-toggle">
          <button type="button" data-view="raw">Raw</button>
          <button type="button" class="active" data-view="classified">Classified</button>
        </div>` : ""}
        <div class="evidence-frame" style="max-width:640px;">
          <span class="ev-caption">Image</span>
          <img src="${ev.image}" data-raw="${ev.raw_image || ev.image}" data-classified="${ev.image}" alt="Analysis image" class="ev-swap">
        </div>
        ${Array.isArray(ev.bounding_boxes) && ev.bounding_boxes.length ? `<p class="mt-2" style="font-size:0.8rem; color:var(--ink-400);">${ev.bounding_boxes.length} region(s) highlighted by the model — switch to "Classified" view to see the highlight.</p>` : ""}
      `;
      wireEvidenceToggle(body, "classified");
    } else {
      body.innerHTML = emptyState("No visual evidence was returned for this analysis.");
    }
  }

  function wireEvidenceToggle(scope, defaultView = "raw") {
    const toggle = scope.querySelector("#ev-view-toggle");
    if (!toggle) return;
    const buttons = toggle.querySelectorAll("button");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const view = btn.dataset.view;
        scope.querySelectorAll("img.ev-swap").forEach((img) => {
          img.src = view === "raw" ? img.dataset.raw : img.dataset.classified;
        });
      });
    });
  }

  function wireEvidenceTabs(scope) {
    const tabs = scope.querySelectorAll(".evidence-tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        scope.querySelectorAll("[data-tabpanel]").forEach((p) => {
          p.classList.toggle("d-none", p.dataset.tabpanel !== tab.dataset.tab);
        });
        // Recompute slider width if it becomes visible again.
        if (tab.dataset.tab === "slider") setupSliderWidth();
      });
    });
  }

  // ---- Before/after slider comparison ----
  function setupSliderWidth() {
    const slider = document.getElementById("compare-slider");
    const afterImg = document.getElementById("after-img");
    if (!slider || !afterImg) return;
    afterImg.style.setProperty("--cw", slider.offsetWidth + "px");
    afterImg.style.width = slider.offsetWidth + "px";
  }

  function wireCompareSlider() {
    const slider = document.getElementById("compare-slider");
    const handle = document.getElementById("compare-handle");
    const afterWrap = document.getElementById("after-wrap");
    if (!slider || !handle || !afterWrap) return;

    setupSliderWidth();
    window.addEventListener("resize", setupSliderWidth);

    let dragging = false;

    function setPosition(clientX) {
      const rect = slider.getBoundingClientRect();
      let pct = ((clientX - rect.left) / rect.width) * 100;
      pct = Math.max(0, Math.min(100, pct));
      afterWrap.style.width = pct + "%";
      handle.style.left = pct + "%";
    }

    handle.addEventListener("mousedown", () => (dragging = true));
    window.addEventListener("mouseup", () => (dragging = false));
    window.addEventListener("mousemove", (e) => {
      if (dragging) setPosition(e.clientX);
    });
    handle.addEventListener("touchstart", () => (dragging = true), { passive: true });
    window.addEventListener("touchend", () => (dragging = false));
    window.addEventListener(
      "touchmove",
      (e) => {
        if (dragging && e.touches[0]) setPosition(e.touches[0].clientX);
      },
      { passive: true }
    );
    slider.addEventListener("click", (e) => {
      if (e.target === handle || handle.contains(e.target)) return;
      setPosition(e.clientX);
    });
  }

  // ---- helpers ----
  function fmtCoord(v) {
    return typeof v === "number" ? v.toFixed(4) : "—";
  }
  function emptyState(msg) {
    return `<div class="state-panel">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m21 15-5-5L5 21"/><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>
      <p>${escapeHtml(msg)}</p>
    </div>`;
  }
  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
});