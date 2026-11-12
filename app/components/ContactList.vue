<script setup lang="ts">
import RBadge from '../components/rough/RBadge.vue'
import RButton from '../components/rough/RButton.vue'
import RInput from '../components/rough/RInput.vue'
import RSelect from '../components/rough/RSelect.vue'
import ContactDetailModal from './ContactDetailModal.vue'
import ContactOptionsModal from './ContactOptionsModal.vue'
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

const { flash } = useNotice()

// ── 資料 ─────────────────────────────────────────────────────
const { data: contacts, status: contactsStatus, error: contactsError, refresh: refreshContacts } = useFetch('/api/contacts', { default: () => [] })
const { data: stages, refresh: refreshStages } = useFetch('/api/contact-stages', { default: () => [] })
const { data: locations, refresh: refreshLocations } = useFetch('/api/contact-locations', { default: () => [] })

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

// locationFilter 指到已刪除的地點同樣會空榜（select 變空白值）— 同樣校正回 all
watch(locations, (list) => {
  if (locationFilter.value !== 'all' && locationFilter.value !== LOCATION_NONE) {
    const exists = (list ?? []).some(l => l.label === locationFilter.value)
    if (!exists) locationFilter.value = 'all'
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

// ── 明細 modal / 各管理 dialog ───────────────────────────────
const detailContact = ref<Contact | null>(null)
const stagesOpen = ref(false)
const locationsOpen = ref(false)

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
    flash(`儲存「${c.name}」失敗：${(err as Error)?.message}`, { error: true })
  }
}

// ── inline 編輯儲存格（姓名／聯絡方式／位置）──────────────────
const editingKey = ref<string | null>(null)
const editingValue = ref('')

function startEdit(c: Contact, field: 'name' | 'contact' | 'location') {
  editingKey.value = `${field}-${c.id}`
  editingValue.value = field === 'name' ? c.name : field === 'contact' ? c.contact ?? '' : c.location ?? ''
  // 進入編輯後聚焦輸入框（巨集按新增時直接打字；鍵盤操作不需再點一次）
  void nextTick(() => {
    const input = document.querySelector<HTMLInputElement>(`input.cell-input[data-edit="${editingKey.value}"]`)
    input?.focus()
    input?.select()
  })
}

function commitEdit(c: Contact, field: 'name' | 'contact' | 'location') {
  editingKey.value = null
  let v = editingValue.value.trim()
  if (field === 'name' && !v) v = c.name // 姓名不可為空
  patchContact(c, { [field]: v || null })
}

function cancelEdit() {
  const key = editingKey.value
  editingKey.value = null
  // Esc 取消後把焦點還給原儲存格按鈕，鍵盤操作不斷線
  void nextTick(() => document.querySelector<HTMLButtonElement>(`button.cell-edit[data-edit-target="${key}"]`)?.focus())
}

// ── 進度階段切換 ─────────────────────────────────────────────
function toggleStage(c: Contact, stageId: number) {
  const next = c.completedStages.includes(stageId)
    ? c.completedStages.filter(x => x !== stageId)
    : [...c.completedStages, stageId]
  patchContact(c, { completedStages: next })
}

// ── 新增 / 刪除名單 ──────────────────────────────────────────
const adding = ref(false)

async function addContact() {
  if (adding.value) return // 防止連點重複建立
  adding.value = true
  try {
    const created = await api<Contact>('/api/contacts', { method: 'POST', body: { name: '新名單' } })
    await refreshContacts()
    startEdit(created, 'name') // 建立後直接進入姓名編輯
  } catch (err: unknown) {
    flash(`新增名單失敗：${(err as Error)?.message}`, { error: true })
  } finally {
    adding.value = false
  }
}

async function removeContact(c: Contact) {
  if (!window.confirm(`確定要刪除「${c.name}」嗎？跟進紀錄也會一起刪除。`)) return
  try {
    await api(`/api/contacts/${c.id}`, { method: 'DELETE' })
    flash(`已刪除「${c.name}」`)
    await refreshContacts()
  } catch (err: unknown) {
    flash(`刪除「${c.name}」失敗：${(err as Error)?.message}`, { error: true })
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
    <div class="page-heading">
      <h1>總名單</h1>
      <p>
        共 {{ stats.total }} 筆<span v-if="stats.overdue"> · <span class="marker-red">逾期 {{ stats.overdue }} 位</span></span>
      </p>
    </div>

    <!-- 工具列 -->
    <div class="list-toolbar">
      <div class="list-search">
        <RInput
          v-model="search"
          type="search"
          aria-label="搜尋姓名或聯絡方式"
          placeholder="搜尋姓名／聯絡方式…"
        />
      </div>
      <RButton
        variant="primary"
        :disabled="adding"
        @click="addContact"
      >
        {{ adding ? '新增中…' : '新增名單' }}
      </RButton>
    </div>

    <!-- 篩選摘要 -->
    <div
      v-if="hasActiveFilter"
      class="filter-summary"
    >
      <RBadge tone="yellow">
        {{ filtered.length }} / {{ stats.total }} 筆
      </RBadge>
      <button
        type="button"
        class="link-button"
        @click="clearAllFilters"
      >
        清除所有篩選
      </button>
    </div>

    <!-- 名單表格（手機可橫滑；tabindex 讓鍵盤也能捲動此區域） -->
    <div
      class="list-scroll"
      tabindex="0"
      role="region"
      aria-label="名單表格，可橫向捲動"
    >
      <table class="r-table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>
              <div class="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  class="th-filter"
                  title="點擊管理進度階段"
                  aria-haspopup="dialog"
                  @click="stagesOpen = true"
                >
                  進度
                </button>
                <button
                  type="button"
                  class="th-filter"
                  :class="{ 'is-active': !!stepFilterValueLabel }"
                  :aria-label="stepFilterValueLabel ? `進度篩選：${stepFilterValueLabel}，點擊換下一個` : '依進度篩選：全部，點擊開始循環階段'"
                  title="循環進度篩選"
                  @click="cycleStepFilter"
                >
                  {{ stepFilterValueLabel || '篩選' }}
                </button>
              </div>
            </th>
            <th>
              <div class="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  class="th-filter"
                  title="點擊管理地點選項"
                  aria-haspopup="dialog"
                  @click="locationsOpen = true"
                >
                  地點
                </button>
                <div class="th-select">
                  <RSelect
                    v-model="locationFilter"
                    aria-label="依地點篩選"
                    :options="locationFilterItems"
                  />
                </div>
              </div>
            </th>
            <th>聯絡</th>
            <th>
              <button
                type="button"
                class="th-filter"
                :class="{ 'is-active': freqFilter !== 'all' }"
                :aria-label="freqFilter === 'all' ? '依跟進頻率篩選：全部，點擊開始循環' : `跟進頻率篩選：${FOLLOW_UP_FREQ_SHORT[freqFilter] || freqFilter}，點擊換下一個`"
                title="點擊循環頻率篩選"
                @click="cycleFreqFilter"
              >
                {{ freqFilter === 'all' ? '跟進' : FOLLOW_UP_FREQ_SHORT[freqFilter] || freqFilter }}
              </button>
            </th>
            <th :aria-sort="sortByNext ? 'descending' : undefined">
              <button
                type="button"
                class="th-filter"
                :class="{ 'is-active': sortByNext }"
                :aria-pressed="sortByNext"
                aria-label="依下次跟進日排序"
                title="依下次跟進日排序"
                @click="sortByNext = !sortByNext"
              >
                下次跟進 <span
                  class="sort-arrow"
                  :class="{ 'is-off': !sortByNext }"
                  aria-hidden="true"
                >↓</span>
              </button>
              <button
                v-if="stats.overdue > 0"
                type="button"
                class="overdue-toggle"
                :class="{ 'is-active': overdueOnly }"
                :aria-pressed="overdueOnly"
                :aria-label="`只看逾期（${stats.overdue} 位）`"
                title="只看逾期"
                @click="overdueOnly = !overdueOnly"
              >
                遲 {{ stats.overdue }}
              </button>
            </th>
            <th style="width: 150px" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in filtered"
            :key="c.id"
            :data-id="c.id"
          >
            <!-- 姓名 -->
            <td>
              <template v-if="editingKey === `name-${c.id}`">
                <input
                  v-model="editingValue"
                  class="cell-input"
                  :data-edit="`name-${c.id}`"
                  aria-label="編輯姓名"
                  @blur="commitEdit(c, 'name')"
                  @keydown="onEditKeydown"
                >
              </template>
              <template v-else>
                <button
                  type="button"
                  class="cell-edit"
                  :data-edit-target="`name-${c.id}`"
                  :aria-label="`編輯姓名「${c.name}」`"
                  title="點擊編輯姓名"
                  @click="startEdit(c, 'name')"
                >
                  {{ c.name }}
                </button>
                <RBadge
                  v-if="c.level"
                  tone="gray"
                >
                  {{ c.level }}
                </RBadge>
              </template>
            </td>

            <!-- 進度階段 -->
            <td>
              <template v-if="stages?.length">
                <button
                  v-for="s in stages"
                  :key="s.id"
                  type="button"
                  class="stage-chip"
                  :class="{ 'is-done': c.completedStages.includes(s.id) }"
                  :aria-pressed="c.completedStages.includes(s.id)"
                  :aria-label="`「${c.name}」階段「${s.label}」：${c.completedStages.includes(s.id) ? '已完成' : '未完成'}，點擊切換`"
                  :title="`切換階段「${s.label}」`"
                  @click="toggleStage(c, s.id)"
                >
                  {{ s.label }}
                </button>
              </template>
              <span
                v-else
                class="muted-note"
              >還沒有階段，點「進度」標題新增</span>
            </td>

            <!-- 位置 -->
            <td>
              <template v-if="editingKey === `location-${c.id}`">
                <input
                  v-model="editingValue"
                  class="cell-input"
                  :data-edit="`location-${c.id}`"
                  list="location-options"
                  aria-label="編輯地點"
                  @blur="commitEdit(c, 'location')"
                  @keydown="onEditKeydown"
                >
              </template>
              <template v-else>
                <button
                  type="button"
                  class="cell-edit cell-edit--plain"
                  :data-edit-target="`location-${c.id}`"
                  :aria-label="`編輯「${c.name}」的地點：${c.location ?? '未設定'}`"
                  title="點擊編輯地點"
                  @click="startEdit(c, 'location')"
                >
                  {{ c.location ?? '－' }}
                </button>
              </template>
            </td>

            <!-- 聯絡方式 -->
            <td>
              <template v-if="editingKey === `contact-${c.id}`">
                <input
                  v-model="editingValue"
                  class="cell-input cell-input--wide"
                  :data-edit="`contact-${c.id}`"
                  aria-label="編輯聯絡方式"
                  @blur="commitEdit(c, 'contact')"
                  @keydown="onEditKeydown"
                >
              </template>
              <template v-else>
                <button
                  type="button"
                  class="cell-edit cell-edit--plain"
                  :data-edit-target="`contact-${c.id}`"
                  :aria-label="`編輯「${c.name}」的聯絡方式：${c.contact ?? '未設定'}`"
                  title="點擊編輯聯絡方式"
                  @click="startEdit(c, 'contact')"
                >
                  {{ c.contact ?? '－' }}
                </button>
              </template>
            </td>

            <!-- 跟進頻率 -->
            <td>
              {{ c.followUpFreq ? FOLLOW_UP_FREQ_SHORT[c.followUpFreq] : '—' }}
            </td>

            <!-- 下次跟進 -->
            <td style="white-space: nowrap">
              <template v-if="c.nextFollowUp">
                <span
                  v-if="isOverdue(c.nextFollowUp)"
                  class="marker-red"
                >
                  {{ c.nextFollowUp }}
                </span>
                <span v-else>{{ c.nextFollowUp }}</span>
                <RBadge
                  v-if="isOverdue(c.nextFollowUp)"
                  tone="red"
                >
                  遲 {{ overdueDays(c.nextFollowUp) }}天
                </RBadge>
                <span
                  v-else-if="timeAgo(c.nextFollowUp) === '今天'"
                  class="muted-note"
                >今天</span>
              </template>
              <span v-else>—</span>
            </td>

            <!-- 動作 -->
            <td style="white-space: nowrap">
              <RButton
                :aria-label="`開啟「${c.name}」的明細`"
                @click="detailContact = c"
              >
                明細
              </RButton>
              <RButton
                variant="danger"
                :aria-label="`刪除「${c.name}」`"
                @click="removeContact(c)"
              >
                刪除
              </RButton>
            </td>
          </tr>

          <tr v-if="contactsStatus === 'pending' && !filtered.length">
            <td
              colspan="7"
              class="empty-cell"
            >
              載入中…
            </td>
          </tr>
          <tr v-else-if="contactsError">
            <td
              colspan="7"
              class="empty-cell"
            >
              名單載入失敗
              <button
                type="button"
                class="link-button"
                @click="refreshContacts()"
              >
                重新整理
              </button>
            </td>
          </tr>
          <tr v-else-if="!filtered.length">
            <td
              colspan="7"
              class="empty-cell"
            >
              <template v-if="search">
                找不到符合「{{ search }}」的名單
              </template>
              <template v-else-if="hasActiveFilter">
                目前篩選条件下沒有名單
              </template>
              <template v-else>
                還沒有任何人名 🔍 按上面的「新增名單」開始
              </template>
              <template v-if="hasActiveFilter">
                ·
                <button
                  type="button"
                  class="link-button"
                  @click="clearAllFilters"
                >
                  清除所有篩選
                </button>
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

    <!-- 管理 dialog：階段／地點由欄位標題開啟；
         refresh 事件驅動名單頁刷新（見 ContactOptionsModal 檔內說明） -->
    <ContactOptionsModal
      v-model:open="stagesOpen"
      mode="stages"
      @refresh="refreshStages"
    />
    <ContactOptionsModal
      v-model:open="locationsOpen"
      mode="locations"
      @refresh="refreshLocations"
    />
  </div>
</template>
