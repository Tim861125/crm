<script setup lang="ts">
import RBadge from '../components/rough/RBadge.vue'
import RButton from '../components/rough/RButton.vue'
import RDialog from '../components/rough/RDialog.vue'
import RInput from '../components/rough/RInput.vue'
import RSelect from '../components/rough/RSelect.vue'
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

const { flash } = useNotice()
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

// 原生 select 允許空字串 value（不像 reka 會 throw），「－」清項直接以 '' 表示
const withNone = (items: { label: string, value: string }[]) => [{ label: '－', value: '' }, ...items]

// 未儲存變更偵測：關閉（Esc／背景／關閉鈕）前提示，避免誤丟編輯
const baseline = ref<Record<string, string>>({})
const dirty = computed(() =>
  EDITABLE_FIELDS.some(k => (form.value[k] ?? '') !== (baseline.value[k] ?? ''))
)
function guardClose(): boolean {
  return !dirty.value || window.confirm('還有未儲存的修改，確定要關閉嗎？')
}

watch([open, () => contact.value?.id], ([o]) => {
  if (o && contact.value) {
    form.value = Object.fromEntries(
      EDITABLE_FIELDS.map(k => [k, contact.value![k as keyof Contact] as string | null ?? ''])
    )
    baseline.value = { ...form.value }
  }
})

const saving = ref(false)

async function save() {
  const c = contact.value
  if (!c) return
  // '' → null；後端會重算 nextFollowUp
  const body = Object.fromEntries(
    EDITABLE_FIELDS.map((k) => {
      const v = (form.value[k] ?? '').trim()
      return [k, v || null]
    })
  )
  saving.value = true
  try {
    const updated = await api<Contact>(`/api/contacts/${c.id}`, { method: 'PATCH', body })
    emit('refresh')
    flash(`已儲存「${updated.name}」`)
    contact.value = updated
    baseline.value = { ...form.value } // 剛存過的內容不算未儲存變更
  } catch (err: unknown) {
    flash(`儲存失敗：${(err as Error)?.message}`, { error: true })
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
    flash(`載入跟進紀錄失敗：${(err as Error)?.message}`, { error: true })
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
    flash(`新增跟進紀錄失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function removeLog(log: FollowUpLog) {
  if (!window.confirm('確定刪除這筆跟進紀錄？')) return
  try {
    await api(`/api/contacts/${contact.value?.id}/logs/${log.id}`, { method: 'DELETE' })
    refreshLogs()
    emit('refresh') // 後端回算了 last/nextFollowUp，讓清單同步重抓
  } catch (err: unknown) {
    flash(`刪除跟進紀錄失敗：${(err as Error)?.message}`, { error: true })
  }
}

// 選項清單
const { data: locations } = useFetch('/api/contact-locations', { default: () => [] })
const { data: personOptions } = useFetch('/api/contact-options', { default: () => [] })

const locationItems = computed(() =>
  locations.value.map(l => ({ label: l.label, value: l.label }))
)

// 「誰的朋友／開發夥伴」人名選項（含現值，避免現有自由文字搜不到）
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
  <RDialog
    class="detail-dialog"
    :open="open"
    :title="contact?.name"
    :guard="guardClose"
    @update:open="open = $event"
  >
    <div v-if="contact">
      <!-- 欄位表單 -->
      <div class="detail-form">
        <label>
          <span>位置</span>
          <RSelect
            v-model="form.location"
            :options="withNone(locationItems)"
          />
        </label>

        <label>
          <span>聯絡方式</span>
          <RInput v-model="form.contact" />
        </label>

        <label>
          <span>誰的朋友</span>
          <RSelect
            v-model="form.friendOf"
            :options="withNone(optionItems)"
          />
        </label>

        <label>
          <span>開發夥伴</span>
          <RSelect
            v-model="form.devPartner"
            :options="withNone(optionItems)"
          />
        </label>

        <label>
          <span>等級</span>
          <RSelect
            v-model="form.level"
            :options="withNone(levelItems)"
          />
        </label>

        <label>
          <span>狀態（織網表）</span>
          <RInput v-model="form.status" />
        </label>

        <label>
          <span>跟進頻率</span>
          <RSelect
            v-model="form.followUpFreq"
            :options="withNone(freqItems)"
          />
        </label>

        <label>
          <span>最後跟進日</span>
          <RInput
            v-model="form.lastFollowUp"
            type="date"
          />
        </label>

        <label class="span-2">
          <span>新人資訊</span>
          <textarea
            v-model="form.info"
            rows="2"
          />
        </label>

        <label class="span-2">
          <span>備註</span>
          <textarea
            v-model="form.note"
            rows="2"
          />
        </label>
      </div>

      <div class="detail-actions">
        <RButton
          variant="primary"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? '儲存中…' : '儲存' }}
        </RButton>
      </div>

      <!-- 跟進紀錄時間軸 -->
      <div>
        <h3 class="logs-head">
          🕰️ 跟進紀錄
        </h3>

        <!-- 新增紀錄 -->
        <form
          class="log-form"
          @submit.prevent="addLog"
        >
          <RInput
            v-model="logDate"
            type="date"
            aria-label="跟進日期"
          />
          <div class="log-form__content">
            <RInput
              v-model="logContent"
              aria-label="跟進內容"
              placeholder="跟進內容…"
            />
          </div>
          <RButton
            variant="primary"
            type="submit"
          >
            加一筆
          </RButton>
        </form>

        <ol class="log-list">
          <li
            v-for="log in logs"
            :key="log.id"
            class="log-item"
          >
            <RBadge tone="gray">
              {{ log.date }}
            </RBadge>
            <div class="log-item__body">
              <p class="log-ago">
                {{ timeAgo(log.date) }}
              </p>
              <p class="log-content">
                {{ log.content || '—' }}
              </p>
            </div>
            <button
              type="button"
              class="row-step row-step--danger"
              title="刪除紀錄"
              :aria-label="`刪除 ${log.date} 的跟進紀錄`"
              @click="removeLog(log)"
            >
              ×
            </button>
          </li>
          <li
            v-if="!logs?.length"
            class="muted-note"
          >
            還沒有任何跟進紀錄。打完一通電話，記得來這裡記一筆 ✏️
          </li>
        </ol>
      </div>
    </div>
  </RDialog>
</template>
