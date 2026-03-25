import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": rootDir,
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5000,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "src/**/*.integration.test.ts",
      "src/**/*.integration.test.tsx",
      "components/**/*.test.ts",
      "components/**/*.test.tsx",
      "components/**/*.integration.test.ts",
      "components/**/*.integration.test.tsx",
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "lib/**/*.integration.test.ts",
      "lib/**/*.integration.test.tsx",
      "stores/**/*.test.ts",
      "stores/**/*.test.tsx",
      "stores/**/*.integration.test.ts",
      "stores/**/*.integration.test.tsx",
    ],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}", "lib/**/*.ts", "stores/**/*.ts"],
    },
  },
  lint: {
    ignorePatterns: [".next/**", "coverage/**", "dist/**", "node_modules/**", "out/**"],
  },
});
