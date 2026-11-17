// `bun test` 相容性 preload（由 bunfig.toml 載入）：
// 讓 Bun 內建 runner 也能跑 vitest 測試。nuxt.config.ts 的 nitro.preset 讀 VITEST
// 判斷改用 node-server entry；少了這個環境變數，e2e 會用 cloudflare_module 的
// workerd 專用 entry 在 node 起伺服器，炸在 __STATIC_CONTENT_MANIFEST。
process.env.VITEST = 'true'
