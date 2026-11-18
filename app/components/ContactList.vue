<script setup lang="ts">
import RBadge from '../components/rough/RBadge.vue'
import RButton from '../components/rough/RButton.vue'
import RCombobox from '../components/rough/RCombobox.vue'
import RInput from '../components/rough/RInput.vue'
import ContactDetailModal from './ContactDetailModal.vue'
import ContactOptionsModal from './ContactOptionsModal.vue'
import {
  api,
  FOLLOW_UP_FREQ_SHORT,
  isOverdue,
  searchAndSortContacts,
  type Contact
} from '../utils/crm'

const { flash } = useNotice()

// ── 資料 ─────────────────────────────────────────────────────
const { data: contacts, status: contactsStatus, error: contactsError, refresh: refreshContacts } = useFetch('/api/contacts', { default: () => [] })
const { data: stages, refresh: refreshStages } = useFetch('/api/contact-stages', { default: () => [] })
const { data: locations, refresh: refreshLocations } = useFetch('/api/contact-locations', { default: () => [] })
const { data: methods, refresh: refreshMethods } = useFetch('/api/contact-methods', { default: () => [] })

// ── 搜尋 ─────────────────────────────────────────────────────
const search = ref('')

const visible = computed(() => searchAndSortContacts(contacts.value || [], search.value, false))

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

// ── inline 編輯儲存格（姓名／聯絡方式／地點／備註）─────────────
const editingKey = ref<string | null>(null)
const editingValue = ref('')

type EditableField = 'name' | 'contact' | 'location' | 'note'

function startEdit(c: Contact, field: EditableField) {
  editingKey.value = `${field}-${c.id}`
  editingValue.value = { name: c.name, contact: c.contact, location: c.location, note: c.note }[field] ?? ''
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

    <!-- 名單表格（手機可橫滑；tabindex 讓鍵盤也能捲動此區域） -->
    <div
      class="list-scroll"
      tabindex="0"
      role="region"
      aria-label="名單表格，可橫向捲動"
    >
      <table class="r-table">
        <!-- 欄寬固定在 colgroup（搭配 table-layout: fixed）：
             編輯切換（按鈕↔輸入框）不再觸發整表重排 -->
        <colgroup>
          <col style="width: 170px"><!-- 姓名＋SR/SSR 標籤並排：4 字姓名(≒72)＋標籤(≒54)＋間距＋padding 24 ≒ 156 -->
          <col><!-- 進度：吃掉剩餘寬度 -->
          <col style="width: 110px">
          <col style="width: 160px">
          <col style="width: 210px"><!-- 備註：長文字折行後以兩行截斷（見 .cell-note），完整內容放 title -->
          <col style="width: 72px"><!-- 跟進：17px 中文字兩字＋padding 24 ≒ 58，低於 58 時「跟進」會逐字換行變直排 -->
          <col style="width: 180px"><!-- 動作：两颗 RButton（74×2）＋ td padding 24 ＝ 172，少于此删除钮会被 .list-scroll 裁右缘 -->
        </colgroup>
        <thead>
          <tr>
            <th>姓名</th>
            <th>
              <span class="th-manage">
                進度
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
            <th>地點</th>
            <th>聯絡</th>
            <th>備註</th>
            <th>跟進</th>
            <th />
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
            <td>
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

            <!-- 備註 -->
            <td>
              <template v-if="editingKey === `note-${c.id}`">
                <input
                  v-model="editingValue"
                  class="cell-input"
                  :data-edit="`note-${c.id}`"
                  aria-label="編輯備註"
                  @blur="commitEdit(c, 'note')"
                  @keydown="onEditKeydown"
                >
              </template>
              <template v-else>
                <span class="cell-note">
                  <button
                    type="button"
                    class="cell-edit cell-edit--plain"
                    :data-edit-target="`note-${c.id}`"
                    :aria-label="`編輯「${c.name}」的備註：${c.note ?? '未填寫'}`"
                    :title="c.note || '點擊編輯備註'"
                    @click="startEdit(c, 'note')"
                  >
                    {{ c.note ?? '－' }}
                  </button>
                </span>
              </template>
            </td>

            <!-- 跟進頻率 -->
            <td>
              {{ c.followUpFreq ? FOLLOW_UP_FREQ_SHORT[c.followUpFreq] : '—' }}
            </td>

            <!-- 動作 -->
            <td style="white-space: nowrap">
              <RButton
                title="明細"
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

          <tr v-if="contactsStatus === 'pending' && !visible.length">
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
          <tr v-else-if="!visible.length">
            <td
              colspan="7"
              class="empty-cell"
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
    </div>

    <!-- 明細 modal（v-model:contact：子元件 defineModel('contact') 的命名對應） -->
    <ContactDetailModal
      v-model:contact="detailContact"
      @refresh="refreshContacts"
    />

    <!-- 管理 dialog：進度階段由欄位標題開啟（地點改在編輯下拉內增刪）；
         refresh 事件驅動名單頁刷新（見 ContactOptionsModal 檔內說明） -->
    <ContactOptionsModal
      v-model:open="stagesOpen"
      @refresh="refreshStages"
    />
  </div>
</template>
