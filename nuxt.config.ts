// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/test-utils/module' // 提供 vitest 的 nuxt environment 與 mountSuspended
  ],

  devtools: {
    enabled: true
  },

  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' }
  },

  // main.css 先、tailwind.css 最後：兩者皆未分層 CSS，同權重時後來者勝，
  // 新樣式的 utility 才蓋得掉既有 class（詳見 app/assets/css/tailwind.css 檔首）
  css: ['~/assets/css/main.css', '~/assets/css/tailwind.css'],

  devServer: {
    port: 1138
  },

  compatibilityDate: '2025-01-15',

  nitro: {
    // Cloudflare Workers 部署（cloudflare_module preset）：部署跑 `just deploy`（build && wrangler deploy）。
    // VITEST 時改回 node-server：@nuxt/test-utils e2e 的 build 在 vitest 行程內跑，
    // cloudflare_module 的 entry 是 workerd 專用，node 跑會找不到 __STATIC_CONTENT_MANIFEST。
    // 本地 `bun run dev` 不讀 nitro.preset；`bun run preview` 請帶 NITRO_PRESET=node-server。
    // .output/server/wrangler.json 由 Nitro 依本設定＋wrangler.jsonc 產生（deployConfig），D1 binding 在其 cloudflare 欄位。
    preset: process.env.VITEST ? 'node-server' : 'cloudflare_module',
    cloudflare: {
      deployConfig: true,
      nodeCompat: true
    },
    // SQLite 驅動為外部解析（bun 用 builtin、node 用原生模組），不打進 bundle。
    // drizzle 的 bun driver 也要一起外部化：它的頂層 import 'bun:sqlite' 一旦被捲進 node bundle，部署就炸
    externals: {
      external: [
        'bun:sqlite',
        'better-sqlite3',
        'drizzle-orm/bun-sqlite',
        'drizzle-orm/bun-sqlite/migrator'
      ]
    }
  },

  vite: {
    plugins: [tailwindcss()]
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
