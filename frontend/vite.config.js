import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "vite";

function emitLegacyAssets() {
  return {
    name: "emit-legacy-assets",
    generateBundle() {
      for (const fileName of readdirSync("js")) {
        if (fileName === "firebase.js" || fileName === "auth.js") continue;
        this.emitFile({
          type: "asset",
          fileName: `js/${fileName}`,
          source: readFileSync(join("js", fileName)),
        });
      }

      for (const fileName of readdirSync("assets/images")) {
        this.emitFile({
          type: "asset",
          fileName: `assets/images/${fileName}`,
          source: readFileSync(join("assets/images", fileName)),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [emitLegacyAssets()],
  build: {
    rollupOptions: {
      input: {
        login: "login.html",
        dashboard: "dashboard.html",
        analysis: "analysis.html",
        results: "results.html",
      },
    },
  },
});
