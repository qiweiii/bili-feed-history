import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Bilibili ”换一换“ 历史",
    description: "在 Bilibili 上保存”换一换“推荐历史，查看错过的推荐视频",
    permissions: ["storage"],
    icons: {
      16: "icons/16.png",
      32: "icons/32.png",
      48: "icons/48.png",
      128: "icons/128.png",
    },
  },
});
