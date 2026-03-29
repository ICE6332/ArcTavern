/**
 * ST-style message script runtime (compat layer). Consumed only via hooks + MessageBubble.
 */

export { partitionScripts, extractScripts, stripScripts } from "./extractor";
export { SandboxRuntime } from "./sandbox";
export { createCompatApiBindings, ST_COMPAT_VARS_KEY, type CompatApiDeps } from "./compat-api";
