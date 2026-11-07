<script setup lang="ts">
import {
  api,
  applyContactFilters,
  FOLLOW_UP_FREQ_OPTIONS,
  FOLLOW_UP_FREQ_SHORT,
  isOverdue,
  overdueDays,
  LOCATION_NONE,
  timeAgo,
  type Contact,
  type ContactFilterState,
  type StepFilter
} from '../utils/crm'

const toast = useToast()

// ── 資料 ─────────────────────────────────────────────────────
const { data: contacts, refresh: refreshContacts } = useFetch('/api/contacts', { default: () => [] })
const { data: stages } = useFetch('/api/contact-stages', { default: () => [] })
const { data: locations } = useFetch('/api/contact-locations', { default: () => [] })

// ── 篩選器（比照舊總名單的全組語意）──────────────────────────
const search = ref('')
const stepFilter = ref<StepFilter>('all')
const freqFilter = ref('all')
const locationFilter = ref<string>('all')
const overdueOnly = ref(false)
const sortByNext = ref(false)

const filterState = computed<ContactFilterState>(() => ({
  search: search.value,
  step: stepFilter.value,
  freq: freqFilter.value,
  location: locationFilter.value,
  overdueOnly: overdueOnly.value,
  sortByNext: sortByNext.value
}))

const filtered = computed(() => applyContactFilters(contacts.value || [], filterState.value))

const hasActiveFilter = computed(() =>
  overdueOnly.value
  || stepFilter.value !== 'all'
  || freqFilter.value !== 'all'
  || locationFilter.value !== 'all'
  || !!search.value.trim()
)

const stats = computed(() => {
  const list = contacts.value ?? []
  return {
    total: list.length,
    overdue: list.filter(c => isOverdue(c.nextFollowUp)).length
  }
})

// 進度欄標題顯示：作用中顯示目前階段篩選、未作用則叫「進度」
// （破題不進階段篩選；'broached'/'unbroached' 是純函式保留的能力，UI 不會設出來）
const stepFilterValueLabel = computed(() => {
  if (stepFilter.value !== 'all') {
    return (stages.value ?? []).find(s => String(s.id) === stepFilter.value)?.label ?? ''
  }
  return ''
})

// 進度欄標題點擊：all → 各階段 → all
function cycleStepFilter() {
  const stageIds = (stages.value ?? []).map(s => String(s.id))
  const pool: StepFilter[] = ['all', ...stageIds]
  const idx = pool.indexOf(stepFilter.value)
  stepFilter.value = pool[(idx + 1) % pool.length]!
}

// 跟進頻率欄標題點擊：all → 各頻率 → all
function cycleFreqFilter() {
  const opts = ['all', ...FOLLOW_UP_FREQ_OPTIONS]
  const idx = opts.indexOf(freqFilter.value)
  freqFilter.value = opts[(idx + 1) % opts.length]!
}

// stepFilter 若指向已刪除的階段，畫面會空掉 — 階段清單變動時校正回 all
watch(stages, (list) => {
  if (stepFilter.value !== 'all') {
    const exists = (list ?? []).some(s => String(s.id) === stepFilter.value)
    if (!exists) stepFilter.value = 'all'
  }
})

function clearAllFilters() {
  search.value = ''
  stepFilter.value = 'all'
  freqFilter.value = 'all'
  locationFilter.value = 'all'
  overdueOnly.value = false
  // sortByNext 是排序、不是條件，保留不動
}

const locationFilterItems = computed(() => [
  { label: '全部地點', value: 'all' },
  { label: '未設定', value: LOCATION_NONE },
  ...(locations.value ?? []).map(o => ({ label: o.label, value: o.label }))
])

// ── 明細 modal / 選項管理 modal ──────────────────────────────
const detailContact = ref<Contact | null>(null)
const optionsOpen = ref(false)

// ── patch 工具：樂觀更新 + 失敗回滾 ──────────────────────────
// 注意：useFetch 預設 shallow，就地改 items（contacts.value[i] = x）不會觸發畫面更新
// （舊版正是踩過這坑才加 deep: true）。這裡一律以「換掉整個陣列」的方式更新。
function replaceContact(idx: number, row: Contact) {
  const next = [...(contacts.value ?? [])]
  next[idx] = row
  contacts.value = next
}

async function patchContact(c: Contact, patch: Partial<Contact> & Record<string, unknown>) {
  const idx = contacts.value?.findIndex(x => x.id === c.id)
  if (idx === undefined || idx < 0) return
  const backup = contacts.value![idx]!

  replaceContact(idx, { ...backup, ...patch } as Contact) // 樂觀更新

  try {
    const updated = await api<Contact>(`/api/contacts/${c.id}`, { method: 'PATCH', body: patch })
    replaceContact(idx, updated)
  } catch (err: unknown) {
    replaceContact(idx, backup) // 回滾
    toast.add({ title: `儲存「${c.name}」失敗`, description: (err as Error)?.message, color: 'error' })
  }
}

// ── inline 編輯儲存格（姓名／聯絡方式／位置）──────────────────
const editingKey = ref<string | null>(null)
const editingValue = ref('')

function startEdit(c: Contact, field: 'name' | 'contact' | 'location') {
  editingKey.value = `${field}-${c.id}`
  editingValue.value = field === 'name' ? c.name : field === 'contact' ? c.contact ?? '' : c.location ?? ''
}

function commitEdit(c: Contact, field: 'name' | 'contact' | 'location') {
  editingKey.value = null
  let v = editingValue.value.trim()
  if (field === 'name' && !v) v = c.name // 姓名不可為空
  patchContact(c, { [field]: v || null })
}

function cancelEdit() {
  editingKey.value = null
}

// ── 進度階段切換 ─────────────────────────────────────────────
function toggleStage(c: Contact, stageId: number) {
  const next = c.completedStages.includes(stageId)
    ? c.completedStages.filter(x => x !== stageId)
    : [...c.completedStages, stageId]
  patchContact(c, { completedStages: next })
}

// ── 新增 / 刪除名單 ──────────────────────────────────────────
async function addContact() {
  try {
    const created = await api<Contact>('/api/contacts', { method: 'POST', body: { name: '新名單' } })
    await refreshContacts()
    startEdit(created, 'name') // 建立後直接進入姓名編輯
  } catch (err: unknown) {
    toast.add({ title: '新增名單失敗', description: (err as Error)?.message, color: 'error' })
  }
}

async function removeContact(c: Contact) {
  if (!window.confirm(`確定要刪除「${c.name}」嗎？跟進紀錄也會一起刪除。`)) return
  try {
    await api(`/api/contacts/${c.id}`, { method: 'DELETE' })
    toast.add({ title: `已刪除「${c.name}」`, color: 'neutral' })
    await refreshContacts()
  } catch (err: unknown) {
    toast.add({ title: `刪除「${c.name}」失敗`, description: (err as Error)?.message, color: 'error' })
  }
}

// Esc 取消 inline 編輯
function onEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
  else if (e.key === 'Escape') cancelEdit()
}
</script>

<template>
  <div>
    <!-- 標題列 -->
    <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
      <h1 class="text-2xl sm:text-3xl font-bold sketch-oval">
        總名單
      </h1>

      <p class="text-sm text-muted">
        共 {{ stats.total }} 筆<span v-if="stats.overdue"> · <span class="marker-red">逾期 {{ stats.overdue }} 位</span></span>
      </p>
    </div>

    <!-- 工具列 -->
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="搜尋姓名／聯絡方式…"
        class="min-w-56"
      />
      <UButton
        icon="i-lucide-plus"
        class="sketch-chip"
        color="primary"
        variant="outline"
        @click="addContact"
      >
        新增名單
      </UButton>
      <UButton
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        class="sketch-chip"
        @click="optionsOpen = true"
      >
        管理階段／選項
      </UButton>
    </div>

    <!-- 篩選摘要 -->
    <div
      v-if="hasActiveFilter"
      class="flex items-center gap-2 mb-3 text-sm"
    >
      <UBadge
        variant="outline"
        color="primary"
        class="sketch-chip"
      >
        {{ filtered.length }} / {{ stats.total }} 筆
      </UBadge>
      <UButton
        color="neutral"
        variant="ghost"
        size="xs"
        icon="i-lucide-eraser"
        class="sketch-chip"
        @click="clearAllFilters"
      >
        清除所有篩選
      </UButton>
    </div>

    <!-- 名單表格（手機可橫滑） -->
    <div class="sketch-card p-2 sm:p-4 overflow-x-auto">
      <table class="sketch-table w-full min-w-[760px] text-sm">
        <thead>
          <tr class="text-left text-muted">
            <th class="py-2 px-2 font-bold">
              姓名
            </th>
            <th class="py-2 px-2 font-bold">
              <button
                type="button"
                class="cursor-pointer"
                :class="stepFilterValueLabel ? 'marker bg-transparent -rotate-0.5' : ''"
                title="點擊循環：全部 → 各階段"
                @click="cycleStepFilter"
              >
                {{ stepFilterValueLabel || '進度' }}
              </button>
            </th>
            <th class="py-2 px-2 font-bold">
              <USelect
                v-model="locationFilter"
                :items="locationFilterItems"
                size="xs"
                variant="ghost"
                class="w-24"
                :ui="{ base: 'text-sm font-bold text-muted' }"
              />
            </th>
            <th class="py-2 px-2 font-bold">
              聯絡
            </th>
            <th class="py-2 px-2 font-bold">
              <button
                type="button"
                class="cursor-pointer"
                :class="freqFilter !== 'all' ? 'marker bg-transparent -rotate-0.5' : ''"
                title="點擊循環頻率篩選"
                @click="cycleFreqFilter"
              >
                {{ freqFilter === 'all' ? '跟進' : FOLLOW_UP_FREQ_SHORT[freqFilter] || freqFilter }}
              </button>
            </th>
            <th class="py-2 px-2 font-bold">
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  class="cursor-pointer inline-flex items-center gap-0.5"
                  :class="sortByNext ? 'marker bg-transparent -rotate-0.5' : ''"
                  title="依下次跟進日排序"
                  @click="sortByNext = !sortByNext"
                >
                  下次跟進
                  <UIcon
                    name="i-lucide-arrow-down-narrow-wide"
                    class="size-3"
                    :class="sortByNext ? '' : 'opacity-40'"
                  />
                </button>
                <button
                  v-if="stats.overdue > 0"
                  type="button"
                  class="cursor-pointer sketch-chip px-1.5 text-xs"
                  :class="overdueOnly ? 'marker-red bg-transparent' : 'text-muted'"
                  title="只看逾期"
                  @click="overdueOnly = !overdueOnly"
                >
                  遲 {{ stats.overdue }}
                </button>
              </div>
            </th>
            <th class="py-2 px-2 font-bold w-24" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in filtered"
            :key="c.id"
            :data-id="c.id"
          >
            <!-- 姓名 -->
            <td class="py-2.5 px-2 font-bold text-base align-top">
              <template v-if="editingKey === `name-${c.id}`">
                <input
                  v-model="editingValue"
                  class="w-28 border-2 border-current rounded-md bg-transparent outline-none sketch-chip"
                  @blur="commitEdit(c, 'name')"
                  @keydown="onEditKeydown"
                >
              </template>
              <template v-else>
                <span
                  class="cursor-text hover:underline decoration-wavy"
                  @click="startEdit(c, 'name')"
                >
                  {{ c.name }}
                </span>
              </template>
              <span
                v-if="c.level"
                class="sketch-chip ml-1.5 px-1.5 py-0.5 text-xs text-muted"
              >
                {{ c.level }}
              </span>
            </td>

            <!-- 進度階段 -->
            <td class="py-2.5 px-2 align-top">
              <div class="flex flex-wrap gap-1.5 max-w-64">
                <span
                  v-for="s in stages"
                  :key="s.id"
                  class="sketch-chip px-2 py-0.5 cursor-pointer select-none"
                  :class="c.completedStages.includes(s.id) ? 'marker bg-transparent' : 'opacity-45 text-muted'"
                  :title="`切換階段「${s.label}」`"
                  @click="toggleStage(c, s.id)"
                >
                  {{ s.label }}
                </span>
                <span
                  v-if="!stages?.length"
                  class="text-muted text-xs"
                >先在「管理階段／選項」建立階段</span>
              </div>
            </td>

            <!-- 位置 -->
            <td class="py-2.5 px-2 align-top text-muted min-w-14">
              <template v-if="editingKey === `location-${c.id}`">
                <input
                  v-model="editingValue"
                  class="w-20 border-2 border-current rounded-md bg-transparent outline-none sketch-chip"
                  list="location-options"
                  @blur="commitEdit(c, 'location')"
                  @keydown="onEditKeydown"
                >
              </template>
              <template v-else>
                <span
                  class="cursor-text hover:underline decoration-dotted"
                  @click="startEdit(c, 'location')"
                >
                  {{ c.location ?? '－' }}
                </span>
              </template>
            </td>

            <!-- 聯絡方式 -->
            <td class="py-2.5 px-2 align-top text-muted min-w-32">
              <template v-if="editingKey === `contact-${c.id}`">
                <input
                  v-model="editingValue"
                  class="w-32 border-2 border-current rounded-md bg-transparent outline-none sketch-chip"
                  @blur="commitEdit(c, 'contact')"
                  @keydown="onEditKeydown"
                >
              </template>
              <template v-else>
                <span
                  class="cursor-text hover:underline decoration-dotted"
                  @click="startEdit(c, 'contact')"
                >
                  {{ c.contact ?? '－' }}
                </span>
              </template>
            </td>

            <!-- 跟進頻率 -->
            <td class="py-2.5 px-2 align-top text-muted">
              {{ c.followUpFreq ? FOLLOW_UP_FREQ_SHORT[c.followUpFreq] : '—' }}
            </td>

            <!-- 下次跟進 -->
            <td class="py-2.5 px-2 align-top whitespace-nowrap">
              <template v-if="c.nextFollowUp">
                <span :class="isOverdue(c.nextFollowUp) ? 'marker-red text-sm text-inherit px-0.5' : ''">
                  {{ c.nextFollowUp }}
                </span>
                <UBadge
                  v-if="isOverdue(c.nextFollowUp)"
                  color="error"
                  variant="outline"
                  class="sketch-chip ml-1"
                >
                  遲 {{ overdueDays(c.nextFollowUp) }}天
                </UBadge>
                <span
                  v-else
                  class="text-muted text-xs ml-1"
                >{{ timeAgo(c.nextFollowUp) === '今天' ? '今天' : '' }}</span>
              </template>
              <span
                v-else
                class="text-muted"
              >—</span>
            </td>

            <!-- 動作 -->
            <td class="py-2.5 px-2 align-top whitespace-nowrap">
              <UButton
                icon="i-lucide-file-text"
                size="xs"
                variant="ghost"
                color="primary"
                title="明細"
                @click="detailContact = c"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                variant="ghost"
                color="error"
                title="刪除"
                @click="removeContact(c)"
              />
            </td>
          </tr>

          <tr v-if="!filtered.length">
            <td
              colspan="7"
              class="py-10 text-center text-muted"
            >
              <template v-if="search">
                找不到符合「{{ search }}」的名單
              </template>
              <template v-else>
                還沒有任何人名 🔍 按上面的「新增名單」開始
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <datalist id="location-options">
        <option
          v-for="l in locations"
          :key="l.id"
          :value="l.label"
        />
      </datalist>
    </div>

    <!-- 明細 modal（v-model:contact：子元件 defineModel('contact') 的命名對應） -->
    <ContactDetailModal
      v-model:contact="detailContact"
      @refresh="refreshContacts"
    />

    <!-- 選項管理 modal -->
    <ContactOptionsModal v-model:open="optionsOpen" />
  </div>
</template>
