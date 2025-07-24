import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Bilibili ”换一换“ 历史",
    description: "在 Bilibili 上保存”换一换“推荐历史，查看错过的推荐视频",
    permissions: ["storage"],
    host_permissions: ["https://www.bilibili.com/*"],
    icons: {
      128: "icons/128.png",
    },
  },
});
