<script setup lang="ts">
// 手繪感線條圖示：微彎筆畫＋圓頭（比照 RCheckbox／RSelect 手繪折線語彙），
// 全部 stroke=currentColor，尺寸由 CSS 控制（見 .icon-scribble）。
// 語意依使用場合：旁邊有文字＝裝飾（預設 aria-hidden）；單獨承義時傳 label 給無障礙名字。
const props = withDefaults(defineProps<{ name: string, label?: string }>(), { label: '' })

// 描線部分
const PATHS: Record<string, string[]> = {
  // 不讀不回：兩顆 Z（睡著已讀不回）
  zzz: ['M5.5 10.5H10L5.5 15H10', 'M12.5 4.5H18L12.5 10H18'],
  // 發廣告：喇叭＋手柄
  megaphone: ['M4.5 12C9 9 14 7 19.5 5.5V18.5C14 17 9 15 4.5 12Z', 'M8 14.5V18', 'M6.3 18.2h3.6'],
  // LINE／訊息：對話框
  chat: ['M5 4.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 3.8V16.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z'],
  // IG 限動／貼文：圓角框＋中央圈
  story: ['M7.5 3.5h9a4 4 0 0 1 4 4v9a4 4 0 0 1-4 4h-9a4 4 0 0 1-4-4v-9a4 4 0 0 1 4-4Z', 'M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z'],
  // 群發貼文：紙飛機
  send: ['M20.5 3.5 3.5 10.8l7 2.4 2.4 7 7.6-16.7Z', 'M10.5 13.2l10-9.7'],
  // 打電話
  phone: ['M5.5 3.5H9l1.5 4-2 1.6a12.5 12.5 0 0 0 6.8 6.8l1.6-2 4 1.5V19a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2Z'],
  // 見面邀約：咖啡杯＋熱氣
  cup: ['M4.5 8.5h11V14a4 4 0 0 1-4 4h-3a4 4 0 0 1-4-4V8.5Z', 'M15.5 10h1.6a2 2 0 0 1 0 4h-1.6', 'M8 3.2c.8.9.8 1.8 0 2.7', 'M12 3.2c.8.9.8 1.8 0 2.7'],
  // 其他方法／預設：飛鏢靶（外圈＋內圈＋實心中心點）
  target: ['M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z'],
  // 圈選人數：兩人
  users: ['M9.8 11a3.3 3.3 0 1 0 0-6.6A3.3 3.3 0 0 0 9.8 11Z', 'M3.8 19.5c.9-3.4 3.2-5 6-5s5.1 1.6 6 5', 'M16.5 5.2a2.6 2.6 0 1 1 .8 5', 'M17.5 14.8c1.9.7 3.1 2.1 3.7 4'],
  // 管道覆蓋：訊號塔（中心實心點＋四段波弧）
  radio: ['M8.6 15.6a5 5 0 0 1 0-7.2', 'M15.4 8.4a5 5 0 0 1 0 7.2', 'M6 18.2a9 9 0 0 1 0-12.4', 'M18 5.8a9 9 0 0 1 0 12.4'],
  // 仍在停擺：沙漏
  hourglass: ['M7 3.5h10', 'M7 20.5h10', 'M8 3.5c0 3.8 8 4.7 8 8.5s-8 4.7-8 8.5', 'M16 3.5c0 3.8-8 4.7-8 8.5s8 4.7 8 8.5'],
  // 沒聯絡：時鐘
  clock: ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z', 'M12 8v4.5l3 2'],
  // 期間：月曆
  calendar: ['M4.5 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V8Z', 'M4.5 9.5h15', 'M8.5 4V6.2', 'M15.5 4V6.2'],
  // 編輯：鉛筆
  pencil: ['M4.5 19.5h4L20 8a2.2 2.2 0 0 0-3-3L5.5 16.5l-1 3Z', 'M15.5 6.5l3 3'],
  // 刪除：垃圾桶
  trash: ['M5 6.8h14', 'M9.5 6.8V5h5v1.8', 'M6.5 8.5h11', 'M8 8.5l.7 10.5a1.5 1.5 0 0 0 1.5 1.4h3.6a1.5 1.5 0 0 0 1.5-1.4L16 8.5', 'M10.8 11.5v5.5', 'M13.2 11.5v5.5'],
  // 現象→方法 流程箭頭
  arrow: ['M3.5 12c5.5-1.2 11.5-1.2 16.5 0', 'M16 8.5l4.2 3.6-4.4 3.4']
}

// 實心小圓點（以 currentColor 填色）：靶心、訊號中心、IG 右上點
const DOTS: Record<string, string[]> = {
  target: ['M12 11.1a.9.9 0 1 0 .01 0'],
  radio: ['M12 12.1a1.5 1.5 0 1 0 .01 0'],
  story: ['M16.8 6.8a.6.6 0 1 0 .01 0']
}

const paths = () => PATHS[props.name] ?? PATHS.target
const dots = () => DOTS[props.name] ?? []
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="icon-scribble"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : true"
    :role="label ? 'img' : undefined"
  >
    <path
      v-for="(d, i) in paths()"
      :key="`l${i}`"
      :d="d"
    />
    <path
      v-for="(d, i) in dots()"
      :key="`d${i}`"
      :d="d"
      fill="currentColor"
      stroke="none"
    />
  </svg>
</template>
