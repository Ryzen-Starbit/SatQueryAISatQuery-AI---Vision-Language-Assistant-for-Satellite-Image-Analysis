# SatQuery AI — Vite Frontend Prototype

Interactive vision-language assistant for multimodal remote-sensing image
analysis through natural-language queries. This repository contains **only
the frontend** — a Vite-powered multi-page HTML/CSS/JavaScript application
(Bootstrap for layout utilities, Leaflet for maps). No backend, no AI models.
Those are owned by the AI/backend team and are integrated through a single file:
`js/api.js`.

---

## 1. Tech stack

- HTML5, CSS3 (custom design system in `css/style.css`)
- Vanilla JavaScript with Vite for local development and production builds
- [Bootstrap 5](https://getbootstrap.com/) — grid + a few layout utilities only
- [Leaflet](https://leafletjs.com/) — location picker + results map
- Google Fonts: Space Grotesk (headings), Inter (body), IBM Plex Mono (data/technical labels)

No React, no Next.js, no TypeScript, no state-management library. The existing
HTML pages remain separate Vite entry points so each screen stays easy to
understand.

---

## 2. Running it locally

Install the Node dependencies and start Vite:
```bash
npm install
npm run dev
```
Then open the URL printed by Vite (usually
`http://localhost:5173/login.html`). Do not open `login.html` directly from a
`file://` URL.

For a production build, run `npm run build`; use `npm run preview` to serve the
generated `dist/` directory locally.

**Login:** email/password sign-in uses Firebase Authentication. The Firebase
web configuration is in `js/firebase.js`. For local UI demonstrations, click
**Continue as Demo User** to skip authentication.

---

## 3. Project structure

```
satquery-ai/
├── login.html          Login screen
├── dashboard.html       Post-login landing page
├── analysis.html         New-analysis wizard (source → configure → location → query → processing)
├── results.html            Results dashboard
│
├── css/
│   └── style.css              All styles + design tokens (colors, type, spacing)
├── package.json               Vite scripts and frontend dependencies
├── vite.config.js             Multi-page entry points and legacy asset handling
│
├── js/
│   ├── api.js                 ⭐ ALL backend communication lives here (mock + real)
│   ├── app.js                 Shared app-shell behaviour (auth guard, logout, toasts)
│   ├── auth.js                Login page logic
│   ├── firebase.js            Firebase Authentication initialization
│   ├── analysis.js            New-analysis wizard logic
│   ├── map.js                 Reusable Leaflet helpers (picker map, results map)
│   ├── results.js             Results page rendering
│   └── report.js              "Download Report" (demo: printable HTML; real: PDF URL)
│
├── assets/images/         Procedurally generated demo imagery (NOT real satellite
│                            data — see note below) used by the mock dataset/results
└── README.md
```

---

## 4. How the mock backend works (and how to replace it)

`js/api.js` exposes one object, `SatQueryAPI`, with these functions:

| Function | Purpose |
|---|---|
| `loginUser(email, password)` | Sign in |
| `loginDemoUser()` | "Continue as Demo User" |
| `uploadImage(file)` | Upload a single image file |
| `getDatasets()` | List example datasets |
| `analyzeImagery(config)` | Submit an analysis job → `{ analysis_id }` |
| `getAnalysisStatus(id, stepIndex)` | Poll execution pipeline status |
| `getAnalysisResult(id)` | Fetch the completed result |
| `generateReport(result)` | Request a downloadable report |

A module-level flag, `DEMO_MODE` (top of `api.js`), controls everything.
While `true`, every function returns realistic mock data (with a simulated
network delay so the loading/processing UI can be demonstrated). Every
function that will eventually call the real backend already has a
commented-out `fetch(...)` / `request(...)` call showing exactly what to
send — **uncomment it, delete the mock branch above it, and flip
`DEMO_MODE = false`.**

Because every page calls `SatQueryAPI.*` rather than talking to a URL
directly, none of the other JS files need to change when the backend goes
live.

### Backend response contract

The frontend is built around this JSON shape for a completed analysis
(returned by `getAnalysisResult` / eventually `GET /analysis/{id}`):

```json
{
  "analysis_id": "demo-001",
  "task": "change_vqa",
  "query": "Has the built-up area increased?",
  "answer": "Built-up area increased between the two observations.",
  "summary": ["New built-up regions were detected.", "..."],
  "confidence": 0.87,
  "alerts": [
    { "type": "Significant Change Detected", "description": "...", "severity": "medium", "confidence": 0.84 }
  ],
  "evidence": {
    "before_image": "...", "after_image": "...", "change_map": "...",
    "bounding_boxes": []
  },
  "location": { "latitude": 18.5204, "longitude": 73.8567, "label": "Pune, Maharashtra" },
  "execution": {
    "task": "Change-based Visual Question Answering",
    "models": ["Change Detection Model", "Remote Sensing VQA Model"],
    "status": "completed",
    "input_summary": "2 GeoTIFF images (bi-temporal pair)",
    "parameters": { "change_threshold": 0.18 }
  }
}
```

`evidence` may instead contain `optical_image` + `sar_image` (+ optional
`fused_image`) for Optical+SAR analyses, or a single `image` for single-image
analyses — `results.js` (`renderEvidence`) checks for these keys and renders
the matching layout automatically. **Any field can be missing**; the UI
falls back to an empty-state message rather than breaking (see
`results.js` → `emptyState`).

---

## 5. Where things are still mocked (and what to do about it)

- **Authentication** — email/password sign-in is handled by Firebase
  Authentication in `js/firebase.js`; the demo shortcut remains frontend-only.
- **Datasets** — `MOCK_DATASETS` inside `api.js`. Replace `getDatasets()`
  with a call to `GET /datasets`.
- **Location search** — `analysis.js` has a tiny hard-coded lookup table
  (`MOCK_PLACES`) for a handful of Indian cities, clearly commented as a
  placeholder. Swap in a real geocoding API (e.g. Nominatim, Google
  Geocoding) inside `runLocationSearch()`.
- **Execution pipeline steps** — `getAnalysisStatus()` simulates the 8-step
  pipeline described in the problem statement. Once the backend can report
  real step-by-step status, replace the mock stepping logic with actual
  polling (or swap to Server-Sent Events / WebSockets if the backend
  supports streaming — the rendering function `renderExecSteps()` in
  `analysis.js` doesn't need to change).
- **Report generation** — `generateReport()` currently returns
  `{ mode: "demo-html" }` and `report.js` builds a printable HTML page
  client-side. Once `POST /generate-report` exists, return
  `{ report_url }` instead; `report.js` already has the real-mode branch
  ready to uncomment.
- **Demo imagery** (`assets/images/*.jpg`) — procedurally generated
  synthetic textures (noise + simple shapes), **not real satellite data**.
  They exist only so the UI has something to render before real dataset
  imagery is provided by the data team. Replace the files (same filenames)
  or point `MOCK_DATASETS` / `buildMockResult()` in `api.js` at real URLs.

---

## 6. Design language

The visual design intentionally avoids a generic "AI chatbot" or SaaS-startup
look. It borrows from technical/mission-control interfaces: a dark
navy app shell, restrained teal accent, monospace labels on data fields
(coordinates, confidence, execution parameters), and light data panels with
clear hierarchy. Colors, type, spacing and component classes are defined
once in `css/style.css` under "Design tokens" — change them there to
re-theme the whole app.

---

## 7. Known simplifications (by design)

- No client-side routing/framework — plain multi-page app, one `.html` file
  per screen. This was a deliberate choice to keep the codebase readable
  for a single developer maintaining it (see prompt requirements).
- No offline/service-worker support.
- No automated tests. For a hackathon prototype this was judged lower
  priority than a complete, working UI; can be added later with a simple
  tool such as Playwright if needed.
- Mobile layout is functional (Bootstrap responsive grid) but the primary
  target is desktop/laptop, per the intended demo context.
npm run preview
```

The production files are written to `dist/`.
