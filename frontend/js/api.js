const SatQueryAPI = (function () {
  "use strict";
  const DEMO_MODE = false;
  const BASE_URL = "http://localhost:8000";
  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  async function request(path, options = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    if (!res.ok) {
      const err = new Error(`API request failed (${res.status})`);
      err.status = res.status;
      try {
        err.body = await res.json();
      } catch (_) {
        /* ignore parse failure */
      }
      throw err;
    }
    return res.json();
  }

  const MOCK_DATASETS = [
    {
      id: "ds-urban-pune",
      name: "Pune Urban Growth Corridor",
      image_type: "bitemporal",
      location: "Pune, Maharashtra",
      lat: 18.5204,
      lon: 73.8567,
      acquisition_date: "2025-01-12 → 2026-01-12",
      description:
        "A rapidly urbanising district on the northern edge of Pune, useful for demonstrating built-up change detection.",
      thumbnail: "assets/images/dataset-urban-growth.jpg",
    },
    {
      id: "ds-flood-sar",
      name: "Kosi Basin — SAR Flood Extent",
      image_type: "sar",
      location: "Kosi River Basin, Bihar",
      lat: 25.9,
      lon: 86.7,
      acquisition_date: "2025-08-03",
      description:
        "Single-date SAR acquisition over a flood-prone river basin. Suited to surface-water and inundation queries.",
      thumbnail: "assets/images/dataset-flood-sar.jpg",
    },
    {
      id: "ds-coastal",
      name: "Konkan Coastal Strip",
      image_type: "optical",
      location: "Ratnagiri, Maharashtra",
      lat: 16.994,
      lon: 73.3,
      acquisition_date: "2025-11-20",
      description:
        "Optical multispectral scene of a coastal strip with mixed vegetation and settlement, for general VQA and grounding demos.",
      thumbnail: "assets/images/dataset-coastal.jpg",
    },
    {
      id: "ds-agri",
      name: "Vidarbha Agricultural Belt",
      image_type: "optical",
      location: "Nagpur District, Maharashtra",
      lat: 21.15,
      lon: 79.09,
      acquisition_date: "2025-09-05",
      description:
        "Cropland-dominated optical scene, useful for land-cover description and vegetation-focused queries.",
      thumbnail: "assets/images/dataset-agri.jpg",
    },
    {
      id: "ds-optsar-fusion",
      name: "Ahmedabad Co-registered Pair",
      image_type: "opt_sar",
      location: "Ahmedabad, Gujarat",
      lat: 23.0225,
      lon: 72.5714,
      acquisition_date: "2025-10-02",
      description:
        "Co-registered optical + SAR pair over a dense urban area, for cross-modal fusion queries.",
      thumbnail: "assets/images/dataset-urban-growth.jpg",
    },
  ];

  function buildMockResult({ mode, query, location }) {
    const isBitemporal = mode === "bitemporal";
    const isOptSar = mode === "opt_sar";
    const isSar = mode === "sar";
    const base = {
      analysis_id: "demo-" + Math.random().toString(36).slice(2, 8),
      task: isBitemporal ? "change_vqa" : isOptSar ? "cross_modal_vqa" : "vqa",
      query: query || "Describe the land-cover and major objects visible in this image.",
      confidence: isBitemporal ? 0.87 : isOptSar ? 0.79 : 0.91,
      location: {
        latitude: location?.lat ?? 18.5204,
        longitude: location?.lon ?? 73.8567,
        label: location?.label ?? "Pune, Maharashtra",
      },
      execution: {
        task: isBitemporal ? "Change-based Visual Question Answering" : isOptSar ? "Cross-Modal Optical–SAR Analysis" : "Remote-Sensing Visual Question Answering",
        models: isBitemporal
          ? ["Change Detection Model", "Remote Sensing VQA Model"]
          : isOptSar
          ? ["Optical–SAR Fusion Model", "Grounding Model"]
          : isSar
          ? ["SAR Scene Classification Model", "Remote Sensing VQA Model"]
          : ["Remote Sensing VQA Model", "Grounding Model"],
        status: "completed",
        input_summary: isBitemporal
          ? "2 GeoTIFF images (bi-temporal pair)"
          : isOptSar
          ? "2 co-registered images (optical + SAR)"
          : "1 image",
        parameters: {
          change_threshold: isBitemporal ? 0.18 : undefined,
          modality: isOptSar ? "optical+sar" : isSar ? "sar" : "optical",
        },
      },
    };

    if (isBitemporal) {
      return {
        ...base,
        answer: "Built-up area increased between the two observations, concentrated in the northern part of the study area.",
        summary: [
          "New built-up regions were detected, primarily along the northern boundary.",
          "The largest changes occurred in the northern portion of the study area.",
          "Water-covered regions remained largely unchanged between the two dates.",
        ],
        alerts: [
          {
            type: "Significant Change Detected",
            description: "Built-up area expansion exceeds the configured change threshold in 3 contiguous regions.",
            severity: "medium",
            confidence: 0.84,
          },
        ],
        evidence: {
          before_image: "assets/images/demo-before.jpg",
          after_image: "assets/images/demo-after.jpg",
          change_map: "assets/images/demo-change-map.jpg",
          bounding_boxes: [],
        },
      };
    }

    if (isOptSar) {
      return {
        ...base,
        answer: "Combining optical and SAR evidence, the built-up core is confirmed with high agreement between both modalities; a water-covered region is visible along the southern edge.",
        summary: [
          "Optical and SAR evidence agree on the extent of the central built-up area.",
          "A water body is visible in the SAR image as a smooth, low-return region.",
          "No cross-modal disagreement regions were flagged.",
        ],
        alerts: [],
        evidence: {
          optical_image: "assets/images/demo-optical.jpg",
          sar_image: "assets/images/demo-sar.jpg",
          fused_image: "assets/images/demo-optical.jpg",
          bounding_boxes: [],
        },
      };
    }

    return {
      ...base,
      answer: isSar
        ? "The scene shows a mix of rough, high-return surfaces consistent with built-up structures, and a smooth, low-return water body."
        : "The scene is dominated by built-up structures interspersed with vegetation, with a water body along the southern edge.",
      summary: [
        isSar ? "Bright scattering regions are consistent with urban/built-up structures." : "Built-up structures are concentrated in the central and eastern portions of the scene.",
        "A water body is clearly distinguishable along the lower edge of the image.",
        "No significant anomalies were detected in this scene.",
      ],
      alerts: [],
      evidence: {
        image: isSar ? "assets/images/demo-sar.jpg" : "assets/images/demo-single.jpg",
        bounding_boxes: [],
      },
    };
  }

  return {
    DEMO_MODE,
    async loginUser(email, password) {
      await wait(500);
      if (!email || !password) {
        throw new Error("Email and password are required.");
      }
      return {
        user: { name: email.split("@")[0] || "Demo User", email },
        token: "demo-token-" + Date.now(),
      };
    },
    async loginDemoUser() {
      await wait(300);
      return {
        user: { name: "Demo User", email: "demo@satquery.ai" },
        token: "demo-token-" + Date.now(),
      };
    },
    async uploadImage(file) {
      if (DEMO_MODE) {
        await wait(400);
        return {
          id: "upload-" + Date.now(),
          name: file.name,
          size: file.size,
          previewUrl: URL.createObjectURL(file),
        };
      }
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE_URL}/images/upload`, { method: "POST", body: formData });
      if (!res.ok) {
        const err = new Error(`Upload failed (${res.status})`);
        err.status = res.status;
        throw err;
      }
      return res.json();
    },
    async getDatasets() {
      if (DEMO_MODE) {
        await wait(350);
        return MOCK_DATASETS;
      }
      return request("/datasets");
    },
    async analyzeImagery(config) {
      if (DEMO_MODE) {
        await wait(300);
        const analysisId = "demo-" + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem(`sq_config_${analysisId}`, JSON.stringify(config));
        return { analysis_id: analysisId };
      }
      return request("/analyze", { method: "POST", body: JSON.stringify(config) });
    },
    async getAnalysisStatus(analysisId, stepIndex) {
      if (DEMO_MODE) {
        await wait(650);
        const steps = [
          "Input Validation",
          "Query Understanding",
          "Task Identification",
          "Selecting Specialist Model",
          "Processing Imagery",
          "Generating Evidence",
          "Validating Results",
          "Preparing Response",
        ];
        return {
          steps: steps.map((label, i) => ({
            label,
            status: i < stepIndex ? "done" : i === stepIndex ? "active" : "pending",
          })),
          complete: stepIndex >= steps.length,
        };
      }
      await wait(500);
      return request(`/analysis/${analysisId}/status`);
    },
    async getAnalysisResult(analysisId) {
      if (DEMO_MODE) {
        await wait(300);
        const raw = sessionStorage.getItem(`sq_config_${analysisId}`);
        const config = raw ? JSON.parse(raw) : {};
        return buildMockResult(config);
      }
      return request(`/analysis/${analysisId}`);
    },
    async getStats() {
      if (DEMO_MODE) {
        await wait(200);
        return { analyses_run: 12, datasets_available: 5, alerts_flagged: 3, avg_confidence: 0.86 };
      }
      return request("/stats");
    },
    async generateReport(result) {
      await wait(200);
      return { mode: "demo-html", result };
    },
  };
})();