/** Sandbox entry: fewer font families than main app = less download + faster first paint. */
import "@fontsource-variable/geist";
import "@fontsource-variable/noto-sans";
import "./globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CompatSandboxApp } from "./compat-sandbox-app";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Failed to find compat sandbox root");
}

function notifyReady() {
  if (import.meta.env.DEV) {
    console.log("[compat-sandbox] sending compat:ready");
  }
  window.parent.postMessage({ type: "compat:ready" }, "*");
}

/** Host pings after iframe onLoad / remount — must respond even before React hydrates (StrictMode). */
window.addEventListener("message", (event: MessageEvent) => {
  if (event.data?.type === "compat:request-ready") {
    notifyReady();
  }
});

createRoot(rootElement).render(
  <StrictMode>
    <CompatSandboxApp />
  </StrictMode>,
);

notifyReady();
