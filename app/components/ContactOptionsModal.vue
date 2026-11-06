<script setup lang="ts">
import { api } from '../utils/crm'
// 選項管理：進度階段（新增／改名／排序／刪除）＋ 人名選項 ＋ 地點選項
const open = defineModel<boolean>('open', { default: false })

const toast = useToast()

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

const tabItems = [
  { label: '進度階段', icon: 'i-lucide-milestone', value: 'stages' },
  { label: '人名選項', icon: 'i-lucide-users', value: 'options' },
  { label: '地點選項', icon: 'i-lucide-map-pin', value: 'locations' }
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
    toast.add({ title: '新增階段失敗', description: (err as Error)?.message, color: 'error' })
  }
}

async function renameStage(stage: ContactStage, label: string) {
  if (!label.trim() || label === stage.label) return
  try {
    await api(`/api/contact-stages/${stage.id}`, { method: 'PATCH', body: { label: label.trim() } })
    await refreshStages()
  } catch (err: unknown) {
    toast.add({ title: '改名失敗', description: (err as Error)?.message, color: 'error' })
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
    toast.add({ title: '排序失敗', description: (err as Error)?.message, color: 'error' })
  }
}

async function removeStage(stage: ContactStage) {
  if (!window.confirm(`刪除階段「${stage.label}」？名單上已完成的勾選會保留，但不再顯示。`)) return
  try {
    await api(`/api/contact-stages/${stage.id}`, { method: 'DELETE' })
    await refreshStages()
  } catch (err: unknown) {
    toast.add({ title: '刪除階段失敗', description: (err as Error)?.message, color: 'error' })
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
    toast.add({ title: '新增人名失敗', description: (err as Error)?.message, color: 'error' })
  }
}

async function removeOption(option: ContactOption) {
  try {
    await api(`/api/contact-options/${option.id}`, { method: 'DELETE' })
    await refreshOptions()
  } catch (err: unknown) {
    toast.add({ title: '刪除人名失敗', description: (err as Error)?.message, color: 'error' })
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
    toast.add({ title: '新增地點失敗', description: (err as Error)?.message, color: 'error' })
  }
}

async function removeLocation(location: ContactLocation) {
  try {
    await api(`/api/contact-locations/${location.id}`, { method: 'DELETE' })
    await refreshLocations()
  } catch (err: unknown) {
    toast.add({ title: '刪除地點失敗', description: (err as Error)?.message, color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="管理階段／選項"
    :ui="{ content: 'max-w-xl' }"
  >
    <template #body>
      <UTabs
        v-model="section"
        :items="tabItems"
        color="primary"
        variant="link"
        class="mb-4"
      />

      <!-- 進度階段 -->
      <div
        v-if="section === 'stages'"
        class="space-y-3"
      >
        <form
          class="flex gap-2"
          @submit.prevent="addStage"
        >
          <UInput
            v-model="newStage"
            placeholder="新階段名稱…"
            class="grow"
            @keydown.enter.prevent="addStage"
          />
          <UButton
            type="submit"
            color="primary"
            variant="outline"
            class="sketch-chip"
          >
            新增
          </UButton>
        </form>

        <ul class="space-y-1.5">
          <li
            v-for="(s, i) in stages"
            :key="s.id"
            class="flex items-center gap-2"
          >
            <UBadge
              neutral
              variant="outline"
              class="sketch-chip w-7 text-center justify-center shrink-0"
            >
              {{ i + 1 }}
            </UBadge>
            <UInput
              :model-value="s.label"
              class="grow"
              size="sm"
              @update:model-value="v => renameStage(s, String(v))"
            />
            <UButton
              icon="i-lucide-arrow-up"
              size="xs"
              variant="ghost"
              color="primary"
              :disabled="i === 0"
              title="上移"
              @click="moveStage(s, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              size="xs"
              variant="ghost"
              color="primary"
              :disabled="i === stages!.length - 1"
              title="下移"
              @click="moveStage(s, 1)"
            />
            <UButton
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="error"
              title="刪除"
              @click="removeStage(s)"
            />
          </li>
          <li
            v-if="!stages?.length"
            class="text-muted text-sm"
          >
            還沒有階段，加個「2」「加入」之類的名稱試試 ✏️
          </li>
        </ul>
      </div>

      <!-- 人名選項 -->
      <div
        v-else-if="section === 'options'"
        class="space-y-3"
      >
        <form
          class="flex gap-2"
          @submit.prevent="addOption"
        >
          <UInput
            v-model="newOption"
            placeholder="新的人名…"
            class="grow"
            @keydown.enter.prevent="addOption"
          />
          <UButton
            type="submit"
            color="primary"
            variant="outline"
            class="sketch-chip"
          >
            新增
          </UButton>
        </form>

        <div class="flex flex-wrap gap-2">
          <span
            v-for="o in options"
            :key="o.id"
            class="sketch-chip inline-flex items-center gap-1 px-2 py-1 text-sm"
          >
            {{ o.label }}
            <UButton
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="error"
              @click="removeOption(o)"
            />
          </span>
          <span
            v-if="!options?.length"
            class="text-muted text-sm"
          >還沒有人名選項</span>
        </div>
      </div>

      <!-- 地點選項 -->
      <div
        v-else
        class="space-y-3"
      >
        <form
          class="flex gap-2"
          @submit.prevent="addLocation"
        >
          <UInput
            v-model="newLocation"
            placeholder="新的地點…"
            class="grow"
            @keydown.enter.prevent="addLocation"
          />
          <UButton
            type="submit"
            color="primary"
            variant="outline"
            class="sketch-chip"
          >
            新增
          </UButton>
        </form>

        <div class="flex flex-wrap gap-2">
          <span
            v-for="l in locations"
            :key="l.id"
            class="sketch-chip inline-flex items-center gap-1 px-2 py-1 text-sm"
          >
            {{ l.label }}
            <UButton
              icon="i-lucide-x"
              size="xs"
              variant="ghost"
              color="error"
              @click="removeLocation(l)"
            />
          </span>
          <span
            v-if="!locations?.length"
            class="text-muted text-sm"
          >還沒有地點選項</span>
        </div>
      </div>
    </template>
  </UModal>
</template>
