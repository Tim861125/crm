<script setup lang="ts">
import RBadge from './rough/RBadge.vue'
import RButton from './rough/RButton.vue'
import RCheckbox from './rough/RCheckbox.vue'
import RCombobox from './rough/RCombobox.vue'
import RDialog from './rough/RDialog.vue'
import RInput from './rough/RInput.vue'
import RDateInput from './rough/RDateInput.vue'
import RRadio from './rough/RRadio.vue'
import RRadioGroup from './rough/RRadioGroup.vue'
import { api, timeAgo, type Contact, type PlanWithStats } from '../utils/crm'
import { isStalled, PLAN_STATUS_META, snapshot, type PlanForm, type PlanStatus } from '#shared/utils/planEval'

// 計畫編輯 dialog（新增／編輯共用）：現象→方法→圈人→期間→狀態。
// 現象與方法用 creatable combobox：建議只是範本，打的字就是值，不必落庫選項表。
const props = defineProps<{ plan: PlanWithStats | null, contacts: Contact[], today: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const { flash } = useNotice()
const { confirm } = useConfirm()

// 現象／方法建議範本
const INSIGHT_PRESETS = ['不讀不回', '已破題但沒下文', '約好又失約', '加了沒聊']
const METHOD_PRESETS = ['發廣告', 'LINE 訊息', 'IG 限動', '群發貼文', '打電話', '見面邀約']

const STATUS_OPTIONS = (Object.keys(PLAN_STATUS_META) as PlanStatus[])
  .map(v => ({ value: v, label: PLAN_STATUS_META[v].label }))

// 表單草稿（欄位型別與 snapshot 共用 PlanForm：改欄位一定會在兩處同時看到）
function blankForm(): PlanForm {
  return { name: '', insight: '', method: '', content: '', audience: [], startDate: '', endDate: '', status: 'planning' }
}
function formFromPlan(p: PlanWithStats): PlanForm {
  return {
    name: p.name,
    insight: p.insight ?? '',
    method: p.method ?? '',
    content: p.content ?? '',
    audience: [...p.audience],
    startDate: p.startDate ?? '',
    endDate: p.endDate ?? '',
    status: p.status
  }
}

const form = ref<PlanForm>(blankForm())

// 未儲存變更偵測：關閉（Esc／背景／關閉鈕／取消）前以全域確認框提示，避免誤丟編輯（比照 ContactDetailModal）。
// 開窗當下把草稿快照成 baseline，之後 snapshot 與之比對即知髒不髒；audience 比對前排序，重排不誤判。
const baseline = ref('')
const dirty = computed(() => snapshot(form.value) !== baseline.value)
function guardClose(): boolean | Promise<boolean> {
  if (!dirty.value) return true
  return confirm({
    title: '未儲存的修改',
    message: '還有未儲存的修改，確定要關閉嗎？未儲存的內容會遺失。',
    confirmLabel: '放棄修改',
    danger: true
  })
}
// 取消鈕與 dialog 的關閉途徑走同一個守門；髒時先確認，true 才真的關
async function cancel() {
  if (await guardClose()) open.value = false
}

watch(open, (isOpen) => {
  if (!isOpen) return
  form.value = props.plan ? formFromPlan(props.plan) : blankForm()
  errors.value = []
  baseline.value = snapshot(form.value)
})

// ── 驗證：送出時檢查必填；錯誤摘要 role="alert" 置頂並移轉焦點 ──
const errors = ref<string[]>([])
const errorSummary = ref<HTMLElement | null>(null)
function validate(): boolean {
  const list: string[] = []
  if (!form.value.name.trim()) list.push('請輸入計畫名稱')
  if (form.value.startDate && form.value.endDate && form.value.endDate < form.value.startDate)
    list.push('結束日不能早於開始日')
  errors.value = list
  if (list.length)
    nextTick(() => errorSummary.value?.focus())
  return list.length === 0
}

// ── 圈選對象：預設鈕一鍵加入 + 勾選清單 ──
const stalledIds = computed(() => props.contacts.filter(c => isStalled(c, props.today)).map(c => c.id))
const unbroachedIds = computed(() => props.contacts.filter(c => !c.broached).map(c => c.id))
const allIds = computed(() => props.contacts.map(c => c.id))
const presets = computed(() => [
  { label: '不讀不回', hint: '逾期或超過 30 天沒跟進', ids: stalledIds.value },
  { label: '未破題', hint: '還沒聊開的', ids: unbroachedIds.value },
  { label: '全部名單', hint: '整張總名單', ids: allIds.value }
])
function addPreset(ids: number[]) {
  const merged = new Set(form.value.audience)
  ids.forEach(id => merged.add(id))
  form.value.audience = [...merged]
}
function removeAudience(id: number) {
  form.value.audience = form.value.audience.filter(x => x !== id)
}
// 勾選清單照總名單熱度習慣排：停擺的先看到
const sortedContacts = computed(() =>
  [...props.contacts].sort((a, b) => {
    const s = Number(isStalled(b, props.today)) - Number(isStalled(a, props.today))
    if (s) return s
    return (a.lastFollowUp ?? '') < (b.lastFollowUp ?? '') ? -1 : 1
  })
)
const selectedCount = computed(() => form.value.audience.length)

const saving = ref(false)
async function submit() {
  if (saving.value || !validate()) return
  saving.value = true
  const body = {
    name: form.value.name,
    insight: form.value.insight,
    method: form.value.method,
    content: form.value.content,
    audience: form.value.audience,
    startDate: form.value.startDate,
    endDate: form.value.endDate,
    status: form.value.status
  }
  try {
    if (props.plan) {
      await api(`/api/plans/${props.plan.id}`, { method: 'PATCH', body })
      flash(`計畫改好了 ✏️「${form.value.name}」`)
    } else {
      await api('/api/plans', { method: 'POST', body })
      flash(`計畫擬好了 ✏️「${form.value.name}」`)
    }
    emit('saved')
    baseline.value = snapshot(form.value) // 剛存過的內容不算未儲存變更；成功關閉直接改 open，不經守門
    open.value = false
  } catch (err: unknown) {
    errors.value = [`儲存失敗：${(err as Error)?.message ?? '請再試'}`]
    nextTick(() => errorSummary.value?.focus())
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <RDialog
    :open="open"
    :title="plan ? '編輯計畫' : '擬新計畫'"
    :guard="guardClose"
    @update:open="open = $event"
  >
    <form
      class="plan-form"
      novalidate
      @submit.prevent="submit"
    >
      <div
        v-if="errors.length"
        ref="errorSummary"
        role="alert"
        tabindex="-1"
        class="plan-form__errors"
      >
        <ul>
          <li
            v-for="e in errors"
            :key="e"
          >
            {{ e }}
          </li>
        </ul>
      </div>

      <label>
        <span>計畫名稱 *</span>
        <RInput
          v-model="form.name"
          placeholder="如：不讀不回重啟計畫"
          required
        />
      </label>

      <label>
        <span>現象（觀察到什麼）</span>
        <RCombobox
          v-model="form.insight"
          :options="INSIGHT_PRESETS"
          creatable
          placeholder="如：不讀不回"
        />
      </label>

      <label>
        <span>方法（用什麼管道）</span>
        <RCombobox
          v-model="form.method"
          :options="METHOD_PRESETS"
          creatable
          placeholder="如：發廣告"
        />
      </label>
      <p
        v-if="form.method.includes('廣告')"
        class="muted-note span-2"
      >
        上傳名單作自訂受眾前，先確認個資與平台條款允許。
      </p>

      <label class="span-2">
        <span>執行內容（素材、話術、備註）</span>
        <textarea
          v-model="form.content"
          rows="3"
          placeholder="例：投一則生活向軟性貼文，不賣產品，兩週後看回應"
        />
      </label>

      <label>
        <span>開始日</span>
        <RDateInput v-model="form.startDate" />
      </label>
      <label>
        <span>結束日</span>
        <RDateInput v-model="form.endDate" />
      </label>

      <fieldset class="span-2 plan-form__field">
        <legend>圈選對象（{{ selectedCount }} 位）</legend>
        <div class="plan-presets">
          <button
            v-for="p in presets"
            :key="p.label"
            type="button"
            class="plan-preset"
            :title="p.hint"
            :disabled="!p.ids.length"
            @click="addPreset(p.ids)"
          >
            ＋ {{ p.label }} <span class="plan-preset__count">{{ p.ids.filter(id => !form.audience.includes(id)).length }}</span>
          </button>
        </div>
        <div
          v-if="sortedContacts.length"
          class="plan-people r-scroll"
        >
          <div
            v-for="c in sortedContacts"
            :key="c.id"
            class="plan-people__row"
          >
            <RCheckbox
              :model-value="form.audience.includes(c.id)"
              :label="c.name"
              @update:model-value="v => v ? addPreset([c.id]) : removeAudience(c.id)"
            />
            <span class="plan-people__meta">
              <RBadge
                v-if="isStalled(c, today)"
                tone="red"
              >
                停擺
              </RBadge>
              <span class="muted-note">最後 {{ timeAgo(c.lastFollowUp) }}</span>
            </span>
          </div>
        </div>
        <p
          v-else
          class="muted-note"
        >
          總名單還沒有資料，先到「總名單」記人再回來圈選。
        </p>
      </fieldset>

      <div class="span-2">
        <span class="plan-form__legend">狀態</span>
        <RRadioGroup
          v-model="form.status"
          name="plan-status"
          label="計畫狀態"
        >
          <RRadio
            v-for="o in STATUS_OPTIONS"
            :key="o.value"
            :value="o.value"
            :label="o.label"
          />
        </RRadioGroup>
      </div>

      <div class="plan-form__actions span-2">
        <RButton
          type="button"
          @click="cancel"
        >
          取消
        </RButton>
        <RButton
          type="submit"
          variant="primary"
          :disabled="saving"
        >
          {{ saving ? '儲存中…' : '儲存' }}
        </RButton>
      </div>
    </form>
  </RDialog>
</template>
