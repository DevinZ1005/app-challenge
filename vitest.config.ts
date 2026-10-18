import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["tests/**/*.test.{ts,tsx}"], environment: "node" },
});
