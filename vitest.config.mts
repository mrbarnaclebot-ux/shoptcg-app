import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    // Many tests boot PGlite and migrate in their body: over 5 s on a busy machine.
    testTimeout: 30_000,
    // The same boot in a beforeAll timed out at the 10 s default on CI runners.
    hookTimeout: 60_000,
  },
});
