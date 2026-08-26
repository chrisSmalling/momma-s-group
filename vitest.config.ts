import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests target the pure recommendation core (src/lib/recommend/*), which
// has no Next/Supabase/network dependencies. The "@/" alias is mapped by hand
// to avoid an ESM-only resolver plugin under this project's CJS config.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
