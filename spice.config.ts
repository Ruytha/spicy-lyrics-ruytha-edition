import { defineConfig } from "@spicemod/creator";
import { ProjectName, ProjectVersion } from "./project/config";

export default defineConfig({
  name: ProjectName,
  version: ProjectVersion,
  framework: "react",
  linter: "oxlint",
  template: "extension",
  packageManager: "bun",
  cssId: "slstyles",
  devModeVarName: "__SLdev__m",
  esbuildOptions: {
    legalComments: "inline",
    // CHANGELOG.md is bundled as text for the fork's What's New popup.
    loader: { ".md": "text" },
  },
});