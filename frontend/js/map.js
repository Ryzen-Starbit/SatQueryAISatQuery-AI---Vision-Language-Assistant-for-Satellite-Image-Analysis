/**
 * map.js
 * ---------------------------------------------------------------------------
 * Small, reusable Leaflet helpers. Kept deliberately simple: one function to
 * create a click-to-pick location map (used in the analysis wizard), and one
 * to render a read-only marker map (used on the results page).
 * ---------------------------------------------------------------------------
 */

const SatQueryMap = (function () {
  "use strict";

  const DEFAULT_CENTER = [22.9734, 78.6569]; // India, roughly centered
  const DEFAULT_ZOOM = 4.5;

  const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

  /** Creates a click-to-pick map. Calls onPick({lat, lon}) whenever the user
   * clicks the map or drags the marker. Returns { map, setPoint }. */
  function createPickerMap(containerId, onPick, initial) {
    const el = document.getElementById(containerId);
    if (!el || typeof L === "undefined") return null;

    const map = L.map(containerId, { scrollWheelZoom: false }).setView(
      initial ? [initial.lat, initial.lon] : DEFAULT_CENTER,
      initial ? 9 : DEFAULT_ZOOM
    );
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(map);

    let marker = null;
    function setPoint(lat, lon, panTo = true) {
      if (marker) {
        marker.setLatLng([lat, lon]);
      } else {
        marker = L.marker([lat, lon], { draggable: true }).addTo(map);
        marker.on("dragend", () => {
          const p = marker.getLatLng();
          onPick({ lat: p.lat, lon: p.lng });
        });
      }
      if (panTo) map.setView([lat, lon], Math.max(map.getZoom(), 9));
    }

    map.on("click", (e) => {
      setPoint(e.latlng.lat, e.latlng.lng, false);
      onPick({ lat: e.latlng.lat, lon: e.latlng.lng });
    });

    if (initial) setPoint(initial.lat, initial.lon, false);

    // Leaflet needs a nudge to size correctly inside flex/hidden containers.
    setTimeout(() => map.invalidateSize(), 200);

    return { map, setPoint };
  }

  /** Creates a simple read-only map with a single marker + optional
   * footprint rectangle, used on the results page. */
  function createResultMap(containerId, { lat, lon, label, footprint }) {
    const el = document.getElementById(containerId);
    if (!el || typeof L === "undefined") return null;

    const map = L.map(containerId, { scrollWheelZoom: false }).setView([lat, lon], 11);
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(map);
    L.marker([lat, lon]).addTo(map).bindPopup(label || "Analysis location");

    if (footprint) {
      L.rectangle(footprint, { color: "#1c7c77", weight: 1.5, fillOpacity: 0.08 }).addTo(map);
    }

    setTimeout(() => map.invalidateSize(), 200);
    return map;
  }

  return { createPickerMap, createResultMap };
})();
