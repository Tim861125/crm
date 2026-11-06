import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // 清單系統的頁面/組件多為常用中文名稱對不上 multi-word 命名規則，直接關閉
  { rules: { 'vue/multi-word-component-names': 'off' } }
)
