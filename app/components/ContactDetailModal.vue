<script setup lang="ts">
import {
  api,
  FOLLOW_UP_FREQ_OPTIONS,
  LEVEL_OPTIONS,
  todayStr,
  timeAgo,
  type Contact,
  type FollowUpLog
} from '../utils/crm'

// 明細 modal：編輯名單欄位 + 跟進紀錄時間軸。
// v-model 綁明細對象（null = 關閉）。
const contact = defineModel<Contact | null>('contact', { default: null })

const emit = defineEmits<{ refresh: [] }>()

const toast = useToast()
const open = computed({
  get: () => contact.value != null,
  set: v => !v && (contact.value = null)
})

// 可編輯欄位（全部以字串操作，存檔時 '' → null）
const EDITABLE_FIELDS = [
  'location',
  'contact',
  'friendOf',
  'devPartner',
  'info',
  'level',
  'status',
  'followUpFreq',
  'lastFollowUp',
  'note'
] as const

// 表單草稿：每次「打開 modal」或「換人」時重置為當前資料（比照舊版 open watch 行為）
const form = ref<Record<string, string>>({})

// USelect（reka）不允許空字串 value —— 空字串會被當成「未選/placeholder」而 throw。
// 可清空的下拉一律以哨兵代空值（開啟時 '' → NONE、存檔時 NONE/'' → null）。
const NONE = '__none__'
const SELECT_FIELDS = new Set(['location', 'friendOf', 'devPartner', 'level', 'followUpFreq'])
const withNone = (items: { label: string, value: string }[]) => [{ label: '－', value: NONE }, ...items]

watch([open, () => contact.value?.id], ([o]) => {
  if (o && contact.value) {
    form.value = Object.fromEntries(
      EDITABLE_FIELDS.map((k) => {
        const v = contact.value![k as keyof Contact] as string | null ?? ''
        return [k, SELECT_FIELDS.has(k) && !v ? NONE : v]
      })
    )
  }
})

const saving = ref(false)

async function save() {
  const c = contact.value
  if (!c) return
  // '' / NONE → null；後端會重算 nextFollowUp
  const body = Object.fromEntries(
    EDITABLE_FIELDS.map((k) => {
      const v = (form.value[k] ?? '').trim()
      return [k, !v || v === NONE ? null : v]
    })
  )
  saving.value = true
  try {
    const updated = await api<Contact>(`/api/contacts/${c.id}`, { method: 'PATCH', body })
    emit('refresh')
    toast.add({ title: `已儲存「${updated.name}」`, color: 'neutral' })
    contact.value = updated
  } catch (err: unknown) {
    toast.add({ title: '儲存失敗', description: (err as Error)?.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

// ── 跟進紀錄 ─────────────────────────────────────────────────
// 每次開啟 modal 才抓（不用 useFetch：URL 會隨開關消失，型別與 watch 都彆扭）
const logs = ref<FollowUpLog[]>([])

async function refreshLogs() {
  if (!(open.value && contact.value)) return
  try {
    logs.value = await api<FollowUpLog[]>(`/api/contacts/${contact.value.id}/logs`)
  } catch (err: unknown) {
    toast.add({ title: '載入跟進紀錄失敗', description: (err as Error)?.message, color: 'error' })
  }
}

watch(open, (o) => {
  if (o) refreshLogs()
})

const logDate = ref(todayStr())
const logContent = ref('')

async function addLog() {
  const c = contact.value
  if (!c) return
  try {
    await api(`/api/contacts/${c.id}/logs`, {
      method: 'POST',
      body: { date: logDate.value || todayStr(), content: logContent.value.trim() || null }
    })
    logContent.value = ''
    logDate.value = todayStr()
    refreshLogs()
    emit('refresh')
  } catch (err: unknown) {
    toast.add({ title: '新增跟進紀錄失敗', description: (err as Error)?.message, color: 'error' })
  }
}

async function removeLog(log: FollowUpLog) {
  if (!window.confirm('確定刪除這筆跟進紀錄？')) return
  try {
    await api(`/api/contacts/${contact.value?.id}/logs/${log.id}`, { method: 'DELETE' })
    refreshLogs()
    emit('refresh') // 後端回算了 last/nextFollowUp，讓清單同步重抓
  } catch (err: unknown) {
    toast.add({ title: '刪除跟進紀錄失敗', description: (err as Error)?.message, color: 'error' })
  }
}

// 選項清單
const { data: locations } = useFetch('/api/contact-locations', { default: () => [] })
const { data: personOptions } = useFetch('/api/contact-options', { default: () => [] })

const locationItems = computed(() =>
  locations.value.map(l => ({ label: l.label, value: l.label }))
)

// 「誰的朋友／開發夥伴」人名選項（含現值，避免現有自由文字搜不到）
// 空值項由 withNone 統一加上（reka 不允許空字串 value，不在此處放 '' item）
const optionItems = computed(() => {
  const set = new Set<string>()
  for (const o of personOptions.value || []) set.add(o.label)
  for (const k of ['friendOf', 'devPartner'] as const) {
    const v = contact.value?.[k]
    if (v) set.add(v)
  }
  return [...set].filter(Boolean).map(label => ({ label, value: label }))
})

const freqItems = FOLLOW_UP_FREQ_OPTIONS.map(v => ({ label: v, value: v }))
const levelItems = LEVEL_OPTIONS.map(v => ({ label: v, value: v }))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="contact?.name ?? ''"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div
        v-if="contact"
        class="space-y-5"
      >
        <!-- 欄位表單 -->
        <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <label class="space-y-1">
            <span class="text-muted">位置</span>
            <USelect
              v-model="form.location"
              :items="withNone(locationItems)"
              class="w-full sketch-chip"
            />
          </label>

          <label class="space-y-1">
            <span class="text-muted">聯絡方式</span>
            <UInput
              v-model="form.contact"
              class="w-full sketch-chip"
            />
          </label>

          <label class="space-y-1">
            <span class="text-muted">誰的朋友</span>
            <USelect
              v-model="form.friendOf"
              :items="withNone(optionItems)"
              class="w-full sketch-chip"
            />
          </label>

          <label class="space-y-1">
            <span class="text-muted">開發夥伴</span>
            <USelect
              v-model="form.devPartner"
              :items="withNone(optionItems)"
              class="w-full sketch-chip"
            />
          </label>

          <label class="space-y-1">
            <span class="text-muted">等級</span>
            <USelect
              v-model="form.level"
              :items="withNone(levelItems)"
              class="w-full sketch-chip"
            />
          </label>

          <label class="space-y-1">
            <span class="text-muted">狀態（織網表）</span>
            <UInput
              v-model="form.status"
              class="w-full sketch-chip"
            />
          </label>

          <label class="space-y-1">
            <span class="text-muted">跟進頻率</span>
            <USelect
              v-model="form.followUpFreq"
              :items="withNone(freqItems)"
              class="w-full sketch-chip"
            />
          </label>

          <label class="space-y-1">
            <span class="text-muted">最後跟進日</span>
            <UInput
              v-model="form.lastFollowUp"
              type="date"
              class="w-full sketch-chip"
            />
          </label>

          <label class="space-y-1 col-span-2">
            <span class="text-muted">新人資訊</span>
            <UTextarea
              v-model="form.info"
              :rows="2"
              class="w-full"
            />
          </label>

          <label class="space-y-1 col-span-2">
            <span class="text-muted">備註</span>
            <UTextarea
              v-model="form.note"
              :rows="2"
              class="w-full"
            />
          </label>
        </div>

        <div class="text-center">
          <UButton
            variant="outline"
            color="primary"
            class="sketch-chip px-6"
            :loading="saving"
            @click="save"
          >
            💾 儲存
          </UButton>
        </div>

        <!-- 跟進紀錄時間軸 -->
        <div class="pt-2">
          <h3 class="font-bold text-base mb-3">
            🕰️ 跟進紀錄
          </h3>

          <!-- 新增紀錄 -->
          <form
            class="flex flex-wrap items-end gap-2 mb-4"
            @submit.prevent="addLog"
          >
            <UInput
              v-model="logDate"
              type="date"
              size="sm"
              class="sketch-chip"
            />
            <UInput
              v-model="logContent"
              size="sm"
              placeholder="跟進內容…"
              class="grow min-w-40"
            />
            <UButton
              type="submit"
              size="sm"
              color="primary"
              class="sketch-chip"
            >
              加一筆
            </UButton>
          </form>

          <ol class="space-y-2">
            <li
              v-for="log in logs"
              :key="log.id"
              class="flex items-start gap-3"
            >
              <UBadge
                variant="outline"
                color="neutral"
                class="sketch-chip shrink-0"
              >
                {{ log.date }}
              </UBadge>
              <div class="grow min-w-0">
                <p class="text-muted text-xs leading-none mb-0.5">
                  {{ timeAgo(log.date) }}
                </p>
                <p class="whitespace-pre-wrap">
                  {{ log.content || '—' }}
                </p>
              </div>
              <UButton
                icon="i-lucide-eraser"
                size="xs"
                variant="ghost"
                color="error"
                title="刪除紀錄"
                @click="removeLog(log)"
              />
            </li>
            <li
              v-if="!logs?.length"
              class="text-muted text-sm"
            >
              還沒有任何跟進紀錄。打完一通電話，記得來這裡記一筆 ✏️
            </li>
          </ol>
        </div>
      </div>
    </template>
  </UModal>
</template>
