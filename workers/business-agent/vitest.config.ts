import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  environments: {
    ssr: {
      keepProcessEnv: true
    }
  },
  test: {
    // https://github.com/cloudflare/workers-sdk/issues/9822
    deps: {
      optimizer: {
        ssr: {
          include: ["ajv"]
        }
      }
    },
    // Use node environment for unit tests, workers pool for integration tests
    environment: "node",
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" }
      }
    }
  }
});
