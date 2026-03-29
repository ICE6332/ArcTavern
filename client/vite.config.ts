import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const isSettingsModule =
            id.includes("/components/settings/") ||
            id.includes("\\components\\settings\\") ||
            id.includes("/components/world-info/") ||
            id.includes("\\components\\world-info\\") ||
            id.includes("/hooks/use-settings-panel-controller") ||
            id.includes("\\hooks\\use-settings-panel-controller") ||
            id.includes("/stores/connection-store") ||
            id.includes("\\stores\\connection-store") ||
            id.includes("/stores/prompt-manager-store") ||
            id.includes("\\stores\\prompt-manager-store") ||
            id.includes("/stores/world-info-store") ||
            id.includes("\\stores\\world-info-store");

          if (isSettingsModule) {
            return "settings";
          }

          if (id.includes("node_modules")) {
            if (id.includes("@hugeicons/core-free-icons") || id.includes("@hugeicons/react")) {
              return "icons";
            }
            if (id.includes("lucide-react")) {
              return "lucide";
            }
            if (id.includes("motion/react") || id.includes("motion") || id.includes("@dnd-kit/")) {
              return "interaction";
            }
            if (id.includes("@base-ui/react") || id.includes("@radix-ui/")) {
              return "ui-vendor";
            }
            if (
              id.includes("react-markdown") ||
              id.includes("remark-gfm") ||
              id.includes("rehype-highlight") ||
              id.includes("highlight.js")
            ) {
              return "markdown-stack";
            }
            if (id.includes("@openuidev/react-lang")) {
              return "openui";
            }
          }
        },
      },
    },
  },
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
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
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
    ignorePatterns: ["coverage/**", "dist/**", "node_modules/**"],
    options: { typeAware: true, typeCheck: true },
    plugins: ["react"],
  },
  fmt: {
    semi: true,
    singleQuote: false,
    printWidth: 100,
    trailingComma: "all",
  },
  staged: {
    "*.{ts,tsx}": "vp check --fix",
  },
});
