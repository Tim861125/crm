<script setup lang="ts">
import {
  apiArr,
  FOLLOW_UP_FREQ_SHORT,
  isOverdue,
  overdueDays,
  timeAgo,
  type Contact
} from '../utils/crm'

const toast = useToast()

// ── 資料 ─────────────────────────────────────────────────────
const { data: contacts, refresh: refreshContacts } = useFetch('/api/contacts', { default: () => [] })
const { data: stages } = useFetch('/api/contact-stages', { default: () => [] })
const { data: locations } = useFetch('/api/contact-locations', { default: () => [] })

// 篩選
const search = ref('')

const filtered = computed(() =>
  (contacts.value || []).filter(c =>
    !search.value.trim()
    || c.name.includes(search.value.trim())
    || (c.contact ?? '').includes(search.value.trim())
  )
)

// ── 明細 modal / 選項管理 modal ──────────────────────────────
const detailContact = ref<Contact | null>(null)
const optionsOpen = ref(false)

// ── patch 工具：樂觀更新 + 失敗回滾 ──────────────────────────
async function patchContact(c: Contact, patch: Partial<Contact> & Record<string, unknown>) {
  const idx = contacts.value?.findIndex(x => x.id === c.id)
  if (idx === undefined || idx < 0) return
  const backup = contacts.value![idx]!
  contacts.value![idx] = { ...backup, ...patch } as Contact

  try {
    const updated = (await apiArr<Contact>(`/api/contacts/${c.id}`, { method: 'PATCH', body: patch }))[0]!
    contacts.value![idx] = updated
  } catch (err: unknown) {
    contacts.value![idx] = backup
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

// ── 破題切換 ─────────────────────────────────────────────────
function toggleBroached(c: Contact) {
  patchContact(c, { broached: !c.broached })
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
    const created = (await apiArr<Contact>('/api/contacts', { method: 'POST', body: { name: '新名單' } }))[0]!
    await refreshContacts()
    startEdit(created, 'name') // 建立後直接進入姓名編輯
  } catch (err: unknown) {
    toast.add({ title: '新增名單失敗', description: (err as Error)?.message, color: 'error' })
  }
}

async function removeContact(c: Contact) {
  if (!window.confirm(`確定要刪除「${c.name}」嗎？跟進紀錄也會一起刪除。`)) return
  try {
    await apiArr(`/api/contacts/${c.id}`, { method: 'DELETE' })
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
        共 {{ contacts?.length ?? 0 }} 筆
      </p>
    </div>

    <!-- 工具列 -->
    <div class="flex flex-wrap items-center gap-2 mb-4">
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

    <!-- 名單表格 -->
    <div class="sketch-card p-2 sm:p-4 overflow-x-auto">
      <table class="sketch-table w-full min-w-[760px] text-sm">
        <thead>
          <tr class="text-left text-muted">
            <th class="py-2 px-2 font-bold">
              姓名
            </th>
            <th class="py-2 px-2 font-bold">
              破題
            </th>
            <th class="py-2 px-2 font-bold">
              進度
            </th>
            <th class="py-2 px-2 font-bold">
              位置
            </th>
            <th class="py-2 px-2 font-bold">
              聯絡
            </th>
            <th class="py-2 px-2 font-bold">
              跟進
            </th>
            <th class="py-2 px-2 font-bold">
              下次跟進
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

            <!-- 破題 -->
            <td class="py-2.5 px-2 align-top">
              <button
                class="text-lg leading-none"
                :class="c.broached ? '' : 'opacity-40 grayscale'"
                :title="c.broached ? '破題：已切入正題' : '未破題，點擊切換'"
                :aria-label="c.broached ? '破題（點擊改為未破題）' : '未破題（點擊改為破題）'"
                @click="toggleBroached(c)"
              >
                {{ c.broached ? '💥' : '✏️' }}
              </button>
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
              colspan="8"
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

    <!-- 明細 modal -->
    <ContactDetailModal
      v-model="detailContact"
      @refresh="refreshContacts"
    />

    <!-- 選項管理 modal -->
    <ContactOptionsModal v-model:open="optionsOpen" />
  </div>
</template>
