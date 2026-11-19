<script setup lang="ts">
import RBadge from '../components/rough/RBadge.vue'
import RButton from '../components/rough/RButton.vue'
import RCombobox from '../components/rough/RCombobox.vue'
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
  'goal',
  'info',
  'level',
  'status',
  'followUpFreq',
  'lastFollowUp'
] as const

// 表單草稿：每次「打開 modal」或「換人」時重置為當前資料（比照舊版 open watch 行為）
const form = ref<Record<string, string>>({})

// reka Select 禁止空字串 item value（會被當成「未選/placeholder」而 throw，commit 9f8c665）。
// 可清空的下拉一律以哨兵代空值（開啟時 null → NONE、存檔時 NONE → null）。
// 位置欄走 RCombobox（自由文字，空字串＝未設定），不需要哨兵。
const NONE = '__none__'
const SELECT_FIELDS = new Set(['level', 'followUpFreq'])
const withNone = (items: { label: string, value: string }[]) => [{ label: '－', value: NONE }, ...items]

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
      EDITABLE_FIELDS.map((k) => {
        const v = contact.value![k as keyof Contact] as string | null ?? ''
        // 下拉欄位空值改填哨兵（reka 不接受 ''，見 withNone 註解）
        return [k, SELECT_FIELDS.has(k) && !v ? NONE : v]
      })
    )
    baseline.value = { ...form.value }
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
  if (o) {
    refreshLogs()
    // 同 key useFetch 不跨元件同步：開明細時重抓選項清單，
    // 才看得到在名單頁編輯下拉裡剛新增的地點／聯絡方式
    refreshLocations()
    refreshMethods()
    refreshFriendOfs()
    refreshDevPartners()
    refreshGoals()
  }
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
const { data: locations, refresh: refreshLocations } = useFetch('/api/contact-locations', { default: () => [] })

const locationLabels = computed(() => (locations.value ?? []).map((l: ContactLocation) => l.label))

// 位置欄增刪（名單頁與明細行為一致：下拉內「＋ 新增」／選項右緣 ×）
async function createLocation(label: string) {
  try {
    await api('/api/contact-locations', { method: 'POST', body: { label } })
    await refreshLocations()
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

// 聯絡方式欄選項（同地點模式：「＋ 新增」建檔＋選項右緣 × 刪除）
const { data: methods, refresh: refreshMethods } = useFetch('/api/contact-methods', { default: () => [] })
const methodLabels = computed(() => (methods.value ?? []).map((m: ContactMethod) => m.label))

async function createMethod(label: string) {
  try {
    await api('/api/contact-methods', { method: 'POST', body: { label } })
    await refreshMethods()
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

// 誰的朋友／開發夥伴欄選項（同地點模式：「＋ 新增」建檔＋選項右緣 × 刪除）
const { data: friendOfs, refresh: refreshFriendOfs } = useFetch('/api/friend-of-options', { default: () => [] })
const friendOfLabels = computed(() => (friendOfs.value ?? []).map((o: FriendOfOption) => o.label))

async function createFriendOf(label: string) {
  try {
    await api('/api/friend-of-options', { method: 'POST', body: { label } })
    await refreshFriendOfs()
  } catch (err: unknown) {
    flash(`新增「誰的朋友」選項失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function deleteFriendOf(label: string) {
  const hit = (friendOfs.value ?? []).find((o: FriendOfOption) => o.label === label)
  if (!hit) return
  try {
    await api(`/api/friend-of-options/${hit.id}`, { method: 'DELETE' })
    await refreshFriendOfs()
  } catch (err: unknown) {
    flash(`刪除「誰的朋友」選項失敗：${(err as Error)?.message}`, { error: true })
  }
}

const { data: devPartners, refresh: refreshDevPartners } = useFetch('/api/dev-partner-options', { default: () => [] })
const devPartnerLabels = computed(() => (devPartners.value ?? []).map((o: DevPartnerOption) => o.label))

async function createDevPartner(label: string) {
  try {
    await api('/api/dev-partner-options', { method: 'POST', body: { label } })
    await refreshDevPartners()
  } catch (err: unknown) {
    flash(`新增「開發夥伴」選項失敗：${(err as Error)?.message}`, { error: true })
  }
}

async function deleteDevPartner(label: string) {
  const hit = (devPartners.value ?? []).find((o: DevPartnerOption) => o.label === label)
  if (!hit) return
  try {
    await api(`/api/dev-partner-options/${hit.id}`, { method: 'DELETE' })
    await refreshDevPartners()
  } catch (err: unknown) {
    flash(`刪除「開發夥伴」選項失敗：${(err as Error)?.message}`, { error: true })
  }
}

// 「目標」欄選項（同地點模式：「＋ 新增」建檔＋選項右緣 × 刪除；預設 seeded 三項）
const { data: goals, refresh: refreshGoals } = useFetch('/api/goal-options', { default: () => [] })
const goalLabels = computed(() => (goals.value ?? []).map((o: GoalOption) => o.label))

async function createGoal(label: string) {
  try {
    await api('/api/goal-options', { method: 'POST', body: { label } })
    await refreshGoals()
  } catch (err: unknown) {
    flash(`新增「目標」選項失敗：${(err as Error)?.message}`, { error: true })
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
          <RCombobox
            v-model="form.location"
            :options="locationLabels"
            empty-text="沒有符合的地點"
            creatable
            deletable
            create-label="新增地點（先輸入名稱）"
            placeholder="地點…"
            aria-label="編輯位置"
            :open-on-focus="false"
            @create="createLocation"
            @delete="deleteLocation"
          />
        </label>

        <label>
          <span>聯絡方式</span>
          <RCombobox
            v-model="form.contact"
            :options="methodLabels"
            empty-text="沒有符合的聯絡方式"
            creatable
            deletable
            create-label="新增聯絡方式（先輸入名稱）"
            placeholder="聯絡方式…"
            aria-label="編輯聯絡方式"
            @create="createMethod"
            @delete="deleteMethod"
          />
        </label>

        <label>
          <span>誰的朋友</span>
          <RCombobox
            v-model="form.friendOf"
            :options="friendOfLabels"
            empty-text="沒有符合的名字，輸入後可選下方新增"
            creatable
            deletable
            create-label="新增名字（先輸入姓名）"
            placeholder="誰的朋友…"
            aria-label="編輯誰的朋友"
            :open-on-focus="false"
            @create="createFriendOf"
            @delete="deleteFriendOf"
          />
        </label>

        <label>
          <span>開發夥伴</span>
          <RCombobox
            v-model="form.devPartner"
            :options="devPartnerLabels"
            empty-text="沒有符合的名字，輸入後可選下方新增"
            creatable
            deletable
            create-label="新增名字（先輸入姓名）"
            placeholder="開發夥伴…"
            aria-label="編輯開發夥伴"
            :open-on-focus="false"
            @create="createDevPartner"
            @delete="deleteDevPartner"
          />
        </label>

        <label>
          <span>目標</span>
          <RCombobox
            v-model="form.goal"
            :options="goalLabels"
            empty-text="沒有符合的目標，輸入後可選下方新增"
            creatable
            deletable
            create-label="新增目標（先輸入名稱）"
            placeholder="目標…"
            aria-label="編輯目標"
            :open-on-focus="false"
            @create="createGoal"
            @delete="deleteGoal"
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
          <span>Info</span>
          <textarea
            v-model="form.info"
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
