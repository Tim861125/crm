// https://nuxt.com/docs/api/configuration/nuxt-config
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

  css: ['~/assets/css/main.css'],

  devServer: {
    port: 1138
  },

  compatibilityDate: '2025-01-15',

  nitro: {
    // SQLite 驅動為外部解析（bun 用 builtin、node 用原生模組），不打進 bundle
    externals: {
      external: ['bun:sqlite', 'better-sqlite3']
    }
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
