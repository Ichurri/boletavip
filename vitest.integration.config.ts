import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/tests/integration/**/*.itest.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts", "./src/tests/integration/setup.ts"],
    // Every file truncates shared tables; never run them in parallel
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
