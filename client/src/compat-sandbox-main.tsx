import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "@fontsource-variable/noto-sans";
import "./globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CompatSandboxApp } from "./compat-sandbox-app";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Failed to find compat sandbox root");
}

createRoot(rootElement).render(
  <StrictMode>
    <CompatSandboxApp />
  </StrictMode>,
);
