import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the "@/*" path alias from tsconfig.json so tests can import
      // from src/ exactly like the app does.
      "@": r("./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // office-hours.test.ts manipulates process.env.TZ; give each test file
    // its own process so the pin can't leak between files.
    pool: "forks",
    clearMocks: true,
  },
});
