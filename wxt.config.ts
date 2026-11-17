import { defineConfig } from "wxt";

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],

  manifestVersion: 3,

  manifest: {
    name: "Sync My Leet",
    description: "Sync LeetCode solutions to GitHub",
    permissions: ["storage"],
    host_permissions: ["https://api.github.com/*"],
  },
});
