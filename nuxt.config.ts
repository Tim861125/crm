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
