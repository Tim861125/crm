<script setup lang="ts">
import PlanCard from '../components/PlanCard.vue'
import PlanEditor from '../components/PlanEditor.vue'
import RButton from '../components/rough/RButton.vue'
import RCard from '../components/rough/RCard.vue'
import { api, todayStr, type Contact, type PlanWithStats } from '../utils/crm'
import type { PlanStatus } from '#shared/utils/planEval'

// 制定計畫頁：把群體層級的策略做成計畫卡——現象→方法→圈人→覆核窗，
// 「有沒有用」由圈選對象在期間内的跟進紀錄自動推算（plans/index.get.ts）。
useSeoMeta({ title: '制定計畫' })

const today = todayStr()

const { data: plans, status, refresh: refreshPlans } = useFetch<PlanWithStats[]>('/api/plans', { default: () => [] })
const { data: contacts } = useFetch<Contact[]>('/api/contacts', { default: () => [] })

const editorOpen = ref(false)
const editing = ref<PlanWithStats | null>(null)
function openNew() {
  editing.value = null
  editorOpen.value = true
}
function openEdit(plan: PlanWithStats) {
  editing.value = plan
  editorOpen.value = true
}

const { flash } = useNotice()
const { confirm } = useConfirm()

// 狀態一鍵流轉：PATCH 單欄，成功後重抓（stats 也隨之更新）
const busyIds = ref<Set<number>>(new Set())
async function setStatus(plan: PlanWithStats, next: PlanStatus) {
  if (busyIds.value.has(plan.id)) return
  busyIds.value = new Set(busyIds.value).add(plan.id)
  try {
    await api(`/api/plans/${plan.id}`, { method: 'PATCH', body: { status: next } })
    const done = next === 'done' ? '收工 🎉' : next === 'active' ? '開跑 🚀' : '收回構想'
    flash(`「${plan.name}」${done}`)
    await refreshPlans()
  } catch (err: unknown) {
    flash(`更新狀態失敗：${(err as Error)?.message}`, { error: true })
  } finally {
    const s = new Set(busyIds.value)
    s.delete(plan.id)
    busyIds.value = s
  }
}

async function remove(plan: PlanWithStats) {
  const ok = await confirm({
    title: '刪除計畫',
    message: `確定刪除「${plan.name}」？圈選只是快照，總名單與跟進紀錄都不受影響。`,
    confirmLabel: '刪除',
    danger: true
  })
  if (!ok) return
  try {
    await api(`/api/plans/${plan.id}`, { method: 'DELETE' })
    flash(`已刪除「${plan.name}」`)
    await refreshPlans()
  } catch (err: unknown) {
    flash(`刪除失敗：${(err as Error)?.message}`, { error: true })
  }
}
</script>

<template>
  <div class="plans-page">
    <section>
      <div class="page-heading">
        <h1>制定計畫</h1>
        <RButton
          variant="primary"
          @click="openNew()"
        >
          擬新計畫
        </RButton>
      </div>
    </section>

    <section
      v-if="(plans || []).length"
      class="plan-grid"
    >
      <PlanCard
        v-for="p in plans"
        :key="p.id"
        :plan="p"
        :contacts="contacts || []"
        :today="today"
        @edit="openEdit"
        @status="setStatus"
        @remove="remove"
      />
    </section>

    <RCard v-else-if="status === 'pending'">
      <div class="empty-state">
        載入中…
      </div>
    </RCard>

    <RCard v-else>
      <div class="empty-state">
        <p>還沒有計畫 ✏️</p>
        <RButton
          variant="primary"
          @click="openNew()"
        >
          擬第一個計畫
        </RButton>
      </div>
    </RCard>

    <PlanEditor
      v-model:open="editorOpen"
      :plan="editing"
      :contacts="contacts || []"
      :today="today"
      @saved="refreshPlans()"
    />
  </div>
</template>
