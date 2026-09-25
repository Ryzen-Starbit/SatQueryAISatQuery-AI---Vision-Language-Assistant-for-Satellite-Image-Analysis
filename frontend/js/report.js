/**
 * report.js
 * ---------------------------------------------------------------------------
 * Handles "Download Report".
 *
 * Real backend: SatQueryAPI.generateReport() will return something like
 * { report_url: "https://.../report.pdf" } from POST /generate-report.
 * This file then just opens/downloads that URL — see the `else` branch below.
 *
 * Demo mode: there is no backend PDF service yet, so we build a clean,
 * printable HTML report on the fly (the user can "Save as PDF" from the
 * browser's print dialog). This keeps the report content and layout
 * connected to the same result data the dashboard renders.
 * ---------------------------------------------------------------------------
 */

const SatQueryReport = (function () {
  "use strict";

  function openReport(report) {
    if (report.mode === "demo-html") {
      const html = buildHtmlReport(report.result);
      const win = window.open("", "_blank");
      if (!win) {
        SatQueryToast.show("Please allow pop-ups to view the report.", "error");
        return;
      }
      win.document.write(html);
      win.document.close();
      return;
    }
    // --- Real backend response --------------------------------------------
    // if (report.report_url) {
    //   window.open(report.report_url, "_blank");
    // }
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const LC_COLORS = { water: "#1e6edc", vegetation: "#28a446", built_up: "#dc5a3c", bare_land: "#d2b478" };
  const LC_LABELS = { water: "Water", vegetation: "Vegetation", built_up: "Built-up", bare_land: "Bare / exposed land" };
  const LC_ORDER = ["water", "vegetation", "built_up", "bare_land"];

  function lcRows(obj) {
    return LC_ORDER.map((k) => {
      const pct = Math.round((obj[k] || 0) * 100);
      return `<div class="lc-row">
        <span class="lc-label">${LC_LABELS[k]}</span>
        <div class="lc-track"><div class="lc-fill" style="width:${pct}%;background:${LC_COLORS[k]};"></div></div>
        <span class="lc-pct">${pct}%</span>
      </div>`;
    }).join("");
  }

  function landCoverSection(lc) {
    if (!lc) return "<p style='font-size:13px;color:#5c6b7a;'>No land-cover breakdown was returned.</p>";
    if (lc.before && lc.after) {
      return `<div class="lc-group"><div class="lc-group-title">Before</div>${lcRows(lc.before)}</div>
              <div class="lc-group"><div class="lc-group-title">After</div>${lcRows(lc.after)}</div>`;
    }
    if (lc.optical && lc.sar) {
      return `<div class="lc-group"><div class="lc-group-title">Optical</div>${lcRows(lc.optical)}</div>
              <div class="lc-group"><div class="lc-group-title">SAR</div>${lcRows(lc.sar)}</div>`;
    }
    return lcRows(lc);
  }

  function buildHtmlReport(r) {
    const exec = r.execution || {};
    const evidenceImgs = Object.values(r.evidence || {}).filter((v) => typeof v === "string");
    const generatedAt = new Date().toLocaleString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SatQuery AI — Analysis Report — ${esc(r.analysis_id || "")}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #10182a; max-width: 760px; margin: 40px auto; padding: 0 20px; line-height: 1.55; }
  header { border-bottom: 2px solid #135e59; padding-bottom: 14px; margin-bottom: 24px; display:flex; justify-content:space-between; align-items:flex-end; }
  header h1 { font-size: 20px; margin: 0; color: #0a121f; }
  header .sub { font-size: 12px; color: #5c6b7a; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; color: #135e59; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; margin-top: 28px; }
  .answer { font-size: 16px; font-weight: 600; background: #f4f6f8; border-left: 3px solid #1c7c77; padding: 12px 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  td { padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
  td.k { color: #5c6b7a; width: 180px; font-family: monospace; text-transform: uppercase; font-size: 11px; }
  ul { font-size: 13px; padding-left: 18px; }
  .imgs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .imgs img { width: 100%; border: 1px solid #ddd; border-radius: 4px; }
  .alert { background: #fbeed9; border-left: 3px solid #b4790a; padding: 8px 12px; font-size: 13px; margin-bottom: 8px; }
  .confidence { font-size: 22px; font-weight: 700; }
  .lc-group-title { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: #5c6b7a; margin: 10px 0 4px; }
  .lc-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .lc-label { width: 130px; flex-shrink: 0; font-size: 12px; color: #10182a; }
  .lc-track { flex: 1; height: 12px; background: #eef1f4; border-radius: 3px; overflow: hidden; }
  .lc-fill { height: 100%; border-radius: 3px; }
  .lc-pct { width: 40px; text-align: right; font-size: 12px; color: #5c6b7a; }
  footer { margin-top: 40px; font-size: 11px; color: #9aa4ad; border-top: 1px solid #eee; padding-top: 10px; }
  @media print { body { margin: 0; padding: 20px; } }
</style>
</head>
<body>
  <header>
    <div>
      <h1>SatQuery AI</h1>
      <div class="sub">Interactive Vision-Language Assistant for Remote Sensing — Analysis Report</div>
    </div>
    <div class="sub">Generated ${esc(generatedAt)}</div>
  </header>

  <h2>Analysis Information</h2>
  <table>
    <tr><td class="k">Analysis ID</td><td>${esc(r.analysis_id)}</td></tr>
    <tr><td class="k">Query</td><td>${esc(r.query)}</td></tr>
    <tr><td class="k">Location</td><td>${esc(r.location?.label || "—")} (${esc(r.location?.latitude)}, ${esc(r.location?.longitude)})</td></tr>
    <tr><td class="k">Task</td><td>${esc(exec.task || r.task)}</td></tr>
  </table>

  <h2>Answer</h2>
  <div class="answer">${esc(r.answer)}</div>

  <h2>Key Findings</h2>
  <ul>
    ${(r.summary || []).map((s) => `<li>${esc(s)}</li>`).join("") || "<li>No findings returned.</li>"}
  </ul>

  <h2>Alerts</h2>
  ${
    (r.alerts || []).length
      ? r.alerts.map((a) => `<div class="alert"><strong>${esc(a.type)}</strong> — ${esc(a.description)}${typeof a.confidence === "number" ? ` (confidence ${Math.round(a.confidence * 100)}%)` : ""}</div>`).join("")
      : "<p style='font-size:13px;color:#5c6b7a;'>No alerts were flagged for this analysis.</p>"
  }

  <h2>Confidence</h2>
  <div class="confidence">${typeof r.confidence === "number" ? Math.round(r.confidence * 100) + "%" : "N/A"}</div>

  <h2>Land-Cover Breakdown</h2>
  ${landCoverSection(r.land_cover)}

  <h2>Visual Evidence</h2>
  <div class="imgs">
    ${evidenceImgs.map((src) => `<img src="${esc(src)}">`).join("")}
  </div>

  <h2>Execution Summary</h2>
  <table>
    <tr><td class="k">Task</td><td>${esc(exec.task)}</td></tr>
    <tr><td class="k">Models / Tools</td><td>${esc((exec.models || []).join(", "))}</td></tr>
    <tr><td class="k">Input</td><td>${esc(exec.input_summary)}</td></tr>
    <tr><td class="k">Status</td><td>${esc(exec.status)}</td></tr>
  </table>

  <footer>
    This is a prototype report generated in demo mode (no backend PDF service connected).
    Use your browser's Print → Save as PDF to export. SatQuery AI · Smart India Hackathon prototype.
  </footer>

  <script>window.onload = () => window.print();<\/script>
</body>
</html>`;
  }

  return { openReport };
})();