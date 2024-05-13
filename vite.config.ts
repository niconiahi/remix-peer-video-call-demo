import {
  vitePlugin as remix,
  cloudflareDevProxyVitePlugin as remixCloudflareDevProxy,
} from "@remix-run/dev"
import { defineConfig } from "vite"
import { remixDevTools } from "remix-development-tools"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [
    remixDevTools(),
    remixCloudflareDevProxy(),
    remix(),
    tsconfigPaths(),
  ],
})
