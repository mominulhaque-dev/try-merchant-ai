import { defineConfig } from "vitest/config";

/**
 * Test runner configuration (docs/36). Node environment for the server-side
 * domain/agent logic; UI/component tests can add a jsdom environment later.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    globals: false,
    clearMocks: true,
  },
});
