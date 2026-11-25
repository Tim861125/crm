<script setup lang="ts">
import RBadge from '../components/rough/RBadge.vue'
import RButton from '../components/rough/RButton.vue'
import RCheckbox from '../components/rough/RCheckbox.vue'
import RCombobox from '../components/rough/RCombobox.vue'
import RInput from '../components/rough/RInput.vue'
import ColumnFilterMenu from './ColumnFilterMenu.vue'
import ContactDetailModal from './ContactDetailModal.vue'
import ContactOptionsModal from './ContactOptionsModal.vue'
import {
  api,
  applyColumnFilters,
  columnFilterOptions,
  emptyColumnFilters,
  FILTER_NONE,
  FOLLOW_UP_FREQ_OPTIONS,
  FOLLOW_UP_FREQ_SHORT,
  hasColumnFilter,
  isOverdue,
  searchAndSortContacts,
  stageChipsRowWidth,
  todayStr,
  type Contact,
  type ContactColumnFilters,
  type ContactLocation,
  type ContactStage,
  type FollowUpLog
} from '../utils/crm'

const { flash } = useNotice()
const { confirm } = useConfirm()

// ── 資料 ─────────────────────────────────────────────────────
const { data: contacts, status: contactsStatus, error: contactsError, refresh: refreshContacts } = useFetch<Contact[]>('/api/contacts', { default: () => [] })
const { data: stages, refresh: refreshStages } = useFetch('/api/contact-stages', { default: () => [] })
const { data: locations, refresh: refreshLocations } = useFetch<ContactLocation[]>('/api/contact-locations', { default: () => [] })
const { data: methods, refresh: refreshMethods } = useFetch('/api/contact-methods', { default: () => [] })

// ── 搜尋與欄位篩選 ───────────────────────────────────────────
// 篩選採試算表式：同欄多選＝任一符合（OR）、跨欄＝同時符合（AND）；選項由實際資料推導
const search = ref('')
const filters = ref<ContactColumnFilters>(emptyColumnFilters())

const filtering = computed(() => search.value.trim() !== '' || hasColumnFilter(filters.value))
const visible = computed(() => applyColumnFilters(searchAndSortContacts(contacts.value || [], search.value, false), filters.value))

function clearAllFilters() {
  filters.value = emptyColumnFilters()
}

// 篩選面板選項：資料實際出現的值＋筆數；空值併入「未設定」
function textOptions(values: Array<string | null>) {
  return columnFilterOptions(values).map(o => ({ ...o, label: o.value === FILTER_NONE ? '未設定' : o.value }))
}
const locationOptions = computed(() => textOptions((contacts.value ?? []).map((c: Contact) => c.location)))
const contactOptions = computed(() => textOptions((contacts.value ?? []).map((c: Contact) => c.contact)))
const goalOptions = computed(() => textOptions((contacts.value ?? []).map((c: Contact) => c.goal)))
// 跟進頻率與表格內容同款短標籤（一週／兩週…）
const freqOptions = computed(() => columnFilterOptions((contacts.value ?? []).map((c: Contact) => c.followUpFreq))
  .map(o => ({ ...o, label: o.value === FILTER_NONE ? '未設定' : FOLLOW_UP_FREQ_SHORT[o.value] ?? o.value })))
// 進度：只列有人完成的階段，筆數＝完成該階段的人數
const stageOptions = computed(() => ((stages.value ?? []) as ContactStage[])
  .map(s => ({ value: String(s.id), label: s.label, count: ((contacts.value ?? []) as Contact[]).filter(c => c.completedStages.includes(s.id)).length }))
  .filter(o => o.count > 0))
// 進度欄寬下限：讓該列所有階段 chip 排在同一行（fixed 欄寬不會隨內容长大，故由名稱估算，
// 超過寬螢幕剩餘空間時整表橫滾 —— 折行正是要修的行為）
const stageColWidth = computed(() => stageChipsRowWidth(((stages.value ?? []) as ContactStage[]).map(s => s.label)))
// 已跟進：與 checkbox 同款推導（最後跟進日＝今天）；其他欄的資料推導規則一樣，沒人的狀態不列
const followedOptions = computed(() => {
  const list: Contact[] = contacts.value ?? []
  const done = list.filter(c => c.lastFollowUp === todayStr()).length
  return [
    ...(done > 0 ? [{ value: 'done', label: '已跟進', count: done }] : []),
    ...(list.length - done > 0 ? [{ value: 'todo', label: '未跟進', count: list.length - done }] : [])
  ]
})

// 階段在管理 dialog 被刪除時同步移除篩選值，避免「幽靈篩選」（漏斗亮著但面板沒勾任何項、名單無故變空）
watch(stages, (list: ContactStage[] | null | undefined) => {
  const alive = new Set((list ?? []).map(s => String(s.id)))
  const kept = filters.value.stage.filter(id => alive.has(id))
  if (kept.length !== filters.value.stage.length)
    filters.value.stage = kept
})

// 地點欄編輯建議（RCombobox 以文字為值，同原生 datalist）
const locationLabels = computed(() => (locations.value ?? []).map(l => l.label))

// 下拉內直接增刪地點選項（原「地點欄標題管理 dialog」的替代品）
async function createLocation(c: Contact, label: string) {
  try {
    await api('/api/contact-locations', { method: 'POST', body: { label } })
    await refreshLocations()
    commitEdit(c, 'location') // 建立的同時就地把這位存入並結束編輯
  } catch (err: unknown) {
    flash(`新增地點失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function deleteLocation(label: string) {
  const hit = (locations.value ?? []).find((l: ContactLocation) => l.label === label)
  if (!hit) return
  try {
    await api(`/api/contact-locations/${hit.id}`, { method: 'DELETE' })
    await refreshLocations()
  } catch (err: unknown) {
    flash(`刪除地點失敗：${(err as Error)?.message}`, { error: true })
  }
}

// 聯絡方式欄（同地點模式：下拉內「＋ 新增」建檔即選取、選項右緣 × 刪除）
const methodLabels = computed(() => (methods.value ?? []).map((m: ContactMethod) => m.label))

async function createMethod(c: Contact, label: string) {
  try {
    await api('/api/contact-methods', { method: 'POST', body: { label } })
    await refreshMethods()
    commitEdit(c, 'contact') // 建立的同時就地把這位存入並結束編輯
  } catch (err: unknown) {
    flash(`新增聯絡方式失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function deleteMethod(label: string) {
  const hit = (methods.value ?? []).find((m: ContactMethod) => m.label === label)
  if (!hit) return
  try {
    await api(`/api/contact-methods/${hit.id}`, { method: 'DELETE' })
    await refreshMethods()
  } catch (err: unknown) {
    flash(`刪除聯絡方式失敗：${(err as Error)?.message}`, { error: true })
  }
}

// 目標欄（同地點模式：下拉內「＋ 新增」建檔即選取、選項右緣 × 刪除）
const { data: goals, refresh: refreshGoals } = useFetch('/api/goal-options', { default: () => [] })
const goalLabels = computed(() => (goals.value ?? []).map((o: GoalOption) => o.label))

async function createGoal(c: Contact, label: string) {
  try {
    await api('/api/goal-options', { method: 'POST', body: { label } })
    await refreshGoals()
    commitEdit(c, 'goal') // 建立的同時就地把這位存入並結束編輯
  } catch (err: unknown) {
    flash(`新增「目標」失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function deleteGoal(label: string) {
  const hit = (goals.value ?? []).find((o: GoalOption) => o.label === label)
  if (!hit) return
  try {
    await api(`/api/goal-options/${hit.id}`, { method: 'DELETE' })
    await refreshGoals()
  } catch (err: unknown) {
    flash(`刪除「目標」選項失敗：${(err as Error)?.message}`, { error: true })
  }
}

const stats = computed(() => {
  const list = contacts.value ?? []
  return {
    total: list.length,
    overdue: list.filter(c => isOverdue(c.nextFollowUp)).length
  }
})

// ── 明細 modal／進度階段管理 dialog（地點增刪已改為下拉內直接處理）──
const detailContact = ref<Contact | null>(null)
const stagesOpen = ref(false)
const detailModal = ref<InstanceType<typeof ContactDetailModal> | null>(null)

// 階段管理 dialog 成功變更後：名單與明細各自的 useFetch 快取不跨元件同步
// （見 ContactOptionsModal 檔頭註解），兩邊都要刷新——明細那側直接叫它自己
// 暴露的 refreshStages，不在這裡重複抓
async function onStagesChanged() {
  await refreshStages()
  await detailModal.value?.refreshStages()
}

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

// ── inline 編輯儲存格（姓名／聯絡方式／地點／目標／跟進頻率）───
const editingKey = ref<string | null>(null)
const editingValue = ref('')

type EditableField = 'name' | 'contact' | 'location' | 'goal' | 'followUpFreq'

function startEdit(c: Contact, field: EditableField) {
  editingKey.value = `${field}-${c.id}`
  editingValue.value = { name: c.name, contact: c.contact, location: c.location, goal: c.goal, followUpFreq: c.followUpFreq }[field] ?? ''
  // 進入編輯後聚焦輸入框（巨集按新增時直接打字；鍵盤操作不需再點一次）
  void nextTick(() => {
    const input = document.querySelector<HTMLInputElement>(`input.cell-input[data-edit="${editingKey.value}"]`)
    input?.focus()
    input?.select()
  })
}

function commitEdit(c: Contact, field: EditableField) {
  editingKey.value = null
  let v = editingValue.value.trim()
  if (field === 'name' && !v) v = c.name // 姓名不可為空
  // 跟進頻率是後端 z.enum 固定六個值（非可增刪的選項表）：打字打出選單外的文字時不送出，維持原值並提示
  if (field === 'followUpFreq' && v && !FOLLOW_UP_FREQ_OPTIONS.includes(v)) {
    flash('跟進頻率請從下拉選單中選擇', { error: true })
    return
  }
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

// ── 已跟進 checkbox（動作欄 note 鈕左邊）───────────────────────
// 打勾＝在 note 的跟進紀錄記一筆「今天」（內容：已跟進）；取消＝刪掉今天的所有紀錄。
// 勾選狀態不加 DB 欄位，由 lastFollowUp 是否為今天推導：logs 新增／刪除端點都會自動回算它。
const followBusy = ref<number[]>([])

const followedUpToday = (c: Contact) => c.lastFollowUp === todayStr()

async function toggleFollowedUp(c: Contact, checked: boolean) {
  if (followBusy.value.includes(c.id)) return
  followBusy.value = [...followBusy.value, c.id]
  try {
    if (checked) {
      await api(`/api/contacts/${c.id}/logs`, {
        method: 'POST',
        body: { date: todayStr(), content: '已跟進' }
      })
      flash(`已把「${c.name}」標為今天已跟進，note 裡記了一筆 ✅`)
    } else {
      const ok = await confirm({
        title: '取消今日跟進',
        message: `取消勾選會刪除「${c.name}」今天的跟進紀錄，確定？`,
        confirmLabel: '取消跟進',
        danger: true
      })
      if (!ok) return
      const logs = await api<FollowUpLog[]>(`/api/contacts/${c.id}/logs`)
      const todays = logs.filter(l => l.date === todayStr())
      for (const log of todays)
        await api(`/api/contacts/${c.id}/logs/${log.id}`, { method: 'DELETE' })
      // 沒有今天的紀錄可刪 → 最後跟進日是手動填的，直接清成 null（PATCH 會連 nextFollowUp 重算）
      if (!todays.length)
        await api(`/api/contacts/${c.id}`, { method: 'PATCH', body: { lastFollowUp: null } })
      flash(`已取消「${c.name}」的今日跟進`)
    }
    await refreshContacts()
  } catch (err: unknown) {
    flash(`更新「${c.name}」已跟進狀態失敗：${(err as Error)?.message}`, { error: true })
  } finally {
    followBusy.value = followBusy.value.filter(id => id !== c.id)
  }
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
  const ok = await confirm({
    title: '刪除名單',
    message: `確定要刪除「${c.name}」嗎？跟進紀錄也會一起刪除。`,
    confirmLabel: '刪除',
    danger: true
  })
  if (!ok) return
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
        <template v-if="filtering">
          顯示 {{ visible.length }} / {{ stats.total }} 筆
        </template>
        <template v-else>
          共 {{ stats.total }} 筆
        </template><span v-if="stats.overdue"> · <span class="marker-red">逾期 {{ stats.overdue }} 位</span></span>
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

    <!-- 名單表格（手機可橫滑；tabindex 讓鍵盤也能捲動此區域） -->
    <div
      class="list-scroll"
      tabindex="0"
      role="region"
      aria-label="名單表格，可橫向捲動"
    >
      <!-- --stages-w：進度欄需要多寬（由階段名稱估算），供 main.css 撐開表格 min-width，
           讓每一筆的階段 chip 都排在同一行，不會折到第二行 -->
      <table
        class="r-table"
        :style="`--stages-w: ${stageColWidth}px`"
      >
        <!-- 欄寬固定在 colgroup（搭配 table-layout: fixed）：
             編輯切換（按鈕↔輸入框）不再觸發整表重排 -->
        <!-- col-hide-sm（col/th/td 同標）＝手機版（≤640px）隱藏的欄：只留姓名／目標／今日跟進（已跟進）
             三欄＋Info 明細鈕，其餘欄位到明細 modal 看（見 main.css 640px 區塊） -->
        <colgroup>
          <col style="width: 170px"><!-- 姓名＋SR/SSR 標籤並排：4 字姓名(≒72)＋標籤(≒54)＋間距＋padding 24 ≒ 156 -->
          <col class="col-hide-sm"><!-- 進度：下限由 --stages-w 決定（見 main.css），寬螢幕再吃掉剩餘寬度 -->
          <col
            class="col-hide-sm"
            style="width: 110px"
          >
          <col
            class="col-hide-sm"
            style="width: 120px"
          ><!-- 聯絡：電話 10～11 碼(≒0.5em×11＝94)＋td padding 24 ≒ 118；更長（IG／email）靠 overflow-wrap 折行 -->
          <col style="width: 110px"><!-- 目標：短詞（破題／群星計畫 ≒68）＋td padding 24 ≒ 92，超長自動折行；編輯時出 RCombobox -->
          <col
            class="col-hide-sm"
            style="width: 104px"
          ><!-- 跟進：顯示用短標（一週），編輯時 RCombobox 出全名（一個月一次 ≒62）＋漏斗(13)＋表頭鈕 padding 8＋td padding 24 ≒ 100 -->
          <col style="width: 104px"><!-- 已跟進：3 字(≒51)＋漏斗(13)＋間距＋表頭鈕 padding 8＋td padding 24 ≒ 100 -->
          <col style="width: 160px"><!-- 動作：Info 鈕(≒78)＋icon 刪除鈕(≒42)＋間距＋td padding 24 ≒ 148，160 仍留緩衝；少於內容寬度時刪除鈕會被 .list-scroll 裁右缘 -->
        </colgroup>
        <thead>
          <tr>
            <th scope="col">
              姓名
            </th>
            <th
              class="col-hide-sm"
              scope="col"
            >
              <span class="th-manage">
                <ColumnFilterMenu
                  v-model="filters.stage"
                  label="進度"
                  :options="stageOptions"
                  :active="filters.stage.length > 0"
                />
                <button
                  type="button"
                  class="th-gear"
                  aria-haspopup="dialog"
                  aria-label="管理進度階段"
                  title="管理進度階段"
                  @click="stagesOpen = true"
                >
                  <!-- 手繪感齒輪（比照 RSelect 箭頭的純描線風格） -->
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                    />
                  </svg>
                </button>
              </span>
            </th>
            <th
              class="col-hide-sm"
              scope="col"
            >
              <ColumnFilterMenu
                v-model="filters.location"
                label="地點"
                :options="locationOptions"
                :active="filters.location.length > 0"
              />
            </th>
            <th
              class="col-hide-sm"
              scope="col"
            >
              <ColumnFilterMenu
                v-model="filters.contact"
                label="聯絡"
                :options="contactOptions"
                :active="filters.contact.length > 0"
              />
            </th>
            <th scope="col">
              <ColumnFilterMenu
                v-model="filters.goal"
                label="目標"
                :options="goalOptions"
                :active="filters.goal.length > 0"
              />
            </th>
            <th
              class="col-hide-sm"
              scope="col"
            >
              <ColumnFilterMenu
                v-model="filters.freq"
                label="跟進"
                :options="freqOptions"
                :active="filters.freq.length > 0"
              />
            </th>
            <th scope="col">
              <ColumnFilterMenu
                v-model="filters.followed"
                label="已跟進"
                :options="followedOptions"
                :active="filters.followed.length > 0"
              />
            </th>
            <!-- 動作欄無可見標題，補 SR 文字，避免螢幕reader唸成「未命名欄位」 -->
            <th scope="col">
              <span class="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in visible"
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
                <span class="cell-name">
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
                </span>
              </template>
            </td>

            <!-- 進度階段 -->
            <td class="col-hide-sm">
              <div
                v-if="stages?.length"
                class="cell-stages"
              >
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
              </div>
              <span
                v-else
                class="muted-note"
              >還沒有階段，點「進度」標題新增</span>
            </td>

            <!-- 位置 -->
            <td class="col-hide-sm">
              <template v-if="editingKey === `location-${c.id}`">
                <RCombobox
                  v-model="editingValue"
                  :options="locationLabels"
                  class="cell-input"
                  :data-edit="`location-${c.id}`"
                  aria-label="編輯地點"
                  empty-text="沒有符合的地點，輸入後可選下方新增"
                  creatable
                  deletable
                  create-label="新增地點（先輸入名稱）"
                  @create="label => createLocation(c, label)"
                  @delete="deleteLocation"
                  @blur="commitEdit(c, 'location')"
                  @keydown="onEditKeydown"
                />
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
            <td class="col-hide-sm">
              <template v-if="editingKey === `contact-${c.id}`">
                <RCombobox
                  v-model="editingValue"
                  :options="methodLabels"
                  class="cell-input cell-input--wide"
                  :data-edit="`contact-${c.id}`"
                  aria-label="編輯聯絡方式"
                  empty-text="沒有符合的聯絡方式，輸入後可選下方新增"
                  creatable
                  deletable
                  create-label="新增聯絡方式（先輸入名稱）"
                  @create="label => createMethod(c, label)"
                  @delete="deleteMethod"
                  @blur="commitEdit(c, 'contact')"
                  @keydown="onEditKeydown"
                />
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

            <!-- 目標 -->
            <td>
              <template v-if="editingKey === `goal-${c.id}`">
                <RCombobox
                  v-model="editingValue"
                  :options="goalLabels"
                  class="cell-input"
                  :data-edit="`goal-${c.id}`"
                  aria-label="編輯目標"
                  empty-text="沒有符合的目標，輸入後可選下方新增"
                  creatable
                  deletable
                  create-label="新增目標（先輸入名稱）"
                  @create="label => createGoal(c, label)"
                  @delete="deleteGoal"
                  @blur="commitEdit(c, 'goal')"
                  @keydown="onEditKeydown"
                />
              </template>
              <template v-else>
                <button
                  type="button"
                  class="cell-edit cell-edit--plain"
                  :data-edit-target="`goal-${c.id}`"
                  :aria-label="`編輯「${c.name}」的目標：${c.goal ?? '未設定'}`"
                  :title="c.goal || '點擊編輯目標'"
                  @click="startEdit(c, 'goal')"
                >
                  {{ c.goal ?? '－' }}
                </button>
              </template>
            </td>

            <!-- 跟進頻率（同地點模式：點了出 RCombobox 下拉；後端 enum 固定六個值，故選單不可增刪） -->
            <td class="col-hide-sm">
              <template v-if="editingKey === `followUpFreq-${c.id}`">
                <RCombobox
                  v-model="editingValue"
                  :options="FOLLOW_UP_FREQ_OPTIONS"
                  class="cell-input"
                  :data-edit="`followUpFreq-${c.id}`"
                  aria-label="編輯跟進頻率"
                  empty-text="跟進頻率是固定選項，請從選單中選"
                  @blur="commitEdit(c, 'followUpFreq')"
                  @keydown="onEditKeydown"
                />
              </template>
              <template v-else>
                <button
                  type="button"
                  class="cell-edit cell-edit--plain"
                  :data-edit-target="`followUpFreq-${c.id}`"
                  :aria-label="`編輯「${c.name}」的跟進頻率：${c.followUpFreq ?? '未設定'}`"
                  :title="c.followUpFreq || '點擊編輯跟進頻率'"
                  @click="startEdit(c, 'followUpFreq')"
                >
                  {{ c.followUpFreq ? FOLLOW_UP_FREQ_SHORT[c.followUpFreq] : '—' }}
                </button>
              </template>
            </td>

            <!-- 已跟進：打勾＝note 記一筆今天的跟進紀錄；勾選狀態＝最後跟進日是不是今天 -->
            <td class="cell-check">
              <RCheckbox
                :model-value="followedUpToday(c)"
                :disabled="followBusy.includes(c.id)"
                :aria-label="`「${c.name}」今天${followedUpToday(c) ? '已跟進，取消勾選會刪掉今天的跟進紀錄' : '尚未跟進，打勾記一筆今天的跟進'}`"
                :title="followedUpToday(c) ? '今天已跟進（取消勾選會刪掉今天的跟進紀錄）' : '標記今天已跟進（在 note 新增一筆今天的跟進日期）'"
                @update:model-value="toggleFollowedUp(c, $event)"
              />
            </td>

            <!-- 動作 -->
            <td style="white-space: nowrap">
              <RButton
                title="Info"
                :aria-label="`Info：開啟「${c.name}」明細`"
                @click="detailContact = c"
              >
                Info
              </RButton>
              <RButton
                class="r-button--icon row-delete"
                variant="danger"
                title="刪除"
                :aria-label="`刪除「${c.name}」`"
                @click="removeContact(c)"
              >
                <!-- 手繪感垃圾桶（比照表頭齒輪的純描線風格） -->
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line
                    x1="10"
                    x2="10"
                    y1="11"
                    y2="17"
                  />
                  <line
                    x1="14"
                    x2="14"
                    y1="11"
                    y2="17"
                  />
                </svg>
              </RButton>
            </td>
          </tr>

          <tr v-if="contactsStatus === 'pending' && !visible.length">
            <td
              colspan="8"
              class="empty-cell"
            >
              載入中…
            </td>
          </tr>
          <tr v-else-if="contactsError">
            <td
              colspan="8"
              class="empty-cell"
            >
              名單載入失敗
              <button
                type="button"
                class="link-button"
                @click="refreshContacts().catch(() => {})"
              >
                重新整理
              </button>
            </td>
          </tr>
          <tr v-else-if="!visible.length">
            <td
              colspan="8"
              class="empty-cell"
            >
              <template v-if="search">
                找不到符合「{{ search }}」的名單
              </template>
              <template v-else-if="hasColumnFilter(filters)">
                目前篩選条件下沒有名單
              </template>
              <template v-else>
                還沒有任何人名 🔍 按上面的「新增名單」開始
              </template>
              <button
                v-if="hasColumnFilter(filters)"
                type="button"
                class="link-button"
                @click="clearAllFilters"
              >
                清除所有篩選
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 明細 modal（v-model:contact：子元件 defineModel('contact') 的命名對應）；
         manage-stages：手機版名單藏了進度欄齒輪，明細列尾鈕由這裡開同一個管理 dialog -->
    <ContactDetailModal
      ref="detailModal"
      v-model:contact="detailContact"
      @refresh="refreshContacts"
      @manage-stages="stagesOpen = true"
    />

    <!-- 管理 dialog：進度階段由欄位標題或明細列尾鈕開啟（地點改在編輯下拉內增刪）；
         refresh 事件驅動名單頁與開著的明細刷新（見 ContactOptionsModal 檔內說明） -->
    <ContactOptionsModal
      v-model:open="stagesOpen"
      @refresh="onStagesChanged"
    />
  </div>
</template>
