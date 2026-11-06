import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    // @nuxt/test-utils 的 e2e setup 需要 fork pool（server 進程與 $fetch 綁定同進程）
    pool: 'forks'
  }
})
