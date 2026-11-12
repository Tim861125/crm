<script setup lang="ts">
import RBadge from '../components/rough/RBadge.vue'
import RButton from '../components/rough/RButton.vue'
import RDialog from '../components/rough/RDialog.vue'
import RInput from '../components/rough/RInput.vue'
import { api } from '../utils/crm'
// 選項管理 dialog（單頁模式）：mode 決定內容 —
// stages＝進度階段（新增／改名／排序／刪除）；options＝人名選項；locations＝地點選項
const open = defineModel<boolean>('open', { default: false })
const props = defineProps<{ mode: 'stages' | 'options' | 'locations' }>()

const titles = {
  stages: '管理進度階段',
  options: '管理人名選項',
  locations: '管理地點選項'
} as const
const title = computed(() => titles[props.mode])

const { flash } = useNotice()

// 相同 URL 的 useFetch 會與清單頁共用快取，這裡 refresh 也會同步名單頁的資料
const { data: stages, refresh: refreshStages } = useFetch('/api/contact-stages', { default: () => [] })
const { data: options, refresh: refreshOptions } = useFetch('/api/contact-options', { default: () => [] })
const { data: locations, refresh: refreshLocations } = useFetch('/api/contact-locations', { default: () => [] })

watch(open, (v) => {
  if (!v) return
  if (props.mode === 'stages') refreshStages()
  else if (props.mode === 'options') refreshOptions()
  else refreshLocations()
})

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
    :title="title"
    @update:open="open = $event"
  >
    <!-- 進度階段 -->
    <div
      v-if="props.mode === 'stages'"
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
          <RInput
            v-model="newStage"
            aria-label="新階段名稱"
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
            :model-value="stageDrafts[s.id] ?? s.label"
            :aria-label="`階段名稱：${s.label}`"
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

    <!-- 人名選項 -->
    <div
      v-else-if="props.mode === 'options'"
      class="tab-panel"
      role="group"
      :aria-label="title"
      tabindex="0"
    >
      <form
        class="inline-form"
        @submit.prevent="addOption"
      >
        <div class="grow-input">
          <RInput
            v-model="newOption"
            aria-label="新的人名"
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
            :aria-label="`刪除人名「${o.label}」`"
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
      role="group"
      :aria-label="title"
      tabindex="0"
    >
      <form
        class="inline-form"
        @submit.prevent="addLocation"
      >
        <div class="grow-input">
          <RInput
            v-model="newLocation"
            aria-label="新的地點"
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
            :aria-label="`刪除地點「${l.label}」`"
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
