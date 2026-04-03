export type RuntimeMode = "native" | "compat-sandbox";
export type RuntimeAdapter = "st-generic" | "era" | "fate" | "custom";

export interface RuntimeCapabilities {
  regex: boolean;
  htmlDocument: boolean;
  script: boolean;
  xmlTags: boolean;
  variableInsert: boolean;
  eraData: boolean;
  placeholder: boolean;
  styledHtml: boolean;
  cssAnimation: boolean;
  externalAsset: boolean;
  lorebookRegex: boolean;
}

export interface RuntimeManifest {
  runtimeMode: RuntimeMode;
  adapter?: RuntimeAdapter;
  promptCompat: boolean;
  renderCompat: boolean;
  capabilities: RuntimeCapabilities;
  detectedFeatures: string[];
}
