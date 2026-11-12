<script setup lang="ts">
import RBadge from '../components/rough/RBadge.vue'
import RButton from '../components/rough/RButton.vue'
import RDialog from '../components/rough/RDialog.vue'
import RInput from '../components/rough/RInput.vue'
import RTabs from '../components/rough/RTabs.vue'
import { api } from '../utils/crm'
// 選項管理：進度階段（新增／改名／排序／刪除）＋ 人名選項 ＋ 地點選項
const open = defineModel<boolean>('open', { default: false })

const { flash } = useNotice()

// 相同 URL 的 useFetch 會與清單頁共用快取，這裡 refresh 也會同步名單頁的資料
const { data: stages, refresh: refreshStages } = useFetch('/api/contact-stages', { default: () => [] })
const { data: options, refresh: refreshOptions } = useFetch('/api/contact-options', { default: () => [] })
const { data: locations, refresh: refreshLocations } = useFetch('/api/contact-locations', { default: () => [] })

watch(open, (v) => {
  if (v) {
    refreshStages()
    refreshOptions()
    refreshLocations()
  }
})

const section = ref<'stages' | 'options' | 'locations'>('stages')

const tabs = [
  { key: 'stages', label: '進度階段' },
  { key: 'options', label: '人名選項' },
  { key: 'locations', label: '地點選項' }
]

// ── 進度階段 ─────────────────────────────────────────────────
const newStage = ref('')

async function addStage() {
  const label = newStage.value.trim()
  if (!label) return
  try {
    await api('/api/contact-stages', { method: 'POST', body: { label } })
    newStage.value = ''
    await refreshStages()
  } catch (err: unknown) {
    flash(`新增階段失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function renameStage(stage: ContactStage, label: string) {
  if (!label.trim() || label === stage.label) return
  try {
    await api(`/api/contact-stages/${stage.id}`, { method: 'PATCH', body: { label: label.trim() } })
    await refreshStages()
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
    await refreshStages()
  } catch (err: unknown) {
    flash(`排序失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function removeStage(stage: ContactStage) {
  if (!window.confirm(`刪除階段「${stage.label}」？名單上已完成的勾選會保留，但不再顯示。`)) return
  try {
    await api(`/api/contact-stages/${stage.id}`, { method: 'DELETE' })
    await refreshStages()
  } catch (err: unknown) {
    flash(`刪除階段失敗：${(err as Error)?.message}`, { error: true })
  }
}

// ── 人名選項 / 地點選項 ──────────────────────────────────────
const newOption = ref('')
const newLocation = ref('')

async function addOption() {
  const label = newOption.value.trim()
  if (!label) return
  try {
    await api('/api/contact-options', { method: 'POST', body: { label } })
    newOption.value = ''
    await refreshOptions()
  } catch (err: unknown) {
    flash(`新增人名失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function removeOption(option: ContactOption) {
  try {
    await api(`/api/contact-options/${option.id}`, { method: 'DELETE' })
    await refreshOptions()
  } catch (err: unknown) {
    flash(`刪除人名失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function addLocation() {
  const label = newLocation.value.trim()
  if (!label) return
  try {
    await api('/api/contact-locations', { method: 'POST', body: { label } })
    newLocation.value = ''
    await refreshLocations()
  } catch (err: unknown) {
    flash(`新增地點失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function removeLocation(location: ContactLocation) {
  try {
    await api(`/api/contact-locations/${location.id}`, { method: 'DELETE' })
    await refreshLocations()
  } catch (err: unknown) {
    flash(`刪除地點失敗：${(err as Error)?.message}`, { error: true })
  }
}
</script>

<template>
  <RDialog
    :open="open"
    title="管理階段／選項"
    @update:open="open = $event"
  >
    <RTabs
      v-model="section"
      :tabs="tabs"
    />

    <!-- 進度階段 -->
    <div
      v-if="section === 'stages'"
      class="tab-panel"
    >
      <form
        class="inline-form"
        @submit.prevent="addStage"
      >
        <div class="grow-input">
          <RInput
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
          <RInput
            :model-value="s.label"
            @update:model-value="v => renameStage(s, String(v))"
          />
          <button
            type="button"
            class="row-step"
            :disabled="i === 0"
            title="上移"
            @click="moveStage(s, -1)"
          >
            ↑
          </button>
          <button
            type="button"
            class="row-step"
            :disabled="i === stages!.length - 1"
            title="下移"
            @click="moveStage(s, 1)"
          >
            ↓
          </button>
          <button
            type="button"
            class="row-step row-step--danger"
            title="刪除"
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

    <!-- 人名選項 -->
    <div
      v-else-if="section === 'options'"
      class="tab-panel"
    >
      <form
        class="inline-form"
        @submit.prevent="addOption"
      >
        <div class="grow-input">
          <RInput
            v-model="newOption"
            placeholder="新的人名…"
            @keydown.enter.prevent="addOption"
          />
        </div>
        <RButton
          variant="primary"
          type="submit"
        >
          新增
        </RButton>
      </form>

      <div class="option-chips">
        <span
          v-for="o in options"
          :key="o.id"
          class="option-chip"
        >
          {{ o.label }}
          <button
            type="button"
            class="chip-remove"
            title="刪除"
            @click="removeOption(o)"
          >×</button>
        </span>
        <span
          v-if="!options?.length"
          class="muted-note"
        >還沒有人名選項</span>
      </div>
    </div>

    <!-- 地點選項 -->
    <div
      v-else
      class="tab-panel"
    >
      <form
        class="inline-form"
        @submit.prevent="addLocation"
      >
        <div class="grow-input">
          <RInput
            v-model="newLocation"
            placeholder="新的地點…"
            @keydown.enter.prevent="addLocation"
          />
        </div>
        <RButton
          variant="primary"
          type="submit"
        >
          新增
        </RButton>
      </form>

      <div class="option-chips">
        <span
          v-for="l in locations"
          :key="l.id"
          class="option-chip"
        >
          {{ l.label }}
          <button
            type="button"
            class="chip-remove"
            title="刪除"
            @click="removeLocation(l)"
          >×</button>
        </span>
        <span
          v-if="!locations?.length"
          class="muted-note"
        >還沒有地點選項</span>
      </div>
    </div>
  </RDialog>
</template>
