<script setup lang="ts">
import RBadge from '../components/rough/RBadge.vue'
import RButton from '../components/rough/RButton.vue'
import RDialog from '../components/rough/RDialog.vue'
import RInput from '../components/rough/RInput.vue'
import { api } from '../utils/crm'
// 進度階段管理 dialog：新增／改名／排序／刪除。
// （地點選項已改在 RCombobox 編輯下拉內直接增刪，見 ContactList.vue）
const open = defineModel<boolean>('open', { default: false })

const title = '管理進度階段'

const { flash } = useNotice()
const { confirm } = useConfirm()

// 同 URL 的 useFetch 快取只在初次共享：本元件 refresh() 不會同步到其他元件
// （A/B 實測舊版亦然），因此每次成功變更都 emit refresh，由父層刷新自己的清單
// （比照 ContactDetailModal 的 refresh 事件模式）
const emit = defineEmits<{ refresh: [] }>()

// 資料成功變更後：刷新本元件列表＋通知父層
async function afterMutation(refresh: () => Promise<unknown>) {
  await refresh()
  emit('refresh')
}
const { data: stages, refresh: refreshStages } = useFetch('/api/contact-stages', { default: () => [] })

watch(open, (v) => {
  if (v) refreshStages()
})

// ── 進度階段 ─────────────────────────────────────────────────
const newStage = ref('')

async function addStage() {
  const label = newStage.value.trim()
  if (!label) return
  try {
    await api('/api/contact-stages', { method: 'POST', body: { label } })
    newStage.value = ''
    await afterMutation(refreshStages)
  } catch (err: unknown) {
    flash(`新增階段失敗：${(err as Error)?.message}`, { error: true })
  }
}

// 改名採本地草稿：避免每個鍵入都發 PATCH（且 refresh 會打斷輸入），失焦或 Enter 才提交
const stageDrafts = ref<Record<number, string>>({})

async function commitRename(stage: ContactStage) {
  const label = stageDrafts.value[stage.id]
  if (label === undefined) return
  stageDrafts.value = Object.fromEntries(
    Object.entries(stageDrafts.value).filter(([k]) => k !== String(stage.id))
  )
  if (!label.trim() || label.trim() === stage.label) return
  try {
    await api(`/api/contact-stages/${stage.id}`, { method: 'PATCH', body: { label: label.trim() } })
    await afterMutation(refreshStages)
  } catch (err: unknown) {
    flash(`改名失敗：${(err as Error)?.message}`, { error: true })
  }
}

// 相鄰兩階段交換排序（依回傳清單的順序）
async function moveStage(stage: ContactStage, dir: -1 | 1) {
  const list = stages.value || []
  const idx = list.findIndex(s => s.id === stage.id)
  const other = list[idx + dir]
  if (!other) return
  try {
    await Promise.all([
      api(`/api/contact-stages/${stage.id}`, { method: 'PATCH', body: { sortOrder: other.sortOrder } }),
      api(`/api/contact-stages/${other.id}`, { method: 'PATCH', body: { sortOrder: stage.sortOrder } })
    ])
    await afterMutation(refreshStages)
  } catch (err: unknown) {
    flash(`排序失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function removeStage(stage: ContactStage) {
  const ok = await confirm({
    title: '刪除階段',
    message: `刪除階段「${stage.label}」？名單上已完成的勾選會保留，但不再顯示。`,
    confirmLabel: '刪除',
    danger: true
  })
  if (!ok) return
  try {
    await api(`/api/contact-stages/${stage.id}`, { method: 'DELETE' })
    await afterMutation(refreshStages)
  } catch (err: unknown) {
    flash(`刪除階段失敗：${(err as Error)?.message}`, { error: true })
  }
}
</script>

<template>
  <RDialog
    :open="open"
    :title="title"
    @update:open="open = $event"
  >
    <!-- 進度階段 -->
    <div
      class="tab-panel"
      role="group"
      :aria-label="title"
      tabindex="0"
    >
      <form
        class="inline-form"
        @submit.prevent="addStage"
      >
        <div class="grow-input">
          <!-- placeholder 不是可靠的 accessible name（填入即消失）：改真實 <label>（SR-only 不動版面） -->
          <label
            class="sr-only"
            for="stage-new-name"
          >新階段名稱</label>
          <RInput
            id="stage-new-name"
            v-model="newStage"
            placeholder="新階段名稱…"
            @keydown.enter.prevent="addStage"
          />
        </div>
        <RButton
          variant="primary"
          type="submit"
        >
          新增
        </RButton>
      </form>

      <ul class="plain-list">
        <li
          v-for="(s, i) in stages"
          :key="s.id"
          class="stage-row"
        >
          <RBadge
            tone="gray"
            class="stage-index"
          >
            {{ i + 1 }}
          </RBadge>
          <!-- 同新增列：真實 <label>（含階段名，list 逐列朗讀時才知道改到哪一列） -->
          <label
            class="sr-only"
            :for="`stage-rename-${s.id}`"
          >階段名稱：{{ s.label }}</label>
          <RInput
            :id="`stage-rename-${s.id}`"
            :model-value="stageDrafts[s.id] ?? s.label"
            @update:model-value="v => (stageDrafts[s.id] = String(v))"
            @blur="commitRename(s)"
            @keydown.enter.prevent="commitRename(s)"
          />
          <button
            type="button"
            class="row-step"
            :disabled="i === 0"
            title="上移"
            :aria-label="`上移階段「${s.label}」`"
            @click="moveStage(s, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="row-step"
            :disabled="i === stages!.length - 1"
            title="下移"
            :aria-label="`下移階段「${s.label}」`"
            @click="moveStage(s, 1)"
          >
            ↓
          </button>
          <button
            type="button"
            class="row-step row-step--danger"
            title="刪除"
            :aria-label="`刪除階段「${s.label}」`"
            @click="removeStage(s)"
          >
            ×
          </button>
        </li>
        <li
          v-if="!stages?.length"
          class="muted-note"
        >
          還沒有階段，加個「2」「加入」之類的名稱試試 ✏️
        </li>
      </ul>
    </div>
  </RDialog>
</template>
