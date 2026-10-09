import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ quiet: true });

const dari = (jalur: string) => fileURLToPath(new URL(jalur, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": dari("./src"),
      "server-only": dari("./tests/support/server-only.ts"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/support/setup-integration.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/domain/**", "src/server/**", "src/lib/**"],
      exclude: ["src/generated/**"],
    },
  },
});
