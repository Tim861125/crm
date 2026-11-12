<script setup lang="ts">
import type { Contact } from '../utils/crm'

// 每日任務頁：今日跟進智慧清單置頂 ＋ 四區塊工作表（共用同一份明細 modal）
useSeoMeta({ title: '每日任務' })

// 明細 modal（跨區塊共用）：點姓名開啟；任何儲存 → tick++ 讓清單重抓
const detailContact = ref<Contact | null>(null)
const tick = ref(0)
function refreshAll() {
  tick.value++
}
</script>

<template>
  <div class="daily-page">
    <section>
      <div class="page-heading">
        <h1>今日跟進</h1>
        <p>總名單裡今天該先找誰，照熱度排好了 ✏️</p>
      </div>

      <TodayFollowUp
        :tick="tick"
        @detail="detailContact = $event"
      />
    </section>

    <section>
      <div class="page-heading">
        <h2 class="page-heading__sub">
          每日任務四區塊
        </h2>
        <p>開發／預備／五人／織網，四張名單卡 🌱</p>
      </div>

      <ProspectWorksheet
        :tick="tick"
        @detail="detailContact = $event"
      />
    </section>

    <!-- 明細 modal（v-model:contact：子元件 defineModel('contact') 的命名對應） -->
    <ContactDetailModal
      v-model:contact="detailContact"
      @refresh="refreshAll"
    />
  </div>
</template>
