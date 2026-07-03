import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config();

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
  },
});
