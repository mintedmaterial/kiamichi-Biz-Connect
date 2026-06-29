import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for unit tests
 * Uses Node environment instead of Cloudflare Workers pool
 * for pure unit testing without runtime dependencies
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
